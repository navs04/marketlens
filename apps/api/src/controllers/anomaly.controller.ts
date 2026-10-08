import type { Request, Response } from "express";
import { z } from "zod";
import { anomalyService } from "../services/anomaly.service.js";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
  .transform((s) => new Date(`${s}T00:00:00Z`));

const listQuerySchema = z.object({
  marketId: z.string().min(1, "marketId is required"),
  commodityId: z.string().min(1, "commodityId is required"),
  from: isoDate.optional(),
  to: isoDate.optional(),
  limit: z.coerce.number().int().positive().max(2000).default(90),
});

const feedQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).default(50),
});

export const anomalyController = {
  async list(req: Request, res: Response) {
    const query = listQuerySchema.parse(req.query);
    const flags = await anomalyService.list(query);
    res.json({ data: flags });
  },

  async feed(req: Request, res: Response) {
    const query = feedQuerySchema.parse(req.query);
    const flags = await anomalyService.feed(query);
    res.json({ data: flags });
  },
};
