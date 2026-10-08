import type { Request, Response } from "express";
import { z } from "zod";
import { spikeRiskService } from "../services/spikeRisk.service.js";

const latestQuerySchema = z.object({
  marketId: z.string().min(1, "marketId is required"),
  commodityId: z.string().min(1, "commodityId is required"),
});

const feedQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).default(50),
  minProbability: z.coerce.number().min(0).max(1).default(0.5),
});

export const spikeRiskController = {
  async latest(req: Request, res: Response) {
    const query = latestQuerySchema.parse(req.query);
    const score = await spikeRiskService.latest(query);
    res.json({ data: score }); // null is a valid, honest "not yet scored" response
  },

  async feed(req: Request, res: Response) {
    const query = feedQuerySchema.parse(req.query);
    const scores = await spikeRiskService.feed(query);
    res.json({ data: scores });
  },
};
