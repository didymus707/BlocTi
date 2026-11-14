import { describe, expect, it } from 'vitest';
import {
  BOARD_SLOT,
  FOCUS_SLOT,
  MAX_CARDS,
  VIEWER,
  angleBetween,
  cardSlots,
  distance,
} from '../layout';

const deg = (radians: number) => (radians * 180) / Math.PI;

describe('layout', () => {
  const block = { x: 0, y: 0, z: 0 };

  it('fills rows of three and centres a short last row', () => {
    expect(cardSlots(0)).toEqual([]);
    expect(cardSlots(9)).toHaveLength(MAX_CARDS);
    const five = cardSlots(5);
    expect(five.slice(0, 3).map((s) => s.x)).toEqual([-0.15, 0, 0.15]);
    expect(five[3].x).toBeCloseTo(-0.075);
    expect(five[4].x).toBeCloseTo(0.075);
    expect(five[3].y).toBeGreaterThan(five[0].y);
  });

  it('keeps every panel within arm’s reach of a seated person', () => {
    const slots = [FOCUS_SLOT, BOARD_SLOT, ...cardSlots(MAX_CARDS)];
    for (const slot of slots) expect(distance(slot, VIEWER)).toBeLessThan(0.6);
  });

  it('keeps the timer near the middle of the view while looking at the block', () => {
    expect(deg(angleBetween(VIEWER, FOCUS_SLOT, block))).toBeLessThan(15);
  });

  it('turns every panel towards the eyes', () => {
    const [left, , right] = cardSlots(3);
    expect(left.yaw).toBeGreaterThan(0);
    expect(right.yaw).toBeLessThan(0);
    // the eyes are above every panel, so every panel tilts back
    for (const slot of [FOCUS_SLOT, BOARD_SLOT, left, right]) expect(slot.pitch).toBeLessThan(0);
  });
});
