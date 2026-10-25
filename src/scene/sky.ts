// Gradient sky dome with sun and moon discs, twinkling stars and drifting low-poly clouds.
import {
  AdditiveBlending, BackSide, BufferAttribute, BufferGeometry, Color, Group, IcosahedronGeometry, Mesh, MeshLambertMaterial,
  Points, ShaderMaterial, SphereGeometry, Vector3, type Camera, type Object3D,
} from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createRng, range } from '../random';
import { createNoise2D } from './noise';

const SKY_RADIUS = 420;

const skyVertex = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
  gl_Position.z = p.w * 0.99999;
}`;

const skyFragment = /* glsl */ `
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uGlow;
uniform float uGlowStrength;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uSunVis;
uniform vec3 uMoonDir;
uniform float uMoonVis;
varying vec3 vDir;

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

void main() {
  vec3 d = normalize(vDir);
  float y = d.y;
  float up = clamp(y, 0.0, 1.0);
  float grad = 1.0 - pow(1.0 - up, 3.0);
  vec3 col = mix(uHorizon, uZenith, grad);
  float s = dot(d, uSunDir);
  float toward = s * 0.5 + 0.5;
  // Horizon band warmed on the sun's side, and a halo around the sun itself.
  float band = pow(1.0 - abs(y), 5.0) * pow(toward, 2.5);
  float halo = pow(max(s, 0.0), 10.0) * 0.7 + pow(max(s, 0.0), 120.0) * 1.2;
  col += uGlow * uGlowStrength * (band * 0.75 + halo);
  // Sun disc.
  float disc = smoothstep(0.99958, 0.99972, s) * uSunVis;
  col = mix(col, uSunColor, disc);
  // Moon disc with a soft halo and a crescent shadow.
  float m = dot(d, uMoonDir);
  vec3 side = normalize(cross(uMoonDir, vec3(0.0, 1.0, 0.0)) + vec3(0.0, 0.0001, 0.0));
  float shadow = smoothstep(0.99972, 0.99982, dot(d, normalize(uMoonDir + side * 0.012)));
  float moon = smoothstep(0.99965, 0.99978, m) * (1.0 - 0.85 * shadow);
  col += vec3(0.9, 0.93, 1.0) * (moon * 1.6 + pow(max(m, 0.0), 300.0) * 0.12) * uMoonVis;
  // Dither to hide gradient banding.
  col += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const starVertex = /* glsl */ `
attribute float aSize;
attribute float aPhase;
uniform float uTime;
uniform float uOpacity;
varying float vAlpha;
void main() {
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p;
  float twinkle = 0.65 + 0.35 * sin(uTime * (1.3 + aPhase) + aPhase * 40.0);
  vAlpha = uOpacity * twinkle * smoothstep(-0.02, 0.15, normalize(position).y);
  gl_PointSize = aSize;
}`;

const starFragment = /* glsl */ `
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float a = vAlpha * smoothstep(0.5, 0.15, length(c));
  gl_FragColor = vec4(vec3(1.0, 0.97, 0.9) * a, a);
}`;

export interface SkyRig {
  object: Group;
  uniforms: {
    uZenith: { value: Color }; uHorizon: { value: Color }; uGlow: { value: Color }; uGlowStrength: { value: number };
    uSunDir: { value: Vector3 }; uSunColor: { value: Color }; uSunVis: { value: number }; uMoonDir: { value: Vector3 }; uMoonVis: { value: number };
  };
  starUniforms: { uTime: { value: number }; uOpacity: { value: number } };
  cloudMaterial: MeshLambertMaterial;
  clouds: Mesh;
  update(dt: number): void;
}

/** Keep sky-at-infinity objects centred on the camera. */
function followCamera(obj: Object3D): void {
  obj.onBeforeRender = (_r, _s, camera: Camera) => {
    obj.position.setFromMatrixPosition(camera.matrixWorld);
    obj.updateMatrixWorld();
  };
}

export function createSky(): SkyRig {
  const uniforms = {
    uZenith: { value: new Color() }, uHorizon: { value: new Color() }, uGlow: { value: new Color() }, uGlowStrength: { value: 0 },
    uSunDir: { value: new Vector3(0, 1, 0) }, uSunColor: { value: new Color() }, uSunVis: { value: 1 },
    uMoonDir: { value: new Vector3(0, -1, 0) }, uMoonVis: { value: 0 },
  };
  const dome = new Mesh(
    new SphereGeometry(SKY_RADIUS, 48, 24),
    new ShaderMaterial({ uniforms, vertexShader: skyVertex, fragmentShader: skyFragment, side: BackSide, depthWrite: false, fog: false }),
  );
  dome.name = 'sky';
  dome.renderOrder = -10;
  dome.frustumCulled = false;
  followCamera(dome);

  // Stars: deterministic points on the upper sky.
  const rng = createRng(4242);
  const STAR_COUNT = 1500;
  const sp = new Float32Array(STAR_COUNT * 3);
  const size = new Float32Array(STAR_COUNT);
  const phase = new Float32Array(STAR_COUNT);
  for (let i = 0; i < STAR_COUNT; i++) {
    const y = 0.03 + rng() * 0.95;
    const a = rng() * Math.PI * 2;
    const rr = Math.sqrt(1 - y * y);
    const R = SKY_RADIUS * 0.9;
    sp.set([Math.cos(a) * rr * R, y * R, Math.sin(a) * rr * R], i * 3);
    size[i] = rng() < 0.1 ? range(rng, 3.5, 5) : range(rng, 2, 3.2);
    phase[i] = rng();
  }
  const starGeo = new BufferGeometry();
  starGeo.setAttribute('position', new BufferAttribute(sp, 3));
  starGeo.setAttribute('aSize', new BufferAttribute(size, 1));
  starGeo.setAttribute('aPhase', new BufferAttribute(phase, 1));
  const starUniforms = { uTime: { value: 0 }, uOpacity: { value: 0 } };
  const stars = new Points(
    starGeo,
    new ShaderMaterial({ uniforms: starUniforms, vertexShader: starVertex, fragmentShader: starFragment, transparent: true, depthWrite: false, blending: AdditiveBlending, fog: false }),
  );
  stars.name = 'stars';
  stars.frustumCulled = false;
  stars.renderOrder = -9;
  followCamera(stars);

  // Clouds: a handful of unique puff clusters merged into one mesh; the group turns slowly so they drift.
  const clouds = new Mesh(createCloudGeometry(), new MeshLambertMaterial({ color: 0xffffff, flatShading: true, fog: false }));
  clouds.name = 'clouds';
  const cloudMaterial = clouds.material as MeshLambertMaterial;

  const object = new Group();
  object.name = 'sky-rig';
  object.add(dome, stars, clouds);
  return {
    object, uniforms, starUniforms, cloudMaterial, clouds,
    update(dt) {
      starUniforms.uTime.value += dt;
      clouds.rotation.y += dt * 0.0016;
    },
  };
}

function createCloudGeometry(): BufferGeometry {
  const rng = createRng(777);
  const noise = createNoise2D(778);
  const parts: BufferGeometry[] = [];
  const CLOUDS = 15;
  for (let c = 0; c < CLOUDS; c++) {
    const az = ((c + rng() * 0.6) / CLOUDS) * Math.PI * 2;
    const dist = range(rng, 110, 230);
    const cx = Math.cos(az) * dist;
    const cz = Math.sin(az) * dist;
    const cy = range(rng, 30, 58);
    const puffs = 4 + Math.floor(rng() * 4);
    const length = range(rng, 14, 28);
    // Long axis roughly tangential so clouds read as wide shapes from the centre.
    const tx = -Math.sin(az);
    const tz = Math.cos(az);
    for (let p = 0; p < puffs; p++) {
      const u = puffs === 1 ? 0 : p / (puffs - 1) - 0.5;
      const mid = 1 - Math.abs(u) * 1.2;
      const radius = range(rng, 4.5, 8) * (0.5 + 0.75 * mid);
      let g: BufferGeometry = new IcosahedronGeometry(1, 1);
      g.deleteAttribute('normal');
      g.deleteAttribute('uv');
      g = mergeVertices(g);
      const pos = g.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        const k = 1 + noise(x * 2.1 + c * 7 + p * 3, z * 2.1 + y * 1.7) * 0.18;
        x *= k; y *= k; z *= k;
        y = Math.max(y, -0.35);
        pos.setXYZ(i, x, y, z);
      }
      g = g.toNonIndexed();
      g.scale(radius * range(rng, 1.1, 1.4), radius * range(rng, 0.7, 0.9), radius);
      g.rotateY(rng() * Math.PI);
      g.translate(cx + tx * u * length, cy + radius * 0.3 * mid + (rng() - 0.5) * 2, cz + tz * u * length + (rng() - 0.5) * 4);
      parts.push(g);
    }
  }
  const merged = mergeGeometries(parts);
  for (const p of parts) p.dispose();
  merged.computeVertexNormals();
  return merged;
}
