import { Router } from "express";
import { marketController } from "../controllers/market.controller.js";

export const marketRouter = Router();

marketRouter.get("/", marketController.list);
marketRouter.get("/:id", marketController.getById);
