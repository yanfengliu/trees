// Pure helpers for keeping the page URL and the panel in step. Inverse of src/urlParams.ts.
import type { TreeParams } from '../contracts';

const round = (v: number, digits: number): number => Number(v.toFixed(digits));

/**
 * Merge `params` into an existing query string as ?seed=&age=&time=&wind=&leaves=, keeping any other
 * keys. Values are rounded so the URL stays readable; paramsFromUrl reads them back to the same numbers.
 */
export function queryFromParams(search: string, params: TreeParams): string {
  const q = new URLSearchParams(search);
  q.set('seed', String(Math.round(params.seed)));
  q.set('age', String(round(params.age, 3)));
  q.set('time', String(round(params.timeOfDay, 2)));
  q.set('wind', String(round(params.wind, 3)));
  q.set('leaves', String(round(params.leafDensity, 3)));
  return `?${q.toString()}`;
}

/** Advance the hour of day by `hours`, wrapping into [0, 24). */
export function advanceTime(timeOfDay: number, hours: number): number {
  const t = (timeOfDay + hours) % 24;
  return t < 0 ? t + 24 : t;
}

/** A fresh seed from a 0..1 random number: a non-negative integer below 1,000,000 that differs from `current`. */
export function nextSeed(random: number, current: number): number {
  const seed = Math.floor(random * 1_000_000);
  return seed === current ? (seed + 1) % 1_000_000 : seed;
}

/** "17.5" -> "17:30", for the clock readout beside the time slider. */
export function formatClock(hours: number): string {
  const total = Math.round(advanceTime(hours, 0) * 60) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
