// Shared contracts between the tree, foliage, wind, scene and UI modules.
// Change these only through the coordinator: every module depends on them.
import type { Box3, Object3D, Vector2, Vector3 } from 'three';

/** Everything the user can change. All generation is a pure function of these values. */
export interface TreeParams {
  /** Integer seed; the same params always grow the same tree. */
  seed: number;
  /** 0 = sapling, 1 = old giant. Scales height, trunk girth and branch count. */
  age: number;
  /** Hour of day, 0..24. 12 = noon, ~18.5 = golden hour, 0 = night. */
  timeOfDay: number;
  /** 0 = still air, 1 = strong gusts. */
  wind: number;
  /** 0..1 multiplier on blossom count. */
  leafDensity: number;
}

export const DEFAULT_PARAMS: TreeParams = { seed: 7, age: 0.75, timeOfDay: 17.5, wind: 0.35, leafDensity: 1 };

/** A place where the foliage module may put a blossom cluster. World units are metres; the trunk base is at the origin. */
export interface LeafAnchor {
  position: Vector3;
  /** Unit direction of the twig the leaves hang from. */
  direction: Vector3;
  /** Suggested cluster radius in metres. */
  size: number;
  /** Same value the bark carries in aSway at this point: 0 at the trunk base, ~1 at the outermost twigs. */
  sway: number;
}

export interface GeneratedTree {
  /** Bark meshes. Bark geometry carries a float attribute `aSway` (see LeafAnchor.sway) for wind. */
  object: Object3D;
  leafAnchors: LeafAnchor[];
  height: number;
  crownRadius: number;
  bounds: Box3;
  dispose(): void;
}

/** Shared by every wind-driven material. Owned by main.ts; modules read it, only main.ts writes it. */
export interface WindUniforms {
  uTime: { value: number };
  /** 0..1, from TreeParams.wind. */
  uWindStrength: { value: number };
  /** Unit XZ direction the wind blows towards. */
  uWindDirection: { value: Vector2 };
}

export interface Foliage {
  object: Object3D;
  dispose(): void;
}

export interface SceneRig {
  /** Sky, sun, ground and grass. Does not include the tree. */
  update(dt: number): void;
  /** Called after each regeneration so the scene can fit shadows and camera target to the tree. */
  fitToTree(tree: GeneratedTree): void;
  setTimeOfDay(hours: number): void;
}
