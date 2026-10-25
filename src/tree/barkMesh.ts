// Low-poly bark: one continuous faceted tube per branch, all merged into a single non-indexed geometry
// so each facet gets its own flat colour. Child tubes start on the parent's axis, so their open base is
// buried inside the parent and forks never show a crack.
import { BufferAttribute, BufferGeometry, Color, Vector3 } from 'three';
import type { Rng } from '../random';
import type { SkelBranch } from './skeleton';

const RADIAL = [7, 6, 5, 4, 3];
const BUMP = [0.13, 0.12, 0.09, 0.05, 0];

const BARK = new Color().setHex(0x564640); // dark warm grey-brown
const BARK_OLD = new Color().setHex(0x524742); // greyer on the trunk and thick limbs
const TWIG = new Color().setHex(0x683f33); // young wood is redder

export function buildBarkGeometry(branches: SkelBranch[], rng: Rng, maxSway: number): BufferGeometry {
  let tris = 0;
  for (const b of branches) {
    const radial = RADIAL[Math.min(b.level, RADIAL.length - 1)];
    tris += (b.nodes.length - 1) * radial * 2 + radial;
  }
  const pos = new Float32Array(tris * 9);
  const col = new Float32Array(tris * 9);
  const sway = new Float32Array(tris * 3);
  let v = 0;

  const ring: Vector3[] = [];
  const t = new Vector3();
  const n = new Vector3();
  const bn = new Vector3();
  const prevT = new Vector3();
  const c = new Color();
  const tmp = new Color();

  const push = (p: Vector3, s: number, color: Color) => {
    pos[v * 3] = p.x; pos[v * 3 + 1] = p.y; pos[v * 3 + 2] = p.z;
    col[v * 3] = color.r; col[v * 3 + 1] = color.g; col[v * 3 + 2] = color.b;
    sway[v] = s;
    v++;
  };

  for (const b of branches) {
    const level = Math.min(b.level, RADIAL.length - 1);
    const radial = RADIAL[level];
    const bump = BUMP[level];
    const nodes = b.nodes;
    const rings: Vector3[][] = [];
    const twist = rng() * Math.PI * 2;
    // Parallel-transport frame keeps rings from twisting along the tube.
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[Math.max(i - 1, 0)].p;
      const z = nodes[Math.min(i + 1, nodes.length - 1)].p;
      t.subVectors(z, a).normalize();
      if (i === 0) {
        n.crossVectors(t, Math.abs(t.y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0)).normalize();
      } else {
        const axis = new Vector3().crossVectors(prevT, t);
        const sin = axis.length();
        if (sin > 1e-6) n.applyAxisAngle(axis.divideScalar(sin), Math.asin(Math.min(1, sin)));
        n.addScaledVector(t, -n.dot(t)).normalize();
      }
      prevT.copy(t);
      bn.crossVectors(t, n);
      ring.length = 0;
      const r = nodes[i].r;
      const rootFlare = b.level === 0 && i <= 1;
      const row: Vector3[] = [];
      for (let k = 0; k < radial; k++) {
        const ang = twist + (k / radial) * Math.PI * 2;
        let rr = r * (1 + (rng() * 2 - 1) * bump);
        if (rootFlare) rr *= 1 + (i === 0 ? 0.55 : 0.2) * rng();
        row.push(nodes[i].p.clone().addScaledVector(n, Math.cos(ang) * rr).addScaledVector(bn, Math.sin(ang) * rr));
      }
      rings.push(row);
    }

    const base = level <= 1 ? (level === 0 ? BARK_OLD : BARK) : level === 2 ? BARK : TWIG;
    const s = (i: number) => Math.min(1, nodes[i].sway / maxSway);
    for (let i = 0; i < nodes.length - 1; i++) {
      const rowShade = 0.92 + 0.12 * rng();
      const lowDark = b.level === 0 ? 0.75 + 0.25 * Math.min(1, Math.max(0, nodes[i].p.y + 0.3)) : 1;
      const s0 = s(i);
      const s1 = s(i + 1);
      for (let k = 0; k < radial; k++) {
        const k1 = (k + 1) % radial;
        const shade = rowShade * lowDark * (0.86 + 0.24 * rng());
        c.copy(base).multiplyScalar(shade);
        if (rng() < 0.12 && level <= 2) c.lerp(tmp.setRGB(0.09, 0.085, 0.08), 0.5); // pale lenticel patch
        const a0 = rings[i][k], a1 = rings[i][k1], b0 = rings[i + 1][k], b1 = rings[i + 1][k1];
        push(a0, s0, c); push(a1, s0, c); push(b0, s1, c);
        push(a1, s0, c); push(b1, s1, c); push(b0, s1, c);
      }
    }
    // Close the tip with a short cone.
    const last = nodes.length - 1;
    const tipDir = nodes[last].p.clone().sub(nodes[last - 1].p).normalize();
    const tip = nodes[last].p.clone().addScaledVector(tipDir, nodes[last].r * (b.level === 0 ? 0.5 : 4));
    const st = s(last);
    for (let k = 0; k < radial; k++) {
      c.copy(base).multiplyScalar(0.9 + 0.2 * rng());
      push(rings[last][k], st, c); push(rings[last][(k + 1) % radial], st, c); push(tip, st, c);
    }
  }

  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('color', new BufferAttribute(col, 3));
  g.setAttribute('aSway', new BufferAttribute(sway, 1));
  g.computeVertexNormals();
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}
