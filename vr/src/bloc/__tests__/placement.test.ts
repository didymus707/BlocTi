import { describe, expect, it } from 'vitest';
import {
  SPAWN_DISTANCE,
  facingYaw,
  loadPlacement,
  parsePlacement,
  pickSurface,
  placementFor,
  pointInPolygon,
  savePlacement,
  spawnPose,
} from '../placement';
import { memoryStore } from '../storage';

const deg = (radians: number) => (radians * 180) / Math.PI;

describe('spawn', () => {
  it('puts the block in front of the eyes and below them, facing back', () => {
    const { position, yaw } = spawnPose({ x: 0, y: 1.2, z: 0 }, 0);
    expect(position.x).toBeCloseTo(0);
    expect(position.y).toBeCloseTo(0.8);
    expect(position.z).toBeCloseTo(-SPAWN_DISTANCE);
    expect(yaw).toBeCloseTo(0); // +Z points back at the person
  });

  it('follows the way the head is turned', () => {
    // turned 90 degrees left: looking down -X
    const { position, yaw } = spawnPose({ x: 1, y: 1.2, z: 1 }, Math.PI / 2);
    expect(position.x).toBeCloseTo(1 - SPAWN_DISTANCE);
    expect(position.z).toBeCloseTo(1);
    expect(deg(yaw)).toBeCloseTo(90);
  });

  it('facingYaw turns +Z towards a point', () => {
    expect(deg(facingYaw({ x: 0, z: 0 }, { x: 0, z: 1 }))).toBeCloseTo(0);
    expect(deg(facingYaw({ x: 0, z: 0 }, { x: 1, z: 0 }))).toBeCloseTo(90);
  });
});

describe('surfaces', () => {
  const square = [
    { x: -0.5, z: -0.5 },
    { x: 0.5, z: -0.5 },
    { x: 0.5, z: 0.5 },
    { x: -0.5, z: 0.5 },
  ];

  it('knows whether a point is over a plane outline', () => {
    expect(pointInPolygon({ x: 0, z: 0 }, square)).toBe(true);
    expect(pointInPolygon({ x: 0.6, z: 0 }, square)).toBe(false);
    expect(pointInPolygon({ x: 0, z: 0 }, [])).toBe(false);
  });

  it('drops the block onto the desk, not the floor under it', () => {
    const desk = { height: 0.74, under: true };
    const floor = { height: 0, under: true };
    expect(pickSurface(0.8, [floor, desk])).toBe(0.74);
  });

  it('ignores surfaces it is not over, far below, or above it', () => {
    expect(pickSurface(0.8, [{ height: 0.74, under: false }])).toBeNull();
    expect(pickSurface(0.8, [{ height: 0.3, under: true }])).toBeNull();
    expect(pickSurface(0.8, [{ height: 1.0, under: true }])).toBeNull();
    // resting a little into the desk still counts as on it
    expect(pickSurface(0.72, [{ height: 0.74, under: true }])).toBe(0.74);
  });
});

describe('saved placement', () => {
  const saved = { anchorId: 'anchor-1', position: { x: 0.1, y: 0.7, z: -0.4 }, yaw: 0.2 };

  it('round-trips through storage', () => {
    const store = memoryStore();
    expect(loadPlacement(store)).toBeNull();
    savePlacement(store, saved);
    expect(loadPlacement(store)).toEqual(saved);
  });

  it('only applies against the anchor it was saved with', () => {
    expect(placementFor(saved, 'anchor-1')).toEqual(saved);
    expect(placementFor(saved, 'anchor-2')).toBeNull();
    expect(placementFor(saved, null)).toBeNull();
    expect(placementFor(null, 'anchor-1')).toBeNull();
  });

  it('drops malformed saves', () => {
    expect(parsePlacement({ ...saved, yaw: 'left' })).toBeNull();
    expect(parsePlacement({ ...saved, position: { x: 0, y: NaN, z: 0 } })).toBeNull();
    expect(parsePlacement({ position: saved.position, yaw: 0 })).toBeNull();
    expect(parsePlacement(null)).toBeNull();
  });
});
