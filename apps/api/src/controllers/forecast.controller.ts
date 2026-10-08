import type { Request, Response } from "express";
import { z } from "zod";
import { forecastService } from "../services/forecast.service.js";

const querySchema = z.object({
  marketId: z.string().min(1, "marketId is required"),
  commodityId: z.string().min(1, "commodityId is required"),
});

export const forecastController = {
  async get(req: Request, res: Response) {
    const query = querySchema.parse(req.query);
    const result = await forecastService.get(query);
    res.json({ data: result });
  },
};
