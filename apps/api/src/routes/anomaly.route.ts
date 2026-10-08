import { Router } from "express";
import { anomalyController } from "../controllers/anomaly.controller.js";

export const anomalyRouter = Router();

anomalyRouter.get("/feed", anomalyController.feed);
anomalyRouter.get("/", anomalyController.list);
