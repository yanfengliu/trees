// The whole-scene render budget (docs/work/0_first-tree/plan.md): main-pass triangles and draw calls.
// Bound: counts what the main render pass would submit for scene + tree + foliage, built exactly as main.ts builds them.
// Triangles: index (or vertex) count / 3, times `count` for instanced meshes; Points and Lines add draw calls but no triangles.
// Draw calls: one per visible Mesh, Points or Line, with every material group counted. Shadow passes are not counted.
// It does not measure frame rate, shadow-pass cost or anything the GPU culls.
import { describe, expect, it } from 'vitest';
import { Scene, Vector2, type BufferGeometry, type Object3D } from 'three';
import { DEFAULT_PARAMS, type TreeParams, type WindUniforms } from '../src/contracts';
import { createScene } from '../src/scene/createScene';
import { generateTree } from '../src/tree/generateTree';
import { createFoliage } from '../src/foliage/createFoliage';

/** Seeds 1-40 plus a few far-apart ones; age 1 grows the most bark, so this is the worst case the panel can reach. */
const SEEDS = [...Array.from({ length: 40 }, (_, i) => i + 1), 99, 1234, 31337, 500000, 999999, 2 ** 31 - 1];

export const BUDGET = { triangles: 150_000, drawCalls: 30 };

const wind = (): WindUniforms => ({ uTime: { value: 0 }, uWindStrength: { value: 0.35 }, uWindDirection: { value: new Vector2(1, 0) } });

interface Item { name: string; tris: number; draws: number }

function mainPass(root: Object3D): { tris: number; draws: number; items: Item[] } {
  const items: Item[] = [];
  root.traverseVisible((o) => {
    const m = o as Object3D & { geometry?: BufferGeometry; material?: unknown; count?: number; isMesh?: boolean; isInstancedMesh?: boolean };
    if (!m.geometry) return;
    const groups = Array.isArray(m.material) ? Math.max(1, m.geometry.groups.length) : 1;
    const instances = m.isInstancedMesh ? (m.count ?? 0) : 1;
    if (m.isInstancedMesh && instances === 0) return; // three skips empty instanced draws
    const g = m.geometry;
    const verts = g.index ? g.index.count : g.attributes.position.count;
    const tris = m.isMesh ? (verts / 3) * instances : 0;
    items.push({ name: m.name || m.type, tris, draws: groups });
  });
  return { tris: items.reduce((s, i) => s + i.tris, 0), draws: items.reduce((s, i) => s + i.draws, 0), items };
}

function build(params: TreeParams) {
  const w = wind();
  const scene = new Scene();
  const rig = createScene(scene, w);
  const tree = generateTree(params, w);
  scene.add(tree.object);
  rig.fitToTree(tree);
  const foliage = createFoliage(tree, params, w);
  scene.add(foliage.object);
  const result = mainPass(scene);
  tree.dispose();
  foliage.dispose();
  return result;
}

describe('whole-scene budget', () => {
  it(`stays under ${BUDGET.triangles} triangles and ${BUDGET.drawCalls} draw calls at default params`, () => {
    const r = build(DEFAULT_PARAMS);
    console.log(`defaults: ${Math.round(r.tris)} triangles, ${r.draws} draw calls\n${r.items.map((i) => `  ${i.name}: ${Math.round(i.tris)}`).join('\n')}`);
    expect(r.tris).toBeLessThan(BUDGET.triangles);
    expect(r.draws).toBeLessThan(BUDGET.drawCalls);
  });

  it('stays under budget for the biggest trees (age 1) over several seeds', () => {
    let worst = { seed: -1, tris: 0, draws: 0 };
    for (const seed of SEEDS) {
      const r = build({ ...DEFAULT_PARAMS, seed, age: 1 });
      if (r.tris > worst.tris) worst = { seed, tris: r.tris, draws: r.draws };
      expect(r.tris, `seed ${seed} at age 1`).toBeLessThan(BUDGET.triangles);
      expect(r.draws, `seed ${seed} at age 1`).toBeLessThan(BUDGET.drawCalls);
    }
    console.log(`worst age-1 seed ${worst.seed}: ${Math.round(worst.tris)} triangles, ${worst.draws} draw calls`);
  });
});
