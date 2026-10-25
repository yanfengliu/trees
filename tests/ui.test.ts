import { describe, expect, it } from 'vitest';
import { DEFAULT_PARAMS, type TreeParams } from '../src/contracts';
import { paramsFromUrl } from '../src/urlParams';
import { clampPitch, clampPosition, dampToward, forwardFromYawPitch, isTypingTarget, keyBelongsToTarget, MOVE, moveIntent, wheelImpulse, wishVelocity, yawPitchFromDirection } from '../src/ui/movement';
import { advanceTime, clampSeed, formatClock, MAX_SEED, nextSeed, panelParams, queryFromParams } from '../src/ui/urlSync';

const close = (a: number, b: number, eps = 1e-9): boolean => Math.abs(a - b) < eps;

describe('URL sync', () => {
  it('round-trips with paramsFromUrl', () => {
    const p: TreeParams = { seed: 123456, age: 0.42, timeOfDay: 6.25, wind: 0.8, leafDensity: 0.3 };
    expect(paramsFromUrl(queryFromParams('', p), DEFAULT_PARAMS)).toEqual(p);
    expect(paramsFromUrl(queryFromParams('', DEFAULT_PARAMS), { ...DEFAULT_PARAMS, seed: 1 })).toEqual(DEFAULT_PARAMS);
  });
  it('keeps unrelated keys and rounds float noise', () => {
    const q = queryFromParams('?debug=1&seed=3', { ...DEFAULT_PARAMS, timeOfDay: 12.000000004, wind: 0.1 + 0.2 });
    const parsed = new URLSearchParams(q);
    expect(parsed.get('debug')).toBe('1');
    expect(parsed.get('seed')).toBe(String(DEFAULT_PARAMS.seed));
    expect(parsed.get('time')).toBe('12');
    expect(parsed.get('wind')).toBe('0.3');
  });
  it('wraps the clock and formats it', () => {
    expect(advanceTime(23.9, 0.2)).toBeCloseTo(0.1);
    expect(advanceTime(0.1, -0.2)).toBeCloseTo(23.9);
    expect(formatClock(17.5)).toBe('17:30');
    expect(formatClock(23.999)).toBe('00:00');
  });
  it('makes a new seed that differs from the current one', () => {
    expect(nextSeed(0.5, 7)).toBe(500000);
    expect(nextSeed(0.5, 500000)).toBe(500001);
    expect(nextSeed(0.9999999, 0)).toBeLessThan(1_000_000);
  });
});

describe('panel params', () => {
  it('takes seed, age and blossoms from the committed copy and time and wind live', () => {
    const committed: TreeParams = { seed: 7, age: 0.75, timeOfDay: 17.5, wind: 0.35, leafDensity: 1 };
    // Mid-edit: the user has typed "12" of "123" into the seed and is dragging age and blossoms; cycle day moved the clock.
    const live: TreeParams = { seed: 12, age: 0.2, timeOfDay: 18.25, wind: 0.6, leafDensity: 0.4 };
    expect(panelParams(committed, live)).toEqual({ seed: 7, age: 0.75, timeOfDay: 18.25, wind: 0.6, leafDensity: 1 });
  });
  it('clamps a typed seed to 0..2^31-1, the same range the URL accepts', () => {
    expect(MAX_SEED).toBe(2 ** 31 - 1);
    expect(clampSeed(99999999999)).toBe(MAX_SEED);
    expect(clampSeed(-3)).toBe(0);
    expect(clampSeed(12.4)).toBe(12);
    expect(clampSeed(Number.NaN)).toBe(0);
    expect(paramsFromUrl(`?seed=${MAX_SEED + 10}`, DEFAULT_PARAMS).seed).toBe(clampSeed(MAX_SEED + 10));
  });
});

