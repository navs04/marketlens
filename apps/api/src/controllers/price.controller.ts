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
};
