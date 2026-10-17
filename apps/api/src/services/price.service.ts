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
   * Current price + a historical baseline, computed from the SAME daily
   * series the chart plots (one averaged price per day), so the number on
   * the hero card always matches the last point on the chart.
   *
   * The baseline is the mean of the days BEFORE the latest one - a
   * baseline that includes the day being judged is pulled toward it, and
   * it matches how the anomaly detector forms its expectation (prior days
   * only). `dataPointsInWindow` is the number of distinct days behind the
   * baseline, so "based on N days" is literally true.
   */
  async summary({ marketId, commodityId, windowDays = 30 }: { marketId: string; commodityId: string; windowDays?: number }) {
    const points = await priceService.series({ marketId, commodityId, days: windowDays });
    if (points.length === 0) return null;

    const latest = points[points.length - 1]!;
    const baselinePoints = points.length > 1 ? points.slice(0, -1) : points;
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

    const baselineAverage = mean(baselinePoints.map((p) => p.price));
    const allPrices = points.map((p) => p.price);
    const deviationPct = ((latest.price - baselineAverage) / baselineAverage) * 100;

    // Recent trend: sign of the slope of a simple linear fit over the
    // window (day index vs price), not just "current vs first".
    let trend: "up" | "down" | "flat" = "flat";
    if (points.length >= 3) {
      const n = points.length;
      const xs = points.map((_, i) => i);
      const xMean = mean(xs);
      const yMean = mean(allPrices);
      const numerator = xs.reduce((sum, x, i) => sum + (x - xMean) * (allPrices[i]! - yMean), 0);
      const denominator = xs.reduce((sum, x) => sum + (x - xMean) ** 2, 0);
      const slope = denominator === 0 ? 0 : numerator / denominator;
      // Flat if total drift across the window is under 1% of the baseline.
      if (Math.abs(slope * n) > baselineAverage * 0.01) trend = slope > 0 ? "up" : "down";
    }

    return {
      currentPrice: latest.price,
      currentDate: latest.date,
      baselineAverage: Math.round(baselineAverage * 100) / 100,
      minPrice: Math.min(...allPrices),
      maxPrice: Math.max(...allPrices),
      deviationPct: Math.round(deviationPct * 100) / 100,
      trend,
      windowDays,
      dataPointsInWindow: baselinePoints.length,
    };
  },

  /**
   * Daily series for one market+commodity, anchored to that pair's own
   * latest observation (not today's date - the data may end long before
   * "now") and aggregated to ONE row per day. The raw table holds one row
   * per variety per day, so charting it directly draws several points on
   * the same date. Price is the mean across varieties - the same daily
   * aggregation the ML jobs use (ml/common.py), so anomaly dates and
   * forecasts line up with what's plotted. minPrice/maxPrice are the
   * lowest min and highest max reported across varieties that day.
   */
  async series({ marketId, commodityId, days }: { marketId: string; commodityId: string; days: number }) {
    const rows = await prisma.$queryRaw<
      Array<{ date: Date; price: number; minPrice: number | null; maxPrice: number | null }>
    >(Prisma.sql`
      WITH anchor AS (
        SELECT MAX("date") AS d FROM "PriceObservation"
        WHERE "marketId" = ${marketId} AND "commodityId" = ${commodityId}
      )
      SELECT po."date" AS "date",
             AVG(po."price") AS "price",
             MIN(po."minPrice") AS "minPrice",
             MAX(po."maxPrice") AS "maxPrice"
      FROM "PriceObservation" po, anchor
      WHERE po."marketId" = ${marketId}
        AND po."commodityId" = ${commodityId}
        AND po."date" > anchor.d - ${days}::int
      GROUP BY po."date"
      ORDER BY po."date" ASC
    `);

    return rows.map((r) => ({
      date: r.date,
      price: Math.round(r.price * 100) / 100,
      minPrice: r.minPrice,
      maxPrice: r.maxPrice,
    }));
  },

  /**
   * Compact recent daily series for many market+commodity pairs in ONE
   * query, for table sparklines. All pairs share one window, ending at the
   * latest date among the requested pairs, so rows are comparable. A pair
   * with no data in the window simply has an empty series.
   */
  async sparklines({ pairs, days }: { pairs: Array<{ marketId: string; commodityId: string }>; days: number }) {
    if (pairs.length === 0) return {} as Record<string, Array<{ date: Date; price: number }>>;

    const pairTuples = pairs.map((p) => Prisma.sql`(${p.marketId}, ${p.commodityId})`);

    const rows = await prisma.$queryRaw<
      Array<{ marketId: string; commodityId: string; date: Date; price: number }>
    >(Prisma.sql`
      WITH scoped AS (
        SELECT "marketId", "commodityId", "date", "price"
        FROM "PriceObservation"
        WHERE ("marketId", "commodityId") IN (${Prisma.join(pairTuples)})
      ),
      anchor AS (SELECT MAX("date") AS d FROM scoped)
      SELECT s."marketId", s."commodityId", s."date", AVG(s."price") AS "price"
      FROM scoped s, anchor
      WHERE s."date" > anchor.d - ${days}::int
      GROUP BY s."marketId", s."commodityId", s."date"
      ORDER BY s."marketId", s."commodityId", s."date" ASC
    `);

    const result: Record<string, Array<{ date: Date; price: number }>> = {};
    for (const p of pairs) result[`${p.marketId}:${p.commodityId}`] = [];
    for (const r of rows) {
      result[`${r.marketId}:${r.commodityId}`]?.push({ date: r.date, price: Math.round(r.price * 100) / 100 });
    }
    return result;
  },

  /**
   * Biggest commodity-level price movers: for each commodity, the MEDIAN
   * percentage change between two consecutive windows of `windowDays`
   * (most recent window vs. the one before it), taken only across markets
   * that reported in BOTH windows. Matching markets this way means a
   * commodity can't appear to move just because a different set of
   * markets happened to report. Median (not mean) so one wild market
   * can't dominate. Commodities backed by fewer than MIN_MARKETS matched
   * markets are excluded rather than reported on thin evidence. Windows
   * are anchored to the latest date in the data, not today.
   */
  async movers({ windowDays, limit }: { windowDays: number; limit: number }) {
    const MIN_MARKETS = 5;

    const rows = await prisma.$queryRaw<
      Array<{ commodityId: string; name: string; unit: string; medianPct: number; markets: bigint; anchor: Date }>
    >(Prisma.sql`
      WITH anchor AS (SELECT MAX("date") AS d FROM "PriceObservation"),
      pair_windows AS (
        SELECT po."commodityId", po."marketId",
               AVG(po."price") FILTER (WHERE po."date" > anchor.d - ${windowDays}::int) AS recent,
               AVG(po."price") FILTER (
                 WHERE po."date" <= anchor.d - ${windowDays}::int
                   AND po."date" > anchor.d - (${windowDays}::int * 2)
               ) AS prior
        FROM "PriceObservation" po, anchor
        WHERE po."date" > anchor.d - (${windowDays}::int * 2)
        GROUP BY po."commodityId", po."marketId"
      ),
      changes AS (
        SELECT "commodityId", (recent - prior) / prior * 100 AS pct
        FROM pair_windows
        WHERE recent IS NOT NULL AND prior IS NOT NULL AND prior > 0
      )
      SELECT ch."commodityId" AS "commodityId", c."name" AS "name", c."unit" AS "unit",
             percentile_cont(0.5) WITHIN GROUP (ORDER BY ch.pct) AS "medianPct",
             COUNT(*) AS "markets",
             (SELECT d FROM anchor) AS "anchor"
      FROM changes ch
      JOIN "Commodity" c ON c."id" = ch."commodityId"
      GROUP BY ch."commodityId", c."name", c."unit"
      HAVING COUNT(*) >= ${MIN_MARKETS}
    `);

    const all = rows.map((r) => ({
      commodity: { id: r.commodityId, name: r.name, unit: r.unit },
      changePct: Math.round(r.medianPct * 10) / 10,
      markets: Number(r.markets),
    }));
    const anchor = rows[0]?.anchor ?? null;

    return {
      asOf: anchor,
      windowDays,
      minMarkets: MIN_MARKETS,
      risers: all
        .filter((m) => m.changePct > 0)
        .sort((a, b) => b.changePct - a.changePct)
        .slice(0, limit),
      fallers: all
        .filter((m) => m.changePct < 0)
        .sort((a, b) => a.changePct - b.changePct)
        .slice(0, limit),
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
