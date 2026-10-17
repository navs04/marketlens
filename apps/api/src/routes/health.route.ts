import { Router } from "express";
import { prisma } from "../lib/prisma.js";

export const healthRouter = Router();

/**
 * Process liveness only - deliberately does NOT touch the database. Hosting
 * health checks and keep-alive pingers hit this: a check that queried
 * Postgres every few minutes would keep a scale-to-zero database (Neon's
 * free tier) awake around the clock and burn its monthly compute allowance.
 */
healthRouter.get("/live", (_req, res) => {
  res.json({ status: "ok", uptimeSeconds: process.uptime() });
});

/**
 * Liveness + DB connectivity check.
 * Kept dependency-free of business logic on purpose - this endpoint should
 * stay trivially reliable so it's useful for uptime checks / load balancers.
 */
healthRouter.get("/", async (_req, res) => {
  const startedAt = Date.now();
  let databaseStatus: "connected" | "unreachable" = "connected";

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    databaseStatus = "unreachable";
  }

  res.status(databaseStatus === "connected" ? 200 : 503).json({
    status: databaseStatus === "connected" ? "ok" : "degraded",
    uptimeSeconds: process.uptime(),
    database: databaseStatus,
    responseTimeMs: Date.now() - startedAt,
    timestamp: new Date().toISOString(),
  });
});
