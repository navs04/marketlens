import { ingestionEnv } from "./config.js";
import { apiEnvelopeSchema, type ApiEnvelope } from "./rawRecord.js";

export class DataGovApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = "DataGovApiError";
  }
}

function buildUrl(params: { commodity: string; offset: number; limit: number }): string {
  const url = new URL(`${ingestionEnv.DATA_GOV_IN_BASE_URL}/${ingestionEnv.DATA_GOV_IN_RESOURCE_ID}`);
  url.searchParams.set("api-key", ingestionEnv.DATA_GOV_IN_API_KEY);
  url.searchParams.set("format", "json");
  url.searchParams.set("offset", String(params.offset));
  url.searchParams.set("limit", String(params.limit));
  url.searchParams.set("filters[commodity]", params.commodity);
  return url.toString();
}

async function fetchPage(params: { commodity: string; offset: number; limit: number }): Promise<ApiEnvelope> {
  const url = buildUrl(params);
  let response: Response;

  try {
    response = await fetch(url);
  } catch (err) {
    throw new DataGovApiError(
      `Network error contacting data.gov.in for commodity "${params.commodity}": ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new DataGovApiError(
      `data.gov.in returned HTTP ${response.status} for commodity "${params.commodity}": ${body.slice(0, 300)}`,
      response.status,
    );
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch (err) {
    throw new DataGovApiError(
      `data.gov.in response for commodity "${params.commodity}" was not valid JSON: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  const parsed = apiEnvelopeSchema.safeParse(json);
  if (!parsed.success) {
    throw new DataGovApiError(
      `data.gov.in response for commodity "${params.commodity}" did not match the expected shape: ${JSON.stringify(
        parsed.error.flatten(),
      )}`,
    );
  }

  return parsed.data;
}

const PAGE_DELAY_MS = 250;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fetches every page for one commodity, filtered server-side via
 * `filters[commodity]`, up to INGEST_MAX_RECORDS_PER_COMMODITY /
 * INGEST_MAX_PAGES_PER_COMMODITY. Deliberately not filtered by state - the
 * pipeline discovers whatever real markets/states the source returns and
 * normalizes/upserts them, rather than assuming a fixed list up front.
 */
export async function* fetchCommodityRecords(
  commodity: string,
): AsyncGenerator<Record<string, unknown>[], void, unknown> {
  const limit = ingestionEnv.INGEST_PAGE_LIMIT;
  const maxRecords = ingestionEnv.INGEST_MAX_RECORDS_PER_COMMODITY;
  const maxPages = ingestionEnv.INGEST_MAX_PAGES_PER_COMMODITY;

  let offset = 0;
  let page = 0;
  let total = Infinity;

  while (offset < total && offset < maxRecords && page < maxPages) {
    const envelope = await fetchPage({ commodity, offset, limit });

    if (typeof envelope.total === "number") {
      total = envelope.total;
    }

    if (envelope.records.length === 0) {
      break; // nothing more to page through, regardless of what `total` claims
    }

    yield envelope.records;

    offset += envelope.records.length;
    page += 1;

    if (offset < total && offset < maxRecords && page < maxPages) {
      await sleep(PAGE_DELAY_MS);
    }
  }
}
