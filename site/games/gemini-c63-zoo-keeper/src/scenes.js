import * as THREE from 'three';
import {
  BOOT_OPTIONS,
  APRON_OPTIONS,
  createRubberBootMesh,
  createApronDisplayMesh
} from './characters.js';

const SOAP_PALETTE = [
  { id: 'milk', color: new THREE.Color(0xfcfdff), barHex: 0xf5efe4 },
  { id: 'berry', color: new THREE.Color(0xffe6ee), barHex: 0xde7a93 },
  { id: 'mint', color: new THREE.Color(0xe6fff1), barHex: 0x7cb892 }
];

export class ZooSimulationScenes {
  constructor({ scene, camera, audio, textures, env, foam, water, animals, girl, hand, dad }) {
    this.scene = scene;
    this.camera = camera;
    this.audio = audio;
    this.textures = textures;
    this.env = env;
    this.foam = foam;
    this.water = water;
    this.animals = animals; // { zebra, elephant, tiger, lion, giraffe }
    this.girl = girl;
    this.hand = hand;
    this.dad = dad;

    this.stage = 0; // 0: Dress-Up, 1: Zebra & Elephant Foam/Hose, 2: Tiger/Lion/Giraffe, 3: Dad Watermelon & Free Sanctuary
    this.stageTime = 0;
    this.idleTime = 0;
    this.goalCelebrated = false;
    this.transitionProgress = 1.0;

    // Camera framing targets (fixed player-hands-free framing, responsive to portrait/landscape)
    this.camPosTarget = new THREE.Vector3(0, 1.25, 3.3);
    this.camLookTarget = new THREE.Vector3(0, 1.05, 0);
    this.currentLook = new THREE.Vector3(0, 1.05, 0);

    // Interactive props per stage
    this.propsRoot = new THREE.Group();
    this.scene.add(this.propsRoot);
    this.interactables = [];

    // Live flexible 3D garden hose curve connecting faucet stand to girl's hand!
    this.hoseStandOrigin = new THREE.Vector3(1.55, 0.42, 1.45);
    const hosePts = [
      this.hoseStandOrigin.clone(),
      new THREE.Vector3(1.2, 0.08, 1.6),
      new THREE.Vector3(0.6, 0.25, 1.7),
      new THREE.Vector3(0.4, 0.8, 1.8)
    ];
    this.hoseCurve = new THREE.CatmullRomCurve3(hosePts);
    this.hoseTubeMat = new THREE.MeshStandardMaterial({ color: 0x2d6b45, roughness: 0.42 });
    this.hoseTubeMesh = new THREE.Mesh(new THREE.TubeGeometry(this.hoseCurve, 18, 0.022, 8, false), this.hoseTubeMat);
    this.hoseTubeMesh.visible = false;
    this.scene.add(this.hoseTubeMesh);

    // Pointer & 1-finger tool state
    this.pointerDown = false;
    this.pointerNDC = new THREE.Vector2(0, 0);
    this.prevPointerNDC = new THREE.Vector2(0, 0);
    this.pointerSpeed = 0;
    this.raycaster = new THREE.Raycaster();
    this.dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.9);
    this.handWorldTarget = new THREE.Vector3(0.5, 0.85, 1.4);

    // Rich continuous simulation state variables ("完成品が数百通り以上に分かれる本物のシミュレーション")
    this.selectedSoap = SOAP_PALETTE[0];
    this.branchHasHibiscus = false;
    this.watermelonIsGolden = false;
    this.lionPlateItems = []; // Physical meat/fish/melon slices placed on Lion's rock!
    this.watermelons = []; // Physical rolling & sliceable watermelons in Stage 3!
    this.slicedPlatters = []; // Custom-sliced watermelon wedges/halves/cubes created by daughter!
    this.draggedMelon = null;

    // Audio continuous rates
    this.audioHose = 0;
    this.audioHoseAnimal = false;
    this.audioFoam = 0;
    this.audioBrush = 0;
    this.audioGloss = 0;

