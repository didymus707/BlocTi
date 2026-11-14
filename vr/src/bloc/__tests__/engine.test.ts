import { describe, expect, it } from 'vitest';
import {
  DEV_USER_ID,
  appendEvents,
  conformanceOf,
  projectBlock,
  resolveCommand,
  type BlockId,
  type BlockPlan,
  type ExecutionCommand,
  type SeiEvent,
  type SessionId,
  type TaskId,
  type TaskPlan,
} from '../engine';

// A smoke test for the bridge: the engine imported from frontend/ runs here
// unchanged. Its own behaviour is tested in frontend/src/sei.
describe('engine bridge', () => {
  it('runs one command through resolver, events and projection', () => {
    const blockId = 'b1' as BlockId;
    const block: BlockPlan = {
      id: blockId,
      name: 'Smoke',
      userId: DEV_USER_ID,
      taskIds: ['t1' as TaskId],
      createdAt: '2026-11-14T09:00:00.000Z',
      plannedDuration: 60,
    };
    const tasks: TaskPlan[] = [
      { id: 't1' as TaskId, name: 'Only step', blockId, order: 0, plannedDuration: 60 },
    ];
    const start: ExecutionCommand = {
      type: 'StartBlock',
      blockId,
      userId: DEV_USER_ID,
      at: '2026-11-14T09:00:00.000Z',
      sessionId: 's1' as SessionId,
    };

    let n = 0;
    const events: SeiEvent[] = appendEvents(
      [],
      resolveCommand(block, tasks, [], start),
      () => `e${++n}`,
    );
    const state = projectBlock(block, tasks, events, '2026-11-14T09:00:30.000Z');

    expect(events.map((e) => e.type)).toEqual(['BlockPlanned', 'BlockStarted', 'TaskStarted']);
    expect(state.status).toBe('running');
    expect(state.taskStates['t1' as TaskId].elapsedSec).toBe(30);
    expect(conformanceOf(state).isFinal).toBe(false);
  });
});
