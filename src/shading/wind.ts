// Wind shader injection. Shared shading code, owned by the coordinator (see AGENTS.md).
//
// applyWind patches a built-in material's vertex shader so vertices carrying a float attribute `aSway` bend in world space:
// a slow, large sway (plus a steady lean that grows with wind strength) and a faster, small flutter. Phase varies with
// world position so the tree never moves as one rigid block. Works for Mesh, InstancedMesh and BatchedMesh because the
// displacement happens after instance/batch/model transforms. Flat shading follows automatically (normals come from
// screen-space derivatives); smooth normals are not bent, which is invisible at these amplitudes.
//
// Shadows: a swaying mesh must also cast a swaying shadow. Call `applyWindShadows(mesh, uniforms)` (or `windMesh`), which
// gives the mesh a wind-patched customDepthMaterial and customDistanceMaterial.
import { MeshDepthMaterial, MeshDistanceMaterial, type Material, type Mesh } from 'three';
import type { WindUniforms } from '../contracts';
import { replaceChunk } from './replaceChunk';

export interface WindOptions {
  /**
   * Multiplier on the fast flutter (default 1). Blossoms and grass use more, bark uses the default.
   */
  flutter?: number;
  /**
   * For InstancedMesh: take the sway phase from the instance origin instead of each vertex (default true for instanced
   * draws). Keeps a blossom cluster moving together with the twig it hangs from, while the flutter stays per vertex.
   */
  instancePhase?: boolean;
}

const WIND_VERSION = 'wind-v1';

/** GLSL: uniforms and the displacement function, injected after <common>. */
export const WIND_GLSL = /* glsl */ `
uniform float uTime;
uniform float uWindStrength;
uniform vec2 uWindDirection;
uniform float uWindFlutter;
attribute float aSway;

vec3 windOffset(vec3 phasePos, vec3 vertexPos, float sway) {
  float s = clamp(uWindStrength, 0.0, 1.5);
  float t = uTime;
  vec2 d = uWindDirection;
  vec2 side = vec2(-d.y, d.x);
  float along = dot(phasePos.xz, d);
  float across = dot(phasePos.xz, side);
  float k = sway * sway * (3.0 - 2.0 * sway); // smooth ramp: stiff near the trunk, free at the twigs
  // Gusts travel downwind as a slow wave front.
  float gust = 0.5 + 0.5 * sin(t * 0.31 - along * 0.09 + 1.3 * sin(t * 0.13 + across * 0.05));
  gust = gust * gust;
  // Slow sway: two incommensurate waves, phase shifted along the wind and by height.
  float freq = 0.55 + 0.45 * s;
  float slow = 0.65 * sin(t * 1.1 * freq - along * 0.22 + phasePos.y * 0.07)
             + 0.35 * sin(t * 1.73 * freq + across * 0.31 + phasePos.y * 0.11 + 2.0);
  float amp = 0.1 * s + 0.5 * s * s;
  float lean = s * s * (0.35 + 0.65 * gust);
  float push = (lean + slow * (0.35 + 0.25 * gust)) * amp * k;
  float sideSway = (0.45 * sin(t * 0.93 * freq + along * 0.17 + across * 0.23 + 0.7)) * amp * k * 0.6;
  vec3 off = vec3(d.x, 0.0, d.y) * push + vec3(side.x, 0.0, side.y) * sideSway;
  // Fast, small flutter: per vertex, stronger in gusts.
  vec3 v = vertexPos;
  vec3 flutter = vec3(
    sin(t * 5.1 + v.x * 2.3 + v.y * 1.7),
    0.6 * sin(t * 6.3 + v.y * 2.9 + v.z * 1.9),
    sin(t * 5.7 + v.z * 2.1 + v.x * 1.3)
  );
  off += flutter * (0.012 + 0.05 * s * (0.5 + gust)) * s * sway * uWindFlutter;
  // Bend, do not stretch: tips dip as they swing out.
  off.y -= 0.35 * dot(off.xz, off.xz);
  return off;
}
`;

