# MarketLens

Hyperlocal market price intelligence & spike prediction. See `docs/architecture-decisions.md`
for the reasoning behind key structural choices made in this milestone.

## Project status

**Milestone 1 of 7: Project Foundation.** This milestone establishes the frontend, backend,
and database scaffolding only. There is no data ingestion, ML, or AI yet — those arrive in
later milestones. Endpoints for prices/forecasts/anomalies/spike-risk/explanation exist and
are routed, but respond `501 Not Implemented` until their milestone lands.

## Prerequisites

- Node.js 22.12+ or 24.x
- Docker (for local Postgres) — or a Postgres 16 instance you already have

## Setup

```bash
# from the repo root
npm install

# start Postgres locally
docker compose -f infra/docker-compose.yml up -d

# configure the backend
cp apps/api/.env.example apps/api/.env
# (defaults already match the docker-compose Postgres credentials)

# create the database schema
npm run prisma:migrate

# seed reference data (real market/commodity names, no fabricated prices)
npm run prisma:seed
```

## Running

In two terminals:

```bash
npm run dev:api   # http://localhost:4000
npm run dev:web   # http://localhost:5173
```

Open http://localhost:5173.

## Repository layout

```
apps/api/    Express + TypeScript backend, Prisma schema
apps/web/    React + TypeScript + Vite frontend
infra/       Local Postgres (docker-compose)
docs/        Architecture decision notes
```
