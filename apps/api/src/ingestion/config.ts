import "dotenv/config";
import { z } from "zod";

/**
 * Config specific to the data.gov.in ingestion pipeline.
 *
 * Deliberately validated separately from src/config/env.ts: the API server
 * (markets, commodities, prices endpoints) has no reason to fail to boot
 * just because an ingestion-only API key hasn't been configured yet. This
 * schema is only evaluated when the ingestion script actually runs.
 */
const ingestionEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // Free key, registered at https://www.data.gov.in/user/register - the
  // shared public "sample" key is heavily rate-limited and not suitable
  // for real use, so this has no default and ingestion refuses to run
  // without a real key configured.
  DATA_GOV_IN_API_KEY: z.string().min(1, "DATA_GOV_IN_API_KEY is required to run ingestion"),

  // "Current Daily Price of Various Commodities from Various Markets
  // (Mandi)" - the AGMARKNET-sourced resource this project uses.
  DATA_GOV_IN_RESOURCE_ID: z.string().default("9ef84268-d588-465a-a308-a864a43d0070"),
  DATA_GOV_IN_BASE_URL: z.string().default("https://api.data.gov.in/resource"),

  // Which commodities to pull. Comma-separated; matched against the
  // source's own `commodity` field values (case-insensitive, trimmed).
  INGEST_COMMODITIES: z
    .string()
    .default("Onion,Potato,Tomato,Green Chilli,Cauliflower,Brinjal")
    .transform((s) =>
      s
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean),
    ),

  // Records per API page. The source API's own examples page in blocks of
  // 100; kept configurable in case that changes.
  INGEST_PAGE_LIMIT: z.coerce.number().int().positive().max(1000).default(100),

  // Hard ceiling per commodity per run, so a single `npm run ingest` can't
  // accidentally pull hundreds of thousands of rows across all of India's
  // ~6,000 mandis. Deliberately scoped for an MVP; raise later if needed.
  INGEST_MAX_RECORDS_PER_COMMODITY: z.coerce.number().int().positive().max(50000).default(1500),

  // Safety cap on page requests per commodity, independent of the above,
  // in case the API's `total` field is ever wrong or missing.
  INGEST_MAX_PAGES_PER_COMMODITY: z.coerce.number().int().positive().max(500).default(50),
});

const parsed = ingestionEnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid ingestion environment configuration:");
  console.error(parsed.error.flatten().fieldErrors);
  throw new Error(
    "Ingestion environment validation failed. Check apps/api/.env against .env.example " +
      "(you need DATA_GOV_IN_API_KEY - register a free key at https://www.data.gov.in/user/register).",
  );
}

export const ingestionEnv = parsed.data;
