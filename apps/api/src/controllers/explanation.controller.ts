import type { Request, Response } from "express";
import { z } from "zod";
import { explanationService } from "../services/explanation.service.js";
import { AppError } from "../utils/AppError.js";

const querySchema = z.object({
  marketId: z.string().min(1, "marketId is required"),
  commodityId: z.string().min(1, "commodityId is required"),
});

export const explanationController = {
  async get(req: Request, res: Response) {
    const query = querySchema.parse(req.query);
    const result = await explanationService.explain(query);
    if (!result) {
      throw AppError.notFound("No price data available yet for this market and commodity.");
    }
    res.json({ data: result });
  },
};
