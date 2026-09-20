import { Router } from "express";
import { AppError } from "../utils/AppError.js";

export const explanationRouter = Router();

/**
 * Deliberately not implemented in this milestone: per the project's core
 * architectural principle, this endpoint will call an LLM only to explain
 * ALREADY-COMPUTED structured results (forecast, anomaly, risk score) -
 * it will never generate numbers itself. It is stubbed here rather than
 * skipped so the full planned API surface is visible from Milestone 1.
 */
explanationRouter.get("/", (_req, res) => {
  throw AppError.notImplemented(
    "AI-generated explanations have not been implemented yet (planned: Milestone 6).",
  );
});
