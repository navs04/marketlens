/** Builds an in-app link that pins a market and/or commodity in the URL. */
export function selectionPath(
  path: string,
  selection: { marketId?: string | null; commodityId?: string | null; extra?: Record<string, string> },
): string {
  const params = new URLSearchParams();
  if (selection.marketId) params.set("market", selection.marketId);
  if (selection.commodityId) params.set("commodity", selection.commodityId);
  for (const [k, v] of Object.entries(selection.extra ?? {})) params.set(k, v);
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}
