// Pure camera movement math for cameraControls.ts. No DOM, so tests can run it in node.

export interface Vec3 { x: number; y: number; z: number }

export const MOVE = {
  /** Walking speed in m/s. */
  speed: 4,
  /** Multiplier while the sprint key (Shift) is held. */
  sprint: 2.5,
  /** How fast velocity approaches the wished velocity, per second. Higher feels snappier. */
  response: 8,
  /** Velocity impulse in m/s per 100 px of wheel scroll, along the full view direction. */
  wheelImpulse: 6,
  /** Radians of look per pixel of mouse drag. */
  lookPerPixel: 0.0035,
  /** Pitch limit in radians (about 85 degrees), so the view never flips over the pole. */
  maxPitch: (85 * Math.PI) / 180,
  minY: 0.3,
  maxY: 60,
  /** Horizontal distance limit from the origin, in metres. */
  maxRadius: 80,
};

/** Which movement each held key (KeyboardEvent.code) asks for. Space/E up, Q/C down, Shift sprints. */
export const KEYMAP: Readonly<Record<string, 'forward' | 'back' | 'left' | 'right' | 'up' | 'down' | 'sprint'>> = {
  KeyW: 'forward', ArrowUp: 'forward',
  KeyS: 'back', ArrowDown: 'back',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  Space: 'up', KeyE: 'up',
  KeyQ: 'down', KeyC: 'down',
  ShiftLeft: 'sprint', ShiftRight: 'sprint',
};

export interface MoveIntent { forward: number; right: number; up: number; sprint: boolean }

/** Turn the set of held key codes into -1..1 axes. Opposite keys cancel. */
export function moveIntent(held: Iterable<string>): MoveIntent {
  const on = new Set<string>();
  for (const code of held) { const action = KEYMAP[code]; if (action) on.add(action); }
  const axis = (pos: string, neg: string): number => (on.has(pos) ? 1 : 0) - (on.has(neg) ? 1 : 0);
  return { forward: axis('forward', 'back'), right: axis('right', 'left'), up: axis('up', 'down'), sprint: on.has('sprint') };
}

/** Unit view direction for a yaw/pitch pair (three.js camera convention: yaw 0 looks down -Z, Euler order YXZ). */
export function forwardFromYawPitch(yaw: number, pitch: number): Vec3 {
  const c = Math.cos(pitch);
  return { x: -Math.sin(yaw) * c, y: Math.sin(pitch), z: -Math.cos(yaw) * c };
}

/** Inverse of forwardFromYawPitch; pitch is clamped to MOVE.maxPitch. A zero vector gives yaw 0, pitch 0. */
export function yawPitchFromDirection(d: Vec3): { yaw: number; pitch: number } {
  const len = Math.hypot(d.x, d.y, d.z);
  if (len < 1e-9) return { yaw: 0, pitch: 0 };
  return { yaw: Math.atan2(-d.x, -d.z), pitch: clampPitch(Math.asin(d.y / len)) };
}

export function clampPitch(pitch: number): number {
  return Math.min(MOVE.maxPitch, Math.max(-MOVE.maxPitch, pitch));
}

/**
 * The velocity the held keys ask for, in world space. WASD moves on the ground plane relative to the
 * view's yaw (looking down does not slow walking), up/down moves straight along world Y.
 */
export function wishVelocity(intent: MoveIntent, yaw: number): Vec3 {
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw); // ground-plane forward
  const rx = Math.cos(yaw), rz = -Math.sin(yaw); // ground-plane right
  let x = fx * intent.forward + rx * intent.right;
  let z = fz * intent.forward + rz * intent.right;
  const flat = Math.hypot(x, z);
  if (flat > 1) { x /= flat; z /= flat; } // diagonals are not faster
  const speed = MOVE.speed * (intent.sprint ? MOVE.sprint : 1);
  return { x: x * speed, y: intent.up * speed, z: z * speed };
}

/** Move `current` toward `target` frame-rate independently: the gap shrinks by exp(-rate * dt). */
export function dampToward(current: Vec3, target: Vec3, rate: number, dt: number): Vec3 {
  const k = 1 - Math.exp(-rate * dt);
  return { x: current.x + (target.x - current.x) * k, y: current.y + (target.y - current.y) * k, z: current.z + (target.z - current.z) * k };
}

/** Velocity impulse for a wheel event: scrolling up (negative deltaY) moves forward along the view. */
export function wheelImpulse(deltaY: number, deltaMode: number, yaw: number, pitch: number): Vec3 {
  const pixels = deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * 400 : deltaY;
  const amount = Math.max(-4, Math.min(4, -pixels / 100)) * MOVE.wheelImpulse;
  const f = forwardFromYawPitch(yaw, pitch);
  return { x: f.x * amount, y: f.y * amount, z: f.z * amount };
}

/** Keep a position above the ground and within MOVE.maxRadius of the origin. Returns which limits applied. */
export function clampPosition(p: Vec3): { position: Vec3; hitY: boolean; hitRadius: boolean } {
  let { x, y, z } = p;
  const hitY = y < MOVE.minY || y > MOVE.maxY;
  y = Math.min(MOVE.maxY, Math.max(MOVE.minY, y));
  const r = Math.hypot(x, z);
  const hitRadius = r > MOVE.maxRadius;
  if (hitRadius) { x *= MOVE.maxRadius / r; z *= MOVE.maxRadius / r; }
  return { position: { x, y, z }, hitY, hitRadius };
}

/** True when a key event is aimed at a text field or the panel, so it must not move the camera. */
export function isTypingTarget(target: { tagName?: string; isContentEditable?: boolean } | null): boolean {
  if (!target) return false;
  const tag = (target.tagName ?? '').toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable === true;
}
