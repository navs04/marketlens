import "dotenv/config";
import { z } from "zod";

/**
 * All environment variables the API depends on are declared and validated
 * here. If a required variable is missing or malformed, the process fails
 * fast at startup with a clear error instead of surfacing a confusing
 * runtime failure later (e.g. a Prisma connection error deep in a request).
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // Optional: powers AI-generated explanations (src/llm/). When unset, the
  // explanation endpoint falls back to a deterministic, template-based
  // explanation built from the same structured numbers - the app must
  // work either way, per this project's own requirement.
  ANTHROPIC_API_KEY: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:");
  console.error(parsed.error.flatten().fieldErrors);
  throw new Error("Environment validation failed. Check your .env file against .env.example.");
}

export const env = parsed.data;
export type Env = typeof env;
