import { percentChange } from "../../lib/chartData";

interface SparklineProps {
  values: number[];
  /** Epoch ms for each value. With `domain`, points are placed by real date, so
   *  a series covering only part of the window occupies only part of the width
   *  instead of being stretched to fill it. */
  times?: number[];
  domain?: [number, number];
  /** What the values represent, for the accessible label, e.g. "30-day price trend". */
  label: string;
  width?: number;
  height?: number;
}

/**
 * Tiny trend line drawn from real values. Hand-rolled SVG on purpose: a
 * charting library per table row would be heavy and unnecessary. The line
 * stays neutral; only the end point is tinted by direction, so a table of
 * them doesn't turn into a wall of color.
 */
export function Sparkline({ values, times, domain, label, width = 84, height = 26 }: SparklineProps) {
  if (values.length < 2) {
    return (
      <span className="text-xs text-ink-faint" title="Not enough recent data">
        —
      </span>
    );
  }

  const pad = 3;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const timeScaled = times !== undefined && domain !== undefined && domain[1] > domain[0] && times.length === values.length;
  const x = (i: number) =>
    timeScaled
      ? pad + ((times![i]! - domain![0]) / (domain![1] - domain![0])) * (width - pad * 2)
      : pad + (i / (values.length - 1)) * (width - pad * 2);
  const y = (v: number) => (span === 0 ? height / 2 : height - pad - ((v - min) / span) * (height - pad * 2));

  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const change = percentChange(values);
  const direction = change === null || Math.abs(change) < 0.5 ? "flat" : change > 0 ? "up" : "down";
  const endColor =
    direction === "up" ? "var(--color-risk)" : direction === "down" ? "var(--color-stable)" : "var(--color-ink-muted)";

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`${label}: ${direction}${change !== null ? `, ${change > 0 ? "+" : ""}${change.toFixed(1)}%` : ""}`}
      className="block"
    >
      <polyline points={points} fill="none" stroke="var(--color-ink-muted)" strokeWidth={1.25} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(values.length - 1)} cy={y(values[values.length - 1]!)} r={2.25} fill={endColor} />
    </svg>
  );
}
