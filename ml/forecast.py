"""
Price forecasting.

Two deliberately simple baselines are compared on a held-out, time-ordered
test split - never shuffled, since shuffling a time series leaks future
information into training:

  1. Naive persistence: tomorrow's price = today's price.
  2. Linear trend: ordinary least squares on day-index -> price.

Whichever has the lower test RMSE is the one actually used to produce the
forward-looking forecast; both scores are recorded either way, so which
model "won" and by how much is visible, not just assumed. This project's
own data volumes (per-pair daily series, commonly well under a year) don't
justify a more complex model like XGBoost - a handful of points can't
support the number of parameters such a model would need without
overfitting, so the complexity is only added if the data actually earns it
(see MIN_POINTS_FOR_COMPLEX_MODEL below, currently unused by design).
"""

import json
from datetime import datetime, timedelta, timezone

import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sqlalchemy import text

from db import get_engine
from common import fetch_pairs_with_min_history, fetch_price_series, generate_id

MODEL_VERSION = "forecast_baseline_v1"
MIN_POINTS_FOR_FORECAST = 21
TEST_DAYS = 7  # held out from the end, chronologically - never shuffled
HORIZON_DAYS = 7

# Not used yet - documents the threshold this project would want before
# reaching for a materially more complex model, rather than leaving that
# decision unstated.
MIN_POINTS_FOR_COMPLEX_MODEL = 180


def _rmse(y_true, y_pred) -> float:
    return float(np.sqrt(mean_squared_error(y_true, y_pred)))


def evaluate_naive(train_prices: np.ndarray, test_prices: np.ndarray) -> tuple[float, float]:
    """Naive persistence: predict each test day as the previous day's
    actual price (the last train value, then each prior test value)."""
    history = list(train_prices)
    preds = []
    for actual in test_prices:
        preds.append(history[-1])
        history.append(actual)
    return mean_absolute_error(test_prices, preds), _rmse(test_prices, preds)


def evaluate_linear_trend(train_prices: np.ndarray, test_prices: np.ndarray) -> tuple[float, float, LinearRegression]:
    x_train = np.arange(len(train_prices)).reshape(-1, 1)
    model = LinearRegression().fit(x_train, train_prices)

    x_test = np.arange(len(train_prices), len(train_prices) + len(test_prices)).reshape(-1, 1)
    preds = model.predict(x_test)
    return mean_absolute_error(test_prices, preds), _rmse(test_prices, preds), model


def forecast_future(df, winner: str, residual_std: float):
    """Refits on ALL available data (not just the train split) to produce
    the actual forward-looking forecast, since there's no reason to throw
    away the most recent TEST_DAYS of real data once evaluation is done."""
    prices = df["price"].to_numpy()
    last_date = df["date"].max()

    if winner == "naive":
        base_value = float(prices[-1])
        predictions = [base_value] * HORIZON_DAYS
    else:
        x_all = np.arange(len(prices)).reshape(-1, 1)
        model = LinearRegression().fit(x_all, prices)
        x_future = np.arange(len(prices), len(prices) + HORIZON_DAYS).reshape(-1, 1)
        predictions = list(model.predict(x_future))

    # A simple, honestly-labeled prediction interval from the held-out
    # residual spread - not a formal confidence interval, but an order-of-
    # magnitude uncertainty band, which is what a baseline model can
    # responsibly offer.
    results = []
    for i, predicted_price in enumerate(predictions, start=1):
        forecast_date = last_date + timedelta(days=i)
        results.append(
            {
                "forecastDate": forecast_date.date(),
                "predictedPrice": float(predicted_price),
                "lowerBound": float(predicted_price - residual_std),
                "upperBound": float(predicted_price + residual_std),
                "horizonDays": i,
            }
        )
    return results


