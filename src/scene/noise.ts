// Seeded 2D value noise for terrain shaping and colour patches.
import { createRng } from '../random';

export type Noise2D = (x: number, y: number) => number;

/** Smooth value noise in [-1, 1], deterministic for a given seed. */
export function createNoise2D(seed: number): Noise2D {
  const rng = createRng(seed);
  const perm = new Uint8Array(512);
  const values = new Float32Array(256);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  for (let i = 0; i < 256; i++) values[i] = rng() * 2 - 1;
  const hash = (i: number, j: number) => values[perm[(perm[i & 255] + j) & 255]];
  return (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi);
    const b = hash(xi + 1, yi);
    const c = hash(xi, yi + 1);
    const d = hash(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

/** Fractal sum of octaves, roughly in [-1, 1]. */
export function fbm(noise: Noise2D, x: number, y: number, octaves = 3): number {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += noise(x, y) * amp;
    norm += amp;
    amp *= 0.5;
    x = x * 2.03 + 17.1;
    y = y * 2.03 - 9.7;
  }
  return sum / norm;
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
