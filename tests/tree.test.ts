import { describe, expect, it } from 'vitest';
import { BufferGeometry, Mesh, Vector2 } from 'three';
import { DEFAULT_PARAMS, type GeneratedTree, type TreeParams, type WindUniforms } from '../src/contracts';
import { generateTree } from '../src/tree/generateTree';

const wind: WindUniforms = { uTime: { value: 0 }, uWindStrength: { value: 0.3 }, uWindDirection: { value: new Vector2(1, 0) } };
const make = (p: Partial<TreeParams> = {}) => generateTree({ ...DEFAULT_PARAMS, ...p }, wind);

function barkGeometries(tree: GeneratedTree): BufferGeometry[] {
  const out: BufferGeometry[] = [];
  tree.object.traverse((o) => { if (o instanceof Mesh) out.push(o.geometry as BufferGeometry); });
  return out;
}
const triangles = (g: BufferGeometry) => (g.index ? g.index.count : g.attributes.position.count) / 3;

describe('generateTree', () => {
  it('is deterministic for the same params', () => {
    const a = make();
    const b = make();
    const ga = barkGeometries(a);
    const gb = barkGeometries(b);
    expect(ga.length).toBe(gb.length);
    ga.forEach((g, i) => {
      expect(Array.from(g.attributes.position.array)).toEqual(Array.from(gb[i].attributes.position.array));
      expect(Array.from(g.attributes.aSway.array)).toEqual(Array.from(gb[i].attributes.aSway.array));
    });
    expect(a.leafAnchors).toEqual(b.leafAnchors);
    expect(a.height).toBe(b.height);
  });

  it('differs between seeds', () => {
    const a = barkGeometries(make({ seed: 1 }))[0].attributes.position.array;
    const b = barkGeometries(make({ seed: 2 }))[0].attributes.position.array;
    expect(Array.from(a)).not.toEqual(Array.from(b));
  });

  it('grows with age', () => {
    for (const seed of [1, 7, 42]) {
      const young = make({ seed, age: 0 });
      const old = make({ seed, age: 1 });
      expect(young.height).toBeLessThan(old.height * 0.6);
      expect(young.crownRadius).toBeLessThan(old.crownRadius);
      expect(young.leafAnchors.length).toBeLessThan(old.leafAnchors.length);
    }
  });

  it('carries aSway in [0,1], zero at the base and rising to the tips', () => {
    const tree = make();
    for (const g of barkGeometries(tree)) {
      const sway = g.attributes.aSway;
      const pos = g.attributes.position;
      expect(sway).toBeDefined();
      expect(sway.count).toBe(pos.count);
      let max = 0;
      for (let i = 0; i < sway.count; i++) {
        const s = sway.getX(i);
        expect(s).toBeGreaterThanOrEqual(0);
        expect(s).toBeLessThanOrEqual(1);
        if (pos.getY(i) < 0.3) expect(s).toBeLessThan(0.05);
        max = Math.max(max, s);
      }
      expect(max).toBeGreaterThan(0.9);
    }
  });

  it('stays under the triangle budget at age 1 with a few hundred blossom anchors at defaults', () => {
    for (const seed of [1, 7, 42, 99]) {
      const total = barkGeometries(make({ seed, age: 1 })).reduce((n, g) => n + triangles(g), 0);
      expect(total).toBeLessThan(40000);
    }
    const n = make().leafAnchors.length;
    expect(n).toBeGreaterThan(150);
    expect(n).toBeLessThan(1500);
  });

  it('keeps anchors inside bounds with valid fields', () => {
    const tree = make();
    expect(tree.height).toBeCloseTo(tree.bounds.max.y);
    expect(tree.crownRadius).toBeGreaterThan(tree.height * 0.5);
    for (const a of tree.leafAnchors) {
      expect(tree.bounds.containsPoint(a.position)).toBe(true);
      expect(a.direction.length()).toBeCloseTo(1, 5);
      expect(a.size).toBeGreaterThan(0);
      expect(a.sway).toBeGreaterThanOrEqual(0);
      expect(a.sway).toBeLessThanOrEqual(1);
    }
  });

  it('disposes without throwing', () => {
    expect(() => make().dispose()).not.toThrow();
  });

  it('reports stats', () => {
    for (const age of [0, 0.3, 0.75, 1]) {
      const t = make({ age });
      const tris = barkGeometries(t).reduce((n, g) => n + triangles(g), 0);
      console.log(`age ${age}: tris ${tris}, anchors ${t.leafAnchors.length}, height ${t.height.toFixed(2)}, crown ${t.crownRadius.toFixed(2)}`);
    }
  });
});
