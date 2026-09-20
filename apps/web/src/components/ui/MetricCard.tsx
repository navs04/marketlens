import type { ReactNode } from "react";
import { Card } from "./Card";
import { Badge } from "./Badge";

interface MetricCardProps {
  label: string;
  emphasis?: boolean;
  /** Real value once implemented, e.g. "₹34.20" or "+6.4%" */
  value?: string;
  /** Small qualifier under the value, e.g. "per kg" or "vs. 30-day avg" */
  unit?: string;
  trend?: "up" | "down" | "flat";
  trendTone?: "stable" | "risk" | "neutral";
  /** When set, the card renders as an honest "not built yet" state instead
   *  of a fabricated number - e.g. "Milestone 2". Never mix this with `value`. */
  pendingMilestone?: string;
  helper?: ReactNode;
}

const trendGlyph: Record<NonNullable<MetricCardProps["trend"]>, string> = {
  up: "▲",
  down: "▼",
  flat: "→",
};

export function MetricCard({
  label,
  emphasis = false,
  value,
  unit,
  trend,
  trendTone = "neutral",
  pendingMilestone,
  helper,
}: MetricCardProps) {
  return (
    <Card emphasis={emphasis} className="p-5">
      <p className="text-xs font-medium text-ink-muted">{label}</p>

      {pendingMilestone ? (
        <>
          <p className="mt-2 font-mono text-3xl font-medium text-ink-faint">— —</p>
          <div className="mt-2 flex items-center gap-2">
            <Badge tone="pending">Ships in {pendingMilestone}</Badge>
          </div>
        </>
      ) : (
        <>
          <div className="mt-2 flex items-baseline gap-2">
            <p
              className={`font-mono text-3xl font-medium ${
                trendTone === "risk"
                  ? "text-risk"
                  : trendTone === "stable"
                    ? "text-stable"
                    : "text-ink"
              }`}
            >
              {trend ? `${trendGlyph[trend]} ` : ""}
              {value}
            </p>
            {unit && <span className="text-xs text-ink-muted">{unit}</span>}
          </div>
          {helper && <p className="mt-1 text-xs text-ink-muted">{helper}</p>}
        </>
      )}
    </Card>
  );
}
