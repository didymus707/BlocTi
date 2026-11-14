import { describe, expect, it } from 'vitest';
import type { Control } from '../controls';
import { DEV_USER_ID, type TaskId } from '../engine';
import {
  applyControl,
  clearRun,
  isFinished,
  loadRun,
  newRun,
  parseRun,
  saveRun,
  viewRun,
  type Run,
} from '../run';
import { memoryStore, type KeyValueStore } from '../storage';
import { templateById } from '../templates';

const clock = (startSec = 0) => {
  let seconds = startSec;
  return {
    tick: (by: number) => (seconds += by),
    at: () => new Date(Date.UTC(2026, 10, 14, 9, 0, seconds)).toISOString(),
  };
};

const ids = () => {
  let n = 0;
  return () => `id${++n}`;
};

const card = (control: 'start' | 'done' | 'skip', taskId: TaskId): Control => ({
  kind: 'card',
  control,
  taskId,
});

const start = (templateId: 'reset' | 'deep-work' | 'release') => {
  const newId = ids();
  const time = clock();
  let run = newRun(templateById(templateId)!, { userId: DEV_USER_ID, newId, now: time.at() });
  const pinch = (control: Control, afterSec = 30) => {
    time.tick(afterSec);
    const result = applyControl(run, control, time.at(), newId);
    run = result.run;
    return result.accepted;
  };
  return { pinch, time, run: () => run, task: (i: number) => run.tasks[i].id };
};

describe('run', () => {
  it('starts idle with no events and one session id', () => {
    const { run, time } = start('reset');
    expect(run().events).toEqual([]);
    expect(viewRun(run(), time.at()).state.status).toBe('idle');
  });

  it('a whole release checklist in order, on time, is followed', () => {
    const { pinch, run, task, time } = start('release');
    expect(pinch(card('start', task(0)), 0)).toBe(true);
    const minutes = [4, 3, 1, 2, 2, 1];
    minutes.forEach((m, i) => expect(pinch(card('done', task(i)), m * 60)).toBe(true));

    const { state, metrics } = viewRun(run(), time.at());
    expect(state.status).toBe('completed');
    expect(isFinished(state)).toBe(true);
    expect(metrics.fidelity).toMatchObject({ isFinal: true, verdict: 'followed', score: 1 });
  });

  it('skipping the critical step means the plan was not followed', () => {
    const { pinch, run, task, time } = start('release');
    pinch(card('start', task(0)), 0);
    pinch(card('skip', task(0)));
    const report = viewRun(run(), time.at()).metrics.fidelity!;
    expect(report.verdict).toBe('not_followed');
    expect(report.deviations[0]).toMatchObject({ kind: 'missed_step', outcome: 'skipped' });
  });

  it('finishing a step ahead of an open one is out of order', () => {
    const { pinch, run, task, time } = start('release');
    pinch(card('start', task(0)), 0);
    pinch(card('done', task(1)), 180);
    const kinds = viewRun(run(), time.at()).metrics.fidelity!.deviations.map((d) => d.kind);
    expect(kinds).toContain('out_of_order');
  });

  it('a rejected pinch leaves the run exactly as it was', () => {
    const { pinch, run, task } = start('reset');
    const before = run();
    expect(pinch({ kind: 'timer', control: 'pause' })).toBe(false);
    expect(pinch(card('start', 'nope' as TaskId))).toBe(false);
    expect(run()).toBe(before);
    pinch(card('done', task(0)));
    expect(pinch(card('done', task(0)))).toBe(false);
  });

  it('ending early judges what is left as not done', () => {
    const { pinch, run, task, time } = start('deep-work');
    pinch(card('start', task(0)), 0);
    pinch({ kind: 'timer', control: 'end' }, 60);
    const { state, metrics } = viewRun(run(), time.at());
    expect(state.status).toBe('terminated');
    const outcomes = metrics.fidelity!.deviations.map((d) => d.kind === 'missed_step' && d.outcome);
    expect(outcomes.filter((o) => o === 'not_done')).toHaveLength(3);
  });
});

describe('saved run', () => {
  it('comes back from storage and projects to the same state', () => {
    const store = memoryStore();
    const { pinch, run, task, time } = start('reset');
    pinch(card('start', task(0)), 0);
    pinch(card('done', task(0)), 90);

    expect(saveRun(store, run())).toBe(true);
    const restored = loadRun(store)!;
    expect(viewRun(restored, time.at())).toEqual(viewRun(run(), time.at()));

    clearRun(store);
    expect(loadRun(store)).toBeNull();
  });

  it('drops anything that is not a run', () => {
    const store = memoryStore();
    store.setItem('blocti.vr.run.v1', '{not json');
    expect(loadRun(store)).toBeNull();
    expect(parseRun({ templateId: 'unknown', block: { id: 'b' }, sessionId: 's', tasks: [], events: [] })).toBeNull();
    expect(parseRun({ templateId: 'reset', block: { id: 'b' }, sessionId: 's', tasks: [] })).toBeNull();
    expect(parseRun(null)).toBeNull();
  });

  it('a store that throws is treated as no store', () => {
    const broken: KeyValueStore = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('full');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    const { run } = start('reset');
    expect(saveRun(broken, run() as Run)).toBe(false);
    expect(loadRun(broken)).toBeNull();
    expect(() => clearRun(broken)).not.toThrow();
  });
});
