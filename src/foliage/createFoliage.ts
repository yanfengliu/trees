// Leaves. Owned by the foliage-and-wind worker.
import { Group } from 'three';
import type { Foliage, GeneratedTree, TreeParams, WindUniforms } from '../contracts';

/** STUB: no leaves until the foliage worker lands. */
export function createFoliage(_tree: GeneratedTree, _params: TreeParams, _wind: WindUniforms): Foliage {
  const object = new Group();
  return { object, dispose() {} };
}
