// Sun path and the colour script for every hour of the day.
import { Color, Vector3 } from 'three';

/** Peak sun elevation in degrees (reached at solar noon). */
const MAX_ELEVATION_DEG = 60;
const SUNRISE = 6.2;
const SUNSET = 18.4;
const SOLAR_NOON = (SUNRISE + SUNSET) / 2;
/**
 * Sun azimuth at solar noon, radians, measured from +X towards +Z. Chosen so that at golden hour (17.5) the sun
 * sits low and about 20 degrees right of the default camera's view, lighting the tree from three-quarter behind.
 */
const NOON_AZIMUTH = (-178 * Math.PI) / 180;

/** Unit vector pointing from the ground towards the sun. Sunrise is ~6:12, sunset ~18:24. */
export function sunDirection(hours: number, out = new Vector3()): Vector3 {
  const h = ((hours % 24) + 24) % 24;
  // Day maps to the upper half of a sine, night to the lower half, each stretched to its own length.
  const dayLength = SUNSET - SUNRISE;
  const phase = h >= SUNRISE && h <= SUNSET ? (Math.PI * (h - SUNRISE)) / dayLength : Math.PI + (Math.PI * (((h - SUNSET) + 24) % 24)) / (24 - dayLength);
  // Flattened near the horizon so mornings and evenings linger with a low, warm sun.
  const sp = Math.sin(phase);
  const el = ((MAX_ELEVATION_DEG * Math.PI) / 180) * sp * (0.55 + 0.45 * Math.abs(sp));
  const az = NOON_AZIMUTH + ((h - SOLAR_NOON) / 12) * Math.PI;
  return out.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
}

export interface SkyState {
  zenith: Color;
  horizon: Color;
  /** Warm halo around the sun and along the horizon on the sun's side. */
  glow: Color;
  glowStrength: number;
  /** Colour and intensity of the key light (sun by day, moon by night). */
  light: Color;
  lightIntensity: number;
  hemiSky: Color;
  hemiGround: Color;
  hemiIntensity: number;
  stars: number;
  /** Cloud self-illumination tint, mixed with lighting. */
  cloud: Color;
}

interface Key { h: number; zenith: number; horizon: number; glow: number; glowStrength: number; light: number; lightIntensity: number; hemiSky: number; hemiGround: number; hemiIntensity: number; stars: number; cloud: number }

const NIGHT: Omit<Key, 'h'> = {
  zenith: 0x050a1e, horizon: 0x1c2648, glow: 0x1c2648, glowStrength: 0,
  light: 0x9db2ff, lightIntensity: 0.65, hemiSky: 0x4a5c9a, hemiGround: 0x1a2030, hemiIntensity: 1.15, stars: 1, cloud: 0x1e2644,
};

