import type { Request, Response } from "express";
import { commodityService } from "../services/commodity.service.js";
import { AppError } from "../utils/AppError.js";

export const commodityController = {
  async list(_req: Request, res: Response) {
    const commodities = await commodityService.list();
    res.json({ data: commodities });
  },

  async getById(req: Request, res: Response) {
    const { id } = req.params;
    if (!id || Array.isArray(id)) throw AppError.badRequest("Commodity id is required");

    const commodity = await commodityService.getById(id);
    if (!commodity) throw AppError.notFound(`Commodity ${id} not found`);

    res.json({ data: commodity });
  },
};
