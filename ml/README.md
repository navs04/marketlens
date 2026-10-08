# MarketLens ML pipeline

Batch jobs that read real price history from Postgres and write derived
results back to it: anomaly detection, forecasting, and spike-risk
scoring. The Node API only ever *reads* these tables - it never computes
a prediction itself, per this project's core architectural principle.

## Setup

```bash
cd ml
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

No separate `.env` needed - `db.py` reads `DATABASE_URL` directly from
`apps/api/.env`, so there's exactly one connection string for the whole
project.

## Running

Run after ingestion (`npm run ingest` or `npm run ingest:csv`) has put
real price data in the database:

```bash
python run_all.py
```

This runs, in order: anomaly detection, forecasting, then spike-risk
scoring (spike-risk reads each pair's forecast, so it must run last).
Each is also runnable individually - `python anomaly.py`, `python
forecast.py`, `python spike_risk.py` - useful if you only want to
refresh one.

Safe to re-run at any time: every write is an upsert keyed on the
relevant natural key (market + commodity + date, for example), so running
it again after new data arrives simply refreshes results rather than
duplicating them.

## What each job does, and its minimum data requirement

| Job | Method | Minimum days of history per market+commodity pair |
|---|---|---|
| `anomaly.py` | Rolling 14-day mean/std z-score (no leakage - only prior days inform each day's baseline) | 19 |
| `forecast.py` | Compares a naive persistence baseline against a linear trend model on a held-out, time-ordered 7-day test split; forecasts from whichever actually wins | 21 |
| `spike_risk.py` | Transparent weighted heuristic (not a trained classifier - see the module docstring for why) combining the anomaly signal, forecast trend, and recent volatility | 19 (plus needs `anomaly.py` and `forecast.py` to have already run) |

Pairs below the minimum are skipped, not forced through a model that
doesn't have enough data to be meaningful - each skip is logged as a
`ModelRun` row with status `SKIPPED_INSUFFICIENT_DATA`, not silently
dropped.

## Why no XGBoost/complex model yet

`forecast.py`'s docstring documents `MIN_POINTS_FOR_COMPLEX_MODEL = 180`
as the threshold this project would want before reaching for something
like XGBoost - a handful of daily points per series can't support the
parameter count such a model needs without overfitting. Revisit once a
market+commodity pair actually accumulates that much history.
