import {
  createSystem,
  DistanceGrabbable,
  Euler,
  Grabbed,
  Group,
  MovementMode,
  Quaternion,
  RayInteractable,
  Vector3,
  VisibilityState,
  XRAnchor,
  XRPlane,
  type Entity,
} from '@iwsdk/core';
import {
  facingYaw,
  loadPlacement,
  pickSurface,
  placementFor,
  pointInPolygon,
  savePlacement,
  spawnPose,
  type SavedPlacement,
  type SurfaceCandidate,
  type Vec3,
} from '../bloc/placement';
import { browserStore } from '../bloc/storage';
import { createBlockObject } from './block-object';
import { BlocBlock, BlocLayout } from './components';

// PLACEMENT SYSTEM: the block on the desk, and where it was last time.
//
// A system is code that runs every frame over the entities its queries
// match. This one owns two entities: the block (which you grab to move) and
// the invisible layout root that every panel hangs from. Each frame the
// layout root copies the block's pose, so moving the block moves the whole
// workspace.
//
// Persistence works through a world anchor: a point the headset tracks in
// the real room and can find again in a later session. IWSDK's scene
// understanding system keeps one such anchor and re-parents every entity
// with an XRAnchor component under it. The block's pose relative to that
// anchor is saved after every move, together with the anchor's id, so the
// next session can put it back on the same spot.

// IWSDK 1.1 saves its anchor id under this key; it is private there, so the
// value is repeated here. If an IWSDK update renames it, saved placements
// are simply not reused and the block spawns in front of you again.
const ANCHOR_ID_KEY = 'iwsdk_scene_anchor_uuid';

const SETTLE_SECONDS = 0.3; // let the head pose settle before placing
const RESTORE_SECONDS = 3; // how long to wait for last session's anchor
const SNAP_WINDOW_SECONDS = 8; // planes can arrive late; keep looking that long
const SNAP_EVERY_SECONDS = 0.5;

// in the flat browser view the block sits where the default camera sees the
// panels from the same angle a seated person would
const BROWSER_SPOT = new Vector3(0, 1.2, 0.55);

interface PlaneLike {
  polygon: ReadonlyArray<{ x: number; z: number }>;
}

const anchorId = (): string | null => {
  try {
    return globalThis.localStorage?.getItem(ANCHOR_ID_KEY) ?? null;
  } catch {
    return null;
  }
};

