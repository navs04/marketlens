import { Router } from "express";
import { AppError } from "../utils/AppError.js";

export const spikeRiskRouter = Router();

spikeRiskRouter.get("/", (_req, res) => {
  throw AppError.notImplemented(
    "The spike-risk classifier has not been implemented yet (planned: Milestone 6).",
  );
});
