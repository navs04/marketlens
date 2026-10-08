import { prisma } from "../lib/prisma.js";

export const forecastService = {
  /**
   * Never returns null/404 for "no forecast yet" - an unforecastable pair
   * (too little history) is a normal, expected state the frontend renders
   * honestly, not an error condition.
   */
  async get({ marketId, commodityId }: { marketId: string; commodityId: string }) {
    const forecasts = await prisma.forecastResult.findMany({
      where: { marketId, commodityId },
      orderBy: { forecastDate: "asc" },
    });

    const latestRun = await prisma.modelRun.findFirst({
      where: { jobType: "FORECAST", marketId, commodityId },
      orderBy: { startedAt: "desc" },
    });

    return {
      forecasts,
      evaluation: latestRun
        ? {
            status: latestRun.status,
            modelVersion: latestRun.modelVersion,
            generatedAt: latestRun.startedAt,
            metrics: latestRun.metrics ? JSON.parse(latestRun.metrics) : null,
            notes: latestRun.notes,
          }
        : null,
    };
  },
};
