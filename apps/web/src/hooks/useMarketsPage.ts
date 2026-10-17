import { useApiQuery } from "./useApiQuery";
import type { Market, PageMeta } from "../api/types";

export function useMarketsPage(search: string, page: number, pageSize = 25) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (search) params.set("search", search);
  return useApiQuery<{ data: Market[]; meta: PageMeta }>(`/v1/markets?${params.toString()}`, [search, page, pageSize], {
    keepPrevious: true,
  });
}