def upsert_forecast_results(engine, market_id: str, commodity_id: str, forecasts: list[dict]) -> int:
    if not forecasts:
        return 0

    rows = [
        {
            "id": generate_id(),
            "marketId": market_id,
            "commodityId": commodity_id,
            "forecastDate": f["forecastDate"],
            "predictedPrice": f["predictedPrice"],
            "lowerBound": f["lowerBound"],
            "upperBound": f["upperBound"],
            "modelVersion": MODEL_VERSION,
            "horizonDays": f["horizonDays"],
        }
        for f in forecasts
    ]

    upsert_sql = text(
        """
        INSERT INTO "ForecastResult"
            ("id", "marketId", "commodityId", "forecastDate", "predictedPrice",
             "lowerBound", "upperBound", "modelVersion", "horizonDays")
        VALUES
            (:id, :marketId, :commodityId, :forecastDate, :predictedPrice,
             :lowerBound, :upperBound, :modelVersion, :horizonDays)
        ON CONFLICT ("marketId", "commodityId", "forecastDate", "horizonDays", "modelVersion")
        DO UPDATE SET
            "predictedPrice" = EXCLUDED."predictedPrice",
            "lowerBound" = EXCLUDED."lowerBound",
            "upperBound" = EXCLUDED."upperBound",
            "generatedAt" = now()
        """
    )
    with engine.begin() as conn:
        conn.execute(upsert_sql, rows)
    return len(rows)


def record_model_run(engine, market_id, commodity_id, status, metrics=None, notes=None, started_at=None):
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                INSERT INTO "ModelRun"
                    ("id", "jobType", "marketId", "commodityId", "modelVersion",
                     "startedAt", "finishedAt", "status", "metrics", "notes")
                VALUES
                    (:id, 'FORECAST', :marketId, :commodityId, :modelVersion,
                     :startedAt, :finishedAt, :status, :metrics, :notes)
                """
            ),
            {
                "id": generate_id(),
                "marketId": market_id,
                "commodityId": commodity_id,
                "modelVersion": MODEL_VERSION,
                "startedAt": started_at or datetime.now(timezone.utc),
                "finishedAt": datetime.now(timezone.utc),
                "status": status,
                "metrics": json.dumps(metrics) if metrics else None,
                "notes": json.dumps(notes) if notes else None,
            },
        )


def run():
    engine = get_engine()
    pairs = fetch_pairs_with_min_history(engine, MIN_POINTS_FOR_FORECAST)

    print(f"Forecasting: {len(pairs)} market/commodity pairs have >= {MIN_POINTS_FOR_FORECAST} days of history")

    succeeded = 0

    for market_id, commodity_id, market_name, commodity_name, point_count in pairs:
        started_at = datetime.now(timezone.utc)
        df = fetch_price_series(engine, market_id, commodity_id)

        if len(df) < MIN_POINTS_FOR_FORECAST:
            record_model_run(
                engine, market_id, commodity_id, "SKIPPED_INSUFFICIENT_DATA",
                notes={"pointCount": len(df)}, started_at=started_at,
            )
            continue

        prices = df["price"].to_numpy()
        train, test = prices[:-TEST_DAYS], prices[-TEST_DAYS:]

        naive_mae, naive_rmse = evaluate_naive(train, test)
        trend_mae, trend_rmse, _ = evaluate_linear_trend(train, test)

        winner = "linear_trend" if trend_rmse < naive_rmse else "naive"
        # Uncertainty band from the winning model's own held-out residuals:
        if winner == "naive":
            preds_for_residuals = [train[-1]] + list(test[:-1])
        else:
            x_test = np.arange(len(train), len(train) + len(test)).reshape(-1, 1)
            preds_for_residuals = LinearRegression().fit(
                np.arange(len(train)).reshape(-1, 1), train
            ).predict(x_test)
        residual_std = float(np.std(test - np.array(preds_for_residuals))) or float(np.std(test)) or 1.0

        forecasts = forecast_future(df, "naive" if winner == "naive" else "linear_trend", residual_std)
        upsert_forecast_results(engine, market_id, commodity_id, forecasts)

        metrics = {
            "winner": winner,
            "naive": {"mae": round(naive_mae, 4), "rmse": round(naive_rmse, 4)},
            "linearTrend": {"mae": round(trend_mae, 4), "rmse": round(trend_rmse, 4)},
            "mae": round(naive_mae if winner == "naive" else trend_mae, 4),
            "rmse": round(naive_rmse if winner == "naive" else trend_rmse, 4),
            "trainSize": len(train),
            "testSize": len(test),
        }
        record_model_run(engine, market_id, commodity_id, "SUCCESS", metrics=metrics, started_at=started_at)

        succeeded += 1
        print(f"  {commodity_name} @ {market_name}: winner={winner} (naive RMSE={naive_rmse:.2f}, trend RMSE={trend_rmse:.2f})")

    print(f"\nDone. Forecasts generated for {succeeded}/{len(pairs)} pairs.")


if __name__ == "__main__":
    run()
