import { Router } from "express";
import { AppError } from "../utils/AppError.js";

export const priceRouter = Router();

/**
 * The PriceObservation table exists (see prisma/schema.prisma) but is
 * intentionally empty until the Milestone 2 ingestion pipeline lands.
 * The route is wired up now so the API surface matches the agreed
 * architecture; it responds 501 rather than pretending to have data.
 */
priceRouter.get("/", (_req, res) => {
  throw AppError.notImplemented(
    "Price data ingestion has not been implemented yet (planned: Milestone 2).",
  );
});

priceRouter.get("/summary", (_req, res) => {
  throw AppError.notImplemented(
    "Price summary (current vs. historical average) has not been implemented yet (planned: Milestone 3-4).",
  );
});
