# Architecture Decisions — Milestone 1

## Monorepo via npm workspaces, not a build tool
`apps/api` and `apps/web` are separate npm packages under one root, linked with native npm
workspaces (no Nx/Turborepo). At this scale, an extra build-orchestration tool would be
overhead without payoff — npm workspaces already give shared installs and per-package scripts.

## TypeScript pinned to 6.0.3, not the new 7.0 native compiler
TypeScript 7.0 (the Go-rewritten "native" compiler) is GA, but `typescript-eslint`'s published
peer dependency range is `>=4.8.4 <6.1.0` — it does not yet support 7.x. Rather than adopt the
newest release and immediately fight tooling incompatibility, both apps pin to `6.0.3`, the
final release of the previous (JS-based) compiler line, which is compatible with the full
current ecosystem. This is worth revisiting once `typescript-eslint` publishes 7.x support.

## Express 5, not 4
Express 5 forwards rejected promises from async route handlers to error-handling middleware
automatically. That removes the need for a manual `asyncHandler` wrapper around every
controller method — route code can simply `throw` or `await` a rejecting call, and it lands in
`middleware/errorHandler.ts`.

## Python and Node communicate through Postgres, not a live RPC call
Ingestion and ML (arriving in later milestones) will be a separate Python process that writes
directly to the same Postgres database Prisma reads from. The Express API never calls into
Python synchronously in the request path. This keeps the two runtimes' failure domains
independent and matches how batch-scored ML systems are commonly deployed in production.

## Routes for unimplemented features are wired now, and return 501
`prices`, `forecasts`, `anomalies`, `spike-risk`, and `explanation` all have real route files
mounted on the API today, each throwing a `501 Not Implemented` `AppError` with a note on which
milestone will implement it. This makes the full intended API surface visible and testable from
Milestone 1, rather than requiring routes to be silently redefined later.

## Prisma pinned to 6.19.3, not 7.x — updated after hitting it in practice
Milestone 1 originally pinned Prisma 7.10.0 (reasoning: the `latest` npm tag was an 8.0
release candidate, so 7.10.0 was the actual stable line). In practice, Prisma 7.0 turned out
to be a much more disruptive release than a normal minor-version bump: it made a new,
Rust-free client generator (`prisma-client`) the default, deprecated the `prisma-client-js`
generator this project uses, removed `datasource { url = env(...) }` support from
`schema.prisma` in favor of a new `prisma.config.ts` file, and now requires an explicit driver
adapter (e.g. `@prisma/adapter-pg`) to be passed to the `PrismaClient` constructor rather than
supporting `new PrismaClient()` directly. Running `prisma migrate dev` against the original
schema fails immediately with `P1012: The datasource property 'url' is no longer supported`.

Multiple open issues in Prisma's own GitHub repo (e.g. #28573, #28622, #28670) show developers
hitting the same wall and downgrading to Prisma 6.15/6.19 to get a normal classic-client setup
working again. Given that, and this project's principle of preferring stable, low-churn
versions, both `prisma` and `@prisma/client` are pinned to **6.19.3** — the last stable 6.x
release — instead of adopting Prisma 7's new adapter-based architecture. This required zero
changes to `schema.prisma` or any application code: the `datasource { url = env(...) }` block
and plain `new PrismaClient()` singleton this project already uses are exactly what Prisma 6.x
expects. Worth revisiting once Prisma 7/8's adapter-based model settles and has clearer
migration docs for classic (non-Accelerate) Postgres setups.

## Seed data is reference data only — no fabricated prices
`prisma/seed.ts` inserts real Indian APMC market names and real vegetable commodity names, so
the frontend has something real to populate selectors with. It intentionally seeds zero
`PriceObservation` rows: per the project's core data-integrity principle, price data must come
from the actual data.gov.in ingestion pipeline (Milestone 2), never be invented for convenience.

---

# Milestone 2 — Real Market Price Data Pipeline

## Ingestion lives in TypeScript inside `apps/api`, not Python
The original architecture plan called for ingestion in Python (`ml/ingestion/`). Milestone 2
implements it in TypeScript instead, inside `apps/api/src/ingestion/`, reusing the existing
Prisma client, zod, and env-validation patterns rather than standing up a second runtime. This
milestone's fetch/validate/normalize/store pipeline needs no numerical/statistical libraries
(no pandas, no sklearn) - it's a straightforward ETL job, and the actual justification for
Python (pandas for feature engineering, scikit-learn/XGBoost for forecasting) doesn't arrive
until Milestone 5. Python will still be introduced then, for the ML-specific work. Worth
confirming this reads as the right call before Milestone 5 starts the Python side.

