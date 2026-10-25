// Sky, light, ground and grass. Owned by the scene worker.
import { Color, DirectionalLight, Fog, HemisphereLight, Sphere, Vector3, type OrthographicCamera, type Scene } from 'three';
import type { GeneratedTree, SceneRig, WindUniforms } from '../contracts';
import { createMeadow } from './meadow';
import { createSky } from './sky';
import { createTerrain, heightAt } from './terrain';
import { sampleSky, sunDirection, type SkyState } from './timeOfDay';
import { smoothstep } from './noise';

export { heightAt } from './terrain';

const WHITE = new Color(1, 1, 1);

/** The scene rig plus read-only handles used by tests and other modules. */
export interface SceneWorld extends SceneRig {
  sun: DirectionalLight;
  hemi: HemisphereLight;
  /** Unit vector towards the sun for the current time of day (may point below the horizon). */
  sunDirection: Vector3;
  heightAt(x: number, z: number): number;
}

/** Adds terrain, meadow, sky and lights to `scene` and returns the controls for them. */
export function createScene(scene: Scene, wind: WindUniforms): SceneWorld {
  const terrain = createTerrain();
  const meadow = createMeadow(wind);
  const sky = createSky();
  scene.add(terrain, meadow.grass, meadow.flowers, meadow.petals, meadow.rocks, sky.object);

  const fog = new Fog(0xffffff, 30, 380);
  scene.fog = fog;
  scene.background = new Color(0x000000);

  const hemi = new HemisphereLight(0xffffff, 0x445533, 1);
  scene.add(hemi);

  const sun = new DirectionalLight(0xffffff, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  const shadowCam = sun.shadow.camera as OrthographicCamera;
  const fitCenter = new Vector3(0, 4, 0);
  let fitRadius = 8;
  const toSun = new Vector3();
  const toMoon = new Vector3();
  const lightDir = new Vector3();
  const state: SkyState = sampleSky(17.5);

  function placeLight(): void {
    const dist = fitRadius + 40;
    sun.target.position.copy(fitCenter);
    sun.position.copy(fitCenter).addScaledVector(lightDir, dist);
    shadowCam.left = -fitRadius;
    shadowCam.right = fitRadius;
    shadowCam.top = fitRadius;
    shadowCam.bottom = -fitRadius;
    shadowCam.near = Math.max(0.5, dist - fitRadius - 2);
    // Low sun throws long shadows, so the far plane reaches well past the tree.
    shadowCam.far = dist + fitRadius + 160;
    shadowCam.updateProjectionMatrix();
    sun.target.updateMatrixWorld();
    sun.updateMatrixWorld();
  }

  function setTimeOfDay(hours: number): void {
    sampleSky(hours, state);
    sunDirection(hours, toSun);
    toMoon.copy(toSun).multiplyScalar(-1);
    toMoon.y = Math.abs(toMoon.y) * 0.85 + 0.05;
    toMoon.normalize();
    const sunUp = toSun.y > -0.02;
    lightDir.copy(sunUp ? toSun : toMoon);
    // Fade the key light out as its body nears the horizon so the sun-to-moon switch never pops.
    const bodyFade = sunUp ? smoothstep(-0.02, 0.09, toSun.y) : smoothstep(0.02, 0.15, toMoon.y) * smoothstep(-0.02, -0.12, toSun.y);
    sun.color.copy(state.light);
    sun.intensity = state.lightIntensity * bodyFade;
    hemi.color.copy(state.hemiSky);
    hemi.groundColor.copy(state.hemiGround);
    hemi.intensity = state.hemiIntensity;
    fog.color.copy(state.horizon);
    (scene.background as Color).copy(state.horizon);

    const u = sky.uniforms;
    u.uZenith.value.copy(state.zenith);
    u.uHorizon.value.copy(state.horizon);
    u.uGlow.value.copy(state.glow);
    u.uGlowStrength.value = state.glowStrength;
    u.uSunDir.value.copy(toSun);
    u.uSunColor.value.copy(state.light).lerp(WHITE, 0.2).multiplyScalar(3.5);
    u.uSunVis.value = smoothstep(-0.04, 0.0, toSun.y);
    u.uMoonDir.value.copy(toMoon);
    u.uMoonVis.value = smoothstep(-0.03, -0.12, toSun.y);
    sky.starUniforms.uOpacity.value = state.stars;
    sky.cloudMaterial.color.copy(state.light).lerp(WHITE, 0.6).multiplyScalar(0.55);
    sky.cloudMaterial.emissive.copy(state.cloud).multiplyScalar(0.55);
    placeLight();
  }

  setTimeOfDay(17.5);

  return {
    sun,
    hemi,
    sunDirection: toSun,
    heightAt,
    update(dt) {
      sky.update(dt);
    },
    fitToTree(tree: GeneratedTree) {
      const sphere = tree.bounds.getBoundingSphere(new Sphere());
      fitCenter.copy(sphere.center);
      // Margin for wind sway and blossom clusters hanging past the bark bounds.
      fitRadius = Math.max(sphere.radius, tree.crownRadius) * 1.15 + 0.6;
      meadow.scatterPetals(tree.crownRadius);
      placeLight();
    },
    setTimeOfDay,
  };
}
