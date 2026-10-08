import { useApiQuery } from "./useApiQuery";
import type { OverviewStats } from "../api/types";

export function useOverview() {
  return useApiQuery<{ data: OverviewStats }>("/v1/overview");
}
