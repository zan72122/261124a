// Photorealistic Square-Block World, Dress-Up Stand, Dynamic Architectural House, Garden Crops & Macro Cinema DOF Shader
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { buildSignboardTexture, buildSkyEnvTexture } from './textures.js';

// ============================================================================
// 1. SINGLE-PASS DEPTH-BASED MACRO BOKEH + WARM BLOOM + ACES FILMIC POST-SHADER
// ============================================================================
export class MacroCinemaPost {
  constructor(renderer, camera) {
    this.renderer = renderer;
    this.camera = camera;
    this.rt = null;

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tColor: { value: null },
        tDepth: { value: null },
        uNear: { value: camera.near },
        uFar: { value: camera.far },
        uFocusDist: { value: 11.2 },
        uFocusRange: { value: 4.8 },
        uMaxBlur: { value: 0.0085 },
        uAspect: { value: 1.33 },
        uExposure: { value: 1.08 },
        uWarmGlow: { value: 0.22 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying vec2 vUv;
        uniform sampler2D tColor;
        uniform sampler2D tDepth;
        uniform float uNear;
        uniform float uFar;
        uniform float uFocusDist;
        uniform float uFocusRange;
        uniform float uMaxBlur;
        uniform float uAspect;
        uniform float uExposure;
        uniform float uWarmGlow;

        float linearizeDepth(float d) {
          float z = d * 2.0 - 1.0;
          return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear));
        }

        // ACES Filmic tone mapping for photographic highlight roll-off
        vec3 acesFilm(vec3 x) {
          float a = 2.51;
          float b = 0.03;
          float c = 2.43;
          float d = 0.59;
          float e = 0.14;
          return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
        }

        void main() {
          float centerDepth = linearizeDepth(texture2D(tDepth, vUv).r);
          float coc = clamp((abs(centerDepth - uFocusDist) - uFocusRange * 0.38) / uFocusRange, 0.0, 1.0);
          float radius = coc * uMaxBlur;

          vec3 sharpCol = texture2D(tColor, vUv).rgb;
          vec3 accum = sharpCol * 1.4;
          float totalW = 1.4;
          vec3 bloomAcc = vec3(0.0);

          // 16-tap Vogel Golden-Angle Spiral Disc for creamy miniature macro bokeh + warm lantern halo
          vec2 aspectVec = vec2(1.0 / max(uAspect, 0.5), 1.0);
          for (int i = 1; i <= 16; i++) {
            float fi = float(i);
            float r = sqrt(fi / 16.0);
            float theta = fi * 2.39996323;
            vec2 dir = vec2(cos(theta), sin(theta)) * r;

            // DOF sample
            vec2 uvSample = clamp(vUv + dir * aspectVec * radius, 0.001, 0.999);
            float sDepth = linearizeDepth(texture2D(tDepth, uvSample).r);
            float sCoc = clamp((abs(sDepth - uFocusDist) - uFocusRange * 0.35) / uFocusRange, 0.0, 1.0);
            // Prevent sharp foreground blocks bleeding unnaturally onto blurry background unless also blurred
            float w = (sDepth < centerDepth - 0.8) ? sCoc : 1.0;
            w = max(0.15, w);
            vec3 sc = texture2D(tColor, uvSample).rgb;
            accum += sc * w;
            totalW += w;

            // Soft wide highlight bloom tap for glowing night windows & sunlit highlights
            vec2 bloomUv = clamp(vUv + dir * aspectVec * 0.022, 0.001, 0.999);
            vec3 bc = texture2D(tColor, bloomUv).rgb;
            float lum = dot(bc, vec3(0.299, 0.587, 0.114));
            bloomAcc += max(vec3(0.0), bc - vec3(0.92)) * smoothstep(0.85, 2.2, lum);
          }

          vec3 col = accum / totalW;
          col += (bloomAcc / 16.0) * uWarmGlow;

          // Subtle natural optical lens vignette (very gentle so blocks at edges stay crisp & readable)
          float distCenter = length((vUv - 0.5) * vec2(1.05, 0.95));
          col *= 1.0 - smoothstep(0.45, 0.98, distCenter) * 0.22;

          col = acesFilm(col * uExposure);
          // Linear -> sRGB output
          col = pow(col, vec3(1.0 / 2.2));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
      depthWrite: false,
      depthTest: false,
    });

    this.quad = new FullScreenQuad(this.material);
  }

  setSize(w, h, pixelRatio) {
    const rw = Math.max(2, Math.floor(w * pixelRatio));
    const rh = Math.max(2, Math.floor(h * pixelRatio));
    if (this.rt) {
      this.rt.dispose();
      if (this.rt.depthTexture) this.rt.depthTexture.dispose();
    }
    const depthTexture = new THREE.DepthTexture(rw, rh);
    depthTexture.type = THREE.UnsignedIntType;
    this.rt = new THREE.WebGLRenderTarget(rw, rh, {
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: true,
      depthTexture,
    });
    this.material.uniforms.tColor.value = this.rt.texture;
    this.material.uniforms.tDepth.value = depthTexture;
    this.material.uniforms.uAspect.value = w / Math.max(1, h);
  }

  render(scene) {
    this.material.uniforms.uNear.value = this.camera.near;
    this.material.uniforms.uFar.value = this.camera.far;
    this.renderer.setRenderTarget(this.rt);
    this.renderer.clear();
    this.renderer.render(scene, this.camera);
    this.lastSceneTriangles = this.renderer.info.render.triangles;
    this.lastSceneCalls = this.renderer.info.render.calls;
    this.renderer.setRenderTarget(null);
    this.quad.render(this.renderer);
  }
}

// ============================================================================
// 2. WORLD, STEPPED PBR BLOCK LANDSCAPE, ARCHITECTURAL HOUSE & GARDEN
// ============================================================================
export class BlockVillageWorld {
  constructor(scene, renderer, materials, sound) {
    this.scene = scene;
    this.renderer = renderer;
    this.materials = materials;
    this.sound = sound;

    // Shared beveled block geometry (1.002 width eliminates black hairline cracks while keeping crisp block bevels!)
    this.blockGeo = new RoundedBoxGeometry(1.002, 1.002, 1.002, 1, 0.038);
    this.smallBlockGeo = new RoundedBoxGeometry(0.54, 0.54, 0.54, 1, 0.032);

    this.terrainHeights = new Map(); // "x,z" -> top surface Y
    this.houseGrid = new Map(); // "gx,gy,gz" -> { gx, gy, gz, type, sculpt, group, windowLights }
    this.gardenPlots = []; // Array of 6 interactive tilled plots
    this.houseLights = []; // Interior warm PointLights + emissive window meshes for Night!
    this.lanternBlocks = []; // Free-placed glowing blocks
    this.smokeParticles = [];
    this.chimneyPositions = [];

    this._setupLightingAndSky();
    this._buildBlockLandscape();
    this._buildSignboard();
    this._buildFoundationGuide();
    this._buildGardenPlots();
    this._buildDressUpWorkbench();
    this._buildSupplyStockpiles();
  }

