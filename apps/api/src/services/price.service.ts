import { prisma } from "../lib/prisma.js";
import { Prisma } from "@prisma/client";

export interface PriceQuery {
  marketId?: string;
  commodityId?: string;
  state?: string;
  district?: string;
  from?: Date;
  to?: Date;
  limit: number;
}

const observationSelect = {
  date: true,
  price: true,
  minPrice: true,
  maxPrice: true,
  modalPrice: true,
  variety: true,
  grade: true,
} satisfies Prisma.PriceObservationSelect;

export const priceService = {
  async list({ marketId, commodityId, state, district, from, to, limit }: PriceQuery) {
    return prisma.priceObservation.findMany({
      where: {
        ...(marketId ? { marketId } : {}),
        ...(commodityId ? { commodityId } : {}),
        ...(state || district
          ? {
              market: {
                ...(state ? { state } : {}),
                ...(district ? { district } : {}),
              },
            }
          : {}),
        date: {
          ...(from ? { gte: from } : {}),
          ...(to ? { lte: to } : {}),
        },
      },
      orderBy: { date: "asc" },
      take: limit,
      select: {
        ...observationSelect,
        market: { select: { id: true, name: true, state: true } },
        commodity: { select: { id: true, name: true, unit: true } },
      },
    });
  },

  async latest({ marketId, commodityId }: { marketId: string; commodityId: string }) {
    return prisma.priceObservation.findFirst({
      where: { marketId, commodityId },
      orderBy: { date: "desc" },
      select: observationSelect,
    });
  },

  /**
   * Current price + a historical baseline computed from the same
   * PriceObservation rows the pipeline actually stored - no separate
   * "average" table, this is computed on read. `windowDays` controls how
   * far back the baseline looks; `dataPointsInWindow` is returned so the
   * caller can be honest about how much history actually backed the
   * number (e.g. "based on 6 days" rather than implying a full 30-day
   * average when only a week of data exists).
   */
  async summary({ marketId, commodityId, windowDays = 30 }: { marketId: string; commodityId: string; windowDays?: number }) {
    const latest = await prisma.priceObservation.findFirst({
      where: { marketId, commodityId },
      orderBy: { date: "desc" },
      select: observationSelect,
    });

    if (!latest) return null;

    const windowStart = new Date(latest.date);
    windowStart.setUTCDate(windowStart.getUTCDate() - windowDays);

    const windowObservations = await prisma.priceObservation.findMany({
      where: {
        marketId,
        commodityId,
        date: { gte: windowStart, lte: latest.date },
      },
      orderBy: { date: "asc" },
      select: { date: true, price: true },
    });

    const prices = windowObservations.map((o) => o.price);
    const baselineAverage = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const deviationPct = ((latest.price - baselineAverage) / baselineAverage) * 100;

    // Recent trend: sign of the slope of a simple linear fit over the
    // window (day index vs price), not just "current vs first" - less
    // sensitive to a single noisy endpoint.
    let trend: "up" | "down" | "flat" = "flat";
    if (windowObservations.length >= 3) {
      const n = windowObservations.length;
      const xs = windowObservations.map((_, i) => i);
      const ys = windowObservations.map((o) => o.price);
      const xMean = xs.reduce((a, b) => a + b, 0) / n;
      const yMean = ys.reduce((a, b) => a + b, 0) / n;
      const numerator = xs.reduce((sum, x, i) => sum + (x - xMean) * (ys[i]! - yMean), 0);
      const denominator = xs.reduce((sum, x) => sum + (x - xMean) ** 2, 0);
      const slope = denominator === 0 ? 0 : numerator / denominator;
      // Slope in ₹/day; treat as flat if the total drift over the window
      // is under 1% of the baseline, to avoid over-calling noise a trend.
      const totalDrift = slope * n;
      if (Math.abs(totalDrift) > baselineAverage * 0.01) {
        trend = slope > 0 ? "up" : "down";
      }
    }

    return {
      currentPrice: latest.price,
      currentDate: latest.date,
      baselineAverage: Math.round(baselineAverage * 100) / 100,
      minPrice,
      maxPrice,
      deviationPct: Math.round(deviationPct * 100) / 100,
      trend,
      windowDays,
      dataPointsInWindow: windowObservations.length,
    };
  },

  /**
   * Latest price for a commodity across multiple markets - for the market
   * comparison view. A single DISTINCT ON query rather than one lookup
   * per candidate market, since the candidate set can be large (all
   * markets in a state, or unrestricted). Markets with no data for this
   * commodity are simply absent from the result, never padded.
   */
  async compareMarkets({
    commodityId,
    marketIds,
    state,
    limit,
  }: {
    commodityId: string;
    marketIds?: string[];
    state?: string;
    limit: number;
  }): Promise<Array<{ market: { id: string; name: string; state: string }; price: number; date: Date }>> {
    const marketFilter = marketIds
      ? Prisma.sql`AND m."id" IN (${Prisma.join(marketIds)})`
      : state
        ? Prisma.sql`AND m."state" = ${state}`
        : Prisma.empty;

    const rows = await prisma.$queryRaw<
      Array<{ marketId: string; marketName: string; marketState: string; price: number; date: Date }>
    >(Prisma.sql`
      SELECT DISTINCT ON (po."marketId")
        po."marketId" AS "marketId",
        m."name" AS "marketName",
        m."state" AS "marketState",
        po."price" AS "price",
        po."date" AS "date"
      FROM "PriceObservation" po
      JOIN "Market" m ON m."id" = po."marketId"
      WHERE po."commodityId" = ${commodityId}
      ${marketFilter}
      ORDER BY po."marketId", po."date" DESC
    `);

    return rows
      .map((r) => ({
        market: { id: r.marketId, name: r.marketName, state: r.marketState },
        price: r.price,
        date: r.date,
      }))
      .sort((a, b) => b.price - a.price)
      .slice(0, limit);
  },
};
