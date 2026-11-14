import { describe, expect, it } from 'vitest';
import type { Control } from '../controls';
import { DEV_USER_ID, type TaskId } from '../engine';
import { applyControl, newRun, viewRun, type Run } from '../run';
import { templateById, TEMPLATES } from '../templates';
import {
  MAX_REPORT_LINES,
  cardViews,
  focusView,
  plainText,
  reportView,
  templateLine,
} from '../view';

const setup = (templateId: 'reset' | 'deep-work' | 'release') => {
  let n = 0;
  const newId = () => `id${++n}`;
  let seconds = 0;
  const at = () => new Date(Date.UTC(2026, 10, 14, 9, 0, seconds)).toISOString();
  let run: Run = newRun(templateById(templateId)!, { userId: DEV_USER_ID, newId, now: at() });
  const pinch = (control: Control, afterSec = 0) => {
    seconds += afterSec;
    run = applyControl(run, control, at(), newId).run;
  };
  const wait = (sec: number) => (seconds += sec);
  const view = () => viewRun(run, at());
  const cards = () => cardViews(run, view(), at());
  const task = (i: number) => run.tasks[i].id;
  return { pinch, wait, view, cards, task };
};

const card = (control: 'start' | 'done' | 'skip', taskId: TaskId): Control => ({
  kind: 'card',
  control,
  taskId,
});

describe('cards', () => {
  it('before the block starts, every card can start, finish or skip', () => {
    const { cards } = setup('release');
    const first = cards()[0];
    expect(first).toMatchObject({
      number: '1',
      title: 'Run the full test suite',
      badge: 'Critical',
      estimate: '4m',
      status: 'Not started',
      tone: 'pending',
      start: { enabled: true, label: 'Start' },
      done: true,
      skip: true,
    });
    expect(cards().map((c) => c.badge)).toEqual([
      'Critical',
      'Required',
      'Required',
      'Required',
      'Minor',
      'Optional',
    ]);
  });

  it('the card in focus cannot be started again, the others can take focus', () => {
    const { pinch, wait, cards, task } = setup('release');
    pinch(card('start', task(0)));
    wait(30);
    const [focus, next] = cards();
    expect(focus).toMatchObject({ tone: 'focus', status: 'In focus', start: { enabled: false } });
    expect(next).toMatchObject({ tone: 'pending', start: { enabled: true, label: 'Focus' } });
  });

  it('a step left behind is on hold with its time so far', () => {
    const { pinch, cards, task } = setup('reset');
    pinch(card('start', task(0)));
    pinch(card('start', task(1)), 75);
    expect(cards()[0]).toMatchObject({ tone: 'pending', status: 'On hold, 1m so far' });
  });

  it('finished cards say how they ended and offer nothing', () => {
    const { pinch, cards, task } = setup('reset');
    pinch(card('start', task(0)));
    pinch(card('done', task(0)), 90);
    pinch(card('skip', task(1)), 5);
    const [done, skipped] = cards();
    expect(done).toMatchObject({ tone: 'done', status: 'Done in 2m', done: false, skip: false });
    expect(skipped).toMatchObject({ tone: 'skipped', status: 'Skipped', start: { enabled: false } });
  });

  it('a paused card offers Resume', () => {
    const { pinch, cards, task } = setup('reset');
    pinch(card('start', task(0)));
    pinch({ kind: 'timer', control: 'pause' }, 10);
    expect(cards()[0]).toMatchObject({ tone: 'paused', start: { enabled: true, label: 'Resume' } });
  });
});

describe('focus', () => {
  it('before the start it shows the whole budget and how to begin', () => {
    const { view } = setup('reset');
    expect(focusView(view())).toMatchObject({
      blockName: '10-minute reset',
      title: 'Pinch Start on any card',
      clock: '10:00',
      step: '5 steps',
      canPause: false,
      canEnd: false,
    });
  });

  it('while running it counts down the step in focus', () => {
    const { pinch, wait, view, task } = setup('release');
    pinch(card('start', task(0)));
    wait(65);
    expect(focusView(view())).toMatchObject({
      title: 'Run the full test suite',
      clock: '02:55',
      caption: 'left on this step',
      step: 'Step 1 of 6',
      overrun: false,
      pauseLabel: 'Pause',
      canPause: true,
      canEnd: true,
    });
  });

  it('past the estimate it counts up', () => {
    const { pinch, wait, view, task } = setup('reset');
    pinch(card('start', task(0)));
    wait(150);
    expect(focusView(view())).toMatchObject({ clock: '+00:30', caption: 'over the estimate', overrun: true });
  });

  it('paused, it says so and offers Resume', () => {
    const { pinch, view, task } = setup('reset');
    pinch(card('start', task(0)));
    pinch({ kind: 'timer', control: 'pause' }, 20);
    expect(focusView(view())).toMatchObject({ paused: true, pauseLabel: 'Resume', caption: 'paused' });
  });

  it('once finished it shows the focus time and progress is full', () => {
    const { pinch, view, task } = setup('deep-work');
    pinch(card('start', task(0)));
    pinch(card('done', task(0)), 120);
    pinch(card('done', task(1)), 1200);
    pinch(card('done', task(2)), 180);
    expect(focusView(view())).toMatchObject({
      title: 'Block finished',
      clock: '25:00',
      caption: 'of focus',
      step: '3 of 3 steps',
      progress: 1,
      canPause: false,
    });
  });
});

describe('report', () => {
  it('does not exist before the block starts', () => {
    const { view } = setup('reset');
    expect(reportView(view())).toBeNull();
  });

  it('a clean run reads as followed with no deviations', () => {
    const { pinch, view, task } = setup('deep-work');
    pinch(card('start', task(0)));
    pinch(card('done', task(0)), 120);
    pinch(card('done', task(1)), 1200);
    pinch(card('done', task(2)), 180);
    expect(reportView(view())).toMatchObject({
      score: '100%',
      verdict: 'followed',
      verdictLabel: 'Followed',
      verdictNote: 'Every rule in the plan held.',
      deviations: ['No deviations.'],
      focus: '25m of focus, 25m planned.',
    });
  });

  it('uses the web app words for each deviation, worst first', () => {
    const { pinch, view, task } = setup('release');
    pinch(card('start', task(0)));
    pinch(card('skip', task(0)), 10);
    const report = reportView(view())!;
    expect(report.verdictLabel).toBe('Not followed');
    expect(report.deviations[0]).toBe('Run the full test suite was skipped.');
    expect(report.rules).toBe(
      '5 required steps, 1 critical, 1 optional, order enforced, on time within 15%',
    );
  });

  it('keeps the list short enough to read at a glance', () => {
    const { pinch, view, task } = setup('release');
    pinch(card('start', task(0)));
    pinch({ kind: 'timer', control: 'end' }, 10);
    const lines = reportView(view())!.deviations;
    expect(lines).toHaveLength(MAX_REPORT_LINES);
    expect(lines[MAX_REPORT_LINES - 1]).toBe('And 2 more.');
  });
});

describe('text', () => {
  it('describes each template in one ASCII line', () => {
    expect(TEMPLATES.map(templateLine)).toEqual([
      '10 min, 5 steps, any order',
      '25 min, 3 steps, any order',
      '13 min, 6 steps, order enforced',
    ]);
    expect(plainText('a · b · c')).toBe('a, b, c');
  });
});
