import { prisma } from "../lib/prisma.js";

export const overviewService = {
  async get() {
    const [commodityCount, marketCount, observationCount, anomalyCount, latestObservation, latestIngestion] =
      await Promise.all([
        prisma.commodity.count(),
        prisma.market.count(),
        prisma.priceObservation.count(),
        prisma.anomalyFlag.count({ where: { isAnomaly: true } }),
        prisma.priceObservation.findFirst({ orderBy: { date: "desc" }, select: { date: true } }),
        prisma.rawIngestionLog.findFirst({ orderBy: { fetchedAt: "desc" }, select: { fetchedAt: true, source: true, status: true } }),
      ]);

    return {
      commoditiesTracked: commodityCount,
      marketsTracked: marketCount,
      priceObservations: observationCount,
      anomaliesDetected: anomalyCount,
      latestDataDate: latestObservation?.date ?? null,
      lastIngestion: latestIngestion,
    };
  },
};
