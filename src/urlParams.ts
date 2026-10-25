import type { TreeParams } from './contracts';

/** Read ?seed=&age=&time=&wind=&leaves= from a query string, falling back to `base` for anything missing or invalid. */
export function paramsFromUrl(search: string, base: TreeParams): TreeParams {
  const q = new URLSearchParams(search);
  const num = (key: string, fallback: number, min: number, max: number): number => {
    const v = Number(q.get(key));
    return q.has(key) && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
  };
  return {
    seed: Math.round(num('seed', base.seed, 0, 2 ** 31 - 1)),
    age: num('age', base.age, 0, 1),
    timeOfDay: num('time', base.timeOfDay, 0, 24),
    wind: num('wind', base.wind, 0, 1),
    leafDensity: num('leaves', base.leafDensity, 0, 1),
  };
}