  _setupLightingAndSky() {
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.pmrem.compileEquirectangularShader();

    this.envStates = {
      day: this.pmrem.fromEquirectangular(buildSkyEnvTexture(0.75)).texture,
      sunset: this.pmrem.fromEquirectangular(buildSkyEnvTexture(0.28)).texture,
      night: this.pmrem.fromEquirectangular(buildSkyEnvTexture(0.05)).texture,
    };
    this.scene.environment = this.envStates.day;
    this.scene.environmentIntensity = 0.72;

    // Sky dome with rich Rayleigh/Mie gradient, soft sunlit clouds, Sunset Magic Hour & Starry Night!
    this.skyUniforms = {
      uTopColor: { value: new THREE.Color(0x3a74ba) },
      uMidColor: { value: new THREE.Color(0x7fb4e5) },
      uHorizonColor: { value: new THREE.Color(0xdce9f5) },
      uCloudColor: { value: new THREE.Color(0xffffff) },
      uCloudAlpha: { value: 0.55 },
      uStarFade: { value: 0.0 },
      uTime: { value: 0.0 },
    };
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: this.skyUniforms,
      vertexShader: /* glsl */ `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vWorldPos;
        uniform vec3 uTopColor;
        uniform vec3 uMidColor;
        uniform vec3 uHorizonColor;
        uniform vec3 uCloudColor;
        uniform float uCloudAlpha;
        uniform float uStarFade;
        uniform float uTime;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        float noise2(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = hash(i);
          float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0));
          float d = hash(i + vec2(1.0, 1.0));
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }

        void main() {
          vec3 d = normalize(vWorldPos);
          // Map visible camera horizon band (-0.12 .. +0.26) into full rich sky gradient!
          float h = clamp((d.y + 0.12) * 3.1, 0.0, 1.0);
          vec3 col = mix(uHorizonColor, uMidColor, smoothstep(0.0, 0.42, h));
          col = mix(col, uTopColor, smoothstep(0.38, 0.95, h));

          // Soft natural cumulus clouds drifting across upper sky
          if (d.y > -0.08 && uCloudAlpha > 0.02) {
            vec2 cuv = d.xz / max(0.22, d.y + 0.32) * 1.6 + vec2(uTime * 0.012, 0.0);
            float c = noise2(cuv) * 0.55 + noise2(cuv * 2.3) * 0.30 + noise2(cuv * 4.8) * 0.15;
            float cloud = smoothstep(0.54, 0.82, c) * smoothstep(0.0, 0.35, h) * uCloudAlpha;
            col = mix(col, uCloudColor, cloud);
          }

          // Crisp twinkling stars in night sky!
          if (uStarFade > 0.01 && h > 0.08) {
            vec2 grid = floor(d.xz / max(0.25, d.y + 0.42) * 82.0);
            float n = hash(grid);
            if (n > 0.986) {
              vec2 f = fract(d.xz / max(0.25, d.y + 0.42) * 82.0) - 0.5;
              float tw = 0.72 + 0.28 * sin(uTime * 3.0 + n * 40.0);
              float star = smoothstep(0.26, 0.0, length(f)) * uStarFade * tw;
              col += vec3(1.0, 0.95, 0.82) * star * 1.55;
            }
          }
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    this.skyDome = new THREE.Mesh(new THREE.SphereGeometry(48, 24, 16), skyMat);
    this.scene.add(this.skyDome);

    // Interactive Sun / Sunset / Moon Orb + Soft Atmospheric Halo right in the upper sky!
    this.celestialOrb = new THREE.Group();
    const orbCore = new THREE.Mesh(
      new THREE.SphereGeometry(0.52, 18, 18),
      new THREE.MeshBasicMaterial({ color: 0xfff6d6 })
    );
    const orbHalo = new THREE.Mesh(
      new THREE.SphereGeometry(0.92, 18, 18),
      new THREE.MeshBasicMaterial({ color: 0xffcf75, transparent: true, opacity: 0.28, depthWrite: false })
    );
    this.celestialOrb.add(orbCore);
    this.celestialOrb.add(orbHalo);
    this.celestialOrb.userData = { core: orbCore, halo: orbHalo };
    this.celestialOrb.position.set(3.8, 3.85, -11.5);
    this.scene.add(this.celestialOrb);

    // Key directional sunlight with crisp-yet-soft macro shadows
    this.sunLight = new THREE.DirectionalLight(0xfff5e2, 2.55);
    this.sunLight.position.set(7.5, 11.5, 6.8);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(1024, 1024);
    this.sunLight.shadow.camera.near = 2;
    this.sunLight.shadow.camera.far = 28;
    this.sunLight.shadow.camera.left = -8.5;
    this.sunLight.shadow.camera.right = 8.5;
    this.sunLight.shadow.camera.top = 8.5;
    this.sunLight.shadow.camera.bottom = -8.5;
    this.sunLight.shadow.bias = -0.0008;
    this.sunLight.shadow.normalBias = 0.025;
    this.scene.add(this.sunLight);

    // Hemisphere bounce light (sky blue top + warm grass/soil bounce below)
    this.hemiLight = new THREE.HemisphereLight(0xcbe2ff, 0x695538, 0.85);
    this.scene.add(this.hemiLight);

    // Subtle warm fill light from front-left so blocks never look pitch black
    this.fillLight = new THREE.DirectionalLight(0xffe6c8, 0.45);
    this.fillLight.position.set(-6, 5, 8);
    this.scene.add(this.fillLight);

    // Master cozy interior house warm light (ramps up in Scene 3!)
    this.hearthMasterLight = new THREE.PointLight(0xff9f38, 0.0, 12.0, 1.5);
    this.hearthMasterLight.position.set(-0.5, 1.4, -0.8);
    this.scene.add(this.hearthMasterLight);

    this.timeOfDay = 0.0; // 0.0 = crisp day, 0.48 = sunset magic hour, 1.0 = starry night with glowing house!
    this.targetTimeOfDay = 0.0;
  }

  // Fill the entire screen edge-to-edge with photorealistic square blocks of Grass, Earth, Stone & Wood!
  _buildBlockLandscape() {
    const grassMatrices = [];
    const earthMatrices = [];
    const stoneMatrices = [];
    const woodMatrices = [];
    const grassTuftPositions = [];

    const dummy = new THREE.Object3D();

    // Dense amphitheater valley grid from x=[-9..9], z=[-8..5] framing scenic sky horizon above rolling block hills!
    const topGrid = new Map();
    for (let x = -9; x <= 9; x++) {
      for (let z = -8; z <= 5; z++) {
        let topLevel = 0;
        const flank = Math.max(0, Math.abs(x) - 3);
        // Organic rolling ridge silhouette along back so horizon is natural stepped hills, never a flat ruler line!
        const ridgeWave = Math.round(Math.sin(x * 0.65 + 0.8) * 0.7 + Math.cos(x * 1.2 - z * 0.5) * 0.5);
        if (z <= -5) {
          const base = Math.abs(x) <= 2 ? 0 : Math.min(3, 1 + Math.floor(flank * 0.45));
          topLevel = Math.max(0, base + Math.max(0, ridgeWave));
        } else if (z === -4) {
          topLevel = Math.abs(x) <= 3 ? 0 : Math.min(2, 1 + Math.floor(flank * 0.35));
        } else if (z === -3) {
          topLevel = Math.abs(x) >= 4 ? Math.min(2, Math.floor(flank * 0.5)) : 0;
        } else if (Math.abs(x) >= 5 && z <= 3) {
          topLevel = Math.min(2, Math.floor((Math.abs(x) - 4) * 0.6));
        } else if (z >= 4) {
          topLevel = -1;
        }
        topGrid.set(`${x},${z}`, topLevel);
        this.terrainHeights.set(`${x},${z}`, topLevel);
      }
    }

    for (let x = -9; x <= 9; x++) {
      for (let z = -8; z <= 5; z++) {
        const topLevel = topGrid.get(`${x},${z}`);
        // Only emit lower strata blocks where adjacent front/side neighbor is lower (zero wasted hidden underground triangles!)
        const nFront = topGrid.get(`${x},${z + 1}`) ?? -2;
        const nLeft  = topGrid.get(`${x - 1},${z}`) ?? topLevel;
        const nRight = topGrid.get(`${x + 1},${z}`) ?? topLevel;
        const lowestNeighbor = Math.min(topLevel, nFront, nLeft, nRight);
        const minY = Math.max(-1, lowestNeighbor);

        const isStoneOutcrop =
          (x >= 3 && x <= 7 && z <= -4 && topLevel >= 1) ||
          (Math.abs(x) === 4 && z === -3);
        const isTimberPile = (x >= -6 && x <= -4 && z >= -4 && z <= -3 && topLevel >= 1);

        for (let y = minY; y <= topLevel; y++) {
          dummy.position.set(x, y - 0.5, z);
          dummy.rotation.set(0, ((Math.abs(x * 7 + z * 13 + y * 5)) % 4) * (Math.PI * 0.5), 0);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          const m = dummy.matrix.clone();

          const isGardenCell = (y === topLevel) && (x >= -3 && x <= -1) && (z === 1 || z === 2);
          if (isGardenCell) {
            earthMatrices.push(m);
            continue;
          }

          if (y < topLevel) {
            if (isStoneOutcrop) stoneMatrices.push(m);
            else earthMatrices.push(m);
          } else {
            if (isTimberPile) {
              woodMatrices.push(m);
            } else if (isStoneOutcrop) {
              stoneMatrices.push(m);
            } else if (z >= 4) {
              if (Math.abs(x) <= 4) woodMatrices.push(m);
              else stoneMatrices.push(m);
            } else {
              grassMatrices.push(m);
              if (Math.abs(x) <= 7 && z >= -6 && z <= 3) {
                grassTuftPositions.push(new THREE.Vector3(x, topLevel, z));
              }
            }
          }
        }
      }
    }

    // Add decorative stacked lumber, stone outcrops & 2 scenic distant square-block trees on flanking hills!
    const decoBlocks = [
      { x: -4, y: 1, z: -2, t: 'wood' },
      { x: -4, y: 2, z: -2, t: 'wood' },
      { x: -5, y: 1, z: -2, t: 'wood' },
      { x: -5, y: 1, z: -1, t: 'earth' },
      { x:  4, y: 1, z: -2, t: 'stone' },
      { x:  5, y: 1, z: -2, t: 'stone' },
      { x:  5, y: 2, z: -2, t: 'stone' },
      { x:  4, y: 1, z:  2, t: 'earth' },
      // Left background block tree (wood trunk + lush foliage grass cubes)
      { x: -5, y: 3, z: -5, t: 'wood' },
      { x: -5, y: 4, z: -5, t: 'grass' },
      { x: -6, y: 4, z: -5, t: 'grass' },
      { x: -4, y: 4, z: -5, t: 'grass' },
      { x: -5, y: 5, z: -5, t: 'grass' },
      // Right background block tree
      { x:  6, y: 3, z: -6, t: 'wood' },
      { x:  6, y: 4, z: -6, t: 'grass' },
      { x:  5, y: 4, z: -6, t: 'grass' },
      { x:  7, y: 4, z: -6, t: 'grass' },
      { x:  6, y: 5, z: -6, t: 'grass' },
    ];
    decoBlocks.forEach((b) => {
      dummy.position.set(b.x, b.y - 0.5, b.z);
      dummy.rotation.set(0, (b.x * 3) * (Math.PI * 0.5), 0);
      dummy.updateMatrix();
      const m = dummy.matrix.clone();
      if (b.t === 'wood') woodMatrices.push(m);
      else if (b.t === 'stone') stoneMatrices.push(m);
      else earthMatrices.push(m);
      const key = `${b.x},${b.z}`;
      this.terrainHeights.set(key, Math.max(this.terrainHeights.get(key) || 0, b.y));
    });

    const buildInstanced = (mat, matrices, tintMode) => {
      const im = new THREE.InstancedMesh(this.blockGeo, mat, matrices.length);
      im.castShadow = true;
      im.receiveShadow = true;
      const col = new THREE.Color();
      for (let i = 0; i < matrices.length; i++) {
        im.setMatrixAt(i, matrices[i]);
        // Subtle natural per-block micro-variation so adjacent blocks look like genuine distinct sod/stone/timber pieces!
        const h1 = ((i * 73 + 19) % 29) / 29 - 0.5;
        const h2 = ((i * 37 + 11) % 23) / 23 - 0.5;
        if (tintMode === 'grass') {
          col.setRGB(1.0 + h1 * 0.08, 1.0 + h2 * 0.07, 1.0 - h1 * 0.05);
        } else if (tintMode === 'stone') {
          const v = 1.0 + h1 * 0.11;
          col.setRGB(v + h2 * 0.03, v, v - h2 * 0.03);
        } else if (tintMode === 'wood') {
          col.setRGB(1.0 + h1 * 0.09, 1.0 + h1 * 0.06, 1.0 + h2 * 0.04);
        } else {
          const v = 1.0 + h1 * 0.09;
          col.setRGB(v, v * 0.99, v * 0.98);
        }
        im.setColorAt(i, col);
      }
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      this.scene.add(im);
      return im;
    };

    this.instGrass = buildInstanced(this.materials.matGrassBlock, grassMatrices, 'grass');
    this.instEarth = buildInstanced(this.materials.matEarth, earthMatrices, 'earth');
    this.instStone = buildInstanced(this.materials.matStone, stoneMatrices, 'stone');
    this.instWood = buildInstanced(this.materials.matWoodBlock, woodMatrices, 'wood');

    // Add 3D micro-grass tufts on top of grass blocks for natural organic silhouette!
    const bladeGeo = new THREE.ConeGeometry(0.035, 0.19, 3);
    bladeGeo.translate(0, 0.09, 0);
    const bladeMat = new THREE.MeshStandardMaterial({
      color: 0x587f32,
      roughness: 0.82,
    });
    const tuftCount = Math.min(360, grassTuftPositions.length * 4);
    const tuftInst = new THREE.InstancedMesh(bladeGeo, bladeMat, tuftCount);
    let idx = 0;
    for (let i = 0; i < grassTuftPositions.length && idx < tuftCount; i++) {
      const gp = grassTuftPositions[i];
      // Don't place tall grass inside house foundation footprint
      if (gp.x >= -2 && gp.x <= 1 && gp.z >= -2 && gp.z <= 0) continue;
      for (let k = 0; k < 4 && idx < tuftCount; k++) {
        const ox = ((i * 17 + k * 31) % 100) / 100 - 0.5;
        const oz = ((i * 29 + k * 13) % 100) / 100 - 0.5;
        dummy.position.set(gp.x + ox * 0.78, gp.y - 0.01, gp.z + oz * 0.78);
        dummy.rotation.set((ox * 0.3), k * 1.1, (oz * 0.3));
        const sc = 0.75 + ((i + k) % 4) * 0.22;
        dummy.scale.set(sc, sc, sc);
        dummy.updateMatrix();
        tuftInst.setMatrixAt(idx++, dummy.matrix);
      }
    }
    tuftInst.count = idx;
    tuftInst.instanceMatrix.needsUpdate = true;
    this.scene.add(tuftInst);
  }

  getGroundHeight(wx, wz) {
    const gx = Math.round(wx);
    const gz = Math.round(wz);
    const h = this.terrainHeights.get(`${gx},${gz}`);
    return h !== undefined ? h : 0;
  }

  // 1 Wooden Picture Signboard staked into the grass beside the house (`ルールは絵の看板1枚で見せる`)
  _buildSignboard() {
    this.signGroup = new THREE.Group();
    this.signGroup.position.set(2.85, 0.0, -1.65);
    this.signGroup.rotation.y = -0.36;

    // Two cedar stakes
    [-0.48, 0.48].forEach((px) => {
      const post = new THREE.Mesh(
        new RoundedBoxGeometry(0.11, 1.35, 0.11, 2, 0.02),
        this.materials.matWoodSide
      );
      post.position.set(px, 0.65, 0);
      post.castShadow = true;
      this.signGroup.add(post);
    });

    // Backing board
    const back = new THREE.Mesh(
      new RoundedBoxGeometry(1.48, 1.10, 0.10, 2, 0.025),
      this.materials.matWoodSide
    );
    back.position.set(0, 1.16, 0);
    back.castShadow = true;
    back.receiveShadow = true;
    this.signGroup.add(back);

    // Painted front face (zero text, pure pictorial illustration!)
    this.signFaceMat = new THREE.MeshStandardMaterial({
      map: buildSignboardTexture(1, 'stone'),
      roughness: 0.74,
      metalness: 0.02,
    });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(1.38, 1.02), this.signFaceMat);
    face.position.set(0, 1.16, 0.056);
    this.signGroup.add(face);

    this.signGroup.visible = false;
    this.scene.add(this.signGroup);
    this.signBounce = 0;
  }

  updateSignboard(sceneIdx, requestedMat = 'stone') {
    if (this.signFaceMat.map) this.signFaceMat.map.dispose();
    this.signFaceMat.map = buildSignboardTexture(sceneIdx, requestedMat);
    this.signFaceMat.needsUpdate = true;
    this.signGroup.visible = true;
    this.signBounce = 1.0;
  }

  // Subtle physical stone corner pegs marking the unfinished house plot (`未完成で目標を物理的に見せる`)
  _buildFoundationGuide() {
    this.foundationGroup = new THREE.Group();
    // House footprint: gx in [-2, -1, 0, 1], gz in [-2, -1, 0] -> center (-0.5, 0, -1.0)
    const pegMat = new THREE.MeshStandardMaterial({ color: 0xcbb693, roughness: 0.82 });
    const corners = [
      [-2.48, -2.48], [1.48, -2.48], [-2.48, 0.48], [1.48, 0.48],
    ];
    corners.forEach(([cx, cz]) => {
      const peg = new THREE.Mesh(new RoundedBoxGeometry(0.14, 0.28, 0.14, 2, 0.02), pegMat);
      peg.position.set(cx, 0.12, cz);
      peg.castShadow = true;
      this.foundationGroup.add(peg);
    });

    // Compacted levelled gravel/earth pad slightly recessed so child immediately wants to stack blocks on it!
    const pad = new THREE.Mesh(
      new RoundedBoxGeometry(3.92, 0.06, 2.92, 2, 0.02),
      new THREE.MeshStandardMaterial({
        map: this.materials.matStone.map,
        normalMap: this.materials.matStone.normalMap,
        color: 0xb5aa99,
        roughness: 0.9,
      })
    );
    pad.position.set(-0.5, 0.01, -1.0);
    pad.receiveShadow = true;
    this.foundationGroup.add(pad);

    this.foundationGroup.visible = false;
    this.scene.add(this.foundationGroup);
  }

  // 6 Tilled Moist Loam Plots right in front of the house for Scene 2 (`畑にブロックの種を植えると作物が伸び`)
  _buildGardenPlots() {
    this.gardenGroup = new THREE.Group();
    const coords = [
      [-3, 1], [-2, 1], [-1, 1],
      [-3, 2], [-2, 2], [-1, 2],
    ];
    coords.forEach(([px, pz], idx) => {
      const soilMesh = new THREE.Mesh(
        new RoundedBoxGeometry(0.96, 0.18, 0.96, 2, 0.04),
        this.materials.matTilled.clone()
      );
      soilMesh.position.set(px, 0.04, pz);
      soilMesh.receiveShadow = true;
      soilMesh.castShadow = true;
      this.gardenGroup.add(soilMesh);

      const cropRoot = new THREE.Group();
      cropRoot.position.set(px, 0.13, pz);
      this.gardenGroup.add(cropRoot);

      const plot = {
        index: idx,
        x: px,
        z: pz,
        soilMesh,
        cropRoot,
        planted: false,
        cropKind: null, // 'berry', 'wheat', 'pumpkin', or 'rockflower' if planted with stone!
        growth: 0, // Continuous 0.0 -> 1.35!
        ripeNotified: false,
        visualStage: -1,
      };
      soilMesh.userData.plot = plot;
      this.gardenPlots.push(plot);
    });

    // Low rustic cedar border logs framing the garden bed
    const logGeoH = new RoundedBoxGeometry(3.15, 0.16, 0.14, 2, 0.03);
    [0.44, 2.56].forEach((lz) => {
      const log = new THREE.Mesh(logGeoH, this.materials.matWoodSide);
      log.position.set(-2.0, 0.08, lz);
      log.castShadow = true;
      this.gardenGroup.add(log);
    });

    this.gardenGroup.visible = false;
    this.scene.add(this.gardenGroup);
  }

  // ============================================================================
  // OPENING 3D DRESS-UP WORKBENCH (`最初に衣装を着せると画面の女の子がその役になり`)
  // ============================================================================
  _buildDressUpWorkbench() {
    this.dressUpGroup = new THREE.Group();
    this.dressUpGroup.position.set(0, 0.0, 1.35);
    this.outfitStands = [];

    const xs = [-1.85, 0.0, 1.85];
    xs.forEach((ox, idx) => {
      const stand = new THREE.Group();
      stand.position.set(ox, 0, 0);

      // Solid stone & cedar pedestal block
      const baseBlock = new THREE.Mesh(
        new RoundedBoxGeometry(1.25, 0.42, 1.05, 3, 0.045),
        idx === 1 ? this.materials.matWoodBlock : this.materials.matStone
      );
      baseBlock.position.y = 0.21;
      baseBlock.castShadow = true;
      baseBlock.receiveShadow = true;
      stand.add(baseBlock);

      // Wooden T-hanger post
      const post = new THREE.Mesh(
        new RoundedBoxGeometry(0.11, 1.45, 0.11, 2, 0.02),
        this.materials.matWoodSide
      );
      post.position.set(0, 1.05, -0.12);
      post.castShadow = true;
      stand.add(post);

      const bar = new THREE.Mesh(
        new RoundedBoxGeometry(0.86, 0.10, 0.10, 2, 0.02),
        this.materials.matWoodSide
      );
      bar.position.set(0, 1.52, -0.06);
      bar.castShadow = true;
      stand.add(bar);

      // Tactile 3D Woven Fabric Apron/Vest + Straps + Pocket + Matching Hat!
      const garmentGroup = new THREE.Group();
      garmentGroup.position.set(0, 1.15, 0.05);

      const outfitMat = this.materials.outfits[idx].cloth;
      const torso = new THREE.Mesh(
        new RoundedBoxGeometry(0.76, 0.78, 0.22, 3, 0.06),
        outfitMat
      );
      torso.castShadow = true;
      garmentGroup.add(torso);

      // Shoulder straps
      [-0.23, 0.23].forEach((sx) => {
        const strap = new THREE.Mesh(new RoundedBoxGeometry(0.15, 0.34, 0.24, 2, 0.03), outfitMat);
        strap.position.set(sx, 0.44, 0);
        strap.castShadow = true;
        garmentGroup.add(strap);

        const btn = new THREE.Mesh(
          new THREE.CylinderGeometry(0.045, 0.045, 0.03, 12),
          new THREE.MeshStandardMaterial({ color: 0xdca642, roughness: 0.32, metalness: 0.65 })
        );
        btn.rotation.x = Math.PI * 0.5;
        btn.position.set(sx, 0.29, 0.12);
        garmentGroup.add(btn);
      });

      // Front pocket + characteristic craft tool peeking out!
      const pocket = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.28, 0.06, 2, 0.02), outfitMat);
      pocket.position.set(0, -0.10, 0.11);
      garmentGroup.add(pocket);

      // Matching 3D Hat perched atop the hanger!
      const hatMat = new THREE.MeshStandardMaterial({
        color: this.materials.outfits[idx].hatColor,
        roughness: 0.78,
      });
      if (idx === 1) {
        // Straw gardener sunhat with wide brim
        const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.48, 0.05, 20), hatMat);
        brim.position.set(0, 0.68, 0.02);
        brim.castShadow = true;
        garmentGroup.add(brim);
        const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.30, 0.22, 18), hatMat);
        crown.position.set(0, 0.79, 0.02);
        crown.castShadow = true;
        garmentGroup.add(crown);
      } else {
        // Carpenter cap / Mason cap
        const crown = new THREE.Mesh(new THREE.SphereGeometry(0.30, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hatMat);
        crown.position.set(0, 0.64, 0.02);
        crown.castShadow = true;
        garmentGroup.add(crown);
        const visor = new THREE.Mesh(new RoundedBoxGeometry(0.44, 0.04, 0.24, 2, 0.015), hatMat);
        visor.position.set(0, 0.66, 0.20);
        garmentGroup.add(visor);
      }

      // Large invisible touch collider so 5yo finger never misses!
      const hit = new THREE.Mesh(
        new THREE.BoxGeometry(1.55, 2.1, 1.35),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hit.position.set(0, 1.0, 0);
      hit.userData.outfitIndex = idx;
      stand.add(hit);

      stand.add(garmentGroup);
      stand.userData = { idx, garmentGroup, hit, basePos: stand.position.clone() };
      this.dressUpGroup.add(stand);
      this.outfitStands.push(stand);
    });

    this.scene.add(this.dressUpGroup);
  }

  // ============================================================================
  // FOREGROUND 3D SUPPLY STOCKPILES (Tactile 3D Blocks at Bottom of Screen!)
  // ============================================================================
  _buildSupplyStockpiles() {
    this.supplyGroup = new THREE.Group();
    this.supplyGroup.position.set(0, 0.15, 3.55);
    this.supplyItems = [];

    // All potential palette items; visibility & spacing adapt cleanly to current scene!
    const defs = [
      { id: 'stone',   scenes: [1, 2, 3] },
      { id: 'wood',    scenes: [1, 2, 3] },
      { id: 'grass',   scenes: [1, 3] },
      { id: 'earth',   scenes: [1, 3] },
      { id: 'seed_berry',   scenes: [2, 3] },
      { id: 'seed_wheat',   scenes: [2] },
      { id: 'seed_pumpkin', scenes: [2] },
      { id: 'lantern', scenes: [3] },
    ];

    defs.forEach((def) => {
      const slot = new THREE.Group();
      const visual = this.createPreviewMesh(def.id, 0.76);
      slot.add(visual);

      // Generous invisible touch box (`触る対象は大きく`)
      const hit = new THREE.Mesh(
        new THREE.BoxGeometry(1.18, 1.25, 1.25),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hit.userData.supplyId = def.id;
      slot.add(hit);

      slot.userData = { id: def.id, scenes: def.scenes, visual, hit, selected: false, bobPhase: Math.random() * 6 };
      this.supplyGroup.add(slot);
      this.supplyItems.push(slot);
    });

    this.supplyGroup.visible = false;
    this.scene.add(this.supplyGroup);
  }

  layoutSuppliesForScene(sceneIdx, aspect = 1.33) {
    this.supplyGroup.visible = sceneIdx >= 1;
    const active = this.supplyItems.filter((s) => s.userData.scenes.includes(sceneIdx));
    this.supplyItems.forEach((s) => { s.visible = false; });

    // Adapt width to narrow iPhone portrait vs wide iPad landscape!
    const maxSpan = Math.min(5.6, Math.max(3.1, aspect * 4.3));
    const step = active.length > 1 ? Math.min(1.22, maxSpan / (active.length - 1)) : 0;
    const startX = -((active.length - 1) * step) * 0.5;
    const itemScale = aspect < 0.8 ? 0.78 : 0.96;

    // Position foreground supply bar closer on portrait so it stays well inside frustum
    this.supplyGroup.position.z = aspect < 0.85 ? 3.25 : 3.48;
    this.supplyGroup.position.y = aspect < 0.85 ? 0.08 : 0.12;

    active.forEach((slot, i) => {
      slot.visible = true;
      slot.position.set(startX + i * step, 0, 0);
      slot.scale.setScalar(itemScale);
    });
  }

  createPreviewMesh(id, scale = 0.65) {
    const g = new THREE.Group();
    if (id === 'stone' || id === 'wood' || id === 'grass' || id === 'earth' || id === 'lantern') {
      const matMap = {
        stone: this.materials.matStone,
        wood: this.materials.matWoodBlock,
        grass: this.materials.matGrassBlock,
        earth: this.materials.matEarth,
        lantern: this.materials.matLantern,
      };
      const m = new THREE.Mesh(this.blockGeo, matMap[id]);
      m.scale.setScalar(scale);
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
    } else {
      // Seed / Crop Block Crate: Earth/Wood planter cube topped with ruby berry / wheat / pumpkin!
      const base = new THREE.Mesh(this.blockGeo, this.materials.matTilled);
      base.scale.set(scale, scale * 0.68, scale);
      base.castShadow = true;
      g.add(base);

      if (id === 'seed_berry' || id === 'crop') {
        const leaf = new THREE.Mesh(
          new RoundedBoxGeometry(0.52 * scale, 0.34 * scale, 0.52 * scale, 2, 0.04),
          this.materials.matGrassTop
        );
        leaf.position.y = 0.36 * scale;
        g.add(leaf);
        const berry = new THREE.Mesh(
          new RoundedBoxGeometry(0.32 * scale, 0.34 * scale, 0.32 * scale, 3, 0.08),
          this.materials.matBerry
        );
        berry.position.set(0.05 * scale, 0.54 * scale, 0.05 * scale);
        berry.castShadow = true;
        g.add(berry);
      } else if (id === 'seed_wheat') {
        const wheatMat = new THREE.MeshStandardMaterial({ color: 0xdca53a, roughness: 0.68 });
        for (let k = -1; k <= 1; k++) {
          const stalk = new THREE.Mesh(new RoundedBoxGeometry(0.14 * scale, 0.58 * scale, 0.14 * scale, 2, 0.03), wheatMat);
          stalk.position.set(k * 0.18 * scale, 0.45 * scale, 0);
          stalk.rotation.z = k * -0.12;
          stalk.castShadow = true;
          g.add(stalk);
        }
      } else if (id === 'seed_pumpkin') {
        const pumpMat = new THREE.MeshStandardMaterial({ color: 0xd96b24, roughness: 0.46 });
        const pump = new THREE.Mesh(new RoundedBoxGeometry(0.54 * scale, 0.44 * scale, 0.54 * scale, 3, 0.09), pumpMat);
        pump.position.y = 0.42 * scale;
        pump.castShadow = true;
        g.add(pump);
      }
    }
    return g;
  }

  // ============================================================================
  // DYNAMIC ARCHITECTURAL HOUSE SYSTEM (`置く場所と種類で形が変わる` × Continuous Hold)
  // ============================================================================
  placeOrSculptHouseBlock(wx, wz, type, holdDelta = 0) {
    // Snap generously onto the 4x3 house plot (or expanded 6x4 in Scene 3!)
    const gx = Math.max(-3, Math.min(2, Math.round(wx)));
    const gz = Math.max(-2, Math.min(0, Math.round(wz)));

    // Find current column height
    let topY = -1;
    for (let y = 0; y < 5; y++) {
      if (this.houseGrid.has(`${gx},${y},${gz}`)) topY = y;
    }

    // If holding on an already placed column, sculpt/enrich the top block continuously!
    if (holdDelta > 0 && topY >= 0) {
      const cell = this.houseGrid.get(`${gx},${topY},${gz}`);
      cell.sculpt = Math.min(1.0, cell.sculpt + holdDelta);
      this._rebuildAllHouseVisuals();
      return { action: 'sculpt', cell, totalCount: this.houseGrid.size };
    }

    const targetY = topY + 1;
    if (targetY >= 4) {
      // Column full -> enrich top block instead of failing!
      const cell = this.houseGrid.get(`${gx},${3},${gz}`);
      cell.type = type;
      cell.sculpt = Math.min(1.0, cell.sculpt + 0.35);
      this._rebuildAllHouseVisuals();
      return { action: 'morph', cell, totalCount: this.houseGrid.size };
    }

    const key = `${gx},${targetY},${gz}`;
    const cell = {
      gx,
      gy: targetY,
      gz,
      type,
      sculpt: 0.0,
      group: new THREE.Group(),
      popScale: 0.25,
    };
    cell.group.position.set(gx, targetY + 0.5, gz);
    this.scene.add(cell.group);
    this.houseGrid.set(key, cell);

    this._rebuildAllHouseVisuals();
    return { action: 'place', cell, totalCount: this.houseGrid.size };
  }

  getStaticHouseAABBs() {
    const boxes = [];
    this.houseGrid.forEach((c) => {
      boxes.push({
        min: new THREE.Vector3(c.gx - 0.5, c.gy, c.gz - 0.5),
        max: new THREE.Vector3(c.gx + 0.5, c.gy + 1.0, c.gz + 0.5),
      });
    });
    return boxes;
  }

  _rebuildAllHouseVisuals() {
    // Clear registered window lights & chimneys before regenerating contextual architecture
    this.houseLights.forEach((hl) => {
      if (hl.light && hl.light.parent) hl.light.parent.remove(hl.light);
    });
    this.houseLights = [];
    this.chimneyPositions = [];

    const has = (x, y, z) => this.houseGrid.has(`${x},${y},${z}`);

    this.houseGrid.forEach((cell) => {
      const { gx, gy, gz, type, sculpt, group } = cell;
      while (group.children.length > 0) group.remove(group.children[0]);

      const hasAbove = has(gx, gy + 1, gz);
      const hasFront = has(gx, gy, gz + 1);
      const hasLeft  = has(gx - 1, gy, gz);
      const hasRight = has(gx + 1, gy, gz);
      const isFrontFace = !hasFront;

      const matMap = {
        stone: this.materials.matStone,
        wood: this.materials.matWoodBlock,
        grass: this.materials.matGrassBlock,
        earth: this.materials.matEarth,
        lantern: this.materials.matLantern,
      };

      // Contextual Architectural Role!
      // 1. Topmost block when height >= 1 (or sculpted) -> Contextual Roof / Parapet / Living Sod Roof!
      const actAsRoof = !hasAbove && (gy >= 1 || sculpt > 0.45) && type !== 'lantern';

      if (actAsRoof && type === 'wood') {
        // Pitched Cedar-Shingle Gable Roof with overhanging eaves (wider overhang as you hold longer!)
        const eave = 1.12 + sculpt * 0.24;
        const wallBase = new THREE.Mesh(
          new RoundedBoxGeometry(0.98, 0.36, 0.98, 2, 0.03),
          this.materials.matWoodBlock
        );
        wallBase.position.y = -0.32;
        wallBase.castShadow = true;
        wallBase.receiveShadow = true;
        group.add(wallBase);

        // Two sloped shingle roof planes + gable timber triangle
        const slopeGeo = new RoundedBoxGeometry(eave, 0.12, 0.78 + sculpt * 0.12, 2, 0.025);
        const slopeF = new THREE.Mesh(slopeGeo, this.materials.matRoofShingle);
        slopeF.position.set(0, 0.08, 0.25);
        slopeF.rotation.x = 0.62;
        slopeF.castShadow = true;
        slopeF.receiveShadow = true;
        group.add(slopeF);

        const slopeB = new THREE.Mesh(slopeGeo, this.materials.matRoofShingle);
        slopeB.position.set(0, 0.08, -0.25);
        slopeB.rotation.x = -0.62;
        slopeB.castShadow = true;
        slopeB.receiveShadow = true;
        group.add(slopeB);

        const ridge = new THREE.Mesh(
          new RoundedBoxGeometry(eave * 1.02, 0.13, 0.16, 2, 0.03),
          this.materials.matWoodSide
        );
        ridge.position.set(0, 0.32, 0);
        ridge.castShadow = true;
        group.add(ridge);

        // Dormer glowing attic window on front slope!
        if (isFrontFace) {
          this._attachWindow(group, 0, 0.06, 0.38, 0.32 + sculpt * 0.14, 0.28);
        }
      } else if (actAsRoof && type === 'grass') {
        // Scandinavian Living Sod Roof with lush turf overhang & wildflower clusters!
        const turf = new THREE.Mesh(
          new RoundedBoxGeometry(1.14 + sculpt * 0.18, 0.65, 1.14 + sculpt * 0.18, 3, 0.06),
          this.materials.matGrassBlock
        );
        turf.position.y = -0.14;
        turf.castShadow = true;
        turf.receiveShadow = true;
        group.add(turf);

        // Timber fascia beams supporting the sod roof
        const beam = new THREE.Mesh(
          new RoundedBoxGeometry(1.18, 0.12, 1.18, 2, 0.02),
          this.materials.matWoodSide
        );
        beam.position.y = -0.44;
        group.add(beam);

        // Blooming meadow flowers on living roof (more flowers the longer you hold!)
        const flowerCount = 3 + Math.floor(sculpt * 6);
        for (let f = 0; f < flowerCount; f++) {
          const ang = f * 2.1 + gx;
          const rad = 0.15 + (f % 3) * 0.12;
          const fl = new THREE.Mesh(
            new RoundedBoxGeometry(0.11, 0.11, 0.11, 2, 0.03),
            f % 2 === 0 ? this.materials.matBerry : new THREE.MeshStandardMaterial({ color: 0xf4cf58, roughness: 0.6 })
          );
          fl.position.set(Math.cos(ang) * rad, 0.23, Math.sin(ang) * rad);
          group.add(fl);
        }
      } else if (actAsRoof && type === 'stone') {
        // Stone Parapet + Smoking Hearth Chimney Stack!
        const base = new THREE.Mesh(this.blockGeo, this.materials.matStone);
        base.scale.set(1.02, 0.72, 1.02);
        base.position.y = -0.14;
        base.castShadow = true;
        base.receiveShadow = true;
        group.add(base);

        const chimney = new THREE.Mesh(
          new RoundedBoxGeometry(0.46, 0.68 + sculpt * 0.35, 0.46, 2, 0.035),
          this.materials.matStone
        );
        chimney.position.set(0.16, 0.42 + sculpt * 0.16, -0.12);
        chimney.castShadow = true;
        group.add(chimney);

        this.chimneyPositions.push(new THREE.Vector3(gx + 0.16, gy + 1.25 + sculpt * 0.3, gz - 0.12));
        if (isFrontFace) {
          this._attachWindow(group, -0.12, -0.14, 0.51, 0.34, 0.34);
        }
      } else if (actAsRoof && type === 'earth') {
        // Warm Rammed-Earth Adobe Terrace with protruding cedar vigas (roof beams)!
        const adobe = new THREE.Mesh(this.blockGeo, this.materials.matEarth);
        adobe.castShadow = true;
        adobe.receiveShadow = true;
        group.add(adobe);

        [-0.26, 0.26].forEach((bx) => {
          const viga = new THREE.Mesh(
            new RoundedBoxGeometry(0.12, 0.12, 1.24 + sculpt * 0.18, 2, 0.02),
            this.materials.matWoodSide
          );
          viga.position.set(bx, 0.30, 0.06);
          viga.castShadow = true;
          group.add(viga);
        });
        if (isFrontFace) {
          this._attachWindow(group, 0, -0.06, 0.50, 0.38, 0.36);
        }
      } else {
        // --- WALL / FOUNDATION / DOORWAY / LANTERN BLOCK ---
        const mainMesh = new THREE.Mesh(this.blockGeo, matMap[type] || this.materials.matWoodBlock);
        mainMesh.castShadow = true;
        mainMesh.receiveShadow = true;
        group.add(mainMesh);

        if (type === 'lantern') {
          this._registerLanternGlow(group, mainMesh, 1.15);
        } else if (gy === 0 && isFrontFace && (gx === -1 || gx === 0) && (hasLeft || hasRight || hasAbove)) {
          // Ground-floor front center cell automatically crafts a welcoming Timber Doorway + Stone Step!
          const frame = new THREE.Mesh(
            new RoundedBoxGeometry(0.64, 0.84, 0.10, 2, 0.02),
            this.materials.matWoodSide
          );
          frame.position.set(0, -0.06, 0.48);
          group.add(frame);

          // Warm lit transom window in upper door!
          this._attachWindow(group, 0, 0.10, 0.535, 0.36, 0.28, true);

          const step = new THREE.Mesh(
            new RoundedBoxGeometry(0.76, 0.12, 0.32, 2, 0.02),
            this.materials.matStone
          );
          step.position.set(0, -0.44, 0.62);
          step.castShadow = true;
          step.receiveShadow = true;
          group.add(step);
        } else if (isFrontFace && (gy >= 1 || sculpt > 0.2 || hasLeft || hasRight)) {
          // Wall window with cedar shutters & optional windowsill flowerbox!
          const winW = 0.42 + sculpt * 0.22;
          const winH = 0.42 + sculpt * 0.16;
          this._attachWindow(group, 0, 0.04, 0.502, winW, winH);

          if (sculpt > 0.25 || type === 'grass' || type === 'wood') {
            const box = new THREE.Mesh(
              new RoundedBoxGeometry(winW + 0.14, 0.12, 0.18, 2, 0.02),
              this.materials.matWoodSide
            );
            box.position.set(0, -0.22, 0.56);
            box.castShadow = true;
            group.add(box);

            const greenery = new THREE.Mesh(
              new RoundedBoxGeometry(winW + 0.08, 0.10, 0.14, 2, 0.02),
              this.materials.matGrassTop
            );
            greenery.position.set(0, -0.14, 0.56);
            group.add(greenery);
          }
        }
      }
    });
  }

  _attachWindow(parentGroup, x, y, z, w, h, isDoor = false) {
    const winMat = this.materials.matLantern.clone();
    // By day, window glass looks like dark reflective architectural glass; at dusk/night it ignites with warm 2700K glow!
    winMat.color.setHex(0x46525e);
    winMat.roughness = 0.16;
    winMat.emissiveIntensity = 0.04;
    const pane = new THREE.Mesh(new RoundedBoxGeometry(w, h, 0.06, 1, 0.015), winMat);
    pane.position.set(x, y, z);
    parentGroup.add(pane);

    let ptLight = null;
    if (this.houseLights.filter((l) => l.light).length < 5) {
      ptLight = new THREE.PointLight(0xffa43b, 0.0, isDoor ? 6.8 : 5.4, 1.6);
      ptLight.position.set(x, y, z + 0.35);
      parentGroup.add(ptLight);
    }
    this.houseLights.push({ mesh: pane, mat: winMat, light: ptLight, flickerSeed: Math.random() * 10 });
  }

  _registerLanternGlow(parentGroup, mesh, power = 1.0) {
    const mat = this.materials.matLantern.clone();
    mesh.material = mat;
    let ptLight = null;
    if (this.houseLights.filter((l) => l.light).length < 7) {
      ptLight = new THREE.PointLight(0xffaa44, 0.0, 5.8 * power, 1.6);
      ptLight.position.set(0, 0.1, 0);
      parentGroup.add(ptLight);
    }
    this.houseLights.push({ mesh, mat, light: ptLight, flickerSeed: Math.random() * 10, alwaysWarm: true });
  }

  // ============================================================================
  // GARDEN PLANTING & CONTINUOUS GROWTH (`畑にブロックの種を植えると作物が伸び`)
  // ============================================================================
  plantOrGrowPlot(plot, itemId, growDelta = 0.28) {
    if (!plot) return { justRipened: false, wrongMaterial: false };

    let wrongMaterial = false;
    if (!plot.planted) {
      plot.planted = true;
      if (itemId === 'seed_wheat') plot.cropKind = 'wheat';
      else if (itemId === 'seed_pumpkin') plot.cropKind = 'pumpkin';
      else if (itemId === 'stone' || itemId === 'wood' || itemId === 'earth' || itemId === 'grass') {
        // Player put a building block into the tilled garden plot!
        // Zero failure: cute mossy rock-flower garden sprouts & triggers "あれ？→喜ぶ"!
        plot.cropKind = 'rockflower';
        wrongMaterial = true;
      } else {
        plot.cropKind = 'berry';
      }
      plot.growth = 0.24;
    } else {
      plot.growth = Math.min(1.40, plot.growth + growDelta);
    }

    // Darken watered soil realistically (`roughness` drops when wet!)
    plot.soilMesh.material.color.setHex(0x8c7768);
    plot.soilMesh.material.roughness = Math.max(0.36, 0.82 - plot.growth * 0.35);

    this._rebuildPlotCropVisual(plot);

    let justRipened = false;
    if (plot.growth >= 0.82 && !plot.ripeNotified) {
      plot.ripeNotified = true;
      justRipened = true;
    }
    return { justRipened, wrongMaterial, plot };
  }

  _rebuildPlotCropVisual(plot) {
    const root = plot.cropRoot;
    while (root.children.length > 0) root.remove(root.children[0]);
    if (!plot.planted) return;

    const g = plot.growth; // 0.2 -> 1.4
    const sc = Math.min(1.25, 0.35 + g * 0.68);

    if (plot.cropKind === 'berry') {
      // Lush blocky green strawberry bush + plump glossy ruby strawberries + tiny white blossoms!
      const bush = new THREE.Mesh(
        new RoundedBoxGeometry(0.74 * sc, 0.42 * sc, 0.74 * sc, 1, 0.05),
        this.materials.matGrassTop
      );
      bush.position.y = 0.21 * sc;
      bush.castShadow = true;
      root.add(bush);

      if (g > 0.42) {
        const berryCount = Math.min(7, 2 + Math.floor((g - 0.30) * 6));
        for (let b = 0; b < berryCount; b++) {
          const ang = (b / Math.max(1, berryCount)) * Math.PI * 2 + plot.index;
          const rad = (b % 2 === 0 ? 0.28 : 0.16) * sc;
          const berry = new THREE.Mesh(
            new RoundedBoxGeometry(0.21 * sc, 0.24 * sc, 0.21 * sc, 1, 0.06),
            this.materials.matBerry
          );
          berry.position.set(Math.cos(ang) * rad, (0.34 + (b % 2) * 0.12) * sc, Math.sin(ang) * rad);
          berry.rotation.z = 0.16;
          berry.castShadow = true;
          root.add(berry);
        }
      }
    } else if (plot.cropKind === 'wheat') {
      const stalkMat = new THREE.MeshStandardMaterial({
        color: g > 0.65 ? 0xdca538 : 0x7da442,
        roughness: 0.72,
      });
      const earMat = new THREE.MeshStandardMaterial({ color: 0xe8b948, roughness: 0.62 });
      for (let sx = -1; sx <= 1; sx++) {
        for (let sz = -1; sz <= 1; sz++) {
          const h = (0.36 + g * 0.58) * (0.86 + ((sx + sz + 2) % 3) * 0.09);
          const stalk = new THREE.Mesh(new RoundedBoxGeometry(0.08, h, 0.08, 1, 0.02), stalkMat);
          stalk.position.set(sx * 0.24, h * 0.5, sz * 0.24);
          stalk.rotation.z = sx * -0.06;
          stalk.castShadow = true;
          root.add(stalk);

          if (g > 0.55) {
            const ear = new THREE.Mesh(new RoundedBoxGeometry(0.13, 0.22, 0.13, 1, 0.03), earMat);
            ear.position.set(sx * 0.26, h + 0.04, sz * 0.24);
            ear.castShadow = true;
            root.add(ear);
          }
        }
      }
    } else if (plot.cropKind === 'pumpkin') {
      const vines = new THREE.Mesh(
        new RoundedBoxGeometry(0.76 * sc, 0.14, 0.76 * sc, 2, 0.03),
        this.materials.matGrassTop
      );
      vines.position.y = 0.07;
      root.add(vines);

      if (g > 0.42) {
        const pScale = Math.min(1.15, (g - 0.3) * 0.95);
        const pump = new THREE.Mesh(
          new RoundedBoxGeometry(0.56 * pScale, 0.46 * pScale, 0.56 * pScale, 3, 0.09),
          new THREE.MeshStandardMaterial({ color: 0xd96b24, roughness: 0.45 })
        );
        pump.position.y = 0.24 * pScale;
        pump.castShadow = true;
        root.add(pump);

        const stem = new THREE.Mesh(
          new RoundedBoxGeometry(0.09, 0.14, 0.09, 1, 0.02),
          this.materials.matWoodSide
        );
        stem.position.y = 0.48 * pScale;
        root.add(stem);
      }
    } else {
      // Cute rock-garden stepping stone + alpine blossoms when player puts stone/wood in garden!
      const rock = new THREE.Mesh(
        new RoundedBoxGeometry(0.56 * sc, 0.38 * sc, 0.56 * sc, 3, 0.05),
        this.materials.matStone
      );
      rock.position.y = 0.19 * sc;
      rock.castShadow = true;
      root.add(rock);

      for (let f = 0; f < 3; f++) {
        const fl = new THREE.Mesh(
          new RoundedBoxGeometry(0.14, 0.14, 0.14, 2, 0.03),
          new THREE.MeshStandardMaterial({ color: f === 1 ? 0xf5d45b : 0xeb849b, roughness: 0.55 })
        );
        fl.position.set((f - 1) * 0.18, 0.42 * sc, (f % 2) * 0.12 - 0.06);
        root.add(fl);
      }
    }
  }

  getRipeCropPositions() {
    return this.gardenPlots
      .filter((p) => p.planted && p.growth >= 0.45)
      .map((p) => new THREE.Vector3(p.x, 0, p.z));
  }

  // ============================================================================
  // SUNSET MAGIC HOUR -> NIGHT HOUSE ILLUMINATION UPDATE
  // ============================================================================
  update(dt, post) {
    const time = performance.now() * 0.001;

    // Pop-in spring on newly placed house blocks
    this.houseGrid.forEach((c) => {
      if (c.popScale < 1.0) {
        c.popScale = Math.min(1.0, c.popScale + dt * 7.5);
        const s = 1.0 + Math.sin(c.popScale * Math.PI) * 0.12;
        c.group.scale.setScalar(c.popScale < 1.0 ? s : 1.0);
      }
    });

    // Signboard gentle settle bounce
    if (this.signBounce > 0) {
      this.signBounce = Math.max(0, this.signBounce - dt * 3.5);
      this.signGroup.scale.setScalar(1.0 + Math.sin(this.signBounce * Math.PI) * 0.10);
    }

    // Supply stockpile gentle hover when selected
    this.supplyItems.forEach((slot) => {
      if (!slot.visible) return;
      const sel = slot.userData.selected ? 1 : 0;
      slot.userData.visual.position.y = THREE.MathUtils.lerp(
        slot.userData.visual.position.y,
        sel * 0.24 + Math.sin(time * 2.4 + slot.userData.bobPhase) * 0.025,
        Math.min(1, dt * 10)
      );
      slot.userData.visual.rotation.y += dt * (sel ? 0.85 : 0.18);
    });

    // Smooth Time-of-Day Lighting Interpolation (0=Day -> 0.48=Magic Hour Sunset -> 1.0=Starry Warm Night!)
    this.timeOfDay = THREE.MathUtils.lerp(this.timeOfDay, this.targetTimeOfDay, Math.min(1, dt * 0.85));
    const t = this.timeOfDay;
    this.skyUniforms.uTime.value = time;

    // Sky & Cloud colors
    const cDayTop = new THREE.Color(0x366fb5);
    const cSunTop = new THREE.Color(0x252e5c);
    const cNitTop = new THREE.Color(0x0b1328);

    const cDayMid = new THREE.Color(0x7eb6e6);
    const cSunMid = new THREE.Color(0xc95a63);
    const cNitMid = new THREE.Color(0x182546);

    const cDayHor = new THREE.Color(0xd7e7f5);
    const cSunHor = new THREE.Color(0xff9f43);
    const cNitHor = new THREE.Color(0x252e48);

    const cCloudDay = new THREE.Color(0xffffff);
    const cCloudSun = new THREE.Color(0xffb470);
    const cCloudNit = new THREE.Color(0x233052);

    if (t < 0.5) {
      const k = t / 0.5;
      this.skyUniforms.uTopColor.value.copy(cDayTop).lerp(cSunTop, k);
      this.skyUniforms.uMidColor.value.copy(cDayMid).lerp(cSunMid, k);
      this.skyUniforms.uHorizonColor.value.copy(cDayHor).lerp(cSunHor, k);
      this.skyUniforms.uCloudColor.value.copy(cCloudDay).lerp(cCloudSun, k);
      this.skyUniforms.uCloudAlpha.value = 0.58 - k * 0.12;
      this.skyUniforms.uStarFade.value = Math.max(0, (k - 0.65) * 0.8);
      this.scene.environment = k < 0.55 ? this.envStates.day : this.envStates.sunset;
    } else {
      const k = (t - 0.5) / 0.5;
      this.skyUniforms.uTopColor.value.copy(cSunTop).lerp(cNitTop, k);
      this.skyUniforms.uMidColor.value.copy(cSunMid).lerp(cNitMid, k);
      this.skyUniforms.uHorizonColor.value.copy(cSunHor).lerp(cNitHor, k);
      this.skyUniforms.uCloudColor.value.copy(cCloudSun).lerp(cCloudNit, k);
      this.skyUniforms.uCloudAlpha.value = 0.46 * (1.0 - k * 0.72);
      this.skyUniforms.uStarFade.value = 0.25 + k * 0.75;
      this.scene.environment = k < 0.5 ? this.envStates.sunset : this.envStates.night;
    }

    // Sun / Sunset / Moon position & color
    const sunAngle = (1 - t) * 1.15 + 0.12;
    this.sunLight.position.set(
      Math.cos(sunAngle) * 10.5,
      Math.max(1.8, Math.sin(sunAngle) * 12.0),
      5.5 + t * 2.0
    );

    // Celestial orb visible arc across upper sky band!
    this.celestialOrb.position.set(-2.8 + t * 5.8, 3.65 + Math.sin(t * Math.PI) * 0.45, -11.5);
    const { core, halo } = this.celestialOrb.userData;
    if (t < 0.38) {
      core.material.color.setHex(0xfff8dc);
      halo.material.color.setHex(0xffe6a3);
      halo.material.opacity = 0.28;
      this.sunLight.color.setHex(0xfff4df);
      this.sunLight.intensity = 2.5 - t * 1.2;
      this.hemiLight.color.setHex(0xcbe2ff);
      this.hemiLight.groundColor.setHex(0x695538);
      this.hemiLight.intensity = 0.85;
      this.scene.environmentIntensity = 0.72;
    } else if (t < 0.75) {
      // Deep Golden-Amber Sunset Magic Hour!
      core.material.color.setHex(0xffb85c);
      halo.material.color.setHex(0xff6f2c);
      halo.material.opacity = 0.42;
      this.sunLight.color.setHex(0xff8e3c);
      this.sunLight.intensity = 2.15 - (t - 0.38) * 3.6;
      this.hemiLight.color.setHex(0xd9846c);
      this.hemiLight.groundColor.setHex(0x473323);
      this.hemiLight.intensity = 0.68;
      this.scene.environmentIntensity = 0.58;
    } else {
      // Cozy Starry Night with soft glowing Moon + warm glowing house windows!
      core.material.color.setHex(0xfff1be);
      halo.material.color.setHex(0x9cb8ff);
      halo.material.opacity = 0.22;
      this.sunLight.color.setHex(0x8da9e0);
      this.sunLight.intensity = 0.48;
      this.hemiLight.color.setHex(0x4c6496);
      this.hemiLight.groundColor.setHex(0x28211a);
      this.hemiLight.intensity = 0.46;
      this.scene.environmentIntensity = 0.36;
    }

    // Warm interior House Window & Lantern Glow (`昼から夜になり家の明かりがともる`)
    const glowFactor = THREE.MathUtils.smoothstep(t, 0.30, 0.82);
    this.hearthMasterLight.intensity = glowFactor * (this.houseGrid.size > 0 ? 3.2 : 0.0);

    for (let i = 0; i < this.houseLights.length; i++) {
      const hl = this.houseLights[i];
      const flicker = 0.93 + 0.07 * Math.sin(time * 5.2 + hl.flickerSeed) * Math.cos(time * 8.7 + hl.flickerSeed);
      const activeGlow = hl.alwaysWarm ? Math.max(0.42, glowFactor) : glowFactor;
      if (!hl.alwaysWarm) {
        hl.mat.color.setHex(0x46525e).lerp(new THREE.Color(0xffffff), activeGlow);
      }
      hl.mat.emissiveIntensity = (0.04 + activeGlow * 2.55) * flicker;
      if (hl.light) {
        hl.light.intensity = activeGlow * 2.5 * flicker;
      }
    }

    if (post) {
      post.material.uniforms.uWarmGlow.value = 0.18 + glowFactor * 0.42;
      post.material.uniforms.uExposure.value = 1.08 + glowFactor * 0.10;
    }
  }
}
