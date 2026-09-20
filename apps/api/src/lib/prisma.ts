import { PrismaClient } from "@prisma/client";
import { env } from "../config/env.js";

/**
 * A single shared PrismaClient instance.
 *
 * In dev, tsx's watch mode reloads modules on file changes; without caching
 * the client on `globalThis` this would create a fresh connection pool on
 * every reload and eventually exhaust Postgres's max_connections.
 */
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.__prisma ??
  new PrismaClient({
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}
