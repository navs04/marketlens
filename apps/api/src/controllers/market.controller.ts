import type { Request, Response } from "express";
import { z } from "zod";
import { marketService } from "../services/market.service.js";
import { AppError } from "../utils/AppError.js";

const listQuerySchema = z.object({
  state: z.string().min(1).optional(),
  district: z.string().min(1).optional(),
  search: z.string().min(1).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
});

export const marketController = {
  async list(req: Request, res: Response) {
    const query = listQuerySchema.parse(req.query);
    const { items, total } = await marketService.list(query);
    if (total === null) {
      res.json({ data: items });
      return;
    }
    res.json({
      data: items,
      meta: {
        total,
        page: query.page!,
        pageSize: query.pageSize,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      },
    });
  },

  async listStates(_req: Request, res: Response) {
    const states = await marketService.listStates();
    res.json({ data: states });
  },

  async getById(req: Request, res: Response) {
    const { id } = req.params;
    if (!id || Array.isArray(id)) throw AppError.badRequest("Market id is required");

    const market = await marketService.getById(id);
    if (!market) throw AppError.notFound(`Market ${id} not found`);

    res.json({ data: market });
  },

  async getCommodities(req: Request, res: Response) {
    const { id } = req.params;
    if (!id || Array.isArray(id)) throw AppError.badRequest("Market id is required");

    const market = await marketService.getById(id);
    if (!market) throw AppError.notFound(`Market ${id} not found`);

    const commodities = await marketService.commoditiesAtMarket(id);
    res.json({ data: { market, commodities } });
  },
};
