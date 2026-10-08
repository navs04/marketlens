import { prisma } from "../lib/prisma.js";
import { Prisma } from "@prisma/client";

export const marketService = {
  async list({ state, district, search }: { state?: string; district?: string; search?: string } = {}) {
    return prisma.market.findMany({
      where: {
        ...(state ? { state } : {}),
        ...(district ? { district } : {}),
        ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
      },
      orderBy: [{ state: "asc" }, { name: "asc" }],
    });
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
