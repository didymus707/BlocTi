import { SPAWN_DISTANCE, SPAWN_DROP, type Vec3 } from './placement';

// LAYOUT: where each panel sits around the block, in the block's own frame.
//
// The block sits on the desk with +Z pointing at the person and +Y up, so
// the person's eyes are about SPAWN_DISTANCE in front and SPAWN_DROP above
// it. Every panel is placed within arm's reach of those eyes and turned to
// face them. The timer sits just above the block, so it stays in the middle
// of the view while the person looks down at the desk.

export interface Slot extends Vec3 {
  yaw: number; // turn about the vertical axis, towards the eyes
  pitch: number; // tilt back, towards the eyes (negative = top leans away)
}

// where the eyes are, seen from the block
export const VIEWER: Vec3 = { x: 0, y: SPAWN_DROP, z: SPAWN_DISTANCE };

export const MAX_CARDS = 6;
const COLUMNS = 3;
const COLUMN_GAP = 0.15; // card centres, metres
const ROWS = [
  { y: 0.25, z: -0.03 },
  { y: 0.35, z: -0.08 },
];

// turn a point so a panel there faces the viewer
const facing = (point: Vec3): Slot => {
  const dx = VIEWER.x - point.x;
  const dy = VIEWER.y - point.y;
  const dz = VIEWER.z - point.z;
  return {
    ...point,
    yaw: Math.atan2(dx, dz),
    pitch: -Math.atan2(dy, Math.hypot(dx, dz)),
  };
};

// the timer's bottom edge clears the block, so the block stays in sight
export const FOCUS_SLOT: Slot = facing({ x: 0, y: 0.12, z: 0.05 });
export const BOARD_SLOT: Slot = facing({ x: 0, y: 0.28, z: -0.05 }); // menu and report

// cards fill rows of three, front row first; a short last row is centred
export const cardSlots = (count: number): Slot[] => {
  const n = Math.max(0, Math.min(MAX_CARDS, Math.floor(count)));
  const slots: Slot[] = [];
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / COLUMNS);
    const inRow = Math.min(COLUMNS, n - row * COLUMNS);
    const column = i % COLUMNS;
    const x = (column - (inRow - 1) / 2) * COLUMN_GAP;
    slots.push(facing({ x, ...ROWS[row] }));
  }
  return slots;
};

export const distance = (a: Vec3, b: Vec3): number =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

// angle in radians between two directions seen from `eye`
export const angleBetween = (eye: Vec3, a: Vec3, b: Vec3): number => {
  const u = { x: a.x - eye.x, y: a.y - eye.y, z: a.z - eye.z };
  const v = { x: b.x - eye.x, y: b.y - eye.y, z: b.z - eye.z };
  const dot = u.x * v.x + u.y * v.y + u.z * v.z;
  const cos = dot / (Math.hypot(u.x, u.y, u.z) * Math.hypot(v.x, v.y, v.z));
  return Math.acos(Math.min(1, Math.max(-1, cos)));
};
