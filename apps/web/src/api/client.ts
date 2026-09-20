import type { ApiErrorBody } from "./types";

/**
 * In dev, Vite's proxy (see vite.config.ts) forwards /api to the Express
 * server, so a relative path works without touching CORS config. In
 * production the built frontend needs a real API origin - set at build
 * time via VITE_API_BASE_URL (falls back to same-origin "/api" if unset,
 * which is correct when frontend and API are served from the same host).
 */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiRequestError(
      body?.error.message ?? `Request to ${path} failed with status ${response.status}`,
      response.status,
      body?.error.code ?? "UNKNOWN_ERROR",
    );
  }

  return response.json() as Promise<T>;
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
};

export { ApiRequestError };
