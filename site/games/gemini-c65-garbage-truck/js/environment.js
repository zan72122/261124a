import * as THREE from '../vendor/three.module.min.js';

export class MorningStreetEnvironment {
  constructor(scene, renderer, textures) {
    this.scene = scene;
    this.renderer = renderer;
    this.textures = textures;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.wetnessBoost = 0.0;
    this.rainbowAlpha = 0.0;
    this.time = 0;

    this._setupLightingAndSky();
    this._setupPlanarReflection();
    this._buildRoadAndSidewalk();
    this._buildStreetArchitecture();
    this._buildPictorialSignboard();
    this._buildWaterHoseAndSpray();
    this._buildMorningRainbow();
  }

  _setupLightingAndSky() {
    // Low Early-Morning Golden Sun from Back-Left (-X, -Z, low +Y) -> casts dramatic LONG DIAGONAL SHADOWS forward-right across the wet foreground street!
    const sunDir = new THREE.Vector3(-0.86, 0.18, -0.46).normalize();

    const skyGeo = new THREE.SphereGeometry(85, 40, 24);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uSunDir: { value: sunDir },
      },
      vertexShader: `
        varying vec3 vWorldDir;
        void main() {
          vWorldDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vWorldDir;
        uniform vec3 uSunDir;
        void main() {
          vec3 d = normalize(vWorldDir);
          float h = clamp(d.y, 0.0, 1.0);
          vec3 zenith = vec3(0.14, 0.27, 0.49);
          vec3 mid = vec3(0.45, 0.60, 0.78);
          vec3 horizon = vec3(1.02, 0.72, 0.44);
          vec3 col = mix(horizon, mid, pow(h, 0.44));
          col = mix(col, zenith, pow(h, 1.35));

          float sunAmt = max(dot(d, uSunDir), 0.0);
          col += vec3(1.15, 0.68, 0.30) * pow(sunAmt, 6.0) * 0.72;
          col += vec3(2.1, 1.5, 0.95) * pow(sunAmt, 90.0);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    this.skyDome = new THREE.Mesh(skyGeo, skyMat);
    this.skyDome.layers.enable(1);
    this.scene.add(this.skyDome);

    this.scene.fog = new THREE.FogExp2(0xc8baa4, 0.014);

    // Golden-Hour Slanted Dawn Sun (~10.5° low elevation) casting long crisp diagonal shadows across the wet foreground pavement!
    this.sunLight = new THREE.DirectionalLight(0xffb869, 4.65);
    this.sunLight.position.set(-14.5, 2.85, -3.6);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 1024;
    this.sunLight.shadow.mapSize.height = 1024;
    this.sunLight.shadow.camera.near = 2.0;
    this.sunLight.shadow.camera.far = 36.0;
    this.sunLight.shadow.camera.left = -6.2;
    this.sunLight.shadow.camera.right = 7.2;
    this.sunLight.shadow.camera.top = 5.6;
    this.sunLight.shadow.camera.bottom = -4.6;
    this.sunLight.shadow.bias = -0.0004;
    this.sunLight.shadow.normalBias = 0.014;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);
    this.sunLight.target.position.set(0.6, 0.4, 1.6);

    // Cool dawn sky fill so long shadows have authentic atmospheric blue-slate depth!
    this.hemiLight = new THREE.HemisphereLight(0x6d97cc, 0x1d1f24, 0.56);
    this.scene.add(this.hemiLight);

    // Gentle warm dawn bounce from front-left so faces & hopper steel remain luminous and expressive
    this.rimFill = new THREE.DirectionalLight(0xffdfba, 0.72);
    this.rimFill.position.set(-5.5, 2.8, 7.5);
    this.scene.add(this.rimFill);
  }

  _setupPlanarReflection() {
    // 384x384 half-float selective layer reflection target for locked 60fps on iPhone/iPad!
    this.reflectRT = new THREE.WebGLRenderTarget(384, 384, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      type: THREE.HalfFloatType,
      depthBuffer: true,
    });
    this.reflectCam = new THREE.PerspectiveCamera();
    this.reflectCam.layers.set(1); // Only reflect Layer 1 hero objects & sky!
    this.reflectMatrix = new THREE.Matrix4();
    this.clipPlane = new THREE.Vector4();
    this.qVec = new THREE.Vector4();
  }

  _buildRoadAndSidewalk() {
    const { asphalt, concrete } = this.textures;

    asphalt.map.repeat.set(5.5, 5.5);
    asphalt.normalMap.repeat.set(5.5, 5.5);
    asphalt.roughnessMap.repeat.set(5.5, 5.5);

    const roadGeo = new THREE.PlaneGeometry(30, 28);
    const roadMat = new THREE.MeshStandardMaterial({
      map: asphalt.map,
      normalMap: asphalt.normalMap,
      normalScale: new THREE.Vector2(1.1, 1.1),
      roughnessMap: asphalt.roughnessMap,
      roughness: 0.86,
      metalness: 0.08,
      envMapIntensity: 1.55,
    });
    this.roadMesh = new THREE.Mesh(roadGeo, roadMat);
    this.roadMesh.rotation.x = -Math.PI / 2;
    this.roadMesh.position.set(0, 0, 1.0);
    this.roadMesh.receiveShadow = true;
    this.group.add(this.roadMesh);

    // Real-Time Wet Puddle Water Film across the foreground & street (reflects Garbage Truck, Dad, Crates, and Dawn Sky!)
    const puddleGeo = new THREE.PlaneGeometry(20, 18);
    this.puddleUniforms = {
      tReflection: { value: this.reflectRT.texture },
      tRoughness: { value: asphalt.roughnessMap },
      tNormal: { value: asphalt.normalMap },
      uTextureMatrix: { value: new THREE.Matrix4() },
      uTime: { value: 0 },
      uWetnessBoost: { value: 0.0 },
    };

    this.puddleMesh = new THREE.Mesh(
      puddleGeo,
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: this.puddleUniforms,
        vertexShader: `
          uniform mat4 uTextureMatrix;
          varying vec4 vProjCoord;
          varying vec2 vUvTiled;
          varying vec3 vWorldPos;
          void main() {
            vUvTiled = uv * 3.8;
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vWorldPos = wp.xyz;
            vProjCoord = uTextureMatrix * wp;
            gl_Position = projectionMatrix * viewMatrix * wp;
          }
        `,
        fragmentShader: `
          uniform sampler2D tReflection;
          uniform sampler2D tRoughness;
          uniform sampler2D tNormal;
          uniform float uTime;
          uniform float uWetnessBoost;
          varying vec4 vProjCoord;
          varying vec2 vUvTiled;
          varying vec3 vWorldPos;

