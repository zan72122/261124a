// Photorealistic Airliner Cabin Architecture, Seats, Tray Tables, Windows & Exterior Sky/Clouds/City
// Pass 1 Upgraded: Sealed Boeing 787/A350 curved fuselage hull, PSU panels, visible sunlit oval windows,
// volumetric window sunbeams, contact AO shadows, and shared geometries (<120k total triangles!).

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export class AirlinerCabin {
  constructor(scene, mats) {
    this.scene = scene;
    this.mats = mats;
    this.root = new THREE.Group();
    this.scene.add(this.root);

    this.windows = [];
    this.shades = [];
    this.readingLights = [];
    this.trayTables = [];
    this.clouds = [];
    this.sunBeams = [];
    this.aisleStrips = [];
    this.coveMaterials = [];
    this.timeOfDay = 0.0; // 0 = Day, 0.5 = Sunset, 1.0 = Night
    this.landingRunwayIntensity = 0.0;

    this._buildMaterials();
    this._buildFuselageAndBins();
    this._buildWindowsAndExterior();
    this._buildPictorialPlacard();
    this._buildAllSeatRows();
    this._buildLighting();
  }

  _buildMaterials() {
    const m = this.mats;

    this.wallMat = new THREE.MeshPhysicalMaterial({
      color: 0xeef2f7,
      normalMap: m.plasticNormal,
      normalScale: new THREE.Vector2(0.22, 0.22),
      roughness: 0.44,
      metalness: 0.0,
      clearcoat: 0.14,
      clearcoatRoughness: 0.45
    });

    this.binMat = new THREE.MeshPhysicalMaterial({
      color: 0xf5f7fb,
      normalMap: m.plasticNormal,
      normalScale: new THREE.Vector2(0.16, 0.16),
      roughness: 0.34,
      metalness: 0.0,
      clearcoat: 0.26,
      clearcoatRoughness: 0.32
    });

    this.psuMat = new THREE.MeshStandardMaterial({
      color: 0xdde3ee,
      normalMap: m.plasticNormal,
      normalScale: new THREE.Vector2(0.15, 0.15),
      roughness: 0.52,
      metalness: 0.05
    });

    this.trimDarkMat = new THREE.MeshStandardMaterial({
      color: 0x172338,
      roughness: 0.45,
      metalness: 0.28
    });

    this.chromeMat = new THREE.MeshStandardMaterial({
      map: m.brushedAlbedo,
      roughnessMap: m.brushedRough,
      normalMap: m.brushedNormal,
      normalScale: new THREE.Vector2(0.3, 0.3),
      color: 0xf0f5fc,
      metalness: 0.92,
      roughness: 0.20
    });

    this.navySeatMat = new THREE.MeshPhysicalMaterial({
      map: m.navyTex,
      normalMap: m.fabricNormal,
      normalScale: new THREE.Vector2(0.65, 0.65),
      color: 0xffffff,
      roughness: 0.84,
      metalness: 0.0,
      sheen: 0.52,
      sheenRoughness: 0.60,
      sheenColor: new THREE.Color(0x4164a6)
    });

    this.headrestClothMat = new THREE.MeshPhysicalMaterial({
      color: 0xf8fafe,
      normalMap: m.fabricNormal,
      normalScale: new THREE.Vector2(0.3, 0.3),
      roughness: 0.76,
      metalness: 0.0,
      sheen: 0.32,
      sheenColor: new THREE.Color(0xffffff)
    });

    this.trayPlasticMat = new THREE.MeshPhysicalMaterial({
      color: 0xf4f6fa,
      normalMap: m.plasticNormal,
      normalScale: new THREE.Vector2(0.24, 0.24),
      roughness: 0.30,
      metalness: 0.0,
      clearcoat: 0.48,
      clearcoatRoughness: 0.24
    });

    this.carpetMat = new THREE.MeshStandardMaterial({
      map: m.carpetTex,
      normalMap: m.fabricNormal,
      normalScale: new THREE.Vector2(0.5, 0.5),
      roughness: 0.92,
      metalness: 0.0
    });

    this.shadeMat = new THREE.MeshPhysicalMaterial({
      color: 0xe6ebf3,
      normalMap: m.plasticNormal,
      normalScale: new THREE.Vector2(0.28, 0.28),
      roughness: 0.50,
      metalness: 0.0,
      transmission: 0.14,
      thickness: 0.01
    });

    this.windowGlassMat = new THREE.MeshPhysicalMaterial({
      color: 0xe8f4ff,
      roughness: 0.04,
      metalness: 0.0,
      transparent: true,
      opacity: 0.16,
      clearcoat: 1.0,
      clearcoatRoughness: 0.03,
      reflectivity: 0.92
    });

    // Soft contact AO shadow decal material
    const aoC = document.createElement('canvas');
    aoC.width = aoC.height = 128;
    const ax = aoC.getContext('2d');
    const rg = ax.createRadialGradient(64, 64, 8, 64, 64, 62);
    rg.addColorStop(0, 'rgba(6, 10, 22, 0.62)');
    rg.addColorStop(0.65, 'rgba(6, 10, 22, 0.26)');
    rg.addColorStop(1, 'rgba(6, 10, 22, 0.0)');
    ax.fillStyle = rg;
    ax.fillRect(0, 0, 128, 128);
    this.aoTex = new THREE.CanvasTexture(aoC);
    this.aoMat = new THREE.MeshBasicMaterial({
      map: this.aoTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.85
    });
  }

  _buildFuselageAndBins() {
    // Cabin floor
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 18.5), this.carpetMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, -5.2);
    floor.receiveShadow = true;
    this.root.add(floor);

    // Brushed aluminum seat-track rails (foreground row only so distant bokeh aisle stays silky smooth!)
    const trackGeo = new THREE.BoxGeometry(0.020, 0.004, 3.0);
    [-1.08, -0.38, 0.62, 1.12].forEach((tx) => {
      const tr = new THREE.Mesh(trackGeo, this.chromeMat);
      tr.position.set(tx, 0.002, 0.2);
      this.root.add(tr);
    });

    // Soft-feathered Night Floor Emergency Path Glow Strips along aisle (off in Day, soft sapphire glow at Night!)
    const stripC = document.createElement('canvas');
    stripC.width = 64; stripC.height = 64;
    const sxCtx = stripC.getContext('2d');
    const sg = sxCtx.createLinearGradient(0, 0, 64, 0);
    sg.addColorStop(0.0, 'rgba(100,160,255,0.0)');
    sg.addColorStop(0.5, 'rgba(135,190,255,0.85)');
    sg.addColorStop(1.0, 'rgba(100,160,255,0.0)');
    sxCtx.fillStyle = sg;
    sxCtx.fillRect(0, 0, 64, 64);
    const stripTex = new THREE.CanvasTexture(stripC);

    this.floorStripMat = new THREE.MeshBasicMaterial({
      map: stripTex,
      color: 0x6ea8ff,
      transparent: true,
      opacity: 0.0,
      depthWrite: false
    });
    const stripGeo = new THREE.PlaneGeometry(0.09, 14.0);
    [-0.24, 0.34].forEach((sx) => {
      const s = new THREE.Mesh(stripGeo, this.floorStripMat);
      s.rotation.x = -Math.PI / 2;
      s.position.set(sx, 0.004, -4.5);
      this.aisleStrips.push(s);
      this.root.add(s);
    });

    // Upper Curved Cabin Ceiling Arch ONLY (theta centered on PI => +Y top arch, keeping y < 1.62m outside windows 100% open to sky, clouds & city lights!)
    const ceilGeo = new THREE.CylinderGeometry(1.68, 1.68, 19.5, 32, 1, true, Math.PI * 0.58, Math.PI * 0.84);
    const ceilMat = this.wallMat.clone();
    ceilMat.side = THREE.BackSide;
    const ceil = new THREE.Mesh(ceilGeo, ceilMat);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(0, 0.62, -5.0);
    ceil.receiveShadow = true;
    this.root.add(ceil);

    // Sculpted Upper Side Coves bridging Ceiling to Window Wall Panels
    const sideCoveGeo = new THREE.BoxGeometry(0.55, 0.36, 18.5);
    [-1.26, 1.26].forEach((sx) => {
      const sc = new THREE.Mesh(sideCoveGeo, this.wallMat);
      sc.position.set(sx, 2.02, -5.0);
      sc.rotation.z = sx < 0 ? -0.35 : 0.35;
      this.root.add(sc);
    });

    // Recessed Sky-Interior Cove Wash Panels + Glowing LED Strips
    const skyWashMat = new THREE.MeshBasicMaterial({ color: 0xd8e8ff });
    this.coveMaterials.push(skyWashMat);
    const washGeo = new THREE.PlaneGeometry(0.36, 17.0);
    [-0.52, 0.52].forEach((wx) => {
      const wMesh = new THREE.Mesh(washGeo, skyWashMat);
      wMesh.rotation.x = Math.PI / 2;
      wMesh.rotation.y = wx < 0 ? -0.22 : 0.22;
      wMesh.position.set(wx, 2.16, -5.0);
      this.root.add(wMesh);
    });

    const coveLedMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const coveGeo = new THREE.BoxGeometry(0.045, 0.018, 17.0);
    [-0.36, 0.36].forEach((cx) => {
      const cove = new THREE.Mesh(coveGeo, coveLedMat);
      cove.position.set(cx, 2.19, -5.0);
      this.root.add(cove);
    });

    // Center sculpted ceiling crown rib
    const centerPanel = new THREE.Mesh(new THREE.BoxGeometry(0.70, 0.055, 17.0), this.binMat);
    centerPanel.position.set(0, 2.22, -5.0);
    this.root.add(centerPanel);

    // Continuous PSU (Passenger Service Unit) Under-Bin Channel on Left & Right
    const psuChannelGeo = new THREE.BoxGeometry(0.56, 0.06, 17.0);
    [-1, 1].forEach((side) => {
      const psu = new THREE.Mesh(psuChannelGeo, this.psuMat);
      psu.position.set(side * 1.12, 1.69, -5.0);
      psu.rotation.z = side * 0.10;
      psu.receiveShadow = true;
      this.root.add(psu);
    });

    // Clamshell Overhead Stowage Bins on Left & Right (recessed hairline seam smaller than bin body!)
    const binBodyGeo = new RoundedBoxGeometry(0.58, 0.33, 1.21, 3, 0.055);
    const latchGeo = new BoxGeometryWithBevel(0.022, 0.042, 0.15);
    const gapSeamGeo = new THREE.BoxGeometry(0.51, 0.26, 0.024);

    for (let i = 0; i < 10; i++) {
      const bz = 1.45 - i * 1.24;
      [-1, 1].forEach((side) => {
        const binGroup = new THREE.Group();
        binGroup.position.set(side * 0.98, 1.88, bz);
        binGroup.rotation.z = side * 0.25;

        const body = new THREE.Mesh(binBodyGeo, this.binMat);
        body.castShadow = i < 2;
        body.receiveShadow = true;
        binGroup.add(body);

        const seam = new THREE.Mesh(gapSeamGeo, this.trimDarkMat);
        seam.position.z = 0.61;
        binGroup.add(seam);

        const latch = new THREE.Mesh(latchGeo, this.chromeMat);
        latch.position.set(-side * 0.285, -0.095, 0);
        binGroup.add(latch);

        this.root.add(binGroup);
      });
    }

    // Rear Galley Bulkhead & Navy Pleated Curtain far down the aisle in bokeh
    const rearWall = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.8), this.wallMat);
    rearWall.position.set(0, 1.25, -10.8);
    this.root.add(rearWall);

    const rearCurtain = new THREE.Mesh(
      new THREE.BoxGeometry(0.76, 2.05, 0.08),
      new THREE.MeshStandardMaterial({ map: this.mats.navyTex, roughness: 0.88 })
    );
    rearCurtain.position.set(0.04, 1.02, -10.45);
    this.root.add(rearCurtain);

    // Lower curved dado wall panels below windows
    const dadoGeo = new THREE.BoxGeometry(0.10, 0.76, 17.5);
    [-1.38, 1.38].forEach((wx) => {
      const dado = new THREE.Mesh(dadoGeo, this.wallMat);
      dado.position.set(wx, 0.38, -5.0);
      dado.receiveShadow = true;
      this.root.add(dado);
    });
  }

  _buildWindowsAndExterior() {
    // Curved cabin sidewall bays with prominent vertical-oval aircraft windows!
    const bayWidth = 1.22;
    const bayHeight = 1.04;
    const wallShape = new THREE.Shape();
    wallShape.moveTo(-bayWidth / 2, -bayHeight / 2);
    wallShape.lineTo(bayWidth / 2, -bayHeight / 2);
    wallShape.lineTo(bayWidth / 2, bayHeight / 2);
    wallShape.lineTo(-bayWidth / 2, bayHeight / 2);
    wallShape.closePath();

    // Generous Boeing 787 Dreamliner-sized vertical oval window aperture!
    const rx = 0.175;
    const ry = 0.255;
    const hole = new THREE.Path();
    hole.absellipse(0, 0.01, rx, ry, 0, Math.PI * 2, false, 0);
    wallShape.holes.push(hole);

    const wallBayGeo = new THREE.ExtrudeGeometry(wallShape, {
      depth: 0.06,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.015,
      bevelThickness: 0.015
    });
    wallBayGeo.center();

    // Sculpted white inner window reveal ring (catches bright sunlight!)
    const bezelPts = new THREE.EllipseCurve(0, 0.01, rx + 0.022, ry + 0.022, 0, Math.PI * 2, false, 0).getPoints(24);
    const bezelShape = new THREE.Shape(bezelPts);
    const innerPts = new THREE.EllipseCurve(0, 0.01, rx - 0.004, ry - 0.004, 0, Math.PI * 2, false, 0).getPoints(24);
    bezelShape.holes.push(new THREE.Path(innerPts));
    const bezelGeo = new THREE.ExtrudeGeometry(bezelShape, {
      depth: 0.065,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.012,
      bevelThickness: 0.012
    });
    bezelGeo.center();

    this.windowRimGlowMat = new THREE.MeshStandardMaterial({
      color: 0xf8fbff,
      emissive: new THREE.Color(0xdbeaff),
      emissiveIntensity: 0.35,
      roughness: 0.28
    });

    // Soft Radial Window Sunlight Bloom Sprites right inside Left Windows (no edge-on plane artifacts in aisle!)
    const beamC = document.createElement('canvas');
    beamC.width = 128;
    beamC.height = 128;
    const bx = beamC.getContext('2d');
    const bg = bx.createRadialGradient(64, 64, 4, 64, 64, 62);
    bg.addColorStop(0.0, 'rgba(255, 250, 235, 0.38)');
    bg.addColorStop(0.45, 'rgba(255, 242, 215, 0.14)');
    bg.addColorStop(1.0, 'rgba(255, 235, 200, 0.0)');
    bx.fillStyle = bg;
    bx.fillRect(0, 0, 128, 128);
    const beamTex = new THREE.CanvasTexture(beamC);
    this.sunBeamMat = new THREE.SpriteMaterial({
      map: beamTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.55
    });

    const glassGeo = new THREE.PlaneGeometry(0.39, 0.56);
    const shadeGeo = new THREE.PlaneGeometry(0.38, 0.54);
    const handleGeo = new THREE.BoxGeometry(0.11, 0.016, 0.022);

    for (let row = 0; row < 8; row++) {
      const wz = 0.06 - row * 1.22;
      [-1, 1].forEach((side) => {
        const bayGroup = new THREE.Group();
        bayGroup.position.set(side * 1.33, 1.22, wz);
        bayGroup.rotation.y = side === -1 ? Math.PI / 2 : -Math.PI / 2;
        bayGroup.rotation.x = 0.13;

        const panel = new THREE.Mesh(wallBayGeo, this.wallMat);
        panel.receiveShadow = true;
        bayGroup.add(panel);

        const bezel = new THREE.Mesh(bezelGeo, this.windowRimGlowMat);
        bezel.position.z = 0.015;
        bayGroup.add(bezel);

        const glass = new THREE.Mesh(glassGeo, this.windowGlassMat);
        glass.position.set(0, 0.01, -0.025);
        bayGroup.add(glass);

        if (side === -1 && row <= 3) {
          const glowSprite = new THREE.Sprite(this.sunBeamMat);
          glowSprite.scale.set(0.85, 0.95, 1);
          glowSprite.position.set(-1.12, 1.18, wz + 0.02);
          this.sunBeams.push(glowSprite);
          this.root.add(glowSprite);
        }

        // Interactive sliding window shades for foreground Row 1 & Row 2!
        if (row <= 1) {
          const shadePivot = new THREE.Group();
          shadePivot.position.set(0, 0.52, -0.01);

          const shadeMesh = new THREE.Mesh(shadeGeo, this.shadeMat);
          shadePivot.add(shadeMesh);

          const tab = new THREE.Mesh(handleGeo, this.chromeMat);
          tab.position.set(0, -0.26, 0.016);
          shadePivot.add(tab);

          const shadeRecord = {
            pivot: shadePivot,
            mesh: shadeMesh,
            tab,
            row,
            side,
            closedRatio: 0.05,
            targetRatio: 0.05
          };
          shadeMesh.userData.interactiveType = 'windowShade';
          shadeMesh.userData.shade = shadeRecord;
          tab.userData.interactiveType = 'windowShade';
          tab.userData.shade = shadeRecord;

          this.shades.push(shadeRecord);
          bayGroup.add(shadePivot);
        }

        this.root.add(bayGroup);
      });
    }

    // Exterior Sky Dome
    this.skyUniforms = {
      uTimeOfDay: { value: 0.0 },
      uTime: { value: 0.0 }
    };
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
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
        uniform float uTimeOfDay;
        varying vec3 vWorldPos;
        void main() {
          float h = clamp((vWorldPos.y + 1.2) / 5.5, 0.0, 1.0);

          vec3 dayBot = vec3(0.68, 0.85, 1.00);
          vec3 dayMid = vec3(0.16, 0.48, 0.90);
          vec3 dayTop = vec3(0.06, 0.22, 0.65);
          vec3 dayCol = h < 0.42 ? mix(dayBot, dayMid, h / 0.42) : mix(dayMid, dayTop, (h - 0.42) / 0.58);

          vec3 sunBot = vec3(1.00, 0.48, 0.12);
          vec3 sunMid = vec3(0.92, 0.26, 0.34);
          vec3 sunTop = vec3(0.14, 0.12, 0.34);
          vec3 sunCol = h < 0.42 ? mix(sunBot, sunMid, h / 0.42) : mix(sunMid, sunTop, (h - 0.42) / 0.58);

          vec3 nitBot = vec3(0.07, 0.08, 0.18);
          vec3 nitMid = vec3(0.015, 0.022, 0.07);
          vec3 nitTop = vec3(0.004, 0.008, 0.03);
          vec3 nitCol = h < 0.38 ? mix(nitBot, nitMid, h / 0.38) : mix(nitMid, nitTop, (h - 0.38) / 0.62);

          vec3 col = uTimeOfDay < 0.5
            ? mix(dayCol, sunCol, smoothstep(0.0, 0.5, uTimeOfDay))
            : mix(sunCol, nitCol, smoothstep(0.5, 1.0, uTimeOfDay));

          gl_FragColor = vec4(col, 1.0);
        }
      `
    });
    this.root.add(new THREE.Mesh(new THREE.SphereGeometry(22.0, 24, 16), skyMat));

    // Shared Puff Geometry for Exterior Cumulus Cloud Deck (placed right at window eye-line y = 0.65..1.15!)
    this.cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: new THREE.Color(0x56749e),
      emissiveIntensity: 0.35,
      roughness: 0.90,
      metalness: 0.0,
      transparent: true,
      opacity: 0.96
    });
    const puffGeo = new THREE.SphereGeometry(0.85, 10, 8);
    for (let i = 0; i < 20; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const cluster = new THREE.Group();
      const dist = 2.7 + (i % 3) * 1.1;
      cluster.position.set(side * dist, 0.78 + (i % 3 - 1) * 0.22, 2.5 - i * 0.78);
      for (let p = 0; p < 2; p++) {
        const puff = new THREE.Mesh(puffGeo, this.cloudMat);
        puff.position.set((p - 0.5) * 0.55, p * 0.16, 0);
        puff.scale.set(1.1, 0.45, 0.95);
        cluster.add(puff);
      }
      this.clouds.push(cluster);
      this.root.add(cluster);
    }

    // Swept Airliner Wing + Winglet outside Left Window
    const wingGroup = new THREE.Group();
    const wingMain = new THREE.Mesh(
      new THREE.BoxGeometry(5.2, 0.08, 1.35),
      new THREE.MeshStandardMaterial({ color: 0xeef3fa, roughness: 0.26, metalness: 0.48 })
    );
    wingMain.position.set(-3.9, 0.76, -2.2);
    wingMain.rotation.y = 0.32;
    wingMain.rotation.z = 0.07;
    wingGroup.add(wingMain);

    const winglet = new THREE.Mesh(
      new THREE.BoxGeometry(0.10, 0.62, 0.42),
      new THREE.MeshStandardMaterial({ color: 0x182c58, roughness: 0.30, metalness: 0.32 })
    );
    winglet.position.set(-6.25, 1.18, -3.05);
    winglet.rotation.z = -0.24;
    wingGroup.add(winglet);

    this.wingStrobeMat = new THREE.MeshBasicMaterial({ color: 0xff4433 });
    const navLight = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), this.wingStrobeMat);
    navLight.position.set(-6.3, 1.48, -3.05);
    wingGroup.add(navLight);
    this.root.add(wingGroup);

    // Night City Lights Vertical Horizon Backdrop strictly OUTSIDE cabin walls (|x| = 4.6m) so it shines vividly through oval windows!
    this.cityPlaneMat = new THREE.MeshBasicMaterial({
      map: this.mats.cityLightsTex,
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide
    });
    const cityGeo = new THREE.PlaneGeometry(18.0, 2.6);
    [-1, 1].forEach((side) => {
      const cp = new THREE.Mesh(cityGeo, this.cityPlaneMat);
      cp.rotation.y = side === -1 ? Math.PI / 2 : -Math.PI / 2;
      cp.rotation.x = 0.22;
      cp.position.set(side * 4.6, 0.55, -3.5);
      this.root.add(cp);
    });

    // Runway approach edge lights
    this.runwayGroup = new THREE.Group();
    this.runwayLightMat = new THREE.MeshBasicMaterial({ color: 0xffe6a3, transparent: true, opacity: 0.0 });
    const rlGeo = new THREE.SphereGeometry(0.08, 6, 6);
    for (let i = 0; i < 14; i++) {
      [-2.9, 2.9].forEach((rx) => {
        const rl = new THREE.Mesh(rlGeo, this.runwayLightMat);
        rl.position.set(rx, 0.72, 2.8 - i * 1.15);
        this.runwayGroup.add(rl);
      });
    }
    this.root.add(this.runwayGroup);
  }

  _buildPictorialPlacard() {
    // Sleek Recessed Aircraft Cabin Pictorial Information Placard mounted cleanly in unobstructed view!
    const group = new THREE.Group();
    group.position.set(-0.52, 1.57, 0.36);
    group.rotation.y = 0.12;
    group.rotation.x = 0.12;

    const bezel = new THREE.Mesh(
      new RoundedBoxGeometry(0.44, 0.17, 0.022, 3, 0.012),
      this.chromeMat
    );
    group.add(bezel);

    const cardMat = new THREE.MeshStandardMaterial({
      map: this.mats.placardTex,
      roughness: 0.25,
      metalness: 0.05,
      emissive: new THREE.Color(0xffffff),
      emissiveMap: this.mats.placardTex,
      emissiveIntensity: 0.18
    });
    const card = new THREE.Mesh(new THREE.PlaneGeometry(0.415, 0.148), cardMat);
    card.position.z = 0.013;
    group.add(card);

    this.placardGroup = group;
    this.root.add(group);
  }

  _buildAllSeatRows() {
    // Shared Geometries for Hero Seats vs Low-Poly Background Bokeh Seats (Massive draw-call & triangle win!)
    this.seatGeos = {
      leg: new THREE.CylinderGeometry(0.015, 0.015, 0.34, 8),
      aoDisc: new THREE.PlaneGeometry(0.56, 0.56),
      heroCushion: new RoundedBoxGeometry(0.44, 0.11, 0.45, 3, 0.035),
      bgCushion: new THREE.BoxGeometry(0.43, 0.10, 0.43),
      heroBack: new RoundedBoxGeometry(0.43, 0.67, 0.11, 3, 0.04),
      bgBack: new RoundedBoxGeometry(0.42, 0.66, 0.10, 1, 0.03),
      heroHead: new RoundedBoxGeometry(0.35, 0.21, 0.09, 2, 0.03),
      bgHead: new THREE.BoxGeometry(0.34, 0.20, 0.085),
      cloth: new THREE.BoxGeometry(0.27, 0.18, 0.096),
      stripe: new THREE.BoxGeometry(0.272, 0.016, 0.098),
      arm: new RoundedBoxGeometry(0.042, 0.044, 0.37, 1, 0.012),
      armPost: new THREE.BoxGeometry(0.024, 0.18, 0.048),
      bgPersonHead: new THREE.SphereGeometry(0.092, 8, 7),
      bgPersonHair: new THREE.SphereGeometry(0.098, 8, 7),
      bgPersonTorso: new THREE.BoxGeometry(0.30, 0.34, 0.16)
    };

    this.heroSeatCoords = [
      { x: -0.92, z: -0.18, role: 'mom' },
      { x: -0.44, z: -0.18, role: 'dad' },
      { x: 0.84, z: -0.18, role: 'grandma' }
    ];

    this.heroSeatCoords.forEach((sc, idx) => {
      this._createSeatUnit(sc.x, sc.z, true, idx);
    });

    for (let r = 1; r <= 7; r++) {
      const rz = -0.18 - r * 1.22;
      this._createSeatUnit(-0.92, rz, false, 0);
      this._createSeatUnit(-0.44, rz, false, 1);
      this._createSeatUnit(0.84, rz, false, 2);
    }
  }

  _createSeatUnit(x, z, isHeroRow = false, seatIndex = 0) {
    const g = this.seatGeos;
    const unit = new THREE.Group();
    unit.position.set(x, 0, z);

    // Contact AO shadow on floor beneath seat!
    const ao = new THREE.Mesh(g.aoDisc, this.aoMat);
    ao.rotation.x = -Math.PI / 2;
    ao.position.set(0, 0.006, 0.02);
    unit.add(ao);

    [-0.16, 0.16].forEach((lx) => {
      const leg = new THREE.Mesh(g.leg, this.chromeMat);
      leg.position.set(lx, 0.17, 0);
      unit.add(leg);
    });

    const cushion = new THREE.Mesh(isHeroRow ? g.heroCushion : g.bgCushion, this.navySeatMat);
    cushion.position.set(0, 0.38, 0.04);
    cushion.castShadow = isHeroRow;
    cushion.receiveShadow = true;
    unit.add(cushion);

    const backrest = new THREE.Mesh(isHeroRow ? g.heroBack : g.bgBack, this.navySeatMat);
    backrest.position.set(0, 0.74, -0.16);
    backrest.rotation.x = -0.11;
    backrest.castShadow = isHeroRow;
    backrest.receiveShadow = true;
    unit.add(backrest);

    const headrest = new THREE.Mesh(isHeroRow ? g.heroHead : g.bgHead, this.navySeatMat);
    headrest.position.set(0, 1.12, -0.19);
    unit.add(headrest);

    const cloth = new THREE.Mesh(g.cloth, this.headrestClothMat);
    cloth.position.set(0, 1.135, -0.186);
    unit.add(cloth);

    const stripe = new THREE.Mesh(g.stripe, this.trimDarkMat);
    stripe.position.set(0, 1.07, -0.185);
    unit.add(stripe);

    [-0.225, 0.225].forEach((ax) => {
      const arm = new THREE.Mesh(g.arm, this.trimDarkMat);
      arm.position.set(ax, 0.58, 0.04);
      unit.add(arm);

      const armPost = new THREE.Mesh(g.armPost, this.chromeMat);
      armPost.position.set(ax, 0.47, -0.08);
      unit.add(armPost);
    });

    if (isHeroRow) {
      const trayPivot = new THREE.Group();
      trayPivot.position.set(0, 0.69, 0.34);

      const trayBoard = new THREE.Mesh(
        new RoundedBoxGeometry(0.40, 0.020, 0.27, 3, 0.008),
        this.trayPlasticMat.clone()
      );
      trayBoard.receiveShadow = true;
      trayBoard.castShadow = true;
      trayPivot.add(trayBoard);

      const cupRing = new THREE.Mesh(
        new THREE.RingGeometry(0.042, 0.052, 20),
        new THREE.MeshStandardMaterial({ color: 0xcfd7e6, roughness: 0.42 })
      );
      cupRing.rotation.x = -Math.PI / 2;
      cupRing.position.set(0.12, 0.011, -0.04);
      trayPivot.add(cupRing);

      const supportArm = new THREE.Mesh(
        new THREE.CylinderGeometry(0.010, 0.010, 0.24, 8),
        this.chromeMat
      );
      supportArm.position.set(-0.185, -0.08, -0.08);
      supportArm.rotation.x = 0.55;
      trayPivot.add(supportArm);

      // Start trays neatly down/horizontal at 15% or folded cleanly at side rather than blocking passenger chests!
      // Wait: in shot0_dressup.jpg, folded upright trays (-1.28 rad) looked like white laptops blocking Mom & Dad's sweaters!
      // Instead, let's stow folded trays flat vertically beside the outer armrest OR stow them low/compact, and smoothly flip up/level when serving!
      trayPivot.rotation.x = 1.48; // Stowed downward neatly beside knees so Mom, Dad & Grandma's outfits are 100% visible!

      const trayData = {
        seatIndex,
        pivot: trayPivot,
        board: trayBoard,
        openAmount: 0.0,
        targetOpen: 0.0,
        worldPos: new THREE.Vector3(x, 0.69, z + 0.34)
      };
      trayBoard.userData.interactiveType = 'trayTable';
      trayBoard.userData.tray = trayData;

      this.trayTables.push(trayData);
      unit.add(trayPivot);

      // Overhead individual warm reading light button + spotlight
      const psuBtnMat = new THREE.MeshBasicMaterial({ color: 0xffe7aa });
      const psuBtn = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.014, 12), psuBtnMat);
      psuBtn.position.set(x * 0.92, 1.655, z + 0.05);
      this.root.add(psuBtn);

      const spot = new THREE.SpotLight(0xffdca3, 0.0, 2.8, Math.PI / 5.2, 0.65, 1.2);
      spot.position.set(x * 0.92, 1.65, z + 0.05);
      spot.target.position.set(x, 0.68, z + 0.20);
      this.root.add(spot);
      this.root.add(spot.target);

      const rlData = { seatIndex, btn: psuBtn, mat: psuBtnMat, spot, isOn: false, manualOverride: null };
      psuBtn.userData.interactiveType = 'readingLight';
      psuBtn.userData.readingLight = rlData;
      this.readingLights.push(rlData);
    } else if ((seatIndex + Math.abs(Math.round(z * 10))) % 3 !== 0) {
      const bgSkin = new THREE.MeshStandardMaterial({ color: 0xd8b096, roughness: 0.68 });
      const bgHairCols = [0x221a16, 0x3a281e, 0x524238, 0x181820];
      const bgHair = new THREE.MeshStandardMaterial({
        color: bgHairCols[Math.abs(Math.round(x * 10 + z * 5)) % bgHairCols.length],
        roughness: 0.52
      });
      const head = new THREE.Mesh(g.bgPersonHead, bgSkin);
      head.position.set(0, 1.14, -0.07);
      unit.add(head);
      const hair = new THREE.Mesh(g.bgPersonHair, bgHair);
      hair.position.set(0, 1.165, -0.085);
      unit.add(hair);
    }

    this.root.add(unit);
    return unit;
  }

  _buildLighting() {
    // Lower ambient hemisphere so directional sunlight & specular metal reflections pop with photographic contrast!
    this.hemiLight = new THREE.HemisphereLight(0xdce8fa, 0x121d33, 0.62);
    this.scene.add(this.hemiLight);

    // Crisp High-Altitude Window Sunlight raking across seats, trays, and metallic cart!
    this.sunLight = new THREE.DirectionalLight(0xfff7e8, 3.15);
    this.sunLight.position.set(-4.8, 3.1, 1.35);
    this.sunLight.target.position.set(0.20, 0.62, 0.35);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(1024, 1024);
    this.sunLight.shadow.camera.near = 1.0;
    this.sunLight.shadow.camera.far = 11.5;
    this.sunLight.shadow.camera.left = -2.4;
    this.sunLight.shadow.camera.right = 2.4;
    this.sunLight.shadow.camera.top = 2.2;
    this.sunLight.shadow.camera.bottom = -1.6;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.016;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    // Subtle soft key fill from forward ceiling so faces are warm & natural without flattening shadows
    this.cabinFillLight = new THREE.DirectionalLight(0xedf4ff, 0.68);
    this.cabinFillLight.position.set(0.75, 2.15, 2.9);
    this.cabinFillLight.target.position.set(0.0, 0.85, 0.1);
    this.scene.add(this.cabinFillLight);
    this.scene.add(this.cabinFillLight.target);

    // Specular Galley Light directly highlighting the Brushed Metal Cart & Clear Plastic Cups!
    this.cartSpecLight = new THREE.PointLight(0xffffff, 1.65, 5.0, 1.35);
    this.cartSpecLight.position.set(0.18, 1.98, 1.25);
    this.scene.add(this.cartSpecLight);

    // Distant Aisle Bokeh Light Orbs (creates real glowing lens bokeh circles in background!)
    this.aisleMoodLight = new THREE.PointLight(0xdceaff, 1.25, 9.0, 1.3);
    this.aisleMoodLight.position.set(0, 1.92, -4.5);
    this.scene.add(this.aisleMoodLight);

    const orbGeo = new THREE.SphereGeometry(0.035, 8, 8);
    this.bokehOrbMat = new THREE.MeshBasicMaterial({ color: 0xfff3db });
    [-3.6, -5.4, -7.2, -9.0].forEach((oz) => {
      [-0.42, 0.42].forEach((ox) => {
        const orb = new THREE.Mesh(orbGeo, this.bokehOrbMat);
        orb.position.set(ox, 2.12, oz);
        this.root.add(orb);
      });
    });
  }

  openAllTrays(open = true) {
    for (const tr of this.trayTables) {
      tr.targetOpen = open ? 1.0 : 0.0;
    }
  }

  update(dt, elapsed) {
    this.skyUniforms.uTimeOfDay.value = this.timeOfDay;
    this.skyUniforms.uTime.value = elapsed;

    for (const tr of this.trayTables) {
      tr.openAmount += (tr.targetOpen - tr.openAmount) * Math.min(1, dt * 7.5);
      // Smoothly swing up from stowed downward (+1.48 rad) to crisp level horizontal (0.0 rad)!
      tr.pivot.rotation.x = 1.48 * (1.0 - tr.openAmount);
      tr.pivot.position.y = 0.69 - (1.0 - tr.openAmount) * 0.16;
    }

    let avgShadeClosed = 0;
    for (const sh of this.shades) {
      sh.closedRatio += (sh.targetRatio - sh.closedRatio) * Math.min(1, dt * 10.0);
      sh.pivot.position.y = 0.52 - sh.closedRatio * 0.51;
      if (sh.row === 0 && sh.side === -1) avgShadeClosed = sh.closedRatio;
    }

    for (const cl of this.clouds) {
      cl.position.z -= dt * 0.72;
      if (cl.position.z < -12.5) cl.position.z += 15.6;
    }

    this.mats.cityLightsTex.offset.y -= dt * (0.048 + this.landingRunwayIntensity * 0.22);

    const blink = (elapsed % 1.4) < 0.12 ? 1.0 : 0.25;
    this.wingStrobeMat.color.setRGB(1.0 * blink, 0.22 * blink, 0.14 * blink);

    this.runwayLightMat.opacity = this.landingRunwayIntensity;
    if (this.landingRunwayIntensity > 0.01) {
      for (const child of this.runwayGroup.children) {
        child.position.z -= dt * 9.5;
        if (child.position.z < -13.5) child.position.z += 16.5;
      }
    }

    const tod = this.timeOfDay;
    const shadeAtten = 1.0 - avgShadeClosed * 0.62;

    if (tod < 0.5) {
      const k = tod / 0.5;
      this.sunLight.position.set(-4.9, THREE.MathUtils.lerp(3.1, 1.45, k), THREE.MathUtils.lerp(1.35, 0.90, k));
      this.sunLight.color.lerpColors(new THREE.Color(0xfff7e8), new THREE.Color(0xff8433), k);
      this.sunLight.intensity = THREE.MathUtils.lerp(3.15, 3.45, k) * shadeAtten;

      this.sunBeamMat.color.lerpColors(new THREE.Color(0xfff8eb), new THREE.Color(0xff9447), k);
      this.sunBeamMat.opacity = THREE.MathUtils.lerp(0.42, 0.62, k) * shadeAtten;

      this.windowRimGlowMat.emissive.lerpColors(new THREE.Color(0xdbeaff), new THREE.Color(0xff9c54), k);
      this.windowRimGlowMat.emissiveIntensity = THREE.MathUtils.lerp(0.38, 0.58, k) * shadeAtten;

      this.hemiLight.color.lerpColors(new THREE.Color(0xdce8fa), new THREE.Color(0xffc299), k);
      this.hemiLight.groundColor.lerpColors(new THREE.Color(0x121d33), new THREE.Color(0x261a3b), k);
      this.hemiLight.intensity = THREE.MathUtils.lerp(0.62, 0.56, k);

      this.cabinFillLight.color.lerpColors(new THREE.Color(0xedf4ff), new THREE.Color(0xffdfc2), k);
      this.cabinFillLight.intensity = THREE.MathUtils.lerp(0.68, 0.62, k);

      this.cartSpecLight.color.lerpColors(new THREE.Color(0xffffff), new THREE.Color(0xffcfa0), k);

      const coveCol = new THREE.Color().lerpColors(new THREE.Color(0xd8e8ff), new THREE.Color(0xffcca3), k);
      this.coveMaterials.forEach((cm) => cm.color.copy(coveCol));
      this.floorStripMat.opacity = 0.0;
      this.bokehOrbMat.color.lerpColors(new THREE.Color(0xfff5e0), new THREE.Color(0xffb478), k);

      this.cloudMat.color.lerpColors(new THREE.Color(0xffffff), new THREE.Color(0xffa666), k);
      this.cloudMat.emissive.lerpColors(new THREE.Color(0x56749e), new THREE.Color(0x883024), k);
      this.cloudMat.opacity = THREE.MathUtils.lerp(0.96, 0.90, k);
      this.cityPlaneMat.opacity = 0.0;

      this.scene.environment = k < 0.55 ? this.mats.envMaps.day : this.mats.envMaps.sunset;
      this.scene.environmentIntensity = THREE.MathUtils.lerp(1.02, 1.08, k);
    } else {
      const k = (tod - 0.5) / 0.5;
      this.sunLight.position.set(-4.9, THREE.MathUtils.lerp(1.45, 0.50, k), 0.90);
      this.sunLight.color.lerpColors(new THREE.Color(0xff8433), new THREE.Color(0x36549c), k);
      this.sunLight.intensity = THREE.MathUtils.lerp(3.45, 0.25, k) * shadeAtten;

      this.sunBeamMat.opacity = THREE.MathUtils.lerp(0.62, 0.0, Math.min(1, k * 1.4)) * shadeAtten;
      this.windowRimGlowMat.emissive.lerpColors(new THREE.Color(0xff9c54), new THREE.Color(0x283c6e), k);
      this.windowRimGlowMat.emissiveIntensity = THREE.MathUtils.lerp(0.58, 0.22, k);

      this.hemiLight.color.lerpColors(new THREE.Color(0xffc299), new THREE.Color(0x3e62b5), k);
      this.hemiLight.groundColor.lerpColors(new THREE.Color(0x261a3b), new THREE.Color(0x091022), k);
      this.hemiLight.intensity = THREE.MathUtils.lerp(0.56, 0.44, k);

      this.cabinFillLight.color.lerpColors(new THREE.Color(0xffdfc2), new THREE.Color(0xbcd2ff), k);
      this.cabinFillLight.intensity = THREE.MathUtils.lerp(0.62, 0.52, k);

      this.cartSpecLight.color.lerpColors(new THREE.Color(0xffcfa0), new THREE.Color(0xffdfb5), k);
      this.aisleMoodLight.color.lerpColors(new THREE.Color(0xffa978), new THREE.Color(0x4676eb), k);
      this.aisleMoodLight.intensity = THREE.MathUtils.lerp(1.25, 1.75, k);

      const coveCol = new THREE.Color().lerpColors(new THREE.Color(0xffcca3), new THREE.Color(0x3a6ee8), k);
      this.coveMaterials.forEach((cm) => cm.color.copy(coveCol));
      this.floorStripMat.color.lerpColors(new THREE.Color(0xc8daf7), new THREE.Color(0x5c9eff), k);
      this.floorStripMat.opacity = THREE.MathUtils.lerp(0.0, 0.32, k);
      this.bokehOrbMat.color.lerpColors(new THREE.Color(0xffb478), new THREE.Color(0x88b8ff), k);

      this.cloudMat.color.lerpColors(new THREE.Color(0xffa666), new THREE.Color(0x141d38), k);
      this.cloudMat.emissive.lerpColors(new THREE.Color(0x883024), new THREE.Color(0x060a16), k);
      this.cloudMat.opacity = THREE.MathUtils.lerp(0.90, 0.16, k);

      this.cityPlaneMat.opacity = THREE.MathUtils.smoothstep(k, 0.12, 0.80) * 0.98;

      this.scene.environment = k < 0.45 ? this.mats.envMaps.sunset : this.mats.envMaps.night;
      this.scene.environmentIntensity = THREE.MathUtils.lerp(1.08, 0.85, k);
    }

    for (const rl of this.readingLights) {
      const autoNight = tod > 0.58;
      const active = rl.manualOverride !== null ? rl.manualOverride : autoNight;
      rl.isOn = active;
      const targetInt = active ? 2.65 : 0.0;
      rl.spot.intensity += (targetInt - rl.spot.intensity) * Math.min(1, dt * 6.0);
      rl.mat.color.setHex(active ? 0xffe49c : 0x8b95a8);
    }
  }
}

function BoxGeometryWithBevel(w, h, d) {
  return new RoundedBoxGeometry(w, h, d, 1, 0.004);
}
