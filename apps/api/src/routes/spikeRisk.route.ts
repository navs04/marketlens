import { Router } from "express";
import { spikeRiskController } from "../controllers/spikeRisk.controller.js";

export const spikeRiskRouter = Router();

spikeRiskRouter.get("/feed", spikeRiskController.feed);
spikeRiskRouter.get("/", spikeRiskController.latest);
