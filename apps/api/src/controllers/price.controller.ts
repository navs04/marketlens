import type { Request, Response } from "express";
import { z } from "zod";
import { priceService } from "../services/price.service.js";
import { AppError } from "../utils/AppError.js";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
  .transform((s) => new Date(`${s}T00:00:00Z`));

const listQuerySchema = z
  .object({
    marketId: z.string().min(1).optional(),
    commodityId: z.string().min(1).optional(),
    state: z.string().min(1).optional(),
    district: z.string().min(1).optional(),
    from: isoDate.optional(),
    to: isoDate.optional(),
    limit: z.coerce.number().int().positive().max(2000).default(90),
  })
  .refine((q) => q.marketId || q.commodityId, {
    message: "At least one of marketId or commodityId is required",
  });

const latestQuerySchema = z.object({
  marketId: z.string().min(1, "marketId is required"),
  commodityId: z.string().min(1, "commodityId is required"),
});

const summaryQuerySchema = z.object({
  marketId: z.string().min(1, "marketId is required"),
  commodityId: z.string().min(1, "commodityId is required"),
  windowDays: z.coerce.number().int().positive().max(365).default(30),
});

const compareQuerySchema = z.object({
  commodityId: z.string().min(1, "commodityId is required"),
  marketIds: z
    .string()
    .optional()
    .transform((s) => s?.split(",").map((id) => id.trim()).filter(Boolean)),
  state: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

const RANGE_DAYS = { "30D": 30, "90D": 90, "1Y": 365 } as const;

const seriesQuerySchema = z.object({
  marketId: z.string().min(1, "marketId is required"),
  commodityId: z.string().min(1, "commodityId is required"),
  range: z.enum(["30D", "90D", "1Y"]).default("90D"),
});

const sparklinesQuerySchema = z.object({
  // "marketId:commodityId,marketId:commodityId,..."
  pairs: z
    .string()
    .min(1, "pairs is required")
    .transform((raw, ctx) => {
      const parsed = raw
        .split(",")
        .map((part) => part.trim().split(":"))
        .filter((p) => p.length === 2 && p[0] && p[1])
        .map(([marketId, commodityId]) => ({ marketId: marketId!, commodityId: commodityId! }));
      if (parsed.length === 0) {
        ctx.addIssue({ code: "custom", message: "Expected pairs as marketId:commodityId,..." });
        return z.NEVER;
      }
      return parsed;
    })
    .pipe(z.array(z.object({ marketId: z.string(), commodityId: z.string() })).max(100, "At most 100 pairs")),
  days: z.coerce.number().int().positive().max(120).default(30),
});

const moversQuerySchema = z.object({
  windowDays: z.coerce.number().int().min(3).max(30).default(7),
  limit: z.coerce.number().int().positive().max(10).default(5),
});

// Movers scan two windows of the whole price table, so the result is
// cached briefly. The underlying data only changes when ingestion runs.
const MOVERS_TTL_MS = 10 * 60 * 1000;
const moversCache = new Map<string, { at: number; value: Awaited<ReturnType<typeof priceService.movers>> }>();

export const priceController = {
  async list(req: Request, res: Response) {
    // Throws ZodError on failure, caught by the central error handler and
    // turned into a 400 with field-level details - see middleware/errorHandler.ts
    const query = listQuerySchema.parse(req.query);
    const observations = await priceService.list(query);
    res.json({ data: observations });
  },

  async latest(req: Request, res: Response) {
    const query = latestQuerySchema.parse(req.query);
    const observation = await priceService.latest(query);
    if (!observation) {
      throw AppError.notFound("No price observations found for this market and commodity yet.");
    }
    res.json({ data: observation });
  },

  async summary(req: Request, res: Response) {
    const query = summaryQuerySchema.parse(req.query);
    const summary = await priceService.summary(query);
    if (!summary) {
      throw AppError.notFound("No price observations found for this market and commodity yet.");
    }
    res.json({ data: summary });
  },

  async compare(req: Request, res: Response) {
    const query = compareQuerySchema.parse(req.query);
    const results = await priceService.compareMarkets(query);
    res.json({ data: results });
  },

  async series(req: Request, res: Response) {
    const { marketId, commodityId, range } = seriesQuerySchema.parse(req.query);
    const points = await priceService.series({ marketId, commodityId, days: RANGE_DAYS[range] });
    res.json({ data: { range, days: RANGE_DAYS[range], points } });
  },

  async sparklines(req: Request, res: Response) {
    const { pairs, days } = sparklinesQuerySchema.parse(req.query);
    const series = await priceService.sparklines({ pairs, days });
    res.json({ data: { days, series } });
  },

  async movers(req: Request, res: Response) {
    const { windowDays, limit } = moversQuerySchema.parse(req.query);
    const key = `${windowDays}:${limit}`;
    const cached = moversCache.get(key);
    if (cached && Date.now() - cached.at < MOVERS_TTL_MS) {
      res.json({ data: cached.value });
      return;
    }
    const value = await priceService.movers({ windowDays, limit });
    moversCache.set(key, { at: Date.now(), value });
    res.json({ data: value });
  },
};
