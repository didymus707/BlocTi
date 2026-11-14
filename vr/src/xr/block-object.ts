import { Group, Mesh, MeshStandardMaterial } from '@iwsdk/core';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

// The block you see on the desk: a small rounded slab with a lighter top.
// Its origin is the middle of its bottom face, so setting its height to a
// desk's height puts it on the desk, not halfway into it.

export const BLOCK_SIZE = { width: 0.12, height: 0.03, depth: 0.08 };

export const createBlockObject = (): Group => {
  const { width, height, depth } = BLOCK_SIZE;
  const group = new Group();
  group.name = 'Block';

  const body = new Mesh(
    new RoundedBoxGeometry(width, height, depth, 3, 0.008),
    new MeshStandardMaterial({ color: 0x2b2e35, roughness: 0.6, metalness: 0.1 }),
  );
  body.position.y = height / 2;
  group.add(body);

  // a yellow strip on top, so it reads as something to pick up
  const strip = new Mesh(
    new RoundedBoxGeometry(width * 0.7, 0.004, depth * 0.25, 2, 0.002),
    new MeshStandardMaterial({ color: 0xf5d90a, roughness: 0.4, emissive: 0x3a3300 }),
  );
  strip.position.y = height + 0.001;
  group.add(strip);

  return group;
};
