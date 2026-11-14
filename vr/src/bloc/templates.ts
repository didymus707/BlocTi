import {
  RULES_FOR,
  type BlockId,
  type BlockPlan,
  type Importance,
  type TaskId,
  type TaskPlan,
  type UserId,
} from './engine';

// TEMPLATES: three ready-made plans, so a block can start without typing.
//
// A template is written the way a person would say it: step names, minutes
// and how much each step matters. planFromTemplate turns it into the plan the
// engine expects (a BlockPlan and its TaskPlans), with the importance turned
// into the two step rules the conformance checker reads.

export type TemplateId = 'reset' | 'deep-work' | 'release';

export interface TemplateStep {
  title: string;
  minutes: number;
  importance: Importance;
}

export interface Template {
  id: TemplateId;
  name: string;
  blurb: string; // one line for the picker
  ordered: boolean; // steps must be finished in planned order
  steps: TemplateStep[];
}

export const TEMPLATES: readonly Template[] = [
  {
    id: 'reset',
    name: '10-minute reset',
    blurb: 'Clear the decks between two pieces of work.',
    ordered: false,
    steps: [
      { title: 'Close what is finished', minutes: 2, importance: 'required' },
      { title: 'Write down open loops', minutes: 3, importance: 'required' },
      { title: 'Clear the desk', minutes: 2, importance: 'minor' },
      { title: 'Pick the next task', minutes: 2, importance: 'required' },
      { title: 'Drink some water', minutes: 1, importance: 'optional' },
    ],
  },
  {
    id: 'deep-work',
    name: '25-minute deep work',
    blurb: 'One goal, one stretch of focus, one note to pick it up again.',
    ordered: false,
    steps: [
      { title: 'Set one goal', minutes: 2, importance: 'required' },
      { title: 'Focus on the goal', minutes: 20, importance: 'required' },
      { title: 'Note where you stopped', minutes: 3, importance: 'required' },
    ],
  },
  {
    id: 'release',
    name: 'Release checklist',
    blurb: 'Order enforced. Skipping the tests means the plan was not followed.',
    ordered: true,
    steps: [
      { title: 'Run the full test suite', minutes: 4, importance: 'critical' },
      { title: 'Update the changelog', minutes: 3, importance: 'required' },
      { title: 'Bump the version', minutes: 1, importance: 'required' },
      { title: 'Tag and publish', minutes: 2, importance: 'required' },
      { title: 'Smoke test the release', minutes: 2, importance: 'minor' },
      { title: 'Tell the team', minutes: 1, importance: 'optional' },
    ],
  },
];

export const templateById = (id: string): Template | undefined =>
  TEMPLATES.find((t) => t.id === id);

export const templateMinutes = (template: Template): number =>
  template.steps.reduce((total, step) => total + step.minutes, 0);

export interface PlanContext {
  userId: UserId;
  newId: () => string;
  now: string;
}

// a fresh plan with new ids every time, so each run is its own block stream
export const planFromTemplate = (
  template: Template,
  { userId, newId, now }: PlanContext,
): { block: BlockPlan; tasks: TaskPlan[] } => {
  const blockId = newId() as BlockId;
  const tasks: TaskPlan[] = template.steps.map((step, order) => ({
    id: newId() as TaskId,
    name: step.title,
    blockId,
    order,
    plannedDuration: step.minutes * 60,
    ...RULES_FOR[step.importance],
  }));
  const block: BlockPlan = {
    id: blockId,
    name: template.name,
    userId,
    taskIds: tasks.map((t) => t.id),
    createdAt: now,
    plannedDuration: templateMinutes(template) * 60,
    rules: { ordered: template.ordered, timeTolerance: 0.15 },
  };
  return { block, tasks };
};
