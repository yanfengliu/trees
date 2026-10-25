// App wiring. Owned by the coordinator. Modules plug in through src/contracts.ts.
import { ACESFilmicToneMapping, PCFShadowMap, PerspectiveCamera, Scene, SRGBColorSpace, Timer, Vector2, Vector3, WebGLRenderer } from 'three';
import { DEFAULT_PARAMS, type Foliage, type GeneratedTree, type TreeParams, type WindUniforms } from './contracts';
import { generateTree } from './tree/generateTree';
import { createFoliage } from './foliage/createFoliage';
import { createScene } from './scene/createScene';
import { createUI } from './ui/createUI';
import { createCameraControls } from './ui/cameraControls';
import { paramsFromUrl } from './urlParams';

const renderer = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = SRGBColorSpace;
renderer.toneMapping = ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
// three r186 removed PCFSoftShadowMap (it fell back to this with a warning); PCFShadowMap filters with hardware PCF.
renderer.shadowMap.type = PCFShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new Scene();
const camera = new PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 500);
const controls = createCameraControls(camera, renderer.domElement);

const wind: WindUniforms = {
  uTime: { value: 0 },
  uWindStrength: { value: DEFAULT_PARAMS.wind },
  uWindDirection: { value: new Vector2(1, 0.3).normalize() },
};

const rig = createScene(scene, wind);
let params: TreeParams = paramsFromUrl(window.location.search, DEFAULT_PARAMS);
let tree: GeneratedTree | null = null;
let foliage: Foliage | null = null;

function regenerate(next: TreeParams): void {
  const regrow = !tree || next.seed !== params.seed || next.age !== params.age;
  const releaf = regrow || next.leafDensity !== params.leafDensity;
  params = next;
  wind.uWindStrength.value = params.wind;
  if (regrow) {
    if (tree) { scene.remove(tree.object); tree.dispose(); }
    tree = generateTree(params, wind);
    scene.add(tree.object);
    rig.fitToTree(tree);
  }
  if (releaf && tree) {
    if (foliage) { scene.remove(foliage.object); foliage.dispose(); }
    foliage = createFoliage(tree, params, wind);
    scene.add(foliage.object);
  }
  rig.setTimeOfDay(params.timeOfDay);
}

/** Orbit the camera around the tree: azimuth and elevation in degrees, distance as a multiple of tree height. */
function setCamera(azimuthDeg: number, elevationDeg: number, distance: number): void {
  if (!tree) return;
  const target = new Vector3(0, tree.height * 0.45, 0);
  const r = tree.height * distance;
  const az = (azimuthDeg * Math.PI) / 180;
  const el = (elevationDeg * Math.PI) / 180;
  const position = new Vector3(target.x + r * Math.cos(el) * Math.sin(az), target.y + r * Math.sin(el), target.z + r * Math.cos(el) * Math.cos(az));
  controls.setPose(position, target);
}

regenerate(params);
setCamera(36, 9, 2.5);
createUI(params, regenerate);

const timer = new Timer();
timer.connect(document); // Page Visibility: no huge step after the tab was hidden
let frozenTime: number | null = null;
let paused = false;
function frame(timestamp?: number): void {
  if (paused) return;
  timer.update(timestamp);
  const dt = Math.min(timer.getDelta(), 0.1);
  wind.uTime.value = frozenTime ?? wind.uTime.value + dt;
  rig.update(dt);
  controls.update(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Test hook for scripts/shots.mjs. Not part of the user-facing app.
declare global {
  interface Window { __trees: { setCamera: typeof setCamera; regenerate: typeof regenerate; freezeTime(t: number | null): void; pause(): void; renderOnce(): void; params(): TreeParams; stats(): { leafAnchors: number; height: number; crownRadius: number } } }
}
window.__trees = {
  setCamera,
  regenerate,
  freezeTime(t) { frozenTime = t; },
  // Stop the render loop and draw single frames on demand; software WebGL in headless Chromium is too slow for a live loop.
  pause() { paused = true; },
  renderOnce() { wind.uTime.value = frozenTime ?? wind.uTime.value; rig.update(0); controls.update(0); renderer.render(scene, camera); },
  params: () => params,
  stats: () => ({ leafAnchors: tree?.leafAnchors.length ?? 0, height: tree?.height ?? 0, crownRadius: tree?.crownRadius ?? 0 }),
};
document.body.dataset.ready = 'true';
