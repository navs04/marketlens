import { Router } from "express";
import { forecastController } from "../controllers/forecast.controller.js";

export const forecastRouter = Router();

forecastRouter.get("/", forecastController.get);
