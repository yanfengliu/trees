// Procedural low-poly cherry blossom tree. Owned by the tree worker.
import { Box3, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import type { GeneratedTree, LeafAnchor, TreeParams, WindUniforms } from '../contracts';
import { createRng } from '../random';
import { applyWind } from '../wind/wind';
import { buildBarkGeometry } from './barkMesh';
import { buildSkeleton } from './skeleton';

export function generateTree(params: TreeParams, wind: WindUniforms): GeneratedTree {
  const rng = createRng(params.seed);
  const age = Math.min(Math.max(params.age, 0), 1);
  const { branches, blossomPoints } = buildSkeleton(rng, age);

  // Normalise sway so typical outer twig tips reach 1 (the few longest paths clamp there).
  const tips = branches.map((b) => b.nodes[b.nodes.length - 1].sway).sort((x, y) => x - y);
  const maxSway = Math.max(1e-6, tips[Math.floor(tips.length * 0.8)]);

  const geometry = buildBarkGeometry(branches, rng, maxSway);
  const material = applyWind(
    new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.92, metalness: 0 }),
    wind,
  );
  const mesh = new Mesh(geometry, material);
  mesh.name = 'bark';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const object = new Group();
  object.name = 'tree';
  object.add(mesh);

  const sizeScale = 0.55 + 0.45 * (0.3 + 0.7 * age);
  const leafAnchors: LeafAnchor[] = blossomPoints.map(({ node, dir, level }) => ({
    position: node.p.clone(),
    direction: dir.clone(),
    size: (level <= 2 ? 0.5 : level === 3 ? 0.42 : 0.36) * sizeScale * (0.85 + 0.3 * rng()),
    sway: Math.min(1, node.sway / maxSway),
  }));

  const bounds = geometry.boundingBox!.clone();
  const tmp = new Vector3();
  let crownRadius = 0;
  for (const a of leafAnchors) {
    bounds.expandByPoint(tmp.copy(a.position).addScalar(a.size));
    bounds.expandByPoint(tmp.copy(a.position).addScalar(-a.size));
    crownRadius = Math.max(crownRadius, Math.hypot(a.position.x, a.position.z) + a.size);
  }

  return {
    object,
    leafAnchors,
    height: bounds.max.y,
    crownRadius,
    bounds: new Box3().copy(bounds),
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
