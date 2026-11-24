import * as THREE from 'three';

// Shared studio 1-light rim direction (from behind-above-right toward camera)
export const RIM_LIGHT_DIR = new THREE.Vector3(0.32, 0.52, -0.79).normalize();

export function createCrystalGlassMaterial(condensationTex, opts = {}) {
  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xffffff),
    transmission: opts.transmission ?? 0.96,
    ior: opts.ior ?? 1.51,
    thickness: opts.thickness ?? 0.075,
    roughness: opts.roughness ?? 0.018,
    metalness: 0.0,
    attenuationColor: new THREE.Color(opts.attenuationColor ?? 0xf6fbff),
    attenuationDistance: opts.attenuationDistance ?? 4.5,
    clearcoat: 1.0,
    clearcoatRoughness: 0.012,
    specularIntensity: 1.0,
    specularColor: new THREE.Color(0xffffff),
    envMapIntensity: opts.envMapIntensity ?? 3.1,
    bumpMap: condensationTex || null,
    bumpScale: opts.bumpScale ?? 0.0014,
    side: THREE.FrontSide,
  });
  return mat;
}

// Injects realistic Subsurface Scattering (wrap diffuse + backlit rim translucency) into MeshPhysicalMaterial
export function applySubsurfaceScattering(material, sssHex, strength = 0.85, power = 2.2) {
  const sssColor = new THREE.Color(sssHex);
  material.userData.sss = {
    uSssColor: { value: sssColor },
    uSssStrength: { value: strength },
    uSssPower: { value: power },
    uRimDir: { value: RIM_LIGHT_DIR.clone() },
  };

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSssColor = material.userData.sss.uSssColor;
    shader.uniforms.uSssStrength = material.userData.sss.uSssStrength;
    shader.uniforms.uSssPower = material.userData.sss.uSssPower;
    shader.uniforms.uRimDir = material.userData.sss.uRimDir;

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
      uniform vec3 uSssColor;
      uniform float uSssStrength;
      uniform float uSssPower;
      uniform vec3 uRimDir;`
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      `
      vec3 sssViewDir = normalize(vViewPosition);
      vec3 sssRimView = normalize((viewMatrix * vec4(uRimDir, 0.0)).xyz);
      // Forward scatter when looking toward the studio backlight through translucent fruit/skin
      float backTransmit = pow(clamp(dot(sssViewDir, sssRimView) * 0.5 + 0.5, 0.0, 1.0), uSssPower);
      float grazing = pow(1.0 - abs(dot(normal, sssViewDir)), 1.8);
      float wrapN = clamp(dot(normal, sssRimView) * 0.5 + 0.5, 0.0, 1.0);
      vec3 sssGlow = uSssColor * uSssStrength * (backTransmit * 0.65 + grazing * 0.55 + wrapN * 0.28);
      outgoingLight += sssGlow * diffuseColor.rgb * 0.85 + sssGlow * 0.28;
      #include <opaque_fragment>
      `
    );
  };
  material.customProgramCacheKey = () => `sss_${sssHex}_${strength.toFixed(2)}`;
  return material;
}

// Multi-layer photorealistic beverage shader with Beer-Lambert optical depth, backlit translucency,
// continuous interface marbling, pulp/seeds, effervescent bubbles, honey swirl, and aerated foam crown.
export const MAX_LIQUID_LAYERS = 8;

export function createLayeredLiquidMaterial(profileFnDesc = 'parfait') {
  const layerColors = [];
  const layerTops = new Float32Array(MAX_LIQUID_LAYERS);
  const layerBlurs = new Float32Array(MAX_LIQUID_LAYERS);
  const layerPulps = new Float32Array(MAX_LIQUID_LAYERS);
  for (let i = 0; i < MAX_LIQUID_LAYERS; i++) {
    layerColors.push(new THREE.Color(0xd91b38));
    layerTops[i] = (i + 1) * 0.2;
    layerBlurs[i] = 0.015;
    layerPulps[i] = 0.2;
  }

  // Profile curves matching inner glass walls:
  // mode 0 = tall curvy parfait/hurricane glass, mode 1 = mini pouring carafe, mode 2 = party tumbler/goblet, mode 3 = blender jar
  const modeMap = { parfait: 0, carafe: 1, party: 2, blender: 3 };
  const profileMode = modeMap[profileFnDesc] ?? 0;

  const uniforms = {
    uTime: { value: 0 },
    uFillLevel: { value: 0.0 },
    uProfileMode: { value: profileMode },
    uRadiusScale: { value: 1.0 },
    uHeightScale: { value: 1.0 },
    uLayerCount: { value: 1 },
    uLayerColors: { value: layerColors },
    uLayerTops: { value: layerTops },
    uLayerBlurs: { value: layerBlurs },
    uLayerPulps: { value: layerPulps },
    uFoamHeight: { value: 0.04 },
    uBubbleRate: { value: 0.35 },
    uSlosh: { value: new THREE.Vector2(0, 0) },
    uVortex: { value: 0.0 },
    uSourRipple: { value: 0.0 },
    uSweetSwirl: { value: 0.0 },
    uSweetColor: { value: new THREE.Color(0xffb829) },
    uRimDir: { value: RIM_LIGHT_DIR.clone() },
  };

  const vertexShader = /* glsl */ `
    uniform float uTime;
    uniform float uFillLevel;
    uniform int uProfileMode;
    uniform float uRadiusScale;
    uniform float uHeightScale;
    uniform vec2 uSlosh;
    uniform float uVortex;

    attribute float aIsCap;

    varying vec2 vUv;
    varying float vGlassH;
    varying float vLocalNormY;
    varying float vIsCap;
    varying vec3 vWorldPos;
    varying vec3 vViewPos;
    varying vec3 vNormalView;
    varying vec3 vObjDir;

    float getInnerRadius(float h) {
      // h in [0..1] along interior cavity of glass
      if (uProfileMode == 0) {
        // Tall sculpted tulip/parfait crystal glass
        float waist = -0.055 * sin(h * 3.14159 * 1.15);
        float flare = 0.245 + 0.095 * smoothstep(0.0, 1.0, h) + waist + 0.045 * pow(h, 2.2);
        float bottomRound = smoothstep(0.0, 0.08, h) * 0.32 + 0.68;
        return flare * bottomRound * uRadiusScale;
      } else if (uProfileMode == 1) {
        // Mini crystal carafe (wider belly, slight neck, flared lip)
        float belly = 0.21 + 0.055 * sin(h * 3.14159 * 0.95) - 0.03 * smoothstep(0.55, 0.85, h) + 0.035 * smoothstep(0.85, 1.0, h);
        return belly * (0.78 + 0.22 * smoothstep(0.0, 0.07, h)) * uRadiusScale;
      } else if (uProfileMode == 2) {
        // Party crystal tumbler
        return (0.21 + 0.065 * h) * (0.82 + 0.18 * smoothstep(0.0, 0.06, h)) * uRadiusScale;
      } else {
        // Blender glass jar (tapered octagonal/round heavy jar)
        return (0.25 + 0.085 * h) * uRadiusScale;
      }
    }

    void main() {
      vUv = uv;
      vIsCap = aIsCap;

      float fill = clamp(uFillLevel, 0.0001, 1.04);
      // position.y of base cylinder is [0..1], radius of unit cylinder is [0..1]
      float normY = clamp(position.y, 0.0, 1.0);
      float glassH = normY * fill;
      float rTarget = getInnerRadius(clamp(glassH, 0.0, 1.0));

      vec2 radial = position.xz;
      float radialLen = length(radial);
      vec2 radialDir = radialLen > 0.0001 ? radial / radialLen : vec2(1.0, 0.0);

      vec3 pos;
      // Pull in by 0.975 so inner glass wall surrounds liquid cleanly with zero z-fighting
      pos.xz = radial * rTarget * 0.975;
      pos.y = glassH * uHeightScale;

      // Surface tension meniscus & slosh & blender vortex on upper liquid!
      float sloshOffset = (pos.x * uSlosh.x + pos.z * uSlosh.y) * smoothstep(0.05, 1.0, normY);
      pos.y += sloshOffset;

      if (normY > 0.96) {
        // Concave capillary meniscus climbing inner glass wall slightly
        float edgeR = clamp(radialLen, 0.0, 1.0);
        float meniscus = 0.014 * pow(edgeR, 3.0) * smoothstep(0.02, 0.12, fill);
        // Vortex dip when blending!
        float vortexDip = -uVortex * 0.16 * (1.0 - edgeR * edgeR);
        float vortexWave = uVortex * 0.022 * sin(atan(pos.z, pos.x) * 4.0 - uTime * 16.0) * edgeR;
        pos.y += meniscus + vortexDip + vortexWave;
      }

      vGlassH = clamp(glassH, 0.0, 1.05);
      vLocalNormY = normY;
      vObjDir = vec3(radialDir.x, 0.0, radialDir.y);

      // Recompute smooth analytical normal
      vec3 calcN = normal;
      if (aIsCap > 0.5) {
        if (normY > 0.5) {
          calcN = normalize(vec3(-uSlosh.x * 1.4 - radialDir.x * uVortex * 0.45, 1.0, -uSlosh.y * 1.4 - radialDir.y * uVortex * 0.45));
        } else {
          calcN = vec3(0.0, -1.0, 0.0);
        }
      } else {
        float dh = 0.02;
        float dr = (getInnerRadius(clamp(glassH + dh, 0.0, 1.0)) - getInnerRadius(clamp(glassH - dh, 0.0, 1.0))) / (2.0 * dh * uHeightScale);
        calcN = normalize(vec3(radialDir.x, -dr, radialDir.y));
      }

      vec4 worldPosition = modelMatrix * vec4(pos, 1.0);
      vWorldPos = worldPosition.xyz;
      vec4 mvPosition = viewMatrix * worldPosition;
      vViewPos = -mvPosition.xyz;
      vNormalView = normalize(normalMatrix * calcN);

      gl_Position = projectionMatrix * mvPosition;
    }
  `;

  const fragmentShader = /* glsl */ `
    precision highp float;

    uniform float uTime;
    uniform float uFillLevel;
    uniform int uLayerCount;
    uniform vec3 uLayerColors[${MAX_LIQUID_LAYERS}];
    uniform float uLayerTops[${MAX_LIQUID_LAYERS}];
    uniform float uLayerBlurs[${MAX_LIQUID_LAYERS}];
    uniform float uLayerPulps[${MAX_LIQUID_LAYERS}];
    uniform float uFoamHeight;
    uniform float uBubbleRate;
    uniform float uVortex;
    uniform float uSourRipple;
    uniform float uSweetSwirl;
    uniform vec3 uSweetColor;
    uniform vec3 uRimDir;

    varying vec2 vUv;
    varying float vGlassH;
    varying float vLocalNormY;
    varying float vIsCap;
    varying vec3 vWorldPos;
    varying vec3 vViewPos;
    varying vec3 vNormalView;
    varying vec3 vObjDir;

    float hash31(vec3 p) {
      p = fract(p * 0.1031);
      p += dot(p, p.yzx + 33.33);
      return fract((p.x + p.y) * p.z);
    }

    float noise3(vec3 p) {
      vec3 i = floor(p);
      vec3 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      float n000 = hash31(i + vec3(0,0,0));
      float n100 = hash31(i + vec3(1,0,0));
      float n010 = hash31(i + vec3(0,1,0));
      float n110 = hash31(i + vec3(1,1,0));
      float n001 = hash31(i + vec3(0,0,1));
      float n101 = hash31(i + vec3(1,0,1));
      float n011 = hash31(i + vec3(0,1,1));
      float n111 = hash31(i + vec3(1,1,1));
      return mix(
        mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
        mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y),
        f.z
      );
    }

    void main() {
      if (uFillLevel < 0.004) discard;

      vec3 N = normalize(vNormalView);
      vec3 V = normalize(vViewPos);
      vec3 rimView = normalize((viewMatrix * vec4(uRimDir, 0.0)).xyz);

      // Swirl coordinate distortion for natural fluid marbling at layer interfaces
      float swirlAng = atan(vObjDir.z, vObjDir.x) + uVortex * (uTime * 11.0 - vGlassH * 5.0);
      vec3 samplePos = vec3(cos(swirlAng) * 3.2, vGlassH * 9.0, sin(swirlAng) * 3.2);
      float marble = (noise3(samplePos * 1.4 + vec3(0.0, -uTime * 0.15, 0.0)) - 0.5);

      // Evaluate multi-layer rainbow color, pulpiness & refractive inter-layer meniscus shimmer!
      vec3 baseCol = uLayerColors[0];
      float pulp = uLayerPulps[0];
      float interfaceGlow = 0.0;
      for (int i = 1; i < ${MAX_LIQUID_LAYERS}; i++) {
        if (i >= uLayerCount) break;
        float prevTop = uLayerTops[i - 1];
        float blur = max(0.006, uLayerBlurs[i]);
        float wave = marble * blur * 2.2;
        float distToInterface = abs(vGlassH - (prevTop + wave));
        // Thin total-internal-reflection bright shimmer line right where two liquid densities meet!
        interfaceGlow += exp(-distToInterface * 110.0) * 0.28;
        float w = smoothstep(prevTop - blur + wave, prevTop + blur + wave, vGlassH);
        baseCol = mix(baseCol, uLayerColors[i], w);
        pulp = mix(pulp, uLayerPulps[i], w);
      }

      // Sweet honey / berry syrup spiral ribbons woven through upper half!
      if (uSweetSwirl > 0.001) {
        float topZone = smoothstep(max(0.0, uFillLevel - 0.45), uFillLevel, vGlassH);
        float ribbonPhase = sin(swirlAng * 3.0 + vGlassH * 22.0 - uTime * 1.6 + marble * 3.0);
        float ribbon = smoothstep(0.35, 0.95, ribbonPhase) * topZone * clamp(uSweetSwirl, 0.0, 1.0);
        baseCol = mix(baseCol, uSweetColor, ribbon * 0.72);
      }

      // Dad's accidental sour lemon splash tint & tart surface rings!
      if (uSourRipple > 0.001) {
        float sourZone = smoothstep(max(0.0, uFillLevel - 0.24), uFillLevel, vGlassH);
        float tartRing = 0.5 + 0.5 * sin(length(vWorldPos.xz) * 55.0 - uTime * 9.0);
        baseCol = mix(baseCol, vec3(0.95, 0.92, 0.16), sourZone * clamp(uSourRipple, 0.0, 1.0) * (0.45 + 0.35 * tartRing));
      }

      // Fruit pulp fibers & tiny seed specks (stronger when blend duration was short!)
      float pulpNoise = noise3(samplePos * 5.5);
      float seedDots = smoothstep(0.86, 0.95, noise3(samplePos * 14.0));
      baseCol *= (1.0 - pulp * 0.22 * (pulpNoise - 0.5));
      baseCol = mix(baseCol, baseCol * 0.28 + vec3(0.18, 0.12, 0.05), seedDots * pulp * 0.55);

      // Isotropic round pinpoint carbonation/juice micro-bubbles (no vertical stretching!)
      vec3 bubWorld = vec3(vWorldPos.x * 52.0, vWorldPos.y * 52.0 - uTime * (1.8 + uBubbleRate * 3.0), vWorldPos.z * 52.0);
      float microBub = smoothstep(0.84, 0.94, noise3(bubWorld)) * uBubbleRate;

      // Aerated fruit-tinted micro-bubble foam crown with 3D cellular normal relief!
      float foamStart = max(0.0, uFillLevel - uFoamHeight);
      float foamWave = (noise3(vec3(vWorldPos.x * 16.0, 0.0, vWorldPos.z * 16.0)) - 0.5) * 0.009;
      float foamMask = uFoamHeight > 0.004
        ? smoothstep(foamStart - 0.014 + foamWave, foamStart + 0.010 + foamWave, vGlassH)
        : 0.0;
      if (vIsCap > 0.5 && vLocalNormY > 0.5 && uFoamHeight > 0.008) {
        foamMask = clamp(uFoamHeight * 14.0, 0.0, 1.0);
      }
      float foamCells = noise3(vWorldPos * 85.0 + vec3(0.0, uTime * 0.25, 0.0));
      float foamMacro = noise3(vWorldPos * 32.0);
      // Tint foam naturally with fruit pigment (rose-cream / golden-cream / jade-cream, never flat grey!)
      vec3 foamTint = mix(pow(max(baseCol, vec3(0.01)), vec3(0.65)), vec3(1.0, 0.985, 0.96), 0.66);
      foamTint *= (0.82 + 0.26 * foamCells) * (0.92 + 0.14 * foamMacro);

      // True Beer-Lambert Stained-Glass Optical Translucency!
      float ndotv = clamp(abs(dot(N, V)), 0.0, 1.0);
      vec3 absorption = max(vec3(0.06), vec3(1.0) - pow(clamp(baseCol, 0.02, 0.99), vec3(0.72)));
      float opticalPath = mix(0.60, 2.25, smoothstep(0.08, 0.62, ndotv)) * (1.15 - 0.48 * pow(ndotv, 2.8));
      vec3 beerTransmitted = exp(-absorption * opticalPath * 2.55);

      float backAlign = pow(clamp(dot(V, rimView) * 0.5 + 0.5, 0.0, 1.0), 1.8);
      float centerGlow = pow(ndotv, 2.1) * (0.58 + 0.45 * vGlassH);
      float rimGlow = pow(1.0 - ndotv, 2.5);

      vec3 liquidFinal = beerTransmitted * (0.68 + centerGlow * 1.25 + rimGlow * 1.02 + backAlign * 0.55);
      liquidFinal += beerTransmitted * interfaceGlow * 1.25;

      // Bottom crystal base caustic focus
      float bottomCaustic = (1.0 - smoothstep(0.0, 0.14, vGlassH)) * 0.58;
      liquidFinal += beerTransmitted * bottomCaustic * pow(ndotv, 1.4);

      // Crisp round sparkling micro-bubbles
      liquidFinal += vec3(1.0, 0.97, 0.92) * microBub * 0.68;

      // Specular wet sheen on top liquid meniscus & bright capillary meniscus line
      vec3 H = normalize(rimView + V);
      float spec = pow(max(dot(N, H), 0.0), 140.0) * (1.0 - foamMask * 0.75);
      float foamSpec = pow(max(dot(normalize(N + vec3(foamCells - 0.5) * 0.45), H), 0.0), 48.0) * foamMask * 0.45;
      float meniscusRim = smoothstep(0.974, 0.999, vLocalNormY) * (1.0 - vIsCap) * (1.0 - foamMask * 0.35);

      float foamLight = 0.50 + pow(1.0 - ndotv, 1.3) * 0.55 + max(dot(N, rimView), 0.0) * 0.46;
      vec3 foamFinal = foamTint * foamLight;

      vec3 col = mix(liquidFinal, foamFinal, foamMask);
      col += vec3(1.0, 0.98, 0.95) * (spec * 1.35 + foamSpec + meniscusRim * 0.75);

      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `;

  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: false,
  });
}

// Helper geometry for the adaptive liquid column (closed cylinder with subdivided cap for smooth meniscus/vortex)
export function createAdaptiveLiquidGeometry(radialSegs = 48, heightSegs = 40, capRings = 8) {
  const positions = [];
  const uvs = [];
  const normals = [];
  const isCap = [];
  const indices = [];

  // 1) Side wall [0..1] in Y, radius 1
  for (let y = 0; y <= heightSegs; y++) {
    const v = y / heightSegs;
    for (let x = 0; x <= radialSegs; x++) {
      const u = x / radialSegs;
      const a = u * Math.PI * 2;
      const cx = Math.cos(a);
      const cz = Math.sin(a);
      positions.push(cx, v, cz);
      normals.push(cx, 0, cz);
      uvs.push(u, v);
      isCap.push(0.0);
    }
  }
  const stride = radialSegs + 1;
  for (let y = 0; y < heightSegs; y++) {
    for (let x = 0; x < radialSegs; x++) {
      const i0 = y * stride + x;
      const i1 = i0 + 1;
      const i2 = i0 + stride;
      const i3 = i2 + 1;
      indices.push(i0, i2, i1, i1, i2, i3);
    }
  }

  // 2) Top meniscus cap (y = 1.0, concentric rings 0..1)
  const topBase = positions.length / 3;
  for (let r = 0; r <= capRings; r++) {
    const rr = r / capRings;
    for (let x = 0; x <= radialSegs; x++) {
      const u = x / radialSegs;
      const a = u * Math.PI * 2;
      positions.push(Math.cos(a) * rr, 1.0, Math.sin(a) * rr);
      normals.push(0, 1, 0);
      uvs.push(0.5 + Math.cos(a) * rr * 0.5, 0.5 + Math.sin(a) * rr * 0.5);
      isCap.push(1.0);
    }
  }
  for (let r = 0; r < capRings; r++) {
    for (let x = 0; x < radialSegs; x++) {
      const i0 = topBase + r * stride + x;
      const i1 = i0 + 1;
      const i2 = i0 + stride;
      const i3 = i2 + 1;
      indices.push(i0, i2, i1, i1, i2, i3);
    }
  }

  // 3) Bottom cap (y = 0.0)
  const botCenter = positions.length / 3;
  positions.push(0, 0, 0);
  normals.push(0, -1, 0);
  uvs.push(0.5, 0.5);
  isCap.push(1.0);
  for (let x = 0; x <= radialSegs; x++) {
    const u = x / radialSegs;
    const a = u * Math.PI * 2;
    positions.push(Math.cos(a), 0, Math.sin(a));
    normals.push(0, -1, 0);
    uvs.push(u, 0);
    isCap.push(1.0);
  }
  for (let x = 0; x < radialSegs; x++) {
    indices.push(botCenter, botCenter + 1 + x, botCenter + 2 + x);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('aIsCap', new THREE.Float32BufferAttribute(isCap, 1));
  geo.setIndex(indices);
  return geo;
}
