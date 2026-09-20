import { useEffect, useState } from "react";
import { apiClient } from "../api/client";
import type { HealthStatus } from "../api/types";

type HealthState =
  | { status: "loading" }
  | { status: "ok"; health: HealthStatus }
  | { status: "error"; message: string };

export function useApiHealth() {
  const [state, setState] = useState<HealthState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    apiClient
      .get<{ status: string; uptimeSeconds: number; database: string; responseTimeMs: number; timestamp: string }>(
        "/v1/health",
      )
      .then((health) => {
        if (!cancelled) setState({ status: "ok", health: health as HealthStatus });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            status: "error",
            message: err instanceof Error ? err.message : "Could not reach the API",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
