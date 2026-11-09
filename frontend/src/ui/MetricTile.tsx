import type { ReactNode } from "react";
import { twMerge } from "tailwind-merge";

interface MetricTileProps {
  label: ReactNode;
  // accessible name; defaults to the label when it is plain text
  name?: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "over";
  dashed?: boolean;
  size?: "md" | "sm";
  className?: string;
}

// Label above, number, then what it is compared against.
export const MetricTile = ({
  label,
  name,
  value,
  hint,
  tone = "default",
  dashed,
  size = "md",
  className,
}: MetricTileProps) => (
  <div
    aria-label={name ?? (typeof label === "string" ? label : undefined)}
    role="group"
    className={twMerge(
      "flex flex-col gap-1.5 rounded-tile border bg-surface",
      dashed ? "border-dashed border-line-strong" : "border-line",
      size === "md" ? "px-5 py-[18px]" : "p-4",
      className,
    )}
  >
    <span className="label-caps flex items-center gap-2">{label}</span>
    <span
      className={twMerge(
        "font-mono font-medium tracking-tight tabular",
        size === "md" ? "text-[28px] leading-9" : "text-2xl",
        tone === "over" && "text-over",
      )}
    >
      {value}
    </span>
    {hint && <span className="text-xs text-muted">{hint}</span>}
  </div>
);
