import type { SeiEvent } from "../../sei/domain/events";
import type { BlockExecutionProjection } from "../../sei/domain/projection";
import { formatTime } from "../../utils";

const describe = (event: SeiEvent, projection: BlockExecutionProjection) => {
  const title = (id: string) =>
    projection.taskStates[id as keyof typeof projection.taskStates]?.title ?? id;
  switch (event.type) {
    case "BlockPlanned":
      return `${event.tasks.length} tasks planned`;
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
      return event.reason;
    case "BlockPaused":
    case "BlockResumed":
      return event.reason ?? "";
    default:
      return "";
  }
};

export const EventTrace = ({
  events,
  projection,
}: {
  events: SeiEvent[];
  projection: BlockExecutionProjection;
}) => {
  if (events.length === 0) return null;
  const ordered = [...events].sort((a, b) => a.seq - b.seq);
  return (
    <details className="mt-8">
      <summary className="text-[10px] uppercase tracking-[0.2em] font-medium text-gray-400 cursor-pointer">
        Event Trace ({events.length})
      </summary>
      <ol aria-label="Event trace" className="mt-3 space-y-1 font-mono text-xs text-gray-600">
        {ordered.map((e) => (
          <li key={e.eventId} className="flex gap-3">
            <span className="text-gray-300 w-8 text-right">#{e.seq}</span>
            <span className="text-gray-400">{formatTime(e.occurredAt)}</span>
            <span className="font-semibold text-gray-800">{e.type}</span>
            <span className="truncate">{describe(e, projection)}</span>
            <span className="ml-auto text-gray-400">
              {e.actor}·{e.source}
              {e.evidence === "inferred" ? "·inferred" : ""}
            </span>
          </li>
        ))}
      </ol>
    </details>
  );
};
