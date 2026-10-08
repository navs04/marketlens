import { PrismaClient } from "@prisma/client";
import { ingestionEnv } from "./config.js";
import { runIngestion } from "./ingestRun.js";

async function main() {
  console.log("MarketLens ingestion");
  console.log(`Commodities: ${ingestionEnv.INGEST_COMMODITIES.join(", ")}`);
  console.log(`Resource: ${ingestionEnv.DATA_GOV_IN_RESOURCE_ID}`);

  const prisma = new PrismaClient();

  try {
    const summary = await runIngestion(prisma);

    console.log("\n--- Ingestion summary -------------------------------");
    console.log(`Status:              ${summary.status}`);
    console.log(`Duration:            ${((summary.finishedAt.getTime() - summary.startedAt.getTime()) / 1000).toFixed(1)}s`);
    console.log(`Records fetched:     ${summary.totalFetched}`);
    console.log(`Records accepted:    ${summary.totalAccepted}`);
    console.log(`Records rejected:    ${summary.totalRejected}`);
    console.log(`Duplicates in run:   ${summary.totalDuplicatesWithinRun}`);
    console.log(`Markets touched:     ${summary.distinctMarketsTouched}`);
    console.log(`Commodities touched: ${summary.distinctCommoditiesTouched}`);
    if (summary.rejectedLogPath) {
      console.log(`Rejected records logged to: ${summary.rejectedLogPath}`);
    }
    console.log("-------------------------------------------------------\n");

    if (summary.status === "FAILED") {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error("Ingestion crashed:", err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