function projectChunk(instancePhase: boolean): string {
  return /* glsl */ `
vec4 windLocal = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
  windLocal = batchingMatrix * windLocal;
#endif
#ifdef USE_INSTANCING
  windLocal = instanceMatrix * windLocal;
#endif
vec4 windWorld = modelMatrix * windLocal;
vec3 windPhase = windWorld.xyz;
#ifdef USE_INSTANCING
  ${instancePhase ? 'windPhase = ( modelMatrix * instanceMatrix * vec4( 0.0, 0.0, 0.0, 1.0 ) ).xyz;' : ''}
#endif
windWorld.xyz += windOffset( windPhase, windWorld.xyz, aSway );
vec4 mvPosition = viewMatrix * windWorld;
gl_Position = projectionMatrix * mvPosition;
`;
}

const WORLDPOS_CHUNK = /* glsl */ `
#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
  vec4 worldPosition = windWorld;
#endif
`;

/** Marker so callers and tests can tell a material is wind-patched. */
export function isWindMaterial(material: Material): boolean {
  return material.userData.wind === WIND_VERSION;
}

/**
 * Patch a built-in material (MeshStandardMaterial, MeshLambertMaterial, MeshDepthMaterial, ...) so vertices sway with the
 * wind. The geometry must carry a float attribute `aSway` (0 = rigid, 1 = fully free); for InstancedMesh it may be an
 * InstancedBufferAttribute (one value per instance). Returns the same material, with its type unchanged.
 */
export function applyWind<M extends Material>(material: M, uniforms: WindUniforms, options: WindOptions = {}): M {
  if (isWindMaterial(material)) return material;
  const flutter = options.flutter ?? 1;
  const instancePhase = options.instancePhase ?? true;
  const flutterUniform = { value: flutter };
  const previous = material.onBeforeCompile.bind(material);
  const previousKey = material.customProgramCacheKey.bind(material);
  const hadCustomCompile = Object.prototype.hasOwnProperty.call(material, 'onBeforeCompile');
  material.onBeforeCompile = (shader, renderer) => {
    previous(shader, renderer);
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uWindStrength = uniforms.uWindStrength;
    shader.uniforms.uWindDirection = uniforms.uWindDirection;
    shader.uniforms.uWindFlutter = flutterUniform;
    const who = `applyWind (${material.type} vertex)`;
    let vs = shader.vertexShader;
    vs = replaceChunk(vs, '#include <common>', `#include <common>\n${WIND_GLSL}`, who);
    vs = replaceChunk(vs, '#include <project_vertex>', projectChunk(instancePhase), who);
    // MeshDepthMaterial computes no world position, so it alone has no worldpos chunk to swap.
    if (!(material as Material & { isMeshDepthMaterial?: boolean }).isMeshDepthMaterial) vs = replaceChunk(vs, '#include <worldpos_vertex>', WORLDPOS_CHUNK, who);
    shader.vertexShader = vs;
  };
  // A stable key: every wind material of the same kind shares one program (flutter is a uniform, not a define).
  const key = `${WIND_VERSION}:${instancePhase ? 'ip' : 'vp'}`;
  material.customProgramCacheKey = () => (hadCustomCompile ? `${previousKey()}|${key}` : key);
  material.userData.wind = WIND_VERSION;
  material.userData.windFlutter = flutterUniform;
  material.needsUpdate = true;
  return material;
}

/**
 * Give a mesh wind-patched shadow materials so its shadow sways with it. Use the same options as its main material.
 * The created materials are disposed by `disposeWindShadows(mesh)`.
 */
export function applyWindShadows<T extends Mesh>(mesh: T, uniforms: WindUniforms, options: WindOptions = {}): T {
  mesh.customDepthMaterial = applyWind(new MeshDepthMaterial(), uniforms, options);
  mesh.customDistanceMaterial = applyWind(new MeshDistanceMaterial(), uniforms, options);
  return mesh;
}

/** Convenience: patch the mesh's material(s) and its shadow materials in one call. */
export function windMesh<T extends Mesh>(mesh: T, uniforms: WindUniforms, options: WindOptions = {}): T {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const m of materials) if (!isWindMaterial(m)) applyWind(m, uniforms, options);
  return applyWindShadows(mesh, uniforms, options);
}

export function disposeWindShadows(mesh: Mesh): void {
  mesh.customDepthMaterial?.dispose();
  mesh.customDistanceMaterial?.dispose();
}
