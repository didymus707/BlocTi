import { World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { PlacementSystem } from './xr/placement-system.js';

// iwsdk.config.json holds the world options (passthrough, hands, planes,
// anchors); the virtual module hands them over as one object.
World.create(
  document.getElementById('scene-container') as HTMLDivElement,
  projectOptions,
).then((world) => {
  world.registerSystem(PlacementSystem);
});
