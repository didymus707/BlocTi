import { commandsFor, type CardControl } from './controls';
import {
  IMPORTANCE_LABEL,
  VERDICT_LABEL,
  VERDICT_NOTE,
  describeDeviation,
  formatClock,
  formatDuration,
  formatPercent,
  importanceOf,
  orderedTaskStates,
  pointsSummary,
  procedureOf,
  procedureSummary,
  type TaskExecutionState,
  type TaskId,
  type Verdict,
} from './engine';
import { isFinished, type Run, type RunView } from './run';
import { templateMinutes, type Template } from './templates';

// VIEW: what each panel says, worked out from the projection.
//
// The panels in the headset only show strings and on/off switches. All the
// choices about wording live here, where they can be tested, and the
// sentences about verdicts and deviations come from the web app's
// explain.ts, so both apps say the same thing.

// The panel font is only sure to have plain ASCII, so the web app's
// separators are swapped for commas.
export const plainText = (text: string): string => text.replace(/ \u00b7 /g, ', ');

export type CardTone = 'pending' | 'focus' | 'paused' | 'done' | 'skipped';

export interface CardView {
  taskId: TaskId;
  number: string; // "1" ... "6"
  title: string;
  badge: string; // Critical, Required, Minor, Optional
  estimate: string; // "4m"
  status: string;
  tone: CardTone;
  start: { enabled: boolean; label: string };
  done: boolean;
  skip: boolean;
}

const toneOf = (task: TaskExecutionState): CardTone => {
  switch (task.status) {
    case 'running':
      return 'focus';
    case 'paused':
      return 'paused';
    case 'completed':
      return 'done';
    case 'skipped':
      return 'skipped';
    default:
      return 'pending';
  }
};

const statusOf = (task: TaskExecutionState): string => {
  switch (task.status) {
    case 'running':
      return task.overrunSec > 0 ? `In focus, ${formatDuration(task.overrunSec)} over` : 'In focus';
    case 'paused':
      return 'Paused';
    case 'completed':
      return `Done in ${formatDuration(task.elapsedSec)}`;
    case 'skipped':
      return 'Skipped';
    default:
      return task.startedAt ? `On hold, ${formatDuration(task.elapsedSec)} so far` : 'Not started';
  }
};

export const cardViews = (run: Run, view: RunView, at: string): CardView[] => {
  const { state } = view;
  const ctx = { blockId: run.block.id, userId: run.block.userId, sessionId: run.sessionId, at };
  const can = (control: CardControl, taskId: TaskId) =>
    commandsFor({ kind: 'card', control, taskId }, state, ctx).length > 0;

  return orderedTaskStates(state).map((task, index) => {
    const isActive = state.activeTaskId === task.taskId;
    const startLabel =
      state.status === 'idle' ? 'Start' : isActive && state.isPaused ? 'Resume' : 'Focus';
    return {
      taskId: task.taskId,
      number: String(index + 1),
      title: task.title,
      badge: IMPORTANCE_LABEL[importanceOf(task)],
      estimate: formatDuration(task.plannedSec),
      status: statusOf(task),
      tone: toneOf(task),
      start: { enabled: can('start', task.taskId), label: startLabel },
      done: can('done', task.taskId),
      skip: can('skip', task.taskId),
    };
  });
};

export interface FocusView {
  blockName: string;
  title: string; // the task in focus, or what to do next
  clock: string; // time left on the step, or "+mm:ss" over it
  caption: string;
  step: string; // "Step 2 of 6"
  progress: number; // 0-1, steps finished
  overrun: boolean;
  paused: boolean;
  pauseLabel: string;
  canPause: boolean;
  canEnd: boolean;
}

export const focusView = ({ state }: RunView): FocusView => {
  const tasks = orderedTaskStates(state);
  const finished = tasks.filter((t) => t.status === 'completed' || t.status === 'skipped');
  const active = state.activeTaskId ? state.taskStates[state.activeTaskId] : undefined;
  const live = state.status === 'running' || state.status === 'paused';
  const index = active ? tasks.indexOf(active) : -1;
  const overrun = !!active && active.overrunSec > 0;

  const base = {
    blockName: state.name,
    progress: tasks.length ? finished.length / tasks.length : 0,
    paused: state.isPaused,
    pauseLabel: state.isPaused ? 'Resume' : 'Pause',
    canPause: live,
    canEnd: live,
    overrun,
  };

  if (state.status === 'idle') {
    return {
      ...base,
      title: 'Pinch Start on any card',
      clock: formatClock(state.plannedSec),
      caption: 'planned for this block',
      step: `${tasks.length} steps`,
    };
  }
  if (isFinished(state) || !active) {
    return {
      ...base,
      title: state.status === 'completed' ? 'Block finished' : 'Block ended',
      clock: formatClock(tasks.reduce((sum, t) => sum + t.elapsedSec, 0)),
      caption: 'of focus',
      step: `${finished.length} of ${tasks.length} steps`,
    };
  }
  return {
    ...base,
    title: active.title,
    clock: overrun ? `+${formatClock(active.overrunSec)}` : formatClock(active.remainingSec),
    caption: state.isPaused ? 'paused' : overrun ? 'over the estimate' : 'left on this step',
    step: `Step ${index + 1} of ${tasks.length}`,
  };
};

export interface ReportView {
  score: string; // "82%"
  verdict: Verdict;
  verdictLabel: string;
  verdictNote: string;
  deviations: string[]; // worst first
  points: string;
  rules: string; // what the run was checked against
  focus: string;
}

export const MAX_REPORT_LINES = 4;

// null until the block has started; the report is final once it has ended
export const reportView = ({ state, metrics }: RunView): ReportView | null => {
  const report = metrics.fidelity;
  if (!report) return null;
  const lines = report.deviations.map(describeDeviation);
  const shown =
    lines.length > MAX_REPORT_LINES
      ? [...lines.slice(0, MAX_REPORT_LINES - 1), `And ${lines.length - MAX_REPORT_LINES + 1} more.`]
      : lines;
  return {
    score: formatPercent(report.score),
    verdict: report.verdict,
    verdictLabel: VERDICT_LABEL[report.verdict],
    verdictNote: VERDICT_NOTE[report.verdict],
    deviations: shown.length ? shown : ['No deviations.'],
    points: pointsSummary(report),
    rules: plainText(procedureSummary(procedureOf(state))),
    focus: `${formatDuration(metrics.focusSec)} of focus, ${formatDuration(metrics.plannedFocusSec)} planned.`,
  };
};

// "10 min, 5 steps, any order"
export const templateLine = (template: Template): string =>
  [
    `${templateMinutes(template)} min`,
    `${template.steps.length} steps`,
    template.ordered ? 'order enforced' : 'any order',
  ].join(', ');
