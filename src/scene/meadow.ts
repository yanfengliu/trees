// Grass tufts, wild flowers, fallen petals and rocks scattered over the terrain, all instanced.
import {
  BufferAttribute, BufferGeometry, Color, DodecahedronGeometry, DoubleSide, InstancedMesh, MeshLambertMaterial, MeshStandardMaterial,
  Object3D, Vector3, type Material,
} from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { WindUniforms } from '../contracts';
import { createRng, range, type Rng } from '../random';
import { applyWind } from '../shading/wind';
import { applyPetalLight } from '../shading/petalLight';
import { upFacingNormals } from '../shading/upFacingNormals';
import { smoothstep } from './noise';
import { heightAt } from './terrain';

const dummy = new Object3D();

interface Builder { pos: number[]; col: number[]; sway: number[]; nrm: number[] }
function builder(): Builder { return { pos: [], col: [], sway: [], nrm: [] }; }
function vert(b: Builder, p: [number, number, number], c: [number, number, number], s: number, n: [number, number, number] = [0, 1, 0]): void {
  b.pos.push(...p); b.col.push(...c); b.sway.push(s); b.nrm.push(...n);
}
function finish(b: Builder): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(b.pos), 3));
  g.setAttribute('color', new BufferAttribute(new Float32Array(b.col), 3));
  g.setAttribute('normal', new BufferAttribute(new Float32Array(b.nrm), 3));
  g.setAttribute('aSway', new BufferAttribute(new Float32Array(b.sway), 1));
  g.computeBoundingSphere();
  return g;
}

/** One tuft of five single-triangle blades leaning outward. Normals point up so tufts shade like the ground under them. */
function tuftGeometry(rng: Rng): BufferGeometry {
  const b = builder();
  const BLADES = 5;
  const root: [number, number, number] = [0.42, 0.5, 0.36];
  for (let i = 0; i < BLADES; i++) {
    const a = (i / BLADES) * Math.PI * 2 + rng() * 0.8;
    const off = range(rng, 0.02, 0.11);
    const ox = Math.cos(a) * off, oz = Math.sin(a) * off;
    const face = a + Math.PI / 2 + (rng() - 0.5) * 0.8;
    const w = range(rng, 0.07, 0.11) / 2;
    const px = Math.cos(face) * w, pz = Math.sin(face) * w;
    const h = range(rng, 0.32, 0.55);
    const lean = range(rng, 0.08, 0.22);
    const tip: [number, number, number] = [1.0 + rng() * 0.12, 1.02 + rng() * 0.08, 0.78];
    vert(b, [ox - px, 0, oz - pz], root, 0);
    vert(b, [ox + px, 0, oz + pz], root, 0);
    vert(b, [ox + Math.cos(a) * lean, h, oz + Math.sin(a) * lean], tip, 1);
  }
  return finish(b);
}

/** A tiny five-petal flower on a stem: petals carry vertex colour 1 so the instance colour shows through. */
function flowerGeometry(): BufferGeometry {
  const b = builder();
  const H = 0.24;
  const stem: [number, number, number] = [0.25, 0.4, 0.18];
  vert(b, [-0.012, 0, 0], stem, 0); vert(b, [0.012, 0, 0], stem, 0); vert(b, [0, H, 0], stem, 0.9);
  const white: [number, number, number] = [1, 1, 1];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const r = 0.07;
    vert(b, [0, H, 0], [1, 0.9, 0.55], 0.9);
    vert(b, [Math.cos(a + 0.42) * r, H + 0.012, Math.sin(a + 0.42) * r], white, 1);
    vert(b, [Math.cos(a - 0.42) * r, H + 0.012, Math.sin(a - 0.42) * r], white, 1);
  }
  return finish(b);
}

