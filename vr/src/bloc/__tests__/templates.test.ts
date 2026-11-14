import { describe, expect, it } from 'vitest';
import { DEV_USER_ID, importanceOf, procedureOf, projectBlock } from '../engine';
import { TEMPLATES, planFromTemplate, templateById, templateMinutes } from '../templates';

const counter = () => {
  let n = 0;
  return () => `id${++n}`;
};
const ctx = () => ({ userId: DEV_USER_ID, newId: counter(), now: '2026-11-14T09:00:00.000Z' });

describe('templates', () => {
  it('offers the three plans the picker shows, each short enough for one sitting', () => {
    expect(TEMPLATES.map((t) => t.id)).toEqual(['reset', 'deep-work', 'release']);
    expect(templateMinutes(templateById('reset')!)).toBe(10);
    expect(templateMinutes(templateById('deep-work')!)).toBe(25);
    for (const template of TEMPLATES) {
      expect(template.steps.length).toBeGreaterThan(0);
      // six cards is what fits within arm's reach
      expect(template.steps.length).toBeLessThanOrEqual(6);
    }
  });

  it('only the release checklist enforces order and has a critical step', () => {
    for (const template of TEMPLATES) {
      const critical = template.steps.some((s) => s.importance === 'critical');
      expect(template.ordered).toBe(template.id === 'release');
      expect(critical).toBe(template.id === 'release');
    }
  });

  it('turns a template into a plan the engine accepts', () => {
    const { block, tasks } = planFromTemplate(templateById('release')!, ctx());

    expect(block.name).toBe('Release checklist');
    expect(block.taskIds).toEqual(tasks.map((t) => t.id));
    expect(block.plannedDuration).toBe(13 * 60);
    expect(tasks.every((t) => t.blockId === block.id)).toBe(true);
    expect(tasks.map((t) => t.order)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(tasks[0]).toMatchObject({ plannedDuration: 240, required: true, severity: 'critical' });
  });

  it('keeps each step importance when the engine reads the plan back as rules', () => {
    const template = templateById('release')!;
    const { block, tasks } = planFromTemplate(template, ctx());
    const procedure = procedureOf(projectBlock(block, tasks, [], block.createdAt));

    expect(procedure.ordered).toBe(true);
    expect(procedure.steps.map((s) => importanceOf(s))).toEqual(
      template.steps.map((s) => s.importance),
    );
  });

  it('gives every run new ids, so two runs never share a stream', () => {
    const newId = counter();
    const first = planFromTemplate(templateById('reset')!, { ...ctx(), newId });
    const second = planFromTemplate(templateById('reset')!, { ...ctx(), newId });
    expect(first.block.id).not.toBe(second.block.id);
    expect(first.tasks[0].id).not.toBe(second.tasks[0].id);
  });
});
