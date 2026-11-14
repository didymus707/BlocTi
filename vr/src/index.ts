import { World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { BlocSystem } from './xr/bloc-system.js';
import { PlacementSystem } from './xr/placement-system.js';

// iwsdk.config.json holds the world options (passthrough, hands, planes,
// anchors); the virtual module hands them over as one object.
World.create(
  document.getElementById('scene-container') as HTMLDivElement,
  projectOptions,
).then((world) => {
  // placement first: it makes the layout root the panels hang from
  world.registerSystem(PlacementSystem);
  world.registerSystem(BlocSystem);
});
