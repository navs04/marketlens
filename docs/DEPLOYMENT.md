# Deploying MarketLens

**Shape:** Neon (Postgres) + Render (API) + Render static site (web). One Git repo, one `render.yaml`.

| Piece | Free-tier behaviour (checked Oct 2026; confirm on the pricing pages) |
|---|---|
| Render web service | Sleeps after 15 min idle; first request after that takes up to ~1 min. 750 free instance-hours/month (one always-on service uses ~744). |
| Neon Postgres | 0.5 GB storage, 100 compute-hours/month, compute suspends after 5 min idle. Paid plan is usage-based (~$0.35/GB-month storage at the time of writing). |
| Render Postgres | Free instances **expire after 30 days**. Don't use it for this. |

## 0. Before anything
- The repo must be on GitHub (hosts deploy from Git), **including** `apps/api/prisma/migrations/`.
- Apply this release (it adds `render.yaml`, a DB-free `/api/v1/health/live`, an LLM daily cap, and frontend cold-start retries).

## 1. Check your data fits (the decision that matters)
Run against your local database:
```sql
SELECT pg_size_pretty(pg_database_size(current_database())) AS database;
SELECT relname, pg_size_pretty(pg_total_relation_size(oid)) AS total
FROM pg_class WHERE relname IN ('PriceObservation','AnomalyFlag','ForecastResult','SpikeRiskScore','Market','Commodity')
ORDER BY pg_total_relation_size(oid) DESC;
```
- **Under ~400 MB:** Neon free works.
- **Over 500 MB:** it will not fit free. Options: (a) pay Neon's usage-based plan (a ~1 GB database costs a few dollars/month), or (b) deploy a subset: restrict to the commodities you want to show, then `VACUUM FULL`. `PriceObservation.sourceRecord` is a long traceability string per row; clearing it (`UPDATE "PriceObservation" SET "sourceRecord" = NULL; VACUUM FULL "PriceObservation";`) is the cheapest single reduction, at the cost of row-level traceability in the deployed copy.

## 2. Create the database (Neon)
1. New project, region **Singapore (aws-ap-southeast-1)** to sit next to Render's Singapore region.
2. Copy the **direct (non-pooled)** connection string. Make sure it ends with `?sslmode=require&connect_timeout=15` (the timeout matters: a suspended Neon database needs a moment to wake).

## 3. Put your data in it (from your machine)
**Option A, recommended: copy your local database (includes ML results).**
```bash
pg_dump --no-owner --no-acl -Fc "$LOCAL_DATABASE_URL" -f marketlens.dump
pg_restore --no-owner --no-acl --clean --if-exists -d "$NEON_DATABASE_URL" marketlens.dump
```
**Option B: rebuild it.** `DATABASE_URL="$NEON_DATABASE_URL" npm run prisma:deploy`, then `npm run ingest:csv ...`. Then run the ML pipeline: `cd ml && DATABASE_URL="$NEON_DATABASE_URL" python run_all.py` (works, but is slow over the internet because it makes many small queries; prefer running ML locally and using Option A).

## 4. Deploy (Render)
1. Render dashboard → **New → Blueprint** → pick the repo. It reads `render.yaml` and creates two services.
2. When prompted, set:
   - `DATABASE_URL` = the Neon string
   - `CORS_ORIGIN` = the web service URL, e.g. `https://marketlens-web.onrender.com` (no trailing slash)
   - `VITE_API_BASE_URL` = the API URL **plus `/api`**, e.g. `https://marketlens-api.onrender.com/api`
   - `ANTHROPIC_API_KEY` = optional; leave blank for deterministic explanations
3. The real URLs are only known after creation. If Render added a suffix to a name, correct `CORS_ORIGIN` and `VITE_API_BASE_URL`, then redeploy. **`VITE_API_BASE_URL` is baked in at build time, so changing it needs a web redeploy.**

## 5. Verify
```bash
curl https://<api>.onrender.com/api/v1/health/live      # process is up (first call may take ~1 min)
curl https://<api>.onrender.com/api/v1/health           # also checks the database
curl https://<api>.onrender.com/api/v1/overview         # real counts
```
Then open the web URL. On a cold start the top bar says "Waking the server, up to a minute" and pages load once it is up.

## 6. Optional: keep the API awake
A free uptime pinger hitting `/api/v1/health/live` every ~10 minutes avoids the sleep. **Ping `/live`, never `/health`**: `/health` queries the database and would keep Neon's compute awake 24/7, using up its monthly free compute in about two weeks.

## Safety notes
- `ANTHROPIC_API_KEY` lives only in Render's environment. Set a **spend limit** in the Anthropic console too; `LLM_DAILY_CALL_LIMIT` (default 200/day, resets on restart) is a backstop, not billing.
- The API is public and has no authentication or rate limiting. That is fine for a read-only portfolio app; add `express-rate-limit` before exposing anything that writes.

## Troubleshooting
| Symptom | Cause |
|---|---|
| Browser console: CORS error | `CORS_ORIGIN` doesn't exactly match the web URL (scheme, host, no trailing slash). |
| Site loads but every call fails / hits the wrong host | `VITE_API_BASE_URL` missing, or missing the `/api` suffix; redeploy the web service after fixing. |
| First visit shows "Waking the server" for a while | Normal on the free API after 15 min idle. |
| `Can't reach database server` in API logs | Neon compute was suspended; make sure `connect_timeout=15` is in `DATABASE_URL`. |
| API build fails on `prisma` / `tsc` not found | Build command must keep `--include=dev` (already in `render.yaml`). |
