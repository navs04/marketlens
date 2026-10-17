import { percentChange } from "./chartData";
import type { SparklinePoint, SparklineResponse } from "../api/types";

const DAY = 86_400_000;
/** How close to each end of the window a series must reach to count as covering it. */
const COVERAGE_SLACK_DAYS = 3;

const toT = (iso: string) => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);

export interface SparkWindow {
  start: number;
  end: number;
}

/** All pairs in one response share a window ending at the newest date any of them reached. */
export function windowOf(response: SparklineResponse): SparkWindow | null {
  let end = -Infinity;
  for (const series of Object.values(response.series)) {
    const last = series[series.length - 1];
    if (last) end = Math.max(end, toT(last.date));
  }
  return Number.isFinite(end) ? { start: end - (response.days - 1) * DAY, end } : null;
}

export interface SparkData {
  values: number[];
  times: number[];
  /** Percent change over the window - only when the data genuinely spans it,
   *  so a market with 5 days of data is never labelled "30-day change". */
  change: number | null;
}

export function sparkFor(series: SparklinePoint[], window: SparkWindow | null): SparkData {
  const times = series.map((p) => toT(p.date));
  const values = series.map((p) => p.price);
  const covers =
    window !== null &&
    times.length >= 2 &&
    times[0]! <= window.start + COVERAGE_SLACK_DAYS * DAY &&
    times[times.length - 1]! >= window.end - COVERAGE_SLACK_DAYS * DAY;
  return { values, times, change: covers ? percentChange(values) : null };
}
