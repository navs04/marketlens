import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { apiRouter } from "./routes/index.js";
import { notFoundHandler } from "./middleware/notFound.js";
import { errorHandler } from "./middleware/errorHandler.js";

/**
 * Building the app in its own module (separate from index.ts, which just
 * starts the HTTP server) means it can later be imported directly by an
 * integration test (e.g. with supertest) without binding a real port.
 */
export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
    }),
  );
  app.use(express.json());
  app.use(morgan(env.NODE_ENV === "development" ? "dev" : "combined"));

  app.use("/api/v1", apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
