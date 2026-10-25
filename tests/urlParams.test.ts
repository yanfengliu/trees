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

  it('treats empty values as missing, not as 0', () => {
    expect(paramsFromUrl('?seed=&age=&time=&wind=&leaves=', DEFAULT_PARAMS)).toEqual(DEFAULT_PARAMS);
    expect(paramsFromUrl('?seed=%20', DEFAULT_PARAMS).seed).toBe(DEFAULT_PARAMS.seed);
    expect(paramsFromUrl('?seed=0', DEFAULT_PARAMS).seed).toBe(0);
  });

  it('clamps the seed to the panel range 0..2^31-1 and rounds it', () => {
    expect(paramsFromUrl('?seed=99999999999', DEFAULT_PARAMS).seed).toBe(2 ** 31 - 1);
    expect(paramsFromUrl('?seed=-5', DEFAULT_PARAMS).seed).toBe(0);
    expect(paramsFromUrl('?seed=41.6', DEFAULT_PARAMS).seed).toBe(42);
  });
});