describe('movement math', () => {
  it('maps keys to axes and cancels opposites', () => {
    expect(moveIntent(['KeyW', 'KeyD', 'ShiftLeft'])).toEqual({ forward: 1, right: 1, up: 0, sprint: true });
    expect(moveIntent(['KeyW', 'KeyS', 'ArrowLeft', 'Space'])).toEqual({ forward: 0, right: -1, up: 1, sprint: false });
    expect(moveIntent(['KeyQ', 'KeyX'])).toEqual({ forward: 0, right: 0, up: -1, sprint: false });
  });
  it('round-trips yaw and pitch through a direction', () => {
    for (const [yaw, pitch] of [[0, 0], [1, 0.3], [-2.5, -1.2], [3, 1.4]]) {
      const back = yawPitchFromDirection(forwardFromYawPitch(yaw, pitch));
      expect(close(back.yaw, yaw)).toBe(true);
      expect(close(back.pitch, pitch)).toBe(true);
    }
    expect(forwardFromYawPitch(0, 0)).toEqual({ x: -0, y: 0, z: -1 });
    expect(yawPitchFromDirection({ x: 0, y: 1, z: 0 }).pitch).toBe(MOVE.maxPitch);
    expect(clampPitch(-3)).toBe(-MOVE.maxPitch);
  });
  it('walks on the ground plane relative to the view, without faster diagonals', () => {
    const yaw = Math.PI / 2; // looking down -X
    const v = wishVelocity({ forward: 1, right: 0, up: 0, sprint: false }, yaw);
    expect(close(v.x, -MOVE.speed) && close(v.y, 0) && close(v.z, 0, 1e-9)).toBe(true);
    const r = wishVelocity({ forward: 0, right: 1, up: 0, sprint: false }, 0);
    expect(close(r.x, MOVE.speed) && close(r.z, 0, 1e-9)).toBe(true);
    const d = wishVelocity({ forward: 1, right: 1, up: 0, sprint: true }, 0.7);
    expect(Math.hypot(d.x, d.z)).toBeCloseTo(MOVE.speed * MOVE.sprint);
  });
  it('damps independently of frame rate', () => {
    const target = { x: 4, y: 0, z: 0 };
    let a = { x: 0, y: 0, z: 0 };
    for (let i = 0; i < 60; i++) a = dampToward(a, target, MOVE.response, 1 / 60);
    let b = { x: 0, y: 0, z: 0 };
    for (let i = 0; i < 10; i++) b = dampToward(b, target, MOVE.response, 1 / 10);
    expect(a.x).toBeCloseTo(b.x, 9);
    expect(a.x).toBeGreaterThan(3.9);
  });
  it('scroll up moves forward along the view', () => {
    const f = wheelImpulse(-100, 0, 0, 0);
    expect(f.z).toBeCloseTo(-MOVE.wheelImpulse);
    expect(wheelImpulse(3, 1, 0, 0).z).toBeGreaterThan(0); // line mode, scrolling down moves back
  });
  it('keeps the camera above the ground and inside the radius', () => {
    expect(clampPosition({ x: 0, y: -5, z: 0 })).toEqual({ position: { x: 0, y: MOVE.minY, z: 0 }, hitY: true, hitRadius: false });
    const far = clampPosition({ x: 300, y: 2, z: 400 });
    expect(Math.hypot(far.position.x, far.position.z)).toBeCloseTo(MOVE.maxRadius);
    expect(far.hitRadius).toBe(true);
  });
  it('recognises typing targets', () => {
    expect(isTypingTarget({ tagName: 'input' })).toBe(true);
    expect(isTypingTarget({ tagName: 'DIV', isContentEditable: true })).toBe(true);
    expect(isTypingTarget({ tagName: 'CANVAS' })).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
  it('leaves Space and Enter to a focused button, and every other key to the camera', () => {
    expect(keyBelongsToTarget('Space', { tagName: 'BUTTON' })).toBe(true);
    expect(keyBelongsToTarget('Enter', { tagName: 'button' })).toBe(true);
    expect(keyBelongsToTarget('KeyW', { tagName: 'BUTTON' })).toBe(false);
    expect(keyBelongsToTarget('Space', { tagName: 'CANVAS' })).toBe(false);
    expect(keyBelongsToTarget('KeyW', { tagName: 'INPUT' })).toBe(true);
    expect(keyBelongsToTarget('Space', null)).toBe(false);
  });
});
