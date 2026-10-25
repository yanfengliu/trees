// Branch skeleton for a cherry blossom (sakura) tree: a short stout trunk that forks low into a few
// thick limbs arching outward, carrying secondary branches and fine twigs that fill a broad dome.
// Pure function of (seed, age): all randomness comes from the supplied Rng, consumed in a fixed order.
import { Vector3 } from 'three';
import { range, type Rng } from '../random';

export interface SkelNode {
  /** Point on the branch axis. */
  p: Vector3;
  /** Tube radius at this node. */
  r: number;
  /** Raw (unnormalised) sway accumulated from the trunk base; normalised to 0..1 later. */
  sway: number;
}

export interface SkelBranch {
  /** 0 trunk, 1 scaffold limb, 2 secondary branch, 3 twig, 4 fine twig. */
  level: number;
  nodes: SkelNode[];
}

export interface Skeleton {
  branches: SkelBranch[];
  /** Tips and outer twig points where blossom clusters belong. */
  blossomPoints: { node: SkelNode; dir: Vector3; level: number }[];
}

const UP = new Vector3(0, 1, 0);
const TAU = Math.PI * 2;
const GOLDEN = 2.39996; // golden angle in radians

function randUnit(rng: Rng, out: Vector3): Vector3 {
  const z = rng() * 2 - 1;
  const a = rng() * TAU;
  const s = Math.sqrt(1 - z * z);
  return out.set(s * Math.cos(a), z, s * Math.sin(a));
}

/** Any unit vector perpendicular to `t`. */
function perpendicular(t: Vector3, out: Vector3): Vector3 {
  const helper = Math.abs(t.y) < 0.9 ? UP : new Vector3(1, 0, 0);
  return out.crossVectors(t, helper).normalize();
}

/** Horizontal unit direction pointing away from the trunk axis at `p`, falling back to `d`'s heading. */
function outward(p: Vector3, d: Vector3, out: Vector3): Vector3 {
  out.set(p.x, 0, p.z);
  if (out.lengthSq() < 0.04) out.set(d.x, 0, d.z);
  if (out.lengthSq() < 1e-6) out.set(1, 0, 0);
  return out.normalize();
}

type Tropism = (d: Vector3, p: Vector3, t: number) => void;

interface GrowSpec {
  start: Vector3;
  dir: Vector3;
  length: number;
  r0: number;
  r1: number;
  segs: number;
  gnarl: number;
  sway0: number;
  level: number;
  tropism: Tropism;
}

const tmpA = new Vector3();

function grow(rng: Rng, s: GrowSpec): SkelBranch {
  const nodes: SkelNode[] = [{ p: s.start.clone(), r: s.r0, sway: s.sway0 }];
  const d = s.dir.clone().normalize();
  const p = s.start.clone();
  const segLen = s.length / s.segs;
  let sway = s.sway0;
  // A slowly drifting bend gives limbs long, gentle curves; a little jitter on top makes them gnarled.
  const wander = randUnit(rng, new Vector3());
  for (let i = 1; i <= s.segs; i++) {
    const t = i / s.segs;
    s.tropism(d, p, t);
    wander.lerp(randUnit(rng, tmpA), 0.4).normalize();
    d.addScaledVector(wander, s.gnarl).addScaledVector(randUnit(rng, tmpA), s.gnarl * 0.35).normalize();
    p.addScaledVector(d, segLen);
    const r = s.r0 + (s.r1 - s.r0) * Math.pow(t, 0.85);
    // Thin wood bends more: sway grows with length divided by thickness, so thick limbs stay low.
    sway += segLen / (r + 0.025);
    nodes.push({ p: p.clone(), r, sway });
  }
  return { level: s.level, nodes };
}

/** Interpolate a node at parameter t (0..1) along a branch. */
function sample(b: SkelBranch, t: number): { p: Vector3; r: number; sway: number; dir: Vector3 } {
  const n = b.nodes.length - 1;
  const f = Math.min(Math.max(t, 0), 1) * n;
  const i = Math.min(Math.floor(f), n - 1);
  const u = f - i;
  const a = b.nodes[i];
  const c = b.nodes[i + 1];
  return {
    p: a.p.clone().lerp(c.p, u),
    r: a.r + (c.r - a.r) * u,
    sway: a.sway + (c.sway - a.sway) * u,
    dir: c.p.clone().sub(a.p).normalize(),
  };
}

/** Direction `theta` radians away from `axis`, rotated `phi` around it. */
function spread(axis: Vector3, theta: number, phi: number): Vector3 {
  const n = perpendicular(axis, new Vector3());
  const b = new Vector3().crossVectors(axis, n);
  const side = n.multiplyScalar(Math.cos(phi)).addScaledVector(b, Math.sin(phi));
  return axis.clone().multiplyScalar(Math.cos(theta)).addScaledVector(side, Math.sin(theta)).normalize();
}

