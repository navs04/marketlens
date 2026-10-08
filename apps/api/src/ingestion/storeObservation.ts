import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import type { NormalizedObservation } from "./validate.js";
import { createReferenceDataResolver } from "./referenceData.js";

/**
 * Resolves the market/commodity and upserts the price observation, keyed
 * on the full natural key (marketId, commodityId, date, variety) - this is
 * what makes both ingestion paths idempotent, safe to re-run, and mutually
 * compatible (a CSV-imported row and a later API-fetched row for the same
 * market+commodity+date+variety simply update the same record).
 */
export async function storeObservation(
  prisma: PrismaClient,
  resolver: ReturnType<typeof createReferenceDataResolver>,
  observation: NormalizedObservation,
): Promise<void> {
  const marketId = await resolver.resolveMarketId({
    name: observation.market,
    state: observation.state,
    district: observation.district,
  });
  const commodityId = await resolver.resolveCommodityId(observation.commodity);

  await prisma.priceObservation.upsert({
    where: {
      marketId_commodityId_date_variety: {
        marketId,
        commodityId,
        date: observation.date,
        variety: observation.variety,
      },
    },
    update: {
      price: observation.modalPrice!,
      minPrice: observation.minPrice,
      maxPrice: observation.maxPrice,
      modalPrice: observation.modalPrice,
      grade: observation.grade,
      sourceRecord: observation.sourceRecord,
    },
    create: {
      marketId,
      commodityId,
      date: observation.date,
      variety: observation.variety,
      price: observation.modalPrice!,
      minPrice: observation.minPrice,
      maxPrice: observation.maxPrice,
      modalPrice: observation.modalPrice,
      grade: observation.grade,
      sourceRecord: observation.sourceRecord,
    },
  });
}

const BATCH_SIZE = 500;

/**
 * Batched equivalent of storeObservation - resolves every distinct
 * market/commodity once each (the resolver's in-memory cache makes
 * repeats free), then writes observations in chunks of BATCH_SIZE via a
 * single multi-row `INSERT ... ON CONFLICT` statement per chunk, instead
 * of one round-trip per row. For a file with hundreds of thousands of
 * rows this is the difference between a few minutes and several hours -
 * one Prisma Client `.upsert()` call per row is a separate network
 * round-trip to Postgres every time, which doesn't scale past a few
 * thousand rows.
 *
 * Prisma's `@default(cuid())` is applied client-side by Prisma Client,
 * not as a Postgres column default - bypassing the client via raw SQL
 * means an id must be supplied explicitly. `randomUUID()` is used rather
 * than pulling in a cuid-compatible library just for this: Prisma doesn't
 * validate id format at the database level, so any unique string works.
 */
export async function storeObservationsBatch(
  prisma: PrismaClient,
  resolver: ReturnType<typeof createReferenceDataResolver>,
  observations: NormalizedObservation[],
  onProgress?: (written: number, total: number) => void,
): Promise<{ written: number; collapsedDuplicates: number }> {
  // Resolve every distinct market/commodity first so the batches below
  // only ever do INSERT work, never interleaved lookup round-trips.
  //
  // Deduplicated here on the database's ACTUAL conflict key
  // (marketId, commodityId, date, variety) - NOT on the broader
  // sourceRecord natural key the caller may already have deduped on
  // upstream, which also includes grade. Two rows that differ only in
  // grade share the same database row (grade isn't part of the unique
  // constraint, by design - see schema.prisma), so if both landed in the
  // same batch, Postgres rejects the whole statement: a single
  // `INSERT ... ON CONFLICT DO UPDATE` cannot update the same row twice.
  // Keeping the last-seen observation per key matches the semantics the
  // unbatched single-row upsert already had (each call just updates the
  // same row again), just applied before batching instead of per-call.
  const byKey = new Map<string, { marketId: string; commodityId: string; observation: NormalizedObservation }>();

  for (const observation of observations) {
    const marketId = await resolver.resolveMarketId({
      name: observation.market,
      state: observation.state,
      district: observation.district,
    });
    const commodityId = await resolver.resolveCommodityId(observation.commodity);

    const key = `${marketId}|${commodityId}|${observation.date.toISOString()}|${observation.variety}`;
    byKey.set(key, { marketId, commodityId, observation }); // last one wins, overwriting any earlier entry for this key
  }

  const resolved = [...byKey.values()];

  for (let i = 0; i < resolved.length; i += BATCH_SIZE) {
    const batch = resolved.slice(i, i + BATCH_SIZE);

    const rows = batch.map(
      ({ marketId, commodityId, observation }) => Prisma.sql`(
        ${randomUUID()}, ${marketId}, ${commodityId}, ${observation.date}, ${observation.variety},
        ${observation.modalPrice}, ${observation.minPrice}, ${observation.maxPrice}, ${observation.modalPrice},
        ${observation.grade}, ${observation.sourceRecord}
      )`,
    );

    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO "PriceObservation"
        ("id", "marketId", "commodityId", "date", "variety", "price", "minPrice", "maxPrice", "modalPrice", "grade", "sourceRecord")
      VALUES ${Prisma.join(rows)}
      ON CONFLICT ("marketId", "commodityId", "date", "variety")
      DO UPDATE SET
        "price" = EXCLUDED."price",
        "minPrice" = EXCLUDED."minPrice",
        "maxPrice" = EXCLUDED."maxPrice",
        "modalPrice" = EXCLUDED."modalPrice",
        "grade" = EXCLUDED."grade",
        "sourceRecord" = EXCLUDED."sourceRecord"
    `);

    onProgress?.(Math.min(i + BATCH_SIZE, resolved.length), resolved.length);
  }

  return { written: resolved.length, collapsedDuplicates: observations.length - resolved.length };
}
