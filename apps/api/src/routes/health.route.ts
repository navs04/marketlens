import { Router } from "express";
import { prisma } from "../lib/prisma.js";

export const healthRouter = Router();

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
