import type { Trace, TraceSegment } from "../sei/view/trace";
import { formatDuration, formatHM, formatTime } from "../utils";

const SHADES = ["bg-ink", "bg-ink-2", "bg-muted"] as const;

const segmentClass = (s: TraceSegment) => {
  switch (s.kind) {
    case "focus":
      return SHADES[s.shade];
    case "live":
      return "bg-live";
    case "paused":
      return "hatch-paused";
    case "inferred":
      return "hatch-inferred";
    case "gap":
      return "bg-track";
    case "planned":
      return "border border-dashed border-planned";
  }
};

const describeSegment = (s: TraceSegment) => {
  const d = formatDuration(s.seconds);
  switch (s.kind) {
    case "focus":
    case "live":
      return `${s.title ?? "Task"}: ${d} focus`;
    case "paused":
      return `Paused ${d}`;
    case "inferred":
      return `Waiting ${d} (inferred)`;
    case "gap":
      return `${d} not covered by events`;
    case "planned":
      return `${s.title ?? "Task"}: ${d} planned`;
  }
};

// Plain-language summary for screen readers, since the strip is a picture.
const summarize = (trace: Trace) => {
  const sum = (kind: TraceSegment["kind"][]) =>
    trace.segments.filter((s) => kind.includes(s.kind)).reduce((a, s) => a + s.seconds, 0);
  const parts = [
    `${formatDuration(sum(["focus", "live"]))} focus`,
    sum(["paused"]) > 0 && `${formatDuration(sum(["paused"]))} paused`,
    sum(["inferred"]) > 0 && `${formatDuration(sum(["inferred"]))} inferred waiting`,
    sum(["planned"]) > 0 && `${formatDuration(sum(["planned"]))} still planned`,
  ].filter(Boolean);
  return `Execution trace: ${parts.join(", ")}`;
};

interface TraceStripProps {
  trace: Trace;
  height?: number;
  labels?: boolean;
  axis?: boolean;
}

// The signature element: wall-clock time, left to right.
export const TraceStrip = ({ trace, height = 10, labels = false, axis = false }: TraceStripProps) => {
  const { segments, totalSec, startedAt, budgetAtSec } = trace;
  if (segments.length === 0 || totalSec <= 0) {
    return <div className="rounded bg-track" style={{ height }} aria-hidden="true" />;
  }
  const budgetPct =
    budgetAtSec !== null && budgetAtSec < totalSec ? (budgetAtSec / totalSec) * 100 : null;
  // a short block needs seconds, or every tick reads the same minute
  const stamp = totalSec < 15 * 60 ? formatTime : formatHM;
  const at = (sec: number) =>
    startedAt ? stamp(new Date(Date.parse(startedAt) + sec * 1000).toISOString()) : "";
  const ticks = startedAt
    ? [0, 0.25, 0.5, 0.75, 1].map((f) => ({ f, label: at(totalSec * f) }))
    : [];

  return (
    <div className="flex flex-col gap-2">
      <div className="relative flex gap-0.5" style={{ height }} role="img" aria-label={summarize(trace)}>
        {segments.map((s, i) => (
          <div
            key={i}
            title={describeSegment(s)}
            className={`${segmentClass(s)} box-border flex min-w-[2px] items-center overflow-hidden whitespace-nowrap px-2 text-[11px] font-semibold ${
              s.kind === "focus" || s.kind === "live" ? "text-white" : "text-amber"
            } ${i === 0 ? "rounded-l" : ""} ${i === segments.length - 1 ? "rounded-r" : ""}`}
            style={{ flex: `${s.seconds} 1 0` }}
          >
            {labels && s.title && (s.kind === "focus" || s.kind === "live") && s.seconds / totalSec > 0.12
              ? s.title
              : labels && s.kind === "paused" && s.seconds / totalSec > 0.08
                ? "paused"
                : null}
          </div>
        ))}
        {budgetPct !== null && (
          <div
            className="absolute -top-1.5 -bottom-1.5 w-0.5 bg-over"
            style={{ left: `${budgetPct}%` }}
            aria-hidden="true"
          />
        )}
      </div>
      {axis && ticks.length > 0 && (
        <div className="flex justify-between font-mono text-[11px] text-muted" aria-hidden="true">
          {ticks.map((t) => (
            <span key={t.f}>{t.label}</span>
          ))}
        </div>
      )}
    </div>
  );
};

export const TraceLegend = ({ items }: { items: Array<"focus" | "live" | "paused" | "inferred" | "planned" | "over"> }) => {
  const swatch: Record<string, string> = {
    focus: "bg-ink",
    live: "bg-live",
    paused: "hatch-paused",
    inferred: "hatch-inferred",
    planned: "border border-dashed border-planned",
    over: "bg-over",
  };
  const text: Record<string, string> = {
    focus: "Focus",
    live: "Live",
    paused: "Paused",
    inferred: "Inferred",
    planned: "Planned",
    over: "Budget ends",
  };
  return (
    <div className="flex flex-wrap gap-3.5 text-xs text-ink-2">
      {items.map((k) => (
        <span key={k} className="flex items-center gap-1.5">
          <span className={`box-border h-2 w-3 rounded-sm ${swatch[k]}`} aria-hidden="true" />
          {text[k]}
        </span>
      ))}
    </div>
  );
};
