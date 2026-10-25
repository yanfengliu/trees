// Every onBeforeCompile patch against the real three.js ShaderLib sources it runs on in the app.
// Bound: the installed three version's unexpanded ShaderLib sources (what onBeforeCompile receives); it does not compile GLSL.
import { describe, expect, it } from 'vitest';
import {
  Material, MeshDepthMaterial, MeshDistanceMaterial, MeshLambertMaterial, MeshStandardMaterial, Scene, ShaderLib, UniformsUtils, Vector2,
  type Object3D, type WebGLProgramParametersWithUniforms,
} from 'three';
import { DEFAULT_PARAMS, type WindUniforms } from '../src/contracts';
import { replaceChunk } from '../src/shading/replaceChunk';
import { applyWind } from '../src/shading/wind';
import { applyPetalLight } from '../src/shading/petalLight';
import { upFacingNormals } from '../src/shading/upFacingNormals';
import { createScene } from '../src/scene/createScene';
import { generateTree } from '../src/tree/generateTree';
import { createFoliage } from '../src/foliage/createFoliage';

const wind = (): WindUniforms => ({ uTime: { value: 0 }, uWindStrength: { value: 0.35 }, uWindDirection: { value: new Vector2(1, 0) } });

const LIB: Record<string, keyof typeof ShaderLib> = {
  MeshLambertMaterial: 'lambert', MeshStandardMaterial: 'standard', MeshDepthMaterial: 'depth', MeshDistanceMaterial: 'distance',
};

/** Run a material's onBeforeCompile on the real ShaderLib source for its type; returns the patched shader. */
function compile(material: Material): WebGLProgramParametersWithUniforms {
  const lib = ShaderLib[LIB[material.type]];
  if (!lib) throw new Error(`no ShaderLib source mapped for ${material.type}`);
  const shader = { uniforms: UniformsUtils.clone(lib.uniforms), vertexShader: lib.vertexShader, fragmentShader: lib.fragmentShader } as unknown as WebGLProgramParametersWithUniforms;
  material.onBeforeCompile(shader, undefined as never);
  return shader;
}

describe('replaceChunk', () => {
  it('replaces the first match', () => {
    expect(replaceChunk('a #include <x> b #include <x>', '#include <x>', 'X', 'test')).toBe('a X b #include <x>');
  });
  it('throws naming the patch, the needle and what to update when the needle is missing', () => {
    expect(() => replaceChunk('void main() {}', '#include <project_vertex>', 'X', 'applyWind (MeshLambertMaterial vertex)')).toThrow(
      /applyWind \(MeshLambertMaterial vertex\): shader source has no "#include <project_vertex>".*r\d+.*update the patch's needle/,
    );
  });
});

describe('shader patches on the real ShaderLib sources', () => {
  const kinds = [MeshLambertMaterial, MeshStandardMaterial, MeshDepthMaterial, MeshDistanceMaterial];

  it.each(kinds.map((K) => [new K().type, K] as const))('applyWind patches %s', (_name, K) => {
    const shader = compile(applyWind(new K(), wind()));
    expect(shader.vertexShader).toContain('windOffset( windPhase');
    expect(shader.vertexShader).not.toContain('#include <project_vertex>');
    if (K !== MeshDepthMaterial) expect(shader.vertexShader).toContain('vec4 worldPosition = windWorld');
  });

  it.each([MeshLambertMaterial, MeshStandardMaterial].map((K) => [new K().type, K] as const))('applyPetalLight and upFacingNormals patch %s', (_name, K) => {
    const shader = compile(upFacingNormals(applyPetalLight(applyWind(new K(), wind()))));
    expect(shader.fragmentShader).toContain('petalKey = directLight.color');
    expect(shader.fragmentShader).toContain('uPetalGlow;');
    expect(shader.fragmentShader).toContain('float faceDirection = 1.0;');
    expect(shader.fragmentShader).not.toContain('#include <lights_fragment_begin>');
  });

  it.each([MeshDepthMaterial, MeshDistanceMaterial].map((K) => [new K().type, K] as const))('fragment patches refuse %s loudly rather than doing nothing', (name, K) => {
    expect(() => compile(applyPetalLight(new K()))).toThrow(`applyPetalLight (${name} fragment)`);
    expect(() => compile(upFacingNormals(new K()))).toThrow(`upFacingNormals (${name} fragment)`);
  });

  it('every patched material in the built app compiles against its ShaderLib source, shadow materials included', () => {
    const w = wind();
    const scene = new Scene();
    const rig = createScene(scene, w);
    const tree = generateTree(DEFAULT_PARAMS, w);
    scene.add(tree.object);
    rig.fitToTree(tree);
    scene.add(createFoliage(tree, DEFAULT_PARAMS, w).object);
    const patched = new Map<Material, string>();
    scene.traverse((o: Object3D) => {
      const m = o as Object3D & { material?: Material | Material[]; customDepthMaterial?: Material; customDistanceMaterial?: Material };
      for (const mat of [m.material, m.customDepthMaterial, m.customDistanceMaterial].flat()) {
        if (mat && Object.prototype.hasOwnProperty.call(mat, 'onBeforeCompile')) patched.set(mat, o.name);
      }
    });
    // Bark, blossoms, leaves, falling petals, grass, flowers and fallen petals, plus the wind shadow materials.
    expect(patched.size).toBeGreaterThanOrEqual(13);
    for (const [mat, name] of patched) {
      const lib = ShaderLib[LIB[mat.type]];
      const shader = compile(mat);
      expect(shader.vertexShader !== lib.vertexShader || shader.fragmentShader !== lib.fragmentShader, `${name} ${mat.type} unchanged`).toBe(true);
    }
  });
});
