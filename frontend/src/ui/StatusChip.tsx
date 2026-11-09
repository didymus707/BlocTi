import type { BlockExecutionProjection } from "../sei/domain/projection";
import { chipKind, type ChipKind } from "../sei/view/status";
import { AgentIcon, CheckIcon, PauseIcon, StopIcon } from "./icons";

const LABELS: Record<ChipKind, string> = {
  planned: "Planned",
  running: "Running",
  paused: "Paused",
  break: "On a break",
  completed: "Completed",
  stopped: "Stopped",
  agent: "Agent",
};

// Status never rides on colour alone: every chip has a word and most an icon.
export const Chip = ({ kind, testId }: { kind: ChipKind; testId?: string }) => {
  const base =
    "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-[3px] text-xs font-semibold";
  const label = LABELS[kind];
  switch (kind) {
    case "running":
      return (
        <span data-testid={testId} className={`${base} bg-live-soft text-live`}>
          <span className="h-1.5 w-1.5 rounded-full bg-live" aria-hidden="true" />
          {label}
        </span>
      );
    case "paused":
    case "break":
      return (
        <span data-testid={testId} className={`${base} bg-amber-soft text-amber`}>
          <PauseIcon size={11} strokeWidth={3} />
          {label}
        </span>
      );
    case "completed":
      return (
        <span data-testid={testId} className={`${base} bg-sunken text-ink-2`}>
          <CheckIcon size={12} strokeWidth={3} />
          {label}
        </span>
      );
    case "stopped":
      return (
        <span data-testid={testId} className={`${base} bg-sunken text-ink-2`}>
          <StopIcon size={11} strokeWidth={3} />
          {label}
        </span>
      );
    case "agent":
      return (
        <span data-testid={testId} className={`${base} border border-line-strong text-ink-2`}>
          <AgentIcon size={12} strokeWidth={2.4} />
          {label}
        </span>
      );
    default:
      return (
        <span data-testid={testId} className={`${base} border border-line-strong text-ink-2`}>
          {label}
        </span>
      );
  }
};

export const StatusChip = ({ projection }: { projection: BlockExecutionProjection }) => (
  <Chip kind={chipKind(projection)} testId="block-status" />
);
