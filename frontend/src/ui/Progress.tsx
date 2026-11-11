import { twMerge } from "tailwind-merge";

interface ProgressProps {
  // 0-100 of plan
  value: number;
  tone?: "live" | "recorded" | "paused";
  // seconds over plan relative to plan; turns the excess orange
  overRatio?: number;
  height?: number;
  label?: string;
  className?: string;
}

const fills = {
  live: "bg-live",
  recorded: "bg-ink",
  paused: "bg-amber-mid",
};

export const Progress = ({
  value,
  tone = "recorded",
  overRatio = 0,
  height = 8,
  label,
  className,
}: ProgressProps) => {
  const clamped = Math.max(0, Math.min(100, value));
  if (overRatio > 0) {
    // the bar fills, then the excess turns orange
    const plan = 1 / (1 + overRatio);
    return (
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={100}
        aria-valuemin={0}
        aria-valuemax={100}
        className={twMerge("flex gap-0.5", className)}
        style={{ height }}
      >
        <div className={`${fills[tone]} rounded-l-full`} style={{ flex: `${plan} 1 0` }} />
        <div className="rounded-r-full bg-over" style={{ flex: `${1 - plan} 1 0` }} />
      </div>
    );
  }
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={twMerge("rounded-full bg-track", className)}
      style={{ height }}
    >
      <div
        className={`h-full rounded-full ${fills[tone]} transition-[width] duration-200`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
};
