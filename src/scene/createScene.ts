// Sky, light, ground and grass. Owned by the scene worker.
import { AmbientLight, Color, DirectionalLight, Mesh, MeshStandardMaterial, PlaneGeometry, type Scene } from 'three';
import type { GeneratedTree, SceneRig, WindUniforms } from '../contracts';

/** STUB: flat ground and one light. Adds its objects to `scene`. */
export function createScene(scene: Scene, _wind: WindUniforms): SceneRig {
  scene.background = new Color(0xc9d8e8);
  scene.add(new AmbientLight(0xffffff, 0.6));
  const sun = new DirectionalLight(0xfff2dd, 2);
  sun.position.set(10, 20, 8);
  sun.castShadow = true;
  scene.add(sun);
  const ground = new Mesh(new PlaneGeometry(60, 60), new MeshStandardMaterial({ color: 0x6b8f4a }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  return {
    update(_dt: number) {},
    fitToTree(_tree: GeneratedTree) {},
    setTimeOfDay(_hours: number) {},
  };
}
