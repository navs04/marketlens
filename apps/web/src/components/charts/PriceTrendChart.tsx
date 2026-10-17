import { useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "../ui/Card";
import { SegmentedControl } from "../ui/SegmentedControl";
import { StateMessage } from "../ui/StateMessage";
import { buildChartModel, type ChartRow } from "../../lib/chartData";
import type { AnomalyFlagEntry, ForecastPoint, PriceRange, SeriesPoint } from "../../api/types";

const RANGE_OPTIONS: Array<{ value: PriceRange; label: string }> = [
  { value: "30D", label: "30D" },
  { value: "90D", label: "90D" },
  { value: "1Y", label: "1Y" },
];

const MONO = "var(--font-mono)";
const rupees = (v: number) => `₹${Math.round(v).toLocaleString("en-IN")}`;

const formatShort = (t: number, range: PriceRange) =>
  new Date(t).toLocaleDateString("en-IN", {
    timeZone: "UTC",
    day: range === "1Y" ? undefined : "numeric",
    month: "short",
    year: range === "1Y" ? "2-digit" : undefined,
  });

const formatLong = (t: number) =>
  new Date(t).toLocaleDateString("en-IN", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short", year: "numeric" });

/** Evenly spaced, day-aligned ticks - numeric axes otherwise pick "nice"
 *  numbers that land on arbitrary timestamps. */
function buildTicks(min: number, max: number, count: number): number[] {
  const DAY = 86_400_000;
  if (max <= min) return [min];
  const step = Math.max(DAY, Math.round((max - min) / (count - 1) / DAY) * DAY);
  const ticks: number[] = [];
  for (let t = min; t <= max; t += step) ticks.push(t);
  return ticks;
}

/** Anomaly marker: size scales with how far the price deviated from its
 *  expected value; filled red = above expected, hollow ring = below. */
function AnomalyDot(props: { cx?: number; cy?: number; payload?: ChartRow }) {
  const { cx, cy, payload } = props;
  if (typeof cx !== "number" || typeof cy !== "number" || !payload?.anomaly) return null;
  const deviation = payload.anomaly.deviationPct;
  const r = Math.min(6.5, 3.5 + Math.abs(deviation) / 15);
  const above = deviation > 0;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={r}
      fill={above ? "var(--color-chart-anomaly)" : "var(--color-paper-raised)"}
      stroke={above ? "var(--color-paper-raised)" : "var(--color-ink)"}
      strokeWidth={1.5}
    />
  );
}

function TooltipRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-6">
      <span className="text-ink-muted">{label}</span>
      <span className={`font-mono ${strong ? "font-medium text-ink" : "text-ink"}`}>{value}</span>
    </div>
  );
}

function ChartTooltip({ active, payload, subject }: { active?: boolean; payload?: Array<{ payload: ChartRow }>; subject: string }) {
  const row = active ? payload?.[0]?.payload : undefined;
  if (!row) return null;

  return (
    <div className="min-w-52 rounded-md border border-line bg-paper-raised px-3 py-2.5 text-xs shadow-sm">
      <p className="mb-1.5 font-medium text-ink">{formatLong(row.t)}</p>
      <div className="flex flex-col gap-0.5">
        {row.price !== null && <TooltipRow label="Actual price" value={rupees(row.price)} strong />}
        {row.range && <TooltipRow label="Min – max reported" value={`${rupees(row.range[0])} – ${rupees(row.range[1])}`} />}
        {row.isForecast && row.forecast !== null && <TooltipRow label="Forecast" value={rupees(row.forecast)} strong />}
        {row.forecastBand && (
          <>
            <TooltipRow label="Lower bound" value={rupees(row.forecastBand[0])} />
            <TooltipRow label="Upper bound" value={rupees(row.forecastBand[1])} />
          </>
        )}
      </div>
      {row.anomaly && (
        <div className="mt-2 border-t border-line pt-2">
          <p className="mb-0.5 font-medium text-risk">Unusual price</p>
          <p className="mb-1 text-ink-muted">{subject}</p>
          <TooltipRow label="Expected price" value={rupees(row.anomaly.expected)} />
          <TooltipRow
            label="Deviation"
            value={`${row.anomaly.deviationPct > 0 ? "+" : ""}${row.anomaly.deviationPct.toFixed(1)}%`}
            strong
          />
        </div>
      )}
      {row.isForecast && <p className="mt-2 text-ink-faint">Model estimate, not a guaranteed price.</p>}
    </div>
  );
}

