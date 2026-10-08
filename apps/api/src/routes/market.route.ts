import { Router } from "express";
import { marketController } from "../controllers/market.controller.js";

export const marketRouter = Router();

// Specific paths before the general list and :id-param routes.
marketRouter.get("/states", marketController.listStates);
marketRouter.get("/", marketController.list);
marketRouter.get("/:id/commodities", marketController.getCommodities);
marketRouter.get("/:id", marketController.getById);
