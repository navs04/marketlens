import { CommodityCategory, DataSource, Prisma, type PrismaClient } from "@prisma/client";
import { ASSUMED_UNIT } from "./normalize.js";

/**
 * Finds or creates a market that has NO district (district IS NULL).
 *
 * `Market` is @@unique([name, state, district]), but PostgreSQL treats NULLs
 * as distinct from one another in a unique index, so that constraint cannot
 * stop two rows with the same (name, state) and a NULL district. Prisma's
 * compound-unique `where` input (`name_state_district`) also only accepts a
 * non-null district, so `upsert` cannot express this case at all.
 *
 * Instead: read with a plain filter (`district: null` becomes IS NULL), create
 * if absent, and let the partial unique index "Market_name_state_null_district_key"
 * (see the migration of the same name) arbitrate concurrent writers: the loser's
 * create fails with P2002 and it then reads the winner's row. Without that
 * index this is still correct for a single writer, but two overlapping
 * ingestion runs could each insert the same market.
 */
export async function findOrCreateMarketWithoutDistrict(
  prisma: PrismaClient,
  params: { name: string; state: string },
) {
  const where = { name: params.name, state: params.state, district: null };
  // Oldest first, so the choice is stable even if duplicates already exist.
  const orderBy = { createdAt: "asc" } as const;

  const existing = await prisma.market.findFirst({ where, orderBy });
  if (existing) return existing;

  try {
    return await prisma.market.create({
      data: { ...where, source: DataSource.DATA_GOV_IN },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const winner = await prisma.market.findFirst({ where, orderBy });
      if (winner) return winner;
    }
    throw err;
  }
}

/**
 * Ingestion discovers real markets and commodities as it goes, rather than
 * requiring every market/commodity to be pre-seeded - this is what makes
 * the pipeline work for the whole country, not just the 6 markets Milestone
 * 1 seeded for UI development. Each is upserted by its natural key, with an
 * in-process cache so a run touching thousands of records doesn't issue a
 * duplicate lookup per row for markets/commodities it has already resolved.
 *
 * Known limitation: Milestone 1's seed data may not normalize to exactly
 * the same name/state/district as the real API returns for the same
 * physical market, which can produce a near-duplicate Market row rather
 * than reusing the seeded one. Documented in the Milestone 2 write-up
 * rather than silently reconciled - a proper alias table is future work.
 */
export function createReferenceDataResolver(prisma: PrismaClient) {
  const marketCache = new Map<string, string>(); // `${name}|${state}|${district}` -> id
  const commodityCache = new Map<string, string>(); // name -> id

  async function resolveMarketId(params: {
    name: string;
    state: string;
    district: string | null;
  }): Promise<string> {
    const cacheKey = `${params.name}|${params.state}|${params.district ?? ""}`;
    const cached = marketCache.get(cacheKey);
    if (cached) return cached;

    // With a district, the compound unique key is a valid atomic upsert target.
    // Without one it is not (see findOrCreateMarketWithoutDistrict).
    const market =
      params.district !== null
        ? await prisma.market.upsert({
            where: {
              name_state_district: {
                name: params.name,
                state: params.state,
                district: params.district,
              },
            },
            update: {},
            create: {
              name: params.name,
              state: params.state,
              district: params.district,
              source: DataSource.DATA_GOV_IN,
            },
          })
        : await findOrCreateMarketWithoutDistrict(prisma, { name: params.name, state: params.state });

    marketCache.set(cacheKey, market.id);
    return market.id;
  }

  async function resolveCommodityId(name: string): Promise<string> {
    const cached = commodityCache.get(name);
    if (cached) return cached;

    const commodity = await prisma.commodity.upsert({
      where: {
        name_category: {
          name,
          category: CommodityCategory.VEGETABLE,
        },
      },
      update: {},
      create: {
        name,
        category: CommodityCategory.VEGETABLE,
        unit: ASSUMED_UNIT,
      },
    });

    commodityCache.set(name, commodity.id);
    return commodity.id;
  }

  return { resolveMarketId, resolveCommodityId };
}
