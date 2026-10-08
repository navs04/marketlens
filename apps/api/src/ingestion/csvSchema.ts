/**
 * Maps a CSV row (from either of two known real-world sources) to the same
 * raw-record shape validate.ts already expects from the live API, so the
 * exact same validation/normalization/business-rule code is reused for
 * both ingestion paths - only how a raw record is obtained differs.
 *
 * Known real formats this handles:
 *  - A data.gov.in-style export: snake_case headers matching the API
 *    field names directly (state, district, market, commodity, variety,
 *    grade, arrival_date, min_price, max_price, modal_price).
 *  - Agmarknet's own official CSV export: 'State Name', 'District Name',
 *    'Market Name', 'Variety', 'Group', 'Min Price (Rs./Quintal)',
 *    'Max Price (Rs./Quintal)', 'Modal Price (Rs./Quintal)',
 *    'Reported Date'. Notably, this format has NO 'Commodity' column in
 *    several real historical mirrors (some are split one file per crop),
 *    and NO 'Grade' column - only 'Group', which is a commodity
 *    classification field, not a freshness grade. Mapping 'Group' to this
 *    project's `grade` field is an approximation, not an exact match -
 *    flagged here rather than assumed silently.
 */

function normalizeHeader(header: string): string {
  return header
    .trim()
    .replace(/_x0020_/gi, " ") // XML-escaped space - a real data.gov.in export quirk
    // (e.g. "Min_x0020_Price" = "Min Price"), confirmed against an actual
    // downloaded file rather than assumed.
    .toLowerCase()
    .replace(/[\s_()./]+/g, "");
}

// Each canonical field maps to every header spelling known to appear in
// the wild for it, pre-normalized via normalizeHeader.
const HEADER_ALIASES: Record<string, string[]> = {
  state: ["state", "statename"],
  district: ["district", "districtname"],
  market: ["market", "marketname", "marketcenter"],
  commodity: ["commodity", "commoditytype"],
  variety: ["variety"],
  grade: ["grade", "group"], // see the "Group" caveat above
  arrival_date: ["arrivaldate", "reporteddate", "pricedate", "date"],
  min_price: ["minprice", "minpricersquintal", "minpricers/quintal"],
  max_price: ["maxprice", "maxpricersquintal", "maxpricers/quintal"],
  modal_price: ["modalprice", "modalpricersquintal", "modalpricers/quintal"],
};

export interface CsvColumnMap {
  // canonical field -> actual header string found in this file (or null
  // if that field has no matching column in this file at all)
  columns: Record<keyof typeof HEADER_ALIASES, string | null>;
  usedGroupAsGrade: boolean;
}

export function detectColumnMap(headers: string[]): CsvColumnMap {
  const normalizedToOriginal = new Map<string, string>();
  for (const h of headers) {
    normalizedToOriginal.set(normalizeHeader(h), h);
  }

  const columns = {} as CsvColumnMap["columns"];
  let usedGroupAsGrade = false;

  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    let found: string | null = null;
    for (const alias of aliases) {
      const original = normalizedToOriginal.get(alias);
      if (original) {
        found = original;
        if (field === "grade" && alias === "group") usedGroupAsGrade = true;
        break;
      }
    }
    columns[field as keyof typeof HEADER_ALIASES] = found;
  }

  return { columns, usedGroupAsGrade };
}

export interface CsvRowMappingOptions {
  /** Used when the file has no commodity column at all (e.g. a
   *  one-file-per-crop Agmarknet mirror) - the caller supplies it once
   *  for the whole file rather than the mapper guessing per row. */
  fallbackCommodity?: string;
}

/**
 * Maps one CSV row (already parsed into a plain object keyed by its
 * original headers) to the raw-record shape validate.ts expects. Returns
 * null only when a commodity name genuinely cannot be determined - every
 * other gap is left for validate.ts's normal missing-field rejection path,
 * so there is exactly one place that decides what's "invalid".
 */
export function mapCsvRow(
  row: Record<string, string>,
  columnMap: CsvColumnMap,
  options: CsvRowMappingOptions = {},
): Record<string, unknown> | null {
  const get = (field: keyof typeof HEADER_ALIASES): string => {
    const header = columnMap.columns[field];
    return header ? (row[header] ?? "") : "";
  };

  const commodity = get("commodity").trim() || options.fallbackCommodity?.trim() || "";
  if (!commodity) return null;

  return {
    state: get("state"),
    district: get("district"),
    market: get("market"),
    commodity,
    variety: get("variety"),
    grade: get("grade"),
    arrival_date: get("arrival_date"),
    min_price: get("min_price"),
    max_price: get("max_price"),
    modal_price: get("modal_price"),
  };
}
