import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";

const CHART_WIDTH = 800;
const CHART_HEIGHT = 260;
const PADDING = { top: 16, right: 16, bottom: 28, left: 44 };

// Placeholder axis labels only - not derived from any real series. Y-axis
// shows illustrative round numbers so the reader understands "this will be
// a price axis", not an implication that ₹40/₹30/₹20 are real figures.
const yTicks = ["₹40", "₹30", "₹20", "₹10"];
const xTicks = ["-30d", "-20d", "-10d", "Today", "+3d", "+7d"];

/**
 * Renders the STRUCTURE of the price trend chart - axes, gridlines, and a
 * legend distinguishing historical data (solid), forecast (dashed), and
 * anomaly markers - without drawing any line or data point, since no
 * ingestion has happened yet (Milestone 2) and no forecast model exists
 * (Milestone 5). Once real data lands this component's inner plot area
 * is what gets replaced with an actual series.
 */
export function PriceTrendChart() {
  const plotWidth = CHART_WIDTH - PADDING.left - PADDING.right;
  const plotHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;
  const todayX = PADDING.left + plotWidth * 0.6;

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-ink">Price trend</p>
          <p className="text-xs text-ink-muted">Last 30 days, with a 7-day forecast</p>
        </div>
        <Badge tone="pending">Ships in Milestone 2 &amp; 5</Badge>
      </div>

      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="w-full"
        role="img"
        aria-label="Price trend chart placeholder - no data ingested yet"
      >
        {/* gridlines + y-axis labels */}
        {yTicks.map((label, i) => {
          const y = PADDING.top + (plotHeight / (yTicks.length - 1)) * i;
          return (
            <g key={label}>
              <line
                x1={PADDING.left}
                x2={CHART_WIDTH - PADDING.right}
                y1={y}
                y2={y}
                stroke="var(--color-chart-grid)"
                strokeWidth={1}
              />
              <text
                x={PADDING.left - 10}
                y={y}
                textAnchor="end"
                dominantBaseline="middle"
                className="font-mono"
                fontSize={11}
                fill="var(--color-ink-faint)"
              >
                {label}
              </text>
            </g>
          );
        })}

        {/* x-axis labels */}
        {xTicks.map((label, i) => {
          const x = PADDING.left + (plotWidth / (xTicks.length - 1)) * i;
          return (
            <text
              key={label}
              x={x}
              y={CHART_HEIGHT - 8}
              textAnchor="middle"
              className="font-mono"
              fontSize={11}
              fill="var(--color-ink-faint)"
            >
              {label}
            </text>
          );
        })}

        {/* today marker, separating historical region from forecast region */}
        <line
          x1={todayX}
          x2={todayX}
          y1={PADDING.top}
          y2={PADDING.top + plotHeight}
          stroke="var(--color-line-strong)"
          strokeWidth={1}
          strokeDasharray="2 3"
        />

        {/* no line/curve is drawn here - intentionally, since there is no
            real series to plot yet */}
        <text
          x={CHART_WIDTH / 2}
          y={PADDING.top + plotHeight / 2}
          textAnchor="middle"
          className="font-sans"
          fontSize={12}
          fill="var(--color-ink-muted)"
        >
          Historical prices connect once ingestion runs (Milestone 2)
        </text>
      </svg>

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
