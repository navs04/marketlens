import { rawRecordSchema } from "./rawRecord.js";
import {
  isPlausibleObservationDate,
  normalizeCommodityName,
  normalizeDistrictName,
  normalizeGrade,
  normalizeMarketName,
  normalizeStateName,
  normalizeVariety,
  parseArrivalDate,
  parsePrice,
} from "./normalize.js";

export interface NormalizedObservation {
  state: string;
  district: string | null;
  market: string;
  commodity: string;
  variety: string;
  grade: string | null;
  date: Date;
  minPrice: number | null;
  maxPrice: number | null;
  modalPrice: number | null;
  sourceRecord: string;
}

export type ValidationResult =
  | { ok: true; observation: NormalizedObservation }
  | { ok: false; reason: string; raw: unknown };

/**
 * Validates and normalizes a single raw record. Every rejection path
 * returns a specific, human-readable reason - callers log these, they are
 * never silently swallowed.
 */
export function validateRecord(raw: unknown): ValidationResult {
  const parsed = rawRecordSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, reason: `Malformed record shape: ${parsed.error.message}`, raw };
  }
  const record = parsed.data;

  const state = normalizeStateName(record.state);
  const market = normalizeMarketName(record.market);
  const commodity = normalizeCommodityName(record.commodity);

  if (state.length === 0) return { ok: false, reason: "Missing state", raw };
  if (market.length === 0) return { ok: false, reason: "Missing market name", raw };
  if (commodity.length === 0) return { ok: false, reason: "Missing commodity name", raw };

  const date = parseArrivalDate(record.arrival_date);
  if (!date) {
    return { ok: false, reason: `Unparseable arrival_date: "${record.arrival_date}"`, raw };
  }
  if (!isPlausibleObservationDate(date)) {
    return { ok: false, reason: `Implausible arrival_date (too far in the future): "${record.arrival_date}"`, raw };
  }

  const minPrice = parsePrice(record.min_price);
  const maxPrice = parsePrice(record.max_price);
  const modalPrice = parsePrice(record.modal_price);

  // modal_price is what this project stores as the canonical `price` - if
  // it's missing/zero, the record carries no usable price signal at all.
  if (modalPrice === null) {
    return { ok: false, reason: "Missing or zero modal_price (no usable price signal)", raw };
  }

  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
    return { ok: false, reason: `min_price (${minPrice}) greater than max_price (${maxPrice})`, raw };
  }
  if (minPrice !== null && modalPrice < minPrice) {
    return { ok: false, reason: `modal_price (${modalPrice}) below min_price (${minPrice})`, raw };
  }
  if (maxPrice !== null && modalPrice > maxPrice) {
    return { ok: false, reason: `modal_price (${modalPrice}) above max_price (${maxPrice})`, raw };
  }

  const variety = normalizeVariety(record.variety);
  const grade = normalizeGrade(record.grade);
  const district = normalizeDistrictName(record.district);

  const dateKey = date.toISOString().slice(0, 10);
  const sourceRecord = `${state}|${district ?? ""}|${market}|${commodity}|${variety}|${grade ?? ""}|${dateKey}`;

  return {
    ok: true,
    observation: {
      state,
      district,
      market,
      commodity,
      variety,
      grade,
      date,
      minPrice,
      maxPrice,
      modalPrice,
      sourceRecord,
    },
  };
}
