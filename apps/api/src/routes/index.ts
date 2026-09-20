import { Router } from "express";
import { healthRouter } from "./health.route.js";
import { marketRouter } from "./market.route.js";
import { commodityRouter } from "./commodity.route.js";
import { priceRouter } from "./price.route.js";
import { forecastRouter } from "./forecast.route.js";
import { anomalyRouter } from "./anomaly.route.js";
import { spikeRiskRouter } from "./spikeRisk.route.js";
import { explanationRouter } from "./explanation.route.js";

export const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/markets", marketRouter);
apiRouter.use("/commodities", commodityRouter);
apiRouter.use("/prices", priceRouter);
apiRouter.use("/forecasts", forecastRouter);
apiRouter.use("/anomalies", anomalyRouter);
apiRouter.use("/spike-risk", spikeRiskRouter);
apiRouter.use("/explanation", explanationRouter);
