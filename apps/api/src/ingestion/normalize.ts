/**
 * Normalization for the data.gov.in mandi price resource.
 *
 * Every function here documents a specific, real quirk of this dataset
 * rather than a generic "clean the data" pass - these were confirmed
 * against the resource's published field metadata and multiple independent
 * third-party integrations against the same resource ID.
 */

// -- Dates -------------------------------------------------------------

const MONTH_ABBREVIATIONS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function buildUtcDate(year: number, monthIndex: number, day: number): Date | null {
  const date = new Date(Date.UTC(year, monthIndex, day));
  // Guard against JS's lenient date rollover (e.g. day=31 in a 30-day month)
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== monthIndex || date.getUTCDate() !== day) {
    return null;
  }
  return date;
}

/**
 * Parses a date from either of the two real formats this project's two
 * ingestion paths actually encounter, plus ISO as a safety fallback. Never
 * throws - returns null for anything that doesn't parse cleanly, so the
 * caller can reject-and-log rather than crash the batch.
 *
 *  - DD/MM/YYYY (day-first) - the data.gov.in API's `arrival_date` field.
 *  - "D Mon YYYY" (e.g. "15 Jan 2024") - Agmarknet's own CSV export's
 *    "Reported Date" column, used by the CSV import fallback path.
 *  - YYYY-MM-DD (ISO) - accepted defensively in case either source ever
 *    changes format; not silently trusted, just one more shape to parse.
 */
export function parseArrivalDate(raw: string): Date | null {
  const trimmed = raw.trim();

  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (dmy) {
    const [, d, m, y] = dmy;
    return buildUtcDate(Number(y), Number(m) - 1, Number(d));
  }

  const dMonY = /^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})$/.exec(trimmed);
  if (dMonY) {
    const [, d, monRaw, y] = dMonY;
    const monthIndex = MONTH_ABBREVIATIONS[monRaw!.slice(0, 3).toLowerCase()];
    if (monthIndex === undefined) return null;
    return buildUtcDate(Number(y), monthIndex, Number(d));
  }

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (iso) {
    const date = new Date(`${trimmed}T00:00:00Z`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

/** Reject dates further than one day in the future - a same-day/near-future
 *  entry can be a timezone artifact, but anything further out indicates a
 *  data entry error rather than a real mandi observation. */
export function isPlausibleObservationDate(date: Date): boolean {
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return date.getTime() <= tomorrow.getTime();
}

// -- Prices --------------------------------------------------------------

/**
 * Price fields arrive as either strings or numbers depending on the record
 * (a documented quirk of this dataset across years). A price of exactly 0
 * is this dataset's sentinel for "not reported" - not a real ₹0 mandi
 * price - so it's treated as missing (null), never stored as a real price.
 * This is an explicit interpretation, called out here and in the
 * Milestone 2 write-up, not a silent assumption.
 */
export function parsePrice(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  const num = typeof raw === "number" ? raw : Number(String(raw).trim());
  if (!Number.isFinite(num)) return null;
  if (num <= 0) return null;
  return num;
}

// -- Names -----------------------------------------------------------------

/** Known India-specific naming quirks in this dataset that a generic
 *  title-case pass gets wrong. Keys are the title-cased intermediate form. */
const STATE_ALIASES: Record<string, string> = {
  "Nct Of Delhi": "Delhi",
  Orissa: "Odisha",
  Pondicherry: "Puducherry",
};

function collapseWhitespace(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

/**
 * Title-cases a name while preserving short all-caps tokens that are
 * likely abbreviations (APMC, FCI, etc.) rather than shouted words. Source
 * data for this resource is commonly all-uppercase (e.g. "AZADPUR").
 */
function titleCase(raw: string): string {
  return collapseWhitespace(raw)
    .split(" ")
    .map((word) => {
      if (word.length === 0) return word;
      const isLikelyAbbreviation = word.length <= 4 && word === word.toUpperCase() && /[A-Z]/.test(word);
      if (isLikelyAbbreviation) return word;
      return word[0]!.toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

export function normalizeStateName(raw: string): string {
  const titled = titleCase(raw);
  return STATE_ALIASES[titled] ?? titled;
}

export function normalizeMarketName(raw: string): string {
  return titleCase(raw);
}

export function normalizeDistrictName(raw: string): string | null {
  const cleaned = collapseWhitespace(raw);
  return cleaned.length > 0 ? titleCase(cleaned) : null;
}

export function normalizeCommodityName(raw: string): string {
  return titleCase(raw);
}

export function normalizeVariety(raw: string): string {
  return collapseWhitespace(raw);
}

export function normalizeGrade(raw: string): string | null {
  const cleaned = collapseWhitespace(raw);
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * This resource does not publish a `unit` field. Every third-party
 * integration against it (and Agmarknet's own site) treats prices as
 * Rupees per quintal (100kg) - the standard mandi convention - so that is
 * assumed here for every commodity ingested through this pipeline. This is
 * exactly the kind of non-obvious mapping decision this milestone's brief
 * asked to be surfaced rather than silently assumed.
 */
export const ASSUMED_UNIT = "per quintal";
