import { prisma } from "../lib/prisma.js";
import { Prisma } from "@prisma/client";

export const marketService = {
  /**
   * Without `page`, returns every matching market (the selectors need the
   * full list). With `page`, returns one page plus the total, so the
   * Markets table never loads thousands of rows into the browser.
   * `search` matches name, state, or district, case-insensitively.
   */
  async list({
    state,
    district,
    search,
    page,
    pageSize = 25,
  }: { state?: string; district?: string; search?: string; page?: number; pageSize?: number } = {}) {
    const where: Prisma.MarketWhereInput = {
      ...(state ? { state } : {}),
      ...(district ? { district } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { state: { contains: search, mode: "insensitive" } },
              { district: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const orderBy: Prisma.MarketOrderByWithRelationInput[] = [{ state: "asc" }, { name: "asc" }];

    if (page === undefined) {
      return { items: await prisma.market.findMany({ where, orderBy }), total: null as number | null };
    }

    const [items, total] = await Promise.all([
      prisma.market.findMany({ where, orderBy, skip: (page - 1) * pageSize, take: pageSize }),
      prisma.market.count({ where }),
    ]);
    return { items, total };
  },

  async getById(id: string) {
    return prisma.market.findUnique({ where: { id } });
  },

  /** Distinct states that actually have at least one market, for filter dropdowns. */
  async listStates(): Promise<string[]> {
    const rows = await prisma.market.findMany({
      distinct: ["state"],
      select: { state: true },
      orderBy: { state: "asc" },
    });
    return rows.map((r) => r.state);
  },

  /**
   * Every commodity this market has price data for, with its latest
   * observation - powers the Market Detail page. A single DISTINCT ON
   * query rather than one lookup per commodity.
   */
  async commoditiesAtMarket(marketId: string) {
    const rows = await prisma.$queryRaw<
      Array<{ commodityId: string; commodityName: string; unit: string; price: number; date: Date }>
    >(Prisma.sql`
      SELECT DISTINCT ON (po."commodityId")
        po."commodityId" AS "commodityId",
        c."name" AS "commodityName",
        c."unit" AS "unit",
        po."price" AS "price",
        po."date" AS "date"
      FROM "PriceObservation" po
      JOIN "Commodity" c ON c."id" = po."commodityId"
      WHERE po."marketId" = ${marketId}
      ORDER BY po."commodityId", po."date" DESC
    `);

    return rows
      .map((r) => ({
        commodity: { id: r.commodityId, name: r.commodityName, unit: r.unit },
        latestPrice: r.price,
        latestDate: r.date,
      }))
      .sort((a, b) => a.commodity.name.localeCompare(b.commodity.name));
  },
};
