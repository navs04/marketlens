import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { DataSource, type PrismaClient } from "@prisma/client";
import { validateRecord, type NormalizedObservation } from "./validate.js";
import { detectColumnMap, mapCsvRow } from "./csvSchema.js";
import { createReferenceDataResolver } from "./referenceData.js";
import { storeObservationsBatch } from "./storeObservation.js";

export interface CsvImportSummary {
  filePath: string;
  startedAt: Date;
  finishedAt: Date;
  status: "SUCCESS" | "PARTIAL" | "FAILED";
  totalRows: number;
  accepted: number;
  rejected: number;
  duplicatesWithinRun: number;
  detectedColumns: Record<string, string | null>;
  usedGroupAsGrade: boolean;
  fallbackCommodityUsed: string | null;
  rejectedLogPath: string | null;
  error?: string;
}

const LOG_DIR = path.resolve(import.meta.dirname, "../../logs");

export async function importCsv(
  prisma: PrismaClient,
  filePath: string,
  options: { fallbackCommodity?: string; onProgress?: (written: number, total: number) => void } = {},
): Promise<CsvImportSummary> {
  const startedAt = new Date();
  const runId = startedAt.toISOString().replace(/[:.]/g, "-");
  mkdirSync(LOG_DIR, { recursive: true });
  const rejectedLogPath = path.join(LOG_DIR, `csv-import-rejected-${runId}.jsonl`);
  let rejectedCount = 0;

  let rows: Record<string, string>[];
  let headers: string[];

  try {
    const fileContent = readFileSync(filePath, "utf8");
    rows = parse(fileContent, { columns: true, skip_empty_lines: true, trim: true });
    headers = rows.length > 0 ? Object.keys(rows[0]!) : [];
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      filePath,
      startedAt,
      finishedAt: new Date(),
      status: "FAILED",
      totalRows: 0,
      accepted: 0,
      rejected: 0,
      duplicatesWithinRun: 0,
      detectedColumns: {},
      usedGroupAsGrade: false,
      fallbackCommodityUsed: options.fallbackCommodity ?? null,
      rejectedLogPath: null,
      error: `Could not read/parse CSV file: ${message}`,
    };
  }

  const columnMap = detectColumnMap(headers);
  const seenNaturalKeys = new Set<string>();

  let rejected = 0;
  let duplicatesWithinRun = 0;

  // Validation (fast, in-memory) is still done row by row - only the
  // database write is batched. Invalid/duplicate rows never reach the
  // batch at all.
  const validObservations: NormalizedObservation[] = [];

  for (const row of rows) {
    const rawRecord = mapCsvRow(row, columnMap, { fallbackCommodity: options.fallbackCommodity });

    if (!rawRecord) {
      rejected += 1;
      rejectedCount += 1;
      appendFileSync(
        rejectedLogPath,
        JSON.stringify({
          reason: "Could not determine commodity name (no commodity column and no --commodity fallback given)",
          raw: row,
          timestamp: new Date().toISOString(),
        }) + "\n",
        "utf8",
      );
      continue;
    }

    const result = validateRecord(rawRecord);

    if (!result.ok) {
      rejected += 1;
      rejectedCount += 1;
      appendFileSync(
        rejectedLogPath,
        JSON.stringify({ reason: result.reason, raw: result.raw, timestamp: new Date().toISOString() }) + "\n",
        "utf8",
      );
      continue;
    }

    const { observation } = result;

    if (seenNaturalKeys.has(observation.sourceRecord)) {
      duplicatesWithinRun += 1;
      continue;
    }
    seenNaturalKeys.add(observation.sourceRecord);
    validObservations.push(observation);
  }

  const resolver = createReferenceDataResolver(prisma);
  const { written, collapsedDuplicates } = await storeObservationsBatch(
    prisma,
    resolver,
    validObservations,
    options.onProgress,
  );
  const accepted = written;
  duplicatesWithinRun += collapsedDuplicates;

  const finishedAt = new Date();
  const status: CsvImportSummary["status"] = rows.length === 0 ? "FAILED" : accepted > 0 ? "SUCCESS" : "PARTIAL";

  const detectedColumns = Object.fromEntries(
    Object.entries(columnMap.columns).map(([field, header]) => [field, header]),
  );

  await prisma.rawIngestionLog.create({
    data: {
      source: DataSource.MANUAL,
      fetchedAt: startedAt,
      status,
      rawPayloadRef: rejectedCount > 0 ? rejectedLogPath : null,
      notes: JSON.stringify(
        {
          filePath,
          durationMs: finishedAt.getTime() - startedAt.getTime(),
          totalRows: rows.length,
          accepted,
          rejected,
          duplicatesWithinRun,
          detectedColumns,
          usedGroupAsGrade: columnMap.usedGroupAsGrade,
          fallbackCommodityUsed: options.fallbackCommodity ?? null,
        },
        null,
        2,
      ),
    },
  });

  return {
    filePath,
    startedAt,
    finishedAt,
    status,
    totalRows: rows.length,
    accepted,
    rejected,
    duplicatesWithinRun,
    detectedColumns,
    usedGroupAsGrade: columnMap.usedGroupAsGrade,
    fallbackCommodityUsed: options.fallbackCommodity ?? null,
    rejectedLogPath: rejectedCount > 0 ? rejectedLogPath : null,
  };
}
