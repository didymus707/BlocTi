// The one door into the BlocTi engine.
//
// The engine lives in frontend/src/sei and is already tested there. The VR
// app imports it across folders, the way backend/test/hookAdapter.test.ts
// does, and never changes it. Everything the spatial layer needs from the
// engine passes through this file, so the rest of vr/ has a single place to
// look when it asks "what does the engine give me?".

export type {
  SeiEvent,
  TaskSnapshot,
} from '../../../frontend/src/sei/domain/events';
export { DEV_USER_ID } from '../../../frontend/src/sei/domain/events';

export type {
  BlockId,
  EventId,
  IdGenerator,
  SessionId,
  TaskId,
  UserId,
} from '../../../frontend/src/sei/domain/ids';

export type { BlockPlan, TaskPlan } from '../../../frontend/src/sei/domain/plan';

export {
  RULES_FOR,
  importanceOf,
  type Importance,
  type PlanRules,
} from '../../../frontend/src/sei/domain/procedure';

export type { ExecutionCommand } from '../../../frontend/src/sei/domain/command/executionCommand';
export {
  resolveCommand,
  type CommandResult,
} from '../../../frontend/src/sei/domain/command/resolver';

export { appendEvents } from '../../../frontend/src/sei/domain/append';

export {
  orderedTaskStates,
  projectBlock,
  type BlockExecutionProjection,
  type TaskExecutionState,
} from '../../../frontend/src/sei/domain/projection';

export {
  conformanceOf,
  procedureOf,
  type ConformanceReport,
  type Deviation,
  type Verdict,
} from '../../../frontend/src/sei/domain/conformance';

export {
  computeMetrics,
  type ExecutionMetrics,
} from '../../../frontend/src/sei/domain/metrics';

// the words the web app uses for verdicts and deviations
export {
  IMPORTANCE_LABEL,
  VERDICT_LABEL,
  VERDICT_NOTE,
  describeDeviation,
  pointsSummary,
  procedureSummary,
} from '../../../frontend/src/sei/view/explain';

export {
  formatClock,
  formatDuration,
  formatPercent,
} from '../../../frontend/src/utils';
