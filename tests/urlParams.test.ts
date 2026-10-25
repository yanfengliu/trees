import { describe, expect, it } from 'vitest';
import { DEFAULT_PARAMS } from '../src/contracts';
import { paramsFromUrl } from '../src/urlParams';

describe('paramsFromUrl', () => {
  it('falls back to defaults and clamps values', () => {
    expect(paramsFromUrl('', DEFAULT_PARAMS)).toEqual(DEFAULT_PARAMS);
    const p = paramsFromUrl('?seed=42&age=3&time=30&wind=-1&leaves=0.5', DEFAULT_PARAMS);
    expect(p).toEqual({ seed: 42, age: 1, timeOfDay: 24, wind: 0, leafDensity: 0.5 });
    expect(paramsFromUrl('?time=abc', DEFAULT_PARAMS).timeOfDay).toBe(DEFAULT_PARAMS.timeOfDay);
  });
});
