import { Router } from "express";
import { AppError } from "../utils/AppError.js";

export const forecastRouter = Router();

forecastRouter.get("/", (_req, res) => {
  throw AppError.notImplemented(
    "The forecasting model has not been implemented yet (planned: Milestone 5).",
  );
});
