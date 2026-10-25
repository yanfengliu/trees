// Low-poly geometry builders for blossoms, leaves and petals. All non-indexed so each face keeps its own colour.
import { BufferGeometry, Float32BufferAttribute, IcosahedronGeometry, Vector3 } from 'three';
import { createRng, range, type Rng } from '../random';

/** Deterministic jitter from a position, so duplicated vertices of a non-indexed mesh move together (no cracks). */
function hash3(x: number, y: number, z: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * A blossom puff: several jittered icosahedra merged into one lumpy, faceted bunch, about 1 unit in radius.
 * Faces carry a baked colour: a little per-face variation (some petals paler) and darker undersides (fake occlusion).
 */
export function createPuffGeometry(seed: number, lobes = 6): BufferGeometry {
  const rng = createRng(seed);
  const positions: number[] = [];
  const colors: number[] = [];
  const base = new IcosahedronGeometry(1, 0);
  const src = base.getAttribute('position');
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  const n = new Vector3();
  for (let l = 0; l < lobes; l++) {
    let centre: Vector3;
    let radius: number;
    if (l === 0) {
      centre = new Vector3(0, 0.08, 0);
      radius = 0.58;
    } else {
      const az = (l / (lobes - 1)) * Math.PI * 2 + range(rng, -0.5, 0.5);
      const el = range(rng, -0.35, 0.6);
      const d = range(rng, 0.45, 0.6);
      centre = new Vector3(Math.cos(az) * Math.cos(el) * d, Math.sin(el) * d * 0.8, Math.sin(az) * Math.cos(el) * d);
      radius = range(rng, 0.34, 0.44);
    }
    const tilt = range(rng, 0, Math.PI * 2);
    const ct = Math.cos(tilt);
    const st = Math.sin(tilt);
    const tri: Vector3[] = [a, b, c];
    for (let i = 0; i < src.count; i += 3) {
      for (let k = 0; k < 3; k++) {
        const v = tri[k];
        v.fromBufferAttribute(src, i + k);
        // Rotate about Y so lobes do not share facet orientation.
        const x = v.x * ct - v.z * st;
        const z = v.x * st + v.z * ct;
        v.set(x, v.y, z);
        const j = 0.86 + 0.24 * hash3(v.x + l * 3.1, v.y, v.z);
        v.multiplyScalar(radius * j).add(centre);
      }
      n.subVectors(c, b).cross(new Vector3().subVectors(a, b)).normalize();
      // Baked shade: undersides deeper; some faces a deeper rose (petal hearts), some left pale.
      const under = 0.74 + 0.26 * Math.min(1, Math.max(0, n.y * 0.5 + 0.6));
      const roll = rng();
      const tint = roll < 0.2 ? [1, 0.84, 0.9] : roll < 0.45 ? [1, 0.95, 0.97] : [1, 1, 1];
      const lift = range(rng, 0.95, 1.03);
      for (const v of tri) {
        positions.push(v.x, v.y, v.z);
        colors.push(Math.min(1, under * lift * tint[0]), Math.min(1, under * lift * tint[1]), Math.min(1, under * lift * tint[2]));
      }
    }
  }
  base.dispose();
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(positions, 3));
  g.setAttribute('color', new Float32BufferAttribute(colors, 3));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

/** A sprig of three folded low-poly leaves pointing along +Y from the origin, about 0.3 units long. 12 triangles. */
export function createSprigGeometry(): BufferGeometry {
  const positions: number[] = [];
  const leaf = (angle: number, tiltOut: number, len: number) => {
    const w = len * 0.28;
    // Leaf in its own frame: base at 0, tip at +Y, folded along the midrib (centre ridge raised in +Z).
    const pts = [
      [0, 0, 0],
      [-w, len * 0.45, 0],
      [0, len * 0.5, w * 0.35],
      [0, len, 0],
      [w, len * 0.45, 0],
    ];
    const ca = Math.cos(angle);
    const sa = Math.sin(angle);
    const ct = Math.cos(tiltOut);
    const st = Math.sin(tiltOut);
    const tr = ([x, y, z]: number[]) => {
      // Tilt away from the stem (around X), then spin around Y.
      const y1 = y * ct - z * st;
      const z1 = y * st + z * ct;
      return [x * ca + z1 * sa, y1, -x * sa + z1 * ca];
    };
    const p = pts.map(tr);
    const faces = [
      [0, 1, 2],
      [0, 2, 4],
      [1, 3, 2],
      [2, 3, 4],
    ];
    for (const f of faces) for (const i of f) positions.push(...p[i]);
  };
  leaf(0, 0.35, 0.32);
  leaf(2.2, 0.75, 0.26);
  leaf(-2.1, 0.7, 0.28);
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(positions, 3));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

/** A single petal: a slightly cupped teardrop of 4 triangles in the XZ plane, about 1 unit long. */
export function createPetalGeometry(): BufferGeometry {
  const p = [
    [0, 0, -0.5],
    [-0.36, 0.06, -0.05],
    [0, 0.1, 0.05],
    [0.36, 0.06, -0.05],
    [0, 0.02, 0.5],
  ];
  const faces = [
    [0, 2, 1],
    [0, 3, 2],
    [1, 2, 4],
    [2, 3, 4],
  ];
  const positions: number[] = [];
  for (const f of faces) for (const i of f) positions.push(...p[i]);
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(positions, 3));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length) % items.length];
}