## `variety` and `grade` added to the schema, and folded into the uniqueness key
The real data.gov.in resource returns `variety` and `grade` alongside price, and - confirmed
against the resource's own field metadata and multiple independent integrations against the
same resource ID - the same market+commodity+date can legitimately carry several distinct
variety-specific price rows (e.g. "Onion / Nasik" vs "Onion / Pune variety" on the same market,
same day). The Milestone 1 unique key `(marketId, commodityId, date)` would have silently
overwritten one variety's price with another's on every re-run. `variety` (default `""`, not
nullable, so the Postgres unique constraint actually functions) is now part of the key:
`(marketId, commodityId, date, variety)`. `grade` is stored but not part of the key.

## `price` = `modal_price`; `min`/`max` stored alongside for context
The source gives three prices (min/max/modal) and no single "the price" field. `modal_price`
(the most commonly transacted price) is the standard headline figure used across Agmarknet-based
tooling, so it's what this project treats as the canonical `price` - the field any future
forecasting/charting code reads by default. `minPrice`/`maxPrice` are stored too, for context.

## A price of exactly 0 is treated as "not reported", not a real price
This dataset uses `0` as its sentinel for a missing price on a given field - a well-documented
quirk, not an assumption invented here. A record whose `modal_price` is 0 (or missing) is
rejected outright, since it carries no usable price signal; a real ₹0 vegetable price would be
implausible on its face anyway.

## No `unit` field in the source - "per quintal" is an explicit, documented assumption
This resource does not publish a unit. Every third-party integration against it, and Agmarknet's
own site, treats prices as Rupees per quintal (100kg) - the standard mandi convention - and that
is assumed here for every commodity this pipeline creates. Flagged explicitly per this
milestone's own instruction to surface non-obvious field mappings rather than assume silently.

## Markets and commodities are discovered and upserted during ingestion, not only pre-seeded
Rather than only accepting the 6 markets/6 commodities Milestone 1 seeded for UI development,
ingestion upserts whatever real markets/commodities the API actually returns, normalizing names
as it goes. This is what makes the pipeline work for real, country-wide data rather than a fixed
demo set. Known limitation: Milestone 1's seed data may not normalize to exactly the same
name/state/district as the live API returns for the same physical market (e.g. district naming
differences), which can produce a near-duplicate `Market` row rather than reusing the seeded
one. A proper alias/reconciliation table is future work, not built in this milestone.

## Ingestion writes are `upsert`s keyed on the full natural key - idempotent by construction
Re-running `npm run ingest` is safe because every write is an `upsert` against
`(marketId, commodityId, date, variety)`. This satisfies "safe to run multiple times" at the
database level, independent of the in-memory duplicate counter kept purely for run-summary
visibility.

## Known limitation: market-name normalization doesn't handle parenthetical abbreviations
The title-case normalizer preserves short all-caps *tokens* (e.g. "APMC") but a name like
"Pune (F&V)" normalizes to "Pune (f&v)", since "(F&V)" isn't a bare all-caps token. Cosmetic,
not a correctness issue, but a real gap in the current heuristic worth knowing about.

---

# Milestone 2 addendum — CSV import fallback

data.gov.in's API was unreachable across several consecutive days during development (502,
500, 503, and 504 responses in turn, plus login/portal failures), so a second ingestion path
was added: `npm run ingest:csv -- <file>`, importing a locally downloaded CSV instead of
calling the live API.

## Same pipeline, same database, different source - not a parallel system
The CSV path reuses `validate.ts`, `normalize.ts`, and the reference-data resolver unchanged.
The only new code is (1) a CSV column-header mapper (`csvSchema.ts`) that translates whichever
real file format the user obtained into the exact raw-record shape `validate.ts` already
expects, and (2) `csvImport.ts`/`cliCsv.ts`, which mirror `ingestRun.ts`/`cli.ts`'s structure
line for line. The upsert itself was factored out into `storeObservation.ts` so both paths
call the identical write path - a CSV-imported row and a later API-fetched row for the same
market+commodity+date+variety simply update the same database row, with no special-casing.
`RawIngestionLog.source` is set to `MANUAL` for CSV-sourced runs, so the data honestly records
where it came from.

