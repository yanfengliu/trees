// WASD + mouse camera. Owned by the UI worker.
import type { PerspectiveCamera, Vector3 } from 'three';

export interface CameraControls {
  /** Advance movement from held keys. */
  update(dt: number): void;
  /** Place the camera and aim it at `target`; the controls continue from this pose. Used by the shots hook. */
  setPose(position: Vector3, target: Vector3): void;
  dispose(): void;
}

/** STUB: no input handling yet; setPose places the camera. */
export function createCameraControls(camera: PerspectiveCamera, _dom: HTMLElement): CameraControls {
  return {
    update(_dt: number) {},
    setPose(position, target) { camera.position.copy(position); camera.lookAt(target); },
    dispose() {},
  };
}
