import { formatHM, formatMmSs } from "../../utils";

interface TimeProgressProps {
  label?: string;
  elapsed: number;
  planned: number;
  remaining?: number;
  progress: number;
  variant?: "session" | "task" | "total";
}

export const TimeProgress = ({
  elapsed,
  remaining,
  planned,
  progress,
  label = "Block Progress",
  variant = "total",
}: TimeProgressProps) => {
  return (
    <div className="mt-8">
      <div className="flex justify-between items-center">
        <p className="font-medium text-gray-700 mb-2">{label}</p>
        <span className="text-sm text-gray-500">{Math.round(progress)}%</span>
      </div>

      {/* Placeholder for now */}
      <div className="w-full h-2 bg-gray-200 rounded-full my-2">
        <div
          className="h-full bg-black rounded-full transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="text-sm text-gray-500 flex justify-between">
        <span>Elapsed: {formatMmSs(elapsed)}</span>
        {variant !== "total" && remaining !== undefined && (
          <span>Remaining: {formatMmSs(remaining)}</span>
        )}
        <span>Planned: {formatHM(planned / 60)}</span>
      </div>
    </div>
  );
};

// elapsed: time used or spent in minutes in a time context(overall, session, task)
// planned: total time planned for the all the sessions in hours and minutes
// remaining: time left in a session or task in minutes
