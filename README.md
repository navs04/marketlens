# MarketLens

Hyperlocal market price intelligence and spike prediction, built on real Agmarknet / data.gov.in mandi price data.

ML models produce every number (forecasts, anomaly scores, risk scores). An LLM is only ever asked to explain those numbers in plain language, and it never produces them. If no LLM key is configured, the app falls back to a deterministic explanation built from the same data.

## What it does

- **Real data pipeline**: ingests mandi prices from the data.gov.in API, or from a downloaded CSV when the API is unreachable. Validates, normalizes, deduplicates, and rejects bad records with a logged reason.
- **Analytics API**: current price, historical baseline, deviation, trend, and cross-market comparison.
- **ML pipeline (Python)**: rolling z-score anomaly detection, forecasting (naive vs. linear trend, evaluated on a time-ordered held-out split with MAE/RMSE), and a transparent spike-risk score.
- **AI explanations**: structured numbers in, plain-language text out, with a deterministic fallback.
- **Dashboard**: overview stats, per-commodity/market price chart with forecast and anomaly markers, market comparison, a price-intelligence feed, and market detail pages.

## Stack

React, TypeScript, Vite, Tailwind CSS 4, Recharts / Express 5, TypeScript, Prisma 6 / PostgreSQL / Python (pandas, scikit-learn, SQLAlchemy)

## Prerequisites

- Node.js 22.12+ or 24.x
- Python 3.11+
- PostgreSQL 16 (Docker, or a native install)
- Optional: a data.gov.in API key, if you want live ingestion
- Optional: an Anthropic API key, if you want AI-written explanations

## Setup

```bash
npm install

# Postgres: either use Docker...
docker compose -f infra/docker-compose.yml up -d
# ...or point DATABASE_URL at your existing Postgres.

cp apps/api/.env.example apps/api/.env
# edit apps/api/.env: set DATABASE_URL, and optionally the API keys

npm run prisma:migrate     # creates all tables
npm run prisma:seed        # seeds a few reference markets/commodities (no prices)
```

## Loading price data

The app needs real price history in the database. There are two ways to load it.

**Option A: live API** (needs `DATA_GOV_IN_API_KEY`)
```bash
npm run ingest
```

**Option B: CSV import**, for when the API is unreachable or you want deeper history
```bash
# put the file in apps/api/data-imports/, then run from the repo root:
npm run ingest:csv -- data-imports/your-file.csv

# if the file has no "Commodity" column (some one-crop-per-file exports):
npm run ingest:csv -- data-imports/onion.csv --commodity Onion
```

Notes:
- The path is relative to `apps/api/`, not the repo root, because npm changes directory when running a workspace script.
- Both paths use the same validation and normalization and write through the same upsert logic, so they are safe to re-run.
- Large files (1M+ rows) import in batches with progress output. Expect a minute or two.
- Rejected rows are logged to `apps/api/logs/` with a reason.
- Check how much history you actually have before expecting forecasts. The live data.gov.in resource is a current-day snapshot and does not retain history, so a single-day file can't support forecasting.

## Running the ML pipeline

Run this after price data is loaded:

```bash
cd ml
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python run_all.py
```

Run it from `ml/`. It reads `DATABASE_URL` from `apps/api/.env`. See `ml/README.md` for what each job does and its minimum history requirements. Pairs with too little history are skipped and logged, not forced through a model. Safe to re-run any time, and you should re-run it after loading new data.

## Running the app

```bash
npm run dev:api    # http://localhost:4000
npm run dev:web    # http://localhost:5173
```

## Environment variables (`apps/api/.env`)

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string |
| `PORT`, `CORS_ORIGIN`, `NODE_ENV` | no | Server settings (defaults provided) |
| `DATA_GOV_IN_API_KEY` | only for `npm run ingest` | Live data.gov.in ingestion |
| `ANTHROPIC_API_KEY` | no | AI-written explanations. Without it, explanations are deterministic. |
| `INGEST_*` | no | Tuning for live ingestion (see `.env.example`) |

Never commit `.env`. It is gitignored.

## API overview

All routes are under `/api/v1`.

| Route | Purpose |
|---|---|
| `GET /health` | Liveness and database check |
| `GET /overview` | Dashboard summary counts |
| `GET /markets`, `/markets/states`, `/markets/:id`, `/markets/:id/commodities` | Markets, with state/district/search filters |
| `GET /commodities`, `/commodities/:id` | Commodities |
| `GET /prices` | Historical prices (filter by market, commodity, state, district, date range) |
| `GET /prices/latest`, `/prices/summary`, `/prices/compare` | Latest price, baseline analytics, cross-market comparison |
| `GET /forecasts` | Stored forecasts plus evaluation metrics (MAE/RMSE) |
| `GET /anomalies`, `/anomalies/feed` | Per-pair anomaly scores and a cross-market feed |
| `GET /spike-risk`, `/spike-risk/feed` | Per-pair and highest-risk spike scores |
| `GET /explanation` | Plain-language explanation (LLM or deterministic fallback) |

## Repository layout

```
apps/api/               Express + TypeScript backend, Prisma schema
apps/api/src/ingestion/ data.gov.in ingestion (live API and CSV import)
apps/api/src/llm/       Anthropic client (optional, with graceful fallback)
apps/api/data-imports/  drop downloaded CSVs here (gitignored)
apps/web/               React + TypeScript + Vite frontend
ml/                     Python batch jobs: anomaly detection, forecasting, spike risk
infra/                  Local Postgres (docker-compose)
docs/                   Architecture decision notes
```

## Design decisions worth knowing

Full reasoning is in `docs/architecture-decisions.md`. The short version:

- **Prisma is pinned to 6.19.3**, not 7.x. Prisma 7 requires driver adapters and a separate config file, which is more churn than this project needs.
- **TypeScript is pinned to 6.0.3**, because the surrounding tooling doesn't support 7.x yet.
- **Spike risk is a documented, rule-based heuristic**, not a trained classifier. There is no labeled historical spike data to train one honestly.
- **Forecasting compares two simple baselines** and uses whichever wins on held-out data. A more complex model is only justified once the data volume supports it.
- **Prices are stored as per-quintal modal prices.** The source publishes no unit field, so "per quintal" is an explicit, documented assumption.

## Known limitations

- Responsive design is partial: content grids reflow, but the sidebar does not collapse into a mobile drawer.
- The Markets table renders at most 500 rows rather than using real pagination.
- ML jobs run manually. Scheduling is not set up.
- Medicines (NPPA) and LPG data sources from the original plan are not implemented.
- No user accounts. The `User` and `Alert` tables exist in the schema but are unused.