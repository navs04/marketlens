import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { DataSource, type PrismaClient } from "@prisma/client";
import { ingestionEnv } from "./config.js";
import { fetchCommodityRecords, DataGovApiError } from "./dataGovClient.js";
import { validateRecord } from "./validate.js";
import { createReferenceDataResolver } from "./referenceData.js";
import { storeObservation } from "./storeObservation.js";

interface CommodityRunStats {
  commodity: string;
  fetched: number;
  accepted: number;
  rejected: number;
  duplicatesWithinRun: number;
  error?: string;
}

export interface IngestionRunSummary {
  startedAt: Date;
  finishedAt: Date;
  status: "SUCCESS" | "PARTIAL" | "FAILED";
  perCommodity: CommodityRunStats[];
  totalFetched: number;
  totalAccepted: number;
  totalRejected: number;
  totalDuplicatesWithinRun: number;
  distinctMarketsTouched: number;
  distinctCommoditiesTouched: number;
  rejectedLogPath: string | null;
}

const LOG_DIR = path.resolve(import.meta.dirname, "../../logs");

function rejectedLogPathFor(runId: string): string {
  return path.join(LOG_DIR, `ingestion-rejected-${runId}.jsonl`);
}

export async function runIngestion(prisma: PrismaClient): Promise<IngestionRunSummary> {
  const startedAt = new Date();
  const runId = startedAt.toISOString().replace(/[:.]/g, "-");

  mkdirSync(LOG_DIR, { recursive: true });
  const rejectedLogPath = rejectedLogPathFor(runId);
  let rejectedCount = 0;

  const { resolveMarketId, resolveCommodityId } = createReferenceDataResolver(prisma);
  const seenNaturalKeys = new Set<string>();

  const perCommodity: CommodityRunStats[] = [];

  for (const commodity of ingestionEnv.INGEST_COMMODITIES) {
    const stats: CommodityRunStats = {
      commodity,
      fetched: 0,
      accepted: 0,
      rejected: 0,
      duplicatesWithinRun: 0,
    };

    console.log(`\nFetching "${commodity}"...`);

    try {
      for await (const page of fetchCommodityRecords(commodity)) {
        stats.fetched += page.length;

        for (const raw of page) {
          const result = validateRecord(raw);

          if (!result.ok) {
            stats.rejected += 1;
            rejectedCount += 1;
            appendFileSync(
              rejectedLogPath,
              JSON.stringify({ commodity, reason: result.reason, raw: result.raw, timestamp: new Date().toISOString() }) +
                "\n",
              "utf8",
            );
            continue;
          }

          const { observation } = result;

          if (seenNaturalKeys.has(observation.sourceRecord)) {
            stats.duplicatesWithinRun += 1;
            // Not rejected - just not re-processed. The DB upsert below is
            // idempotent regardless, this counter is purely for visibility.
            continue;
          }
          seenNaturalKeys.add(observation.sourceRecord);

          await storeObservation(prisma, { resolveMarketId, resolveCommodityId }, observation);

          stats.accepted += 1;
        }
      }

      console.log(
        `  fetched ${stats.fetched}, accepted ${stats.accepted}, rejected ${stats.rejected}, duplicates ${stats.duplicatesWithinRun}`,
      );
    } catch (err) {
      const message = err instanceof DataGovApiError ? err.message : err instanceof Error ? err.message : String(err);
      stats.error = message;
      console.error(`  FAILED to fetch "${commodity}": ${message}`);
    }

    perCommodity.push(stats);
  }

  const finishedAt = new Date();
  const failedCommodities = perCommodity.filter((c) => c.error);
  const status: IngestionRunSummary["status"] =
    failedCommodities.length === 0
      ? "SUCCESS"
      : failedCommodities.length === perCommodity.length
        ? "FAILED"
        : "PARTIAL";

  const summary: IngestionRunSummary = {
    startedAt,
    finishedAt,
    status,
    perCommodity,
    totalFetched: perCommodity.reduce((sum, c) => sum + c.fetched, 0),
    totalAccepted: perCommodity.reduce((sum, c) => sum + c.accepted, 0),
    totalRejected: perCommodity.reduce((sum, c) => sum + c.rejected, 0),
    totalDuplicatesWithinRun: perCommodity.reduce((sum, c) => sum + c.duplicatesWithinRun, 0),
    distinctMarketsTouched: new Set([...seenNaturalKeys].map((k) => k.split("|").slice(0, 3).join("|"))).size,
    distinctCommoditiesTouched: new Set(perCommodity.map((c) => c.commodity)).size,
    rejectedLogPath: rejectedCount > 0 ? rejectedLogPath : null,
  };

  await prisma.rawIngestionLog.create({
    data: {
      source: DataSource.DATA_GOV_IN,
      fetchedAt: startedAt,
      status: summary.status,
      rawPayloadRef: summary.rejectedLogPath,
      notes: JSON.stringify(
        {
          durationMs: finishedAt.getTime() - startedAt.getTime(),
          totalFetched: summary.totalFetched,
          totalAccepted: summary.totalAccepted,
          totalRejected: summary.totalRejected,
          totalDuplicatesWithinRun: summary.totalDuplicatesWithinRun,
          perCommodity: perCommodity.map((c) => ({
            commodity: c.commodity,
            fetched: c.fetched,
            accepted: c.accepted,
            rejected: c.rejected,
            duplicatesWithinRun: c.duplicatesWithinRun,
            error: c.error ?? null,
          })),
        },
        null,
        2,
      ),
    },
  });

  return summary;
}
