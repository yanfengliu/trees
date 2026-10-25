// Leaves. Owned by the foliage-and-wind worker.
// Blossom clusters and leaf sprigs at the tree's leaf anchors, falling petals and a petal scatter on the ground.
// Four InstancedMeshes (four draw calls), all deterministic from params.seed.
import { Group } from 'three';
import type { Foliage, GeneratedTree, TreeParams, WindUniforms } from '../contracts';
import { createRng } from '../random';
import { createBlossoms } from './blossoms';
import { measureCrown } from './crown';
import { createPetals } from './petals';

export function createFoliage(tree: GeneratedTree, params: TreeParams, wind: WindUniforms): Foliage {
  const rng = createRng((params.seed ^ 0x5a4b1e55) >>> 0);
  const anchors = tree.leafAnchors;
  const crown = measureCrown(anchors);
  const blossoms = createBlossoms(anchors, params.leafDensity, crown, rng, wind);
  const petals = createPetals(crown, rng, wind, params.leafDensity);
  const object = new Group();
  object.name = 'foliage';
  object.add(blossoms.blossoms, blossoms.leaves, petals.falling, petals.ground);
  return {
    object,
    dispose() {
      blossoms.dispose();
      petals.dispose();
    },
  };
}
