import { createComponent, Types } from '@iwsdk/core';

// Components are plain data attached to entities. Systems find entities by
// the components they carry (a query) and act on them. These three mark the
// app's own entities; they hold no behaviour.

// the block on the desk, the thing you grab to move everything
export const BlocBlock = createComponent('BlocBlock', {});

// the invisible root every panel hangs from; it follows the block
export const BlocLayout = createComponent('BlocLayout', {});

export const PANEL_ROLES = {
  Menu: 'menu',
  Focus: 'focus',
  Report: 'report',
  Card: 'card',
} as const;

export type PanelRole = (typeof PANEL_ROLES)[keyof typeof PANEL_ROLES];

// which panel an entity is: its role, and for cards, which slot (0-5)
export const BlocPanel = createComponent('BlocPanel', {
  role: { type: Types.Enum, enum: PANEL_ROLES, default: PANEL_ROLES.Card },
  slot: { type: Types.Int8, default: 0 },
});
