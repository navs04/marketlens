# Architecture Decisions — Milestone 1

## Monorepo via npm workspaces, not a build tool
`apps/api` and `apps/web` are separate npm packages under one root, linked with native npm
workspaces (no Nx/Turborepo). At this scale, an extra build-orchestration tool would be
overhead without payoff — npm workspaces already give shared installs and per-package scripts.

## Prisma pinned to 7.10.0, not `latest`
`npm view prisma dist-tags` shows `latest` currently pointing to `8.0.0-rc.12` — a release
candidate. `@prisma/client`'s `latest` tag is `7.10.0`, and Prisma's own guidance treats 7.x as
the production-recommended line while 8 is still early access. Both packages are pinned to
`7.10.0` explicitly so the CLI and client generation stay in lockstep on a genuinely stable pair.

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

## Seed data is reference data only — no fabricated prices
`prisma/seed.ts` inserts real Indian APMC market names and real vegetable commodity names, so
the frontend has something real to populate selectors with. It intentionally seeds zero
`PriceObservation` rows: per the project's core data-integrity principle, price data must come
from the actual data.gov.in ingestion pipeline (Milestone 2), never be invented for convenience.
