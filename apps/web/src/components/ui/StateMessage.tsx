import type { ReactNode } from "react";

interface StateMessageProps {
  kind: "empty" | "error";
  title: string;
  children?: ReactNode;
  action?: { label: string; onClick: () => void };
  /** Tighter padding for use inside small panels. */
  compact?: boolean;
}

/**
 * One consistent treatment for empty and error states: what happened, what
 * it means, and (where there is one) what to do next. Errors are announced
 * to assistive tech via role="alert".
 */
export function StateMessage({ kind, title, children, action, compact = false }: StateMessageProps) {
  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      className={`flex flex-col items-center text-center ${compact ? "gap-1 px-4 py-6" : "gap-1.5 px-6 py-12"}`}
    >
      <p className={`text-sm font-medium ${kind === "error" ? "text-risk" : "text-ink"}`}>{title}</p>
      {children && <p className="max-w-md text-sm text-ink-muted">{children}</p>}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-2 rounded-md border border-line bg-paper-raised px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-paper-sunken"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
