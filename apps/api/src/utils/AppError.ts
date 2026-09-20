/**
 * A predictable, HTTP-status-aware error type.
 *
 * Routes/services throw AppError for expected failure cases (bad input,
 * missing resource, not-yet-implemented feature, etc). The central error
 * handler middleware knows how to turn these into clean JSON responses.
 * Anything that is NOT an AppError is treated as an unexpected bug and
 * logged with full detail, but still returns a safe generic message to
 * the client.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(message: string, statusCode: number, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.isOperational = true;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string, details?: unknown) {
    return new AppError(message, 400, details);
  }

  static notFound(message: string) {
    return new AppError(message, 404);
  }

  static notImplemented(message: string) {
    return new AppError(message, 501);
  }

  static internal(message: string) {
    return new AppError(message, 500);
  }
}
