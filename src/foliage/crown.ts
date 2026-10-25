// Crown extent measured from the leaf anchors.
import { Vector3 } from 'three';
import type { LeafAnchor } from '../contracts';

export interface CrownShape {
  centre: Vector3;
  /** Largest horizontal anchor distance from the centre, metres. */
  radius: number;
  minY: number;
  maxY: number;
  height: number;
}

export function measureCrown(anchors: LeafAnchor[]): CrownShape {
  if (!anchors.length) return { centre: new Vector3(), radius: 0, minY: 0, maxY: 0, height: 0 };
  const centre = new Vector3();
  let minY = Infinity;
  let maxY = -Infinity;
  for (const a of anchors) {
    centre.add(a.position);
    minY = Math.min(minY, a.position.y);
    maxY = Math.max(maxY, a.position.y);
  }
  centre.divideScalar(anchors.length);
  let radius = 0;
  for (const a of anchors) radius = Math.max(radius, Math.hypot(a.position.x - centre.x, a.position.z - centre.z) + a.size);
  return { centre, radius, minY, maxY, height: maxY - minY };
}
