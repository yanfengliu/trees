// Low-poly hill, rolling meadow and distant mountains as one faceted mesh.
import { BufferAttribute, BufferGeometry, Color, Mesh, MeshStandardMaterial } from 'three';
import { createRng } from '../random';
import { createNoise2D, fbm, smoothstep } from './noise';

const TERRAIN_SEED = 1931;
const noise = createNoise2D(TERRAIN_SEED);
const noiseB = createNoise2D(TERRAIN_SEED + 1);

/** Outer radius of the terrain mesh in metres. */
export const TERRAIN_RADIUS = 330;

/**
 * Ground height in metres at (x, z). Exactly 0 within 3 m of the origin, where the trunk stands,
 * then a gentle fall-off into a rolling meadow and a ring of soft mountains on the horizon.
 */
export function heightAt(x: number, z: number): number {
  const r = Math.hypot(x, z);
  if (r <= 3) return 0;
  const hill = -5 * smoothstep(3, 60, r);
  const roll = fbm(noise, x / 30, z / 30, 3) * 2.4 * smoothstep(4, 32, r);
  const ridge = Math.max(0, fbm(noiseB, x / 55, z / 55, 3) * 0.5 + 0.5);
  const mountains = smoothstep(110, 250, r) * (8 + 46 * ridge * ridge);
  return hill + roll + mountains;
}

const C = (hex: number) => new Color(hex);
const MEADOW_A = C(0x5f9e38);
const MEADOW_B = C(0x86bf48);
const MEADOW_DRY = C(0xa6bd50);
const VALLEY = C(0x447f30);
const FAR_HILL = C(0x4f8a4a);
const MOUNTAIN = C(0x6a8a6c);
const MOUNTAIN_HIGH = C(0x8d9c92);

/** Build the terrain mesh: rings that double in segment count outward so facets stay roughly even. */
export function createTerrain(): Mesh {
  const rng = createRng(TERRAIN_SEED);
  type Ring = { r: number; n: number; start: number };
  const rings: Ring[] = [{ r: 0, n: 1, start: 0 }];
  const xs: number[] = [0];
  const zs: number[] = [0];
  let r = 0;
  let n = 6;
  while (r < TERRAIN_RADIUS) {
    const dr = Math.max(1.25, r * 0.075);
    r = Math.min(TERRAIN_RADIUS, r + dr);
    const need = (2 * Math.PI * r) / dr;
    if (need > n * 1.45 && n < 128) n *= 2;
    const ring: Ring = { r, n, start: xs.length };
    const outer = r >= TERRAIN_RADIUS;
    for (let j = 0; j < n; j++) {
      const a = ((j + (outer ? 0 : (rng() - 0.5) * 0.6)) / n) * Math.PI * 2;
      const rr = outer ? r : r + (rng() - 0.5) * 0.6 * dr;
      xs.push(Math.cos(a) * rr);
      zs.push(Math.sin(a) * rr);
    }
    rings.push(ring);
  }
  const ys = xs.map((x, i) => heightAt(x, zs[i]));

  const tris: number[] = [];
  for (let i = 1; i < rings.length; i++) {
    const inner = rings[i - 1];
    const outer = rings[i];
    const a = (j: number) => inner.start + (((j % inner.n) + inner.n) % inner.n);
    const b = (j: number) => outer.start + (((j % outer.n) + outer.n) % outer.n);
    if (inner.n === 1) {
      for (let j = 0; j < outer.n; j++) tris.push(0, b(j + 1), b(j));
    } else if (outer.n === inner.n) {
      for (let j = 0; j < inner.n; j++) {
        if (rng() < 0.5) tris.push(a(j), b(j + 1), b(j), a(j), a(j + 1), b(j + 1));
        else tris.push(a(j), a(j + 1), b(j), a(j + 1), b(j + 1), b(j));
      }
    } else {
      for (let j = 0; j < inner.n; j++) {
        tris.push(a(j), b(2 * j + 1), b(2 * j), a(j), a(j + 1), b(2 * j + 1), a(j + 1), b(2 * j + 2), b(2 * j + 1));
      }
    }
  }

  const triCount = tris.length / 3;
  const pos = new Float32Array(triCount * 9);
  const col = new Float32Array(triCount * 9);
  const c = new Color();
  for (let t = 0; t < triCount; t++) {
    let cx = 0, cy = 0, cz = 0;
    for (let k = 0; k < 3; k++) {
      const v = tris[t * 3 + k];
      pos[t * 9 + k * 3] = xs[v];
      pos[t * 9 + k * 3 + 1] = ys[v];
      pos[t * 9 + k * 3 + 2] = zs[v];
      cx += xs[v] / 3; cy += ys[v] / 3; cz += zs[v] / 3;
    }
    // Face normal y for slope shading.
    const o = t * 9;
    const ux = pos[o + 3] - pos[o], uy = pos[o + 4] - pos[o + 1], uz = pos[o + 5] - pos[o + 2];
    const vx = pos[o + 6] - pos[o], vy = pos[o + 7] - pos[o + 1], vz = pos[o + 8] - pos[o + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const slopeY = Math.abs(ny) / Math.hypot(nx, ny, nz);
    faceColor(c, cx, cy, cz, slopeY, rng());
    for (let k = 0; k < 3; k++) {
      col[o + k * 3] = c.r; col[o + k * 3 + 1] = c.g; col[o + k * 3 + 2] = c.b;
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(pos, 3));
  geometry.setAttribute('color', new BufferAttribute(col, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  const material = new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, metalness: 0 });
  const mesh = new Mesh(geometry, material);
  mesh.name = 'terrain';
  mesh.receiveShadow = true;
  return mesh;
}

const tmp = new Color();
function faceColor(out: Color, x: number, y: number, z: number, slopeY: number, rand: number): void {
  const d = Math.hypot(x, z);
  const patch = fbm(noise, x / 16 + 40, z / 16 - 13, 2) * 0.5 + 0.5;
  out.copy(MEADOW_A).lerp(MEADOW_B, smoothstep(0.25, 0.75, patch));
  const dry = smoothstep(0.55, 0.9, fbm(noiseB, x / 40 - 7, z / 40 + 3, 2) * 0.5 + 0.5);
  out.lerp(MEADOW_DRY, dry * 0.45);
  // Lower ground is lusher and darker.
  out.lerp(VALLEY, smoothstep(-4, -7.5, y) * 0.6);
  // Distant hills, then soft mountains with paler high faces.
  out.lerp(FAR_HILL, smoothstep(70, 140, d) * 0.7);
  out.lerp(MOUNTAIN, smoothstep(130, 220, d));
  out.lerp(MOUNTAIN_HIGH, smoothstep(22, 45, y) * 0.8);
  // Steeper faces a touch darker, plus per-facet jitter for the low-poly look.
  const shade = 0.93 + 0.07 * slopeY + (rand - 0.5) * 0.09;
  tmp.copy(out).multiplyScalar(shade);
  out.copy(tmp);
}
