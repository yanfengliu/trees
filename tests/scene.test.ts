import { describe, expect, it } from 'vitest';
import { Box3, Group, Mesh, Scene, Vector2, Vector3 } from 'three';
import type { GeneratedTree, WindUniforms } from '../src/contracts';
import { createScene, heightAt } from '../src/scene/createScene';
import { sunDirection } from '../src/scene/timeOfDay';

const wind: WindUniforms = { uTime: { value: 0 }, uWindStrength: { value: 0.3 }, uWindDirection: { value: new Vector2(1, 0) } };

function triangles(scene: Scene): { tris: number; draws: number } {
  let tris = 0;
  let draws = 0;
  scene.traverse((o) => {
    const m = o as Mesh;
    if (!m.geometry) return;
    draws++;
    const g = m.geometry;
    const verts = g.index ? g.index.count : g.attributes.position.count;
    const instances = (m as unknown as { count?: number }).count ?? 1;
    if ((o as { isPoints?: boolean }).isPoints) return;
    tris += (verts / 3) * instances;
  });
  return { tris, draws };
}

describe('scene', () => {
  it('ground at the trunk is flat at y = 0', () => {
    expect(heightAt(0, 0)).toBe(0);
    for (let a = 0; a < 6.28; a += 0.5) expect(Math.abs(heightAt(Math.cos(a) * 3, Math.sin(a) * 3))).toBeLessThan(0.01);
    expect(Math.abs(heightAt(20, 10))).toBeGreaterThan(0.1);
  });

  it('sun is higher at noon than at 18 and below the horizon at night', () => {
    const scene = new Scene();
    const rig = createScene(scene, wind);
    rig.setTimeOfDay(12);
    const noon = rig.sunDirection.y;
    const noonIntensity = rig.sun.intensity;
    rig.setTimeOfDay(18);
    expect(noon).toBeGreaterThan(rig.sunDirection.y);
    expect(rig.sunDirection.y).toBeGreaterThan(0);
    rig.setTimeOfDay(0);
    expect(rig.sunDirection.y).toBeLessThan(0);
    expect(sunDirection(23).y).toBeLessThan(0);
    expect(rig.hemi.intensity).toBeGreaterThan(0.2);
    expect(rig.sun.intensity).toBeLessThan(noonIntensity);
  });

  it('fits the shadow camera around the tree', () => {
    const scene = new Scene();
    const rig = createScene(scene, wind);
    const tree: GeneratedTree = {
      object: new Group(), leafAnchors: [], height: 8, crownRadius: 3,
      bounds: new Box3(new Vector3(-3, 0, -3), new Vector3(3, 8, 3)), dispose() {},
    };
    rig.fitToTree(tree);
    const cam = rig.sun.shadow.camera;
    expect(cam.right).toBeGreaterThan(5);
    expect(cam.right).toBeLessThan(8);
    expect(rig.sun.shadow.mapSize.x).toBe(2048);
  });

  it('stays inside the triangle and draw-call budget, deterministically', () => {
    const a = new Scene();
    createScene(a, wind);
    const { tris, draws } = triangles(a);
    expect(tris).toBeLessThan(60000);
    expect(draws).toBeLessThan(12);
    const b = new Scene();
    createScene(b, wind);
    expect(triangles(b)).toEqual({ tris, draws });
    console.log(`scene: ${Math.round(tris)} triangles, ${draws} draw calls`);
  });
});
