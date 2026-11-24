import * as THREE from '../vendor/three.module.min.js';

// Unified Photorealistic Sunlit World:
// Living Room (warm oak floor, open glass veranda doorway, breezy sheer curtains)
// -> Sunlit Cedar Deck (wetness darkening on splashes!)
// -> Backyard Framed Swimming Pool (custom reflection/refraction/caustics GLSL shader + 3D splash droplets!)

const MAX_RIPPLES = 16;

export class WorldEnvironment {
  constructor(textures) {
    this.group = new THREE.Group();
    this.textures = textures;
    this.ripples = [];
    for (let i = 0; i < MAX_RIPPLES; i++) {
      this.ripples.push(new THREE.Vector4(0, 0, -99, 0)); // x, z, startTime, amp
    }
    this.rippleCursor = 0;
    this.deckWetness = 0.0;
    this.curtainMeshes = [];
    this.signTextures = {};

    this._buildSkyAndGarden();
    this._buildLivingRoomAndVeranda();
    this._buildPoolAndWater();
    this._buildPictorialSignBoard();
    this._buildSplashParticles();
    this._buildAirPuffParticles();
  }

  _buildSkyAndGarden() {
    // Luminous summer horizon dome
    const skyGeo = new THREE.SphereGeometry(42, 32, 20);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uSunDir: { value: new THREE.Vector3(0.42, 0.78, 0.46).normalize() }
      },
      vertexShader: `
        varying vec3 vWorldDir;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldDir = normalize(wp.xyz);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 uSunDir;
        varying vec3 vWorldDir;
        void main() {
          float h = clamp(vWorldDir.y, 0.0, 1.0);
          vec3 zenith = vec3(0.18, 0.54, 0.96);
          vec3 horizon = vec3(0.76, 0.92, 1.0);
          vec3 col = mix(horizon, zenith, pow(h, 0.58));
          float sunAmt = max(0.0, dot(normalize(vWorldDir), uSunDir));
          col += vec3(1.0, 0.96, 0.84) * pow(sunAmt, 36.0) * 0.85;
          gl_FragColor = vec4(col, 1.0);
        }
      `
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    this.group.add(sky);

    // Sunlit green backyard lawn (extends behind living room at -Z)
    const lawnMat = new THREE.MeshStandardMaterial({
      map: this.textures.lawn,
      roughness: 0.88,
      metalness: 0.0
    });
    const lawn = new THREE.Mesh(new THREE.PlaneGeometry(36, 30), lawnMat);
    lawn.rotation.x = -Math.PI / 2;
    lawn.position.set(0, -0.08, -11.5);
    lawn.receiveShadow = true;
    this.group.add(lawn);

    // Garden slatted cedar fence & natural organic multi-foliage garden hedge (not toy spheres!)
    const fenceMat = new THREE.MeshStandardMaterial({ map: this.textures.cedarDeck, color: 0xc89b6e, roughness: 0.78 });
    const fenceBack = new THREE.Mesh(new THREE.BoxGeometry(18.5, 1.95, 0.08), fenceMat);
    fenceBack.position.set(0, 0.88, -14.2);
    fenceBack.receiveShadow = true;
    this.group.add(fenceBack);

