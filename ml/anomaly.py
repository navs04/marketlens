"""
Price anomaly detection.

Method: rolling z-score. For each day, the "expected" price is the mean of
the preceding ROLLING_WINDOW days (not including the day itself, to avoid
leakage), and the day's z-score is (observed - rolling_mean) / rolling_std.
A day is flagged isAnomaly=True when |z-score| exceeds Z_THRESHOLD.

This is a standard, explainable baseline - not a learned model - which is
the right amount of sophistication for the data volumes a single
market+commodity pair in this dataset actually has (see MIN_POINTS below).
Only FLAGGED days are stored. Every day is scored in memory, but writing a
row for each scored day of each market+commodity pair made this table the
largest in the database (485 MB of a 1 GB database in the real dataset) while
nothing reads the unflagged rows: the chart marks only flagged days, the
feed and the overview count only flagged days, and "is today's price
unusual?" is answered by asking whether a flagged row exists for that date.
Each run replaces a pair's rows, so re-running is idempotent and also
removes rows written by earlier versions that stored every day.
"""

import json
from datetime import datetime, timezone

from sqlalchemy import text

from db import get_engine
from common import fetch_pairs_with_min_history, fetch_price_series, generate_id

METHOD = "rolling_zscore"
MODEL_VERSION = "anomaly_zscore_v1"
ROLLING_WINDOW = 14
Z_THRESHOLD = 2.0
MIN_POINTS = ROLLING_WINDOW + 5  # need enough history to form a baseline *and* score some days


def score_series(df):
    """Returns a DataFrame with columns: date, observed, expected, std,
    zscore, deviation_pct, is_anomaly - one row per day that had enough
    prior history to score (earlier days are dropped, not fabricated)."""
    df = df.sort_values("date").reset_index(drop=True)
    rolling = df["price"].rolling(window=ROLLING_WINDOW, min_periods=ROLLING_WINDOW)
    df["expected"] = rolling.mean().shift(1)
    df["std"] = rolling.std().shift(1)

    scored = df.dropna(subset=["expected", "std"]).copy()
    scored = scored[scored["std"] > 0]  # a zero-variance baseline can't produce a meaningful z-score

    scored["zscore"] = (scored["price"] - scored["expected"]) / scored["std"]
    scored["deviation_pct"] = (scored["price"] - scored["expected"]) / scored["expected"] * 100
    scored["is_anomaly"] = scored["zscore"].abs() > Z_THRESHOLD
    return scored.rename(columns={"price": "observed"})[
        ["date", "observed", "expected", "zscore", "deviation_pct", "is_anomaly"]
    ]


def replace_anomaly_flags(engine, market_id: str, commodity_id: str, scored) -> int:
    """Replaces this pair's stored anomalies with the flagged days from `scored`.

    Delete + insert in one transaction, so a re-run (or a change of threshold)
    can never leave behind a day that is no longer flagged, and a failed run
    leaves the previous rows untouched. Returns the number of rows stored.
    """
    flagged = scored[scored["is_anomaly"]]

    rows = [
        {
            "id": generate_id(),
            "marketId": market_id,
            "commodityId": commodity_id,
            "date": row.date.date(),
            "observedPrice": float(row.observed),
            "expectedPrice": float(row.expected),
            "deviationPct": float(row.deviation_pct),
            "isAnomaly": True,
            "method": METHOD,
        }
        for row in flagged.itertuples()
    ]

    insert_sql = text(
        """
        INSERT INTO "AnomalyFlag"
            ("id", "marketId", "commodityId", "date", "observedPrice", "expectedPrice",
             "deviationPct", "isAnomaly", "method")
        VALUES
            (:id, :marketId, :commodityId, :date, :observedPrice, :expectedPrice,
             :deviationPct, :isAnomaly, :method)
        """
    )
    with engine.begin() as conn:
        conn.execute(
            text('DELETE FROM "AnomalyFlag" WHERE "marketId" = :m AND "commodityId" = :c AND "method" = :method'),
            {"m": market_id, "c": commodity_id, "method": METHOD},
        )
        if rows:
            conn.execute(insert_sql, rows)
    return len(rows)


def record_model_run(engine, market_id, commodity_id, status, notes=None, started_at=None):
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                INSERT INTO "ModelRun"
                    ("id", "jobType", "marketId", "commodityId", "modelVersion",
                     "startedAt", "finishedAt", "status", "notes")
                VALUES
                    (:id, 'ANOMALY', :marketId, :commodityId, :modelVersion,
                     :startedAt, :finishedAt, :status, :notes)
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
                "notes": json.dumps(notes) if notes else None,
            },
        )


def run():
    engine = get_engine()
    pairs = fetch_pairs_with_min_history(engine, MIN_POINTS)

    print(f"Anomaly detection: {len(pairs)} market/commodity pairs have >= {MIN_POINTS} days of history")

    total_flagged = 0
    total_scored = 0

    for market_id, commodity_id, market_name, commodity_name, point_count in pairs:
        started_at = datetime.now(timezone.utc)
        df = fetch_price_series(engine, market_id, commodity_id)
        scored = score_series(df)

        if scored.empty:
            record_model_run(
                engine, market_id, commodity_id, "SKIPPED_INSUFFICIENT_DATA",
                notes={"pointCount": point_count}, started_at=started_at,
            )
            continue

        anomalies_found = replace_anomaly_flags(engine, market_id, commodity_id, scored)
        total_flagged += anomalies_found
        total_scored += len(scored)

        record_model_run(
            engine, market_id, commodity_id, "SUCCESS",
            notes={"daysScored": len(scored), "anomaliesFlagged": anomalies_found},
            started_at=started_at,
        )
        print(f"  {commodity_name} @ {market_name}: scored {len(scored)} days, {anomalies_found} flagged")

    print(f"\nDone. {total_scored} days scored, {total_flagged} flagged and stored.")


if __name__ == "__main__":
    run()
