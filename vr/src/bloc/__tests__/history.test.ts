import { describe, expect, it } from 'vitest';
import { DEV_USER_ID, type Verdict } from '../engine';
import {
  HISTORY_LIMIT,
  addEntry,
  entryFromRun,
  followedStreak,
  loadHistory,
  parseHistory,
  recentVerdicts,
  saveHistory,
  trendLine,
  type HistoryEntry,
} from '../history';
import { applyControl, newRun } from '../run';
import { memoryStore } from '../storage';
import { templateById } from '../templates';

const entry = (blockId: string, verdict: Verdict, score = 1): HistoryEntry => ({
  blockId,
  templateId: 'reset',
  name: '10-minute reset',
  endedAt: '2026-11-14T09:10:00.000Z',
  verdict,
  score,
  deviations: verdict === 'followed' ? 0 : 1,
  focusSec: 600,
});

describe('history entry', () => {
  it('exists only once the block has ended', () => {
    let n = 0;
    const newId = () => `id${++n}`;
    let run = newRun(templateById('reset')!, {
      userId: DEV_USER_ID,
      newId,
      now: '2026-11-14T09:00:00.000Z',
    });
    const first = run.tasks[0].id;
    run = applyControl(run, { kind: 'card', control: 'start', taskId: first }, '2026-11-14T09:00:00.000Z', newId).run;
    expect(entryFromRun(run, '2026-11-14T09:01:00.000Z')).toBeNull();

    run = applyControl(run, { kind: 'timer', control: 'end' }, '2026-11-14T09:02:00.000Z', newId).run;
    const done = entryFromRun(run, '2026-11-14T09:03:00.000Z')!;
    expect(done).toMatchObject({
      blockId: run.block.id,
      templateId: 'reset',
      endedAt: '2026-11-14T09:02:00.000Z',
      verdict: 'major_deviations',
      focusSec: 120,
    });
    expect(done.score).toBeLessThan(1);
  });
});

describe('history list', () => {
  it('keeps one entry per block, newest last, and caps its length', () => {
    let history: HistoryEntry[] = [];
    history = addEntry(history, entry('a', 'followed'));
    history = addEntry(history, entry('b', 'not_followed'));
    history = addEntry(history, entry('a', 'minor_deviations'));
    expect(history.map((e) => e.blockId)).toEqual(['b', 'a']);

    for (let i = 0; i < HISTORY_LIMIT + 5; i++) history = addEntry(history, entry(`x${i}`, 'followed'));
    expect(history).toHaveLength(HISTORY_LIMIT);
    expect(history[history.length - 1].blockId).toBe(`x${HISTORY_LIMIT + 4}`);
  });

  it('round-trips through storage and drops malformed entries', () => {
    const store = memoryStore();
    expect(loadHistory(store)).toEqual([]);
    saveHistory(store, [entry('a', 'followed')]);
    expect(loadHistory(store)).toEqual([entry('a', 'followed')]);

    expect(parseHistory([entry('a', 'followed'), { blockId: 'b' }, null, 3])).toEqual([
      entry('a', 'followed'),
    ]);
    expect(parseHistory({})).toBeNull();
  });
});

describe('trend', () => {
  const run = (...verdicts: Verdict[]) => verdicts.map((v, i) => entry(`b${i}`, v, v === 'followed' ? 1 : 0.6));

  it('shows the last verdicts oldest first', () => {
    const history = run('not_followed', 'followed', 'minor_deviations');
    expect(recentVerdicts(history, 2)).toEqual(['followed', 'minor_deviations']);
  });

  it('counts the followed streak back from the latest block', () => {
    expect(followedStreak(run('followed', 'not_followed', 'followed', 'followed'))).toBe(2);
    expect(followedStreak(run('followed', 'minor_deviations'))).toBe(0);
    expect(followedStreak([])).toBe(0);
  });

  it('says it in one sentence', () => {
    expect(trendLine([])).toBe('Finish a block and its verdict shows up here.');
    expect(trendLine(run('followed'))).toBe('Your last block followed the plan. Best score 100%.');
    expect(trendLine(run('not_followed'))).toBe('Your last block drifted from the plan. Best score 60%.');
    expect(trendLine(run('not_followed', 'followed', 'followed'))).toBe(
      '2 of your last 3 blocks followed the plan. 2 in a row.',
    );
    expect(trendLine(run('followed', 'major_deviations'))).toBe(
      '1 of your last 2 blocks followed the plan. Best score 100%.',
    );
  });
});