interface PriceTrendChartProps {
  status: "loading" | "error" | "ready";
  /** True while a new range is loading; the previous chart stays visible, dimmed. */
  stale?: boolean;
  onRetry?: () => void;
  series: SeriesPoint[];
  forecasts: ForecastPoint[];
  anomalies: AnomalyFlagEntry[];
  range: PriceRange;
  onRangeChange: (range: PriceRange) => void;
  /** e.g. "Onion, Azadpur, Delhi" - shown in anomaly tooltips and the accessible label. */
  subject: string;
}

export function PriceTrendChart({
  status,
  stale = false,
  onRetry,
  series,
  forecasts,
  anomalies,
  range,
  onRangeChange,
  subject,
}: PriceTrendChartProps) {
  const [showRange, setShowRange] = useState(true);
  const model = useMemo(() => buildChartModel(series, forecasts, anomalies), [series, forecasts, anomalies]);

  const hasForecast = model.firstForecastT !== null;
  const hasRangeBand = model.rows.some((r) => r.range !== null);
  // Bounds can be absent on a forecast row; only claim a band if one is drawn.
  const hasForecastBand = model.rows.some((r) => r.forecastBand !== null);
  const hasData = series.length > 0;
  const firstT = model.rows[0]?.t;
  const lastT = model.rows[model.rows.length - 1]?.t;
  const ticks = useMemo(() => (firstT !== undefined && lastT !== undefined ? buildTicks(firstT, lastT, 6) : []), [firstT, lastT]);

  const prices = series.map((p) => p.price);
  const summary = hasData
    ? `Price chart for ${subject}. ${series.length} days of data, from ${rupees(Math.min(...prices))} to ${rupees(Math.max(...prices))}, latest ${rupees(prices[prices.length - 1]!)}.` +
      (hasForecast ? ` Includes a ${forecasts.length}-day forecast with uncertainty bounds.` : "") +
      (model.anomalyCount > 0 ? ` ${model.anomalyCount} unusual price days flagged.` : "")
    : `Price chart for ${subject}: no data.`;

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-ink">Price trend</h2>
          <p className="text-xs text-ink-muted">
            {hasForecast
              ? `Daily average price with a ${forecasts.length}-day forecast`
              : "Daily average price across reported varieties"}
          </p>
        </div>
        <SegmentedControl options={RANGE_OPTIONS} value={range} onChange={onRangeChange} ariaLabel="Chart time range" />
      </div>

      {status === "loading" ? (
        <div className="h-72 animate-pulse rounded-md bg-paper-sunken sm:h-80" aria-busy="true" aria-label="Loading chart" />
      ) : status === "error" ? (
        <StateMessage kind="error" title="Couldn't load the price history" action={onRetry ? { label: "Try again", onClick: onRetry } : undefined}>
          The data service didn't respond. Check that the API is running, then try again.
        </StateMessage>
      ) : !hasData ? (
        <StateMessage kind="empty" title="No price history for this market and commodity">
          Not every market reports every commodity. Try another market from the selector above, or open the Compare page to see which markets report this one.
        </StateMessage>
      ) : (
        <div className={`h-72 w-full transition-opacity duration-150 sm:h-80 ${stale ? "opacity-50" : "opacity-100"}`} role="img" aria-label={summary}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={model.rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="var(--color-chart-grid)" vertical={false} />
              <XAxis
                dataKey="t"
                type="number"
                scale="time"
                domain={["dataMin", "dataMax"]}
                ticks={ticks}
                tickFormatter={(t: number) => formatShort(t, range)}
                tick={{ fontFamily: MONO, fontSize: 11, fill: "var(--color-ink-faint)" }}
                axisLine={{ stroke: "var(--color-line)" }}
                tickLine={false}
                tickMargin={6}
              />
              <YAxis
                domain={model.yDomain ?? ["auto", "auto"]}
                tick={{ fontFamily: MONO, fontSize: 11, fill: "var(--color-ink-faint)" }}
                axisLine={false}
                tickLine={false}
                width={56}
                tickFormatter={(v: number) => rupees(v)}
              />
              <Tooltip
                content={<ChartTooltip subject={subject} />}
                cursor={{ stroke: "var(--color-line-strong)", strokeWidth: 1 }}
                isAnimationActive={false}
              />

              {hasForecast && model.lastHistoricalT !== null && lastT !== undefined && (
                <ReferenceArea
                  x1={model.lastHistoricalT}
                  x2={lastT}
                  fill="var(--color-chart-forecast)"
                  fillOpacity={0.05}
                  stroke="none"
                  ifOverflow="visible"
                />
              )}
              {model.lastHistoricalT !== null && hasForecast && (
                <ReferenceLine
                  x={model.lastHistoricalT}
                  stroke="var(--color-line-strong)"
                  strokeDasharray="2 3"
                  label={{ value: "Latest data", position: "insideTopLeft", fontSize: 10, fill: "var(--color-ink-muted)" }}
                />
              )}

              {showRange && hasRangeBand && (
                <Area
                  dataKey="range"
                  type="monotone"
                  stroke="none"
                  fill="var(--color-chart-historical)"
                  fillOpacity={0.07}
                  connectNulls={false}
                  isAnimationActive={false}
                  activeDot={false}
                />
              )}
              {hasForecastBand && (
                <Area
                  dataKey="forecastBand"
                  type="monotone"
                  stroke="none"
                  fill="var(--color-chart-forecast)"
                  fillOpacity={0.18}
                  connectNulls={false}
                  isAnimationActive={false}
                  activeDot={false}
                />
              )}

              <Line
                dataKey="price"
                type="monotone"
                stroke="var(--color-chart-historical)"
                strokeWidth={1.75}
                dot={false}
                activeDot={{ r: 3.5, fill: "var(--color-chart-historical)", stroke: "var(--color-paper-raised)", strokeWidth: 1.5 }}
                connectNulls={false}
                isAnimationActive={false}
              />
              {hasForecast && (
                <Line
                  dataKey="forecast"
                  type="monotone"
                  stroke="var(--color-chart-forecast)"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  dot={false}
                  activeDot={{ r: 3.5, fill: "var(--color-chart-forecast)", stroke: "var(--color-paper-raised)", strokeWidth: 1.5 }}
                  connectNulls
                  isAnimationActive={false}
                />
              )}
              {/* Anomaly markers: an invisible line whose only job is to host custom dots. */}
              <Line dataKey="anomalyPrice" stroke="none" dot={<AnomalyDot />} activeDot={false} legendType="none" isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-3 text-xs text-ink-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 bg-ink" /> Actual
        </span>
        {hasRangeBand && (
          <button
            type="button"
            aria-pressed={showRange}
            onClick={() => setShowRange((v) => !v)}
            className={`flex items-center gap-1.5 rounded px-1 py-0.5 transition-colors hover:text-ink ${showRange ? "" : "opacity-60"}`}
            title="Toggle the min–max range reported across varieties"
          >
            <span className="inline-block h-2.5 w-4 rounded-sm bg-ink/10" /> Min–max range
          </button>
        )}
        {hasForecast && (
          <>
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block h-0.5 w-4"
                style={{ backgroundImage: "repeating-linear-gradient(90deg, var(--color-chart-forecast) 0 4px, transparent 4px 7px)" }}
              />
              Forecast
            </span>
            {hasForecastBand && (
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-4 rounded-sm bg-chart-forecast/20" /> Uncertainty band
              </span>
            )}
          </>
        )}
        {model.anomalyCount > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-risk" /> Above expected
            <span className="ml-2 inline-block h-2.5 w-2.5 rounded-full border-[1.5px] border-ink bg-paper-raised" /> Below expected
          </span>
        )}
      </div>
    </Card>
  );
}
