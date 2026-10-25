// Controls panel. Owned by the UI worker.
import type { TreeParams } from '../contracts';

/** STUB: no panel. `onChange` must be called with the full new params whenever the user changes anything. */
export function createUI(_params: TreeParams, _onChange: (next: TreeParams) => void): { dispose(): void } {
  return { dispose() {} };
}
