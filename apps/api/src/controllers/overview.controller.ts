import type { Request, Response } from "express";
import { overviewService } from "../services/overview.service.js";

export const overviewController = {
  async get(_req: Request, res: Response) {
    const data = await overviewService.get();
    res.json({ data });
  },
};
