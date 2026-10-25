// Blossom clusters and leaf sprigs at the tree's leaf anchors, as two InstancedMeshes.
import { Color, DoubleSide, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import type { LeafAnchor, WindUniforms } from '../contracts';
import { range, type Rng } from '../random';
import { applyWind, applyWindShadows, disposeWindShadows } from '../wind/wind';
import { createPuffGeometry, createSprigGeometry } from './geometry';
import type { CrownShape } from './crown';

/** Sakura palette from near-white to deeper pink, in sRGB. Weighted towards the pale end, as real blossom reads. */
export const BLOSSOM_PALETTE = ['#ffe9f0', '#ffdbe7', '#fdcadb', '#f9b4cb', '#f49cba', '#ea80a6'] as const;
const PALETTE_WEIGHTS = [0.14, 0.22, 0.24, 0.2, 0.13, 0.07];
export const LEAF_PALETTE = ['#a8d46a', '#8cc152', '#c2e07a'] as const;

/** Hard cap so foliage stays inside the triangle budget whatever the tree gives us. */
export const MAX_CLUSTERS = 540;
/** Clusters per anchor at leafDensity 1 (before the cap). */
export const CLUSTERS_PER_ANCHOR = 1.6;

export function clusterCount(anchorCount: number, leafDensity: number): number {
  const density = Math.max(0, Math.min(1, leafDensity));
  return Math.round(Math.min(MAX_CLUSTERS, anchorCount * CLUSTERS_PER_ANCHOR) * density);
}

function weightedPick(rng: Rng): number {
  let r = rng();
  for (let i = 0; i < PALETTE_WEIGHTS.length; i++) {
    r -= PALETTE_WEIGHTS[i];
    if (r <= 0) return i;
  }
  return PALETTE_WEIGHTS.length - 1;
}

export interface BlossomMeshes {
  blossoms: InstancedMesh;
  leaves: InstancedMesh;
  dispose(): void;
}

export function createBlossoms(anchors: LeafAnchor[], leafDensity: number, crown: CrownShape, rng: Rng, wind: WindUniforms): BlossomMeshes {
  const count = anchors.length ? clusterCount(anchors.length, leafDensity) : 0;
  // When the tree offers more anchors than the cap allows, grow the clusters we do place so the crown stays full.
  const fill = Math.min(1.6, Math.max(1, Math.cbrt((anchors.length * CLUSTERS_PER_ANCHOR) / MAX_CLUSTERS)));
  // Visit anchors in a seeded shuffled order so a low density thins the crown evenly instead of losing one side.
  const order = anchors.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  const puff = createPuffGeometry(Math.floor(rng() * 1e9));
  const blossomMat = applyWind(
    new MeshStandardMaterial({ color: 0xffffff, vertexColors: true, flatShading: true, roughness: 0.78, metalness: 0, emissive: new Color('#f7c6d4'), emissiveIntensity: 0.14 }),
    wind,
    { flutter: 1.4 },
  );
  const blossoms = new InstancedMesh(puff, blossomMat, Math.max(1, count));
  blossoms.count = count;
  blossoms.name = 'blossoms';
  blossoms.castShadow = true;
  blossoms.receiveShadow = true;
  applyWindShadows(blossoms, wind, { flutter: 1.4 });

  const sway = new Float32Array(Math.max(1, count));
  const m = new Matrix4();
  const q = new Quaternion();
  const s = new Vector3();
  const p = new Vector3();
  const up = new Vector3(0, 1, 0);
  const tmp = new Vector3();
  const color = new Color();
  const palette = BLOSSOM_PALETTE.map((c) => new Color(c));
  const leafSpots: { pos: Vector3; out: Vector3; sway: number; size: number }[] = [];

  for (let i = 0; i < count; i++) {
    const anchor = anchors[order[i % order.length]];
    const repeat = Math.floor(i / order.length);
    const size = anchor.size * fill * range(rng, 0.85, 1.25) * (repeat > 0 ? 0.8 : 1);
    // Extra clusters around the same anchor spread sideways and droop, filling gaps between anchors.
    const spread = repeat === 0 ? 0.25 : 0.75;
    p.set(range(rng, -1, 1), range(rng, -0.6, 0.35), range(rng, -1, 1)).multiplyScalar(size * spread).add(anchor.position);
    p.addScaledVector(anchor.direction, size * 0.25);
    q.setFromAxisAngle(up, rng() * Math.PI * 2);
    tmp.set(range(rng, -1, 1), 0, range(rng, -1, 1)).normalize();
    q.premultiply(new Quaternion().setFromAxisAngle(tmp, range(rng, -0.35, 0.35)));
    // Flattened, slightly drooping bunches layer like a sakura canopy rather than stacking like balls.
    s.set(size * range(rng, 1.0, 1.25), size * range(rng, 0.72, 0.9), size * range(rng, 1.0, 1.25));
    m.compose(p, q, s);
    blossoms.setMatrixAt(i, m);
    sway[i] = anchor.sway;

    // Colour: palette pick, then lighter at the sunny crown top and outer shell, deeper inside and underneath.
    color.copy(palette[weightedPick(rng)]);
    const height01 = crown.height > 0 ? (p.y - crown.minY) / crown.height : 0.5;
    const outer = crown.radius > 0 ? Math.min(1, Math.hypot(p.x - crown.centre.x, p.z - crown.centre.z) / crown.radius) : 0.5;
    const depth = Math.min(1, 0.55 * height01 + 0.45 * outer);
    const light = 0.8 + 0.22 * depth;
    color.multiplyScalar(light);
    color.offsetHSL(range(rng, -0.012, 0.012), 0, range(rng, -0.02, 0.02));
    blossoms.setColorAt(i, color);

    if (rng() < 0.08) leafSpots.push({ pos: p.clone(), out: anchor.direction.clone(), sway: anchor.sway, size });
  }
  puff.setAttribute('aSway', new InstancedBufferAttribute(sway, 1));
  blossoms.instanceMatrix.needsUpdate = true;
  if (blossoms.instanceColor) blossoms.instanceColor.needsUpdate = true;
  blossoms.computeBoundingSphere();
  if (blossoms.boundingSphere) blossoms.boundingSphere.radius += 1; // room for wind sway

  // Fresh green leaves, sparingly: a few sprigs poking out of some clusters.
  const sprig = createSprigGeometry();
  const leafCount = leafSpots.length * 2;
  const leafMat = applyWind(new MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.7, side: DoubleSide }), wind, { flutter: 2 });
  const leaves = new InstancedMesh(sprig, leafMat, Math.max(1, leafCount));
  leaves.count = leafCount;
  leaves.name = 'blossom-leaves';
  leaves.castShadow = true;
  leaves.receiveShadow = true;
  applyWindShadows(leaves, wind, { flutter: 2 });
  const leafSway = new Float32Array(Math.max(1, leafCount));
  const greens = LEAF_PALETTE.map((c) => new Color(c));
  const dir = new Vector3();
  for (let i = 0; i < leafCount; i++) {
    const spot = leafSpots[i >> 1];
    // Point outward-ish from the cluster, with a downward lean so they hang from beneath the blossom.
    dir.set(range(rng, -1, 1), range(rng, -0.6, 0.5), range(rng, -1, 1)).normalize().addScaledVector(spot.out, 0.6).normalize();
    p.copy(spot.pos).addScaledVector(dir, spot.size * range(rng, 0.55, 0.85));
    q.setFromUnitVectors(up, dir);
    q.multiply(new Quaternion().setFromAxisAngle(up, rng() * Math.PI * 2));
    const ls = range(rng, 0.9, 1.4);
    s.set(ls, ls, ls);
    m.compose(p, q, s);
    leaves.setMatrixAt(i, m);
    leafSway[i] = spot.sway;
    color.copy(greens[Math.floor(rng() * greens.length) % greens.length]).multiplyScalar(range(rng, 0.85, 1.05));
    leaves.setColorAt(i, color);
  }
  sprig.setAttribute('aSway', new InstancedBufferAttribute(leafSway, 1));
  leaves.instanceMatrix.needsUpdate = true;
  if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
  leaves.computeBoundingSphere();
  if (leaves.boundingSphere) leaves.boundingSphere.radius += 1;

  return {
    blossoms,
    leaves,
    dispose() {
      puff.dispose();
      blossomMat.dispose();
      disposeWindShadows(blossoms);
      blossoms.dispose();
      sprig.dispose();
      leafMat.dispose();
      disposeWindShadows(leaves);
      leaves.dispose();
    },
  };
}
