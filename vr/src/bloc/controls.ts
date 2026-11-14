import type {
  BlockExecutionProjection,
  BlockId,
  ExecutionCommand,
  SessionId,
  TaskId,
  UserId,
} from './engine';

// CONTROLS: what a pinch means.
//
// In the headset you pinch a control: Start, Done or Skip on a task card, or
// Pause and End on the timer. Each control is turned here into the engine
// commands it stands for. The commands are then checked by resolveCommand,
// which has the final word: if it returns no events, nothing happens.
//
// Some pinches stand for two commands. Done on a card that is not in focus
// first switches to it and then completes it, so one pinch is enough to
// finish any step, including one finished out of order.

export type CardControl = 'start' | 'done' | 'skip';
export type TimerControl = 'pause' | 'end';

export type Control =
  | { kind: 'card'; control: CardControl; taskId: TaskId }
  | { kind: 'timer'; control: TimerControl };

export interface CommandContext {
  blockId: BlockId;
  userId: UserId;
  sessionId: SessionId;
  at: string;
}

const isLive = (state: BlockExecutionProjection) =>
  state.status === 'running' || state.status === 'paused';

const isUnfinished = (state: BlockExecutionProjection, taskId: TaskId) => {
  const task = state.taskStates[taskId];
  return !!task && task.status !== 'completed' && task.status !== 'skipped';
};

export const commandsFor = (
  control: Control,
  state: BlockExecutionProjection,
  ctx: CommandContext,
): ExecutionCommand[] => {
  const base = { blockId: ctx.blockId, userId: ctx.userId, at: ctx.at };
  const start: ExecutionCommand = { ...base, type: 'StartBlock', sessionId: ctx.sessionId };

  if (control.kind === 'timer') {
    if (!isLive(state)) return [];
    if (control.control === 'end') {
      return [{ ...base, type: 'TerminateSession', reason: 'user_exit' }];
    }
    // pause is a toggle
    if (state.pauseKind === 'task') return [{ ...base, type: 'ResumeTask' }];
    if (state.pauseKind === 'block') return [{ ...base, type: 'ResumeBlock' }];
    return state.activeTaskId
      ? [{ ...base, type: 'PauseTask' }]
      : [{ ...base, type: 'PauseBlock' }];
  }

  const { taskId } = control;
  if (!state.taskStates[taskId]) return [];
  const idle = state.status === 'idle';
  if (!idle && !(isLive(state) && isUnfinished(state, taskId))) return [];
  const isActive = state.activeTaskId === taskId;

  switch (control.control) {
    case 'start': {
      if (idle) return [{ ...start, taskId }];
      if (!isActive) return [{ ...base, type: 'SwitchTask', toTaskId: taskId }];
      if (state.pauseKind === 'task') return [{ ...base, type: 'ResumeTask' }];
      if (state.pauseKind === 'block') return [{ ...base, type: 'ResumeBlock' }];
      return []; // already in focus
    }
    case 'done': {
      const complete: ExecutionCommand = { ...base, type: 'CompleteTask' };
      if (idle) return [{ ...start, taskId }, complete];
      if (isActive) return [complete];
      return [{ ...base, type: 'SwitchTask', toTaskId: taskId }, complete];
    }
    case 'skip': {
      const skip: ExecutionCommand = { ...base, type: 'SkipTask', taskId };
      return idle ? [start, skip] : [skip];
    }
  }
};
