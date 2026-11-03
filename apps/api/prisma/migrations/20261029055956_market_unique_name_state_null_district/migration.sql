-- Market(name, state, district) is UNIQUE, but PostgreSQL treats NULLs as distinct
-- from each other in a unique index, so that constraint does not prevent two rows
-- with the same (name, state) when district IS NULL. This partial unique index
-- does, which is what makes ingestion of district-less markets idempotent and
-- safe under overlapping ingestion runs.
--
-- Prisma's schema language cannot express partial indexes, so this lives only in
-- the migration. It is additive: it creates one index and changes no data.
-- It fails only if duplicate (name, state) rows with a NULL district already
-- exist; check first with:
--   SELECT "name", "state", COUNT(*) FROM "Market" WHERE "district" IS NULL
--   GROUP BY "name", "state" HAVING COUNT(*) > 1;
CREATE UNIQUE INDEX "Market_name_state_null_district_key"
  ON "Market" ("name", "state")
  WHERE "district" IS NULL;
