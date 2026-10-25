import { describe, expect, it } from 'vitest';
import { Box3, Group, InstancedMesh, MeshDepthMaterial, MeshStandardMaterial, ShaderLib, UniformsUtils, Vector2, type WebGLProgramParametersWithUniforms } from 'three';
import { DEFAULT_PARAMS, type GeneratedTree, type LeafAnchor, type WindUniforms } from '../src/contracts';
import { createFoliage } from '../src/foliage/createFoliage';
import { devAnchors } from '../src/foliage/devAnchors';
import { applyWind, isWindMaterial, windMesh } from '../src/wind/wind';
import { Mesh, BoxGeometry } from 'three';

const wind = (): WindUniforms => ({ uTime: { value: 0 }, uWindStrength: { value: 0.35 }, uWindDirection: { value: new Vector2(1, 0) } });
const fakeTree = (anchors: LeafAnchor[]): GeneratedTree => ({ object: new Group(), leafAnchors: anchors, height: 8, crownRadius: 4, bounds: new Box3(), dispose() {} });

function meshes(object: Group | import('three').Object3D): InstancedMesh[] {
  const out: InstancedMesh[] = [];
  object.traverse((o) => { if ((o as InstancedMesh).isInstancedMesh) out.push(o as InstancedMesh); });
  return out;
}
const byName = (object: import('three').Object3D, name: string) => object.getObjectByName(name) as InstancedMesh;
function triangles(mesh: InstancedMesh): number {
  return (mesh.geometry.getAttribute('position').count / 3) * mesh.count;
}

describe('createFoliage', () => {
  const anchors = devAnchors(3);

  it('is deterministic for a seed and differs between seeds', () => {
    const a = createFoliage(fakeTree(anchors), DEFAULT_PARAMS, wind());
    const b = createFoliage(fakeTree(anchors), DEFAULT_PARAMS, wind());
    const c = createFoliage(fakeTree(anchors), { ...DEFAULT_PARAMS, seed: DEFAULT_PARAMS.seed + 1 }, wind());
    for (const name of ['blossoms', 'blossom-leaves', 'falling-petals', 'ground-petals']) {
      const ma = byName(a.object, name);
      const mb = byName(b.object, name);
      expect(ma.count).toBe(mb.count);
      expect(Array.from(ma.instanceMatrix.array)).toEqual(Array.from(mb.instanceMatrix.array));
      expect(Array.from(ma.instanceColor!.array)).toEqual(Array.from(mb.instanceColor!.array));
    }
    expect(Array.from(byName(a.object, 'blossoms').instanceMatrix.array)).not.toEqual(Array.from(byName(c.object, 'blossoms').instanceMatrix.array));
    for (const f of [a, b, c]) f.dispose();
  });

  it('scales blossom count with leafDensity, and 0 gives none', () => {
    const counts = [0, 0.5, 1].map((leafDensity) => {
      const f = createFoliage(fakeTree(anchors), { ...DEFAULT_PARAMS, leafDensity }, wind());
      const n = byName(f.object, 'blossoms').count;
      f.dispose();
      return n;
    });
    expect(counts[0]).toBe(0);
    expect(counts[1]).toBeGreaterThan(0);
    expect(counts[2]).toBeGreaterThan(counts[1] * 1.8);
  });

  it('handles a tree with no anchors', () => {
    const f = createFoliage(fakeTree([]), DEFAULT_PARAMS, wind());
    for (const m of meshes(f.object)) expect(m.count).toBe(0);
    f.dispose();
  });

  it('stays inside the budget: under 80k triangles and 6 draw calls, even for a huge tree', () => {
    const f = createFoliage(fakeTree(devAnchors(5, 3000)), DEFAULT_PARAMS, wind());
    const ms = meshes(f.object);
    expect(ms.length).toBeLessThan(6);
    const total = ms.reduce((sum, m) => sum + triangles(m), 0);
    expect(total).toBeLessThan(80000);
    expect(byName(f.object, 'blossoms').count).toBeGreaterThan(300);
    f.dispose();
  });

  it('gives blossoms a per-instance aSway from the anchors and wind-patched shadows', () => {
    const f = createFoliage(fakeTree(anchors), DEFAULT_PARAMS, wind());
    const blossoms = byName(f.object, 'blossoms');
    const sway = blossoms.geometry.getAttribute('aSway');
    expect(sway.count).toBeGreaterThanOrEqual(blossoms.count);
    expect(isWindMaterial(blossoms.material as MeshStandardMaterial)).toBe(true);
    expect(blossoms.customDepthMaterial && isWindMaterial(blossoms.customDepthMaterial)).toBe(true);
    f.dispose();
  });
});

describe('applyWind', () => {
  it('sets a stable cache key and leaves the material type intact', () => {
    const w = wind();
    const m1 = applyWind(new MeshStandardMaterial({ flatShading: true }), w);
    const m2 = applyWind(new MeshStandardMaterial(), w);
    expect(m1).toBeInstanceOf(MeshStandardMaterial);
    expect(m1.type).toBe('MeshStandardMaterial');
    expect(m1.customProgramCacheKey()).toContain('wind');
    expect(m1.customProgramCacheKey()).toBe(m2.customProgramCacheKey());
    expect(applyWind(m1, w)).toBe(m1); // idempotent
  });

  it('injects the displacement into the vertex shader and shares the wind uniforms', () => {
    const w = wind();
    const m = applyWind(new MeshStandardMaterial(), w);
    const shader = { uniforms: UniformsUtils.clone(ShaderLib.standard.uniforms), vertexShader: ShaderLib.standard.vertexShader, fragmentShader: ShaderLib.standard.fragmentShader } as unknown as WebGLProgramParametersWithUniforms;
    m.onBeforeCompile(shader, undefined as never);
    expect(shader.vertexShader).toContain('windOffset');
    expect(shader.vertexShader).toContain('attribute float aSway');
    expect(shader.vertexShader).not.toContain('#include <project_vertex>');
    expect(shader.uniforms.uTime).toBe(w.uTime);
    expect(shader.uniforms.uWindStrength).toBe(w.uWindStrength);
  });

  it('windMesh patches the main material and both shadow materials', () => {
    const mesh = windMesh(new Mesh(new BoxGeometry(), new MeshStandardMaterial()), wind());
    expect(isWindMaterial(mesh.material as MeshStandardMaterial)).toBe(true);
    expect(mesh.customDepthMaterial).toBeInstanceOf(MeshDepthMaterial);
    expect(isWindMaterial(mesh.customDepthMaterial!)).toBe(true);
    expect(isWindMaterial(mesh.customDistanceMaterial!)).toBe(true);
  });
});