          void main() {
            float rSample = texture2D(tRoughness, vUvTiled).r;
            // Distinct organic rainwater pools interspersed with golden-sunlit damp coarse asphalt so long shadows & mirror puddles both shine!
            float p1 = smoothstep(1.32, 0.52, length((vWorldPos.xz - vec2(-0.42, 2.68)) * vec2(0.72, 1.25)));
            float p2 = smoothstep(1.22, 0.42, length((vWorldPos.xz - vec2(1.08, 1.55)) * vec2(0.88, 1.12)));
            float p3 = smoothstep(0.95, 0.32, length((vWorldPos.xz - vec2(0.45, 3.35)) * vec2(0.80, 1.25)));

            float naturalPuddle = clamp((0.30 - rSample) * 3.5, 0.0, 1.0);
            float puddleMask = max(naturalPuddle, max(p1, max(p2, p3)));
            puddleMask = clamp(puddleMask + uWetnessBoost * 0.55, 0.0, 1.0);

            if (puddleMask < 0.02) discard;

            vec3 viewDir = normalize(cameraPosition - vWorldPos);
            float ndotv = clamp(viewDir.y, 0.02, 1.0);
            float fresnel = 0.06 + 0.88 * pow(1.0 - ndotv, 3.2);

            vec2 ripple = vec2(
              sin(vWorldPos.x * 16.0 + uTime * 1.9) * cos(vWorldPos.z * 13.0 - uTime * 1.4),
              cos(vWorldPos.x * 14.0 - uTime * 1.5) * sin(vWorldPos.z * 17.0 + uTime * 2.0)
            ) * 0.0028;
            vec3 nTex = texture2D(tNormal, vUvTiled).xyz * 2.0 - 1.0;
            vec2 edgeDistort = nTex.xy * (1.0 - puddleMask * 0.90) * 0.028;

            vec2 projUv = vProjCoord.xy / max(0.001, vProjCoord.w);
            projUv = clamp(projUv + ripple + edgeDistort, 0.002, 0.998);

            vec3 reflCol = texture2D(tReflection, projUv).rgb * vec3(0.96, 0.98, 1.04);
            float alpha = clamp(puddleMask * (0.16 + fresnel * 0.64), 0.0, 0.82);
            gl_FragColor = vec4(reflCol, alpha);
          }
        `,
      })
    );
    this.puddleMesh.rotation.x = -Math.PI / 2;
    this.puddleMesh.position.set(0, 0.003, 1.3);
    this.puddleMesh.renderOrder = 1;
    this.group.add(this.puddleMesh);

    // Weathered White Asphalt Side Line & Concrete Gutter Apron
    const lineMat = new THREE.MeshStandardMaterial({
      color: 0xd8dce2,
      roughness: 0.48,
      normalMap: asphalt.normalMap,
    });
    const sideLine = new THREE.Mesh(new THREE.PlaneGeometry(26, 0.12), lineMat);
    sideLine.rotation.x = -Math.PI / 2;
    sideLine.position.set(0, 0.0035, -2.35);
    sideLine.receiveShadow = true;
    this.group.add(sideLine);

    // Concrete Curb Stones (縁石)
    const curbMap = concrete.map.clone();
    curbMap.repeat.set(9, 0.5);
    curbMap.needsUpdate = true;
    const curbNorm = concrete.normalMap.clone();
    curbNorm.repeat.set(9, 0.5);
    curbNorm.needsUpdate = true;
    const curbMat = new THREE.MeshStandardMaterial({
      map: curbMap,
      normalMap: curbNorm,
      roughness: 0.66,
      metalness: 0.04,
    });

    const curb = new THREE.Mesh(new THREE.BoxGeometry(24, 0.14, 0.22), curbMat);
    curb.position.set(0, 0.07, -2.65);
    curb.castShadow = true;
    curb.receiveShadow = true;
    this.group.add(curb);

    const walkMap = concrete.map.clone();
    walkMap.repeat.set(8, 3);
    walkMap.needsUpdate = true;
    const walkMat = new THREE.MeshStandardMaterial({
      color: 0xaab0b8,
      map: walkMap,
      normalMap: concrete.normalMap,
      roughness: 0.72,
    });
    const sidewalk = new THREE.Mesh(new THREE.BoxGeometry(24, 0.13, 5.5), walkMat);
    sidewalk.position.set(0, 0.065, -5.5);
    sidewalk.receiveShadow = true;
    this.group.add(sidewalk);

    // Realistic Cast-Iron Circular Manhole Cover in Foreground Right Street (waffle grip pattern, zero text!)
    const ironMat = new THREE.MeshStandardMaterial({
      color: 0x2c3138,
      metalness: 0.78,
      roughness: 0.38,
      normalMap: asphalt.normalMap,
    });
    const manhole = new THREE.Group();
    const outerRing = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.37, 0.012, 28), ironMat);
    outerRing.receiveShadow = true;
    manhole.add(outerRing);
    const innerDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.015, 24), ironMat);
    innerDisc.receiveShadow = true;
    manhole.add(innerDisc);
    for (let r = 0.1; r <= 0.26; r += 0.08) {
      const groove = new THREE.Mesh(
        new THREE.TorusGeometry(r, 0.007, 6, 24),
        new THREE.MeshStandardMaterial({ color: 0x16191d, metalness: 0.85, roughness: 0.3 })
      );
      groove.rotation.x = Math.PI / 2;
      groove.position.y = 0.008;
      manhole.add(groove);
    }
    manhole.position.set(1.55, 0.002, 2.72);
    this.group.add(manhole);

    // Storm Drain Grate along curb
    const grateGroup = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.018, 0.40), ironMat);
    grateGroup.add(frame);
    for (let i = -5; i <= 5; i++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.35), ironMat);
      bar.position.set(i * 0.052, 0.008, 0);
      grateGroup.add(bar);
    }
    grateGroup.position.set(1.65, 0.002, -2.28);
    this.group.add(grateGroup);
  }

  _buildStreetArchitecture() {
    const { concrete, paintNormal } = this.textures;

    // Photorealistic Weathered Japanese Concrete Block Wall (ブロック塀) along the residential street
    const wallMap = concrete.map.clone();
    wallMap.repeat.set(7, 1.4);
    wallMap.needsUpdate = true;
    const wallNorm = concrete.normalMap.clone();
    wallNorm.repeat.set(7, 1.4);
    wallNorm.needsUpdate = true;

    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xc2bdb4,
      map: wallMap,
      normalMap: wallNorm,
      roughness: 0.82,
    });
    const wall = new THREE.Mesh(new THREE.BoxGeometry(24, 1.45, 0.24), wallMat);
    wall.position.set(0, 0.78, -5.85);
    wall.castShadow = true;
    wall.receiveShadow = true;
    this.group.add(wall);

    // Concrete coping ledge + dark bronze aluminum privacy fence slats above wall
    const coping = new THREE.Mesh(
      new THREE.BoxGeometry(24, 0.07, 0.30),
      new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.65 })
    );
    coping.position.set(0, 1.53, -5.85);
    this.group.add(coping);

    const bronzeAlumMat = new THREE.MeshStandardMaterial({
      color: 0x3a322d,
      metalness: 0.68,
      roughness: 0.36,
    });
    for (let s = 0; s < 4; s++) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(24, 0.065, 0.04), bronzeAlumMat);
      slat.position.set(0, 1.66 + s * 0.11, -5.85);
      slat.castShadow = true;
      this.group.add(slat);
    }

    // Realistic Japanese Residential Facades & Corrugated Steel Garage Shutter behind the wall (NO toy cone roofs!)
    const stuccoMat1 = new THREE.MeshStandardMaterial({
      color: 0xded8ce,
      normalMap: concrete.normalMap,
      normalScale: new THREE.Vector2(0.35, 0.35),
      roughness: 0.78,
    });
    const stuccoMat2 = new THREE.MeshStandardMaterial({
      color: 0xc9d1d9,
      normalMap: concrete.normalMap,
      normalScale: new THREE.Vector2(0.35, 0.35),
      roughness: 0.75,
    });
    const shutterMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.72,
      roughness: 0.32,
      normalMap: paintNormal,
    });

    // Left modern two-story home with flat overhanging eaves & aluminum window frames
    const houseL = new THREE.Group();
    const bldgL = new THREE.Mesh(new THREE.BoxGeometry(6.8, 4.6, 4.5), stuccoMat1);
    bldgL.position.y = 2.3;
    bldgL.castShadow = true;
    bldgL.receiveShadow = true;
    houseL.add(bldgL);
    const eaveL = new THREE.Mesh(new THREE.BoxGeometry(7.3, 0.22, 5.0), bronzeAlumMat);
    eaveL.position.y = 4.68;
    houseL.add(eaveL);
    houseL.position.set(-4.8, 0, -9.2);
    this.group.add(houseL);

    // Right home with corrugated metal garage shutter & sunlit balcony rail
    const houseR = new THREE.Group();
    const bldgR = new THREE.Mesh(new THREE.BoxGeometry(7.2, 4.8, 4.6), stuccoMat2);
    bldgR.position.y = 2.4;
    bldgR.castShadow = true;
    bldgR.receiveShadow = true;
    houseR.add(bldgR);
    const eaveR = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.24, 5.1), bronzeAlumMat);
    eaveR.position.y = 4.9;
    houseR.add(eaveR);

    const shutter = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.2), shutterMat);
    shutter.position.set(-1.1, 1.3, 2.32);
    houseR.add(shutter);

    // Multi-pane window reflecting dawn sky
    const winFrame = new THREE.Mesh(new THREE.BoxGeometry(1.65, 1.15, 0.08), bronzeAlumMat);
    winFrame.position.set(1.4, 3.25, 2.31);
    houseR.add(winFrame);
    const winGlass = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 1.0),
      new THREE.MeshPhysicalMaterial({ color: 0x6488ad, metalness: 0.2, roughness: 0.05, clearcoat: 1.0 })
    );
    winGlass.position.set(1.4, 3.25, 2.36);
    houseR.add(winGlass);

    houseR.position.set(4.6, 0, -9.4);
    this.group.add(houseR);

    // Realistic Dappled Leafy Street Trees catching golden dawn rim light!
    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x453427,
      roughness: 0.90,
      normalMap: concrete.normalMap,
    });
    const folTex = this.textures.foliage;
    folTex.map.repeat.set(2, 2);
    folTex.normalMap.repeat.set(2, 2);
    const canopyMat = new THREE.MeshStandardMaterial({
      map: folTex.map,
      normalMap: folTex.normalMap,
      normalScale: new THREE.Vector2(1.1, 1.1),
      roughness: 0.78,
    });

    [-3.6, 0.9, 4.3].forEach((tx, idx) => {
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.16, 2.5, 10), trunkMat);
      trunk.position.y = 1.25;
      trunk.castShadow = true;
      tree.add(trunk);

      for (let c = 0; c < 8; c++) {
        const a = (c / 8) * Math.PI * 2;
        const puffGeo = new THREE.DodecahedronGeometry(0.58 + (c % 3) * 0.14, 2);
        // Organic irregular leaf clump displacement
        const pArr = puffGeo.attributes.position.array;
        for (let k = 0; k < pArr.length; k += 3) {
          const n = 1.0 + Math.sin(pArr[k] * 7.0 + c) * Math.cos(pArr[k + 1] * 6.0) * 0.16;
          pArr[k] *= n;
          pArr[k + 1] *= n * 0.85;
          pArr[k + 2] *= n;
        }
        puffGeo.computeVertexNormals();
        const puff = new THREE.Mesh(puffGeo, canopyMat);
        puff.position.set(Math.cos(a) * 0.52, 2.68 + (c % 3) * 0.24, Math.sin(a) * 0.44);
        puff.castShadow = true;
        puff.receiveShadow = true;
        tree.add(puff);
      }
      tree.position.set(tx, 0, -6.4 - (idx % 2) * 0.5);
      this.group.add(tree);
    });

    // Concrete Utility Pole + Crossarm + Overhead Wires
    const poleMat = new THREE.MeshStandardMaterial({
      color: 0x8b929a,
      roughness: 0.72,
      normalMap: concrete.normalMap,
    });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.18, 7.8, 14), poleMat);
    pole.position.set(-3.85, 3.9, -2.85);
    pole.castShadow = true;
    pole.receiveShadow = true;
    this.group.add(pole);

    // Roadside Brick Planter Beds (for Scene 3 blooming flowers)
    this.planterBeds = [];
    const planterPositions = [
      { x: -3.1, z: -2.35, w: 2.2, d: 0.56 },
      { x: 2.9, z: -2.35, w: 2.4, d: 0.56 },
    ];
    const soilMat = new THREE.MeshStandardMaterial({
      color: 0x362419,
      roughness: 0.94,
      normalMap: this.textures.asphalt.normalMap,
    });
    const brickMat = new THREE.MeshStandardMaterial({
      color: 0x8c523e,
      roughness: 0.76,
      normalMap: concrete.normalMap,
    });

    planterPositions.forEach((p) => {
      const bed = new THREE.Group();
      const rim = new THREE.Mesh(new THREE.BoxGeometry(p.w, 0.24, p.d), brickMat);
      rim.position.y = 0.12;
      rim.castShadow = true;
      rim.receiveShadow = true;
      bed.add(rim);

      const soil = new THREE.Mesh(new THREE.BoxGeometry(p.w - 0.12, 0.25, p.d - 0.12), soilMat);
      soil.position.y = 0.13;
      soil.receiveShadow = true;
      soil.userData = { isPlanterSoil: true };
      bed.add(soil);

      bed.position.set(p.x, 0.02, p.z);
      this.group.add(bed);
      this.planterBeds.push({ group: bed, soil, x: p.x, z: p.z, w: p.w, d: p.d });
    });
  }

  _buildPictorialSignboard() {
    // 1 Physical Pictorial Signboard standing clearly on the right sidewalk edge!
    this.signboardGroup = new THREE.Group();

    const postMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.88,
      roughness: 0.24,
    });
    [-0.36, 0.36].forEach((px) => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.028, 1.56, 12), postMat);
      post.position.set(px, 0.78, 0);
      post.castShadow = true;
      this.signboardGroup.add(post);
    });

    const frameMesh = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.88, 0.045), postMat);
    frameMesh.position.set(0, 1.15, 0);
    frameMesh.castShadow = true;
    this.signboardGroup.add(frameMesh);

    const faceMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.81, 0.83),
      new THREE.MeshStandardMaterial({
        map: this.textures.signboard,
        roughness: 0.30,
        metalness: 0.10,
      })
    );
    faceMesh.position.set(0, 1.15, 0.025);
    faceMesh.userData = { interactType: 'signboard' };
    this.signboardGroup.add(faceMesh);
    this.signboardFace = faceMesh;

    this.signboardGroup.position.set(2.18, 0.0, 0.25);
    this.signboardGroup.rotation.y = -0.48;
    this.group.add(this.signboardGroup);
  }

  _buildWaterHoseAndSpray() {
    this.hoseGroup = new THREE.Group();
    const hoseMat = new THREE.MeshStandardMaterial({
      color: 0x0f766e,
      roughness: 0.42,
      metalness: 0.1,
    });
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xd99b26,
      metalness: 0.88,
      roughness: 0.20,
    });

    const coil = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.024, 10, 28), hoseMat);
    coil.rotation.x = Math.PI / 2;
    coil.position.y = 0.028;
    coil.castShadow = true;
    this.hoseGroup.add(coil);

    this.nozzleMesh = new THREE.Group();
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.036, 0.17, 12), hoseMat);
    grip.rotation.z = Math.PI / 3;
    this.nozzleMesh.add(grip);
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.03, 0.11, 12), brassMat);
    tip.rotation.z = Math.PI / 3;
    tip.position.set(-0.10, 0.06, 0);
    this.nozzleMesh.add(tip);

    const hit = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 8, 8),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    this.nozzleMesh.add(hit);
    hit.userData = { interactType: 'hose' };

    this.nozzleMesh.position.set(-0.04, 0.11, 0.08);
    this.hoseGroup.add(this.nozzleMesh);
    this.hoseGroup.position.set(1.88, 0.0, 2.05);
    this.group.add(this.hoseGroup);

    const dropCount = 90;
    const dropGeo = new THREE.BufferGeometry();
    this.dropPositions = new Float32Array(dropCount * 3);
    this.dropVelocities = [];
    for (let i = 0; i < dropCount; i++) {
      this.dropPositions[i * 3 + 1] = -10;
      this.dropVelocities.push({ x: 0, y: 0, z: 0, life: 0 });
    }
    dropGeo.setAttribute('position', new THREE.BufferAttribute(this.dropPositions, 3));
    const dropMat = new THREE.PointsMaterial({
      color: 0xe0f2fe,
      size: 0.06,
      transparent: true,
      opacity: 0.82,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.sprayPoints = new THREE.Points(dropGeo, dropMat);
    this.scene.add(this.sprayPoints);
  }

  _buildMorningRainbow() {
    const rainbowGeo = new THREE.RingGeometry(2.2, 2.85, 48, 4, 0.18, Math.PI - 0.36);
    this.rainbowMat = new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uOpacity: { value: 0.0 },
      },
      vertexShader: `
        varying vec3 vPos;
        void main() {
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uOpacity;
        varying vec3 vPos;
        void main() {
          float r = (length(vPos.xy) - 2.2) / 0.65;
          float angleFade = sin(clamp((atan(vPos.y, vPos.x) - 0.18) / (3.14159 - 0.36), 0.0, 1.0) * 3.14159);
          vec3 c1 = vec3(1.0, 0.28, 0.35);
          vec3 c2 = vec3(1.0, 0.78, 0.22);
          vec3 c3 = vec3(0.25, 0.92, 0.48);
          vec3 c4 = vec3(0.28, 0.68, 1.0);
          vec3 col = r < 0.33 ? mix(c1, c2, r * 3.0) : (r < 0.66 ? mix(c2, c3, (r - 0.33) * 3.0) : mix(c3, c4, (r - 0.66) * 3.0));
          float edge = sin(clamp(r, 0.0, 1.0) * 3.14159);
          gl_FragColor = vec4(col, edge * angleFade * uOpacity * 0.46);
        }
      `,
    });
    this.rainbowMesh = new THREE.Mesh(rainbowGeo, this.rainbowMat);
    this.rainbowMesh.position.set(0.1, 0.25, -0.8);
    this.rainbowMesh.rotation.y = 0.12;
    this.rainbowMesh.visible = false;
    this.group.add(this.rainbowMesh);
  }

  emitWaterSpray(origin, targetPoint, rainbowBoost = false) {
    this.wetnessBoost = Math.min(1.0, this.wetnessBoost + 0.022);
    if (rainbowBoost) {
      this.rainbowAlpha = Math.min(1.0, this.rainbowAlpha + 0.08);
    }
    const dir = new THREE.Vector3().subVectors(targetPoint, origin);
    const dist = Math.max(0.4, Math.min(3.5, dir.length()));
    dir.normalize();

    let spawned = 0;
    for (let i = 0; i < this.dropVelocities.length && spawned < 6; i++) {
      const d = this.dropVelocities[i];
      if (d.life <= 0) {
        this.dropPositions[i * 3] = origin.x + (Math.random() - 0.5) * 0.04;
        this.dropPositions[i * 3 + 1] = origin.y + (Math.random() - 0.5) * 0.04;
        this.dropPositions[i * 3 + 2] = origin.z + (Math.random() - 0.5) * 0.04;
        const speed = 2.6 + dist * 0.85 + Math.random() * 0.9;
        d.x = dir.x * speed + (Math.random() - 0.5) * 0.8;
        d.y = dir.y * speed + 1.35 + Math.random() * 0.6;
        d.z = dir.z * speed + (Math.random() - 0.5) * 0.8;
        d.life = 0.55 + Math.random() * 0.25;
        spawned++;
      }
    }
    this.sprayPoints.geometry.attributes.position.needsUpdate = true;
  }

  update(dt) {
    this.time += dt;
    this.puddleUniforms.uTime.value = this.time;
    this.puddleUniforms.uWetnessBoost.value = this.wetnessBoost;

    if (this.rainbowAlpha > 0.002) {
      this.rainbowMesh.visible = true;
      this.rainbowMat.uniforms.uOpacity.value = this.rainbowAlpha;
      this.rainbowAlpha = Math.max(0, this.rainbowAlpha - dt * 0.09);
    } else {
      this.rainbowMesh.visible = false;
    }

    let anyActive = false;
    for (let i = 0; i < this.dropVelocities.length; i++) {
      const d = this.dropVelocities[i];
      if (d.life > 0) {
        anyActive = true;
        d.life -= dt;
        d.y -= 9.2 * dt;
        const ix = i * 3;
        this.dropPositions[ix] += d.x * dt;
        this.dropPositions[ix + 1] += d.y * dt;
        this.dropPositions[ix + 2] += d.z * dt;
        if (this.dropPositions[ix + 1] <= 0.01 || d.life <= 0) {
          d.life = 0;
          this.dropPositions[ix + 1] = -10;
        }
      }
    }
    if (anyActive) {
      this.sprayPoints.geometry.attributes.position.needsUpdate = true;
    }
  }

  renderPlanarReflection(camera) {
    if (!this.puddleMesh.visible) return;

    this.puddleMesh.visible = false;
    this.roadMesh.visible = false;

    const planeY = 0.003;
    this.reflectCam.projectionMatrix.copy(camera.projectionMatrix);
    this.reflectCam.up.set(0, -1, 0);
    this.reflectCam.position.set(
      camera.position.x,
      2 * planeY - camera.position.y,
      camera.position.z
    );

    const lookTarget = new THREE.Vector3(0, 0, -1)
      .applyQuaternion(camera.quaternion)
      .add(camera.position);
    lookTarget.y = 2 * planeY - lookTarget.y;
    this.reflectCam.lookAt(lookTarget);
    this.reflectCam.updateMatrixWorld();

    this.reflectMatrix.set(
      0.5, 0.0, 0.0, 0.5,
      0.0, 0.5, 0.0, 0.5,
      0.0, 0.0, 0.5, 0.5,
      0.0, 0.0, 0.0, 1.0
    );
    this.reflectMatrix.multiply(this.reflectCam.projectionMatrix);
    this.reflectMatrix.multiply(this.reflectCam.matrixWorldInverse);
    this.puddleUniforms.uTextureMatrix.value.copy(this.reflectMatrix);

    const normal = new THREE.Vector3(0, 1, 0);
    const pos = new THREE.Vector3(0, planeY, 0);
    const viewNormal = normal.clone().transformDirection(this.reflectCam.matrixWorldInverse);
    const viewPos = pos.clone().applyMatrix4(this.reflectCam.matrixWorldInverse);
    const clipPlane = this.clipPlane.set(
      viewNormal.x,
      viewNormal.y,
      viewNormal.z,
      -viewPos.dot(viewNormal)
    );

    const proj = this.reflectCam.projectionMatrix;
    const e = proj.elements;
    this.qVec.x = (Math.sign(clipPlane.x) + e[8]) / e[0];
    this.qVec.y = (Math.sign(clipPlane.y) + e[9]) / e[5];
    this.qVec.z = -1.0;
    this.qVec.w = (1.0 + e[10]) / e[14];

    clipPlane.multiplyScalar(2.0 / clipPlane.dot(this.qVec));
    e[2] = clipPlane.x;
    e[6] = clipPlane.y;
    e[10] = clipPlane.z + 1.0 - 0.01;
    e[14] = clipPlane.w;

    const prevTarget = this.renderer.getRenderTarget();
    const prevShadowAuto = this.renderer.shadowMap.autoUpdate;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.setRenderTarget(this.reflectRT);
    this.renderer.clear();
    this.renderer.render(this.scene, this.reflectCam);
    this.renderer.setRenderTarget(prevTarget);
    this.renderer.shadowMap.autoUpdate = prevShadowAuto;

    this.puddleMesh.visible = true;
    this.roadMesh.visible = true;
  }
}