export class PlacementSystem extends createSystem({
  heldBlocks: { required: [BlocBlock, Grabbed] },
  planes: { required: [XRPlane] },
}) {
  private store = browserStore();
  private block!: Entity;
  private layout!: Entity;

  private placed = false;
  private sessionStartedAt = -1;
  private snapUntil = 0;
  private nextSnapAt = 0;
  private needsSave = false;
  private now = 0;

  // scratch objects, made once so update() allocates nothing
  private readonly head = new Vector3();
  private readonly headQuaternion = new Quaternion();
  private readonly euler = new Euler(0, 0, 0, 'YXZ');
  private readonly position = new Vector3();
  private readonly local = new Vector3();
  private readonly planePosition = new Vector3();
  private readonly planeUp = new Vector3();
  private readonly parentQuaternion = new Quaternion();
  private readonly yawQuaternion = new Quaternion();
  private readonly scale = new Vector3();
  private readonly up = new Vector3(0, 1, 0);

  init(): void {
    const object = createBlockObject();
    object.position.copy(BROWSER_SPOT);
    this.block = this.world.createTransformEntity(object, {
      parent: this.world.sceneEntity,
      persistent: true,
    });
    this.block.addComponent(BlocBlock);
    this.block.addComponent(XRAnchor);

    this.layout = this.world.createTransformEntity(new Group(), {
      parent: this.world.sceneEntity,
      persistent: true,
    });
    this.layout.addComponent(BlocLayout);

    const onSessionStart = () => {
      this.placed = false;
      this.sessionStartedAt = -1;
    };
    this.xrManager.addEventListener('sessionstart', onSessionStart);
    this.cleanupFuncs.push(
      () => this.xrManager.removeEventListener('sessionstart', onSessionStart),
      // let go of the block: drop it onto the desk, face you, remember it
      this.queries.heldBlocks.subscribe('disqualify', () => this.settle()),
      // runs now and on every change between the browser view and the headset
      this.world.visibilityState.subscribe(() => this.setGrabbable(this.inXR())),
    );
  }

  private inXR(): boolean {
    return this.world.visibilityState.peek() !== VisibilityState.NonImmersive;
  }

  // The block can only be moved by hand in mixed reality. The flat browser
  // view has no tracked head to turn it towards: letting go of it there
  // turned it (and every panel with it) to face away, and the panels vanished.
  private setGrabbable(on: boolean): void {
    const block = this.block;
    if (on) {
      if (!block.hasComponent(RayInteractable)) block.addComponent(RayInteractable);
      if (!block.hasComponent(DistanceGrabbable)) {
        // pinch and drag from where you sit; the block slides with your hand
        block.addComponent(DistanceGrabbable, {
          movementMode: MovementMode.MoveFromTarget,
          rotate: false,
          scale: false,
        });
      }
      return;
    }
    if (block.hasComponent(DistanceGrabbable)) block.removeComponent(DistanceGrabbable);
    if (block.hasComponent(RayInteractable)) block.removeComponent(RayInteractable);
    // back where the browser camera looks, facing it
    this.setWorldPose(BROWSER_SPOT, 0);
  }

  update(_delta: number, time: number): void {
    this.now = time;
    if (this.inXR()) {
      if (this.sessionStartedAt < 0) this.sessionStartedAt = time;
      if (!this.placed) this.tryPlace();
      else if (time < this.snapUntil && time >= this.nextSnapAt) {
        this.nextSnapAt = time + SNAP_EVERY_SECONDS;
        if (!this.block.hasComponent(Grabbed) && this.snapToSurface()) {
          this.snapUntil = 0;
          this.needsSave = true;
        }
      }
      if (this.needsSave) this.trySave();
    }
    this.followBlock();
  }

  // the panels go wherever the block goes
  private followBlock(): void {
    const block = this.block.object3D!;
    const layout = this.layout.object3D!;
    block.updateWorldMatrix(true, false);
    block.matrixWorld.decompose(layout.position, layout.quaternion, this.scale);
  }

  // last session's spot if its anchor came back, otherwise in front of you
  private tryPlace(): void {
    const waited = this.now - this.sessionStartedAt;
    if (waited < SETTLE_SECONDS) return;
    const saved = loadPlacement(this.store);
    const attached = this.block.getValue(XRAnchor, 'attached') === true;
    if (saved && !attached && waited < RESTORE_SECONDS) return;

    const usable = attached ? placementFor(saved, anchorId()) : null;
    if (usable) this.applySaved(usable);
    else this.spawn();
    this.placed = true;
  }

  private spawn(): void {
    this.player.head.getWorldPosition(this.head);
    this.player.head.getWorldQuaternion(this.headQuaternion);
    this.euler.setFromQuaternion(this.headQuaternion, 'YXZ');
    const pose = spawnPose(this.head, this.euler.y);
    this.setWorldPose(pose.position, pose.yaw);
    this.snapUntil = this.now + SNAP_WINDOW_SECONDS;
    this.nextSnapAt = this.now;
    this.needsSave = true;
  }

  private applySaved(saved: SavedPlacement): void {
    const block = this.block.object3D!;
    block.position.set(saved.position.x, saved.position.y, saved.position.z);
    block.quaternion.setFromAxisAngle(this.up, saved.yaw);
  }

  private settle(): void {
    if (!this.inXR()) return;
    this.snapToSurface();
    this.faceViewer();
    this.snapUntil = 0;
    this.needsSave = true;
  }

  // drop the block onto the highest horizontal plane under it, if any
  private snapToSurface(): boolean {
    const block = this.block.object3D!;
    block.getWorldPosition(this.position);
    const candidates: SurfaceCandidate[] = [];
    for (const entity of this.queries.planes.entities) {
      const plane = entity.getValue(XRPlane, '_plane') as PlaneLike | undefined;
      const object = entity.object3D;
      if (!plane || !object) continue;
      object.updateWorldMatrix(true, false);
      // a plane's own y axis is its normal; keep the ones facing up
      this.planeUp.set(0, 1, 0).transformDirection(object.matrixWorld);
      if (this.planeUp.y < 0.9) continue;
      this.local.copy(this.position);
      object.worldToLocal(this.local);
      candidates.push({
        height: this.planePosition.setFromMatrixPosition(object.matrixWorld).y,
        under: pointInPolygon({ x: this.local.x, z: this.local.z }, plane.polygon),
      });
    }
    const height = pickSurface(this.position.y, candidates);
    if (height === null) return false;
    this.position.y = height;
    this.euler.setFromQuaternion(block.getWorldQuaternion(this.headQuaternion), 'YXZ');
    this.setWorldPose(this.position, this.euler.y);
    return true;
  }

  private faceViewer(): void {
    const block = this.block.object3D!;
    block.getWorldPosition(this.position);
    this.player.head.getWorldPosition(this.head);
    this.setWorldPose(this.position, facingYaw(this.position, this.head));
  }

  // set a world position and an upright world yaw, whatever the parent is
  private setWorldPose(position: Vec3, yaw: number): void {
    const block = this.block.object3D!;
    const parent = block.parent;
    this.local.set(position.x, position.y, position.z);
    this.yawQuaternion.setFromAxisAngle(this.up, yaw);
    if (parent) {
      parent.updateWorldMatrix(true, false);
      parent.worldToLocal(this.local);
      parent.getWorldQuaternion(this.parentQuaternion).invert();
      this.yawQuaternion.premultiply(this.parentQuaternion);
    }
    block.position.copy(this.local);
    block.quaternion.copy(this.yawQuaternion);
  }

  // save the pose relative to the anchor, once there is an anchor to save against
  private trySave(): void {
    const id = anchorId();
    if (!id || this.block.getValue(XRAnchor, 'attached') !== true) return;
    const block = this.block.object3D!;
    this.euler.setFromQuaternion(block.quaternion, 'YXZ');
    savePlacement(this.store, {
      anchorId: id,
      position: { x: block.position.x, y: block.position.y, z: block.position.z },
      yaw: this.euler.y,
    });
    this.needsSave = false;
  }
}
