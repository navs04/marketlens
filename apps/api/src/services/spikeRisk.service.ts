import { prisma } from "../lib/prisma.js";

export const spikeRiskService = {
  async latest({ marketId, commodityId }: { marketId: string; commodityId: string }) {
    return prisma.spikeRiskScore.findFirst({
      where: { marketId, commodityId },
      orderBy: { asOfDate: "desc" },
    });
  },

  /**
   * Highest current risk scores across every market/commodity, most
   * recent scoring date only - the "Price Intelligence" feed's risk view.
   */
  async feed({ limit, minProbability }: { limit: number; minProbability: number }) {
    const latestDate = await prisma.spikeRiskScore.findFirst({
      orderBy: { asOfDate: "desc" },
      select: { asOfDate: true },
    });
    if (!latestDate) return [];

    return prisma.spikeRiskScore.findMany({
      where: { asOfDate: latestDate.asOfDate, riskProbability: { gte: minProbability } },
      orderBy: { riskProbability: "desc" },
      take: limit,
      include: {
        market: { select: { id: true, name: true, state: true } },
        commodity: { select: { id: true, name: true, unit: true } },
      },
    });
  },
};
