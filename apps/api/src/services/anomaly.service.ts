import { prisma } from "../lib/prisma.js";

export const anomalyService = {
  async list({
    marketId,
    commodityId,
    from,
    to,
    limit,
  }: {
    marketId: string;
    commodityId: string;
    from?: Date;
    to?: Date;
    limit: number;
  }) {
    return prisma.anomalyFlag.findMany({
      where: {
        marketId,
        commodityId,
        date: {
          ...(from ? { gte: from } : {}),
          ...(to ? { lte: to } : {}),
        },
      },
      orderBy: { date: "asc" },
      take: limit,
    });
  },

  /**
   * Recent anomalies across every market/commodity - the "Price
   * Intelligence" browsing feed. Only rows where isAnomaly=true; the
   * detector also writes non-anomalous rows (every day gets scored, not
   * just flagged ones) so this feed isn't drowned in "normal" entries.
   */
  async feed({ limit }: { limit: number }) {
    return prisma.anomalyFlag.findMany({
      where: { isAnomaly: true },
      orderBy: { date: "desc" },
      take: limit,
      include: {
        market: { select: { id: true, name: true, state: true } },
        commodity: { select: { id: true, name: true, unit: true } },
      },
    });
  },

  async count({ onlyAnomalies = false }: { onlyAnomalies?: boolean } = {}) {
    return prisma.anomalyFlag.count({ where: onlyAnomalies ? { isAnomaly: true } : {} });
  },
};