/** A single cherry petal lying on the ground. */
function petalGeometry(): BufferGeometry {
  const b = builder();
  const c: [number, number, number] = [1, 1, 1];
  vert(b, [0, 0, -0.045], c, 0); vert(b, [0.03, 0, 0.02], c, 0); vert(b, [-0.03, 0, 0.02], c, 0);
  vert(b, [0, 0, 0.04], c, 0); vert(b, [-0.03, 0, 0.02], c, 0); vert(b, [0.03, 0, 0.02], c, 0);
  return finish(b);
}

function rockGeometry(): BufferGeometry {
  const rng = createRng(31);
  let g: BufferGeometry = new DodecahedronGeometry(1, 0);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g);
  const p = g.attributes.position;
  const v = new Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).multiplyScalar(range(rng, 0.8, 1.15));
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g = g.toNonIndexed();
  g.computeVertexNormals();
  return g;
}

export interface Meadow {
  grass: InstancedMesh;
  flowers: InstancedMesh;
  petals: InstancedMesh;
  rocks: InstancedMesh;
  /** Re-scatter fallen petals under a crown of this radius. */
  scatterPetals(crownRadius: number): void;
}

const GRASS_COUNT = 6000;
const FLOWER_COUNT = 420;
const PETAL_COUNT = 2200;
const ROCK_COUNT = 22;

/** Radius drawn so density is highest within ~12 m of the trunk and fades out to `max`. */
function sampleRadius(rng: Rng, min: number, max: number): number {
  for (;;) {
    const r = Math.sqrt(min * min + rng() * (max * max - min * min));
    const density = 0.1 + 0.9 * Math.exp(-((r / 15) ** 2));
    if (rng() < density) return r;
  }
}

