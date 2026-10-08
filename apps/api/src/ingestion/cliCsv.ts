import "dotenv/config";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { importCsv } from "./csvImport.js";

function parseArgs(argv: string[]): { filePath: string | null; commodity?: string } {
  let filePath: string | null = null;
  let commodity: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--commodity") {
      commodity = argv[i + 1];
      i++;
    } else if (!argv[i]!.startsWith("--")) {
      filePath = argv[i]!;
    }
  }

  return { filePath, commodity };
}

async function main() {
  const { filePath, commodity } = parseArgs(process.argv.slice(2));

  if (!filePath) {
    console.error(
      "Usage: npm run ingest:csv -- <path-to-csv> [--commodity \"Onion\"]\n" +
        "  <path-to-csv> is relative to apps/api/ (e.g. data-imports/file.csv),\n" +
        "  NOT the repo root, even when this command is run from the repo root -\n" +
        "  npm's --workspace flag changes the working directory to apps/api first.\n" +
        '  --commodity is only needed if the CSV has no "Commodity" column\n' +
        "  (some Agmarknet mirrors are split one file per crop).",
    );
    process.exitCode = 1;
    return;
  }

  const resolvedPath = path.resolve(process.cwd(), filePath);
  console.log(`MarketLens CSV import`);
  console.log(`File: ${resolvedPath}`);
  if (commodity) console.log(`Fallback commodity: ${commodity}`);
  console.log("Reading and validating rows (large files can take a little while here)...");

  const prisma = new PrismaClient();
  let lastLoggedPercent = -1;

  try {
    const summary = await importCsv(prisma, resolvedPath, {
      fallbackCommodity: commodity,
      onProgress: (written, total) => {
        const percent = Math.floor((written / total) * 100);
        // Log at most once per 10% so a huge file doesn't flood the console.
        if (percent !== lastLoggedPercent && percent % 10 === 0) {
          lastLoggedPercent = percent;
          console.log(`  writing to database: ${written}/${total} (${percent}%)`);
        }
      },
    });

    console.log("\n--- CSV import summary ------------------------------");
    console.log(`Status:              ${summary.status}`);
    if (summary.error) console.log(`Error:               ${summary.error}`);
    console.log(`Rows in file:        ${summary.totalRows}`);
    console.log(`Accepted:            ${summary.accepted}`);
    console.log(`Rejected:            ${summary.rejected}`);
    console.log(`Duplicates in run:   ${summary.duplicatesWithinRun}`);
    console.log(`Detected columns:    ${JSON.stringify(summary.detectedColumns)}`);
    if (summary.usedGroupAsGrade) {
      console.log(`Note: mapped "Group" column to grade - Agmarknet's "Group" is a commodity`);
      console.log(`      classification field, not a literal freshness grade. Approximate mapping.`);
    }
    if (summary.rejectedLogPath) {
      console.log(`Rejected rows logged to: ${summary.rejectedLogPath}`);
    }
    console.log("-------------------------------------------------------\n");

    if (summary.status === "FAILED") {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error("CSV import crashed:", err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
