interface FilterTabsProps<T extends string> {
  label: string;
  value: T;
  options: Array<{ value: T; label: string; count: number }>;
  onChange: (value: T) => void;
}

export function FilterTabs<T extends string>({ label, value, options, onChange }: FilterTabsProps<T>) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 rounded-[10px] bg-track p-1">
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(o.value)}
            className={`h-8 rounded-[7px] px-3 text-[13px] ${
              selected ? "bg-surface font-semibold text-ink shadow-[0_1px_2px_rgba(17,17,19,0.08)]" : "font-medium text-ink-2 hover:text-ink"
            }`}
          >
            {o.label} <span className="font-mono text-xs">{o.count}</span>
          </button>
        );
      })}
    </div>
  );
}
