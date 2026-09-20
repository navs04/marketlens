type BadgeTone = "stable" | "risk" | "neutral" | "pending";

const toneClasses: Record<BadgeTone, string> = {
  stable: "bg-stable-soft text-stable",
  risk: "bg-risk-soft text-risk",
  neutral: "bg-accent-soft text-accent-strong",
  pending: "bg-paper-sunken text-ink-muted",
};

export function Badge({ tone, children }: { tone: BadgeTone; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${toneClasses[tone]}`}
    >
      {children}
    </span>
  );
}
