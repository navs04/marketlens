"""
Spike-risk scoring.

This is a deliberately transparent, rule-based heuristic, not a trained
classifier. A trained classifier needs labeled historical spike events to
learn from, and this project has none - fabricating labels (e.g. "call
anything above 2 std devs a historical spike, then train on that") would
just be training a model to reproduce the anomaly detector's own rule,
which adds complexity without adding real predictive signal. The honest
baseline is to combine the signals that plausibly matter into one
transparent score, document the weights, and leave "train a real
classifier" as future work once real spike outcomes have been observed
and logged over time.

riskProbability (0-1) is a weighted combination of three signals, each
independently normalized to 0-1:
  - anomaly signal:  how far the most recent day's price sits above its
                      rolling baseline (reuses anomaly.py's exact z-score
                      calculation - only the *upward* direction counts,
                      since a spike is specifically a price increase)
  - trend signal:    the forecast model's predicted % change over the
                      horizon (only upward movement counts)
  - volatility signal: recent coefficient of variation (std/mean) of
                      price - more volatile series are treated as more
                      spike-prone, independent of current direction
"""

import json
from datetime import datetime, timezone

import numpy as np
from sqlalchemy import text

from db import get_engine
from common import fetch_pairs_with_min_history, fetch_price_series, generate_id
from anomaly import score_series, MIN_POINTS as ANOMALY_MIN_POINTS

MODEL_VERSION = "spike_risk_heuristic_v1"
HORIZON_DAYS = 7
VOLATILITY_WINDOW = 14

# Weights, and the signal magnitude treated as "fully risky" (normalized to
# 1.0) for each component - documented constants rather than opaque magic
# numbers, so the scoring is auditable and adjustable.
WEIGHT_ANOMALY = 0.40
WEIGHT_TREND = 0.35
WEIGHT_VOLATILITY = 0.25
ANOMALY_Z_REFERENCE = 3.0  # a z-score of 3+ above baseline treated as max anomaly signal
TREND_PCT_REFERENCE = 15.0  # a forecast +15% over the horizon treated as max trend signal
VOLATILITY_CV_REFERENCE = 0.25  # a coefficient of variation of 0.25+ treated as max volatility signal


def _normalize_positive(value: float, reference: float) -> float:
    return float(min(1.0, max(0.0, value) / reference))


def compute_risk(engine, market_id: str, commodity_id: str, df) -> dict | None:
    if len(df) < ANOMALY_MIN_POINTS:
        return None

    scored = score_series(df)
    if scored.empty:
        return None

    latest = scored.iloc[-1]
    anomaly_signal = _normalize_positive(float(latest["zscore"]), ANOMALY_Z_REFERENCE)

    recent = df.tail(VOLATILITY_WINDOW)["price"]
    cv = float(recent.std() / recent.mean()) if recent.mean() else 0.0
    volatility_signal = _normalize_positive(cv, VOLATILITY_CV_REFERENCE)

    with engine.connect() as conn:
        forecast_row = conn.execute(
            text(
                """
                SELECT "predictedPrice" FROM "ForecastResult"
                WHERE "marketId" = :market_id AND "commodityId" = :commodity_id
                  AND "horizonDays" = :horizon
                ORDER BY "generatedAt" DESC LIMIT 1
                """
            ),
            {"market_id": market_id, "commodity_id": commodity_id, "horizon": HORIZON_DAYS},
        ).fetchone()

    current_price = float(df["price"].iloc[-1])
    trend_signal = 0.0
    forecast_pct_change = None
    if forecast_row:
        forecast_pct_change = (float(forecast_row[0]) - current_price) / current_price * 100
        trend_signal = _normalize_positive(forecast_pct_change, TREND_PCT_REFERENCE)

    risk = (
        WEIGHT_ANOMALY * anomaly_signal
        + WEIGHT_TREND * trend_signal
        + WEIGHT_VOLATILITY * volatility_signal
    )

    return {
        "asOfDate": df["date"].max().date(),
        "riskProbability": round(float(risk), 4),
        "signals": {
            "anomalySignal": round(anomaly_signal, 4),
            "trendSignal": round(trend_signal, 4),
            "volatilitySignal": round(volatility_signal, 4),
            "latestZScore": round(float(latest["zscore"]), 4),
            "forecastPctChange": round(forecast_pct_change, 4) if forecast_pct_change is not None else None,
            "recentCoefficientOfVariation": round(cv, 4),
        },
    }


def upsert_spike_risk(engine, market_id: str, commodity_id: str, result: dict) -> None:
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                INSERT INTO "SpikeRiskScore"
                    ("id", "marketId", "commodityId", "asOfDate", "riskProbability",
                     "horizonDays", "modelVersion")
                VALUES
                    (:id, :marketId, :commodityId, :asOfDate, :riskProbability,
                     :horizonDays, :modelVersion)
                ON CONFLICT ("marketId", "commodityId", "asOfDate", "horizonDays", "modelVersion")
                DO UPDATE SET "riskProbability" = EXCLUDED."riskProbability"
                """
            ),
            {
                "id": generate_id(),
                "marketId": market_id,
                "commodityId": commodity_id,
                "asOfDate": result["asOfDate"],
                "riskProbability": result["riskProbability"],
                "horizonDays": HORIZON_DAYS,
                "modelVersion": MODEL_VERSION,
            },
        )


def record_model_run(engine, market_id, commodity_id, status, metrics=None, notes=None, started_at=None):
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                INSERT INTO "ModelRun"
                    ("id", "jobType", "marketId", "commodityId", "modelVersion",
                     "startedAt", "finishedAt", "status", "metrics", "notes")
                VALUES
                    (:id, 'SPIKE_RISK', :marketId, :commodityId, :modelVersion,
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
    pairs = fetch_pairs_with_min_history(engine, ANOMALY_MIN_POINTS)

    print(f"Spike-risk scoring: {len(pairs)} market/commodity pairs have >= {ANOMALY_MIN_POINTS} days of history")

    scored_count = 0

    for market_id, commodity_id, market_name, commodity_name, point_count in pairs:
        started_at = datetime.now(timezone.utc)
        df = fetch_price_series(engine, market_id, commodity_id)
        result = compute_risk(engine, market_id, commodity_id, df)

        if result is None:
            record_model_run(
                engine, market_id, commodity_id, "SKIPPED_INSUFFICIENT_DATA",
                notes={"pointCount": len(df)}, started_at=started_at,
            )
            continue

        upsert_spike_risk(engine, market_id, commodity_id, result)
        record_model_run(
            engine, market_id, commodity_id, "SUCCESS",
            metrics=result["signals"], started_at=started_at,
        )
        scored_count += 1
        print(f"  {commodity_name} @ {market_name}: risk={result['riskProbability']:.2f}")

    print(f"\nDone. Spike risk scored for {scored_count}/{len(pairs)} pairs.")


if __name__ == "__main__":
    run()
