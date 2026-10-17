interface Option<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}

/** Compact toggle group, used for chart ranges. Buttons expose aria-pressed
 *  so the selected state isn't conveyed by color alone. */
export function SegmentedControl<T extends string>({ options, value, onChange, ariaLabel }: SegmentedControlProps<T>) {
  return (
    <div role="group" aria-label={ariaLabel} className="inline-flex rounded-md border border-line bg-paper-sunken p-0.5">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={`min-w-10 rounded px-2.5 py-1 font-mono text-xs transition-colors ${
              selected
                ? "bg-paper-raised font-medium text-ink shadow-[0_0_0_1px_var(--color-line)]"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