    this.enterStage(0);
  }

  _clearProps() {
    while (this.propsRoot.children.length > 0) {
      this.propsRoot.remove(this.propsRoot.children[0]);
    }
    this.interactables.length = 0;
    this.draggedMelon = null;
  }

  enterStage(stageIdx) {
    this.stage = stageIdx;
    this.stageTime = 0;
    this.idleTime = 0;
    this.goalCelebrated = false;
    this._clearProps();

    // Hide all animals first, then stage-place them with persistent care states!
    Object.values(this.animals).forEach((a) => {
      a.root.visible = false;
    });
    this.env.gateOpenTarget = 0;
    this.env.setSignScene(stageIdx);
    this.hoseTubeMesh.visible = false;

    if (stageIdx === 0) {
      this._setupStage0DressUp();
    } else if (stageIdx === 1) {
      this._setupStage1Wash();
    } else if (stageIdx === 2) {
      this._setupStage2BrushAndFeed();
    } else if (stageIdx === 3) {
      this._setupStage3WatermelonParty();
    }
  }

  // STAGE 0: Keeper Boots & Apron Dress-Up!
  _setupStage0DressUp() {
    this.camPosTarget.set(0, 1.12, 2.75);
    this.camLookTarget.set(0, 0.78, 0.15);

    this.env.tubGroup.visible = false;
    this.env.signGroup.position.set(-1.55, 0, -0.55);
    this.env.signGroup.rotation.y = 0.45;

    // Girl stands front-and-center eager to put on her Zookeeper outfit!
    this.girl.root.visible = true;
    this.girl.root.position.set(0, 0, 0.35);
    this.girl.root.rotation.set(0, 0, 0);
    this.girl.root.scale.setScalar(1.16);
    this.hand.root.visible = false;

    // Zebra & Elephant visible gently breathing in the background paddock!
    this.animals.zebra.root.visible = true;
    this.animals.zebra.root.position.set(-1.95, 0, -2.5);
    this.animals.zebra.root.rotation.y = 0.55;

    this.animals.elephant.root.visible = true;
    this.animals.elephant.root.position.set(2.05, 0, -2.9);
    this.animals.elephant.root.rotation.y = -0.52;

    // Dad smiling warmly by the fence
    this.dad.root.visible = true;
    this.dad.state = 'standing';
    this.dad.root.position.set(1.55, 0, -1.1);
    this.dad.root.rotation.y = -0.45;

    // Low Wooden Dress-Up Bench on Left (3 Rubber Boot Pairs) & Right (3 Canvas Aprons)!
    const woodMat = new THREE.MeshStandardMaterial({ map: this.textures.woodMap, roughness: 0.78 });
    const leftBench = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.16, 0.48), woodMat);
    leftBench.position.set(-0.88, 0.08, 0.72);
    leftBench.castShadow = true;
    leftBench.receiveShadow = true;
    this.propsRoot.add(leftBench);

    BOOT_OPTIONS.forEach((opt, i) => {
      const pair = new THREE.Group();
      const bL = createRubberBootMesh(opt.color, opt.soleColor, 0.95);
      bL.position.x = -0.075;
      const bR = createRubberBootMesh(opt.color, opt.soleColor, 0.95);
      bR.position.x = 0.075;
      pair.add(bL, bR);
      pair.position.set(-1.18 + i * 0.31, 0.16, 0.72);
      pair.rotation.y = 0.28;

      const hit = new THREE.Mesh(
        new THREE.BoxGeometry(0.30, 0.42, 0.36),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hit.position.y = 0.18;
      hit.userData.dressBoot = opt;
      hit.userData.visualGroup = pair;
      pair.add(hit);
      this.propsRoot.add(pair);
      this.interactables.push(hit);
    });

    // Wooden Apron Rack on Right (3 Zookeeper Aprons!)
    const rightRack = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.08, 0.08), woodMat);
    rightRack.position.set(0.92, 0.82, 0.65);
    this.propsRoot.add(rightRack);
    [-0.46, 0.46].forEach((ox) => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.86, 8), woodMat);
      post.position.set(0.92 + ox, 0.43, 0.65);
      this.propsRoot.add(post);
    });

    APRON_OPTIONS.forEach((opt, i) => {
      const ap = createApronDisplayMesh(opt);
      ap.position.set(0.60 + i * 0.32, 0.36, 0.68);
      ap.rotation.y = -0.24;

      const hit = new THREE.Mesh(
        new THREE.BoxGeometry(0.31, 0.54, 0.28),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hit.position.y = 0.24;
      hit.userData.dressApron = opt;
      hit.userData.visualGroup = ap;
      ap.add(hit);
      this.propsRoot.add(ap);
      this.interactables.push(hit);
    });
  }

  _positionGirlCompanion() {
    // Expressive 5-year-old girl stands clearly visible at lower-left foreground rail reacting to every touch!
    this.girl.root.visible = true;
    const isPortrait = window.innerWidth < window.innerHeight;
    this.girl.root.position.set(isPortrait ? -0.46 : -0.74, -0.04, 2.02);
    this.girl.root.rotation.set(0, 0.52, 0);
    this.girl.root.scale.setScalar(0.92);

    this.hand.root.visible = true;
    this.hand.setCuffColor(this.girl.apronOption.color);
  }

  // STAGE 1: Life-Sized Zebra & Elephant — Mountains of Foam & Pressurized Water Hose!
  _setupStage1Wash() {
    this.camPosTarget.set(0, 1.32, 3.35);
    this.camLookTarget.set(0.04, 1.02, -0.05);

    this.env.tubGroup.visible = true;
    this.env.tubGroup.position.set(0.06, 0.16, 1.48);
    this.env.waterLevel = 0.56;
    this.env.signGroup.position.set(-2.35, 0, -1.45);
    this.env.signGroup.rotation.y = 0.42;

    this._positionGirlCompanion();
    this.hand.setTool('sponge');

    // Life-sized Zebra & Elephant close up, filling the frame!
    const { zebra, elephant } = this.animals;
    zebra.root.visible = true;
    zebra.root.position.set(-0.98, 0, 0.12);
    zebra.root.rotation.y = 0.56;

    elephant.root.visible = true;
    elephant.root.position.set(0.95, 0, -0.22);
    elephant.root.rotation.y = -0.52;

    // Dad helping beside the fence (and hilarious if splashed/foamed!)
    this.dad.root.visible = true;
    this.dad.state = 'standing';
    this.dad.root.position.set(-2.05, 0, -0.65);
    this.dad.root.rotation.y = 0.55;

    this._buildSoapAndHoseStation({ zPos: 1.68, yBase: 0.36 });
  }

  _buildSoapAndHoseStation({ zPos = 1.68, xOffset = 0, yBase = 0.32, includeBrush = true } = {}) {
    const woodMat = new THREE.MeshStandardMaterial({ map: this.textures.woodMap, roughness: 0.78 });

    // Foreground rustic wooden keeper workbench ledge so every soap & tool is clearly visible in 1 screen!
    const benchPlank = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.08, 0.42), woodMat);
    benchPlank.position.set(xOffset + 0.16, yBase - 0.04, zPos);
    benchPlank.castShadow = true;
    benchPlank.receiveShadow = true;
    this.propsRoot.add(benchPlank);

    // 3 Tactile Wooden Soap Bowls (Creamy Milk, Berry Pink, Herbal Mint!)
    SOAP_PALETTE.forEach((sp, idx) => {
      const bowl = new THREE.Group();
      bowl.position.set(xOffset - 0.52 + idx * 0.31, yBase, zPos);

      const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.115, 0.10, 16), woodMat);
      dish.position.y = 0.05;
      dish.castShadow = true;
      bowl.add(dish);

      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.055, 0.085),
        new THREE.MeshPhysicalMaterial({ color: sp.barHex, roughness: 0.22, clearcoat: 0.65 })
      );
      bar.position.y = 0.105;
      bar.rotation.y = 0.25;
      bowl.add(bar);

      // Fluffy foam puffs brimming on the soap dish
      for (let p = 0; p < 4; p++) {
        const pf = new THREE.Mesh(
          new THREE.SphereGeometry(0.042, 10, 8),
          new THREE.MeshStandardMaterial({ color: sp.color, emissive: 0xd8e2ea, emissiveIntensity: 0.25, roughness: 0.28 })
        );
        pf.position.set((p - 1.5) * 0.038, 0.118, (p % 2 - 0.5) * 0.045);
        bowl.add(pf);
      }

      const hit = new THREE.Mesh(
        new THREE.BoxGeometry(0.30, 0.34, 0.34),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hit.position.y = 0.14;
      hit.userData.toolPick = 'sponge';
      hit.userData.soapChoice = sp;
      bowl.add(hit);
      this.propsRoot.add(bowl);
      this.interactables.push(hit);
    });

    if (includeBrush) {
      // Scrub / Grooming Brush on keeper ledge
      const bStand = new THREE.Group();
      bStand.position.set(xOffset + 0.48, yBase + 0.02, zPos);
      const bWood = new THREE.Mesh(new THREE.CapsuleGeometry(0.058, 0.13, 8, 12), woodMat);
      bWood.rotation.z = Math.PI / 2;
      bWood.position.y = 0.06;
      bStand.add(bWood);
      const bBristle = new THREE.Mesh(
        new THREE.BoxGeometry(0.17, 0.04, 0.095),
        new THREE.MeshStandardMaterial({ color: 0xe6d8bc, roughness: 0.9 })
      );
      bBristle.position.y = 0.025;
      bStand.add(bBristle);

      const hitB = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.32, 0.32),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hitB.position.y = 0.12;
      hitB.userData.toolPick = 'brush';
      bStand.add(hitB);
      this.propsRoot.add(bStand);
      this.interactables.push(hitB);
    }

    // Coiled Green Garden Hose Stand & Shiny Brass Nozzle!
    const hoseStand = new THREE.Group();
    hoseStand.position.set(xOffset + 0.88, yBase - 0.12, zPos - 0.04);
    this.hoseStandOrigin.set(xOffset + 0.88, yBase + 0.22, zPos - 0.04);

    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.05, 0.44, 10), woodMat);
    post.position.y = 0.22;
    post.castShadow = true;
    hoseStand.add(post);

    for (let c = 0; c < 3; c++) {
      const coil = new THREE.Mesh(new THREE.TorusGeometry(0.125, 0.022, 8, 20), this.hoseTubeMat);
      coil.position.set(0, 0.26, 0.04 + c * 0.042);
      hoseStand.add(coil);
    }
    const brassNozzle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.024, 0.036, 0.17, 12),
      new THREE.MeshStandardMaterial({ color: 0xd9a83e, roughness: 0.22, metalness: 0.85 })
    );
    brassNozzle.position.set(0.10, 0.33, 0.12);
    brassNozzle.rotation.z = -0.65;
    hoseStand.add(brassNozzle);

    const hitH = new THREE.Mesh(
      new THREE.BoxGeometry(0.44, 0.56, 0.42),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hitH.position.y = 0.26;
    hitH.userData.toolPick = 'hose';
    hoseStand.add(hitH);
    this.propsRoot.add(hoseStand);
    this.interactables.push(hitH);
  }

  // STAGE 2: Tiger Brushing (Silky Fur), Lion Meal, & Giraffe High Leaves!
  _setupStage2BrushAndFeed() {
    this.camPosTarget.set(0, 1.30, 3.42);
    this.camLookTarget.set(0.04, 1.00, -0.05);

    this.env.tubGroup.visible = false;
    this.env.signGroup.position.set(-2.35, 0, -1.45);
    this.env.signGroup.rotation.y = 0.42;

    this._positionGirlCompanion();
    this.hand.setTool('brush');
    this.lionPlateItems.length = 0;

    // 1. Tiger up-close on left-center sun-warmed stone slab so its thick striped fur fills view!
    const { tiger, lion, giraffe } = this.animals;
    tiger.root.visible = true;
    tiger.root.position.set(-0.95, 0.12, 0.45);
    tiger.root.rotation.y = 0.62;

    const tigerSlab = new THREE.Mesh(
      new THREE.CylinderGeometry(0.82, 0.92, 0.14, 18),
      new THREE.MeshStandardMaterial({ color: 0x857e72, roughness: 0.88 })
    );
    tigerSlab.position.set(-0.95, 0.06, 0.42);
    tigerSlab.scale.set(1.0, 1, 1.25);
    tigerSlab.receiveShadow = true;
    this.propsRoot.add(tigerSlab);

    // 2. Regal Lion in center-back with flat stone feeding platter right in front of him!
    lion.root.visible = true;
    lion.root.position.set(0.18, 0.08, -0.25);
    lion.root.rotation.y = -0.12;

    const lionRock = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.48, 0.14, 16),
      new THREE.MeshStandardMaterial({ color: 0x7a7367, roughness: 0.86 })
    );
    lionRock.position.set(0.22, 0.07, 0.68);
    lionRock.receiveShadow = true;
    lionRock.userData.isLionPlate = true;
    this.propsRoot.add(lionRock);
    this.interactables.push(lionRock);

    // 3. Towering Giraffe on right, stretching neck high or dipping gently so face & eyelashes stay clearly visible!
    giraffe.root.visible = true;
    giraffe.root.position.set(1.22, 0, -0.55);
    giraffe.root.rotation.y = -0.55;
    giraffe.targetNeckReachY = 1.92;

    // High Wooden Feeding Branch Hook for Giraffe (can also hang branches up high!)
    const woodMat = new THREE.MeshStandardMaterial({ map: this.textures.woodMap, roughness: 0.8 });
    const highPole = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 2.85, 10), woodMat);
    highPole.position.set(1.95, 1.42, 0.25);
    highPole.castShadow = true;
    this.propsRoot.add(highPole);

    const hookArm = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.06, 0.06), woodMat);
    hookArm.position.set(1.72, 2.65, 0.25);
    this.propsRoot.add(hookArm);

    const highHookHit = new THREE.Mesh(
      new THREE.SphereGeometry(0.38, 8, 8),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    highHookHit.position.set(1.52, 2.48, 0.25);
    highHookHit.userData.isGiraffeHook = true;
    this.propsRoot.add(highHookHit);
    this.interactables.push(highHookHit);

    // Dad watching proudly in background
    this.dad.root.visible = true;
    this.dad.state = 'standing';
    this.dad.root.position.set(-1.95, 0, -1.15);
    this.dad.root.rotation.y = 0.45;

    // Foreground Wooden Keeper Table right in front of the child: [1] Grooming Brush, [2] Savanna Meat Platter, [3] Acacia & Hibiscus Branches!
    const tablePlank = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.08, 0.42), woodMat);
    tablePlank.position.set(0.22, 0.30, 1.72);
    tablePlank.castShadow = true;
    tablePlank.receiveShadow = true;
    this.propsRoot.add(tablePlank);

    // 1. Brush station
    const brushPad = new THREE.Group();
    brushPad.position.set(-0.36, 0.34, 1.72);
    const padDisk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.20, 0.06, 16), woodMat);
    padDisk.position.y = 0.03;
    brushPad.add(padDisk);
    const brushDisplay = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.14, 8, 12), woodMat);
    brushDisplay.rotation.z = Math.PI / 2;
    brushDisplay.position.y = 0.11;
    brushPad.add(brushDisplay);
    const hitBr = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.36, 0.42), new THREE.MeshBasicMaterial({ visible: false }));
    hitBr.position.y = 0.15;
    hitBr.userData.toolPick = 'brush';
    brushPad.add(hitBr);
    this.propsRoot.add(brushPad);
    this.interactables.push(hitBr);

    // 2. Heavy Wooden Meat & Fish Bowl
    const meatBowl = new THREE.Group();
    meatBowl.position.set(0.24, 0.34, 1.72);
    const bowlMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 0.12, 18), woodMat);
    bowlMesh.position.y = 0.06;
    bowlMesh.castShadow = true;
    meatBowl.add(bowlMesh);
    for (let m = 0; m < 3; m++) {
      const steakGrp = new THREE.Group();
      const steak = new THREE.Mesh(
        new THREE.CylinderGeometry(0.075, 0.08, 0.045, 12),
        new THREE.MeshStandardMaterial({ color: m === 2 ? 0xc87441 : 0xa33229, roughness: 0.52 })
      );
      steak.scale.set(1.25, 1, 0.85);
      steakGrp.add(steak);
      const marrow = new THREE.Mesh(
        new THREE.CylinderGeometry(0.022, 0.022, 0.049, 10),
        new THREE.MeshStandardMaterial({ color: 0xf2ead9, roughness: 0.45 })
      );
      marrow.position.x = 0.025;
      steakGrp.add(marrow);
      steakGrp.rotation.set(0.25, m * 1.1, 0.18);
      steakGrp.position.set((m - 1) * 0.075, 0.145, (m % 2 - 0.5) * 0.055);
      meatBowl.add(steakGrp);
    }
    const hitMeat = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.38, 0.44), new THREE.MeshBasicMaterial({ visible: false }));
    hitMeat.position.y = 0.16;
    hitMeat.userData.toolPick = 'meat';
    meatBowl.add(hitMeat);
    this.propsRoot.add(meatBowl);
    this.interactables.push(hitMeat);

    // 3. Woven Keeper Basket overflowing with Fresh Acacia & Red Hibiscus Branches!
    const basket = new THREE.Group();
    basket.position.set(0.84, 0.24, 1.68);
    const bBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.18, 0.32, 16),
      new THREE.MeshStandardMaterial({ color: 0xb58d59, roughness: 0.88 })
    );
    bBody.position.y = 0.16;
    bBody.castShadow = true;
    basket.add(bBody);

    [-0.08, 0.08].forEach((bx, bi) => {
      const stalk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.012, 0.018, 0.55, 6),
        new THREE.MeshStandardMaterial({ color: 0x5c4228, roughness: 0.85 })
      );
      stalk.position.set(bx, 0.38, 0);
      stalk.rotation.z = bi === 0 ? 0.25 : -0.25;
      basket.add(stalk);
      for (let lf = 0; lf < 5; lf++) {
        const leaf = new THREE.Mesh(
          new THREE.SphereGeometry(0.048, 8, 6),
          new THREE.MeshStandardMaterial({ color: 0x4b8e38, roughness: 0.58 })
        );
        leaf.scale.set(1.4, 0.25, 0.75);
        leaf.position.set(bx + (lf % 2 ? 0.06 : -0.06), 0.30 + lf * 0.07, 0.02);
        basket.add(leaf);
      }
      if (bi === 1) {
        const flw = new THREE.Mesh(
          new THREE.SphereGeometry(0.045, 8, 8),
          new THREE.MeshStandardMaterial({ color: 0xd93b52, roughness: 0.45 })
        );
        flw.position.set(bx - 0.05, 0.62, 0.03);
        basket.add(flw);
      }
    });

    const hitBrn = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.72, 0.46), new THREE.MeshBasicMaterial({ visible: false }));
    hitBrn.position.y = 0.34;
    hitBrn.userData.toolPick = 'branch';
    basket.add(hitBrn);
    this.propsRoot.add(basket);
    this.interactables.push(hitBrn);
  }

  // STAGE 3: Dad's Watermelon Blunder -> Daughter Rescues & All-Animal Free Play Sanctuary!
  _setupStage3WatermelonParty() {
    this.camPosTarget.set(0, 1.38, 3.65);
    this.camLookTarget.set(0, 1.08, -0.15);

    this.env.tubGroup.visible = true;
    this.env.tubGroup.position.set(-0.52, 0, 1.48);
    this.env.waterLevel = 0.68;
    this.env.signGroup.position.set(-2.55, 0, -1.65);

    this._positionGirlCompanion();
    this.hand.setTool('sponge');
    this.watermelons.length = 0;
    this.slicedPlatters.length = 0;

    // ALL 5 CARED-FOR ANIMALS lined up warmly in a joyful sanctuary semicircle!
    const { zebra, elephant, tiger, lion, giraffe } = this.animals;

    zebra.root.visible = true;
    zebra.root.position.set(-1.78, 0, -0.45);
    zebra.root.rotation.y = 0.68;

    tiger.root.visible = true;
    tiger.root.position.set(-0.88, 0, -0.82);
    tiger.root.rotation.y = 0.34;

    elephant.root.visible = true;
    elephant.root.position.set(0.16, 0, -1.35);
    elephant.root.rotation.y = -0.05;

    lion.root.visible = true;
    lion.root.position.set(1.15, 0, -0.78);
    lion.root.rotation.y = -0.42;

    giraffe.root.visible = true;
    giraffe.root.position.set(1.92, 0, -0.68);
    giraffe.root.rotation.y = -0.68;
    giraffe.targetNeckReachY = 1.75;

    // Oak Chopping Stump in Center Foreground for slicing rescued watermelons!
    const woodMat = new THREE.MeshStandardMaterial({ map: this.textures.woodMap, roughness: 0.76 });
    const stump = new THREE.Group();
    stump.position.set(0.18, 0, 1.42);
    const stumpCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.33, 0.32, 20), woodMat);
    stumpCyl.position.y = 0.16;
    stumpCyl.castShadow = true;
    stumpCyl.receiveShadow = true;
    stumpCyl.userData.isChoppingStump = true;
    stump.add(stumpCyl);
    this.propsRoot.add(stump);
    this.interactables.push(stumpCyl);
    this.stumpPos = new THREE.Vector3(0.18, 0.32, 1.42);

    // Side Care Caddy so she can ALSO foam, hose, and brush all animals freely in Stage 3!
    this._buildSoapAndHoseStation({ zPos: 1.65, xOffset: 0.72, yBase: 0.22, includeBrush: true });

    // Dad walks in carrying 4 big striped watermelons and slips comically onto the grass beside the tub!
    this.dad.root.visible = true;
    this.dad.startWatermelonWalk(-3.15, -0.15);
    this.dad.justDroppedMelons = false;

    // Create 4 physical whole watermelons initially held in Dad's arms!
    for (let i = 0; i < 4; i++) {
      const mMat = new THREE.MeshPhysicalMaterial({
        map: this.textures.watermelonRind,
        roughness: 0.24,
        clearcoat: 0.65,
        clearcoatRoughness: 0.2
      });
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.185, 20, 16), mMat);
      mesh.scale.set(1.14, 0.96, 0.96);
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      // Muddy overlay shell (turns visible when rolled in courtyard puddles, washes off in tub/hose!)
      const mudShell = new THREE.Mesh(
        new THREE.SphereGeometry(0.189, 14, 12),
        new THREE.MeshStandardMaterial({
          color: 0x4b3928,
          roughness: 0.92,
          transparent: true,
          opacity: 0.0
        })
      );
      mesh.add(mudShell);

      this.propsRoot.add(mesh);
      const melonObj = {
        mesh,
        mudShell,
        isGolden: i % 2 === 1,
        mud: 0,
        chopCount: 0, // 0=whole, 1=halves, 2=juicy wedges, 3=party platter!
        state: 'carried', // 'carried' | 'rolling' | 'stump' | 'sliced'
        vel: new THREE.Vector3(),
        carryIdx: i
      };
      mesh.userData.melonObj = melonObj;
      this.watermelons.push(melonObj);
      this.interactables.push(mesh);
    }
  }

  _launchDadWatermelonTumble() {
    this.audio.playDadSlipAndRoll();
    this.girl.setExpression('huh', 0.9);
    setTimeout(() => {
      if (this.stage === 3) {
        this.girl.setExpression('delighted', 2.0);
        this.audio.playGirlGiggle();
      }
    }, 900);

    // Animals perk up and gently step/lean playfully after the rolling melons!
    Object.values(this.animals).forEach((a) => {
      a.mood = 'happy';
      a.moodTimer = 3.2;
    });

    const targets = [
      new THREE.Vector3(-0.95, 0, 0.82),
      new THREE.Vector3(-0.22, 0, 0.65),
      new THREE.Vector3(0.68, 0, 0.72),
      new THREE.Vector3(1.25, 0, 0.95)
    ];

    this.watermelons.forEach((m, idx) => {
      m.state = 'rolling';
      m.mesh.position.copy(this.dad.root.position).add(new THREE.Vector3(0.25, 0.65 + idx * 0.14, 0.15));
      const dir = targets[idx].clone().sub(m.mesh.position);
      m.vel.set(dir.x * 1.45, 1.3 + idx * 0.25, dir.z * 1.45);
      m.mud = 0.55; // Picks up comedic courtyard mud splashes as it rolls!
    });
  }

  _chopMelonOnStump(melon) {
    melon.chopCount++;
    this.audio.playWatermelonSlice();
    this.water.spawnSplash(this.stumpPos.clone().add(new THREE.Vector3(0, 0.15, 0)), new THREE.Vector3(0, 1, 0), 10, 0.65);
    this.girl.setExpression('delighted', 1.4);

    if (melon.chopCount === 1) {
      // Split into big juicy glistening halves right on the stump!
      melon.mesh.visible = false;
      melon.state = 'sliced';
      for (let s = 0; s < 2; s++) {
        this._spawnWatermelonSlice({
          pos: this.stumpPos.clone().add(new THREE.Vector3((s - 0.5) * 0.22, 0.08, (Math.random() - 0.5) * 0.12)),
          isGolden: melon.isGolden,
          shape: 'wedge'
        });
      }
      // Equip one juicy slice right into the girl's hand so she can immediately feed any animal!
      this.watermelonIsGolden = melon.isGolden;
      this.hand.wedgeMat.map = melon.isGolden ? this.textures.goldFleshMap : this.textures.redFleshMap;
      this.hand.wedgeMat.needsUpdate = true;
      this.hand.setTool('watermelon');
    }
  }

  _spawnWatermelonSlice({ pos, isGolden = false, shape = 'wedge' }) {
    const fleshMap = isGolden ? this.textures.goldFleshMap : this.textures.redFleshMap;
    const geo = shape === 'cube'
      ? new THREE.BoxGeometry(0.11, 0.09, 0.11)
      : new THREE.CylinderGeometry(0.15, 0.15, 0.055, 16, 1, false, 0, Math.PI);
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ map: fleshMap, roughness: 0.26 })
    );
    mesh.position.copy(pos);
    mesh.rotation.set((Math.random() - 0.5) * 0.2, Math.random() * Math.PI, Math.PI / 2);
    mesh.castShadow = true;
    const sliceObj = { mesh, isGolden, chopLevel: shape === 'cube' ? 2 : 1 };
    mesh.userData.sliceObj = sliceObj;
    this.propsRoot.add(mesh);
    this.slicedPlatters.push(sliceObj);
    this.interactables.push(mesh);
    return sliceObj;
  }

  // Pointer Input Handlers ("指一本・文字ゼロ・100ms以内即反応")
  onPointerDown(ndcX, ndcY) {
    this.audio.unlock();
    this.pointerDown = true;
    this.pointerNDC.set(ndcX, ndcY);
    this.prevPointerNDC.set(ndcX, ndcY);
    this.idleTime = 0;

    this._handleTapAndPick();
    this._applyContinuousTouch(0.032, true);
  }

  onPointerMove(ndcX, ndcY) {
    this.prevPointerNDC.copy(this.pointerNDC);
    this.pointerNDC.set(ndcX, ndcY);
    const dx = ndcX - this.prevPointerNDC.x;
    const dy = ndcY - this.prevPointerNDC.y;
    this.pointerSpeed = Math.min(2.5, Math.hypot(dx, dy) * 35);
    if (this.pointerDown) {
      this.idleTime = 0;
    }
  }

  onPointerUp() {
    if (this.draggedMelon) {
      // Check if dropped into water tub or onto chopping stump!
      const m = this.draggedMelon;
      const distTub = m.mesh.position.distanceTo(this.env.tubGroup.position);
      const distStump = m.mesh.position.distanceTo(this.stumpPos);
      if (distTub < 0.65) {
        m.mud = 0;
        m.mudShell.material.opacity = 0;
        this.audio.playBigSplash(0.75);
        this.water.spawnSplash(this.env.tubGroup.position.clone().add(new THREE.Vector3(0, 0.35, 0)), new THREE.Vector3(0, 1, 0), 18, 1.0);
        m.mesh.position.copy(this.stumpPos).add(new THREE.Vector3(0, 0.16, 0));
        m.state = 'stump';
      } else if (distStump < 0.68) {
        m.mesh.position.copy(this.stumpPos).add(new THREE.Vector3(0, 0.16, 0));
        m.state = 'stump';
        this._chopMelonOnStump(m);
      } else {
        m.state = 'rolling';
        m.vel.set((Math.random() - 0.5) * 0.4, 0.2, (Math.random() - 0.5) * 0.4);
      }
      this.draggedMelon = null;
    }
    this.pointerDown = false;
    this.pointerSpeed = 0;
  }

  _getAllRaycastTargets() {
    const list = [...this.interactables, this.env.ground];
    this.env.signBoardPivot.traverse((o) => { if (o.isMesh) list.push(o); });
    this.env.gatePivot.traverse((o) => { if (o.isMesh) list.push(o); });
    if (this.env.tubGroup.visible) {
      this.env.tubGroup.traverse((o) => { if (o.isMesh) list.push(o); });
    }
    this.dad.root.traverse((o) => { if (o.isMesh) list.push(o); });
    Object.values(this.animals).forEach((a) => {
      if (a.root.visible) list.push(...a.hitMeshes);
    });
    return list;
  }

  _handleTapAndPick() {
    this.raycaster.setFromCamera(this.pointerNDC, this.camera);
    const hits = this.raycaster.intersectObjects(this._getAllRaycastTargets(), false);
    if (!hits.length) return;

    for (const h of hits) {
      const ud = h.object.userData;

      // 1. Stage 0 Dress-Up Boots & Aprons!
      if (this.stage === 0) {
        if (ud.dressBoot) {
          this.girl.wearBoots(ud.dressBoot);
          this.audio.playBootPutOn();
          ud.visualGroup.scale.setScalar(0.85);
          this._checkDressUpComplete();
          return;
        }
        if (ud.dressApron) {
          this.girl.wearApron(ud.dressApron);
          this.audio.playApronPutOn();
          ud.visualGroup.scale.setScalar(0.85);
          this._checkDressUpComplete();
          return;
        }
      }

      // 2. Open Next-Paddock Gate!
      if (ud.isNextGate && this.goalCelebrated && this.stage < 3) {
        this.audio.playWarmChord([523.25, 659.25, 783.99, 1046.5], 0.12);
        this.enterStage(this.stage + 1);
        return;
      }

      // 3. Picture Signboard gentle swing
      if (ud.isSignboard) {
        this.env.signSwing = 0.65;
        this.audio.playBubblePop(0.5);
        return;
      }

      // 4. Foreground Tool / Food / Soap Pick!
      if (ud.toolPick) {
        this.hand.setTool(ud.toolPick);
        if (ud.soapChoice) {
          this.selectedSoap = ud.soapChoice;
          this.hand.spongeFoamMat.color.copy(ud.soapChoice.color);
          this.audio.playBubblePop(0.95);
        } else if (ud.toolPick === 'hose') {
          this.audio.playWaterDroplet(0.9);
        } else if (ud.toolPick === 'branch') {
          this.branchHasHibiscus = !this.branchHasHibiscus;
          this.hand.hibiscus.visible = this.branchHasHibiscus;
          this.hand.flowerLeaves.forEach((lf) => lf.scale.set(1.4, 0.22, 0.72));
          this.audio.playMunch(true);
        } else {
          this.audio.playBubblePop(0.7);
        }
        return;
      }

      // 5. Stage 3 Watermelon Pick / Chop / Slice Pick!
      if (ud.melonObj && ud.melonObj.state !== 'sliced') {
        const m = ud.melonObj;
        if (m.state === 'stump') {
          this._chopMelonOnStump(m);
        } else {
          this.draggedMelon = m;
          m.state = 'dragging';
          this.audio.playBubblePop(0.8);
        }
        return;
      }
      if (ud.sliceObj) {
        const sl = ud.sliceObj;
        if (sl.chopLevel === 1 && sl.mesh.position.distanceTo(this.stumpPos) < 0.45) {
          // Chop wedge again into bite-sized party cubes!
          sl.chopLevel = 2;
          sl.mesh.scale.set(0.55, 0.85, 0.55);
          this._spawnWatermelonSlice({
            pos: sl.mesh.position.clone().add(new THREE.Vector3(0.11, 0.04, 0.04)),
            isGolden: sl.isGolden,
            shape: 'cube'
          });
          this.audio.playWatermelonSlice();
        }
        this.watermelonIsGolden = sl.isGolden;
        this.hand.wedgeMat.map = sl.isGolden ? this.textures.goldFleshMap : this.textures.redFleshMap;
        this.hand.wedgeMat.needsUpdate = true;
        this.hand.setTool('watermelon');
        return;
      }
      if (ud.isChoppingStump && this.hand.activeTool === 'watermelon') {
        // Place extra watermelon wedge onto the stump tower!
        this._spawnWatermelonSlice({
          pos: this.stumpPos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.16, 0.08 + this.slicedPlatters.length * 0.035, (Math.random() - 0.5) * 0.12)),
          isGolden: this.watermelonIsGolden,
          shape: 'wedge'
        });
        this.audio.playBubblePop(0.8);
        return;
      }

      // 6. Poking full water tub sloshes & overflows even more! ("水を満杯に貯める・溢れさせる・ちょっかいで更に溢れる")
      if (ud.isWaterTub && this.hand.activeTool !== 'hose') {
        this.audio.playBigSplash(0.65);
        this.water.spawnSplash(h.point, new THREE.Vector3(0, 1, 0), 18, 0.95);
        if (this.env.waterLevel > 0.85) {
          this.water.addPuddle(this.env.tubGroup.position.x + (Math.random() - 0.5) * 0.7, this.env.tubGroup.position.z + 0.35, 0.22);
          this.foam.addFoamAtWorldPoint(this.env.tubGroup, h.point, new THREE.Vector3(0, 1, 0), {
            baseRadius: 0.11,
            color: this.selectedSoap.color
          });
        }
        return;
      }
    }
  }

  _checkDressUpComplete() {
    if (this.girl.hasBoots && this.girl.hasApron && !this.goalCelebrated) {
      this.goalCelebrated = true;
      this.audio.playWarmChord([523.25, 659.25, 783.99, 1046.5], 0.14);
      this.audio.playGirlGiggle();
      setTimeout(() => {
        if (this.stage === 0) this.enterStage(1);
      }, 1150);
    }
  }

  _applyContinuousTouch(dt, isFirstTap = false) {
    if (this.stage === 0) return;

    this.raycaster.setFromCamera(this.pointerNDC, this.camera);

    // Move dragged watermelon in 3D
    if (this.draggedMelon) {
      const planeHit = new THREE.Vector3();
      this.dragPlane.constant = -1.25;
      if (this.raycaster.ray.intersectPlane(this.dragPlane, planeHit)) {
        this.draggedMelon.mesh.position.set(
          THREE.MathUtils.clamp(planeHit.x, -2.0, 2.0),
          Math.max(0.22, THREE.MathUtils.clamp(planeHit.y, 0.22, 1.4)),
          THREE.MathUtils.clamp(planeHit.z, 0.5, 1.6)
        );
        this.handWorldTarget.copy(this.draggedMelon.mesh.position).add(new THREE.Vector3(0.08, 0.12, 0.16));
      }
      return;
    }

    const hits = this.raycaster.intersectObjects(this._getAllRaycastTargets(), false);
    const activeTool = this.hand.activeTool;

    // Position 3D Keeper Hand naturally in world space
    let targetWorld = new THREE.Vector3();
    if (hits.length > 0) {
      targetWorld.copy(hits[0].point);
    } else {
      this.dragPlane.constant = -0.6;
      this.raycaster.ray.intersectPlane(this.dragPlane, targetWorld);
    }

    if (activeTool === 'hose') {
      // Hold brass hose nozzle comfortably in foreground aiming at targetWorld!
      const handPos = new THREE.Vector3(
        THREE.MathUtils.clamp(this.pointerNDC.x * 1.15, -1.2, 1.2),
        THREE.MathUtils.clamp(0.75 + this.pointerNDC.y * 0.45, 0.45, 1.35),
        1.95
      );
      this.handWorldTarget.copy(handPos);
      this.hand.root.lookAt(targetWorld);

      // Fire pressurized water stream!
      const nozzleOrigin = new THREE.Vector3();
      this.hand.nozzleTip.getWorldPosition(nozzleOrigin);
      this.water.spawnStream(nozzleOrigin, targetWorld, 10, 0.13);
      this.audioHose = 1.0;

      // Check what the hose stream hits!
      if (hits.length > 0) {
        const hit = hits[0];
        const norm = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize() : new THREE.Vector3(0, 1, 0);
        this.water.spawnSplash(hit.point, norm, 8, 0.85);

        if (hit.object.userData.animal) {
          const anim = hit.object.userData.animal;
          this.audioHoseAnimal = true;
          anim.careState.totalHoseTime += dt;
          if (hit.uv) {
            anim.careState.paintUV(hit.uv.x, hit.uv.y, {
              radius: 0.14,
              wetDelta: dt * 1.85,
              rinseFoam: dt * 1.65
            });
          }
          const washed = this.foam.rinseNearWorldPoint(hit.point, 0.46, dt * 6.5, 0.0);
          if (washed > 0) {
            anim.triggerBliss(0.9);
            this.girl.setExpression('smile', 0.8);
          }

          // ELEPHANT SPRAYS WATER BACK WITH ITS TRUNK! ("ゾウは鼻で水をかけ返す")
          if (anim.id === 'elephant' && anim.sprayBackState === 'idle') {
            anim.sprayCharge += dt * (washed > 0 ? 1.4 : 0.75);
            if (anim.sprayCharge > 1.35) {
              anim.sprayCharge = 0;
              anim.sprayBackState = 'dipping';
              anim.sprayBackTimer = 0.42;
              this.audio.playElephantTrumpet(false);
            }
          }
          if (anim.id === 'zebra' && Math.random() < dt * 0.45) {
            anim.triggerHappyShake();
            this.foam.shakeAnimalFoam('zebra', 0.0);
            this.audio.playZebraWhinny();
          }
        } else if (hit.object.userData.isWaterTub) {
          // Fill water tub -> Overflow with water & bubbles!
          this.env.waterLevel = Math.min(1.12, this.env.waterLevel + dt * 0.48);
          if (this.env.waterLevel >= 0.98) {
            this.water.addPuddle(
              this.env.tubGroup.position.x + (Math.random() - 0.5) * 0.85,
              this.env.tubGroup.position.z + (Math.random() - 0.5) * 0.65,
              0.12
            );
            if (Math.random() < 0.35) {
              this.foam.addFoamAtWorldPoint(this.env.tubGroup, hit.point, new THREE.Vector3(0, 1, 0), {
                baseRadius: 0.09,
                color: this.selectedSoap.color
              });
            }
          }
        } else if (hit.object.userData.melonObj) {
          const m = hit.object.userData.melonObj;
          m.mud = Math.max(0, m.mud - dt * 2.2);
          m.mudShell.material.opacity = m.mud * 0.78;
        } else if (hit.object.userData.isDadSurface) {
          this.foam.rinseNearWorldPoint(hit.point, 0.45, dt * 6, 0.0);
          if (isFirstTap) {
            this.dad.triggerFoamHuh();
            this.girl.setExpression('delighted', 1.4);
            this.audio.playGirlGiggle();
          }
        } else {
          this.water.addPuddle(hit.point.x, hit.point.z, dt * 0.35);
          this.foam.rinseNearWorldPoint(hit.point, 0.38, dt * 4, 0.0);
        }
      }
      return;
    }

    // Direct contact tools: Sponge, Brush, Meat, Leafy Branch, Watermelon!
    this.handWorldTarget.copy(targetWorld).add(new THREE.Vector3(0.03, 0.04, 0.16));
    this.hand.root.rotation.set(0, 0, Math.sin(this.stageTime * 14) * (this.pointerSpeed > 0.05 ? 0.14 : 0.02));

    // Update Giraffe neck tracking whenever holding leafy branch!
    if (activeTool === 'branch' && this.animals.giraffe.root.visible) {
      this.animals.giraffe.targetNeckReachY = THREE.MathUtils.clamp(targetWorld.y + 0.15, 1.45, 3.25);
    }

    if (!hits.length) return;
    const hit = hits[0];
    const ud = hit.object.userData;
    const worldNorm = hit.face
      ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize()
      : new THREE.Vector3(0, 1, 0);

    // Put funny foam beard/hat on Dad if scrubbed with sponge!
    if (ud.isDadSurface && activeTool === 'sponge') {
      this.foam.addFoamAtWorldPoint(hit.object, hit.point, worldNorm, {
        baseRadius: 0.085,
        color: this.selectedSoap.color
      });
      this.audioFoam = 0.85;
      if (isFirstTap) {
        this.dad.triggerFoamHuh();
        this.girl.setExpression('huh', 0.65);
        this.audio.playGirlHuh();
        setTimeout(() => {
          this.girl.setExpression('delighted', 1.4);
          this.audio.playGirlGiggle();
        }, 650);
      }
      return;
    }

    // Place extra juicy meat chunks on Lion's flat feeding rock!
    if (ud.isLionPlate && activeTool === 'meat' && isFirstTap) {
      const chunk = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.055, 0.08, 6, 10),
        new THREE.MeshStandardMaterial({ color: this.lionPlateItems.length % 2 ? 0xd97f48 : 0xb53c32, roughness: 0.4 })
      );
      chunk.position.copy(hit.point).add(new THREE.Vector3(0, 0.05 + this.lionPlateItems.length * 0.03, 0));
      chunk.rotation.set(0.2, Math.random() * 3, Math.PI / 2);
      chunk.castShadow = true;
      this.propsRoot.add(chunk);
      this.lionPlateItems.push(chunk);
      this.animals.lion.triggerEat(1.9);
      this.animals.lion.careState.fedTypes.add('plate_meat');
      this.audio.playMunch(false);
      this.audio.playBigCatPurr(true);
      this.girl.setExpression('delighted', 1.3);
      return;
    }

    // Hang leafy branch high on Giraffe's pole hook!
    if (ud.isGiraffeHook && activeTool === 'branch' && isFirstTap) {
      const hung = new THREE.Group();
      hung.position.copy(hit.point);
      for (let i = 0; i < 6; i++) {
        const lf = new THREE.Mesh(
          new THREE.SphereGeometry(0.048, 8, 6),
          new THREE.MeshStandardMaterial({ color: 0x4b8e38, roughness: 0.58 })
        );
        lf.scale.set(1.4, 0.25, 0.75);
        lf.position.set((Math.random() - 0.5) * 0.22, -i * 0.05, (Math.random() - 0.5) * 0.14);
        hung.add(lf);
      }
      this.propsRoot.add(hung);
      this.animals.giraffe.targetNeckReachY = 2.68;
      this.animals.giraffe.triggerEat(2.2);
      this.audio.playMunch(true);
      this.girl.setExpression('delighted', 1.4);
      return;
    }

    // ANIMAL DIRECT SIMULATION INTERACTIONS!
    const anim = ud.animal;
    if (!anim) return;

    if (activeTool === 'sponge') {
      const scrubRate = isFirstTap ? 0.65 : Math.max(0.25, this.pointerSpeed);
      anim.careState.totalScrubTime += dt * (1 + scrubRate);
      if (hit.uv) {
        anim.careState.paintUV(hit.uv.x, hit.uv.y, {
          radius: 0.12,
          foamDelta: dt * (1.2 + scrubRate * 1.4),
          wetDelta: dt * 0.45,
          soapColor: this.selectedSoap.color
        });
      }
      if (isFirstTap || Math.random() < (0.45 + scrubRate * 0.45)) {
        this.foam.addFoamAtWorldPoint(hit.object, hit.point, worldNorm, {
          baseRadius: 0.088 + Math.min(0.05, scrubRate * 0.03),
          growBoost: 0.028,
          color: this.selectedSoap.color,
          animalId: anim.id
        });
      }
      anim.triggerBliss(0.8);
      this.audioFoam = Math.min(1.0, 0.35 + scrubRate * 0.65);
      this.girl.setExpression('smile', 0.9);
    } else if (activeTool === 'brush') {
      const stroke = isFirstTap ? 0.6 : Math.max(0.22, this.pointerSpeed);
      anim.careState.totalBrushStrokes += dt * (2 + stroke * 3);
      const dx = this.pointerNDC.x - this.prevPointerNDC.x;
      const dy = this.pointerNDC.y - this.prevPointerNDC.y;
      if (Math.hypot(dx, dy) > 0.002) {
        anim.careState.brushDirX = THREE.MathUtils.lerp(anim.careState.brushDirX, Math.sign(dx || 1), 0.25);
        anim.careState.brushDirY = THREE.MathUtils.lerp(anim.careState.brushDirY, dy * 8, 0.25);
      }
      if (hit.uv) {
        anim.careState.paintUV(hit.uv.x, hit.uv.y, {
          radius: 0.15,
          glossDelta: dt * (0.95 + stroke * 1.35)
        });
      }
      const summary = anim.careState.getSummary();
      this.audioBrush = Math.min(1.0, 0.3 + stroke * 0.7);
      this.audioGloss = summary.gloss;

      if (anim.id === 'tiger' || anim.id === 'lion') {
        anim.triggerBliss(1.1);
        if (isFirstTap || Math.random() < dt * 1.2) {
          this.audio.playBigCatPurr(anim.id === 'lion');
        }
        if (summary.gloss > 0.52) {
          this.girl.setExpression('delighted', 1.1);
        }
      } else {
        // Brushing Giraffe / Zebra / Elephant -> cute surprised "あれ？" on first stroke, then loves it!
        if (isFirstTap && anim.careState.totalBrushStrokes < 0.4) {
          this._triggerGentleMismatchReaction(anim);
        } else {
          anim.triggerBliss(1.0);
        }
      }
    } else if (activeTool === 'meat' && isFirstTap) {
      if (anim.id === 'lion' || anim.id === 'tiger') {
        // Carnivore loves the juicy savory treat!
        anim.triggerEat(1.8);
        anim.careState.fedTypes.add('hand_meat');
        this.audio.playMunch(false);
        this.audio.playBigCatPurr(anim.id === 'lion');
        this.girl.setExpression('delighted', 1.5);
      } else {
        // Wrong item given to herbivore ("違う物を渡すと相手は「あれ？」の顔→喜ぶ")!
        this._triggerGentleMismatchReaction(anim);
      }
    } else if (activeTool === 'branch') {
      if (anim.id === 'giraffe' || anim.id === 'zebra' || anim.id === 'elephant') {
        if (isFirstTap || Math.random() < dt * 2.2) {
          anim.triggerEat(1.4);
          anim.careState.fedTypes.add(this.branchHasHibiscus ? 'hibiscus' : 'acacia');
          this.audio.playMunch(true);
          this.girl.setExpression('delighted', 1.4);
          // Visibly nibble leaves off the branch!
          const visibleLeaf = this.hand.flowerLeaves.find((lf) => lf.scale.x > 0.25);
          if (visibleLeaf && Math.random() < 0.45) {
            visibleLeaf.scale.multiplyScalar(0.15);
          }
          // Refill leaves automatically once all nibbled so she never runs out
          if (!this.hand.flowerLeaves.some((lf) => lf.scale.x > 0.25)) {
            setTimeout(() => {
              this.hand.flowerLeaves.forEach((lf) => lf.scale.set(1.4, 0.22, 0.72));
            }, 650);
          }
        }
      } else if (isFirstTap) {
        // Offering leafy branch to Lion or Tiger -> puzzled "あれ？" head-tilt -> playful bat & purr!
        this._triggerGentleMismatchReaction(anim);
      }
    } else if (activeTool === 'watermelon' && isFirstTap) {
      // Every animal in the sanctuary LOVES juicy summer watermelon!
      anim.triggerEat(1.9);
      anim.careState.fedTypes.add(this.watermelonIsGolden ? 'gold_melon' : 'red_melon');
      this.audio.playMunch(true);
      if (anim.id === 'elephant') this.audio.playElephantTrumpet(true);
      else if (anim.id === 'zebra') this.audio.playZebraWhinny();
      else if (anim.id === 'lion' || anim.id === 'tiger') this.audio.playBigCatPurr(anim.id === 'lion');
      this.girl.setExpression('delighted', 1.6);
      this.audio.playGirlGiggle();
    }
  }

  _triggerGentleMismatchReaction(anim) {
    anim.triggerHuhThenHappy();
    this.girl.setExpression('huh', 0.9);
    this.audio.playGirlHuh();
    setTimeout(() => {
      this.girl.setExpression('delighted', 1.4);
      this.audio.playGirlGiggle();
    }, 920);
  }

  _evaluateStageGoals() {
    if (this.goalCelebrated) return;

    if (this.stage === 1) {
      const zSum = this.animals.zebra.careState.getSummary();
      const eSum = this.animals.elephant.careState.getSummary();
      // Goal: Both Zebra & Elephant have been foamed AND hosed enough to feel refreshed!
      const zReady = this.animals.zebra.careState.totalScrubTime > 0.9 && (this.animals.zebra.careState.totalHoseTime > 0.6 || zSum.mud < 0.34);
      const eReady = this.animals.elephant.careState.totalScrubTime > 0.9 && (this.animals.elephant.careState.totalHoseTime > 0.6 || eSum.mud < 0.38);
      if (zReady && eReady) {
        this.goalCelebrated = true;
        this.env.gateOpenTarget = -1.25; // Swing wooden paddock gate wide open!
        this.animals.zebra.triggerHappyShake();
        this.animals.elephant.mood = 'happy';
        this.animals.elephant.moodTimer = 2.8;
        this.girl.setExpression('delighted', 2.4);
        this.audio.playWarmChord([523.25, 659.25, 783.99, 1046.5], 0.14);
        this.audio.playElephantTrumpet(true);
      }
    } else if (this.stage === 2) {
      const tSum = this.animals.tiger.careState.getSummary();
      const tigerBrushed = tSum.gloss > 0.32 || this.animals.tiger.careState.totalBrushStrokes > 2.2;
      const lionFed = this.animals.lion.careState.fedCount >= 1;
      const giraffeFed = this.animals.giraffe.careState.fedCount >= 1;
      if (tigerBrushed && lionFed && giraffeFed) {
        this.goalCelebrated = true;
        this.env.gateOpenTarget = -1.25;
        this.animals.tiger.mood = 'happy';
        this.animals.tiger.moodTimer = 2.5;
        this.animals.lion.mood = 'happy';
        this.animals.lion.moodTimer = 2.5;
        this.animals.giraffe.mood = 'happy';
        this.animals.giraffe.moodTimer = 2.5;
        this.girl.setExpression('delighted', 2.4);
        this.audio.playWarmChord([523.25, 659.25, 783.99, 1046.5], 0.14);
      }
    }
  }

  update(dt, elapsed) {
    this.stageTime += dt;
    this.idleTime += dt;

    // Reset per-frame continuous audio levels before applying pointer touch
    this.audioHose = 0;
    this.audioHoseAnimal = false;
    this.audioFoam = 0;
    this.audioBrush = 0;

    if (this.pointerDown) {
      this._applyContinuousTouch(dt, false);
      this.pointerSpeed *= 0.85;
    }

    // Responsive camera framing for both Landscape (4:3 / 16:9) & Portrait (iPhone)!
    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    const portraitPullback = aspect < 1.0 ? (1.0 - aspect) * 2.35 : 0;
    this.camera.fov = aspect < 1.0 ? 54 : 44;
    this.camera.updateProjectionMatrix();

    const desiredCam = this.camPosTarget.clone();
    desiredCam.z += portraitPullback;
    desiredCam.x += Math.sin(elapsed * 0.45) * 0.025;
    desiredCam.y += Math.cos(elapsed * 0.6) * 0.015;
    this.camera.position.lerp(desiredCam, Math.min(1, dt * 4.5));

    this.currentLook.lerp(this.camLookTarget, Math.min(1, dt * 5.0));
    this.camera.lookAt(this.currentLook);

    // Smoothly move 3D Keeper Hand & update flexible garden hose curve!
    if (this.hand.root.visible) {
      if (!this.pointerDown) {
        // Rest comfortably near bottom-right ready to follow finger!
        const restX = aspect < 1.0 ? 0.55 : 0.88;
        this.handWorldTarget.set(restX, 0.58 + Math.sin(elapsed * 2.2) * 0.025, 2.05);
        this.hand.root.rotation.set(0.15, 0.25, 0);
      }
      this.hand.root.position.lerp(this.handWorldTarget, Math.min(1, dt * 18));

      // Update live 3D garden hose tube only when hand moves (zero GC churn!)
      this.hoseTubeMesh.visible = this.hand.activeTool === 'hose';
      if (this.hoseTubeMesh.visible) {
        const p0 = this.hoseStandOrigin;
        const p3 = this.hand.root.position;
        if (!this._lastHoseP3 || this._lastHoseP3.distanceToSquared(p3) > 0.00015) {
          this._lastHoseP3 = p3.clone();
          this.hoseCurve.points[0].copy(p0);
          this.hoseCurve.points[1].set(
            THREE.MathUtils.lerp(p0.x, p3.x, 0.35),
            0.05,
            THREE.MathUtils.lerp(p0.z, p3.z, 0.4)
          );
          this.hoseCurve.points[2].set(
            THREE.MathUtils.lerp(p0.x, p3.x, 0.72),
            Math.max(0.12, p3.y * 0.45),
            THREE.MathUtils.lerp(p0.z, p3.z, 0.75)
          );
          this.hoseCurve.points[3].copy(p3);
          this.hoseTubeMesh.geometry.dispose();
          this.hoseTubeMesh.geometry = new THREE.TubeGeometry(this.hoseCurve, 14, 0.021, 8, false);
        }
      }
    }

    // Update Animals & Elephant Trunk Reciprocal Water Splash!
    if (this.animals.zebra.root.visible) this.animals.zebra.updateCommon(dt, elapsed);
    if (this.animals.tiger.root.visible) this.animals.tiger.updateCommon(dt, elapsed);
    if (this.animals.lion.root.visible) this.animals.lion.updateCommon(dt, elapsed);
    if (this.animals.giraffe.root.visible) this.animals.giraffe.updateGiraffe(dt, elapsed);
    if (this.animals.elephant.root.visible) {
      this.animals.elephant.updateElephant(dt, elapsed);
      if (this.animals.elephant.sprayBackState === 'spraying') {
        const tipWorld = new THREE.Vector3();
        this.animals.elephant.trunkTip.getWorldPosition(tipWorld);
        const splashTarget = this.camera.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.1, -0.25, -0.5));
        this.water.spawnStream(tipWorld, splashTarget, 11, 0.24);
        this.audioHose = Math.max(this.audioHose, 0.9);
        if (Math.random() < dt * 5.5) {
          this.water.triggerLensSplash(4);
          this.girl.setExpression('splashed', 1.5);
          if (Math.random() < 0.35) this.audio.playGirlGiggle();
        }
      }
    }

    // Update Dad & Stage 3 Rolling Watermelons!
    if (this.dad.root.visible) {
      this.dad.update(dt, elapsed);
      if (this.stage === 3 && this.dad.justDroppedMelons) {
        this.dad.justDroppedMelons = false;
        this._launchDadWatermelonTumble();
      }
    }

    if (this.stage === 3) {
      for (const m of this.watermelons) {
        if (m.state === 'carried') {
          m.mesh.position.copy(this.dad.root.position).add(new THREE.Vector3(
            0.28 + (m.carryIdx % 2) * 0.18,
            0.96 + Math.floor(m.carryIdx / 2) * 0.28,
            (m.carryIdx % 2 - 0.5) * 0.24
          ));
        } else if (m.state === 'rolling') {
          m.vel.y -= 9.2 * dt;
          m.mesh.position.addScaledVector(m.vel, dt);
          m.mesh.rotation.z -= m.vel.x * dt * 4.5;
          m.mesh.rotation.x += m.vel.z * dt * 4.5;
          if (m.mesh.position.y <= 0.18) {
            m.mesh.position.y = 0.18;
            if (Math.abs(m.vel.y) > 0.45) {
              m.vel.y = -m.vel.y * 0.36;
              this.water.addPuddle(m.mesh.position.x, m.mesh.position.z, 0.06);
            } else {
              m.vel.y = 0;
            }
            m.vel.x *= Math.pow(0.28, dt);
            m.vel.z *= Math.pow(0.28, dt);
          }
          m.mudShell.material.opacity += (m.mud * 0.72 - m.mudShell.material.opacity) * Math.min(1, dt * 4);
        }
      }
    }

    // Subtle environmental invitation if idle > 10s (wordless.short.md: 0-6s nothing, >10s gentle world cue!)
    if (this.idleTime > 10.5) {
      this.idleTime = 4.0;
      if (this.stage === 0) {
        this.girl.hopTimer = 0.45;
      } else if (this.stage === 1) {
        this.animals.zebra.triggerHappyShake();
        this.audio.playZebraWhinny();
      } else if (this.stage === 2) {
        this.animals.giraffe.targetNeckReachY = 2.2;
      }
    }

    // Update Girl, Environment, Foam, Water & Audio
    this.girl.update(dt, elapsed, this.pointerDown ? this.handWorldTarget : null);
    this.env.update(dt, elapsed);
    this.foam.update(dt, elapsed);
    this.water.update(dt, 0.0);
    this._evaluateStageGoals();

    this.audio.updateContinuous({
      hose: this.audioHose,
      hoseHitAnimal: this.audioHoseAnimal,
      foamScrub: this.audioFoam,
      brushSpeed: this.audioBrush,
      furGloss: this.audioGloss
    });
  }
}