## Two real, differently-shaped column formats had to be supported, not assumed
Confirmed against Agmarknet's own published CSV format and multiple third-party mirrors:
- A data.gov.in-style export uses the same snake_case field names as the live API.
- Agmarknet's own official export uses `'State Name'`, `'District Name'`, `'Market Name'`,
  `'Variety'`, `'Group'`, `'Min/Max/Modal Price (Rs./Quintal)'`, `'Reported Date'` - and
  several real historical mirrors of this format have **no Commodity column at all** (some
  are published one file per crop). `--commodity` lets the caller supply it once per file
  rather than the importer guessing.
- Agmarknet's own format also has no literal "Grade" column - `csvSchema.ts` maps its
  `'Group'` column to this project's `grade` field as the closest available substitute, but
  `Group` is actually a commodity-classification field, not a freshness grade. The importer
  prints an explicit note whenever this substitution happens, so it's never a silent
  assumption.
- Agmarknet's `Reported Date` column uses `"D Mon YYYY"` (e.g. `"15 Sep 2026"`), a third date
  format alongside the API's `DD/MM/YYYY` - `normalize.ts`'s date parser now handles both.

## Column detection is alias-based and case/whitespace-insensitive, not positional
`csvSchema.ts` normalizes every header (lowercase, strip spaces/underscores/parens) and
matches against a known alias list per canonical field, rather than assuming column order or
exact casing - this is what lets the same importer accept both known formats (and reasonably
similar variants, e.g. a cleaned Kaggle re-export) without a format flag from the user.

---

# Milestones 3-6 — Analytics, ML, AI explanations, full dashboard

Implemented in one pass per explicit instruction. Key decisions:

## Three missing unique constraints fixed before writing any ML job
`ForecastResult`, `AnomalyFlag`, and `SpikeRiskScore` had no unique constraint in the Milestone 1
schema - re-running a batch job would have silently accumulated duplicate rows forever, the
same class of bug Milestone 2 fixed for `PriceObservation`. Fixed first: `AnomalyFlag` is now
unique on `(marketId, commodityId, date, method)`, `ForecastResult` on `(marketId, commodityId,
forecastDate, horizonDays, modelVersion)`, `SpikeRiskScore` on `(marketId, commodityId,
asOfDate, horizonDays, modelVersion)`. Every Python write is an upsert against these keys.

## New `ModelRun` table - the smallest addition that gives eval metrics a home
Nothing in the Milestone 1 schema had anywhere to put MAE/RMSE, train/test sizes, or an honest
"skipped - insufficient data" outcome. Rather than bolt these onto `ForecastResult` (redundant
per-row copies of the same per-run numbers) or force them into `RawIngestionLog` (which is
specifically about data ingestion, a different concern), one small generic table was added:
`jobType` + optional `marketId`/`commodityId` + `status` + `metrics` (JSON) + `notes`.

## ML lives in `ml/` as Python batch scripts, matching the original architecture
Unlike Milestone 2's ingestion (which stayed in TypeScript since it needed no numerical
libraries), forecasting and anomaly detection genuinely use pandas/numpy/scikit-learn, so this
is where Python was always meant to enter the project. Jobs read real price history from
Postgres, compute, and write results back - the Express API never computes a prediction itself,
only ever reads what `ml/run_all.py` already wrote. Run manually for now (`ml/README.md`);
scheduling is future work.

## Forecasting: two honest baselines compared, not one assumed-good model
`forecast.py` evaluates naive persistence against a linear trend model on a genuinely held-out,
time-ordered split (never shuffled), and only persists forward forecasts from whichever
actually won on that pair's data - both scores are recorded either way. A
`MIN_POINTS_FOR_COMPLEX_MODEL` threshold is documented (unused by design) for when a model
like XGBoost would actually be justified by the data volume, rather than reached for by default.

## Spike risk is an explicitly-labeled heuristic, not a trained classifier
There is no labeled historical "this was a real spike" dataset to train a classifier against -
fabricating labels (e.g. "call anything past 2 std devs a spike, then train on that") would
just be training a model to reproduce the anomaly detector's own rule. `spike_risk.py`'s
docstring states this directly: it's a transparent, documented weighted combination of the
anomaly signal, forecast trend, and recent volatility (weights sum to 1.0, each component
independently unit-tested), not a model dressed up as one.

