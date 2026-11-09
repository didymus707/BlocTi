import { formatClock, formatDuration } from "../../utils";

interface TimeProgressProps {
  label?: string;
  elapsed: number; // seconds
  planned: number; // seconds
  remaining?: number; // seconds
  progress: number; // 0-100
  overrun?: number; // seconds past the plan
  variant?: "session" | "task" | "total";
}

export const TimeProgress = ({
  elapsed,
  remaining,
  planned,
  progress,
  overrun = 0,
  label = "Block Progress",
  variant = "total",
}: TimeProgressProps) => {
  const clamped = Math.max(0, Math.min(100, progress));
  return (
    <div className="mt-8" aria-label={label}>
      <div className="flex justify-between items-center">
        <p className="font-medium text-gray-700 mb-2">{label}</p>
        <span className="text-sm text-gray-500">{Math.round(clamped)}%</span>
      </div>

      <div className="w-full h-2 bg-gray-200 rounded-full my-2">
        <div
          className={`h-full rounded-full transition-all ${overrun > 0 ? "bg-red-600" : "bg-black"}`}
          style={{ width: `${clamped}%` }}
        />
      </div>

      <div className="text-sm text-gray-500 flex justify-between">
        <span>Elapsed: {formatClock(elapsed)}</span>
        {variant !== "total" && overrun > 0 ? (
          <span className="text-red-600">Over by {formatClock(overrun)}</span>
        ) : (
          variant !== "total" &&
          remaining !== undefined && <span>Remaining: {formatClock(remaining)}</span>
        )}
        <span>Planned: {formatDuration(planned)}</span>
      </div>
    </div>
  );
};

// elapsed: focus time spent in a context (overall, session, task)
// planned: time planned for that context
// remaining: planned time left in a session or task
