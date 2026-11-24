import * as THREE from '../vendor/three.module.min.js';
import { SoundEngine } from './audio.js';
import {
  createSummerEnvMap,
  createVinylNormalMap,
  createDonutVinylTexture,
  createWoodFloorTexture,
  createPoolTileTexture,
  createLawnTexture,
  createSignBoardTexture
} from './textures.js';
import { VinylFloat, AirPump, sharedVinylUniforms } from './vinylFloats.js';
import { FamilyCharacter, OutfitRack, PlayerHand } from './characters.js';
import { WorldEnvironment } from './waterAndEnv.js';

class UkiwaSimulationApp {
  constructor() {
    this.container = document.getElementById('app');
    this.sound = new SoundEngine();

    // Renderer: strictly cap pixelRatio <= 1.5 for 30-60fps iPhone/iPad guarantee
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(44, window.innerWidth / window.innerHeight, 0.1, 90);

    // Camera smooth transition state (player never moves camera manually)
    this.camPos = new THREE.Vector3(0, 1.9, 3.6);
    this.camLook = new THREE.Vector3(0, 0.75, 0.2);
    this.targetCamPos = this.camPos.clone();
    this.targetCamLook = this.camLook.clone();

    // Procedural HDR environment & <=1024px PBR textures
    this.envMap = createSummerEnvMap(this.renderer);
    this.scene.environment = this.envMap;

    this.textures = {
      vinylNormal: createVinylNormalMap(),
      donutMap: createDonutVinylTexture(),
      oakFloor: createWoodFloorTexture(false),
      cedarDeck: createWoodFloorTexture(true),
      poolTile: createPoolTileTexture(),
      lawn: createLawnTexture()
    };

    this._setupLighting();
    this._buildSceneObjects();
    this._setupInput();

    // Stage 0 = Outfit Role Dress-Up, Stage 1 = Inflate 3 Floats, Stage 2 = Dad's Giant Octopus Mishap, Stage 3 = Pool Free-Play
    this.stage = 0;
    this.stageTime = 0;
    this.idleTime = 0;
    this.idleHintShown = false;
    this.airWindBoost = 0;
    this.inflationSequenceCounter = 0;
    this.transitionPending = false;

    this._enterStage(0, true);
    this._updateResponsiveCamera(true);

    window.addEventListener('resize', () => {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this._updateResponsiveCamera(false);
    });

    this.clock = new THREE.Clock();
    this.elapsed = 0;
    this._animate = this._animate.bind(this);
    requestAnimationFrame(this._animate);

    // Expose lightweight debug hook for automated visual inspection if needed
    window.__ukiwaApp = this;
  }

  _setupLighting() {
    // High-contrast Summer Midday Direct Sunlight: moderate sky fill + crisp blazing sun shadows!
    const hemi = new THREE.HemisphereLight(0x7ec4ff, 0xb88b5a, 0.42);
    this.scene.add(hemi);

    this.sunLight = new THREE.DirectionalLight(0xfff6e0, 3.85);
    this.sunLight.position.set(5.2, 9.8, 5.6);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 1024;
    this.sunLight.shadow.mapSize.height = 1024;
    this.sunLight.shadow.camera.near = 1.0;
    this.sunLight.shadow.camera.far = 28.0;
    const d = 6.2;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.018;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    // Subtle turquoise pool caustics bounce fill from below-back
    this.bounceLight = new THREE.DirectionalLight(0x45d9ff, 0.48);
    this.bounceLight.position.set(-2.5, 0.8, -8.5);
    this.scene.add(this.bounceLight);
  }

