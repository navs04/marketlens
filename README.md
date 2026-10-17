# MarketLens

Hyperlocal market price intelligence and spike prediction, built on real Agmarknet / data.gov.in mandi price data.

ML models produce every number (forecasts, anomaly scores, risk scores). An LLM is only ever asked to explain those numbers in plain language, and it never produces them. If no LLM key is configured, the app falls back to a deterministic explanation built from the same data.

## What it does

- **Real data pipeline**: ingests mandi prices from the data.gov.in API, or from a downloaded CSV when the API is unreachable. Validates, normalizes, deduplicates, and rejects bad records with a logged reason.
- **Analytics API**: daily price series, current price, historical baseline, deviation, trend, cross-market comparison, sparklines, and biggest movers.
- **ML pipeline (Python)**: rolling z-score anomaly detection, forecasting (naive vs. linear trend, evaluated on a time-ordered held-out split with MAE/RMSE), and a transparent spike-risk score.
- **AI explanations**: structured numbers in, plain-language text out, with a deterministic fallback.
- **Dashboard**:
  - overview stats and a per-commodity/market price chart (30D / 90D / 1Y)
  - the forecast's uncertainty band, a min/max range band, and anomaly markers sized by deviation
  - biggest movers
  - market comparison with sparklines
  - a price-intelligence feed
  - market detail pages
- **Navigation**: the selected market, commodity, and chart range live in the URL, so refresh, back/forward, and shared links work. `Ctrl+K` opens a command palette to jump to any market, commodity, or page. The sidebar collapses into a drawer on small screens.

## Stack

React, TypeScript, Vite, Tailwind CSS 4, Recharts / Express 5, TypeScript, Prisma 6, PostgreSQL / Python (pandas, scikit-learn, SQLAlchemy)

## Prerequisites

- Node.js 22.12+ or 24.x
- Python 3.11+
- PostgreSQL 16 (Docker, or a native install)
- Optional: a data.gov.in API key, for live ingestion
- Optional: an Anthropic API key, for AI-written explanations

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
- Check how much history you have before expecting forecasts. The live data.gov.in resource is a current-day snapshot and does not retain history, so a single-day file can't support forecasting.

## Running the ML pipeline

Run this after price data is loaded, and again whenever you load new data:

```bash
cd ml
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python run_all.py
```

Run it from `ml/`. It reads `DATABASE_URL` from `apps/api/.env`. See `ml/README.md` for what each job does and its minimum history requirements. Pairs with too little history, or with no price variation, are skipped and logged, not forced through a model. Safe to re-run.

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
| `GET /overview` | Dashboard summary counts and the latest data date |
| `GET /markets`, `/markets/states`, `/markets/:id`, `/markets/:id/commodities` | Markets. Add `page` / `pageSize` for server-side pagination; `search` matches name, state, or district |
| `GET /commodities`, `/commodities/:id` | Commodities |
| `GET /prices` | Raw price rows (filter by market, commodity, state, district, date range) |
| `GET /prices/series` | One averaged price per day for a market and commodity, over `range=30D\|90D\|1Y`, anchored to that pair's latest date |
| `GET /prices/latest`, `/prices/summary`, `/prices/compare` | Latest price, baseline analytics (same daily series as the chart), cross-market comparison |
| `GET /prices/sparklines` | Recent daily series for many `marketId:commodityId` pairs in one query |
| `GET /prices/movers` | Biggest commodity-level price moves (definition in `docs/architecture-decisions.md`) |
| `GET /forecasts` | Stored forecasts with lower/upper bounds, plus evaluation metrics (MAE/RMSE) |
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

## Deployment

See `docs/DEPLOYMENT.md` for deploying to Neon (Postgres) + Render (API and static web) with the included `render.yaml`, including how to check that your data fits a free database.

## Design decisions worth knowing

Full reasoning is in `docs/architecture-decisions.md`. The short version:

- **Prisma is pinned to 6.19.3**, not 7.x. Prisma 7 requires driver adapters and a separate config file, which is more churn than this project needs.
- **TypeScript is pinned to 6.0.3**, because the surrounding tooling doesn't support 7.x yet.
- **Spike risk is a documented, rule-based heuristic**, not a trained classifier. There is no labeled historical spike data to train one honestly.
- **Forecasting compares two simple baselines** and uses whichever wins on held-out data. A more complex model is only justified once the data volume supports it.
- **Prices are per-quintal modal prices.** The source publishes no unit field, so "per quintal" is an explicit, documented assumption.
- **Charts show a daily average across varieties**, matching what the ML jobs score, so anomaly dates and forecasts line up with what is plotted.
- **The UI shows only stored values.** Forecast bands come from stored bounds, anomaly tooltips from stored scores, and nothing is generated client-side. If a value isn't stored (z-scores, for example), it isn't shown.

## Known limitations

- The tooltip does not show z-scores: the ML job computes them but does not store them.
- Market and commodity selectors are plain dropdowns over the full lists. With thousands of markets, the command palette (`Ctrl+K`) is the faster way to find one.
- ML jobs run manually. Scheduling is not set up.
- No automated test suite is committed. Features were verified with throwaway harnesses against a real PostgreSQL (see `docs/architecture-decisions.md`), but those depend on a local sandbox setup and are not part of the repo.
- Medicines (NPPA) and LPG data sources from the original plan are not implemented.
- No user accounts. The `User` and `Alert` tables exist in the schema but are unused.
