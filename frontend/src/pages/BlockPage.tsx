import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { AddTaskDialog } from "../components/blocks/AddTaskDialog";
import { DeleteBlockButton, ExportTraceButton } from "../components/block/BlockActions";
import { useRunAgain } from "../components/block/useRunAgain";
import { CurrentTaskCard, ReadyCard } from "../components/block/CurrentTask";
import {
  EventLog,
  FidelityCard,
  LiveMetrics,
  PlanSummary,
  PlanVsActual,
  TimeTiles,
  TraceCard,
} from "../components/block/Insights";
import { PlanList } from "../components/block/PlanList";
import { EmptyState, Page, PageHeader } from "../components/layout/Page";
import { useBlockUI } from "../context/blockUIContext";
import { orderedTaskStates } from "../sei/domain/projection";
import { useSeiSession, type BlockView } from "../sei/session/seiSessionContext";
import { useSeiStore } from "../sei/store/seiStoreContext";
import { Button } from "../ui/Button";
import { ExpandIcon, InfoIcon } from "../ui/icons";
import { MetricTile } from "../ui/MetricTile";
import { Chip, StatusChip } from "../ui/StatusChip";
import { TaskStateIcon } from "../ui/TaskStateIcon";
import { formatDuration, formatHM, formatPercent } from "../utils";

const timeRange = (view: BlockView) => {
  const { startedAt, completedAt, terminatedAt } = view.projection;
  if (!startedAt) return null;
  const end = completedAt ?? terminatedAt;
  return `${formatHM(startedAt)} – ${end ? formatHM(end) : "now"}`;
};

const RunningView = ({ view }: { view: BlockView }) => {
  const navigate = useNavigate();
  const { openEditModal } = useBlockUI();
  const { actionsFor, now } = useSeiSession();
  const [adding, setAdding] = useState(false);
  const { block, projection } = view;
  const actions = actionsFor(block.id);
  const isLive = projection.status === "running" || projection.status === "paused";
  const count = projection.taskOrder.length;

  const meta = isLive
    ? `Started ${formatHM(projection.startedAt!)} · ${formatDuration(projection.plannedSec)} budget · ${count} task${count === 1 ? "" : "s"} · plan snapshotted at start`
    : `${count} task${count === 1 ? "" : "s"} · ${formatDuration(projection.plannedSec)} budget · not started`;

  return (
    <Page>
      <PageHeader
        back={{ to: "/blocks", label: "Blocks" }}
        title={block.name}
        chip={<StatusChip projection={projection} />}
        meta={meta}
        actions={
          <>
            <Button size="sm" onClick={() => openEditModal(block.id)}>
              Edit plan
            </Button>
            {isLive && (
              <Button size="sm" icon={<ExpandIcon size={15} />} onClick={() => navigate(`/focus/${block.id}`)}>
                Focus mode
              </Button>
            )}
            <DeleteBlockButton view={view} />
          </>
        }
      />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-w-0 flex-col gap-6">
          {isLive ? <CurrentTaskCard view={view} actions={actions} /> : <ReadyCard view={view} actions={actions} />}
          <PlanList view={view} actions={actions} onAddTask={() => setAdding(true)} />
          {isLive && <TraceCard view={view} now={now} />}
        </div>
        {isLive ? <LiveMetrics view={view} /> : <PlanSummary view={view} />}
      </div>
      {adding && (
        <AddTaskDialog
          view={view}
          onClose={() => setAdding(false)}
          onPlanChanged={() => {
            if (isLive) actions.replan();
          }}
        />
      )}
    </Page>
  );
};

const ReportView = ({ view }: { view: BlockView }) => {
  const { openEditModal } = useBlockUI();
  const { now } = useSeiSession();
  const runAgain = useRunAgain(view);
  const { block, projection, metrics, events } = view;
  const stopped = projection.status === "terminated";

  return (
    <Page>
      <PageHeader
        back={{ to: "/reports", label: "Reports" }}
        title={block.name}
        chip={<StatusChip projection={projection} />}
        meta={[
          timeRange(view),
          `${formatDuration(metrics.wallClockSec)} wall clock against a ${formatDuration(projection.plannedSec)} budget`,
          `${events.length} events`,
          stopped && `stopped: ${projection.terminationReason?.replace("_", " ")}`,
        ]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <>
            <Button size="sm" variant="quiet" onClick={() => openEditModal(block.id)}>
              Edit plan
            </Button>
            <DeleteBlockButton view={view} />
            <ExportTraceButton view={view} />
            <Button variant="primary" onClick={runAgain}>
              Run again
            </Button>
          </>
        }
      />
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <FidelityCard view={view} />
        <TimeTiles view={view} />
      </div>
      <PlanVsActual projection={projection} />
      <TraceCard view={view} now={now} />
      <EventLog view={view} />
    </Page>
  );
};

