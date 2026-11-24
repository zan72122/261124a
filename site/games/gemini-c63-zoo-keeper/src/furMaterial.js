import * as THREE from 'three';

// Per-animal spatial simulation state (128x128 continuous grid: R=foam, G=wetness, B=gloss, A=mud)
export class AnimalCareState {
  constructor({ initialMud = 0.45, initialGloss = 0.15, seed = 1 } = {}) {
    this.size = 128;
    this.data = new Uint8Array(this.size * this.size * 4);
    this.soapTintMix = new THREE.Color(0xfcfdff);
    this.totalScrubTime = 0;
    this.totalHoseTime = 0;
    this.totalBrushStrokes = 0;
    this.brushDirX = 1.0;
    this.brushDirY = 0.0;
    this.fedCount = 0;
    this.fedTypes = new Set();

    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        const i = (y * this.size + x) * 4;
        const n = Math.sin(x * 0.19 + seed) * Math.cos(y * 0.23 - seed * 0.7) * 0.5 + 0.5;
        const mudPatch = Math.max(0, Math.min(1, (n - 0.32) * 1.65)) * initialMud;
        this.data[i] = 0; // foam
        this.data[i + 1] = 0; // wetness
        this.data[i + 2] = Math.round(initialGloss * 255); // gloss / groomed
        this.data[i + 3] = Math.round(mudPatch * 255); // mud / scruff
      }
    }

    this.texture = new THREE.DataTexture(this.data, this.size, this.size, THREE.RGBAFormat);
    this.texture.wrapS = THREE.ClampToEdgeWrapping;
    this.texture.wrapT = THREE.RepeatWrapping;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.needsUpdate = true;
  }

  paintUV(u, v, {
    radius = 0.11,
    foamDelta = 0,
    wetDelta = 0,
    glossDelta = 0,
    mudDelta = 0,
    rinseFoam = 0,
    soapColor = null
  }) {
    if (soapColor && foamDelta > 0) {
      this.soapTintMix.lerp(soapColor, 0.08);
    }
    const s = this.size;
    const cx = Math.max(0, Math.min(1, u)) * s;
    const cy = ((v % 1) + 1) % 1 * s;
    const rPx = Math.max(2, radius * s);
    const r2 = rPx * rPx;

    const minX = Math.max(0, Math.floor(cx - rPx));
    const maxX = Math.min(s - 1, Math.ceil(cx + rPx));
    const minY = Math.floor(cy - rPx);
    const maxY = Math.ceil(cy + rPx);

    for (let yy = minY; yy <= maxY; yy++) {
      const y = ((yy % s) + s) % s;
      const dy = yy - cy;
      for (let x = minX; x <= maxX; x++) {
        const dx = x - cx;
        const d2 = dx * dx + dy * dy;
        if (d2 > r2) continue;
        const falloff = Math.pow(1 - d2 / r2, 1.35);
        const idx = (y * s + x) * 4;

        let foam = this.data[idx] / 255;
        let wet = this.data[idx + 1] / 255;
        let gloss = this.data[idx + 2] / 255;
        let mud = this.data[idx + 3] / 255;

        if (foamDelta !== 0) {
          foam = Math.max(0, Math.min(1, foam + foamDelta * falloff));
          mud = Math.max(0, mud - Math.abs(foamDelta) * 0.42 * falloff);
        }
        if (wetDelta !== 0) {
          wet = Math.max(0, Math.min(1, wet + wetDelta * falloff));
        }
        if (rinseFoam > 0) {
          const hadFoam = foam;
          foam = Math.max(0, foam - rinseFoam * falloff);
          mud = Math.max(0, mud - (rinseFoam * 0.55 + hadFoam * 0.45) * falloff);
          if (hadFoam > 0.08) {
            gloss = Math.min(1, gloss + hadFoam * 0.35 * falloff);
          }
        }
        if (glossDelta !== 0) {
          gloss = Math.max(0, Math.min(1, gloss + glossDelta * falloff));
          mud = Math.max(0, mud - glossDelta * 0.7 * falloff);
          wet = Math.max(0, wet - glossDelta * 0.25 * falloff);
        }
        if (mudDelta !== 0) {
          mud = Math.max(0, Math.min(1, mud + mudDelta * falloff));
        }

        this.data[idx] = Math.round(foam * 255);
        this.data[idx + 1] = Math.round(wet * 255);
        this.data[idx + 2] = Math.round(gloss * 255);
        this.data[idx + 3] = Math.round(mud * 255);
      }
    }
    this.texture.needsUpdate = true;
  }

  paintGlobalSplash(wetBoost = 0.35, rinse = 0.2) {
    const len = this.size * this.size * 4;
    for (let i = 0; i < len; i += 4) {
      this.data[i] = Math.max(0, Math.round(this.data[i] * (1 - rinse)));
      this.data[i + 1] = Math.min(255, Math.round(this.data[i + 1] + wetBoost * 255));
      this.data[i + 3] = Math.max(0, Math.round(this.data[i + 3] * 0.85));
    }
    this.texture.needsUpdate = true;
  }

  evaporateSlowly(dt) {
    // Gentle drying over time so wet clumping transitions naturally when left or brushed
    if (Math.random() > 0.25) return;
    const step = Math.max(1, Math.round(dt * 6));
    const len = this.size * this.size * 4;
    let changed = false;
    for (let i = 0; i < len; i += 16) {
      if (this.data[i + 1] > 10 && this.data[i] < 30) {
        this.data[i + 1] = Math.max(0, this.data[i + 1] - step);
        changed = true;
      }
    }
    if (changed) this.texture.needsUpdate = true;
  }

  getSummary() {
    let foamSum = 0, wetSum = 0, glossSum = 0, mudSum = 0;
    const total = (this.size * this.size) / 4;
    for (let i = 0; i < this.data.length; i += 16) {
      foamSum += this.data[i];
      wetSum += this.data[i + 1];
      glossSum += this.data[i + 2];
      mudSum += this.data[i + 3];
    }
    const denom = total * 255;
    return {
      foam: foamSum / denom,
      wetness: wetSum / denom,
      gloss: glossSum / denom,
      mud: mudSum / denom
    };
  }
}