    // Organic faceted-leaf summer garden shrubs & small ornamental trees using instanced foliage clusters
    const leafGeo = new THREE.DodecahedronGeometry(0.32, 1);
    const leafMat = new THREE.MeshStandardMaterial({
      color: 0x3b8728,
      roughness: 0.72,
      flatShading: false
    });
    const foliageCount = 90;
    const foliageInst = new THREE.InstancedMesh(leafGeo, leafMat, foliageCount);
    const fDummy = new THREE.Object3D();
    const fCol = new THREE.Color();
    for (let i = 0; i < foliageCount; i++) {
      const gx = -8.2 + (i / foliageCount) * 16.4 + Math.sin(i * 7.3) * 0.25;
      const gy = 0.25 + (i % 4) * 0.28 + Math.abs(Math.cos(i * 3.1)) * 0.35;
      const gz = -13.5 + Math.sin(i * 5.7) * 0.45;
      fDummy.position.set(gx, gy, gz);
      fDummy.rotation.set(i * 1.1, i * 2.3, i * 0.7);
      const s = 0.85 + (i % 3) * 0.35;
      fDummy.scale.set(s * 1.25, s * 0.92, s);
      fDummy.updateMatrix();
      foliageInst.setMatrixAt(i, fDummy.matrix);
      fCol.setHSL(0.28 + (i % 5) * 0.012, 0.52, 0.26 + (i % 4) * 0.055);
      foliageInst.setColorAt(i, fCol);
    }
    foliageInst.instanceMatrix.needsUpdate = true;
    if (foliageInst.instanceColor) foliageInst.instanceColor.needsUpdate = true;
    this.group.add(foliageInst);
  }

  _buildLivingRoomAndVeranda() {
    // Living Room spans z: [-1.8, +6.5], x: [-5.5, +5.5], y = 0.0
    this.roomGroup = new THREE.Group();
    this.group.add(this.roomGroup);

    const oakMat = new THREE.MeshPhysicalMaterial({
      map: this.textures.oakFloor,
      roughness: 0.28,
      clearcoat: 0.35,
      clearcoatRoughness: 0.25
    });
    const roomFloor = new THREE.Mesh(new THREE.PlaneGeometry(12, 8.5), oakMat);
    roomFloor.rotation.x = -Math.PI / 2;
    roomFloor.position.set(0, 0.0, 2.45);
    roomFloor.receiveShadow = true;
    this.roomGroup.add(roomFloor);

    // Sunlit plaster walls framing wide-open garden veranda doorway (doorway opening width = 4.6m: x from -2.3 to +2.3!)
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xfbf8f1, roughness: 0.82 });
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x495057, roughness: 0.35, metalness: 0.45 });

    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(4.2, 4.6, 0.22), wallMat);
    leftWall.position.set(-4.4, 2.3, -1.8);
    leftWall.castShadow = true;
    leftWall.receiveShadow = true;

    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(4.2, 4.6, 0.22), wallMat);
    rightWall.position.set(4.4, 2.3, -1.8);
    rightWall.castShadow = true;
    rightWall.receiveShadow = true;

    const headerWall = new THREE.Mesh(new THREE.BoxGeometry(13.0, 2.2, 0.26), wallMat);
    headerWall.position.set(0, 3.98, -1.8);
    headerWall.castShadow = true;

    // Warm sunlit interior ceiling + veranda overhang soffit (prevents open sky above wall in tall portrait viewports!)
    const ceilingMat = new THREE.MeshStandardMaterial({ color: 0xf7f3eb, roughness: 0.85 });
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(13.0, 9.5), ceilingMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(0, 3.55, 2.8);
    this.roomGroup.add(ceiling);

    // Sliding glass door aluminum track & glass panels slid open to sides
    const track = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.035, 0.14), frameMat);
    track.position.set(0, 0.018, -1.8);

    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xeaf6ff,
      roughness: 0.04,
      transmission: 0.86,
      thickness: 0.05,
      ior: 1.5,
      transparent: true
    });
    [-2.55, 2.55].forEach((gx) => {
      const doorFrame = new THREE.Group();
      doorFrame.position.set(gx, 1.44, -1.72);
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 2.75), glassMat);
      const vBarL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.82, 0.05), frameMat);
      vBarL.position.x = -0.65;
      const vBarR = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.82, 0.05), frameMat);
      vBarR.position.x = 0.65;
      doorFrame.add(pane, vBarL, vBarR);
      this.roomGroup.add(doorFrame);
    });

    // Breezy sheer white summer curtains flanking the open veranda doorway!
    const curtainMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.65,
      transmission: 0.45,
      thickness: 0.02,
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide
    });
    [-2.25, 2.25].forEach((cx, idx) => {
      const cGeo = new THREE.PlaneGeometry(0.85, 2.82, 14, 14);
      const cPos = cGeo.attributes.position;
      for (let i = 0; i < cPos.count; i++) {
        const vx = cPos.getX(i);
        cPos.setZ(i, Math.sin(vx * 22.0) * 0.055);
      }
      cGeo.computeVertexNormals();
      const curtain = new THREE.Mesh(cGeo, curtainMat);
      curtain.position.set(cx, 1.45, -1.60);
      this.roomGroup.add(curtain);
      this.curtainMeshes.push({ mesh: curtain, baseX: cx, side: idx === 0 ? -1 : 1 });
    });

    // Potted indoor summer palm plant (subtle rustle when tapped or when air valve blows!)
    this.plantGroup = new THREE.Group();
    this.plantGroup.position.set(-2.85, 0.0, -0.85);
    const potMat = new THREE.MeshStandardMaterial({ color: 0xe8d8c8, roughness: 0.55 });
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.18, 0.42, 20), potMat);
    pot.position.y = 0.21;
    pot.castShadow = true;
    this.plantGroup.add(pot);
    const palmLeafMat = new THREE.MeshStandardMaterial({ color: 0x3f9142, roughness: 0.48, side: THREE.DoubleSide });
    for (let i = 0; i < 6; i++) {
      const frond = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.78, 5), palmLeafMat);
      frond.scale.set(1.0, 1.0, 0.15);
      const a = (i / 6) * Math.PI * 2;
      frond.position.set(Math.cos(a) * 0.18, 0.62, Math.sin(a) * 0.18);
      frond.rotation.z = -Math.cos(a) * 0.55;
      frond.rotation.x = Math.sin(a) * 0.55;
      frond.castShadow = true;
      this.plantGroup.add(frond);
    }
    this.roomGroup.add(leftWall, rightWall, headerWall, track, this.plantGroup);

    // Sunlit Cedar Wooden Deck outside the doorway: z from -1.8 to -10.8!
    this.deckMat = new THREE.MeshPhysicalMaterial({
      map: this.textures.cedarDeck,
      roughness: 0.68,
      clearcoat: 0.05,
      clearcoatRoughness: 0.08
    });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(11.2, 0.08, 9.2), this.deckMat);
    deck.position.set(0, -0.04, -6.4);
    deck.receiveShadow = true;
    this.group.add(deck);
  }

  _buildPoolAndWater() {
    // Backyard Framed Garden Pool centered at (0, y, -6.35) on the sunlit cedar deck!
    this.poolCenter = new THREE.Vector3(0, 0, -6.35);
    this.poolHalfW = 2.65; // 5.3m wide!
    this.poolHalfD = 1.85; // 3.7m deep front-to-back!
    this.waterSurfaceY = 0.34;
    const poolFloorY = -0.52;

    this.poolGroup = new THREE.Group();
    this.poolGroup.position.copy(this.poolCenter);
    this.group.add(this.poolGroup);

    // Sturdy Realistic Blue-White Vinyl-Liner & White Coping Rim Garden Pool
    const rimMat = new THREE.MeshPhysicalMaterial({
      color: 0xf8fbff,
      roughness: 0.16,
      clearcoat: 0.85,
      clearcoatRoughness: 0.06
    });
    const outerWallMat = new THREE.MeshPhysicalMaterial({
      color: 0x3b8ec2,
      roughness: 0.25,
      clearcoat: 0.55
    });
    const strutMat = new THREE.MeshStandardMaterial({
      color: 0xe9ecef,
      metalness: 0.45,
      roughness: 0.32
    });

    const W = this.poolHalfW * 2;
    const D = this.poolHalfD * 2;
    const wallH = 0.46;
    const wallT = 0.15;

    // 4 Pool Rim Walls above deck
    const frontWall = new THREE.Mesh(new THREE.BoxGeometry(W + wallT * 2, wallH, wallT), outerWallMat);
    frontWall.position.set(0, wallH * 0.5, this.poolHalfD + wallT * 0.5);
    frontWall.castShadow = true;
    frontWall.receiveShadow = true;

    const backWall = new THREE.Mesh(new THREE.BoxGeometry(W + wallT * 2, wallH, wallT), outerWallMat);
    backWall.position.set(0, wallH * 0.5, -this.poolHalfD - wallT * 0.5);
    backWall.castShadow = true;
    backWall.receiveShadow = true;

    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallH, D), outerWallMat);
    leftWall.position.set(-this.poolHalfW - wallT * 0.5, wallH * 0.5, 0);
    leftWall.castShadow = true;

    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallH, D), outerWallMat);
    rightWall.position.set(this.poolHalfW + wallT * 0.5, wallH * 0.5, 0);
    rightWall.castShadow = true;

    // Rounded glossy white coping tubular top rails
    const railFB1 = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, W + 0.28, 20), rimMat);
    railFB1.rotation.z = Math.PI / 2;
    railFB1.position.set(0, wallH, this.poolHalfD + wallT * 0.5);
    const railFB2 = railFB1.clone();
    railFB2.position.z = -this.poolHalfD - wallT * 0.5;

    const railLR1 = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, D + 0.28, 20), rimMat);
    railLR1.rotation.x = Math.PI / 2;
    railLR1.position.set(-this.poolHalfW - wallT * 0.5, wallH, 0);
    const railLR2 = railLR1.clone();
    railLR2.position.x = this.poolHalfW + wallT * 0.5;

    // Support struts around outside of pool frame
    for (let sx = -2.2; sx <= 2.21; sx += 1.1) {
      [1, -1].forEach((sz) => {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.036, wallH + 0.04, 12), strutMat);
        leg.position.set(sx, wallH * 0.48, sz * (this.poolHalfD + wallT + 0.03));
        leg.rotation.x = -sz * 0.12;
        leg.castShadow = true;
        this.poolGroup.add(leg);
      });
    }

    this.poolGroup.add(frontWall, backWall, leftWall, rightWall, railFB1, railFB2, railLR1, railLR2);

    // Custom GLSL Water Surface:
    // Renders interactive ripples, Fresnel sky & sun specular highlights, refracted mosaic pool floor, and animated caustics!
    const waterGeo = new THREE.PlaneGeometry(W, D, 96, 72);
    waterGeo.rotateX(-Math.PI / 2);

    this.waterUniforms = {
      uTime: { value: 0 },
      uSunDir: { value: new THREE.Vector3(0.42, 0.78, 0.46).normalize() },
      uTileMap: { value: this.textures.poolTile },
      uPoolSize: { value: new THREE.Vector2(W, D) },
      uDepth: { value: this.waterSurfaceY - poolFloorY },
      uRipples: { value: this.ripples }
    };

    const waterMat = new THREE.ShaderMaterial({
      uniforms: this.waterUniforms,
      vertexShader: `
        uniform float uTime;
        uniform vec4 uRipples[${MAX_RIPPLES}];
        varying vec3 vWorldPos;
        varying vec3 vLocalPos;
        varying vec2 vUv;
        varying float vWaveH;

        float evalHeight(vec2 p) {
          float h = sin(p.x * 3.1 + uTime * 2.1) * cos(p.y * 2.7 - uTime * 1.6) * 0.014;
          h += sin(p.x * 6.4 - uTime * 3.2 + p.y * 4.5) * 0.006;
          for (int i = 0; i < ${MAX_RIPPLES}; i++) {
            vec4 rp = uRipples[i];
            float age = uTime - rp.z;
            if (age > 0.0 && age < 4.0 && rp.w > 0.001) {
              float d = length(p - rp.xy);
              float waveFront = age * 1.95;
              float env = exp(-abs(d - waveFront) * 3.4) * exp(-age * 1.15);
              h += sin((d - waveFront) * 16.0) * rp.w * env;
            }
          }
          return h;
        }

        void main() {
          vUv = uv;
          vec3 pos = position;
          float h = evalHeight(pos.xz);
          pos.y += h;
          vWaveH = h;
          vLocalPos = pos;
          vec4 wp = modelMatrix * vec4(pos, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uSunDir;
        uniform sampler2D uTileMap;
        uniform vec2 uPoolSize;
        uniform float uDepth;
        uniform vec4 uRipples[${MAX_RIPPLES}];

        varying vec3 vWorldPos;
        varying vec3 vLocalPos;
        varying vec2 vUv;
        varying float vWaveH;

        float evalHeight(vec2 p) {
          float h = sin(p.x * 3.1 + uTime * 2.1) * cos(p.y * 2.7 - uTime * 1.6) * 0.014;
          h += sin(p.x * 6.4 - uTime * 3.2 + p.y * 4.5) * 0.006;
          h += sin(p.x * 13.0 + uTime * 4.1) * cos(p.y * 11.5 - uTime * 3.7) * 0.0025;
          for (int i = 0; i < ${MAX_RIPPLES}; i++) {
            vec4 rp = uRipples[i];
            float age = uTime - rp.z;
            if (age > 0.0 && age < 4.0 && rp.w > 0.001) {
              float d = length(p - rp.xy);
              float waveFront = age * 1.95;
              float env = exp(-abs(d - waveFront) * 3.4) * exp(-age * 1.15);
              h += sin((d - waveFront) * 16.0) * rp.w * env;
            }
          }
          return h;
        }

        // Sharp shimmering dual-layer summer water caustics
        float causticPattern(vec2 uv, float t) {
          vec2 p = uv * 6.28318;
          vec2 i = p;
          float c = 0.0;
          for (int n = 0; n < 3; n++) {
            float fn = float(n + 1);
            i = p + vec2(
              cos(t * 0.9 * fn - i.x) + sin(t * 1.1 * fn + i.y),
              sin(t * 0.85 * fn - i.y) + cos(t * 1.05 * fn + i.x)
            );
            c += 1.0 / max(0.08, length(vec2(p.x / (sin(i.x + t) * 1.4 + 1.8), p.y / (cos(i.y + t) * 1.4 + 1.8))));
          }
          c = pow(c * 0.20, 2.6);
          return clamp(c, 0.0, 2.2);
        }

        void main() {
          float eps = 0.035;
          vec2 p = vLocalPos.xz;
          float hL = evalHeight(p - vec2(eps, 0.0));
          float hR = evalHeight(p + vec2(eps, 0.0));
          float hD = evalHeight(p - vec2(0.0, eps));
          float hU = evalHeight(p + vec2(0.0, eps));
          vec3 N = normalize(vec3(hL - hR, 2.0 * eps, hD - hU));

          vec3 V = normalize(cameraPosition - vWorldPos);
          // Snell refraction into underwater pool bottom
          vec3 R_refr = refract(-V, N, 1.0 / 1.333);
          float distFloor = (uDepth + vWaveH) / max(0.22, -R_refr.y);
          vec2 floorXZ = p + R_refr.xz * distFloor;
          vec2 floorUv = floorXZ / uPoolSize + 0.5;

          // Pool wall shadow & softened underwater mosaic refraction
          vec3 tileCol1 = texture2D(uTileMap, floorUv * 2.0).rgb;
          vec3 tileCol2 = texture2D(uTileMap, floorUv * 2.0 + vec2(0.008, 0.008)).rgb;
          vec3 tileCol = mix((tileCol1 + tileCol2) * 0.5, vec3(0.28, 0.78, 0.90), 0.48);

          // Sunlit underwater caustics projected along sun angle!
          vec2 sunOffset = uSunDir.xz / max(0.3, uSunDir.y) * uDepth * 0.35;
          float caust1 = causticPattern((floorXZ - sunOffset + N.xz * 0.52) * 0.58, uTime * 1.35);
          float caust2 = causticPattern((floorXZ - sunOffset) * 0.88 + 0.37, -uTime * 1.05);
          float caustics = (caust1 * 0.72 + caust2 * 0.62);

          // Realistic summer pool water body scattering + bright golden-cyan caustics!
          vec3 waterBody = vec3(0.08, 0.68, 0.86);
          vec3 underwater = mix(tileCol, waterBody, 0.32) + vec3(0.75, 0.98, 1.0) * caustics * 0.82;

          // Subtle edge AO near pool walls
          vec2 edgeDist = abs(p) / (uPoolSize * 0.5);
          float wallAO = smoothstep(1.03, 0.80, max(edgeDist.x, edgeDist.y));
          underwater *= mix(0.76, 1.0, wallAO);

          // Fresnel sky reflection + blazing midday sun specular sparkles!
          float fresnel = 0.05 + 0.95 * pow(1.0 - max(0.0, dot(N, V)), 4.0);
          vec3 R_refl = reflect(-V, N);
          vec3 skyCol = mix(vec3(0.76, 0.94, 1.0), vec3(0.18, 0.58, 0.98), clamp(R_refl.y, 0.0, 1.0));

          vec3 H = normalize(uSunDir + V);
          float specSharp = pow(max(0.0, dot(N, H)), 320.0) * 7.5;
          float specBroad = pow(max(0.0, dot(N, H)), 32.0) * 0.48;
          // Secondary sun-glint micro-sparkles across ripples
          float sparkle = pow(max(0.0, sin(p.x * 24.0 + uTime * 5.0) * cos(p.y * 22.0 - uTime * 4.3)), 8.0) * 0.55;

          // Foam crest highlight on high splashes/waves
          float foam = smoothstep(0.038, 0.095, abs(vWaveH)) * 0.55;

          vec3 finalCol = mix(underwater, skyCol, clamp(fresnel * 0.88, 0.0, 0.82));
          finalCol += vec3(1.0, 0.99, 0.92) * (specSharp + specBroad + sparkle);
          finalCol = mix(finalCol, vec3(0.98, 1.0, 1.0), foam);

          gl_FragColor = vec4(finalCol, 1.0);
        }
      `
    });

    this.waterMesh = new THREE.Mesh(waterGeo, waterMat);
    this.waterMesh.position.y = this.waterSurfaceY;
    this.poolGroup.add(this.waterMesh);
  }

  _buildPictorialSignBoard() {
    // Natural Wooden Easel Sign Board (1 single pictorial sign per stage, zero words!)
    this.signGroup = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0xba824d, roughness: 0.62 });

    const postL = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 1.28, 12), woodMat);
    postL.position.set(-0.34, 0.60, -0.06);
    postL.rotation.x = 0.10;
    postL.castShadow = true;

    const postR = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 1.28, 12), woodMat);
    postR.position.set(0.34, 0.60, -0.06);
    postR.rotation.x = 0.10;
    postR.castShadow = true;

    const backLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.028, 1.26, 12), woodMat);
    backLeg.position.set(0, 0.58, -0.28);
    backLeg.rotation.x = -0.28;
    backLeg.castShadow = true;

    const boardGeo = new THREE.BoxGeometry(0.92, 0.62, 0.045);
    this.signFrontMat = new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.0 });
    const materials = [woodMat, woodMat, woodMat, woodMat, this.signFrontMat, woodMat];
    this.signBoardMesh = new THREE.Mesh(boardGeo, materials);
    this.signBoardMesh.position.set(0, 0.92, 0.0);
    this.signBoardMesh.rotation.x = -0.08;
    this.signBoardMesh.castShadow = true;

    this.signGroup.add(postL, postR, backLeg, this.signBoardMesh);
    this.group.add(this.signGroup);
  }

  setSignStage(stage, createSignFn) {
    if (!this.signTextures[stage]) {
      this.signTextures[stage] = createSignFn(stage);
    }
    this.signFrontMat.map = this.signTextures[stage];
    this.signFrontMat.needsUpdate = true;

    // Position the single pictorial sign board naturally in view for each stage
    if (stage === 0) {
      this.signGroup.position.set(-1.95, 0.0, 0.25);
      this.signGroup.rotation.y = 0.42;
      this.signGroup.scale.setScalar(0.92);
    } else if (stage === 1) {
      this.signGroup.position.set(-2.05, 0.0, -0.55);
      this.signGroup.rotation.y = 0.38;
      this.signGroup.scale.setScalar(0.95);
    } else if (stage === 2) {
      this.signGroup.position.set(-2.20, 0.0, 0.45);
      this.signGroup.rotation.y = 0.46;
      this.signGroup.scale.setScalar(0.95);
    } else {
      this.signGroup.position.set(-3.05, 0.0, -7.25);
      this.signGroup.rotation.y = 0.42;
      this.signGroup.scale.setScalar(1.05);
    }
  }

  _buildSplashParticles() {
    // Instanced 3D Sunlit Glistening Water Droplets + Expanding Frothy Whitewater Rings
    this.maxDrops = 280;
    const dropGeo = new THREE.SphereGeometry(0.044, 10, 8);
    dropGeo.scale(0.85, 1.45, 0.85);
    const dropMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      emissive: 0xb8f2ff,
      emissiveIntensity: 0.42,
      roughness: 0.02,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.01,
      transparent: true,
      opacity: 0.90
    });

    this.dropMesh = new THREE.InstancedMesh(dropGeo, dropMat, this.maxDrops);
    this.dropMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.group.add(this.dropMesh);

    this.drops = [];
    const zeroMat = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < this.maxDrops; i++) {
      this.drops.push({
        active: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        scale: 1,
        life: 0
      });
      this.dropMesh.setMatrixAt(i, zeroMat);
    }
    this.dropCursor = 0;

    // Expanding surface splash rings
    this.foamRings = [];
    const ringGeo = new THREE.RingGeometry(0.22, 0.34, 32);
    ringGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 10; i++) {
      const rMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        depthWrite: false
      });
      const rMesh = new THREE.Mesh(ringGeo, rMat);
      rMesh.visible = false;
      this.group.add(rMesh);
      this.foamRings.push({ mesh: rMesh, mat: rMat, age: 99, maxR: 1 });
    }
    this.ringCursor = 0;
  }

  _buildAirPuffParticles() {
    this.maxPuffs = 80;
    const puffGeo = new THREE.SphereGeometry(0.045, 10, 8);
    const puffMat = new THREE.MeshBasicMaterial({
      color: 0xf1f9ff,
      transparent: true,
      opacity: 0.38,
      depthWrite: false
    });
    this.puffMesh = new THREE.InstancedMesh(puffGeo, puffMat, this.maxPuffs);
    this.puffMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.group.add(this.puffMesh);

    this.puffs = [];
    const zeroMat = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < this.maxPuffs; i++) {
      this.puffs.push({ active: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), life: 0, maxLife: 0.5 });
      this.puffMesh.setMatrixAt(i, zeroMat);
    }
    this.puffCursor = 0;
  }

  spawnAirJet(originWorld, dirWorld, count = 8, speed = 2.4) {
    for (let i = 0; i < count; i++) {
      const p = this.puffs[this.puffCursor];
      this.puffCursor = (this.puffCursor + 1) % this.maxPuffs;
      p.active = true;
      p.pos.copy(originWorld);
      p.vel.copy(dirWorld).multiplyScalar(speed * (0.7 + Math.random() * 0.6));
      p.vel.x += (Math.random() - 0.5) * 0.9;
      p.vel.y += (Math.random() - 0.5) * 0.7;
      p.vel.z += (Math.random() - 0.5) * 0.9;
      p.life = 0;
      p.maxLife = 0.35 + Math.random() * 0.30;
    }
  }

  addWaterRipple(worldX, worldZ, amp = 0.06, nowSec = 0) {
    const localX = worldX - this.poolCenter.x;
    const localZ = worldZ - this.poolCenter.z;
    if (Math.abs(localX) > this.poolHalfW + 0.3 || Math.abs(localZ) > this.poolHalfD + 0.3) return;

    const r = this.ripples[this.rippleCursor];
    this.rippleCursor = (this.rippleCursor + 1) % MAX_RIPPLES;
    r.set(localX, localZ, nowSec, Math.min(0.16, amp));
  }

  spawnWaterSplash(worldX, worldZ, intensity = 0.8, nowSec = 0) {
    this.addWaterRipple(worldX, worldZ, 0.045 + intensity * 0.075, nowSec);

    // Increase deck wetness when big splashes slosh over pool rim!
    if (intensity > 0.55) {
      this.deckWetness = Math.min(1.0, this.deckWetness + intensity * 0.22);
    }

    // Whitewater surface ring
    const ring = this.foamRings[this.ringCursor];
    this.ringCursor = (this.ringCursor + 1) % this.foamRings.length;
    ring.age = 0;
    ring.maxR = 0.8 + intensity * 1.45;
    ring.mesh.position.set(worldX, this.waterSurfaceY + 0.015, worldZ);
    ring.mesh.visible = true;

    // 3D Glistening Water Droplets (dramatic crown spray + high sparkling arcs!)
    const count = Math.min(95, Math.floor(22 + intensity * 56));
    for (let i = 0; i < count; i++) {
      const d = this.drops[this.dropCursor];
      this.dropCursor = (this.dropCursor + 1) % this.maxDrops;
      d.active = true;
      const ang = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
      const rad = 0.38 + Math.random() * (0.35 + intensity * 0.38);
      d.pos.set(worldX + Math.cos(ang) * rad, this.waterSurfaceY + 0.08 + Math.random() * 0.12, worldZ + Math.sin(ang) * rad);
      const outSpeed = (0.85 + Math.random() * 2.3) * (0.65 + intensity * 0.65);
      d.vel.set(
        Math.cos(ang) * outSpeed,
        (2.6 + Math.random() * 3.8) * (0.62 + intensity * 0.72),
        Math.sin(ang) * outSpeed
      );
      d.scale = 0.85 + Math.random() * 1.35;
      d.life = 0;
    }
  }

  // Approximate wave height at world (x, z) so floats bob synchronously with ripples
  sampleWaveHeight(worldX, worldZ, nowSec) {
    const px = worldX - this.poolCenter.x;
    const pz = worldZ - this.poolCenter.z;
    let h = Math.sin(px * 3.1 + nowSec * 2.1) * Math.cos(pz * 2.7 - nowSec * 1.6) * 0.014;
    for (let i = 0; i < MAX_RIPPLES; i++) {
      const rp = this.ripples[i];
      const age = nowSec - rp.z;
      if (age > 0 && age < 4.0 && rp.w > 0.001) {
        const dx = px - rp.x;
        const dz = pz - rp.y;
        const d = Math.sqrt(dx * dx + dz * dz);
        const wf = age * 1.95;
        const env = Math.exp(-Math.abs(d - wf) * 3.4) * Math.exp(-age * 1.15);
        h += Math.sin((d - wf) * 16.0) * rp.w * env;
      }
    }
    return this.waterSurfaceY + h;
  }

  update(dt, elapsed, airWindBoost = 0) {
    this.waterUniforms.uTime.value = elapsed;

    // Gentle summer breeze + air-release gust on curtains & indoor palm!
    const gust = 1.0 + airWindBoost * 3.5;
    for (const c of this.curtainMeshes) {
      c.mesh.rotation.z = c.side * (0.04 + Math.sin(elapsed * 1.8 + c.side) * 0.025 * gust);
      c.mesh.rotation.y = Math.sin(elapsed * 1.3) * 0.06 * gust;
    }
    if (this.plantGroup) {
      this.plantGroup.rotation.z = Math.sin(elapsed * 2.4) * 0.018 * gust;
    }

    // Wet cedar deck specular sheen (slowly dries in summer sun, wets again on big splashes!)
    this.deckWetness = Math.max(0, this.deckWetness - dt * 0.025);
    this.deckMat.roughness = THREE.MathUtils.lerp(0.68, 0.09, this.deckWetness);
    this.deckMat.clearcoat = THREE.MathUtils.lerp(0.05, 0.92, this.deckWetness);
    const wetTint = THREE.MathUtils.lerp(1.0, 0.72, this.deckWetness);
    this.deckMat.color.setRGB(wetTint, wetTint * 0.98, wetTint * 0.95);

    // Update 3D water droplets
    const dummy = new THREE.Object3D();
    let dropsDirty = false;
    for (let i = 0; i < this.maxDrops; i++) {
      const d = this.drops[i];
      if (!d.active) continue;
      dropsDirty = true;
      d.life += dt;
      d.vel.y -= 9.8 * dt;
      d.pos.addScaledVector(d.vel, dt);

      const inPool = Math.abs(d.pos.x - this.poolCenter.x) < this.poolHalfW && Math.abs(d.pos.z - this.poolCenter.z) < this.poolHalfD;
      const floorY = inPool ? this.waterSurfaceY : 0.01;
      if (d.pos.y < floorY || d.life > 1.4) {
        d.active = false;
        dummy.scale.setScalar(0);
      } else {
        dummy.position.copy(d.pos);
        const speed = d.vel.length();
        dummy.scale.set(d.scale, d.scale * (1.0 + speed * 0.18), d.scale);
        if (speed > 0.05) {
          dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.vel.clone().normalize());
        }
      }
      dummy.updateMatrix();
      this.dropMesh.setMatrixAt(i, dummy.matrix);
    }
    if (dropsDirty) this.dropMesh.instanceMatrix.needsUpdate = true;

    // Update whitewater surface rings
    for (const r of this.foamRings) {
      if (r.age >= 1.1) continue;
      r.age += dt;
      if (r.age >= 1.1) {
        r.mesh.visible = false;
      } else {
        const t = r.age / 1.1;
        const s = 0.4 + t * r.maxR * 2.2;
        r.mesh.scale.setScalar(s);
        r.mat.opacity = (1.0 - t) * 0.65;
      }
    }

    // Update air puff particles
    let puffsDirty = false;
    for (let i = 0; i < this.maxPuffs; i++) {
      const p = this.puffs[i];
      if (!p.active) continue;
      puffsDirty = true;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        dummy.scale.setScalar(0);
      } else {
        p.pos.addScaledVector(p.vel, dt);
        p.vel.multiplyScalar(Math.pow(0.25, dt));
        const t = p.life / p.maxLife;
        dummy.position.copy(p.pos);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar((0.5 + t * 1.9) * (1.0 - t));
      }
      dummy.updateMatrix();
      this.puffMesh.setMatrixAt(i, dummy.matrix);
    }
    if (puffsDirty) this.puffMesh.instanceMatrix.needsUpdate = true;
  }
}
