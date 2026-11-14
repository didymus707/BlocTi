import {
  PokeInteractable,
  RayInteractable,
  type Entity,
  type Object3D,
  type UIKitDocument,
} from '@iwsdk/core';
import type { Slot } from '../bloc/layout';

// Small helpers for the UIKitML panels, so the main system reads as "what
// to show" rather than "how to poke UIKit".

// UIKitML sizes are in units of 1 cm at scale 1; at 0.05 one unit is 0.5 mm,
// so a 300-unit card is 15 cm wide and 24-unit text is 1.2 cm tall
export const PANEL_SCALE = 0.05;

export const placeAt = (object: Object3D, slot: Slot): void => {
  object.position.set(slot.x, slot.y, slot.z);
  object.rotation.set(slot.pitch, slot.yaw, 0, 'YXZ');
};

// A hidden panel must also stop catching pinches: pointer rays hit objects
// whether or not they are visible, so the interaction components go too.
export const setShown = (entity: Entity, shown: boolean): void => {
  const object = entity.object3D;
  if (object) object.visible = shown;
  if (shown) {
    if (!entity.hasComponent(RayInteractable)) entity.addComponent(RayInteractable);
    if (!entity.hasComponent(PokeInteractable)) entity.addComponent(PokeInteractable);
  } else {
    if (entity.hasComponent(RayInteractable)) entity.removeComponent(RayInteractable);
    if (entity.hasComponent(PokeInteractable)) entity.removeComponent(PokeInteractable);
  }
};

type Props = Record<string, unknown>;

// One loaded panel. Writes go through a cache, so re-rendering four times a
// second only touches elements whose text or style actually changed.
// setProperties replaces what was set before, so each element's text and
// style are merged and always written together.
export class PanelHandle {
  private readonly props = new Map<string, Props>();
  private readonly last = new Map<string, string>();

  constructor(
    readonly entity: Entity,
    private readonly document: UIKitDocument,
  ) {}

  set(id: string, props: Props): void {
    const merged = { ...this.props.get(id), ...props };
    const value = JSON.stringify(merged);
    if (this.last.get(id) === value) return;
    const element = this.document.getElementById(id);
    if (!element) return;
    element.setProperties(merged as never);
    this.props.set(id, merged);
    this.last.set(id, value);
  }

  text(id: string, text: string): void {
    this.set(id, { text });
  }

  // pinch, poke or click on an element; returns the clean-up function
  on(id: string, handler: () => void): () => void {
    const element = this.document.getElementById(id);
    if (!element) return () => {};
    element.addEventListener('click', handler);
    return () => element.removeEventListener('click', handler);
  }
}
