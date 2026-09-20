import { Router } from "express";
import { commodityController } from "../controllers/commodity.controller.js";

export const commodityRouter = Router();

commodityRouter.get("/", commodityController.list);
commodityRouter.get("/:id", commodityController.getById);