// Photorealistic Multi-Shell Fur Material with Wet Clumping ("濡れて束になる変化") & Anisotropic Brushed Sheen
export function createFurMaterial({
  map,
  strandMap,
  bubbleMap,
  careState,
  shellLayer = 0, // 0 = base skin, (0..1] = outer hair shells
  furLength = 0.038,
  furRepeat = new THREE.Vector2(9, 7),
  roughness = 0.78,
  sheenTint = new THREE.Color(0xfff3de)
}) {
  const isShell = shellLayer > 0.001;
  const mat = new THREE.MeshStandardMaterial({
    map,
    roughness,
    metalness: 0.0,
    transparent: isShell,
    alphaTest: isShell ? 0.08 : 0.0,
    depthWrite: true,
    side: THREE.FrontSide
  });

  const uniforms = {
    uStrandMap: { value: strandMap },
    uBubbleMap: { value: bubbleMap },
    uCareMap: { value: careState.texture },
    uShellLayer: { value: shellLayer },
    uFurLength: { value: furLength },
    uFurRepeat: { value: furRepeat },
    uSoapTint: { value: careState.soapTintMix },
    uSheenTint: { value: sheenTint },
    uBrushFlow: { value: new THREE.Vector2(1, 0) },
    uTime: { value: 0 }
  };
  mat.userData.furUniforms = uniforms;

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform sampler2D uCareMap;
        uniform float uShellLayer;
        uniform float uFurLength;
        uniform vec2 uBrushFlow;
        uniform float uTime;
        varying vec2 vFurUv;
        varying vec3 vFurViewDir;
        varying vec3 vFurWorldNorm;
        `
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vFurUv = uv;
        vec4 careV = texture2D(uCareMap, uv);
        float vFoam = careV.r;
        float vWet = careV.g;
        float vGloss = careV.b;
        float vMud = careV.a;

        if (uShellLayer > 0.0) {
          // Taper fur shorter near nose/eyes (uv.x < 0.13) so eyes & nostrils are never buried!
          float faceTaper = smoothstep(0.03, 0.16, uv.x);
          float loft = uFurLength * (0.28 + 0.72 * faceTaper) * uShellLayer * (0.90 + vGloss * 0.38 - vWet * 0.26 - vFoam * 0.30 - vMud * 0.16);
          transformed += objectNormal * loft;

          // Natural scruff when unbrushed vs smooth aligned comb direction when brushed
          float scruffWave = sin(uv.x * 62.0 + uv.y * 49.0) * (1.0 - vGloss) * 0.010 * uShellLayer * faceTaper;
          float breeze = sin(uTime * 1.9 + uv.x * 11.0 + uv.y * 7.0) * 0.0024 * uShellLayer * (1.0 - vWet * 0.7);
          transformed.x += (uBrushFlow.x * (0.007 + vGloss * 0.010) + scruffWave + breeze) * uShellLayer;
          transformed.z += (uBrushFlow.y * 0.006 - scruffWave * 0.7) * uShellLayer;
          // Wet gravity bundle droop!
          transformed.y -= (vWet * 0.030 + vMud * 0.010) * uShellLayer * uShellLayer;
        }
        vec4 wp = modelMatrix * vec4(transformed, 1.0);
        vFurViewDir = normalize(cameraPosition - wp.xyz);
        vFurWorldNorm = normalize(mat3(modelMatrix) * objectNormal);
        `
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform sampler2D uStrandMap;
        uniform sampler2D uBubbleMap;
        uniform sampler2D uCareMap;
        uniform float uShellLayer;
        uniform vec2 uFurRepeat;
        uniform vec3 uSoapTint;
        uniform vec3 uSheenTint;
        varying vec2 vFurUv;
        varying vec3 vFurViewDir;
        varying vec3 vFurWorldNorm;
        `
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        vec4 careF = texture2D(uCareMap, vFurUv);
        float fFoam = careF.r;
        float fWet = careF.g;
        float fGloss = careF.b;
        float fMud = careF.a;

        // Sample Voronoi clump field first so wet hair pulls into realistic spiky bundles!
        vec2 baseStrandUv = vFurUv * uFurRepeat;
        vec4 clumpSample = texture2D(uStrandMap, baseStrandUv);
        vec2 toClump = (clumpSample.gb - 0.5) * 2.0;

        // Wetness pulls outer shell UVs toward clump centers ("毛並みが濡れて束になる変化")
        float clumpStrength = clamp(fWet * 1.25 + fMud * 0.45, 0.0, 1.0);
        vec2 bundledUv = baseStrandUv - toClump * clumpStrength * (0.20 + uShellLayer * 0.34);
        vec4 strand = texture2D(uStrandMap, bundledUv);
        float fiberHeight = strand.r;
        float clumpCore = clamp(1.0 - length(toClump) * 1.28, 0.0, 1.0);
        float clumpRidge = pow(clumpCore, 0.65);

        // Crisp spiky wet bundles with parted valleys exposing damp dark undercoat!
        float effectiveHeight = mix(fiberHeight, clumpRidge * (0.65 + fiberHeight * 0.55), clumpStrength * 0.88);
        // Brushing makes dense fluffy uniform pelage
        effectiveHeight = mix(effectiveHeight, min(1.0, fiberHeight * 1.22 + 0.14), fGloss * 0.62);

        if (uShellLayer > 0.0) {
          float cutoff = uShellLayer * (0.84 - fFoam * 0.28);
          if (effectiveHeight < cutoff && fFoam < 0.50) {
            discard;
          }
          diffuseColor.a = clamp((effectiveHeight - cutoff) * 7.0 + fFoam * 0.95, 0.0, 1.0);
        }

        // Crisp tactile strand contrast + root-to-tip fur self-shadowing AO
        float strandTone = 0.70 + strand.a * 0.58 + (fiberHeight - 0.5) * 0.26;
        float furAO = mix(0.54 - clumpStrength * 0.18, 1.12 + fGloss * 0.10, uShellLayer);
        diffuseColor.rgb *= strandTone * furAO;

        // Earthy zoo mud patches (washable & brushable!)
        vec3 mudColor = vec3(0.25, 0.19, 0.13);
        diffuseColor.rgb = mix(diffuseColor.rgb, mudColor, fMud * 0.72);

        // Wet fur physically darkens internal scattering & carves crisp dark valleys between wet bundles!
        float wetDarken = mix(1.0, 0.42 + clumpRidge * 0.34, fWet);
        diffuseColor.rgb *= wetDarken;

        // Creamy snow-bright micro-bubble surface lather where scrubbed
        float bubbleCell = texture2D(uBubbleMap, vFurUv * 14.0).r;
        float foamCoat = smoothstep(0.05, 0.48, fFoam * (0.82 + bubbleCell * 0.48));
        vec3 foamAlbedo = uSoapTint * (0.96 + bubbleCell * 0.12);
        diffuseColor.rgb = mix(diffuseColor.rgb, foamAlbedo, foamCoat * 0.95);
        `
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        // Dry fur is soft matte; wet fur & foam become glistening; brushed fur gains silky sheen
        roughnessFactor = mix(roughnessFactor, 0.17, clamp(careF.g * 0.88, 0.0, 1.0));
        roughnessFactor = mix(roughnessFactor, 0.32, clamp(careF.b * 0.65, 0.0, 1.0));
        roughnessFactor = mix(roughnessFactor, 0.24, clamp(careF.r * 0.85, 0.0, 1.0));
        `
      )
      .replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
        // Velvety grazing-angle fur rim sheen + anisotropic brushed silk highlight + wet specular glint!
        vec3 N = normalize(vFurWorldNorm);
        vec3 V = normalize(vFurViewDir);
        vec3 H = normalize(V + normalize(vec3(0.35, 0.85, 0.45)));
        float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 2.6);
        float aniso = pow(clamp(dot(N, H), 0.0, 1.0), mix(18.0, 42.0, careF.b));
        float sheenAmt = (0.20 + careF.b * 0.62 + careF.g * 0.38) * (0.45 + uShellLayer * 0.65);
        gl_FragColor.rgb += uSheenTint * (fres * sheenAmt * 0.48 + aniso * careF.b * 0.24 + aniso * careF.g * 0.28);
        `
      );
  };

  return mat;
}

