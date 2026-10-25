// Shared helper for onBeforeCompile shader patches. Owned by the coordinator (see AGENTS.md).
import { REVISION } from 'three';

/**
 * Replace the first `needle` in a shader source, or throw if the source does not contain it.
 * A plain `String.replace` returns the source unchanged when three.js renames or drops a chunk, and the patch then
 * silently does nothing; this turns that into an error that names the patch, the needle and the fix.
 * `who` names the patch and the shader stage, for example "applyWind (MeshDepthMaterial vertex)".
 */
export function replaceChunk(src: string, needle: string, replacement: string, who: string): string {
  const at = src.indexOf(needle);
  if (at < 0) {
    throw new Error(
      `${who}: shader source has no "${needle}", so the patch cannot apply. three.js r${REVISION} may have renamed or removed that chunk; ` +
        `find its replacement in node_modules/three/src/renderers/shaders/ and update the patch's needle to match.`,
    );
  }
  return src.slice(0, at) + replacement + src.slice(at + needle.length);
}