  _buildSceneObjects() {
    this.world = new WorldEnvironment(this.textures);
    this.scene.add(this.world.group);

    // Family Characters
    this.girl = new FamilyCharacter('girl');
    this.dad = new FamilyCharacter('dad');
    this.mom = new FamilyCharacter('mom');
    this.scene.add(this.girl.group, this.dad.group, this.mom.group);

    // Outfit Rack (Stage 0)
    this.outfitRack = new OutfitRack();
    this.outfitRack.group.position.set(0.55, 0.0, 0.45);
    this.outfitRack.group.rotation.y = -0.18;
    this.scene.add(this.outfitRack.group);

    // 3 Hero Glossy Vinyl Floats: Octopus, Swan, Donut
    this.octopusFloat = new VinylFloat('octopus', this.textures.vinylNormal, this.textures.donutMap);
    this.swanFloat = new VinylFloat('swan', this.textures.vinylNormal, this.textures.donutMap);
    this.donutFloat = new VinylFloat('donut', this.textures.vinylNormal, this.textures.donutMap);
    this.floats = [this.octopusFloat, this.swanFloat, this.donutFloat];
    this.floats.forEach((f) => this.scene.add(f.group));

    // Air Pumps: Yellow Bellows Pump, Blue Cylinder Hand Pump, and Dad's Orange Turbo Blower
    this.bellowsPump = new AirPump('bellows');
    this.cylinderPump = new AirPump('cylinder');
    this.turboPump = new AirPump('turbo');
    this.scene.add(
      this.bellowsPump.group, this.bellowsPump.hoseWorldGroup,
      this.cylinderPump.group, this.cylinderPump.hoseWorldGroup,
      this.turboPump.group, this.turboPump.hoseWorldGroup
    );

    // Colorful Waterproof Vinyl Star Stickers Tray (Stage 1 extra tactile customization!)
    this.stickerTray = new THREE.Group();
    const trayMat = new THREE.MeshPhysicalMaterial({ color: 0xfff9db, roughness: 0.25, clearcoat: 0.6 });
    const trayPlate = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.25, 0.025, 24), trayMat);
    trayPlate.position.y = 0.012;
    trayPlate.receiveShadow = true;
    this.stickerTray.add(trayPlate);

    this.stickerPickups = [];
    const stickerColors = [0xffde59, 0x4dabf7, 0x69db7c, 0xff6b8b];
    stickerColors.forEach((col, i) => {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      const sMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.075, 0.075, 0.014, 5),
        new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.06, clearcoat: 1.0 })
      );
      sMesh.position.set(Math.cos(a) * 0.13, 0.03, Math.sin(a) * 0.13);
      sMesh.userData.stickerColor = col;
      this.stickerTray.add(sMesh);
      this.stickerPickups.push(sMesh);
    });
    this.scene.add(this.stickerTray);

    // Player's 3D Hand wearing chosen outfit sleeve!
    this.playerHand = new PlayerHand();
    this.scene.add(this.playerHand.group);
  }

  _enterStage(newStage, instant = false) {
    this.stage = newStage;
    this.stageTime = 0;
    this.idleTime = 0;
    this.idleHintShown = false;
    this.transitionPending = false;
    this.dragAction = null;

    this.world.setSignStage(newStage, createSignBoardTexture);
    // In Stage 3 we step outside onto the veranda overlooking the pool; hiding the indoor rear wall allows full pullback on narrow portrait phones!
    this.world.roomGroup.visible = newStage !== 3;

    if (newStage === 0) {
      // Stage 0: Dress-Up Role Selection in Sunlit Living Room
      this.outfitRack.group.visible = true;
      this.outfitRack.group.position.set(0.55, 0, 0.72);

      this.girl.group.visible = true;
      this.girl.hatGroup.visible = false; // Hat appears when outfit is chosen!
      this.girl.setSeated(false);
      this.girl.group.position.set(-1.12, 0, 0.95);
      this.girl.group.rotation.set(0, 0.35, 0);
      this.girl.setMood('happy', 0);

      this.dad.group.visible = false;
      this.mom.group.visible = false;
      this.turboPump.group.visible = false;
      this.turboPump.hoseWorldGroup.visible = false;
      this.stickerTray.visible = false;

      // Deflated glossy vinyl floats visible cleanly behind in the sunlit room
      this.octopusFloat.pressure = 0.06;
      this.swanFloat.pressure = 0.05;
      this.donutFloat.pressure = 0.06;
      this.octopusFloat.group.position.set(-1.35, this.octopusFloat.getBottomHalfHeight(), -0.75);
      this.swanFloat.group.position.set(0.05, this.swanFloat.getBottomHalfHeight(), -0.95);
      this.swanFloat.group.rotation.y = Math.PI * 0.76;
      this.donutFloat.group.position.set(1.42, this.donutFloat.getBottomHalfHeight(), -0.75);

      this.bellowsPump.group.visible = false;
      this.bellowsPump.hoseWorldGroup.visible = false;
      this.cylinderPump.group.visible = false;
      this.cylinderPump.hoseWorldGroup.visible = false;

      this.sunLight.position.set(5.2, 9.8, 5.6);
      this.sunLight.target.position.set(0, 0.5, 0.4);
    } else if (newStage === 1) {
      // Stage 1: Inflate the 3 Deflated Glossy Vinyl Floats!
      this.outfitRack.group.visible = false;

      // Daughter stands cheerfully at back-right reacting to every pump & puff!
      this.girl.group.visible = true;
      this.girl.setSeated(false);
      this.girl.group.position.set(1.98, 0, -0.88);
      this.girl.group.rotation.set(0, -0.45, 0);
      this.girl.setMood('happy', 0);

      this.dad.group.visible = false;
      this.mom.group.visible = false;
      this.turboPump.group.visible = false;
      this.turboPump.hoseWorldGroup.visible = false;

      // Place 3 large glossy vinyl floats filling the sunlit oak floor
      this.octopusFloat.giantScale = 1.0;
      this.octopusFloat.group.position.set(-1.34, this.octopusFloat.getBottomHalfHeight(), 0.16);
      this.octopusFloat.group.rotation.set(0, 0.28, 0);

      this.swanFloat.giantScale = 1.0;
      this.swanFloat.group.position.set(0.0, this.swanFloat.getBottomHalfHeight(), -0.22);
      this.swanFloat.group.rotation.set(0, Math.PI * 0.78, 0); // Graceful neck & golden beak facing 3/4 toward camera!

      this.donutFloat.giantScale = 1.0;
      this.donutFloat.group.position.set(1.34, this.donutFloat.getBottomHalfHeight(), 0.20);
      this.donutFloat.group.rotation.set(0, -0.25, 0);

      // Two tactile pumps front-left & front-right!
      this.bellowsPump.group.visible = true;
      this.bellowsPump.hoseWorldGroup.visible = true;
      this.bellowsPump.group.position.set(-0.92, 0, 1.48);
      this.bellowsPump.group.rotation.y = -0.35;
      this.bellowsPump.connectedFloat = this.octopusFloat;
      this.bellowsPump.updateVisuals();

      this.cylinderPump.group.visible = true;
      this.cylinderPump.hoseWorldGroup.visible = true;
      this.cylinderPump.group.position.set(0.95, 0, 1.46);
      this.cylinderPump.group.rotation.y = 0.25;
      this.cylinderPump.connectedFloat = this.donutFloat;
      this.cylinderPump.updateVisuals();

      // Sticker tray front-center!
      this.stickerTray.visible = true;
      this.stickerTray.position.set(0.0, 0, 1.56);

      this.sunLight.position.set(5.2, 9.8, 5.6);
      this.sunLight.target.position.set(0, 0.2, 0.2);
    } else if (newStage === 2) {
      // Stage 2: Dad's Mishap! Giant Octopus occupies the living room & buries Dad!
      this.outfitRack.group.visible = false;
      this.bellowsPump.group.visible = false;
      this.bellowsPump.hoseWorldGroup.visible = false;
      this.cylinderPump.group.visible = false;
      this.cylinderPump.hoseWorldGroup.visible = false;
      this.stickerTray.visible = false;

      // Move Swan & Donut safely onto the sunny cedar deck outside waiting for the pool!
      this.swanFloat.group.position.set(-1.55, this.swanFloat.getBottomHalfHeight(), -3.4);
      this.donutFloat.group.position.set(1.55, this.donutFloat.getBottomHalfHeight(), -3.4);

      // Dad's Orange Turbo Blower clearly visible front-right!
      this.turboPump.group.visible = true;
      this.turboPump.hoseWorldGroup.visible = true;
      this.turboPump.group.position.set(1.58, 0, 1.45);
      this.turboPump.group.rotation.y = 0.55;
      this.turboPump.connectedFloat = null;

      // Giant Octopus wedges across the living room while Dad lies squished front-left with head, arm & both legs clearly visible!
      this.octopusFloat.pressure = 1.14;
      this.octopusFloat.giantScale = 1.15; // Animates up to 1.76
      this.mishapInflating = true;
      this.octopusFloat.group.position.set(0.18, 0.58, -0.68);
      this.octopusFloat.group.rotation.set(0.14, 0.12, 0.18); // Tilted up on left because Dad is wedged underneath!
      this.turboPump.updateVisuals(new THREE.Vector3(1.05, 0.22, 0.65));

      // Dad sprawled front-left under the giant Octopus rim: head & waving arm on left, blue shorts & kicking legs in front!
      this.dad.group.visible = true;
      this.dad.setSeated(false);
      this.dad.group.position.set(-1.18, 0.24, 1.18);
      this.dad.group.rotation.set(-1.18, -0.48, -0.35);
      this.dad.setMood('huh', 4.0);

      // Daughter clearly inside right frame doing "Huh?!" ("あれ？") then cheering as player rescues Dad!
      this.girl.group.visible = true;
      this.girl.setSeated(false);
      this.girl.group.position.set(1.56, 0, 0.85);
      this.girl.group.rotation.set(0, -0.52, 0);
      this.girl.setMood('huh', 1.5);

      this.sound.playTurboInflate(1.25);
      this.sound.playReaction('dad', 'muffled');
      this.sunLight.position.set(5.2, 9.8, 5.6);
      this.sunLight.target.position.set(0, 0.7, 0.0);
    } else if (newStage === 3) {
      // Stage 3: Sunlit Backyard Pool Sandbox!
      this.outfitRack.group.visible = false;
      this.cylinderPump.group.visible = false;
      this.cylinderPump.hoseWorldGroup.visible = false;
      this.turboPump.group.visible = false;
      this.turboPump.hoseWorldGroup.visible = false;
      this.stickerTray.visible = false;

      // Poolside Yellow Bellows Pump on right deck
      this.bellowsPump.group.visible = true;
      this.bellowsPump.hoseWorldGroup.visible = true;
      this.bellowsPump.group.position.set(2.92, 0.0, -4.85);
      this.bellowsPump.group.rotation.y = 2.4;
      this.bellowsPump.connectedFloat = null;
      this.bellowsPump.updateVisuals();

      this.octopusFloat.pressure = Math.max(0.45, this.octopusFloat.pressure);
      this.swanFloat.pressure = Math.max(0.45, this.swanFloat.pressure);
      this.donutFloat.pressure = Math.max(0.45, this.donutFloat.pressure);
      this.octopusFloat.giantScale = THREE.MathUtils.clamp(this.octopusFloat.giantScale, 0.92, 1.18);
      this.swanFloat.giantScale = 0.98;
      this.donutFloat.giantScale = 0.98;

      const pz = this.world.poolCenter.z;
      const startCoords = [
        [-1.42, pz - 0.18],
        [0.02, pz + 0.28],
        [1.45, pz - 0.20]
      ];
      const startSpins = [0.28, Math.PI * 0.78, -0.32];
      this.floats.forEach((f, idx) => {
        f.rider = null;
        f.valveOpen = false;
        f.poolPos.set(startCoords[idx][0], startCoords[idx][1]);
        f.poolVel.set((Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2);
        f.bobOffset = 0.18;
        f.bobVel = -1.2;
        f.spinAngle = startSpins[idx];
        f.group.rotation.set(0, startSpins[idx], 0);
        this.world.spawnWaterSplash(f.poolPos.x, f.poolPos.y, 0.65, this.elapsed || 0.1);
      });
      this.sound.playWaterSplash(0.8);

      // Place Dad, Mom, and Daughter clearly visible around the sunlit back/side pool deck facing camera!
      this.dad.group.position.set(-1.95, 0.0, pz - 2.22);
      this.dad.group.rotation.set(0, 0.28, 0);
      this.mom.group.position.set(0.0, 0.0, pz - 2.26);
      this.mom.group.rotation.set(0, 0.0, 0);
      this.girl.group.position.set(1.95, 0.0, pz - 2.22);
      this.girl.group.rotation.set(0, -0.28, 0);

      this.familyPoolDeckSlots = [
        { char: this.dad, home: this.dad.group.position.clone(), homeRot: 0.28, mass: 1.48, favFloat: 'octopus', name: 'dad', ridingFloat: null },
        { char: this.mom, home: this.mom.group.position.clone(), homeRot: 0.0, mass: 1.02, favFloat: 'swan', name: 'mom', ridingFloat: null },
        { char: this.girl, home: this.girl.group.position.clone(), homeRot: -0.28, mass: 0.65, favFloat: 'donut', name: 'girl', ridingFloat: null }
      ];
      this.familyPoolDeckSlots.forEach((slot) => {
        slot.char.group.visible = true;
        slot.char.setSeated(false);
        slot.char.setMood('happy', 0);
      });

      this.sunLight.position.set(4.8, 10.2, -1.2);
      this.sunLight.target.position.set(0, 0.2, pz);
    }

    this._updateResponsiveCamera(instant);
  }

  _updateResponsiveCamera(instant = false) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const aspect = w / Math.max(1, h);
    this.camera.aspect = aspect;

    // Exact horizontal-fit scaling so narrow iPhone portrait (e.g. 390x844, aspect ~0.46) never clips side floats or outfits!
    const isPortrait = aspect < 1.15;
    const distPull = isPortrait ? (1.16 / Math.max(0.43, aspect)) * 0.88 : 1.0;
    this.camera.fov = isPortrait ? 48 : 43;
    this.camera.updateProjectionMatrix();

    if (this.stage === 0) {
      this.targetCamPos.set(-0.08, 1.38 + (distPull - 1.0) * 0.32, 3.85 * distPull);
      this.targetCamLook.set(-0.12, 0.78, 0.35);
    } else if (this.stage === 1) {
      this.targetCamPos.set(0.0, 2.48 * distPull, 3.48 * distPull);
      this.targetCamLook.set(0.0, 0.22, 0.32);
    } else if (this.stage === 2) {
      this.targetCamPos.set(0.0, 1.82 + (distPull - 1.0) * 0.42, 3.95 * distPull);
      this.targetCamLook.set(-0.05, 0.68, -0.05);
    } else {
      const pz = this.world.poolCenter.z;
      this.targetCamPos.set(0.0, 2.88 * distPull, pz + 4.25 * distPull);
      this.targetCamLook.set(0.0, 0.20, pz - 0.32);
    }

    if (instant) {
      this.camPos.copy(this.targetCamPos);
      this.camLook.copy(this.targetCamLook);
      this.camera.position.copy(this.camPos);
      this.camera.lookAt(this.camLook);
    }
  }

  _setupInput() {
    this.raycaster = new THREE.Raycaster();
    this.pointerNDC = new THREE.Vector2();
    this.activePointerId = null;
    this.dragAction = null;
    this.floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.waterPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.34);

    const dom = this.renderer.domElement;

    dom.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.sound.unlock();
      if (this.activePointerId !== null) return; // Single-finger clean control; ignore extra fingers safely
      this.activePointerId = e.pointerId;
      this.idleTime = 0;
      this._updateNDC(e);
      this._onPointerDown();
    }, { passive: false });

    dom.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.activePointerId) return;
      e.preventDefault();
      this.idleTime = 0;
      this._updateNDC(e);
      this._onPointerMove();
    }, { passive: false });

    const endHandler = (e) => {
      if (e.pointerId !== this.activePointerId) return;
      this.activePointerId = null;
      this._onPointerUp();
    };
    dom.addEventListener('pointerup', endHandler);
    dom.addEventListener('pointercancel', endHandler);
    dom.addEventListener('pointerleave', endHandler);
  }

  _updateNDC(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointerNDC, this.camera);
  }

  _intersectFloor(y = 0.0, out = new THREE.Vector3()) {
    this.floorPlane.constant = -y;
    return this.raycaster.ray.intersectPlane(this.floorPlane, out);
  }

  _onPointerDown() {
    if (this.transitionPending) return;

    if (this.stage === 0) {
      // Check Outfit Hangers!
      const hitBoxes = this.outfitRack.hangers.map((h) => h.hitBox);
      const hits = this.raycaster.intersectObjects(hitBoxes, false);
      if (hits.length > 0) {
        const idx = hits[0].object.userData.outfitIndex;
        this._selectOutfit(idx, hits[0].point);
        return;
      }
      // Subtle reaction if tapping Girl or deflated floats
      const girlHits = this.raycaster.intersectObject(this.girl.group, true);
      if (girlHits.length > 0) {
        this.girl.setMood('excited', 1.2);
        this.sound.playReaction('girl', 'happy');
        this.playerHand.setTouchWorld(girlHits[0].point, true);
        return;
      }
      const p = new THREE.Vector3();
      if (this._intersectFloor(0.5, p)) {
        this.playerHand.setTouchWorld(p, true);
      }
      return;
    }

    if (this.stage === 1) {
      this._handleStage1Down();
      return;
    }

    if (this.stage === 2) {
      this._handleStage2Down();
      return;
    }

    if (this.stage === 3) {
      this._handleStage3Down();
    }
  }

  _selectOutfit(idx, hitPoint) {
    this.transitionPending = true;
    this.girl.applyOutfit(idx);
    this.playerHand.applyOutfit(idx);
    this.playerHand.setTouchWorld(hitPoint, true);
    this.sound.playOutfitSelect(idx);
    this.sound.playReaction('girl', 'happy');
    this.girl.setMood('excited', 1.5);

    // Animate selected hanger scaling toward Girl
    const chosen = this.outfitRack.hangers[idx].group;
    chosen.scale.setScalar(1.18);

    setTimeout(() => {
      chosen.scale.setScalar(1.0);
      this.playerHand.setTouchWorld(null, false);
      this._enterStage(1, false);
    }, 950);
  }

  _handleStage1Down() {
    // 1. Check Sticker Pickups!
    const stickerHits = this.raycaster.intersectObjects(this.stickerPickups, false);
    if (stickerHits.length > 0) {
      const col = stickerHits[0].object.userData.stickerColor;
      this.sound.playValvePop(true);
      this.dragAction = { type: 'sticker', color: col };
      this.playerHand.setTouchWorld(stickerHits[0].point, true);
      return;
    }

    // 2. Check Nozzle Drag (moving pump hose to another float!)
    const nozzles = [
      { mesh: this.bellowsPump.nozzleMesh, pump: this.bellowsPump },
      { mesh: this.cylinderPump.nozzleMesh, pump: this.cylinderPump }
    ];
    for (const n of nozzles) {
      const nh = this.raycaster.intersectObject(n.mesh, true);
      if (nh.length > 0) {
        this.sound.playValvePop(false);
        n.pump.connectedFloat = null;
        this.dragAction = { type: 'hose', pump: n.pump };
        this.playerHand.setTouchWorld(nh[0].point, true);
        return;
      }
    }

    // 3. Check Pressing / Holding Air Pumps!
    const pumps = [this.bellowsPump, this.cylinderPump];
    for (const pump of pumps) {
      const ph = this.raycaster.intersectObject(pump.group, true);
      if (ph.length > 0) {
        this._startPumpHold(pump, ph[0].point);
        return;
      }
    }

    // 4. Check Touching Floats (or Clear Air Valve!)
    for (const f of this.floats) {
      const vh = this.raycaster.intersectObject(f.valveGroup, true);
      if (vh.length > 0 && f.pressure > 0.22) {
        // Touching clear valve lets out a controlled puff of air!
        f.valveOpen = true;
        this.sound.playAirRelease(0.35, f.pressure);
        const vp = f.getValveWorldPosition();
        this.world.spawnAirJet(vp, new THREE.Vector3(0.2, 1.0, 0.2), 10, 2.2);
        this.dragAction = { type: 'valveRelease', float: f };
        this.playerHand.setTouchWorld(vh[0].point, true);
        return;
      }

      const fh = this.raycaster.intersectObject(f.group, true);
      if (fh.length > 0) {
        const pt = fh[0].point;
        this.playerHand.setTouchWorld(pt, true);

        // Tolerant smart mapping for 5yo:
        // If this float has no pump connected and is still quite flat, snap the closest pump hose right onto it and give a starter puff!
        const connectedPump = [this.bellowsPump, this.cylinderPump].find((p) => p.connectedFloat === f);
        if (!connectedPump && f.pressure < 0.42) {
          const nearestPump = f.group.position.x <= 0 ? this.bellowsPump : this.cylinderPump;
          nearestPump.connectedFloat = f;
          nearestPump.updateVisuals();
          this.sound.playValvePop(true);
          this._startPumpHold(nearestPump, pt);
          return;
        }

        // Otherwise: tactile vinyl poke, squeeze & slide! (Can slide inflated float toward garden doorway!)
        f.triggerPoke(pt, 1.0);
        this.sound.playVinylSqueak(0.75, 0.9 + f.pressure * 0.25);
        if (f.pressure > 0.35) {
          this.sound.playVinylBounce(f.pressure, 1.0);
        }
        this.dragAction = {
          type: 'pokeOrSlideFloat',
          float: f,
          startPos: f.group.position.clone(),
          grabOffset: f.group.position.clone().sub(pt)
        };
        return;
      }
    }

    // 5. Touching Girl or Background Plant
    const gh = this.raycaster.intersectObject(this.girl.group, true);
    if (gh.length > 0) {
      this.girl.setMood('excited', 1.2);
      this.sound.playReaction('girl', 'happy');
      this.playerHand.setTouchWorld(gh[0].point, true);
      return;
    }
    const plh = this.raycaster.intersectObject(this.world.plantGroup, true);
    if (plh.length > 0) {
      this.airWindBoost = 0.8;
      this.playerHand.setTouchWorld(plh[0].point, true);
    }
  }

  _startPumpHold(pump, touchPoint) {
    // Ensure pump is connected to a float (auto-connect nearest if disconnected)
    if (!pump.connectedFloat) {
      let best = this.floats[0];
      let bestD = 999;
      for (const f of this.floats) {
        const d = f.group.position.distanceTo(pump.group.position);
        if (d < bestD) {
          bestD = d;
          best = f;
        }
      }
      pump.connectedFloat = best;
    }

    const f = pump.connectedFloat;
    if (f.pumpOrderIndex < 0) {
      f.pumpOrderIndex = this.inflationSequenceCounter++;
    }
    f.pumpStrokeCount++;

    pump.compression = 0.45;
    pump.updateVisuals();
    this.playerHand.setTouchWorld(touchPoint, true);

    // Immediate crisp initial puff (<100ms feedback!)
    const instantGain = pump.pumpType === 'cylinder' ? 0.11 : 0.085;
    this._inflateFloatBy(f, instantGain, pump.pumpType, 0.5);

    this.dragAction = {
      type: 'pumpHold',
      pump,
      holdTime: 0,
      startY: this.pointerNDC.y
    };
  }

  _inflateFloatBy(floatObj, amount, pumpType = 'bellows', holdStrength = 0.5) {
    if (floatObj.releasingAir > 0) return;

    floatObj.pressure += amount;
    floatObj.wobbleAmp = Math.min(1.0, floatObj.wobbleAmp + 0.28);
    this.sound.playPumpStroke(pumpType, floatObj.pressure, holdStrength);

    const vp = floatObj.getValveWorldPosition();
    this.world.spawnAirJet(vp, new THREE.Vector3(0, 0.6, 0), 4, 1.1);

    // Keep float resting naturally on floor
    if (this.stage === 1) {
      floatObj.group.position.y = floatObj.getBottomHalfHeight();
    }

    // Over-inflation check! ("入れすぎるとプシューと少し抜ける")
    if (floatObj.pressure > 1.08) {
      floatObj.releasingAir = 0.95;
      floatObj.valveOpen = true;
      this.airWindBoost = 1.0;
      this.sound.playAirRelease(0.92, 1.15);
      this.world.spawnAirJet(vp, new THREE.Vector3(0.25, 1.0, 0.35), 26, 3.4);
      this.girl.setMood('huh', 0.65);
      this.sound.playReaction('girl', 'huh');
      setTimeout(() => {
        if (this.stage === 1 || this.stage === 3) {
          this.sound.playReaction('girl', 'happy');
        }
      }, 650);
    } else if (floatObj.pressure > 0.72 && Math.random() < 0.45) {
      this.girl.setMood('excited', 1.1);
    }

    this._checkStage1Completion();
  }

  _checkStage1Completion() {
    if (this.stage !== 1 || this.transitionPending) return;
    // Let the child inflate all 3 floats at least past half-full (so Swan, Octopus, Donut all come alive!)
    // OR slide an inflated float out when at least 2 floats are ready.
    const readyCount = this.floats.filter((f) => f.pressure >= 0.52 && f.releasingAir <= 0).length;
    if (readyCount === 3 && this.stageTime > 4.0) {
      this.transitionPending = true;
      this.girl.setMood('excited', 1.8);
      this.sound.playReaction('girl', 'happy');
      setTimeout(() => {
        this.playerHand.setTouchWorld(null, false);
        this._enterStage(2, false);
      }, 1150);
    }
  }

  _handleStage2Down() {
    if (this.mishapInflating) return;

    // 1. Playful curiosity: What if she taps Dad's Orange Turbo Blower on the floor?!
    // -> Puffs the giant Octopus slightly bigger again, Dad goes "Huh?!" ("あれ？") -> then laughs!
    const th = this.raycaster.intersectObject(this.turboPump.group, true);
    if (th.length > 0) {
      this.playerHand.setTouchWorld(th[0].point, true);
      this.octopusFloat.giantScale = Math.min(2.38, this.octopusFloat.giantScale + 0.22);
      this.octopusFloat.wobbleAmp = 0.85;
      this.sound.playPumpStroke('cylinder', 1.1, 0.9);
      this.dad.setMood('huh', 0.9);
      this.girl.setMood('huh', 0.8);
      this.sound.playReaction('dad', 'huh');
      return;
    }

    // 2. Pressing / Holding anywhere on the Giant Glossy Octopus (or its clear air valve)!
    const oh = this.raycaster.intersectObject(this.octopusFloat.group, true);
    if (oh.length > 0) {
      const pt = oh[0].point;
      this.playerHand.setTouchWorld(pt, true);
      this.octopusFloat.valveOpen = true;
      this.octopusFloat.triggerPoke(pt, 1.25);

      const valveHit = this.raycaster.intersectObject(this.octopusFloat.valveGroup, true).length > 0;
      const rate = valveHit ? 0.52 : 0.36;

      this.sound.playVinylSqueak(0.95, 0.78);
      this.sound.playAirRelease(0.65, this.octopusFloat.giantScale * 0.5);

      const jetDir = pt.clone().sub(this.octopusFloat.group.position).normalize().add(new THREE.Vector3(0, 0.5, 0)).normalize();
      this.world.spawnAirJet(pt, jetDir, 16, 3.1);
      this.airWindBoost = 1.0;

      this.dragAction = {
        type: 'deflateGiantOctopus',
        rate,
        lastHiss: 0,
        startPoint: pt.clone()
      };
      return;
    }

    // 3. Touching Dad's wiggling legs/arms!
    const dh = this.raycaster.intersectObject(this.dad.group, true);
    if (dh.length > 0) {
      this.playerHand.setTouchWorld(dh[0].point, true);
      this.dad.setMood('excited', 1.1);
      this.sound.playReaction('dad', 'muffled');
      this.octopusFloat.wobbleAmp = 0.55;
    }
  }

  _handleStage3Down() {
    // 1. Poolside Yellow Bellows Pump (allows adding air even in Scene 3!)
    const ph = this.raycaster.intersectObject(this.bellowsPump.group, true);
    if (ph.length > 0) {
      // Connect to closest float in pool and pump a puff!
      let nearest = this.floats[0];
      let bestD = 999;
      for (const f of this.floats) {
        const d = f.group.position.distanceTo(this.bellowsPump.group.position);
        if (d < bestD) {
          bestD = d;
          nearest = f;
        }
      }
      this.bellowsPump.connectedFloat = nearest;
      this._startPumpHold(this.bellowsPump, ph[0].point);
      return;
    }

    // 2. Check Family Members (Dad, Mom, Daughter) to drag onto any float or bounce!
    for (const slot of this.familyPoolDeckSlots) {
      const ch = this.raycaster.intersectObject(slot.char.group, true);
      if (ch.length > 0) {
        this.playerHand.setTouchWorld(ch[0].point, true);
        // Detach if currently riding a float
        if (slot.ridingFloat) {
          slot.ridingFloat.rider = null;
          slot.ridingFloat = null;
        }
        slot.char.setSeated(false);
        slot.char.setMood('excited', 1.2);
        this.sound.playReaction(slot.name, 'happy');
        this.dragAction = {
          type: 'dragCharacter',
          slot
        };
        return;
      }
    }

    // 3. Check Vinyl Floats in the Pool (drag across water, tap valve to soften, or hold down & launch splash!)
    for (const f of this.floats) {
      const vh = this.raycaster.intersectObject(f.valveGroup, true);
      if (vh.length > 0 && f.pressure > 0.35) {
        f.valveOpen = true;
        this.sound.playAirRelease(0.35, f.pressure);
        this.world.spawnAirJet(f.getValveWorldPosition(), new THREE.Vector3(0, 1, 0), 10, 2.0);
        this.dragAction = { type: 'valveRelease', float: f };
        this.playerHand.setTouchWorld(vh[0].point, true);
        return;
      }

      const fh = this.raycaster.intersectObject(f.group, true);
      if (fh.length > 0) {
        const pt = fh[0].point;
        this.playerHand.setTouchWorld(pt, true);
        f.triggerPoke(pt, 1.0);
        this.sound.playVinylSqueak(0.7, 0.95);
        this.sound.playVinylBounce(f.pressure, f.giantScale);

        // Push down into water on grab!
        f.bobVel -= 1.65;
        this.world.addWaterRipple(f.poolPos.x, f.poolPos.y, 0.055, this.elapsed);

        this.dragAction = {
          type: 'poolFloat',
          float: f,
          holdTime: 0,
          lastPos: new THREE.Vector2(f.poolPos.x, f.poolPos.y),
          movedDist: 0
        };
        return;
      }
    }

    // 4. Touching / Stirring the Sparkling Pool Water Directly!
    const wh = this.raycaster.intersectObject(this.world.waterMesh, false);
    if (wh.length > 0) {
      const pt = wh[0].point;
      this.playerHand.setTouchWorld(pt, true);
      this.world.spawnWaterSplash(pt.x, pt.z, 0.45, this.elapsed);
      this.sound.playWaterSplash(0.42);
      this.dragAction = { type: 'stirWater', lastRipple: 0 };
    }
  }

  _onPointerMove() {
    if (!this.dragAction) return;

    if (this.dragAction.type === 'sticker') {
      const pt = new THREE.Vector3();
      if (this._intersectFloor(0.55, pt)) {
        this.playerHand.setTouchWorld(pt, true);
      }
      return;
    }

    if (this.dragAction.type === 'hose') {
      const pt = new THREE.Vector3();
      if (this._intersectFloor(0.32, pt)) {
        // Magnetic snap preview onto nearby float valve!
        for (const f of this.floats) {
          const vp = f.getValveWorldPosition();
          if (vp.distanceTo(pt) < 0.62) {
            pt.copy(vp).add(new THREE.Vector3(0, 0.05, 0));
            break;
          }
        }
        this.dragAction.pump.updateVisuals(pt);
        this.playerHand.setTouchWorld(pt, true);
      }
      return;
    }

    if (this.dragAction.type === 'pumpHold') {
      // Allow up-and-down pumping motion on cylinder pump for extra active play!
      const dy = Math.abs(this.pointerNDC.y - this.dragAction.startY);
      if (dy > 0.14) {
        this.dragAction.startY = this.pointerNDC.y;
        const f = this.dragAction.pump.connectedFloat;
        if (f) this._inflateFloatBy(f, 0.09, this.dragAction.pump.pumpType, 0.7);
      }
      return;
    }

    if (this.dragAction.type === 'pokeOrSlideFloat') {
      const f = this.dragAction.float;
      const fh = this.raycaster.intersectObject(f.group, true);
      if (fh.length > 0) {
        f.triggerPoke(fh[0].point, 1.0);
        this.playerHand.setTouchWorld(fh[0].point, true);
      }
      const floorPt = new THREE.Vector3();
      if (this._intersectFloor(0.2, floorPt)) {
        const targetX = THREE.MathUtils.clamp(floorPt.x + this.dragAction.grabOffset.x, -1.85, 1.85);
        const targetZ = THREE.MathUtils.clamp(floorPt.z + this.dragAction.grabOffset.z, -1.25, 0.95);
        f.group.position.x = THREE.MathUtils.lerp(f.group.position.x, targetX, 0.35);
        f.group.position.z = THREE.MathUtils.lerp(f.group.position.z, targetZ, 0.35);
        this.bellowsPump.updateVisuals();
        this.cylinderPump.updateVisuals();

        // If player slides an inflated float into the open veranda doorway (-Z < -0.95) and at least 2 floats have air -> advance!
        const readyCount = this.floats.filter((fl) => fl.pressure >= 0.45).length;
        if (targetZ < -0.95 && f.pressure >= 0.45 && readyCount >= 2 && !this.transitionPending) {
          this.transitionPending = true;
          this.sound.playReaction('girl', 'happy');
          setTimeout(() => this._enterStage(2, false), 550);
        }
      }
      return;
    }

    if (this.dragAction.type === 'deflateGiantOctopus') {
      const oh = this.raycaster.intersectObject(this.octopusFloat.group, true);
      if (oh.length > 0) {
        this.octopusFloat.triggerPoke(oh[0].point, 1.3);
        this.playerHand.setTouchWorld(oh[0].point, true);
      }
      return;
    }

    if (this.dragAction.type === 'dragCharacter') {
      const pt = new THREE.Vector3();
      if (this._intersectFloor(0.75, pt)) {
        pt.x = THREE.MathUtils.clamp(pt.x, -2.9, 2.9);
        pt.z = THREE.MathUtils.clamp(pt.z, this.world.poolCenter.z - 2.2, this.world.poolCenter.z + 2.5);
        const char = this.dragAction.slot.char;
        char.group.position.set(pt.x, 0.68, pt.z);
        char.group.rotation.y = 0.0;
        this.playerHand.setTouchWorld(pt.clone().add(new THREE.Vector3(0, 0.4, 0)), true);
      }
      return;
    }

    if (this.dragAction.type === 'poolFloat') {
      const pt = new THREE.Vector3();
      if (this._intersectFloor(this.world.waterSurfaceY, pt)) {
        const f = this.dragAction.float;
        const margin = 0.85 * f.giantScale;
        const nx = THREE.MathUtils.clamp(pt.x, -this.world.poolHalfW + margin, this.world.poolHalfW - margin);
        const nz = THREE.MathUtils.clamp(
          pt.z,
          this.world.poolCenter.z - this.world.poolHalfD + margin,
          this.world.poolCenter.z + this.world.poolHalfD - margin
        );
        const vx = (nx - f.poolPos.x) * 14.0;
        const vz = (nz - f.poolPos.y) * 14.0;
        this.dragAction.movedDist += Math.hypot(nx - f.poolPos.x, nz - f.poolPos.y);
        f.poolPos.set(nx, nz);
        f.poolVel.set(THREE.MathUtils.clamp(vx, -3.5, 3.5), THREE.MathUtils.clamp(vz, -3.5, 3.5));
        this.playerHand.setTouchWorld(new THREE.Vector3(nx, this.world.waterSurfaceY + 0.25, nz), true);

        if (this.bellowsPump.connectedFloat === f) {
          this.bellowsPump.updateVisuals();
        }
      }
      return;
    }

    if (this.dragAction.type === 'stirWater') {
      const pt = new THREE.Vector3();
      if (this._intersectFloor(this.world.waterSurfaceY, pt)) {
        this.playerHand.setTouchWorld(pt, true);
        if (this.elapsed - this.dragAction.lastRipple > 0.07) {
          this.dragAction.lastRipple = this.elapsed;
          this.world.addWaterRipple(pt.x, pt.z, 0.052, this.elapsed);
          this.sound.playRipple();
        }
      }
    }
  }

  _onPointerUp() {
    this.playerHand.setTouchWorld(null, false);
    this.floats.forEach((f) => f.releasePoke());

    if (!this.dragAction) return;
    const act = this.dragAction;
    this.dragAction = null;

    if (act.type === 'sticker') {
      // Stick waterproof puffy vinyl star onto touched float!
      for (const f of this.floats) {
        const fh = this.raycaster.intersectObject(f.group, true);
        if (fh.length > 0) {
          f.addSticker(act.color, fh[0].point);
          f.wobbleAmp = 0.35;
          this.sound.playVinylSqueak(0.8, 1.2);
          this.girl.setMood('excited', 1.1);
          break;
        }
      }
      return;
    }

    if (act.type === 'hose') {
      // Magnetic snap onto closest float valve!
      let bestFloat = null;
      let bestDist = 0.85;
      for (const f of this.floats) {
        const d = f.getValveWorldPosition().distanceTo(act.pump.nozzleWorldPos);
        if (d < bestDist) {
          bestDist = d;
          bestFloat = f;
        }
      }
      act.pump.connectedFloat = bestFloat;
      act.pump.updateVisuals();
      if (bestFloat) {
        this.sound.playValvePop(true);
        bestFloat.wobbleAmp = 0.3;
      }
      return;
    }

    if (act.type === 'pumpHold') {
      act.pump.compression = 0;
      act.pump.updateVisuals();
      return;
    }

    if (act.type === 'valveRelease') {
      act.float.valveOpen = false;
      return;
    }

    if (act.type === 'deflateGiantOctopus') {
      this.octopusFloat.valveOpen = false;
      return;
    }

    if (act.type === 'poolFloat') {
      // If held down in water without dragging far, release creates a buoyant upward POP & SPLASH!
      const f = act.float;
      if (act.holdTime > 0.22 && act.movedDist < 0.45) {
        const popStrength = Math.min(1.4, 0.55 + act.holdTime * 0.75) * (0.5 + f.pressure * 0.7);
        f.bobVel += 3.2 * popStrength;
        this.world.spawnWaterSplash(f.poolPos.x, f.poolPos.y, 0.65 * popStrength, this.elapsed);
        this.sound.playWaterSplash(0.7 * popStrength);
        this.sound.playVinylBounce(f.pressure, f.giantScale);
        if (f.rider) {
          f.rider.char.setMood('excited', 1.5);
          this.sound.playReaction(f.rider.name, 'happy');
        }
      }
      return;
    }

    if (act.type === 'dragCharacter') {
      const slot = act.slot;
      const cPos = slot.char.group.position;

      // Find closest vinyl float within generous magnetic landing radius!
      let targetFloat = null;
      let bestDist = 1.28;
      for (const f of this.floats) {
        const d = Math.hypot(cPos.x - f.poolPos.x, cPos.z - f.poolPos.y);
        if (d < bestDist) {
          bestDist = d;
          targetFloat = f;
        }
      }

      if (targetFloat) {
        // If another family member was already on this float, playfully bounce them back poolside with a splash!
        if (targetFloat.rider && targetFloat.rider !== slot) {
          const prev = targetFloat.rider;
          prev.ridingFloat = null;
          prev.char.setSeated(false);
          prev.char.group.position.copy(prev.home);
          prev.char.group.rotation.set(0, prev.homeRot, 0);
          prev.char.setMood('huh', 0.8);
        }

        targetFloat.rider = slot;
        slot.ridingFloat = targetFloat;
        slot.char.setSeated(true);

        // Physics response depends on Mass × Float Type × Continuous Inflation Pressure!
        const p = targetFloat.pressure;
        const compliance = 1.35 - Math.min(1.1, p) * 0.65; // Softer float = deeper plunge & bigger wallow!
        const splashPower = slot.mass * (0.62 + compliance * 0.42);

        targetFloat.bobVel -= 2.8 * slot.mass * compliance;
        targetFloat.wobbleAmp = Math.min(1.0, 0.45 + slot.mass * 0.4);
        targetFloat.tiltVelX += (Math.random() - 0.5) * 3.5 * slot.mass;
        targetFloat.tiltVelZ += (Math.random() - 0.5) * 3.5 * slot.mass;

        if (targetFloat.type === 'octopus') {
          targetFloat.spinVel += (slot.mass > 1.2 ? 1.8 : 2.6) * (Math.random() < 0.5 ? -1 : 1);
        } else if (targetFloat.type === 'swan') {
          targetFloat.poolVel.add(new THREE.Vector2((Math.random() - 0.5) * 1.4, -0.85));
        }

        this.world.spawnWaterSplash(targetFloat.poolPos.x, targetFloat.poolPos.y, splashPower, this.elapsed);
        this.sound.playWaterSplash(splashPower);
        this.sound.playVinylBounce(p, targetFloat.giantScale);

        // "違う物を渡すと相手は「あれ？」の顔→喜ぶ"
        // If placed on a float different from their expected favorite OR super soft/overtight float:
        // show cute "Huh?!" ("あれ？") expression first, then burst into delighted laughter!
        if (targetFloat.type !== slot.favFloat || p < 0.52 || p > 0.98) {
          slot.char.setMood('huh', 0.82);
          this.sound.playReaction(slot.name, 'huh');
          setTimeout(() => {
            if (slot.ridingFloat === targetFloat) {
              this.sound.playReaction(slot.name, 'happy');
            }
          }, 820);
        } else {
          slot.char.setMood('excited', 1.8);
          this.sound.playReaction(slot.name, 'happy');
        }
      } else {
        // Check if dropped directly in pool water -> playful cannonball splash, then hops safely back to deck!
        const inPool =
          Math.abs(cPos.x - this.world.poolCenter.x) < this.world.poolHalfW &&
          Math.abs(cPos.z - this.world.poolCenter.z) < this.world.poolHalfD;
        if (inPool) {
          this.world.spawnWaterSplash(cPos.x, cPos.z, 0.85 * slot.mass, this.elapsed);
          this.sound.playWaterSplash(0.85 * slot.mass);
          slot.char.setMood('huh', 0.75);
          this.sound.playReaction(slot.name, 'huh');
        }
        slot.char.setSeated(false);
        slot.char.group.position.copy(slot.home);
        slot.char.group.rotation.set(0, slot.homeRot, 0);
      }
    }
  }

  _updateStageSimulations(dt) {
    // Continuous hold actions!
    if (this.dragAction) {
      if (this.dragAction.type === 'pumpHold') {
        this.dragAction.holdTime += dt;
        const pump = this.dragAction.pump;
        // Rhythmic pumping oscillation while finger holds down: longer hold = deeper strokes & more air!
        pump.compression = 0.55 + Math.sin(this.dragAction.holdTime * 11.0) * 0.42;
        pump.updateVisuals();
        const f = pump.connectedFloat;
        if (f && f.releasingAir <= 0) {
          const flowRate = pump.pumpType === 'cylinder' ? 0.34 : 0.27;
          f.pressure += flowRate * dt;
          if (this.stage === 1) f.group.position.y = f.getBottomHalfHeight();
          if (Math.floor((this.dragAction.holdTime - dt) * 3.5) !== Math.floor(this.dragAction.holdTime * 3.5)) {
            this._inflateFloatBy(f, 0.02, pump.pumpType, Math.min(1, this.dragAction.holdTime));
          } else if (f.pressure > 1.08) {
            this._inflateFloatBy(f, 0.001, pump.pumpType, 1.0);
          }
        }
      } else if (this.dragAction.type === 'valveRelease') {
        const f = this.dragAction.float;
        f.pressure = Math.max(0.18, f.pressure - dt * 0.26);
        if (this.stage === 1) f.group.position.y = f.getBottomHalfHeight();
      } else if (this.dragAction.type === 'deflateGiantOctopus') {
        // Stage 2: Continuous air release while pressing the giant Octopus!
        this.octopusFloat.giantScale = Math.max(1.02, this.octopusFloat.giantScale - dt * this.dragAction.rate);
        this.octopusFloat.pressure = Math.max(0.58, this.octopusFloat.pressure - dt * 0.14);
        this.octopusFloat.wobbleAmp = Math.max(this.octopusFloat.wobbleAmp, 0.28);
        this.airWindBoost = 0.85;

        this.dragAction.lastHiss += dt;
        if (this.dragAction.lastHiss > 0.24) {
          this.dragAction.lastHiss = 0;
          const vp = this.octopusFloat.getValveWorldPosition();
          this.world.spawnAirJet(vp, new THREE.Vector3(0.3, 0.9, 0.3), 10, 2.8);
          this.sound.playAirRelease(0.32, this.octopusFloat.giantScale * 0.5);
        }
      } else if (this.dragAction.type === 'poolFloat') {
        this.dragAction.holdTime += dt;
        // Holding float pushes it steadily down into the water!
        this.dragAction.float.bobOffset = THREE.MathUtils.lerp(this.dragAction.float.bobOffset, -0.18, dt * 6);
      }
    }

    // Over-inflation automatic valve relief ("入れすぎるとプシューと少し抜ける")
    for (const f of this.floats) {
      if (f.releasingAir > 0) {
        f.releasingAir -= dt;
        f.pressure = Math.max(0.74, f.pressure - dt * 0.42);
        f.wobbleAmp = 0.42;
        if (this.stage === 1) {
          f.group.position.y = f.getBottomHalfHeight();
        }
        if (f.releasingAir <= 0) {
          f.valveOpen = false;
        }
      }
    }

    // Stage 0 animation
    if (this.stage === 0) {
      this.outfitRack.update(this.elapsed);
      this.girl.update(dt, this.elapsed, this.outfitRack.group.position);
    }

    // Stage 1 animation
    if (this.stage === 1) {
      this.bellowsPump.updateVisuals();
      this.cylinderPump.updateVisuals();
      const activeFloat = this.bellowsPump.connectedFloat || this.floats[0];
      this.girl.update(dt, this.elapsed, activeFloat.group.position);
    }

    // Stage 2: Dad's Giant Octopus Mishap physics
    if (this.stage === 2) {
      if (this.mishapInflating) {
        this.octopusFloat.giantScale = THREE.MathUtils.lerp(this.octopusFloat.giantScale, 1.76, dt * 3.8);
        if (this.octopusFloat.giantScale > 1.72) {
          this.mishapInflating = false;
        }
      }

      const gs = this.octopusFloat.giantScale;
      this.octopusFloat.group.position.y = this.octopusFloat.getBottomHalfHeight() + 0.05;

      // Dad wiggles comically while buried under front-left of giant Octopus, then stands up relieved once freed!
      if (gs > 1.36) {
        this.dad.group.position.set(-1.18, 0.24, 0.55 + gs * 0.36);
        this.dad.leftLeg.rotation.x = -0.25 + Math.sin(this.elapsed * 9.0) * 0.36;
        this.dad.rightLeg.rotation.x = 0.15 - Math.sin(this.elapsed * 9.0) * 0.36;
        this.dad.leftArm.rotation.z = -2.2 + Math.sin(this.elapsed * 11.0) * 0.35;
        this.dad.rightArm.rotation.z = 1.8 - Math.sin(this.elapsed * 11.0) * 0.35;
        this.dad.update(dt, this.elapsed, null);
      } else {
        // Dad pops free and cheers!
        this.dad.group.position.lerp(new THREE.Vector3(-1.45, 0, 0.25), dt * 5);
        this.dad.group.rotation.x = THREE.MathUtils.lerp(this.dad.group.rotation.x, 0, dt * 6);
        this.dad.group.rotation.z = THREE.MathUtils.lerp(this.dad.group.rotation.z, 0, dt * 6);
        this.dad.group.rotation.y = THREE.MathUtils.lerp(this.dad.group.rotation.y, 0.38, dt * 6);
        this.dad.leftLeg.rotation.x = THREE.MathUtils.lerp(this.dad.leftLeg.rotation.x, 0, dt * 8);
        this.dad.rightLeg.rotation.x = THREE.MathUtils.lerp(this.dad.rightLeg.rotation.x, 0, dt * 8);
        this.dad.update(dt, this.elapsed, this.octopusFloat.group.position);

        // Once Octopus is deflated enough to fit smoothly through the veranda doorway -> glide out to the Pool!
        if (gs <= 1.24 && !this.transitionPending && !this.dragAction) {
          this.transitionPending = true;
          this.dad.setMood('excited', 2.0);
          this.girl.setMood('excited', 2.0);
          this.sound.playReaction('dad', 'happy');
          this.sound.playReaction('girl', 'happy');
          setTimeout(() => {
            this._enterStage(3, false);
          }, 1100);
        }
      }
      this.girl.update(dt, this.elapsed, this.octopusFloat.group.position);
    }

    // Stage 3: Full 2D + Buoyancy + Tilt + Elastic Vinyl Collision Pool Physics!
    if (this.stage === 3) {
      const pz = this.world.poolCenter.z;

      // Float-to-Float elastic vinyl collisions!
      for (let i = 0; i < this.floats.length; i++) {
        for (let j = i + 1; j < this.floats.length; j++) {
          const a = this.floats[i];
          const b = this.floats[j];
          const dx = b.poolPos.x - a.poolPos.x;
          const dz = b.poolPos.y - a.poolPos.y;
          const dist = Math.hypot(dx, dz);
          const minDist = (0.98 * a.giantScale + 0.98 * b.giantScale);
          if (dist > 0.001 && dist < minDist) {
            const nx = dx / dist;
            const nz = dz / dist;
            const overlap = (minDist - dist) * 0.5;
            a.poolPos.x -= nx * overlap;
            a.poolPos.y -= nz * overlap;
            b.poolPos.x += nx * overlap;
            b.poolPos.y += nz * overlap;

            const relVx = b.poolVel.x - a.poolVel.x;
            const relVz = b.poolVel.y - a.poolVel.y;
            const sepVel = relVx * nx + relVz * nz;
            if (sepVel < 0) {
              const impulse = -sepVel * 0.88;
              a.poolVel.x -= nx * impulse;
              a.poolVel.y -= nz * impulse;
              b.poolVel.x += nx * impulse;
              b.poolVel.y += nz * impulse;
              a.wobbleAmp = Math.min(1, a.wobbleAmp + impulse * 0.25);
              b.wobbleAmp = Math.min(1, b.wobbleAmp + impulse * 0.25);
              if (impulse > 0.35) {
                this.sound.playVinylBounce((a.pressure + b.pressure) * 0.5, 1.0);
                this.world.addWaterRipple((a.poolPos.x + b.poolPos.x) * 0.5, (a.poolPos.y + b.poolPos.y) * 0.5, 0.05, this.elapsed);
              }
            }
          }
        }
      }

      // Integrate each float's water drift, wall bounce, buoyancy spring, and rider posture
      for (const f of this.floats) {
        const isDragged = this.dragAction && this.dragAction.type === 'poolFloat' && this.dragAction.float === f;
        if (!isDragged) {
          f.poolPos.addScaledVector(f.poolVel, dt);
          f.poolVel.multiplyScalar(Math.pow(0.38, dt));

          // Pool wall gentle bounce
          const margin = 0.88 * f.giantScale;
          const minX = -this.world.poolHalfW + margin;
          const maxX = this.world.poolHalfW - margin;
          const minZ = pz - this.world.poolHalfD + margin;
          const maxZ = pz + this.world.poolHalfD - margin;

          if (f.poolPos.x < minX) { f.poolPos.x = minX; f.poolVel.x = Math.abs(f.poolVel.x) * 0.65; }
          if (f.poolPos.x > maxX) { f.poolPos.x = maxX; f.poolVel.x = -Math.abs(f.poolVel.x) * 0.65; }
          if (f.poolPos.y < minZ) { f.poolPos.y = minZ; f.poolVel.y = Math.abs(f.poolVel.y) * 0.65; }
          if (f.poolPos.y > maxZ) { f.poolPos.y = maxZ; f.poolVel.y = -Math.abs(f.poolVel.y) * 0.65; }
        }

        // Buoyancy stiffness scales with internal air pressure; equilibrium sink scales with rider weight!
        const riderMass = f.rider ? f.rider.mass : 0.0;
        const sinkEq = -riderMass * (0.11 - Math.min(1.0, f.pressure) * 0.045);
        const springK = 18.0 + f.pressure * 16.0;
        const damp = 3.2 + (1.2 - Math.min(1.1, f.pressure)) * 1.8;

        if (!isDragged || this.dragAction.holdTime < 0.15) {
          const force = (sinkEq - f.bobOffset) * springK - f.bobVel * damp;
          f.bobVel += force * dt;
          f.bobOffset += f.bobVel * dt;
        }

        // Rocking tilt & gentle spin
        f.tiltVelX += (-f.tiltX * 14.0 - f.tiltVelX * 2.8) * dt;
        f.tiltVelZ += (-f.tiltZ * 14.0 - f.tiltVelZ * 2.8) * dt;
        f.tiltX += f.tiltVelX * dt;
        f.tiltZ += f.tiltVelZ * dt;
        f.spinAngle += f.spinVel * dt;
        f.spinVel *= Math.pow(0.45, dt);

        const waveY = this.world.sampleWaveHeight(f.poolPos.x, f.poolPos.y, this.elapsed);
        const floatY = waveY + 0.11 * f.giantScale + f.bobOffset;

        f.group.position.set(f.poolPos.x, floatY, f.poolPos.y);
        f.group.rotation.set(
          f.tiltX + Math.sin(this.elapsed * 2.1 + f.poolPos.x) * 0.04,
          f.spinAngle,
          f.tiltZ + Math.cos(this.elapsed * 1.9 + f.poolPos.y) * 0.04
        );

        // Periodic subtle wake ripples when rider is kicking/bobbing!
        if (f.rider && Math.random() < dt * 2.2) {
          this.world.addWaterRipple(f.poolPos.x, f.poolPos.y, 0.022 * f.rider.mass, this.elapsed);
        }
      }

      // Update Family Members (seated on floats or standing poolside)
      for (const slot of this.familyPoolDeckSlots) {
        const isDraggedChar = this.dragAction && this.dragAction.type === 'dragCharacter' && this.dragAction.slot === slot;
        if (!isDraggedChar && slot.ridingFloat) {
          const rf = slot.ridingFloat;
          slot.char.group.position.set(
            rf.group.position.x,
            rf.group.position.y + 0.02,
            rf.group.position.z + (rf.type === 'swan' ? 0.08 : 0.04)
          );
          slot.char.group.rotation.set(
            rf.group.rotation.x * 0.7,
            Math.sin(this.elapsed * 0.8) * 0.25,
            rf.group.rotation.z * 0.7
          );
        }
        slot.char.update(dt, this.elapsed, this.camPos);
      }

      this.bellowsPump.updateVisuals();
    }

    // Gentle non-intrusive idle cue only after 9.5s of complete stillness ("放置時のみ1回実演/環境の動きでそっと誘う")
    if (!this.dragAction) {
      this.idleTime += dt;
      if (this.idleTime > 9.5 && !this.idleHintShown) {
        this.idleHintShown = true;
        if (this.stage === 0) {
          this.outfitRack.hangers[0].group.rotation.z = 0.18;
          this.girl.setMood('excited', 1.1);
        } else if (this.stage === 1) {
          this.bellowsPump.compression = 0.35;
          setTimeout(() => { this.bellowsPump.compression = 0; }, 280);
          this.octopusFloat.wobbleAmp = 0.28;
        } else if (this.stage === 2) {
          this.octopusFloat.wobbleAmp = 0.45;
          this.sound.playReaction('dad', 'muffled');
        } else if (this.stage === 3) {
          this.world.addWaterRipple(this.swanFloat.poolPos.x, this.swanFloat.poolPos.y, 0.055, this.elapsed);
          this.girl.setMood('excited', 1.1);
        }
      }
    }

    // Update all 3 soft-body vinyl floats!
    for (const f of this.floats) {
      f.updateDeformation(dt, this.elapsed);
    }
  }

  _animate() {
    requestAnimationFrame(this._animate);
    const dt = Math.min(0.05, this.clock.getDelta());
    this.elapsed += dt;
    this.stageTime += dt;
    this.airWindBoost = Math.max(0, this.airWindBoost - dt * 1.4);

    // Smooth cinematic camera glide
    this.camPos.lerp(this.targetCamPos, Math.min(1, dt * 3.8));
    this.camLook.lerp(this.targetCamLook, Math.min(1, dt * 4.2));
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);

    sharedVinylUniforms.uTime.value = this.elapsed;
    sharedVinylUniforms.uPoolMode.value = this.stage === 3 ? 1.0 : 0.0;

    this._updateStageSimulations(dt);
    this.playerHand.update(dt);
    this.world.update(dt, this.elapsed, this.airWindBoost);

    this.renderer.render(this.scene, this.camera);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new UkiwaSimulationApp();
});