// Helper to build a multi-shell furry mesh group sharing one geometry (low memory, rich tactile depth)
export function createMultiShellFurGroup(geometry, materialOptions, shellCount = 6) {
  const group = new THREE.Group();
  const materials = [];
  for (let i = 0; i <= shellCount; i++) {
    const layer = i === 0 ? 0 : i / shellCount;
    const mat = createFurMaterial({
      ...materialOptions,
      shellLayer: layer
    });
    materials.push(mat);
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.castShadow = i === 0;
    mesh.receiveShadow = i === 0;
    mesh.renderOrder = i;
    if (i === 0) {
      mesh.userData.isAnimalHitSurface = true;
    } else {
      // Raycast only hits base skin mesh (layer 0) for instant performance!
      mesh.raycast = () => {};
    }
    group.add(mesh);
  }
  group.userData.furMaterials = materials;
  return group;
}

// Realistic Wrinkled Elephant Dermis Shader (Dusty Dry -> Deep Wet Slate-Charcoal + Crease Lather)
export function createElephantMaterial({ map, bumpMap, bubbleMap, careState }) {
  const mat = new THREE.MeshStandardMaterial({
    map,
    bumpMap,
    bumpScale: 0.028,
    roughness: 0.84,
    metalness: 0.02
  });

  const uniforms = {
    uCareMap: { value: careState.texture },
    uBubbleMap: { value: bubbleMap },
    uSoapTint: { value: careState.soapTintMix }
  };
  mat.userData.elephantUniforms = uniforms;

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec2 vEleUv;
        `
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vEleUv = uv;
        `
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform sampler2D uCareMap;
        uniform sampler2D uBubbleMap;
        uniform vec3 uSoapTint;
        varying vec2 vEleUv;
        `
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        vec4 careE = texture2D(uCareMap, vEleUv);
        float eFoam = careE.r;
        float eWet = careE.g;
        float eClean = careE.b;
        float eMud = careE.a;

        // Dry dusty ochre-grey mud -> washed clean slate -> deep glossy wet charcoal-slate when hosed!
        vec3 dustyMud = vec3(0.42, 0.35, 0.27);
        diffuseColor.rgb = mix(diffuseColor.rgb, dustyMud, eMud * 0.62);
        diffuseColor.rgb *= mix(1.0, 0.42, eWet);
        diffuseColor.rgb *= (1.0 + eClean * 0.08);

        // Crisp cellular micro-bubbles (no chalky airbrush circles!)
        float bub = texture2D(uBubbleMap, vEleUv * 18.0).r;
        float bub2 = texture2D(uBubbleMap, vEleUv * 7.0 + vec2(0.37, 0.19)).r;
        float lather = smoothstep(0.32, 0.72, eFoam * (0.55 + bub * 0.55 + bub2 * 0.35));
        diffuseColor.rgb = mix(diffuseColor.rgb, uSoapTint * (0.94 + bub * 0.10), lather * 0.94);
        `
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        vec4 careER = texture2D(uCareMap, vEleUv);
        roughnessFactor = mix(roughnessFactor, 0.14, clamp(careER.g * 0.92, 0.0, 1.0));
        roughnessFactor = mix(roughnessFactor, 0.25, clamp(careER.r * 0.8, 0.0, 1.0));
        `
      );
  };

  return mat;
}
