import { formatPercent, type Verdict } from './engine';
import { isFinished, viewRun, type Run } from './run';
import { readJson, writeJson, type KeyValueStore } from './storage';
import type { TemplateId } from './templates';

// HISTORY: one line per finished block, kept in localStorage.
//
// The full events of old runs are not needed to show a trend, so a finished
// run is boiled down to its verdict and score. The verdicts over the last
// sessions are the reason to come back: did I follow my own plans this week?

export interface HistoryEntry {
  blockId: string;
  templateId: TemplateId;
  name: string;
  endedAt: string;
  verdict: Verdict;
  score: number; // 0-1
  deviations: number;
  focusSec: number;
}

export const HISTORY_KEY = 'blocti.vr.history.v1';
export const HISTORY_LIMIT = 50;

const VERDICTS: readonly Verdict[] = [
  'followed',
  'minor_deviations',
  'major_deviations',
  'not_followed',
];

// null until the block has ended; an unfinished run has no verdict yet
export const entryFromRun = (run: Run, now: string): HistoryEntry | null => {
  const { state, metrics } = viewRun(run, now);
  const report = metrics.fidelity;
  if (!isFinished(state) || !report) return null;
  return {
    blockId: run.block.id,
    templateId: run.templateId,
    name: run.block.name,
    endedAt: state.completedAt ?? state.terminatedAt ?? now,
    verdict: report.verdict,
    score: report.score,
    deviations: report.deviations.length,
    focusSec: metrics.focusSec,
  };
};

// oldest first, one entry per block, the newest HISTORY_LIMIT kept
export const addEntry = (history: HistoryEntry[], entry: HistoryEntry): HistoryEntry[] =>
  [...history.filter((e) => e.blockId !== entry.blockId), entry].slice(-HISTORY_LIMIT);

const isEntry = (value: unknown): value is HistoryEntry => {
  const e = value as Partial<HistoryEntry> | null;
  return (
    typeof e === 'object' &&
    e !== null &&
    typeof e.blockId === 'string' &&
    typeof e.name === 'string' &&
    typeof e.endedAt === 'string' &&
    typeof e.score === 'number' &&
    VERDICTS.includes(e.verdict as Verdict)
  );
};

export const parseHistory = (raw: unknown): HistoryEntry[] | null =>
  Array.isArray(raw) ? raw.filter(isEntry) : null;

export const loadHistory = (store: KeyValueStore | null): HistoryEntry[] =>
  readJson(store, HISTORY_KEY, parseHistory) ?? [];

export const saveHistory = (store: KeyValueStore | null, history: HistoryEntry[]): boolean =>
  writeJson(store, HISTORY_KEY, history);

// the last few verdicts, oldest first, for a row of dots
export const recentVerdicts = (history: HistoryEntry[], count = 7): Verdict[] =>
  history.slice(-count).map((e) => e.verdict);

// finished blocks in a row, counting back from the latest, that followed the plan
export const followedStreak = (history: HistoryEntry[]): number => {
  let streak = 0;
  for (let i = history.length - 1; i >= 0 && history[i].verdict === 'followed'; i--) streak++;
  return streak;
};

// one sentence under the dots
export const trendLine = (history: HistoryEntry[], count = 7): string => {
  const recent = history.slice(-count);
  if (recent.length === 0) return 'Finish a block and its verdict shows up here.';
  const followed = recent.filter((e) => e.verdict === 'followed').length;
  const streak = followedStreak(history);
  const best = Math.max(...recent.map((e) => e.score));
  const head =
    recent.length === 1
      ? followed === 1
        ? 'Your last block followed the plan.'
        : 'Your last block drifted from the plan.'
      : `${followed} of your last ${recent.length} blocks followed the plan.`;
  const tail =
    streak >= 2 ? ` ${streak} in a row.` : ` Best score ${formatPercent(best)}.`;
  return head + tail;
};
