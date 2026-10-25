// Low-poly geometry builders for blossoms, leaves and petals. All non-indexed so each face keeps its own colour.
import { BufferGeometry, Float32BufferAttribute, IcosahedronGeometry, OctahedronGeometry, Vector3 } from 'three';
import { createRng, range, type Rng } from '../random';

/** Deterministic jitter from a position, so duplicated vertices of a non-indexed mesh move together (no cracks). */
function hash3(x: number, y: number, z: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * A blossom puff, about 1 unit in radius: a faceted core, a few mid-size lobes and a ring of small lobes on the outside,
 * merged into one lumpy bunch. The small outer lobes give the crown's silhouette finer facets than its body.
 * Faces carry a baked colour: deeper pink on undersides (fake occlusion), paler on the small outer lobes, some rose faces.
 * 128 triangles.
 */
export function createPuffGeometry(seed: number): BufferGeometry {
  const rng = createRng(seed);
  const positions: number[] = [];
  const colors: number[] = [];
  const ico = new IcosahedronGeometry(1, 0);
  const oct = new OctahedronGeometry(1, 0);
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  const n = new Vector3();
  const e1 = new Vector3();
  const lobes: { centre: Vector3; radius: number; geo: BufferGeometry; pale: number }[] = [];
  lobes.push({ centre: new Vector3(0, 0.06, 0), radius: 0.56, geo: ico, pale: 0 });
  for (let l = 0; l < 3; l++) {
    const az = (l / 3) * Math.PI * 2 + range(rng, -0.4, 0.4);
    const el = range(rng, -0.25, 0.55);
    const d = range(rng, 0.38, 0.52);
    lobes.push({ centre: new Vector3(Math.cos(az) * Math.cos(el) * d, Math.sin(el) * d * 0.8, Math.sin(az) * Math.cos(el) * d), radius: range(rng, 0.32, 0.42), geo: ico, pale: 0.3 });
  }
  for (let l = 0; l < 6; l++) {
    const az = (l / 6) * Math.PI * 2 + Math.PI / 6 + range(rng, -0.35, 0.35);
    const el = range(rng, -0.45, 0.75);
    const d = range(rng, 0.6, 0.78);
    lobes.push({ centre: new Vector3(Math.cos(az) * Math.cos(el) * d, Math.sin(el) * d * 0.75, Math.sin(az) * Math.cos(el) * d), radius: range(rng, 0.17, 0.27), geo: oct, pale: 1 });
  }
  const tri: Vector3[] = [a, b, c];
  lobes.forEach(({ centre, radius, geo, pale }, l) => {
    const src = geo.getAttribute('position');
    const tilt = range(rng, 0, Math.PI * 2);
    const ct = Math.cos(tilt);
    const st = Math.sin(tilt);
    const tip = range(rng, -0.5, 0.5);
    const cx = Math.cos(tip);
    const sx = Math.sin(tip);
    for (let i = 0; i < src.count; i += 3) {
      for (let k = 0; k < 3; k++) {
        const v = tri[k];
        v.fromBufferAttribute(src, i + k);
        // Rotate about Y and tip about X so lobes do not share facet orientation.
        const x = v.x * ct - v.z * st;
        const z0 = v.x * st + v.z * ct;
        const y = v.y * cx - z0 * sx;
        const z = v.y * sx + z0 * cx;
        v.set(x, y, z);
        const j = 0.84 + 0.28 * hash3(v.x + l * 3.1, v.y, v.z);
        v.multiplyScalar(radius * j).add(centre);
      }
      n.subVectors(c, b).cross(e1.subVectors(a, b)).normalize();
      // Undersides go a deeper, cooler pink rather than grey; tops and small outer lobes stay near-white.
      const up = Math.min(1, Math.max(0, n.y * 0.55 + 0.55));
      const roll = rng();
      const rose = roll < 0.12 ? 1 : 0;
      const bright = (0.86 + 0.14 * up) * range(rng, 0.97, 1.03) * (1 + 0.04 * pale);
      const deep = (1 - up) * 0.7 + rose * 0.45;
      const r = Math.min(1, bright * (1 - 0.02 * deep));
      const g = Math.min(1, bright * (1 - 0.15 * deep));
      const bl = Math.min(1, bright * (1 - 0.1 * deep));
      for (const v of tri) {
        positions.push(v.x, v.y, v.z);
        colors.push(r, g, bl);
      }
    }
  });
  ico.dispose();
  oct.dispose();
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
