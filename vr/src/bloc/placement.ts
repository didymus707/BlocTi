import { readJson, writeJson, type KeyValueStore } from './storage';

// PLACEMENT: where the block sits on the desk, as plain numbers.
//
// The headset finds flat surfaces (planes) in the room. The block is dropped
// onto the highest one under it, so it lands on the desk rather than the
// floor, and turned to face the person. Its pose is saved relative to a
// world anchor, a point the headset keeps fixed in the real room across
// sessions, so next time the block is back on the same spot.
//
// Everything here is maths on numbers. The three.js side (reading planes,
// moving objects) lives in src/xr and calls these.

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Point2 {
  x: number;
  z: number;
}

// seated: the block goes a forearm in front of the eyes and well below them
export const SPAWN_DISTANCE = 0.45;
export const SPAWN_DROP = 0.4;

// how far a released block may fall or rise to meet a surface
export const SNAP_BELOW = 0.35;
export const SNAP_ABOVE = 0.05;

// yaw (rotation about the vertical axis) that turns +Z from `from` towards `to`
export const facingYaw = (from: Point2, to: Point2): number =>
  Math.atan2(to.x - from.x, to.z - from.z);

// headYaw is the head's rotation about the vertical axis; a head at yaw 0
// looks down -Z, like a three.js camera
export const spawnPose = (head: Vec3, headYaw: number): { position: Vec3; yaw: number } => {
  const position = {
    x: head.x - Math.sin(headYaw) * SPAWN_DISTANCE,
    y: head.y - SPAWN_DROP,
    z: head.z - Math.cos(headYaw) * SPAWN_DISTANCE,
  };
  return { position, yaw: facingYaw(position, head) };
};

// even-odd rule; the polygon is in the plane's own x/z coordinates
export const pointInPolygon = (point: Point2, polygon: readonly Point2[]): boolean => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    const crosses =
      a.z > point.z !== b.z > point.z &&
      point.x < ((b.x - a.x) * (point.z - a.z)) / (b.z - a.z) + a.x;
    if (crosses) inside = !inside;
  }
  return inside;
};

export interface SurfaceCandidate {
  height: number; // world height of a horizontal plane
  under: boolean; // the block is above the plane's outline
}

// the highest surface under the block within reach, or null to leave it be
export const pickSurface = (
  blockHeight: number,
  candidates: readonly SurfaceCandidate[],
): number | null => {
  let best: number | null = null;
  for (const { height, under } of candidates) {
    if (!under) continue;
    if (height > blockHeight + SNAP_ABOVE || height < blockHeight - SNAP_BELOW) continue;
    if (best === null || height > best) best = height;
  }
  return best;
};

// SAVED PLACEMENT: the pose relative to the anchor, and which anchor

export interface SavedPlacement {
  anchorId: string; // the anchor the pose is relative to
  position: Vec3;
  yaw: number;
}

export const PLACEMENT_KEY = 'blocti.vr.placement.v1';

const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export const parsePlacement = (raw: unknown): SavedPlacement | null => {
  const p = raw as Partial<SavedPlacement> | null;
  if (typeof p !== 'object' || p === null || typeof p.anchorId !== 'string') return null;
  const pos = p.position as Partial<Vec3> | undefined;
  if (!pos || !isNumber(pos.x) || !isNumber(pos.y) || !isNumber(pos.z) || !isNumber(p.yaw)) {
    return null;
  }
  return { anchorId: p.anchorId, position: { x: pos.x, y: pos.y, z: pos.z }, yaw: p.yaw };
};

// a saved pose only means something relative to the anchor it was saved
// against; if the headset lost that anchor, the pose is meaningless
export const placementFor = (
  saved: SavedPlacement | null,
  anchorId: string | null,
): SavedPlacement | null => (saved && anchorId && saved.anchorId === anchorId ? saved : null);

export const loadPlacement = (store: KeyValueStore | null): SavedPlacement | null =>
  readJson(store, PLACEMENT_KEY, parsePlacement);

export const savePlacement = (store: KeyValueStore | null, placement: SavedPlacement): boolean =>
  writeJson(store, PLACEMENT_KEY, placement);
