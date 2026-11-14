import { describe, expect, it } from 'vitest';
import { commandsFor, type Control } from '../controls';
import {
  DEV_USER_ID,
  appendEvents,
  projectBlock,
  resolveCommand,
  type ExecutionCommand,
  type SeiEvent,
  type SessionId,
  type TaskId,
} from '../engine';
import { planFromTemplate, templateById } from '../templates';

// a release checklist and a clock that moves 10 seconds per pinch
const setup = () => {
  let n = 0;
  const newId = () => `id${++n}`;
  const { block, tasks } = planFromTemplate(templateById('release')!, {
    userId: DEV_USER_ID,
    newId,
    now: '2026-11-14T09:00:00.000Z',
  });
  let events: SeiEvent[] = [];
  let seconds = 0;
  const at = () => new Date(Date.UTC(2026, 10, 14, 9, 0, seconds)).toISOString();
  const state = () => projectBlock(block, tasks, events, at());
  const ctx = () => ({
    blockId: block.id,
    userId: DEV_USER_ID,
    sessionId: 's1' as SessionId,
    at: at(),
  });
  const commands = (control: Control) => commandsFor(control, state(), ctx());
  // what the run does: every command must produce events, or nothing changes
  const pinch = (control: Control): boolean => {
    seconds += 10;
    let next = events;
    const list = commandsFor(control, projectBlock(block, tasks, next, at()), ctx());
    for (const command of list) {
      const results = resolveCommand(block, tasks, next, command);
      if (results.length === 0) return false;
      next = appendEvents(next, results, newId);
    }
    events = next;
    return list.length > 0;
  };
  const id = (i: number) => tasks[i].id;
  return { state, commands, pinch, id };
};

const card = (control: 'start' | 'done' | 'skip', taskId: TaskId): Control => ({
  kind: 'card',
  control,
  taskId,
});
const timer = (control: 'pause' | 'end'): Control => ({ kind: 'timer', control });
const types = (list: ExecutionCommand[]) => list.map((c) => c.type);

describe('controls', () => {
  it('start on a card before the block begins starts the block at that card', () => {
    const { commands, pinch, state, id } = setup();
    expect(commands(card('start', id(2)))).toMatchObject([{ type: 'StartBlock', taskId: id(2) }]);
    expect(pinch(card('start', id(2)))).toBe(true);
    expect(state().activeTaskId).toBe(id(2));
  });

  it('start on another card switches focus to it', () => {
    const { commands, pinch, state, id } = setup();
    pinch(card('start', id(0)));
    expect(types(commands(card('start', id(1))))).toEqual(['SwitchTask']);
    pinch(card('start', id(1)));
    expect(state().activeTaskId).toBe(id(1));
    expect(state().switchCount).toBe(1);
  });

  it('start on the card already in focus does nothing', () => {
    const { commands, pinch, id } = setup();
    pinch(card('start', id(0)));
    expect(commands(card('start', id(0)))).toEqual([]);
  });

  it('done completes the card in focus and the engine moves to the next step', () => {
    const { pinch, state, id } = setup();
    pinch(card('start', id(0)));
    expect(pinch(card('done', id(0)))).toBe(true);
    expect(state().taskStates[id(0)].status).toBe('completed');
    expect(state().activeTaskId).toBe(id(1));
  });

  it('done on a card out of focus switches to it and completes it in one pinch', () => {
    const { commands, pinch, state, id } = setup();
    pinch(card('start', id(0)));
    expect(types(commands(card('done', id(2))))).toEqual(['SwitchTask', 'CompleteTask']);
    expect(pinch(card('done', id(2)))).toBe(true);
    expect(state().taskStates[id(2)].status).toBe('completed');
  });

  it('done before the block begins starts it at that card and completes it', () => {
    const { pinch, state, id } = setup();
    expect(pinch(card('done', id(0)))).toBe(true);
    expect(state().status).toBe('running');
    expect(state().taskStates[id(0)].status).toBe('completed');
  });

  it('skip works on any unfinished card, in focus or not', () => {
    const { pinch, state, id } = setup();
    pinch(card('start', id(0)));
    expect(pinch(card('skip', id(3)))).toBe(true);
    expect(state().taskStates[id(3)].status).toBe('skipped');
    expect(state().activeTaskId).toBe(id(0));
    expect(pinch(card('skip', id(0)))).toBe(true);
    expect(state().activeTaskId).toBe(id(1));
  });

  it('a finished card offers nothing', () => {
    const { commands, pinch, id } = setup();
    pinch(card('done', id(0)));
    for (const control of ['start', 'done', 'skip'] as const) {
      expect(commands(card(control, id(0)))).toEqual([]);
    }
  });

  it('pause is a toggle, and start on the paused card resumes it too', () => {
    const { commands, pinch, state, id } = setup();
    expect(commands(timer('pause'))).toEqual([]);
    pinch(card('start', id(0)));
    expect(types(commands(timer('pause')))).toEqual(['PauseTask']);
    pinch(timer('pause'));
    expect(state().pauseKind).toBe('task');
    expect(types(commands(timer('pause')))).toEqual(['ResumeTask']);
    expect(types(commands(card('start', id(0))))).toEqual(['ResumeTask']);
    pinch(timer('pause'));
    expect(state().status).toBe('running');
  });

  it('end stops a live block and does nothing before it starts', () => {
    const { commands, pinch, state, id } = setup();
    expect(commands(timer('end'))).toEqual([]);
    pinch(card('start', id(0)));
    expect(pinch(timer('end'))).toBe(true);
    expect(state().status).toBe('terminated');
    expect(commands(card('start', id(1)))).toEqual([]);
  });

  it('a card that is not in the plan offers nothing', () => {
    const { commands } = setup();
    expect(commands(card('start', 'nope' as TaskId))).toEqual([]);
  });
});
