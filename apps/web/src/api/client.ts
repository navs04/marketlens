import type { ApiErrorBody } from "./types";

/**
 * In dev, Vite's proxy (see vite.config.ts) forwards /api to the Express
 * server, so a relative path works without touching CORS config. In
 * production the built frontend needs a real API origin - set at build
 * time via VITE_API_BASE_URL, including the "/api" prefix (for example
 * "https://marketlens-api.onrender.com/api"). Falls back to same-origin
 * "/api" if unset, which is correct when frontend and API share a host.
 */
const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL ?? "/api";

class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

/**
 * Cold-start tolerance. A free-tier API host sleeps when idle and takes up
 * to a minute to wake, during which requests fail at the network level or
 * return a gateway error (502/503/504). In production builds those are
 * retried with a growing delay (about 43s in total) instead of being shown
 * to the user as a failure. In development there are no retries, so a
 * stopped local API shows as unreachable immediately.
 */
const WAKE_RETRY_DELAYS_MS: number[] = import.meta.env?.PROD ? [3000, 5000, 8000, 12000, 15000] : [];
const RETRYABLE_STATUS = new Set([502, 503, 504]);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function requestWithRetry<T>(
  path: string,
  init: RequestInit = {},
  delaysMs: number[] = WAKE_RETRY_DELAYS_MS,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const canRetry = attempt < delaysMs.length;

    let response: Response;
    try {
      // No Content-Type on body-less requests: it would turn every cross-origin
      // GET into a CORS preflight (an extra round trip before each request).
      response = await fetch(`${API_BASE_URL}${path}`, init);
    } catch (err) {
      // fetch rejects with a TypeError on network failure (offline, DNS, host asleep).
      if (err instanceof TypeError && canRetry) {
        await sleep(delaysMs[attempt]!);
        continue;
      }
      throw err;
    }

    if (!response.ok) {
      if (RETRYABLE_STATUS.has(response.status) && canRetry) {
        await sleep(delaysMs[attempt]!);
        continue;
      }
      const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
      throw new ApiRequestError(
        body?.error?.message ?? `Request to ${path} failed with status ${response.status}`,
        response.status,
        body?.error?.code ?? "UNKNOWN_ERROR",
      );
    }

    return response.json() as Promise<T>;
  }
}

export const apiClient = {
  get: <T>(path: string) => requestWithRetry<T>(path, { method: "GET" }),
};

export { ApiRequestError };
