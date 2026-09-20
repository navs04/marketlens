import type { Request, Response } from "express";
import { marketService } from "../services/market.service.js";
import { AppError } from "../utils/AppError.js";

export const marketController = {
  async list(_req: Request, res: Response) {
    const markets = await marketService.list();
    res.json({ data: markets });
  },

  async getById(req: Request, res: Response) {
    const { id } = req.params;
    if (!id || Array.isArray(id)) throw AppError.badRequest("Market id is required");

    const market = await marketService.getById(id);
    if (!market) throw AppError.notFound(`Market ${id} not found`);

    res.json({ data: market });
  },
};
