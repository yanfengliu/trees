// Up-facing normals for thin ground cover. Shared shading code, owned by the coordinator (see AGENTS.md).
import type { Material } from 'three';
import { replaceChunk } from './replaceChunk';

/**
 * Light thin geometry with its own (upward) normal on both faces, so back faces of blades and petals
 * are not lit as if they faced the soil. Chains any onBeforeCompile already installed (for example the wind patch).
 */
export function upFacingNormals<M extends Material>(material: M): M {
  const prev = material.onBeforeCompile;
  const prevKey = material.customProgramCacheKey.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    prev.call(material, shader, renderer);
    shader.fragmentShader = replaceChunk(shader.fragmentShader, '#include <normal_fragment_begin>', 'float faceDirection = 1.0;\nvec3 normal = normalize( vNormal );', `upFacingNormals (${material.type} fragment)`);
  };
  material.customProgramCacheKey = () => `${prevKey()}|up-normals`;
  return material;
}
