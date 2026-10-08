import { z } from "zod";

/**
 * Shape of one record from the "Current Daily Price of Various Commodities
 * from Various Markets (Mandi)" resource (id 9ef84268-d588-465a-a308-a864a43d0070).
 *
 * Confirmed field list (state, district, market, commodity, variety, grade,
 * arrival_date, min_price, max_price, modal_price) from the resource's own
 * published metadata. Price fields are typed as `unknown` here rather than
 * `number` because this dataset is known to mix string and numeric
 * representations across years/records - coercion happens explicitly in
 * normalize.ts, not silently here, so a malformed value can be logged with
 * its original shape.
 */
export const rawRecordSchema = z.object({
  state: z.string().optional().default(""),
  district: z.string().optional().default(""),
  market: z.string().optional().default(""),
  commodity: z.string().optional().default(""),
  variety: z.string().optional().default(""),
  grade: z.string().optional().default(""),
  arrival_date: z.string().optional().default(""),
  min_price: z.unknown().optional(),
  max_price: z.unknown().optional(),
  modal_price: z.unknown().optional(),
});

export type RawRecord = z.infer<typeof rawRecordSchema>;

/**
 * The api.data.gov.in response envelope. `records` is validated leniently
 * here (each entry just needs to be an object) - per-record field
 * validation happens one record at a time in validate.ts, so a single
 * malformed record can be rejected and logged without discarding the
 * entire page.
 */
export const apiEnvelopeSchema = z.object({
  status: z.string().optional(),
  total: z.coerce.number().optional(),
  count: z.coerce.number().optional(),
  limit: z.union([z.string(), z.number()]).optional(),
  offset: z.union([z.string(), z.number()]).optional(),
  records: z.array(z.record(z.string(), z.unknown())).default([]),
});

export type ApiEnvelope = z.infer<typeof apiEnvelopeSchema>;
