import { CommodityCategory, DataSource, type PrismaClient } from "@prisma/client";
import { ASSUMED_UNIT } from "./normalize.js";

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

    const market = await prisma.market.upsert({
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
    });

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