const TURN_STATUS = {
  completed: "Completed",
  skipped: "Interrupted",
  running: "Working",
  paused: "Waiting",
  pending: "Not started",
} as const;

const AgentView = ({ view }: { view: BlockView }) => {
  const { now } = useSeiSession();
  const { block, projection, metrics, events } = view;
  const turns = orderedTaskStates(projection);
  const interrupted = turns.filter((t) => t.status === "skipped").length;

  return (
    <Page>
      <PageHeader
        back={{ to: "/agents", label: "Agent sessions" }}
        title={block.name}
        chip={
          <span className="flex gap-2">
            <Chip kind="agent" />
            <StatusChip projection={projection} />
          </span>
        }
        meta={[timeRange(view), "recorded by the Claude Code hook", `${events.length} events`].filter(Boolean).join(" · ")}
      />
      <section aria-label="How to read this" className="flex items-start gap-3.5 rounded-tile border border-line bg-surface px-[18px] py-4">
        <InfoIcon size={20} className="mt-px shrink-0 text-ink-2" />
        <p className="m-0 text-sm leading-relaxed text-ink-2">
          <strong className="text-ink">The plan was inferred afterwards.</strong> Each prompt became a task when it was sent,
          with no estimate, so time accuracy and order don't apply. Turn completion is the honest number here, and it is never
          averaged with your timed blocks. This block is read-only.
        </p>
      </section>
      <section aria-label="Session numbers" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile label="Agent working" value={formatDuration(metrics.focusSec)} hint="prompt sent → agent stopped" />
        <MetricTile
          label={
            <>
              <span className="hatch-inferred h-2.5 w-3.5 rounded-sm" aria-hidden="true" />
              Waiting on you
            </>
          }
          name="Waiting on you"
          value={formatDuration(metrics.inferredPauseSec)}
          hint="inferred, not observed"
        />
        <MetricTile
          label="Turns completed"
          value={
            <>
              {metrics.completedTasks} <span className="text-base text-muted">/ {metrics.totalTasks}</span>
            </>
          }
          hint={interrupted ? `${interrupted} interrupted` : "none interrupted"}
        />
        <MetricTile label="Turn completion" value={formatPercent(metrics.completionRate)} hint="this session's fidelity" />
      </section>
      <TraceCard view={view} now={now} agent />
      <section aria-label="Turns" className="overflow-hidden rounded-section border border-line bg-surface">
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="m-0 text-[15px] font-semibold">Turns</h2>
          <span className="text-xs text-muted">each prompt is one task</span>
        </div>
        <div className="overflow-x-auto">
          <ol className="m-0 min-w-[560px] list-none p-0 text-sm">
            {turns.map((t, i) => (
              <li
                key={t.taskId}
                className={`grid grid-cols-[28px_40px_56px_minmax(0,1fr)_64px_96px] items-center gap-3 border-b border-divider px-5 py-3 last:border-b-0 ${
                  t.status === "skipped" ? "bg-over-tint" : ""
                }`}
              >
                <TaskStateIcon status={t.status} size={18} />
                <span className="font-mono text-xs text-faint">{i + 1}</span>
                <span className="font-mono text-xs text-ink-2">{t.startedAt ? formatHM(t.startedAt) : "—"}</span>
                <span className="truncate">{t.title}</span>
                <span className="font-mono text-[13px]">{formatDuration(t.elapsedSec)}</span>
                <span className={`text-xs ${t.status === "skipped" ? "font-semibold text-over" : "text-ink-2"}`}>
                  {TURN_STATUS[t.status]}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </Page>
  );
};

export const BlockPage = () => {
  const { id } = useParams<{ id: string }>();
  const { getBlock } = useSeiSession();
  const { status } = useSeiStore();
  const view = getBlock(id);

  if (!view) {
    return (
      <Page>
        {status === "loading" ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : (
          <EmptyState title="Block not found" body="It may have been deleted." />
        )}
      </Page>
    );
  }
  if (view.capturedByAgent) return <AgentView view={view} />;
  if (view.metrics.isFinal) return <ReportView view={view} />;
  return <RunningView view={view} />;
};
