import { commandsFor, type Control } from './controls';
import {
  appendEvents,
  computeMetrics,
  projectBlock,
  resolveCommand,
  type BlockExecutionProjection,
  type BlockPlan,
  type ExecutionMetrics,
  type SeiEvent,
  type SessionId,
  type TaskPlan,
  type UserId,
} from './engine';
import { readJson, removeKey, writeJson, type KeyValueStore } from './storage';
import { planFromTemplate, templateById, type Template, type TemplateId } from './templates';

// RUN: one block being worked through in the headset.
//
// A run is the plan plus the events so far. That is all the state there is:
// the projection, the timer, the metrics and the conformance report are all
// worked out from it whenever they are needed (event sourcing). Because the
// events are the whole truth, saving the run to localStorage after every
// pinch means a dropped session or a reload loses nothing.

export interface Run {
  templateId: TemplateId;
  block: BlockPlan;
  tasks: TaskPlan[];
  sessionId: SessionId;
  events: SeiEvent[];
}

export interface RunView {
  state: BlockExecutionProjection;
  metrics: ExecutionMetrics;
}

export const newRun = (
  template: Template,
  { userId, newId, now }: { userId: UserId; newId: () => string; now: string },
): Run => ({
  templateId: template.id,
  ...planFromTemplate(template, { userId, newId, now }),
  sessionId: newId() as SessionId,
  events: [],
});

// The pinch either goes through as a whole or not at all: every command it
// stands for must produce events, checked against the events before it.
export const applyControl = (
  run: Run,
  control: Control,
  at: string,
  newId: () => string,
): { run: Run; accepted: boolean } => {
  const { block, tasks } = run;
  const state = projectBlock(block, tasks, run.events, at);
  const commands = commandsFor(control, state, {
    blockId: block.id,
    userId: block.userId,
    sessionId: run.sessionId,
    at,
  });
  if (commands.length === 0) return { run, accepted: false };

  let events = run.events;
  for (const command of commands) {
    const results = resolveCommand(block, tasks, events, command);
    if (results.length === 0) return { run, accepted: false };
    events = appendEvents(events, results, newId);
  }
  return { run: { ...run, events }, accepted: true };
};

export const viewRun = (run: Run, now: string): RunView => {
  const state = projectBlock(run.block, run.tasks, run.events, now);
  return { state, metrics: computeMetrics(state, now) };
};

export const isFinished = (state: BlockExecutionProjection): boolean =>
  state.status === 'completed' || state.status === 'terminated';

// PERSISTENCE: the run in progress, if any

export const RUN_KEY = 'blocti.vr.run.v1';

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

// enough of a check that a damaged or old save is dropped instead of crashing
// the projection; the engine itself tolerates odd events
export const parseRun = (raw: unknown): Run | null => {
  if (!isObject(raw) || !isObject(raw.block)) return null;
  if (typeof raw.templateId !== 'string' || !templateById(raw.templateId)) return null;
  if (typeof raw.block.id !== 'string' || typeof raw.sessionId !== 'string') return null;
  if (!Array.isArray(raw.tasks) || !Array.isArray(raw.events)) return null;
  return raw as unknown as Run;
};

export const loadRun = (store: KeyValueStore | null): Run | null =>
  readJson(store, RUN_KEY, parseRun);

export const saveRun = (store: KeyValueStore | null, run: Run): boolean =>
  writeJson(store, RUN_KEY, run);

export const clearRun = (store: KeyValueStore | null): void => removeKey(store, RUN_KEY);