const KEYS: Key[] = [
  { h: 0, ...NIGHT },
  { h: 4.6, ...NIGHT, zenith: 0x081028, horizon: 0x26305a, stars: 0.9 },
  { h: 5.6, zenith: 0x1a2a5c, horizon: 0x6a5a86, glow: 0xb06a7a, glowStrength: 0.5, light: 0xa8b0f0, lightIntensity: 0.4, hemiSky: 0x5a64a0, hemiGround: 0x262434, hemiIntensity: 0.9, stars: 0.5, cloud: 0x4a4a70 },
  { h: 6.4, zenith: 0x3a5898, horizon: 0xec8c80, glow: 0xff7a5a, glowStrength: 1.1, light: 0xffa585, lightIntensity: 1.6, hemiSky: 0x9aa4d4, hemiGround: 0x5a4a50, hemiIntensity: 0.85, stars: 0.05, cloud: 0xc08a9a },
  { h: 7.4, zenith: 0x5a88d0, horizon: 0xf0b898, glow: 0xffc09a, glowStrength: 0.8, light: 0xffd4b0, lightIntensity: 2.4, hemiSky: 0xb6c8ec, hemiGround: 0x5f6e40, hemiIntensity: 0.9, stars: 0, cloud: 0xe8c8c0 },
  { h: 9.5, zenith: 0x3878d4, horizon: 0xa8cbec, glow: 0xfff0d8, glowStrength: 0.35, light: 0xfff2e0, lightIntensity: 2.6, hemiSky: 0xb8cef2, hemiGround: 0x4f6a34, hemiIntensity: 0.85, stars: 0, cloud: 0xdfe8f4 },
  { h: 12.5, zenith: 0x2a66cc, horizon: 0x9cc4ec, glow: 0xfff8ec, glowStrength: 0.3, light: 0xfff8ee, lightIntensity: 2.6, hemiSky: 0xb4ccf0, hemiGround: 0x4f6a34, hemiIntensity: 0.8, stars: 0, cloud: 0xe4ecf6 },
  { h: 15.5, zenith: 0x326cc8, horizon: 0xb0cce8, glow: 0xffefd2, glowStrength: 0.4, light: 0xfff0d8, lightIntensity: 2.6, hemiSky: 0xb8cae8, hemiGround: 0x546a34, hemiIntensity: 0.85, stars: 0, cloud: 0xe8e8ee },
  { h: 17.5, zenith: 0x3e5fae, horizon: 0xf4a466, glow: 0xff8a3a, glowStrength: 0.9, light: 0xffb060, lightIntensity: 2.9, hemiSky: 0xaab4e0, hemiGround: 0x6a5a34, hemiIntensity: 0.85, stars: 0, cloud: 0xffc8a0 },
  { h: 18.4, zenith: 0x313d86, horizon: 0xf07a52, glow: 0xff5a2a, glowStrength: 1.3, light: 0xff7a44, lightIntensity: 1.8, hemiSky: 0x8a80b8, hemiGround: 0x4a3434, hemiIntensity: 0.8, stars: 0, cloud: 0xe08080 },
  { h: 19.2, zenith: 0x232c62, horizon: 0x8a6496, glow: 0xc05a6a, glowStrength: 0.8, light: 0xb4a0e0, lightIntensity: 0.45, hemiSky: 0x6a6aa8, hemiGround: 0x2a2436, hemiIntensity: 0.9, stars: 0.25, cloud: 0x7a5a84 },
  { h: 20.4, zenith: 0x0e1640, horizon: 0x3a3a72, glow: 0x5a3a78, glowStrength: 0.35, light: 0xa0aef4, lightIntensity: 0.6, hemiSky: 0x4e5aa0, hemiGround: 0x1c1e30, hemiIntensity: 1.2, stars: 0.75, cloud: 0x2a2c58 },
  { h: 21.8, ...NIGHT },
  { h: 24, ...NIGHT },
];

function makeState(): SkyState {
  return {
    zenith: new Color(), horizon: new Color(), glow: new Color(), glowStrength: 0, light: new Color(), lightIntensity: 0,
    hemiSky: new Color(), hemiGround: new Color(), hemiIntensity: 0, stars: 0, cloud: new Color(),
  };
}

const ca = new Color();
const cb = new Color();
const COLOR_KEYS = ['zenith', 'horizon', 'glow', 'light', 'hemiSky', 'hemiGround', 'cloud'] as const;
const NUMBER_KEYS = ['glowStrength', 'lightIntensity', 'hemiIntensity', 'stars'] as const;

/** Interpolate the colour script at `hours` (wrapped into 0..24). Colours are blended in linear space. */
export function sampleSky(hours: number, out: SkyState = makeState()): SkyState {
  const h = ((hours % 24) + 24) % 24;
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1].h <= h) i++;
  const k0 = KEYS[i];
  const k1 = KEYS[i + 1];
  const raw = (h - k0.h) / (k1.h - k0.h);
  const t = raw * raw * (3 - 2 * raw);
  for (const key of COLOR_KEYS) {
    ca.setHex(k0[key]);
    cb.setHex(k1[key]);
    out[key].copy(ca).lerp(cb, t);
  }
  for (const key of NUMBER_KEYS) out[key] = k0[key] + (k1[key] - k0[key]) * t;
  return out;
}
