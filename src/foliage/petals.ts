// Falling petals, animated entirely on the GPU from uTime. The carpet of fallen petals belongs to the scene's meadow,
// which follows the terrain height and the tree's crown radius.
import { Color, DoubleSide, InstancedBufferAttribute, InstancedMesh, MeshLambertMaterial } from 'three';
import { applyPetalLight } from './petalLight';
import type { WindUniforms } from '../contracts';
import { range, type Rng } from '../random';
import type { CrownShape } from './crown';
import { createPetalGeometry } from './geometry';
import { BLOSSOM_PALETTE } from './blossoms';

export const FALLING_PETALS = 320;
/** Petals rest on the ground this many seconds (shrinking away) before they recycle back into the crown. */
const REST_SECONDS = 3;

const PETAL_GLSL = /* glsl */ `
uniform float uTime;
uniform float uWindStrength;
uniform vec2 uWindDirection;
uniform vec3 uCrownCentre;
uniform float uCrownRadius;
uniform float uCrownMinY;
uniform float uCrownMaxY;
attribute vec4 aPetalA; // angle, radius seed, phase, random
attribute vec4 aPetalB; // spawn height 0..1, fall speed m/s, spin rad/s, size m

vec3 rotateAxis(vec3 v, vec3 k, float a) {
  float c = cos(a), s = sin(a);
  return v * c + cross(k, v) * s + k * dot(k, v) * (1.0 - c);
}
`;

const PETAL_BEGIN = /* glsl */ `
float spawnY = mix(uCrownMinY, uCrownMaxY, aPetalB.x);
float vFall = aPetalB.y;
float fallTime = max(spawnY, 0.5) / vFall;
float period = fallTime + ${REST_SECONDS.toFixed(1)};
float tt = uTime + aPetalA.z * period;
float cycle = floor(tt / period);
float tau = tt - cycle * period;
// Each cycle respawns somewhere new in the crown (golden-angle walk), so the shower never visibly loops.
float ang = aPetalA.x + cycle * 2.39996;
float rad = uCrownRadius * 0.85 * sqrt(fract(aPetalA.y + cycle * 0.618034));
vec3 start = vec3(uCrownCentre.x + cos(ang) * rad, spawnY, uCrownCentre.z + sin(ang) * rad);
float tf = min(tau, fallTime);
float w = clamp(uWindStrength, 0.0, 1.5);
float r = aPetalA.w * 6.2831;
vec2 swirl = vec2(sin(tf * 1.3 + r) - sin(r), cos(tf * 1.1 + r * 0.7) - cos(r * 0.7)) * (0.3 + 0.35 * w);
vec2 drift = uWindDirection * (0.15 + 1.3 * w) * tf + swirl;
float bob = sin(tf * 3.1 + r) * 0.12 * (1.0 - tf / fallTime);
vec3 petalPos = start + vec3(drift.x, -vFall * tf + bob, drift.y);
petalPos.y = max(petalPos.y, 0.015);
float landed = step(fallTime, tau);
vec3 axis = normalize(vec3(sin(r * 3.0), 0.7, cos(r * 5.0)));
vec3 local = rotateAxis(position, axis, tf * aPetalB.z * (0.6 + 0.6 * w));
vec3 flatPose = rotateAxis(position * vec3(1.0, 0.3, 1.0), vec3(0.0, 1.0, 0.0), r);
local = mix(local, flatPose, landed);
float grow = smoothstep(0.0, 0.8, tau);
float fade = 1.0 - smoothstep(period - ${(REST_SECONDS * 0.8).toFixed(2)}, period, tau);
vec3 transformed = petalPos + local * aPetalB.w * grow * fade;
`;

export interface PetalMeshes {
  falling: InstancedMesh;
  dispose(): void;
}

export function createPetals(crown: CrownShape, rng: Rng, wind: WindUniforms, density: number): PetalMeshes {
  const palette = BLOSSOM_PALETTE.map((c) => new Color(c));
  const color = new Color();

  // Falling petals. Instance matrices stay identity; the vertex shader places every petal from uTime.
  const fallGeo = createPetalGeometry();
  const fallingCount = crown.radius > 0 ? Math.round(FALLING_PETALS * Math.max(0, Math.min(1, density))) : 0;
  const a = new Float32Array(Math.max(1, fallingCount) * 4);
  const b = new Float32Array(Math.max(1, fallingCount) * 4);
  for (let i = 0; i < fallingCount; i++) {
    a.set([rng() * Math.PI * 2, rng(), rng(), rng()], i * 4);
    b.set([range(rng, 0.05, 0.85), range(rng, 0.45, 0.8), range(rng, 2, 5) * (rng() < 0.5 ? -1 : 1), range(rng, 0.07, 0.1)], i * 4);
  }
  fallGeo.setAttribute('aPetalA', new InstancedBufferAttribute(a, 4));
  fallGeo.setAttribute('aPetalB', new InstancedBufferAttribute(b, 4));
  const fallMat = new MeshLambertMaterial({ color: 0xffffff, flatShading: true, side: DoubleSide });
  const crownUniforms = {
    uCrownCentre: { value: crown.centre.clone() },
    uCrownRadius: { value: crown.radius },
    uCrownMinY: { value: crown.minY },
    uCrownMaxY: { value: crown.maxY },
  };
  fallMat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, crownUniforms, { uTime: wind.uTime, uWindStrength: wind.uWindStrength, uWindDirection: wind.uWindDirection });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${PETAL_GLSL}`)
      .replace('#include <begin_vertex>', PETAL_BEGIN);
  };
  fallMat.customProgramCacheKey = () => 'falling-petals-v1';
  applyPetalLight(fallMat, { neutralAmbient: 0.6, translucency: 1.1, glow: 0.07 });
  const falling = new InstancedMesh(fallGeo, fallMat, Math.max(1, fallingCount));
  falling.count = fallingCount;
  falling.name = 'falling-petals';
  falling.frustumCulled = false; // positions come from the shader; the CPU bounds know nothing of them
  falling.receiveShadow = true;
  for (let i = 0; i < fallingCount; i++) {
    color.copy(palette[Math.floor(rng() * 4)]).multiplyScalar(range(rng, 0.95, 1.05));
    falling.setColorAt(i, color);
  }
  if (falling.instanceColor) falling.instanceColor.needsUpdate = true;

  return {
    falling,
    dispose() {
      fallGeo.dispose();
      fallMat.dispose();
      falling.dispose();
    },
  };
}
