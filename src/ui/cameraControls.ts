// WASD + mouse camera. Owned by the UI worker.
// Keys: WASD / arrows move on the ground plane, Space/E up, Q/C down, Shift sprints.
// Left-drag looks around (no pointer lock), the wheel moves along the view direction.
import type { PerspectiveCamera, Vector3 } from 'three';
import { clampPitch, clampPosition, dampToward, isTypingTarget, KEYMAP, MOVE, moveIntent, wheelImpulse, wishVelocity, yawPitchFromDirection, type Vec3 } from './movement';

export interface CameraControls {
  /** Advance movement from held keys. */
  update(dt: number): void;
  /** Place the camera and aim it at `target`; the controls continue from this pose. Used by the shots hook. */
  setPose(position: Vector3, target: Vector3): void;
  dispose(): void;
}

/**
 * The camera pose is mirrored, read-only, into `dom.dataset.pose` as "x,y,z,yaw,pitch" (metres, radians)
 * whenever it changes, so scripts/shots.mjs --input can check real input moved the camera.
 */
export function createCameraControls(camera: PerspectiveCamera, dom: HTMLElement): CameraControls {
  const held = new Set<string>();
  let velocity: Vec3 = { x: 0, y: 0, z: 0 };
  let yaw = 0;
  let pitch = 0;
  let dragging: { id: number; x: number; y: number } | null = null;
  let poseDirty = true;

  const applyRotation = (): void => { camera.rotation.set(pitch, yaw, 0, 'YXZ'); poseDirty = true; };
  {
    const d = camera.getWorldDirection(camera.position.clone());
    ({ yaw, pitch } = yawPitchFromDirection(d));
    applyRotation();
  }

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target as HTMLElement | null)) return;
    if (!(e.code in KEYMAP)) return;
    held.add(e.code);
    // Space and arrows would scroll the page otherwise.
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
  };
  const onKeyUp = (e: KeyboardEvent): void => { held.delete(e.code); };
  const onBlur = (): void => { held.clear(); dragging = null; };

  const onPointerDown = (e: PointerEvent): void => {
    if (e.button !== 0) return;
    // Drop focus from a panel field so keys move the camera again.
    if (document.activeElement instanceof HTMLElement && isTypingTarget(document.activeElement)) document.activeElement.blur();
    dragging = { id: e.pointerId, x: e.clientX, y: e.clientY };
    dom.setPointerCapture?.(e.pointerId);
    dom.style.cursor = 'grabbing';
    e.preventDefault();
  };
  const onPointerMove = (e: PointerEvent): void => {
    if (!dragging || e.pointerId !== dragging.id) return;
    const dx = e.clientX - dragging.x, dy = e.clientY - dragging.y;
    dragging.x = e.clientX; dragging.y = e.clientY;
    // Turn with the mouse, as in a game or an editor fly camera: drag right looks right, drag up looks up.
    yaw -= dx * MOVE.lookPerPixel;
    pitch = clampPitch(pitch - dy * MOVE.lookPerPixel);
    applyRotation();
  };
  const onPointerUp = (e: PointerEvent): void => {
    if (!dragging || e.pointerId !== dragging.id) return;
    dragging = null;
    if (dom.hasPointerCapture?.(e.pointerId)) dom.releasePointerCapture(e.pointerId);
    dom.style.cursor = 'grab';
  };
  const onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const kick = wheelImpulse(e.deltaY, e.deltaMode, yaw, pitch);
    velocity = { x: velocity.x + kick.x, y: velocity.y + kick.y, z: velocity.z + kick.z };
  };
  const onContextMenu = (e: Event): void => e.preventDefault();

  // Capture phase: lil-gui stops key events from bubbling out of the panel, and a key released
  // while a panel field has focus must still be seen, or the camera would keep moving.
  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('keyup', onKeyUp, true);
  window.addEventListener('blur', onBlur);
  dom.addEventListener('pointerdown', onPointerDown);
  dom.addEventListener('pointermove', onPointerMove);
  dom.addEventListener('pointerup', onPointerUp);
  dom.addEventListener('pointercancel', onPointerUp);
  dom.addEventListener('wheel', onWheel, { passive: false });
  dom.addEventListener('contextmenu', onContextMenu);
  dom.style.cursor = 'grab';
  dom.style.touchAction = 'none';

  const writePose = (): void => {
    const p = camera.position;
    dom.dataset.pose = [p.x, p.y, p.z, yaw, pitch].map((v) => v.toFixed(4)).join(',');
    poseDirty = false;
  };

  return {
    update(dt: number) {
      if (dt > 0) {
        velocity = dampToward(velocity, wishVelocity(moveIntent(held), yaw), MOVE.response, dt);
        const speed = Math.hypot(velocity.x, velocity.y, velocity.z);
        if (speed < 1e-3 && held.size === 0) {
          velocity = { x: 0, y: 0, z: 0 };
        } else {
          const p = camera.position;
          const { position, hitY, hitRadius } = clampPosition({ x: p.x + velocity.x * dt, y: p.y + velocity.y * dt, z: p.z + velocity.z * dt });
          camera.position.set(position.x, position.y, position.z);
          if (hitY) velocity.y = 0;
          if (hitRadius) { velocity.x = 0; velocity.z = 0; }
          poseDirty = true;
        }
      }
      if (poseDirty) writePose();
    },
    setPose(position, target) {
      const { position: p } = clampPosition(position);
      camera.position.set(p.x, p.y, p.z);
      ({ yaw, pitch } = yawPitchFromDirection({ x: target.x - p.x, y: target.y - p.y, z: target.z - p.z }));
      velocity = { x: 0, y: 0, z: 0 };
      applyRotation();
      camera.updateMatrixWorld();
      writePose();
    },
    dispose() {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('blur', onBlur);
      dom.removeEventListener('pointerdown', onPointerDown);
      dom.removeEventListener('pointermove', onPointerMove);
      dom.removeEventListener('pointerup', onPointerUp);
      dom.removeEventListener('pointercancel', onPointerUp);
      dom.removeEventListener('wheel', onWheel);
      dom.removeEventListener('contextmenu', onContextMenu);
      held.clear();
    },
  };
}
