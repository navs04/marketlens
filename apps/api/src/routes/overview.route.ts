import { Router } from "express";
import { overviewController } from "../controllers/overview.controller.js";

export const overviewRouter = Router();

overviewRouter.get("/", overviewController.get);