## AI explanation: structured signal in, plain text out, deterministic fallback always available
`explanation.service.ts` assembles one JSON object (current price, baseline, deviation, trend,
anomaly status, forecast, spike risk) and a system prompt that explicitly forbids inventing
causes (weather, policy, festivals, etc.) or any number not present in the input. If
`ANTHROPIC_API_KEY` is unset, `generateText()` returns null immediately (verified: no network
attempt at all, not just a fast failure) and `buildDeterministicExplanation()` produces the same
information as a template sentence instead - the dashboard works identically either way, just
with a different `source` badge ("AI-generated" vs "Deterministic summary").

## Frontend: Dashboard absorbs both "Overview" and "Explorer"
Rather than two separate pages duplicating the same commodity/market selector, the Dashboard is
one page: overview stats at the top, then the full per-pair intelligence view (hero metrics,
chart, forecast evaluation, AI explanation) below, driven by the existing `SelectionContext`.
Forecast view is likewise integrated into the Dashboard's chart + evaluation panel rather than a
separate page, since it's meaningless without a commodity/market already selected.

## Known limitation: responsive design is partial
Content grids reflow at the `md` breakpoint (hero metrics, overview stats), but the sidebar
navigation does not collapse into a mobile drawer - it stays fixed-width always-visible. A full
mobile nav pattern was judged a separate, substantial scope item rather than something to rush
in alongside everything else in this pass; flagged honestly rather than silently left broken or
falsely claimed as complete.

## Known limitation: Markets table caps at 500 rows
With ingestion now able to discover hundreds of real markets, the Markets page caps rendering
at 500 rows with a message, rather than paginating properly - a reasonable interim limit, not a
full pagination implementation.

---

# Post-launch fix — batched CSV writes

The CSV importer originally wrote one row at a time (`await prisma.priceObservation.upsert(...)`
per row) - fine for the 2,733-row file used in initial testing, but a real ~1.1M-row historical
export appeared to hang indefinitely. The actual cause: each row was a separate network
round-trip to Postgres, sequentially awaited - roughly a million round-trips, not a slow parse.

Fixed with `storeObservationsBatch()` in `storeObservation.ts`: observations are still validated
one at a time (cheap, in-memory), but written via a single multi-row `INSERT ... ON CONFLICT`
per batch of 500, cutting the round-trip count by ~500x. Verified with a synthetic 57,600-row
stress test against a stub database with simulated realistic (3ms) round-trip latency: 33,600
real accepted rows written in 1.79s with batching, versus a projected ~100.8s for the old
one-row-at-a-time approach at the same latency - and real Postgres round-trips are often slower
than 3ms in practice, making the actual-world gap larger still. Extrapolated to 1.1M rows: ~1
minute batched versus a projected ~55+ minutes unbatched, which matches the "appears to hang"
symptom exactly.

`storeObservation()` (singular, unbatched) is left in place and still used by the live-API
ingestion path (`ingestRun.ts`), whose volumes are bounded by `INGEST_MAX_RECORDS_PER_COMMODITY`
(default 1500/commodity) - small enough that batching wasn't the blocking issue there. Worth
revisiting if that default is ever raised significantly.

---

# Post-launch fix — batch writes could collide on the same conflict key

The batching fix above introduced a real bug of its own, caught against the actual 1.1M-row
file: a single `INSERT ... ON CONFLICT DO UPDATE` statement cannot update the same row twice,
but the in-memory duplicate check upstream (in `csvImport.ts`) deduplicated on `sourceRecord`,
which includes `grade` - a field that is NOT part of the database's actual uniqueness
constraint (`marketId, commodityId, date, variety`). Two rows differing only in grade passed
the upstream dedup as "different," then collided in the same batch and made Postgres reject the
whole statement (`ON CONFLICT DO UPDATE command cannot affect row a second time`).

Fixed in `storeObservationsBatch()`: deduplication now happens a second time, after market/
commodity resolution, keyed on the exact database conflict target - last-seen observation per
key wins, matching the semantics the original one-row-at-a-time upsert already had. The
function now returns `{ written, collapsedDuplicates }` so the caller's reported "accepted"
count reflects what was actually written, not the pre-dedup count.

Verified against the exact failure mode: a stub database that simulates Postgres's real
same-batch-conflict rejection, tested first with a 3-row minimal reproduction (2 colliding on
grade, 1 distinct), then at scale with a 38,400-row synthetic file where half the rows are
deliberate grade-only collisions throughout - correctly collapsed to 19,200 distinct rows,
zero crashes, completed in under a second against the stub.
