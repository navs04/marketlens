import { Router } from "express";
import { AppError } from "../utils/AppError.js";

export const anomalyRouter = Router();

anomalyRouter.get("/", (_req, res) => {
  throw AppError.notImplemented(
    "Anomaly detection has not been implemented yet (planned: Milestone 4).",
  );
});
