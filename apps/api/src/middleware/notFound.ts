import type { Request, Response } from "express";

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error: {
      message: `No route matches ${req.method} ${req.originalUrl}`,
      code: "ROUTE_NOT_FOUND",
    },
  });
}
