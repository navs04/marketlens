import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../utils/AppError.js";
import { env } from "../config/env.js";

/**
 * Single place where every error in the app ends up.
 *
 * Express 5 automatically forwards rejected promises from async route
 * handlers here, so route/controller code can simply `throw` (or `await`
 * a rejecting call) without wrapping every handler in a try/catch or a
 * manual asyncHandler helper.
 *
 * Must be registered AFTER all routes in src/index.ts.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        message: "Request validation failed",
        code: "VALIDATION_ERROR",
        details: err.flatten(),
      },
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        message: err.message,
        code: err.name,
        ...(err.details ? { details: err.details } : {}),
      },
    });
    return;
  }

  // Unexpected/unhandled error: log full detail server-side, never leak
  // internals (stack traces, DB errors, etc) to the client.
  console.error("Unhandled error:", err);

  res.status(500).json({
    error: {
      message: "Something went wrong on our end.",
      code: "INTERNAL_ERROR",
      ...(env.NODE_ENV === "development" && err instanceof Error
        ? { debug: err.message, stack: err.stack }
        : {}),
    },
  });
}
