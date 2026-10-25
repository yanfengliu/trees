// Petal lighting for blossoms, leaves and petals: thin, pale, translucent surfaces.
// Patches a built-in lit material's fragment shader so that
// - ambient (hemisphere) light, and a little of the key light, is pulled towards its own luminance, so a blue sky or a violet dusk does not turn pink to mauve;
// - light from the key (directional) light shines through the surface when seen against the light (back-lit glow);
// - sun-facing faces can pick up a whitish sheen, for near-white highlights;
// - a little self-glow in the surface's own colour keeps the crown softly readable at night.
// Chains any onBeforeCompile already installed (for example the wind patch), and keeps a stable program cache key.
import { ShaderChunk, type Material } from 'three';

export interface PetalLightOptions {
  /** 0..1: how far ambient light is pulled towards neutral grey of the same luminance (default 0.6). */
  neutralAmbient?: number;
  /** Multiplier on ambient light: stands in for light scattered through and between petals inside the crown (default 1). */
  ambientBoost?: number;
  /** 0..1: the same for the key light, so an orange sunset tints the blossom peach rather than salmon (default 0.3). */
  neutralDirect?: number;
  /** Strength of light transmitted from the key light (default 0.9). */
  translucency?: number;
  /** Sun-facing faces pick up this much white on top of their colour: near-white highlights (default 0). */
  sheen?: number;
  /** Self-glow in the surface colour, linear units (default 0.05). */
  glow?: number;
}

const VERSION = 'petal-light-v1';

const DIR_INFO = 'getDirectionalLightInfo( directionalLight, directLight );';
if (!ShaderChunk.lights_fragment_begin.includes(DIR_INFO)) throw new Error(`petalLight: three's lights_fragment_begin chunk no longer contains "${DIR_INFO}"; update the patch for this three version`);
const LIGHTS_BEGIN = ShaderChunk.lights_fragment_begin.replace(
  DIR_INFO,
  `${DIR_INFO}\n\t\tdirectLight.color = mix( directLight.color, vec3( dot( directLight.color, vec3( 0.2126, 0.7152, 0.0722 ) ) ), uPetalNeutralDirect );\n\t\tpetalKey = directLight.color;`,
);

const LIGHT_CHUNK = /* glsl */ `
vec3 petalKey = vec3( 0.0 ); // key light before shadowing: petals pass light on even when another bunch shades them
${LIGHTS_BEGIN}
{
  float irrLuma = dot( irradiance, vec3( 0.2126, 0.7152, 0.0722 ) );
  irradiance = mix( irradiance, vec3( irrLuma ), uPetalNeutral ) * uPetalAmbient;
  #if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
    // directLight still holds the (shadowed) directional key light from the loop above.
    vec3 Lt = directLight.direction;
    float against = saturate( dot( -geometryViewDir, Lt ) );
    float through = saturate( -dot( geometryNormal, Lt ) );
    float trans = uPetalTranslucency * ( 0.5 * against * against + 0.5 * through * ( 0.3 + 0.7 * against ) );
    float facing = saturate( dot( geometryNormal, Lt ) );
    reflectedLight.directDiffuse += directLight.color * ( vec3( 1.0 ) - diffuseColor.rgb ) * facing * uPetalSheen * RECIPROCAL_PI;
    reflectedLight.directDiffuse += mix( petalKey, directLight.color, 0.4 ) * diffuseColor.rgb * trans * RECIPROCAL_PI;
  #endif
}
`;

export function isPetalLit(material: Material): boolean {
  return material.userData.petalLight === VERSION;
}

export function applyPetalLight<M extends Material>(material: M, options: PetalLightOptions = {}): M {
  if (isPetalLit(material)) return material;
  const uniforms = {
    uPetalNeutral: { value: options.neutralAmbient ?? 0.6 },
    uPetalAmbient: { value: options.ambientBoost ?? 1 },
    uPetalNeutralDirect: { value: options.neutralDirect ?? 0.3 },
    uPetalTranslucency: { value: options.translucency ?? 0.9 },
    uPetalGlow: { value: options.glow ?? 0.05 },
    uPetalSheen: { value: options.sheen ?? 0 },
  };
  const previous = material.onBeforeCompile.bind(material);
  const previousKey = material.customProgramCacheKey.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    previous(shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uPetalNeutral;\nuniform float uPetalAmbient;\nuniform float uPetalNeutralDirect;\nuniform float uPetalTranslucency;\nuniform float uPetalGlow;\nuniform float uPetalSheen;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * uPetalGlow;')
      .replace('#include <lights_fragment_begin>', LIGHT_CHUNK);
  };
  material.customProgramCacheKey = () => `${previousKey()}|${VERSION}`;
  material.userData.petalLight = VERSION;
  material.userData.petalUniforms = uniforms;
  material.needsUpdate = true;
  return material;
}
