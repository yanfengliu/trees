// Wind shader injection. Owned by the foliage-and-wind worker.
import type { Material } from 'three';
import type { WindUniforms } from '../contracts';

/**
 * Patch a built-in material (MeshStandardMaterial, MeshLambertMaterial, ...) so vertices sway with the wind.
 * The geometry must carry a float attribute `aSway` (0 = rigid, 1 = fully free).
 * STUB: returns the material unchanged until the wind worker implements it.
 */
export function applyWind<M extends Material>(material: M, _uniforms: WindUniforms): M {
  return material;
}
