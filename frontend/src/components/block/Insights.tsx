import type { SeiEvent } from "../../sei/domain/events";
import { orderedTaskStates, type BlockExecutionProjection } from "../../sei/domain/projection";
import type { BlockView } from "../../sei/session/seiSessionContext";
import { completionNote, driftInsight, orderNote, timeAccuracyNote } from "../../sei/view/explain";
import { buildTrace } from "../../sei/view/trace";
import { MetricTile } from "../../ui/MetricTile";
import { TraceLegend, TraceStrip } from "../../ui/TraceStrip";
import { formatDuration, formatPercent, formatSignedDuration, formatTime } from "../../utils";
import { Panel } from "../layout/Page";

const Bar = ({ value }: { value: number }) => (
  <div className="h-1.5 rounded-full bg-track">
    <div className="h-full rounded-full bg-ink" style={{ width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%` }} />
  </div>
);

export const TraceCard = ({ view, now, agent = false }: { view: BlockView; now: string; agent?: boolean }) => {
  const trace = buildTrace(view.projection, now, { includePlan: !agent });
  const isLive = view.projection.status === "running" || view.projection.status === "paused";
  return (
    <Panel
      title={agent ? "Session trace" : "Execution trace"}
      aside={
        <TraceLegend
          items={
            agent
              ? ["focus", "inferred"]
              : isLive
                ? ["focus", "live", "paused", "planned"]
                : ["focus", "paused", ...(trace.budgetAtSec !== null && trace.budgetAtSec < trace.totalSec ? (["over"] as const) : [])]
          }
        />
      }
    >
      <TraceStrip trace={trace} height={32} labels axis />
    </Panel>
  );
};

// Right-hand column while a block runs: every value is "so far".
export const LiveMetrics = ({ view }: { view: BlockView }) => {
  const { metrics, projection } = view;
  const f = metrics.fidelity;
  const budgetLeft = projection.plannedSec - metrics.wallClockSec;
  return (
    <aside aria-label="Live metrics" className="flex flex-col gap-[18px] rounded-section border border-line bg-surface p-5">
      <div className="flex items-center justify-between">
        <h2 className="m-0 text-[15px] font-semibold">Live metrics</h2>
        <span className="text-[11px] text-muted">so far</span>
      </div>
      <div role="group" aria-label="Focus" className="flex flex-col gap-1">
        <span className="label-caps">Focus</span>
        <span className="font-mono text-2xl font-medium tabular">
          {formatDuration(metrics.focusSec)} <span className="text-sm text-muted">/ {formatDuration(metrics.plannedFocusSec)}</span>
        </span>
      </div>
      <dl className="m-0 grid grid-cols-2 gap-3.5">
        {[
          ["Wall clock", formatDuration(metrics.wallClockSec), false],
          ["Paused", `${formatDuration(metrics.pauseSec)}${projection.pauseCount ? ` · ${projection.pauseCount}×` : ""}`, false],
          [budgetLeft >= 0 ? "Budget left" : "Over budget", formatDuration(Math.abs(budgetLeft)), budgetLeft < 0],
          ["Focus variance", formatSignedDuration(metrics.focusVarianceSec ?? 0), (metrics.focusVarianceSec ?? 0) >= 60],
        ].map(([label, value, over]) => (
          <div key={label as string} role="group" aria-label={label as string} className="flex flex-col gap-0.5">
            <dt className="text-xs text-muted">{label}</dt>
            <dd className={`m-0 font-mono text-base tabular ${over ? "text-over" : ""}`}>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="h-px bg-line" />
      {f && (
        <div role="group" aria-label="Fidelity so far" className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <span className="label-caps">Fidelity so far</span>
            <span className="font-mono text-xl font-medium">{formatPercent(f.score)}</span>
          </div>
          {[
            ["Completion", f.completion],
            ["Time accuracy", f.timeAccuracy],
            ["Order", f.sequence],
          ].map(([label, value]) => (
            <div key={label as string} className="flex items-center gap-2.5 text-xs text-ink-2">
              <span className="w-24 shrink-0">{label}</span>
              <div className="flex-1">
                <Bar value={value as number} />
              </div>
              <span className="w-10 text-right font-mono">{formatPercent(value as number)}</span>
            </div>
          ))}
          <p className="m-0 text-xs leading-relaxed text-muted">
            Final when the block ends. Completion is weighted by planned time.
          </p>
        </div>
      )}
    </aside>
  );
};

export const PlanSummary = ({ view }: { view: BlockView }) => {
  const { projection, metrics } = view;
  const diff = projection.plannedSec - metrics.plannedFocusSec;
  return (
    <aside aria-label="Plan summary" className="flex flex-col gap-4 rounded-section border border-line bg-surface p-5">
      <h2 className="m-0 text-[15px] font-semibold">Plan</h2>
      <dl className="m-0 grid grid-cols-2 gap-3.5">
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs text-muted">Budget</dt>
          <dd className="m-0 font-mono text-base">{formatDuration(projection.plannedSec)}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs text-muted">Tasks</dt>
          <dd className="m-0 font-mono text-base">{formatDuration(metrics.plannedFocusSec)}</dd>
        </div>
      </dl>
      <p className={`m-0 text-xs leading-relaxed ${diff < 0 ? "text-over" : "text-muted"}`}>
        {diff === 0
          ? "The tasks fill the budget exactly."
          : diff > 0
            ? `${formatDuration(diff)} of the budget has no task yet.`
            : `The tasks need ${formatDuration(-diff)} more than the budget.`}
      </p>
    </aside>
  );
};

export const FidelityCard = ({ view }: { view: BlockView }) => {
  const f = view.metrics.fidelity;
  if (!f) return null;
  const { projection } = view;
  return (
    <section aria-label="Fidelity" className="flex flex-col gap-5 rounded-section border border-line bg-surface p-6 sm:p-7">
      <div className="flex flex-wrap items-end gap-7">
        <div className="flex flex-col gap-1.5">
          <h2 className="label-caps m-0">Fidelity</h2>
          <span data-testid="fidelity-score" className="font-mono text-6xl font-medium leading-none tracking-[-0.04em] sm:text-7xl">
            {formatPercent(f.score)}
          </span>
        </div>
        <p className="m-0 flex-[1_1_240px] text-sm leading-relaxed text-ink-2">
          How closely execution followed the plan. Completion sets the ceiling; straying from planned time and order can take
          up to half of it away.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2.5 rounded-[10px] bg-paper px-4 py-3.5 font-mono text-[13px] text-ink-2">
        <span className="font-semibold text-ink">{formatPercent(f.completion)}</span>
        <span>completion</span>
        <span>×</span>
        <span>(50% + 50% ×</span>
        <span className="font-semibold text-ink">{formatPercent(f.adherence)}</span>
        <span>adherence)</span>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          ["Completion", f.completion, completionNote(projection)],
          ["Time accuracy", f.timeAccuracy, timeAccuracyNote(projection)],
          ["Order", f.sequence, orderNote(projection)],
        ].map(([label, value, note]) => (
          <div key={label as string} className="flex flex-col gap-2">
            <div className="flex justify-between text-[13px]">
              <span className="font-semibold">{label}</span>
              <span className="font-mono">{formatPercent(value as number)}</span>
            </div>
            <Bar value={value as number} />
            <span className="text-xs leading-snug text-muted">{note}</span>
          </div>
        ))}
      </div>
    </section>
  );
};

export const TimeTiles = ({ view }: { view: BlockView }) => {
  const { metrics, projection } = view;
  const drift = metrics.executionDriftSec ?? 0;
  const variance = metrics.focusVarianceSec ?? 0;
  const insight = driftInsight(metrics);
  return (
    <section aria-label="Time" className="grid grid-cols-2 content-start gap-3 sm:grid-cols-4 xl:grid-cols-2">
      <MetricTile size="sm" label="Execution drift" value={formatSignedDuration(drift)} tone={drift >= 60 ? "over" : "default"} hint="wall clock vs budget" />
      <MetricTile size="sm" label="Focus variance" value={formatSignedDuration(variance)} tone={variance >= 60 ? "over" : "default"} hint="done tasks vs estimate" />
      <MetricTile size="sm" label="Focus" value={formatDuration(metrics.focusSec)} hint={`of ${formatDuration(metrics.plannedFocusSec)} planned`} />
      <MetricTile
        size="sm"
        label="Paused"
        value={formatDuration(metrics.pauseSec)}
        hint={`${projection.pauseCount} pause${projection.pauseCount === 1 ? "" : "s"} · ${
          metrics.inferredPauseSec > 0 ? `${formatDuration(metrics.inferredPauseSec)} inferred` : "all observed"
        }`}
      />
      {metrics.unaccountedSec >= 60 && (
        <MetricTile size="sm" label="Unaccounted" value={formatDuration(metrics.unaccountedSec)} hint="no events cover this time" className="col-span-2" />
      )}
      {insight && <p className="col-span-full m-0 text-xs leading-relaxed text-ink-2">{insight}</p>}
    </section>
  );
};

export const PlanVsActual = ({ projection }: { projection: BlockExecutionProjection }) => {
  const tasks = orderedTaskStates(projection);
  const scale = Math.max(1, ...tasks.map((t) => Math.max(t.plannedSec, t.elapsedSec))) * 1.05;
  const pct = (sec: number) => `${(sec / scale) * 100}%`;
  return (
    <Panel title="Plan vs actual" aside={<TraceLegend items={["planned", "focus"]} />}>
      <div className="grid grid-cols-[minmax(110px,1fr)_minmax(0,4fr)_auto] items-center gap-x-5 gap-y-3 text-[13px]">
        {tasks.map((t) => {
          const delta = t.status === "completed" && t.plannedSec > 0 ? t.elapsedSec - t.plannedSec : null;
          return (
            <div key={t.taskId} className="contents">
              <span className={`truncate font-medium ${t.status === "skipped" ? "text-muted" : ""}`}>{t.title}</span>
              <div className="flex flex-col gap-1">
                <div className="box-border h-2 rounded-[3px] border border-dashed border-faint" style={{ width: pct(t.plannedSec) }} />
                {t.elapsedSec > 0 ? (
                  <div className="h-2 rounded-[3px] bg-ink" style={{ width: pct(t.elapsedSec) }} />
                ) : (
                  <span className="text-[11px] leading-2 text-muted">{t.status === "skipped" ? "skipped, never started" : "not started"}</span>
                )}
              </div>
              <span className="whitespace-nowrap text-right font-mono text-ink-2">
                {t.elapsedSec > 0 ? formatDuration(t.elapsedSec) : "—"} / {formatDuration(t.plannedSec)}{" "}
                {delta !== null && Math.abs(delta) >= 60 && (
                  <strong className={delta > 0 ? "text-over" : "text-ink"}>{formatSignedDuration(delta)}</strong>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </Panel>
  );
};

const describe = (event: SeiEvent, projection: BlockExecutionProjection) => {
  const title = (id: string) => projection.taskStates[id as keyof typeof projection.taskStates]?.title ?? id;
  switch (event.type) {
    case "BlockPlanned":
      return `${event.tasks.length} task${event.tasks.length === 1 ? "" : "s"} · ${formatDuration(event.plannedDuration)} budget`;
    case "TaskStarted":
    case "TaskResumed":
    case "TaskCompleted":
    case "TaskSkipped":
      return title(event.taskId);
    case "TaskPaused":
      return event.reason ? `${title(event.taskId)} · ${event.reason}` : title(event.taskId);
    case "TaskSwitched":
      return `${title(event.fromTaskId)} → ${title(event.toTaskId)}`;
    case "SessionTerminated":
      return event.reason.replace("_", " ");
    case "BlockPaused":
    case "BlockResumed":
      return event.reason ?? "";
    default:
      return "";
  }
};

const LOG_COLS = "grid grid-cols-[44px_84px_150px_minmax(0,1fr)_150px] gap-3";

export const EventLog = ({ view }: { view: BlockView }) => {
  const ordered = [...view.events].sort((a, b) => a.seq - b.seq);
  return (
    <section aria-label="Event log" className="overflow-hidden rounded-section border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3.5">
        <h2 className="m-0 text-[15px] font-semibold">Event log</h2>
        <span className="text-xs text-muted">{ordered.length} events, in the order the server stored them</span>
      </div>
      <div className="overflow-x-auto">
        <ol aria-label="Event trace" className="m-0 min-w-[680px] list-none p-0 font-mono text-xs">
          <li className={`${LOG_COLS} label-caps border-b border-divider px-5 py-2.5 font-sans`} aria-hidden="true">
            <span>#</span>
            <span>Time</span>
            <span>Event</span>
            <span>Detail</span>
            <span>Provenance</span>
          </li>
          {ordered.map((e) => (
            <li key={e.eventId} className={`${LOG_COLS} border-b border-[#f5f5f3] px-5 py-2 last:border-b-0`}>
              <span className="text-faint">{e.seq}</span>
              <span className="text-ink-2">{formatTime(e.occurredAt)}</span>
              <span className="font-semibold">{e.type}</span>
              <span className="truncate text-ink-2">{describe(e, view.projection)}</span>
              <span className="text-muted">
                {e.actor} · {e.source}
                {e.evidence === "inferred" ? " · inferred" : ""}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
};

