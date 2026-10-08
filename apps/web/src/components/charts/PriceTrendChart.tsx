import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import type { AnomalyFlagEntry, ForecastPoint, PriceObservation } from "../../api/types";

interface ChartRow {
  date: string;
  dateLabel: string;
  historical: number | null;
  forecast: number | null;
  forecastLower: number | null;
  forecastUpper: number | null;
  anomaly: number | null;
}

function formatDateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function buildRows(
  history: PriceObservation[],
  forecasts: ForecastPoint[],
  anomalies: AnomalyFlagEntry[],
): ChartRow[] {
  const anomalyDates = new Set(anomalies.filter((a) => a.isAnomaly).map((a) => a.date.slice(0, 10)));

  const historicalRows: ChartRow[] = history.map((obs) => ({
    date: obs.date,
    dateLabel: formatDateLabel(obs.date),
    historical: obs.price,
    forecast: null,
    forecastLower: null,
    forecastUpper: null,
    anomaly: anomalyDates.has(obs.date.slice(0, 10)) ? obs.price : null,
  }));

  // Bridge point: forecast series starts at the last historical point, so
  // the two lines connect visually instead of leaving a gap.
  const bridge: ChartRow[] =
    historicalRows.length > 0 && forecasts.length > 0
      ? [{ ...historicalRows[historicalRows.length - 1]!, forecast: historicalRows[historicalRows.length - 1]!.historical }]
      : [];

  const forecastRows: ChartRow[] = forecasts.map((f) => ({
    date: f.forecastDate,
    dateLabel: formatDateLabel(f.forecastDate),
    historical: null,
    forecast: f.predictedPrice,
    forecastLower: f.lowerBound,
    forecastUpper: f.upperBound,
    anomaly: null,
  }));

  return [...historicalRows, ...bridge, ...forecastRows];
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-md border border-line bg-paper-raised px-3 py-2 text-xs shadow-sm">
      <p className="mb-1 font-medium text-ink">{label}</p>
      {payload.map((entry) =>
        entry.value == null ? null : (
          <p key={entry.name} className="font-mono" style={{ color: entry.color }}>
            {entry.name}: ₹{Math.round(entry.value)}
          </p>
        ),
      )}
    </div>
  );
}

interface PriceTrendChartProps {
  history: PriceObservation[];
  forecasts: ForecastPoint[];
  anomalies: AnomalyFlagEntry[];
}

export function PriceTrendChart({ history, forecasts, anomalies }: PriceTrendChartProps) {
  const hasData = history.length > 0;
  const rows = buildRows(history, forecasts, anomalies);
  const todayLabel = history.length > 0 ? formatDateLabel(history[history.length - 1]!.date) : undefined;

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-ink">Price trend</p>
          <p className="text-xs text-ink-muted">
            {forecasts.length > 0
              ? `Historical modal price with a ${forecasts.length}-day forecast`
              : "Historical modal price"}
          </p>
        </div>
        {!hasData && <Badge tone="pending">No price history for this pair yet</Badge>}
      </div>

      {!hasData ? (
        <div className="flex h-64 items-center justify-center text-sm text-ink-muted">
          No ingested price observations for this market and commodity yet.
        </div>
      ) : (
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="var(--color-chart-grid)" vertical={false} />
              <XAxis
                dataKey="dateLabel"
                tick={{ fontFamily: "var(--font-mono)", fontSize: 11, fill: "var(--color-ink-faint)" }}
                axisLine={{ stroke: "var(--color-line)" }}
                tickLine={false}
                minTickGap={24}
              />
              <YAxis
                tick={{ fontFamily: "var(--font-mono)", fontSize: 11, fill: "var(--color-ink-faint)" }}
                axisLine={false}
                tickLine={false}
                width={48}
                tickFormatter={(v: number) => `₹${v}`}
              />
              <Tooltip content={<ChartTooltip />} />
              {todayLabel && (
                <ReferenceLine
                  x={todayLabel}
                  stroke="var(--color-line-strong)"
                  strokeDasharray="2 3"
                  label={{ value: "Today", position: "insideTopRight", fontSize: 10, fill: "var(--color-ink-muted)" }}
                />
              )}
              <Line
                type="monotone"
                dataKey="historical"
                name="Historical"
                stroke="var(--color-chart-historical)"
                strokeWidth={1.75}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="forecast"
                name="Forecast"
                stroke="var(--color-chart-forecast)"
                strokeWidth={1.75}
                strokeDasharray="5 4"
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
              <Scatter dataKey="anomaly" name="Anomaly" fill="var(--color-chart-anomaly)" isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="mt-3 flex items-center gap-5 border-t border-line pt-3 text-xs text-ink-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 bg-ink" /> Historical
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-0.5 w-4"
            style={{
              backgroundImage:
                "repeating-linear-gradient(90deg, var(--color-chart-forecast) 0 4px, transparent 4px 7px)",
            }}
          />
          Forecast
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-risk" /> Anomaly
        </span>
      </div>
    </Card>
  );
}