export function createMeadow(wind: WindUniforms): Meadow {
  const rng = createRng(2024);
  const color = new Color();

  const grassMat = upFacingNormals(applyWind(new MeshLambertMaterial({ vertexColors: true, side: DoubleSide }), wind));
  const grass = new InstancedMesh(tuftGeometry(rng), grassMat, GRASS_COUNT);
  grass.name = 'grass';
  // Soft spring greens, a touch less yellow than lime.
  const greens = [0x6aa84c, 0x5e9c48, 0x7cb258, 0x56943f, 0x88b860].map((h) => new Color(h));
  for (let i = 0; i < GRASS_COUNT; i++) {
    let r = sampleRadius(rng, 0.45, 48);
    // Thinner under the crown, so the trunk base and the petal carpet show through.
    while (r < 5 && rng() < 0.45 * (1 - r / 5)) r = sampleRadius(rng, 0.45, 48);
    const a = rng() * Math.PI * 2;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    dummy.position.set(x, heightAt(x, z) - 0.02, z);
    dummy.rotation.set((rng() - 0.5) * 0.2, rng() * Math.PI * 2, (rng() - 0.5) * 0.2);
    // Short, soft grass near the trunk (the tree is only ~4.5 m tall), growing to full meadow height further out.
    const near = 0.42 + 0.58 * smoothstep(2.5, 11, r);
    const s = range(rng, 0.7, 1.2) * (1 + Math.min(r, 40) / 110) * near;
    dummy.scale.set(s, s * range(rng, 0.85, 1.2), s);
    dummy.updateMatrix();
    grass.setMatrixAt(i, dummy.matrix);
    color.copy(greens[Math.floor(rng() * greens.length)]).multiplyScalar(range(rng, 0.88, 1.08));
    grass.setColorAt(i, color);
  }
  grass.receiveShadow = true;
  finalize(grass);

  const flowerMat = upFacingNormals(applyWind(new MeshLambertMaterial({ vertexColors: true, side: DoubleSide }), wind));
  const flowers = new InstancedMesh(flowerGeometry(), flowerMat, FLOWER_COUNT);
  flowers.name = 'flowers';
  const blooms = [0xffffff, 0xfff1a8, 0xf7c4d8, 0xc8b6f0, 0xffd27a].map((h) => new Color(h));
  for (let i = 0; i < FLOWER_COUNT; i++) {
    // Flowers grow in little drifts: pick a cluster centre, then jitter around it.
    const cluster = Math.floor(i / 14);
    const cr = createRng(900 + cluster);
    const ca = cr() * Math.PI * 2;
    const crr = 3 + cr() * 26;
    const x = Math.cos(ca) * crr + (rng() - 0.5) * 3.5;
    const z = Math.sin(ca) * crr + (rng() - 0.5) * 3.5;
    dummy.position.set(x, heightAt(x, z), z);
    dummy.rotation.set((rng() - 0.5) * 0.3, rng() * Math.PI * 2, (rng() - 0.5) * 0.3);
    dummy.scale.setScalar(range(rng, 1.2, 1.9));
    dummy.updateMatrix();
    flowers.setMatrixAt(i, dummy.matrix);
    flowers.setColorAt(i, blooms[Math.floor(cr() * blooms.length)]);
  }
  finalize(flowers);

  const petalMat = applyPetalLight(upFacingNormals(new MeshLambertMaterial({ vertexColors: true, side: DoubleSide })), { neutralAmbient: 0.6, translucency: 0.3, glow: 0.06 });
  const petals = new InstancedMesh(petalGeometry(), petalMat, PETAL_COUNT);
  petals.name = 'fallen-petals';
  petals.receiveShadow = true;

  const rockMat = new MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 1, metalness: 0 });
  const rocks = new InstancedMesh(rockGeometry(), rockMat, ROCK_COUNT);
  rocks.name = 'rocks';
  for (let i = 0; i < ROCK_COUNT; i++) {
    const r = range(rng, 5, 40);
    const a = rng() * Math.PI * 2;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const s = range(rng, 0.25, 0.75) * (rng() < 0.2 ? 1.8 : 1);
    dummy.position.set(x, heightAt(x, z) - s * 0.25, z);
    dummy.rotation.set(rng() * 6, rng() * 6, rng() * 6);
    dummy.scale.set(s * range(rng, 1, 1.6), s * range(rng, 0.5, 0.8), s * range(rng, 0.9, 1.3));
    dummy.updateMatrix();
    rocks.setMatrixAt(i, dummy.matrix);
    color.setHex(0xaaa498).multiplyScalar(range(rng, 0.8, 1.1));
    rocks.setColorAt(i, color);
  }
  rocks.castShadow = true;
  rocks.receiveShadow = true;
  finalize(rocks);

  function scatterPetals(crownRadius: number): void {
    const pr = createRng(5150);
    const pinks = [0xffc8d8, 0xfdb8cc, 0xffd6e2, 0xf8a8c0].map((h) => new Color(h));
    const spread = Math.max(1.5, crownRadius * 1.25);
    for (let i = 0; i < PETAL_COUNT; i++) {
      // Gaussian-ish fall-off under the crown, drifted a little downwind.
      const r = spread * Math.sqrt(-Math.log(1 - pr() * 0.98)) * 0.6;
      const a = pr() * Math.PI * 2;
      const x = Math.cos(a) * r + 0.6, z = Math.sin(a) * r + 0.2;
      // Some petals rest on grass tips rather than the soil.
      dummy.position.set(x, heightAt(x, z) + (pr() < 0.3 ? range(pr, 0.06, 0.2) : 0.02), z);
      dummy.rotation.set((pr() - 0.5) * 1.2, pr() * Math.PI * 2, (pr() - 0.5) * 1.2);
      dummy.scale.setScalar(range(pr, 1.0, 1.5));
      dummy.updateMatrix();
      petals.setMatrixAt(i, dummy.matrix);
      petals.setColorAt(i, pinks[Math.floor(pr() * pinks.length)]);
    }
    finalize(petals);
  }
  scatterPetals(3);

  return { grass, flowers, petals, rocks, scatterPetals };
}

function finalize(mesh: InstancedMesh<BufferGeometry, Material>): void {
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
  mesh.computeBoundingBox();
}
