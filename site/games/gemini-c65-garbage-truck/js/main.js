import * as THREE from '../vendor/three.module.min.js';
import { SoundEngine } from './audio.js';
import {
  createDawnStreetEnvironment,
  createWetAsphaltTextures,
  createBrushedSteelTextures,
  createTruckPaintNormalMap,
  createFabricNormalMap,
  createHazardStripeTexture,
  createConcreteTexture,
  createGloveTexture,
  createCrateEmblemTexture,
  createPictorialSignboardTexture,
  createNewspaperTexture,
  createCanLabelTexture,
  createFoliageTexture,
} from './textures.js';
import { MorningStreetEnvironment } from './environment.js';
import { GarbageTruck } from './truck.js';
import {
  setCharacterFabricNormal,
  GirlCharacter,
  PlayerGlovedHand,
  DadWorker,
  TownKid,
} from './characters.js';
import {
  applyCrushDeformation,
  createDressUpStand,
  createSortingCrates,
  createRecyclableItem,
  createTownGarbageBag,
  createRealisticFlower,
  createRecycledPinwheel,
  FlutteringPaperSystem,
} from './items.js';

class GarbageTruckGame {
  constructor() {
    this.container = document.getElementById('app');
    this.replayBtn = document.getElementById('replay-btn');
    this.sound = new SoundEngine();

    // Renderer strictly obeying pixelRatio <= 1.5, ACESFilmic photorealistic tone mapping, PCFSoftShadowMap
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();

    // Low-angle child's-eye camera looking slightly upward at the towering Garbage Truck & wet morning street!
    this.camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.1, 120);
    this.camPosTarget = new THREE.Vector3(0.18, 0.88, 3.68);
    this.camLookTarget = new THREE.Vector3(-0.05, 1.06, -0.15);
    this.camLookCurrent = this.camLookTarget.clone();
    this.camera.position.copy(this.camPosTarget);
    this.camera.lookAt(this.camLookCurrent);

    // Build Procedural PBR Textures & HDR-like Dawn Environment Map (all <= 1024px)
    this.envTexture = createDawnStreetEnvironment(this.renderer);
    this.scene.environment = this.envTexture;

    const fabricNormal = createFabricNormalMap();
    fabricNormal.repeat.set(3, 3);
    setCharacterFabricNormal(fabricNormal);

    this.textures = {
      asphalt: createWetAsphaltTextures(),
      steel: createBrushedSteelTextures(),
      paintNormal: createTruckPaintNormalMap(),
      fabricNormal,
      hazard: createHazardStripeTexture(),
      concrete: createConcreteTexture(),
      glove: createGloveTexture(),
      signboard: createPictorialSignboardTexture(),
      newspaper: createNewspaperTexture(),
      canOrange: createCanLabelTexture('#ea580c', '#fde047'),
      canBerry: createCanLabelTexture('#be123c', '#fbcfe8'),
      foliage: createFoliageTexture(),
      crateEmblems: {
        bottle: createCrateEmblemTexture('bottle', '#1d4ed8'),
        can: createCrateEmblemTexture('can', '#eab308'),
        paper: createCrateEmblemTexture('paper', '#64748b'),
        organic: createCrateEmblemTexture('organic', '#16a34a'),
      },
    };

    // World & Hero Entities
    this.street = new MorningStreetEnvironment(this.scene, this.renderer, this.textures);
    this.truck = new GarbageTruck(this.textures);
    this._enableReflectionLayer(this.truck.group);
    this.scene.add(this.truck.group);

    this.girl = new GirlCharacter(this.textures.glove);
    this._enableReflectionLayer(this.girl.group);
    this.scene.add(this.girl.group);

    this.dad = new DadWorker(this.textures.glove);
    this._enableReflectionLayer(this.dad.group);
    this.scene.add(this.dad.group);

    this.playerHand = new PlayerGlovedHand(this.textures.glove);
    this.scene.add(this.playerHand.group);

    this.flutterPapers = new FlutteringPaperSystem(this.scene, this.textures.newspaper);

    // Neighborhood Kids for Scene 3
    this.kids = [
      new TownKid(0xf43f5e, 0xfacc15, 0.95),
      new TownKid(0x0ea5e9, 0x4ade80, 0.90),
    ];
    this.kids.forEach((k) => {
      k.group.visible = false;
      this._enableReflectionLayer(k.group);
      this.scene.add(k.group);
    });
    this._enableReflectionLayer(this.street.signboardGroup);

    // Subtle Wordless Idle Hint Hand (only shown once after >= 10s of complete inactivity!)
    this._buildIdleHintOrb();

