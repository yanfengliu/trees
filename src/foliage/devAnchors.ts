// DEV FIXTURE: synthetic leaf anchors on a sakura-like umbrella crown (radius ~4 m, centred ~5 m up).
// Used by tests and for developing foliage before the real tree generator lands. Not used by the app.
import { Vector3 } from 'three';
import type { LeafAnchor } from '../contracts';
import { createRng, range } from '../random';

export function devAnchors(seed = 1, count = 260): LeafAnchor[] {
  const rng = createRng(seed * 7919 + 13);
  const anchors: LeafAnchor[] = [];
  const centre = new Vector3(0, 5, 0);
  for (let i = 0; i < count; i++) {
    // Mostly the upper half of a flattened dome, with a ragged, drooping rim.
    const az = rng() * Math.PI * 2;
    const u = Math.pow(rng(), 0.7);
    const el = range(rng, -0.3, 1.35) * (1 - 0.25 * u);
    const r = range(rng, 0.55, 1) * 4;
    const x = Math.cos(az) * Math.cos(el) * r;
    const z = Math.sin(az) * Math.cos(el) * r;
    const y = Math.sin(el) * r * 0.62 + range(rng, -0.3, 0.3);
    const position = new Vector3(x, y, z).add(centre);
    const direction = new Vector3(x, Math.max(0.2, y * 0.8 + 0.3), z).normalize();
    const horizontal = Math.hypot(x, z) / 4;
    anchors.push({ position, direction, size: range(rng, 0.45, 0.8), sway: Math.min(1, 0.45 + 0.55 * horizontal) });
  }
  return anchors;
}