/** Steer `d` toward `target` by `w`. */
function steer(d: Vector3, target: Vector3, w: number): void {
  d.lerp(target, w).normalize();
}

export function buildSkeleton(rng: Rng, age: number): Skeleton {
  const a = Math.min(Math.max(age, 0), 1);
  const S = 0.32 + 0.78 * a; // overall size
  const density = 0.45 + 0.55 * a; // branch-count multiplier
  const branches: SkelBranch[] = [];
  const blossomPoints: Skeleton['blossomPoints'] = [];

  // Crown envelope: a broad dome, much wider than tall. Branches that poke out of it are bent outward and down.
  const crownR = range(rng, 5.0, 6.2) * S;
  const crownTop = range(rng, 5.2, 6.2) * S;
  const domeBase = crownTop * 0.3;
  const domeH = crownTop - domeBase;

  const lean = randUnit(rng, new Vector3()).setY(0).normalize().multiplyScalar(range(rng, 0.04, 0.14));
  const trunkUp = UP.clone().add(lean).normalize();
  const trunkR = 0.05 + 0.32 * Math.pow(a, 1.1);
  const trunkH = range(rng, 0.9, 1.4) * (0.4 + 0.6 * S);

  const trunk = grow(rng, {
    start: new Vector3(0, -0.2 * S, 0),
    dir: trunkUp,
    length: trunkH + 0.2 * S,
    r0: trunkR,
    r1: trunkR * 0.85,
    segs: 6,
    gnarl: 0.05,
    sway0: 0,
    level: 0,
    tropism: (d) => steer(d, trunkUp, 0.3),
  });
  // Swell the base into a root flare.
  for (const n of trunk.nodes) {
    const h = Math.max(n.p.y, 0);
    n.r *= 1 + 0.42 * Math.exp(-h / (0.16 * S + 0.04));
  }
  branches.push(trunk);

  const domeSteer = (d: Vector3, p: Vector3, w: number) => {
    // Normalised ellipsoid distance; > 1 means outside the dome.
    const rr = Math.hypot(p.x, p.z) / crownR;
    const yy = Math.max((p.y - domeBase) / domeH, 0);
    const k = rr * rr + yy * yy;
    if (k > 0.8) {
      const o = outward(p, d, tmpA);
      const tangent = new Vector3(o.x * 0.5, 0.25 - 0.8 * yy, o.z * 0.5).normalize();
      steer(d, tangent, w * Math.min(1, (k - 0.8) * 2.5));
    }
  };

  const maxLevel = a < 0.15 ? 3 : 4;

  const collectTip = (b: SkelBranch) => {
    const n = b.nodes.length;
    const tip = b.nodes[n - 1];
    blossomPoints.push({ node: tip, dir: tip.p.clone().sub(b.nodes[n - 2].p).normalize(), level: b.level });
  };

  /** Grow `count` children of `level` along `parent` between tMin and 1, then recurse. */
  const spawn = (parent: SkelBranch, parentLen: number, level: number, count: number, tMin: number) => {
    if (level > maxLevel) return;
    let phi = rng() * TAU;
    for (let i = 0; i < count; i++) {
      const t = tMin + (1 - tMin) * ((i + range(rng, 0.15, 0.85)) / count);
      const base = sample(parent, t);
      // Sakura side branches leave the limbs sideways, alternating left and right, and rise as they go.
      phi += GOLDEN + range(rng, -0.4, 0.4);
      const theta = level === 2 ? range(rng, 0.6, 1.1) : range(rng, 0.5, 1.0);
      const side = tmpA.crossVectors(base.dir, UP);
      if (side.lengthSq() < 1e-4) perpendicular(base.dir, side);
      side.normalize().multiplyScalar(i % 2 === 0 ? 1 : -1);
      // Branches near the fork climb steeply so they never cut across the trunk.
      const beta = level === 2 ? range(rng, 0.0, 0.75) + Math.max(0, 0.45 - t) * 1.5 : range(rng, -0.3, 0.95); // elevation of the lateral
      const lateral = side.multiplyScalar(Math.cos(beta)).addScaledVector(UP, Math.sin(beta));
      const dir = base.dir.clone().multiplyScalar(Math.cos(theta)).addScaledVector(lateral, Math.sin(theta));
      // Mix in a little true randomness so twigs don't look combed.
      dir.addScaledVector(spread(base.dir, theta, phi), 0.35);
      const o = outward(base.p, base.dir, new Vector3());
      dir.addScaledVector(o, level === 2 ? 0.15 : 0.1);
      dir.y += level === 2 ? 0.08 : 0.1;
      const minY = level === 2 ? -0.05 : -0.15;
      if (dir.y < minY) dir.y = minY;
      dir.normalize();
      const lenScale = level === 2 ? range(rng, 0.38, 0.54) : level === 3 ? range(rng, 0.36, 0.56) : range(rng, 0.4, 0.65);
      const len = parentLen * lenScale * (1.2 - 0.55 * t);
      const r0 = base.r * range(rng, 0.5, 0.66);
      const b = grow(rng, {
        start: base.p,
        dir,
        length: len,
        r0,
        r1: Math.max(0.005, r0 * 0.18),
        segs: level === 2 ? 7 : level === 3 ? 4 : 3,
        gnarl: level === 2 ? 0.12 : 0.18,
        sway0: base.sway,
        level,
        tropism: (d, p) => {
          d.y += level === 2 ? 0.03 : 0.06;
          d.normalize();
          domeSteer(d, p, 0.45);
        },
      });
      branches.push(b);
      if (level === 2) spawn(b, len, 3, Math.round(range(rng, 4, 6.5) * density), 0.2);
      else if (level === 3) spawn(b, len, 4, Math.round(range(rng, 1.6, 3.4) * (0.5 + 0.5 * density)), 0.3);
      collectTip(b);
    }
  };

  // Scaffold limbs fan out around the trunk with evenly spaced headings. The first is a steeper leader.
  const nLimbs = Math.max(2, Math.round(2.3 + 2.0 * a + rng() * 1.3));
  const az0 = rng() * TAU;
  // Limbs leave the upper trunk; the first is a steep leader that leaves last, and the trunk ends inside
  // its base so no cut stump shows above the fork.
  const tStarts: number[] = [];
  for (let i = 1; i < nLimbs; i++) tStarts.push(range(rng, 0.5, 0.82));
  tStarts.unshift(Math.min(0.95, Math.max(0.6, ...tStarts) + range(rng, 0.05, 0.1)));
  const trunkFull: SkelBranch = { level: 0, nodes: trunk.nodes.slice() };
  const top = sample(trunkFull, tStarts[0]);
  const keep = Math.floor(tStarts[0] * (trunk.nodes.length - 1));
  trunk.nodes.length = keep + 1;
  if (trunk.nodes[keep].p.distanceTo(top.p) < 0.02 && keep > 0) trunk.nodes.length = keep;
  trunk.nodes.push({ p: top.p.clone(), r: top.r * 0.55, sway: top.sway });
  for (let i = 0; i < nLimbs; i++) {
    const az = az0 + (i / nLimbs) * TAU + range(rng, -0.22, 0.22);
    const heading = new Vector3(Math.cos(az), 0, Math.sin(az));
    const leader = i === 0;
    const base = sample(trunkFull, tStarts[i]);
    const e0 = leader ? range(rng, 1.1, 1.25) : range(rng, 0.58, 0.88); // elevation above horizontal at the fork
    const e1 = leader ? range(rng, 0.5, 0.75) : range(rng, 0.04, 0.26); // elevation at the tip
    const len = (leader ? range(rng, 3.3, 4.1) : range(rng, 4.0, 5.3)) * S;
    const dir0 = heading.clone().multiplyScalar(Math.cos(e0)).addScaledVector(UP, Math.sin(e0));
    const r0 = base.r * (leader ? range(rng, 0.84, 0.92) : range(rng, 0.7, 0.82));
    const target = new Vector3();
    const b = grow(rng, {
      start: base.p,
      dir: dir0,
      length: len,
      r0,
      r1: Math.max(0.008, 0.016 * S),
      segs: 12,
      gnarl: 0.075,
      sway0: base.sway,
      level: 1,
      tropism: (d, p, t) => {
        const e = e0 + (e1 - e0) * Math.min(1, t * 1.4);
        target.copy(heading).multiplyScalar(Math.cos(e)).addScaledVector(UP, Math.sin(e));
        steer(d, target, 0.2);
        // Never let a limb sag below the fork height.
        if (p.y < trunkH && d.y < 0.1) { d.y = 0.1; d.normalize(); }
      },
    });
    branches.push(b);
    spawn(b, len, 2, Math.round(range(rng, 6, 9) * density), 0.22);
    // Extra twigs crowd the arching outer end of each limb.
    spawn(b, len * 0.45, 3, Math.round(range(rng, 2, 4) * density), 0.6);
    collectTip(b);
  }
  return { branches, blossomPoints };
}
