import { Card } from "../components/ui/Card";

export function Alerts() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">Alerts</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Get notified when a price crosses a threshold or spike risk rises.
        </p>
      </div>

      <Card className="flex flex-col items-center gap-3 p-12 text-center">
        <p className="text-sm font-medium text-ink">No alerts configured</p>
        <p className="max-w-sm text-sm text-ink-muted">
          Alerting needs user accounts, which are out of scope for this MVP. The{" "}
          <code className="font-mono text-xs text-ink-muted">Alert</code> and{" "}
          <code className="font-mono text-xs text-ink-muted">User</code> tables already exist in
          the schema for when this is built.
        </p>
        <button
          type="button"
          disabled
          className="mt-2 cursor-not-allowed rounded-md border border-line bg-paper-sunken px-3 py-1.5 text-sm font-medium text-ink-faint"
        >
          Create alert
        </button>
      </Card>
    </div>
  );
}
