// Procedural branching and bark mesh. Owned by the tree worker.
import { Box3, Group, Mesh, CylinderGeometry, MeshStandardMaterial, Vector3, BufferAttribute } from 'three';
import type { GeneratedTree, TreeParams, WindUniforms } from '../contracts';
import { applyWind } from '../wind/wind';

/** STUB: a single cylinder so the app runs before the tree worker lands. */
export function generateTree(params: TreeParams, wind: WindUniforms): GeneratedTree {
  const height = 4 + 6 * params.age;
  const geometry = new CylinderGeometry(0.15, 0.3, height, 12);
  geometry.translate(0, height / 2, 0);
  const count = geometry.attributes.position.count;
  const sway = new Float32Array(count);
  for (let i = 0; i < count; i++) sway[i] = geometry.attributes.position.getY(i) / height;
  geometry.setAttribute('aSway', new BufferAttribute(sway, 1));
  const material = applyWind(new MeshStandardMaterial({ color: 0x5a4030, roughness: 0.9 }), wind);
  const mesh = new Mesh(geometry, material);
  mesh.castShadow = true;
  const object = new Group();
  object.add(mesh);
  return {
    object,
    leafAnchors: [{ position: new Vector3(0, height, 0), direction: new Vector3(0, 1, 0), size: 1.5, sway: 1 }],
    height,
    crownRadius: 2,
    bounds: new Box3().setFromObject(object),
    dispose() { geometry.dispose(); material.dispose(); },
  };
}