    // Raycasting & Single-Finger Pointer State
    this.raycaster = new THREE.Raycaster();
    this.pointerNDC = new THREE.Vector2();
    this.dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.45);
    this.activePointerId = null;
    this.dragAction = null;
    this.lastPointerWorld = new THREE.Vector3();
    this.pointerVelocity = new THREE.Vector2();
    this.lastPointerClient = new THREE.Vector2();

    // Simulation State & Multi-Dimensional Outcomes
    this.stage = 0; // 0: Dress-Up on Street, 1: Sorting Trash, 2: Hopper & Lever & Dad's Blunder, 3: Blooming Town Sandbox
    this.time = 0;
    this.idleSeconds = 0;
    this.idleHintShownForStage = false;
    this.crunchSoundCooldown = 0;
    this.spraySoundCooldown = 0;

    this.dressStand = null;
    this.crates = [];
    this.trashBags = [];
    this.recyclables = [];
    this.sandboxCrafts = [];
    this.growingFlower = null;

    this._initStageWorld();
    this._bindEvents();
    this._onResize();

    this.clock = new THREE.Clock();
    this._animate = this._animate.bind(this);
    requestAnimationFrame(this._animate);

    // Expose read-only diagnostics & stage test driver for automated FPS/triangle/realism verification
    window.__GAME_DEBUG__ = {
      game: this,
      getStats: () => ({
        stage: this.stage,
        triangles: this.renderer.info.render.triangles,
        calls: this.renderer.info.render.calls,
        pixelRatio: this.renderer.getPixelRatio(),
        compaction: this.truck.totalCompaction,
        sortedCount: this.recyclables.filter((r) => r.state === 'sorted' || r.state === 'inHopper').length,
        craftCount: this.sandboxCrafts.length,
      }),
    };
  }

  _buildIdleHintOrb() {
    // Gentle soft sunlit pulse ring (only appears once after 10s of zero input, never steals control)
    const geo = new THREE.RingGeometry(0.11, 0.15, 24);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xfff7ed,
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide,
      depthTest: false,
    });
    this.hintRing = new THREE.Mesh(geo, mat);
    this.hintRing.renderOrder = 10;
    this.hintRing.visible = false;
    this.scene.add(this.hintRing);
    this.hintAnim = 0;
  }

  _clearDynamicObjects() {
    if (this.dressStand) {
      this.scene.remove(this.dressStand.group);
      this.dressStand = null;
    }
    this.crates.forEach((c) => this.scene.remove(c.group));
    this.crates = [];
    this.trashBags.forEach((b) => this.scene.remove(b.group));
    this.trashBags = [];
    this.recyclables.forEach((r) => {
      if (r.group.parent) r.group.parent.remove(r.group);
    });
    this.recyclables = [];
    this.sandboxCrafts.forEach((sc) => {
      if (sc.group.parent) sc.group.parent.remove(sc.group);
    });
    this.sandboxCrafts = [];
    this.flutterPapers.clear();
  }

  _initStageWorld() {
    this._clearDynamicObjects();
    this.stage = 0;
    this.idleSeconds = 0;
    this.idleHintShownForStage = false;
    this.replayBtn.classList.remove('visible');

    // Reset Truck & Characters
    this.truck.totalCompaction = 0;
    this.truck.pumpCount = 0;
    this.truck.setCompactionVisuals(0, 0);

    this.girl.hasCap = false;
    this.girl.hasVest = false;
    while (this.girl.capMount.children.length) this.girl.capMount.remove(this.girl.capMount.children[0]);
    while (this.girl.vestMount.children.length) this.girl.vestMount.remove(this.girl.vestMount.children[0]);
    this.girl.arms.forEach((a) => {
      a.glove.visible = false;
    });
    this.girl.group.position.set(-0.98, 0.0, 2.02);
    this.girl.group.rotation.y = 0.42;
    this.girl.triggerExpression('happy', 2.0);

    this.playerHand.enabledAfterDress = false;
    this.playerHand.group.visible = false;

    this.dad.state = 'standing';
    this.dad.carryMount.visible = false;
    while (this.dad.giftMount.children.length) this.dad.giftMount.remove(this.dad.giftMount.children[0]);
    this.dad.group.position.set(1.52, 0.0, 0.85);
    this.dad.group.rotation.set(0, -0.46, 0);
    this.dad.triggerExpression('happy', 2.0);

    this.kids.forEach((k) => {
      k.group.visible = false;
      while (k.giftMount.children.length) k.giftMount.remove(k.giftMount.children[0]);
    });

    // Dress-Up Rack in Mid-Foreground leaving foreground wet pavement & mirror puddles wide open!
    this.dressStand = createDressUpStand();
    this.scene.add(this.dressStand.group);

    // 4 Sorting Crates parked neatly on the right/mid-ground during Dress-Up, then slide forward for Scene 1!
    this.crates = createSortingCrates(this.textures.crateEmblems);
    this.crates.forEach((c, idx) => {
      c.stage1Pos = c.homePos.clone();
      c.homePos.set(0.56 + idx * 0.43, 0.0, 1.38 + idx * 0.14);
      c.group.position.copy(c.homePos);
      this._enableReflectionLayer(c.group);
      this.scene.add(c.group);
    });

    // Create 10 Recyclable Items: 6 tucked inside 2 translucent knotted garbage bags + 4 loose items ready to grab!
    const itemDefs = [
      { category: 'bottle', variant: 0, inBag: 0 },
      { category: 'can', variant: 0, inBag: 0 },
      { category: 'paper', variant: 0, inBag: 0 },
      { category: 'organic', variant: 0, inBag: 1 },
      { category: 'bottle', variant: 1, inBag: 1 },
      { category: 'can', variant: 1, inBag: 1 },
      // 4 immediately visible loose items beside the bags!
      { category: 'bottle', variant: 2, inBag: -1, pos: new THREE.Vector3(-0.36, 0.13, 2.48) },
      { category: 'can', variant: 2, inBag: -1, pos: new THREE.Vector3(0.05, 0.09, 2.54) },
      { category: 'paper', variant: 1, inBag: -1, pos: new THREE.Vector3(0.42, 0.11, 2.49) },
      { category: 'organic', variant: 1, inBag: -1, pos: new THREE.Vector3(0.82, 0.08, 2.44) },
    ];

    const bag0Items = [];
    const bag1Items = [];

    itemDefs.forEach((def) => {
      const item = createRecyclableItem(def, this.textures);
      this.recyclables.push(item);
      if (def.inBag === 0) {
        item.state = 'inBag';
        bag0Items.push(item);
      } else if (def.inBag === 1) {
        item.state = 'inBag';
        bag1Items.push(item);
      } else {
        item.state = 'ground';
        item.group.position.copy(def.pos);
        item.group.rotation.set(0.12, Math.random() * Math.PI, (Math.random() - 0.5) * 0.35);
        item.group.visible = false; // revealed smoothly as soon as Dress-Up completes!
        this.scene.add(item.group);
      }
    });

    const bag0 = createTownGarbageBag(new THREE.Vector3(-0.55, 0.0, 1.52), bag0Items);
    const bag1 = createTownGarbageBag(new THREE.Vector3(0.65, 0.0, 1.56), bag1Items);
    this.trashBags.push(bag0, bag1);
    this.trashBags.forEach((b) => this.scene.add(b.group));

    // Simulation tracking for hundreds of outcomes
    this.dadBlunderTriggered = false;
    this.paperAirCaughtCount = 0;
    this.paperWetCaughtCount = 0;
    this.mismatchAcceptedCount = 0;

    this._updateCameraFraming();
  }

  _updateCameraFraming() {
    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    const isPortrait = aspect < 0.95;

    // Cinematic low-angle child's-eye framing: foreground filled with wet reflective pavement & long shadows, upper frame filled by the massive Garbage Truck!
    this.camera.fov = isPortrait ? 62 : 52;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();

    const zPullback = isPortrait ? 1.12 : 0.0;

    if (this.stage === 0) {
      this.camPosTarget.set(0.22, 0.56, 4.55 + zPullback);
      this.camLookTarget.set(0.05, 0.96, 0.45);
    } else if (this.stage === 1) {
      this.camPosTarget.set(0.18, 0.62, 4.42 + zPullback);
      this.camLookTarget.set(0.06, 0.92, 0.50);
    } else if (this.stage === 2) {
      // Dramatic low-angle looking up at the giant brushed-steel hopper & hydraulic lever over shimmering puddles!
      this.camPosTarget.set(0.14, 0.54, 3.72 + zPullback * 0.85);
      this.camLookTarget.set(-0.04, 1.12, 0.12);
    } else {
      // Scene 3: Majestic low-angle panorama of the gleaming Garbage Truck, wet rainbow street, flowers, and kids!
      this.camPosTarget.set(0.16, 0.64, 4.60 + zPullback);
      this.camLookTarget.set(0.02, 0.96, 0.20);
    }
  }

  _transitionToStage1() {
    this.stage = 1;
    this.idleSeconds = 0;
    this.idleHintShownForStage = false;
    this.sound.playDressComplete();

    // Activate Girl's 3D Gloved Hand under player's finger!
    this.playerHand.enabledAfterDress = true;
    this.playerHand.setCuffColor(this.girl.vestColor);

    // Girl steps comfortably to the lower-left side where her face clearly reacts to every action!
    this.dad.triggerExpression('cheering', 1.8);
    this.girl.triggerExpression('cheering', 1.6);

    // Reveal loose items & slide bags/crates into ergonomic foreground sorting layout
    this.crates.forEach((c) => {
      if (c.stage1Pos) c.homePos.copy(c.stage1Pos);
    });
    this.recyclables.forEach((r) => {
      if (r.state === 'ground') r.group.visible = true;
    });
    this.trashBags[0].homePos.set(-0.52, 0.0, 2.52);
    this.trashBags[1].homePos.set(0.56, 0.0, 2.54);
    this.trashBags.forEach((b) => b.group.position.copy(b.homePos));

    this._updateCameraFraming();
  }

  _transitionToStage2() {
    if (this.stage >= 2) return;
    this.stage = 2;
    this.idleSeconds = 0;
    this.idleHintShownForStage = false;
    this.sound.playSceneCelebration();

    this.girl.triggerExpression('proud', 1.8);
    this.dad.triggerExpression('proud', 1.8);

    // Move empty plastic bags into the crates or hopper automatically if left empty, and bring filled crates closer to the hopper sill
    if (this.dressStand) this.dressStand.group.visible = false;
    this.trashBags.forEach((b) => {
      if (b.empty) {
        b.group.visible = false;
      }
    });

    this.crates.forEach((c, idx) => {
      c.homePos.set(-0.62 + idx * 0.44, 0.0, 1.62);
    });

    this._updateCameraFraming();
  }

  _triggerDadPaperBlunder() {
    if (this.dadBlunderTriggered) return;
    this.dadBlunderTriggered = true;
    this.dad.startPaperBlunderRun();
  }

  _executeDadSlip() {
    this.dad.state = 'slipped';
    this.dad.carryMount.visible = false;
    this.dad.triggerExpression('huh', 2.2, 'happy');
    this.girl.triggerExpression('surprised', 1.1, 'happy');
    this.sound.playDadSlipAndScatter();

    // Splash water droplets from the wet puddle where Dad slipped!
    const slipOrigin = this.dad.group.position.clone().add(new THREE.Vector3(0, 0.1, 0));
    this.street.emitWaterSpray(slipOrigin, slipOrigin.clone().add(new THREE.Vector3(-0.4, 0.9, 0.4)), false);
    this.street.emitWaterSpray(slipOrigin, slipOrigin.clone().add(new THREE.Vector3(0.5, 0.9, 0.3)), false);

    // Scatter 12 flexible 3D aerodynamic paper sheets into the morning sunbeams!
    this.flutterPapers.spawnScatter(this.dad.group.position, 12);
  }

  _transitionToStage3() {
    if (this.stage === 3) return;
    this.stage = 3;
    this.idleSeconds = 0;
    this.idleHintShownForStage = false;
    this.sound.playSceneCelebration();
    this.truck.flashBeacons();

    // Hide empty crates & sealed hopper items cleanly, and bring Dad + Neighborhood Kids out into the sunny foreground plaza!
    this.crates.forEach((c) => {
      c.group.visible = false;
    });
    this.recyclables.forEach((r) => {
      if (r.state === 'inHopper') r.group.visible = false;
    });
    this.flutterPapers.sheets.forEach((s) => {
      if (s.state === 'inHopper' || s.state === 'flyingToHopper') s.mesh.visible = false;
    });

    this.dad.recoverFromSlip();
    this.dad.group.position.set(1.48, 0.0, 0.95);
    this.dad.group.rotation.set(0, -0.46, 0);
    this.dad.triggerExpression('cheering', 3.5);
    this.girl.triggerExpression('cheering', 3.5);

    // Neighborhood children trot out into the open foreground street plaza in rainboots!
    this.kids[0].homePos.set(-0.48, 0.0, 1.52);
    this.kids[0].group.position.copy(this.kids[0].homePos);
    this.kids[0].group.visible = true;
    this.kids[0].excite(2.4);

    this.kids[1].homePos.set(0.62, 0.0, 1.48);
    this.kids[1].group.position.copy(this.kids[1].homePos);
    this.kids[1].group.visible = true;
    this.kids[1].excite(2.0);

    // Compute custom flower & recycled craft traits from continuous simulation state!
    const compScale = 0.72 + this.truck.totalCompaction * 0.55;
    const crispRatio =
      this.paperAirCaughtCount / Math.max(1, this.paperAirCaughtCount + this.paperWetCaughtCount);

    const flowerPalette =
      this.mismatchAcceptedCount >= 2
        ? [0xf43f5e, 0xa855f7, 0xf59e0b, 0x38bdf8, 0xfecdd3] // whimsical rainbow meadow mix!
        : [0xfb7185, 0xfbbf24, 0xf472b6, 0x60a5fa, 0xffffff];

    this.activeFlowerPalette = flowerPalette;
    this.compactionBloomBoost = compScale;

    // Sprout lush initial blossoms across both roadside planters + curb edges!
    this.street.planterBeds.forEach((bed) => {
      const count = 8 + Math.round(this.truck.totalCompaction * 6);
      for (let i = 0; i < count; i++) {
        const col = flowerPalette[i % flowerPalette.length];
        const f = createRealisticFlower(col, (0.65 + Math.random() * 0.45) * compScale);
        f.group.position.set(
          bed.x + (Math.random() - 0.5) * (bed.w - 0.28),
          0.26,
          bed.z + (Math.random() - 0.5) * (bed.d - 0.18)
        );
        this.scene.add(f.group);
        this.sandboxCrafts.push(f);
      }
    });

    // Dispense 5 Interactive Recycled Pinwheels & Flower Bouquets in the foreground plaza for Free Sandbox Play!
    const craftSpots = [
      new THREE.Vector3(-0.68, 0.0, 2.08),
      new THREE.Vector3(-0.22, 0.0, 2.18),
      new THREE.Vector3(0.26, 0.0, 2.16),
      new THREE.Vector3(0.74, 0.0, 2.05),
      new THREE.Vector3(1.14, 0.0, 1.88),
    ];
    const pinAccents = [this.girl.vestColor, 0xf97316, 0x38bdf8];
    const glassColors = [0x167954, 0x1d4ed8, 0xd97706];

    craftSpots.forEach((spot, idx) => {
      let craft;
      if (idx % 2 === 0) {
        craft = createRecycledPinwheel(
          pinAccents[(idx / 2) % pinAccents.length],
          glassColors[(idx / 2) % glassColors.length],
          crispRatio >= 0.45
        );
        craft.spinSpeed = 2.5 + this.truck.pumpCount * 1.1;
      } else {
        craft = createRealisticFlower(
          flowerPalette[idx % flowerPalette.length],
          0.95 * compScale
        );
      }
      craft.group.position.copy(spot);
      this.scene.add(craft.group);
      this.sandboxCrafts.push(craft);
    });

    // Morning rainbow shimmers gently across the freshly washed street!
    this.street.rainbowAlpha = Math.max(this.street.rainbowAlpha, 0.78);
    this.replayBtn.classList.add('visible');
    this._updateCameraFraming();
  }

  _bindEvents() {
    window.addEventListener('resize', () => this._onResize());

    const dom = this.renderer.domElement;
    dom.addEventListener('pointerdown', (e) => this._onPointerDown(e));
    window.addEventListener('pointermove', (e) => this._onPointerMove(e));
    window.addEventListener('pointerup', (e) => this._onPointerUp(e));
    window.addEventListener('pointercancel', (e) => this._onPointerUp(e));

    this.replayBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.sound.playSoftTap();
      this._initStageWorld();
    });
  }

  _onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(w, h);
    this._updateCameraFraming();
  }

  _updateRaycaster(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointerNDC, this.camera);
  }

  _projectToPlaneY(yVal, out = new THREE.Vector3()) {
    this.dragPlane.constant = -yVal;
    if (!this.raycaster.ray.intersectPlane(this.dragPlane, out)) {
      this.raycaster.ray.at(3.0, out);
    }
    return out;
  }

  _collectInteractiveHits() {
    const targets = [];

    if (this.stage === 0 && this.dressStand) {
      this.dressStand.items.forEach((it) => {
        if (!it.equipped) targets.push(it.hit);
      });
    }

    if (this.stage === 1) {
      this.recyclables.forEach((r) => {
        if (r.state === 'ground') targets.push(r.hit);
      });
      this.trashBags.forEach((b) => {
        if (!b.empty) targets.push(b.hit);
      });
    }

    if (this.stage === 2) {
      // Catch fluttering papers first if active!
      this.flutterPapers.sheets.forEach((s) => {
        if (s.state === 'airborne' || s.state === 'landed') targets.push(s.hit);
      });
      this.crates.forEach((c) => {
        if (!c.loadedIntoHopper && c.items.length > 0) targets.push(c.hit);
      });
      targets.push(this.truck.leverHit);
    }

    if (this.stage === 3) {
      this.sandboxCrafts.forEach((sc) => targets.push(sc.hit));
      this.street.planterBeds.forEach((b) => targets.push(b.soil));
    }

    // Street hose & signboard & truck horn available for playful curiosity!
    targets.push(this.street.nozzleMesh.children[2]);
    targets.push(this.street.signboardFace);
    this.truck.group.traverse((c) => {
      if (c.userData && c.userData.interactType === 'truckHorn') targets.push(c);
    });

    return this.raycaster.intersectObjects(targets, false);
  }

  _onPointerDown(e) {
    if (this.activePointerId !== null) return; // single-finger safe: ignore extra fingers cleanly
    this.activePointerId = e.pointerId;
    this.sound.unlock();
    this.idleSeconds = 0;
    this.hintRing.visible = false;

    this.lastPointerClient.set(e.clientX, e.clientY);
    this.pointerVelocity.set(0, 0);
    this._updateRaycaster(e);

    const handPos = this._projectToPlaneY(0.65, new THREE.Vector3());
    this.playerHand.setTarget(handPos, true, true);
    this.girl.lookAtWorld(handPos);

    const hits = this._collectInteractiveHits();
    const hit = hits[0];

    if (hit) {
      const ud = hit.object.userData;

      if (ud.interactType === 'dressItem' && this.stage === 0) {
        const dressObj = ud.dressObj;
        this.sound.playSoftTap();
        this.dragAction = {
          type: 'dressItem',
          dressObj,
          startClient: new THREE.Vector2(e.clientX, e.clientY),
          movedDist: 0,
        };
        return;
      }

      if (ud.interactType === 'trashItem' && this.stage === 1) {
        const itemObj = ud.itemObj;
        itemObj.state = 'dragging';
        this.sound.playItemGrab(itemObj.category);
        this.dragAction = { type: 'trashItem', itemObj };
        return;
      }

      if (ud.interactType === 'garbageBag' && this.stage === 1) {
        const bagObj = ud.bagObj;
        bagObj.wiggle = 1.0;
        this.sound.playBagCrinkle(1.0);
        this.dragAction = {
          type: 'garbageBag',
          bagObj,
          shakeAccum: 0,
          movedDist: 0,
        };
        return;
      }

      if (ud.interactType === 'flutterPaper' && this.stage === 2) {
        this._catchPaperSheet(ud.sheet);
        this.dragAction = { type: 'paperSweep' };
        return;
      }

      if (ud.interactType === 'crate' && this.stage === 2) {
        const crateObj = ud.crateObj;
        this.sound.playSoftTap();
        this.dragAction = {
          type: 'crateLoad',
          crateObj,
          movedDist: 0,
        };
        return;
      }

      if (ud.interactType === 'lever' && this.stage === 2) {
        this.sound.playLeverGrab();
        this.dragAction = {
          type: 'lever',
          startY: e.clientY,
          lastCrunchPull: 0,
          maxPullThisStroke: 0,
        };
        return;
      }

      if (ud.interactType === 'hose') {
        this.sound.playWaterSpray();
        this.dragAction = { type: 'hose' };
        return;
      }

      if (ud.interactType === 'truckHorn') {
        this.sound.playTruckHorn();
        this.truck.flashBeacons();
        this.girl.triggerExpression('happy', 1.2);
        if (this.stage === 3) this.kids.forEach((k) => k.excite(1.4));
        return;
      }

      if (ud.interactType === 'signboard') {
        this.sound.playSoftTap();
        this.street.signboardGroup.rotation.z = 0.07;
        return;
      }

      if (ud.interactType === 'sandboxCraft' && this.stage === 3) {
        const craftObj = ud.craftObj;
        if (craftObj.kind === 'pinwheel') {
          craftObj.spinSpeed = Math.min(22.0, craftObj.spinSpeed + 9.0);
          this.sound.playPinwheelSpin(craftObj.spinSpeed / 12);
          this.kids.forEach((k) => k.excite(1.5));
        } else {
          this.sound.playBloom(1.1);
        }
        this.dragAction = { type: 'sandboxCraft', craftObj };
        return;
      }
    }

    // Stage 2 fallback: sweeping anywhere on screen when papers are fluttering collects nearby papers!
    if (this.stage === 2 && this.flutterPapers.remainingToCatch() > 0) {
      this._sweepPapersNearRay();
      this.dragAction = { type: 'paperSweep' };
      return;
    }

    // Stage 3 fallback: touching/holding on pavement or planters sprouts & continuously grows a new realistic 3D flower!
    if (this.stage === 3) {
      const groundHits = this.raycaster.intersectObjects(
        [this.street.roadMesh, ...this.street.planterBeds.map((b) => b.soil)],
        false
      );
      if (groundHits.length > 0) {
        const pt = groundHits[0].point;
        if (pt.z > -3.2 && pt.z < 3.1 && Math.abs(pt.x) < 2.8) {
          const palette = this.activeFlowerPalette || [0xf43f5e, 0xfbbf24, 0x38bdf8];
          const col = palette[Math.floor(Math.random() * palette.length)];
          const flower = createRealisticFlower(col, 0.35);
          flower.group.position.copy(pt);
          this.scene.add(flower.group);
          this.sandboxCrafts.push(flower);
          this.sound.playBloom(0.95);
          this.girl.triggerExpression('happy', 1.2);
          this.growingFlower = flower;
          this.dragAction = { type: 'growFlower', flower };
        }
      }
    }
  }

  _onPointerMove(e) {
    if (e.pointerId !== this.activePointerId) return;
    this.idleSeconds = 0;

    const dx = e.clientX - this.lastPointerClient.x;
    const dy = e.clientY - this.lastPointerClient.y;
    this.pointerVelocity.set(dx, dy);
    this.lastPointerClient.set(e.clientX, e.clientY);

    this._updateRaycaster(e);
    const handPos = this._projectToPlaneY(0.68, new THREE.Vector3());
    this.playerHand.setTarget(handPos, !!this.dragAction, true);
    this.girl.lookAtWorld(handPos);

    if (!this.dragAction) return;

    if (this.dragAction.type === 'dressItem') {
      const { dressObj } = this.dragAction;
      this.dragAction.movedDist += Math.hypot(dx, dy);
      const localTarget = this._projectToPlaneY(0.82, new THREE.Vector3());
      this.dressStand.group.worldToLocal(localTarget);
      dressObj.group.position.lerp(localTarget, 0.65);
      return;
    }

    if (this.dragAction.type === 'trashItem') {
      const { itemObj } = this.dragAction;
      const wp = this._projectToPlaneY(0.56, new THREE.Vector3());
      wp.x = Math.max(-1.35, Math.min(1.45, wp.x));
      wp.z = Math.max(0.85, Math.min(2.75, wp.z));
      itemObj.group.position.lerp(wp, 0.72);
      itemObj.group.rotation.z = -dx * 0.02;
      return;
    }

    if (this.dragAction.type === 'garbageBag') {
      const { bagObj } = this.dragAction;
      const moveAmt = Math.hypot(dx, dy);
      this.dragAction.movedDist += moveAmt;
      this.dragAction.shakeAccum += moveAmt;

      const wp = this._projectToPlaneY(0.28, new THREE.Vector3());
      wp.x = Math.max(-1.25, Math.min(1.35, wp.x));
      wp.z = Math.max(1.25, Math.min(2.72, wp.z));
      bagObj.group.position.lerp(wp, 0.55);
      bagObj.wiggle = Math.min(1.6, bagObj.wiggle + moveAmt * 0.025);

      // Vigorous shaking pops items out of the translucent garbage bag dynamically!
      if (this.dragAction.shakeAccum > 78 && bagObj.items.length > 0) {
        this.dragAction.shakeAccum = 0;
        this._popOneItemFromBag(bagObj, dx * 0.025);
      }
      return;
    }

    if (this.dragAction.type === 'crateLoad') {
      const { crateObj } = this.dragAction;
      this.dragAction.movedDist += Math.hypot(dx, dy);
      const wp = this._projectToPlaneY(0.75, new THREE.Vector3());
      crateObj.group.position.lerp(wp, 0.55);
      crateObj.group.rotation.x = -0.35;

      // Check proximity to Hopper mouth!
      const hopperPos = this.truck.getHopperWorldCenter();
      if (crateObj.group.position.distanceTo(hopperPos) < 0.82) {
        this._dumpCrateIntoHopper(crateObj);
        this.dragAction = null;
      }
      return;
    }

    if (this.dragAction.type === 'lever') {
      // Pulling finger downward (or holding down) drives hydraulic packer continuously!
      const pullRaw = (e.clientY - this.dragAction.startY) / (window.innerHeight * 0.24);
      const pull = Math.max(0, Math.min(1, pullRaw));
      this.dragAction.maxPullThisStroke = Math.max(this.dragAction.maxPullThisStroke, pull);

      // Keep gloved hand right on the moving lever ball!
      const knobWorld = this.truck.getLeverKnobWorldPos();
      this.playerHand.setTarget(knobWorld, true, true);

      this.truck.setCompactionVisuals(pull, pull);

      if (pull > this.dragAction.lastCrunchPull + 0.14) {
        this.dragAction.lastCrunchPull = pull;
        this.truck.totalCompaction = Math.min(1.0, this.truck.totalCompaction + 0.12);
        this._crushAllHopperContents(this.truck.totalCompaction);
        if (this.crunchSoundCooldown <= 0) {
          this.sound.playCrunchStep(0.55 + pull * 0.45);
          this.crunchSoundCooldown = 0.12;
        }
      }
      return;
    }

    if (this.dragAction.type === 'paperSweep') {
      this._sweepPapersNearRay();
      return;
    }

    if (this.dragAction.type === 'hose') {
      const groundTarget = this._projectToPlaneY(0.02, new THREE.Vector3());
      const nozzleWorld = new THREE.Vector3();
      this.street.nozzleMesh.getWorldPosition(nozzleWorld);
      this.street.emitWaterSpray(nozzleWorld, groundTarget, this.stage === 3 || this.street.wetnessBoost > 0.25);
      if (this.spraySoundCooldown <= 0) {
        this.sound.playWaterSpray();
        this.spraySoundCooldown = 0.14;
      }
      return;
    }

    if (this.dragAction.type === 'sandboxCraft') {
      const { craftObj } = this.dragAction;
      const wp = this._projectToPlaneY(0.05, new THREE.Vector3());
      wp.x = Math.max(-2.3, Math.min(2.3, wp.x));
      wp.z = Math.max(-2.2, Math.min(2.6, wp.z));
      craftObj.group.position.lerp(wp, 0.65);
      if (craftObj.kind === 'pinwheel') {
        craftObj.spinSpeed = Math.min(24.0, craftObj.spinSpeed + Math.hypot(dx, dy) * 0.12);
      }
      return;
    }
  }

  _onPointerUp(e) {
    if (e.pointerId !== this.activePointerId) return;
    this.activePointerId = null;
    this.playerHand.setTarget(null, false, false);
    this.growingFlower = null;

    if (!this.dragAction) return;
    const act = this.dragAction;
    this.dragAction = null;

    if (act.type === 'dressItem') {
      this._finishDressItemDrop(act.dressObj, act.movedDist);
      return;
    }

    if (act.type === 'trashItem') {
      this._finishTrashItemDrop(act.itemObj);
      return;
    }

    if (act.type === 'garbageBag') {
      this._finishGarbageBagInteraction(act.bagObj, act.movedDist);
      return;
    }

    if (act.type === 'crateLoad') {
      const { crateObj, movedDist } = act;
      const hopperPos = this.truck.getHopperWorldCenter();
      // Allow either dragging to hopper OR a quick single tap on a crate to tip it in!
      if (movedDist < 16 || crateObj.group.position.distanceTo(hopperPos) < 1.15) {
        this._dumpCrateIntoHopper(crateObj);
      } else {
        crateObj.group.rotation.x = 0;
      }
      return;
    }

    if (act.type === 'lever') {
      // Even a tap on the lever gives a partial press so curious taps still show physical cause-and-effect!
      if (act.maxPullThisStroke < 0.18) {
        this.truck.totalCompaction = Math.min(1.0, this.truck.totalCompaction + 0.18);
        this.truck.setCompactionVisuals(0.45, 0.45);
        this._crushAllHopperContents(this.truck.totalCompaction);
        this.sound.playCrunchStep(0.65);
      }
      if (act.maxPullThisStroke >= 0.35 || this.truck.totalCompaction >= 0.25) {
        this.truck.pumpCount++;
      }
      this.sound.playHydraulicRelease();
      this.girl.triggerExpression('proud', 1.2);
      this._checkStage2Progression();
      return;
    }

    if (act.type === 'sandboxCraft') {
      // Check if dropped near Dad or one of the Neighborhood Kids -> Gift it to them!
      const { craftObj } = act;
      const receivers = [this.dad, ...this.kids];
      for (const rec of receivers) {
        if (!rec.group.visible) continue;
        const dist = Math.hypot(
          craftObj.group.position.x - rec.group.position.x,
          craftObj.group.position.z - rec.group.position.z
        );
        if (dist < 0.62) {
          const idx = this.sandboxCrafts.indexOf(craftObj);
          if (idx >= 0) this.sandboxCrafts.splice(idx, 1);
          rec.receiveGift(craftObj.group);
          this.sound.playSceneCelebration();
          this.girl.triggerExpression('cheering', 1.8);
          return;
        }
      }
    }
  }

  _finishDressItemDrop(dressObj, movedDist) {
    const worldPos = new THREE.Vector3();
    dressObj.group.getWorldPosition(worldPos);
    const distToGirl = Math.hypot(
      worldPos.x - this.girl.group.position.x,
      worldPos.z - this.girl.group.position.z
    );

    // Equip if tapped directly OR dragged anywhere near the Girl!
    if (movedDist < 22 || distToGirl < 1.15) {
      // Return any previously worn item of same kind back to bench so she can swap colors freely!
      this.dressStand.items.forEach((other) => {
        if (other.kind === dressObj.kind && other.equipped) {
          other.equipped = false;
          other.group.visible = true;
          other.group.position.copy(other.homePos);
        }
      });

      dressObj.equipped = true;
      dressObj.group.visible = false;

      if (dressObj.kind === 'cap') {
        const brimTilt = (worldPos.x - this.girl.group.position.x) * 0.28;
        this.girl.equipCap(dressObj.color, dressObj.stripe, movedDist < 22 ? 0.04 : brimTilt);
        this.sound.playEquipCloth(true);
      } else {
        this.girl.equipVest(dressObj.color);
        this.sound.playEquipCloth(false);
      }

      if (this.girl.hasCap && this.girl.hasVest) {
        setTimeout(() => {
          if (this.stage === 0) this._transitionToStage1();
        }, 650);
      }
    } else {
      dressObj.group.position.copy(dressObj.homePos);
    }
  }

  _popOneItemFromBag(bagObj, sideVel = 0) {
    if (bagObj.items.length === 0) return;
    const item = bagObj.items.pop();
    if (bagObj.innerGroup.children.length > 0) {
      bagObj.innerGroup.remove(bagObj.innerGroup.children[bagObj.innerGroup.children.length - 1]);
    }

    item.state = 'ground';
    item.group.position.set(
      bagObj.group.position.x + (Math.random() - 0.5) * 0.24,
      bagObj.group.position.y + 0.36,
      bagObj.group.position.z + 0.08 + Math.random() * 0.22
    );
    item.vel.set(
      sideVel + (Math.random() - 0.5) * 1.1,
      1.6 + Math.random() * 0.7,
      0.4 + Math.random() * 0.7
    );
    item.group.visible = true;
    this.scene.add(item.group);
    this.sound.playBagCrinkle(1.1);
    this.sound.playItemGrab(item.category);

    if (bagObj.items.length === 0) {
      bagObj.empty = true;
      bagObj.bagMesh.scale.set(0.85, 0.32, 0.85);
    }
  }

  _finishGarbageBagInteraction(bagObj, movedDist) {
    // Check if user dragged the whole garbage bag directly over a crate!
    for (const crate of this.crates) {
      const dist = Math.hypot(
        bagObj.group.position.x - crate.group.position.x,
        bagObj.group.position.z - crate.group.position.z
      );
      if (dist < 0.42 && bagObj.items.length > 0) {
        // Pour 1 item directly into that crate!
        const item = bagObj.items.pop();
        if (bagObj.innerGroup.children.length > 0) {
          bagObj.innerGroup.remove(bagObj.innerGroup.children[bagObj.innerGroup.children.length - 1]);
        }
        this.scene.add(item.group);
        item.group.position.copy(crate.group.position).add(new THREE.Vector3(0, 0.25, 0));
        this._placeItemIntoCrate(item, crate);
        if (bagObj.items.length === 0) {
          bagObj.empty = true;
          bagObj.bagMesh.scale.set(0.85, 0.32, 0.85);
        }
        bagObj.group.position.copy(bagObj.homePos);
        return;
      }
    }

    // If tapped lightly, pop 1 item out onto the pavement!
    if (movedDist < 24 && bagObj.items.length > 0) {
      this._popOneItemFromBag(bagObj, 0);
    }
  }

  _finishTrashItemDrop(itemObj) {
    // Find nearest crate with generous magnetic snap radius!
    let bestCrate = null;
    let bestDist = 0.48;
    for (const crate of this.crates) {
      const d = Math.hypot(
        itemObj.group.position.x - crate.group.position.x,
        itemObj.group.position.z - crate.group.position.z
      );
      if (d < bestDist) {
        bestDist = d;
        bestCrate = crate;
      }
    }

    if (bestCrate) {
      this._placeItemIntoCrate(itemObj, bestCrate);
    } else {
      // Settle naturally back onto wet pavement with gravity
      itemObj.state = 'ground';
      itemObj.vel.set(0, -0.5, 0);
    }
  }

  _placeItemIntoCrate(itemObj, crate) {
    itemObj.state = 'sorted';
    itemObj.sortedCrate = crate;
    const matched = itemObj.category === crate.category;
    itemObj.wasMatched = matched;

    // Preserve continuous drop offset inside crate!
    const localOffset = itemObj.group.position.clone().sub(crate.group.position);
    crate.contentsMount.add(itemObj.group);
    const slotY = 0.05 + Math.floor(crate.items.length / 2) * 0.075;
    itemObj.group.position.set(
      Math.max(-0.13, Math.min(0.13, localOffset.x + (Math.random() - 0.5) * 0.06)),
      slotY,
      Math.max(-0.09, Math.min(0.09, localOffset.z + (Math.random() - 0.5) * 0.06))
    );
    itemObj.group.rotation.set(
      (Math.random() - 0.5) * 0.5,
      Math.random() * Math.PI * 2,
      (Math.random() - 0.5) * 0.5
    );
    crate.items.push(itemObj);
    crate.bounceVel = -0.08;

    if (matched) {
      this.sound.playItemDrop(itemObj.category, true);
      this.girl.triggerExpression('happy', 1.2);
      this.dad.triggerExpression('happy', 1.2);
    } else {
      // Mismatched Crate: NO failure! Both Dad & Girl do endearing "あれ？" -> warm delighted grin & accept it!
      this.mismatchAcceptedCount++;
      this.sound.playItemDrop(itemObj.category, false);
      this.sound.playHuhThenHappy();
      this.girl.triggerExpression('huh', 0.55, 'forgive');
      this.dad.triggerExpression('huh', 0.55, 'forgive');
      setTimeout(() => {
        if (this.stage === 1) {
          this.girl.triggerExpression('forgive', 1.3, 'happy');
          this.dad.triggerExpression('forgive', 1.3, 'happy');
        }
      }, 540);
    }

    // Check if all 10 town items have been sorted into crates!
    const allSorted = this.recyclables.every((r) => r.state === 'sorted');
    if (allSorted) {
      setTimeout(() => this._transitionToStage2(), 950);
    }
  }

  _dumpCrateIntoHopper(crateObj) {
    if (crateObj.loadedIntoHopper) return;
    crateObj.loadedIntoHopper = true;
    this.sound.playHopperToss();
    this.girl.triggerExpression('proud', 1.1);

    // Move all 3D items from this crate into the Garbage Truck's Stainless-Steel Hopper Trough!
    crateObj.items.forEach((item, idx) => {
      item.state = 'inHopper';
      this.truck.hopperGroup.add(item.group);
      item.group.position.set(
        (Math.random() - 0.5) * 1.15,
        0.74 + idx * 0.06 + Math.random() * 0.06,
        0.54 + (Math.random() - 0.5) * 0.24
      );
      item.group.rotation.set(Math.random() * 2, Math.random() * 3, Math.random() * 2);
    });

    // Park empty crate neatly to the left curb
    crateObj.group.rotation.x = 0;
    crateObj.homePos.set(-1.75, 0.0, -0.4 - this.crates.indexOf(crateObj) * 0.42);
  }

  _crushAllHopperContents(compactionLevel) {
    this.recyclables.forEach((item) => {
      if (item.state === 'inHopper') {
        applyCrushDeformation(item.group, compactionLevel);
        // Push heap deeper & flatter into the stainless-steel hopper belly!
        item.group.position.y = Math.max(0.64, item.group.position.y - 0.018);
        item.group.position.z = Math.max(0.30, item.group.position.z - 0.022);
      }
    });

    this.flutterPapers.sheets.forEach((s) => {
      if (s.state === 'inHopper' && s.geo.userData.basePos) {
        applyCrushDeformation(s.mesh, compactionLevel);
      }
    });
  }

  _catchPaperSheet(sheet) {
    const hopperWorld = this.truck.getHopperWorldCenter();
    const midAir = this.flutterPapers.catchSheet(sheet, hopperWorld);
    if (midAir) {
      this.paperAirCaughtCount++;
    } else if (sheet.landedWet) {
      this.paperWetCaughtCount++;
    }
    this.sound.playPaperCatch(midAir);
    this.girl.triggerExpression(midAir ? 'cheering' : 'happy', 1.0);

    if (this.flutterPapers.remainingToCatch() === 0) {
      this.dad.recoverFromSlip();
    }
  }

  _sweepPapersNearRay() {
    const wp = this._projectToPlaneY(0.25, new THREE.Vector3());
    const wpLow = this._projectToPlaneY(0.02, new THREE.Vector3());
    this.flutterPapers.sheets.forEach((s) => {
      if (s.state === 'airborne' || s.state === 'landed') {
        const d1 = s.mesh.position.distanceTo(wp);
        const d2 = s.mesh.position.distanceTo(wpLow);
        if (d1 < 0.44 || d2 < 0.44) {
          this._catchPaperSheet(s);
        }
      }
    });
  }

  _checkStage2Progression() {
    const allCratesLoaded = this.crates.every((c) => c.loadedIntoHopper || c.items.length === 0);
    if (!allCratesLoaded) return;

    // Trigger Dad's funny puddle slip & fluttering paper scatter after initial compaction!
    if (!this.dadBlunderTriggered && this.truck.totalCompaction >= 0.30) {
      this._triggerDadPaperBlunder();
      return;
    }

    // Once Dad's scattered papers have all been rescued into the hopper AND compacted once more -> Bloom Scene 3!
    if (
      this.dadBlunderTriggered &&
      this.flutterPapers.remainingToCatch() === 0 &&
      this.truck.totalCompaction >= 0.55
    ) {
      setTimeout(() => this._transitionToStage3(), 850);
    }
  }

  _triggerGentleIdleHint() {
    // Wordless 10-second inactivity hint: show soft sunlit ripple on 1 relevant object once, never stealing control!
    let targetPos = null;
    if (this.stage === 0 && this.dressStand) {
      const next = this.dressStand.items.find((i) =>
        !this.girl.hasCap ? i.kind === 'cap' : !this.girl.hasVest && i.kind === 'vest'
      );
      if (next) {
        targetPos = new THREE.Vector3();
        next.group.getWorldPosition(targetPos);
      }
    } else if (this.stage === 1) {
      const loose = this.recyclables.find((r) => r.state === 'ground');
      const bag = this.trashBags.find((b) => !b.empty);
      if (loose) targetPos = loose.group.position.clone();
      else if (bag) targetPos = bag.group.position.clone().add(new THREE.Vector3(0, 0.25, 0));
    } else if (this.stage === 2) {
      const remCrate = this.crates.find((c) => !c.loadedIntoHopper && c.items.length > 0);
      if (this.flutterPapers.remainingToCatch() > 0) {
        const s = this.flutterPapers.sheets.find((p) => p.state === 'airborne' || p.state === 'landed');
        if (s) targetPos = s.mesh.position.clone();
      } else if (remCrate) {
        targetPos = remCrate.group.position.clone().add(new THREE.Vector3(0, 0.25, 0));
      } else {
        targetPos = this.truck.getLeverKnobWorldPos();
      }
    }

    if (targetPos) {
      this.hintRing.position.copy(targetPos);
      this.hintRing.lookAt(this.camera.position);
      this.hintRing.visible = true;
      this.hintAnim = 1.8;
    }
  }

  _enableReflectionLayer(rootObj) {
    rootObj.traverse((o) => {
      if (o.isMesh && o.material && o.material.visible !== false) {
        o.layers.enable(1);
      }
    });
  }

  _animate() {
    requestAnimationFrame(this._animate);

    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.time += dt;
    if (this.crunchSoundCooldown > 0) this.crunchSoundCooldown -= dt;
    if (this.spraySoundCooldown > 0) this.spraySoundCooldown -= dt;

    // Smooth cinematic camera glide & girl side-positioning
    this.camera.position.lerp(this.camPosTarget, Math.min(1, dt * 3.5));
    this.camLookCurrent.lerp(this.camLookTarget, Math.min(1, dt * 4.0));
    this.camera.lookAt(this.camLookCurrent);

    const girlTargetPos =
      this.stage === 0
        ? new THREE.Vector3(-0.92, 0.0, 2.02)
        : this.stage === 3
          ? new THREE.Vector3(-1.12, 0.0, 2.18)
          : new THREE.Vector3(-1.18, 0.0, 2.15);
    this.girl.group.position.lerp(girlTargetPos, Math.min(1, dt * 3.5));

    if (this.stage >= 1 && this.dressStand) {
      this.dressStand.group.position.z += (-3.5 - this.dressStand.group.position.z) * Math.min(1, dt * 3.2);
      if (this.dressStand.group.position.z < -2.8) this.dressStand.group.visible = false;
    }

    // Spring lever smoothly back to top when released
    if (!this.dragAction || this.dragAction.type !== 'lever') {
      if (this.truck.leverPull > 0.002) {
        const nextPull = Math.max(0, this.truck.leverPull - dt * 2.6);
        this.truck.setCompactionVisuals(nextPull, nextPull);
      }
    }

    // Signboard gentle spring-back
    this.street.signboardGroup.rotation.z *= 0.88;

    // Update Crates positioning & bounce
    this.crates.forEach((c) => {
      if (!this.dragAction || this.dragAction.crateObj !== c) {
        c.group.position.lerp(c.homePos, Math.min(1, dt * 5.0));
      }
      if (Math.abs(c.bounceVel) > 0.001) {
        c.group.scale.y = 1.0 + c.bounceVel;
        c.group.scale.x = 1.0 - c.bounceVel * 0.5;
        c.bounceVel *= -0.62;
      } else {
        c.group.scale.set(1, 1, 1);
      }
    });

    // Update Translucent Garbage Bags crinkle wiggle
    this.trashBags.forEach((b) => {
      if (!this.dragAction || this.dragAction.bagObj !== b) {
        b.group.position.lerp(b.homePos, Math.min(1, dt * 5.5));
      }
      if (b.wiggle > 0.01) {
        b.wiggle *= 0.88;
        const s = 1.0 + Math.sin(this.time * 28.0) * 0.06 * b.wiggle;
        if (!b.empty) b.bagMesh.scale.set(s, 2.0 - s, s);
      }
    });

    // Update Loose Recyclable gravity & bounce on wet pavement
    this.recyclables.forEach((r) => {
      if (r.state === 'ground' && r.group.visible) {
        if (r.group.position.y > 0.095 || Math.abs(r.vel.y) > 0.02) {
          r.vel.y -= 9.5 * dt;
          r.group.position.addScaledVector(r.vel, dt);
          r.group.position.x = Math.max(-1.25, Math.min(1.35, r.group.position.x));
          r.group.position.z = Math.max(1.35, Math.min(2.68, r.group.position.z));
          if (r.group.position.y <= 0.095) {
            r.group.position.y = 0.095;
            r.vel.y = -r.vel.y * 0.28;
            r.vel.x *= 0.55;
            r.vel.z *= 0.55;
            if (Math.abs(r.vel.y) < 0.15) r.vel.set(0, 0, 0);
          }
        }
      }
    });

    // Dad's Puddle Slip Trigger when trotting onto foreground puddle!
    if (this.dad.state === 'trottingIn' && this.dad.group.position.x <= 1.08) {
      this._executeDadSlip();
    }

    // Hold-to-grow flower in Scene 3!
    if (this.growingFlower) {
      this.growingFlower.growth = Math.min(1.65, this.growingFlower.growth + dt * 0.78);
      this.growingFlower.group.scale.setScalar(this.growingFlower.growth);
    }

    // Update Scene 3 Sandbox Crafts (spinning pinwheels & swaying blossoms!)
    this.sandboxCrafts.forEach((sc) => {
      if (sc.kind === 'pinwheel' && sc.rotor) {
        sc.rotor.rotation.z += sc.spinSpeed * dt;
        sc.spinSpeed = Math.max(2.2, sc.spinSpeed - dt * 1.8);
      } else if (sc.kind === 'flower') {
        sc.group.rotation.z = Math.sin(this.time * 2.1 + sc.swayPhase) * 0.055;
      }
    });

    // 10-Second Wordless Idle Hint (0-10s nothing, at 10s gentle pulse once)
    if (!this.dragAction && this.stage < 3) {
      this.idleSeconds += dt;
      if (this.idleSeconds >= 10.0 && !this.idleHintShownForStage) {
        this.idleHintShownForStage = true;
        this._triggerGentleIdleHint();
      }
    }
    if (this.hintAnim > 0) {
      this.hintAnim -= dt;
      const p = 1.0 - (this.hintAnim % 0.9) / 0.9;
      this.hintRing.scale.setScalar(0.85 + p * 0.75);
      this.hintRing.material.opacity = Math.sin(p * Math.PI) * 0.65;
      if (this.hintAnim <= 0) this.hintRing.visible = false;
    }

    // Update Core Subsystems
    this.street.update(dt);
    this.truck.update(dt, this.stage);
    this.girl.update(dt);
    this.dad.update(dt);
    this.playerHand.update(dt);
    this.flutterPapers.update(dt, this.time);
    if (this.stage === 3) {
      this.kids.forEach((k) => k.update(dt));
    }
    this.sound.updateAmbient(dt, this.stage);

    // Render Real-Time Wet Pavement Puddle Planar Reflection + Main Low-Angle Scene!
    this.street.renderPlanarReflection(this.camera);
    this.renderer.render(this.scene, this.camera);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new GarbageTruckGame();
});
