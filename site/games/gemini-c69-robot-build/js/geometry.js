import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createPictorialRuleBoardTexture, makeCustomPartMetal } from './materials.js';

// Shared micro-geometries to keep triangle count low (< 90k total) while packing screen with rich silver hardware
let _sharedGeos = null;
function getSharedGeos() {
  if (_sharedGeos) return _sharedGeos;

  // Lathe profile for chamfered machined screw head
  const panPts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.11, 0.0),
    new THREE.Vector2(0.11, 0.032),
    new THREE.Vector2(0.095, 0.058),
    new THREE.Vector2(0.032, 0.064),
    new THREE.Vector2(0.0, 0.064),
  ];
  const panHeadGeo = new THREE.LatheGeometry(panPts, 18);

  // Hex socket cap head
  const capPts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.095, 0.0),
    new THREE.Vector2(0.095, 0.068),
    new THREE.Vector2(0.082, 0.082),
    new THREE.Vector2(0.046, 0.082),
    new THREE.Vector2(0.046, 0.048),
    new THREE.Vector2(0.0, 0.048),
  ];
  const hexCapGeo = new THREE.LatheGeometry(capPts, 16);

  const washerGeo = new THREE.CylinderGeometry(0.135, 0.135, 0.018, 18);
  const shaftGeo = new THREE.CylinderGeometry(0.056, 0.052, 0.22, 14);
  const slotGeo = new THREE.BoxGeometry(0.175, 0.026, 0.028);
  const crossSlotGeo = new THREE.BoxGeometry(0.13, 0.026, 0.026);
  const hexNutGeo = new THREE.CylinderGeometry(0.105, 0.105, 0.055, 6);
  const bearingBallGeo = new THREE.SphereGeometry(0.055, 14, 10);

  // Coiled spring geometry
  class HelixCurve extends THREE.Curve {
    constructor(radius = 0.09, height = 0.34, turns = 5.5) {
      super();
      this.radius = radius;
      this.height = height;
      this.turns = turns;
    }
    getPoint(t, optionalTarget = new THREE.Vector3()) {
      const a = t * Math.PI * 2 * this.turns;
      return optionalTarget.set(
        Math.cos(a) * this.radius,
        (t - 0.5) * this.height,
        Math.sin(a) * this.radius
      );
    }
  }
  const springGeo = new THREE.TubeGeometry(new HelixCurve(0.085, 0.32, 5.5), 32, 0.02, 6, false);
  const antennaSpringGeo = new THREE.TubeGeometry(new HelixCurve(0.032, 0.22, 6.5), 24, 0.009, 5, false);

  _sharedGeos = {
    panHeadGeo,
    hexCapGeo,
    washerGeo,
    shaftGeo,
    slotGeo,
    crossSlotGeo,
    hexNutGeo,
    bearingBallGeo,
    springGeo,
    antennaSpringGeo,
  };
  return _sharedGeos;
}

// Create a high-realism machined silver screw/bolt (type 0: slotted pan, 1: cross-head flange, 2: knurled hex cap)
export function createMachinedScrew(mats, scale = 1.0, type = 0) {
  const g = getSharedGeos();
  const root = new THREE.Group();

  // Lock washer at base
  const washer = new THREE.Mesh(g.washerGeo, mats.silverChrome);
  washer.position.y = 0.009;
  washer.receiveShadow = true;
  root.add(washer);

  // Rotating bolt sub-group (moves down & spins as player tightens!)
  const bolt = new THREE.Group();
  root.add(bolt);

  // Threaded shaft
  const shaft = new THREE.Mesh(g.shaftGeo, mats.screwThreadMetal);
  shaft.position.y = -0.09;
  bolt.add(shaft);

  if (type === 2) {
    // Knurled hex-socket cap bolt
    const head = new THREE.Mesh(g.hexCapGeo, mats.knurledSteel);
    head.receiveShadow = true;
    bolt.add(head);

    const topRing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.084, 0.084, 0.006, 20),
      mats.screwHeadMetal
    );
    topRing.position.y = 0.081;
    bolt.add(topRing);

    const hexHole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.045, 0.038, 6),
      mats.darkSteel
    );
    hexHole.position.y = 0.064;
    bolt.add(hexHole);
  } else {
    const head = new THREE.Mesh(g.panHeadGeo, mats.screwHeadMetal);
    head.receiveShadow = true;
    bolt.add(head);

    // Dark recessed drive slot so rotation is unmistakably clear!
    const slot1 = new THREE.Mesh(type === 0 ? g.slotGeo : g.crossSlotGeo, mats.darkSteel);
    slot1.position.y = 0.056;
    bolt.add(slot1);
    if (type === 1) {
      const slot2 = new THREE.Mesh(g.crossSlotGeo, mats.darkSteel);
      slot2.rotation.y = Math.PI * 0.5;
      slot2.position.y = 0.056;
      bolt.add(slot2);
    }
  }

  root.scale.setScalar(scale);
  root.userData.bolt = bolt;
  root.userData.washer = washer;
  return root;
}

// Optical Glass + Glowing Filament Lamp Assembly
export function createOpticalLamp(mats, radius = 0.14, glowColor = 0x56dcff) {
  const group = new THREE.Group();

  // Machined chrome bezel collar
  const bezel = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 1.04, radius * 0.17, 14, 28),
    mats.silverChrome
  );
  bezel.castShadow = true;
  group.add(bezel);

  // Dark reflector dish behind filament
  const dish = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.96, radius * 0.72, radius * 0.45, 24),
    mats.darkSteel
  );
  dish.rotation.x = Math.PI * 0.5;
  dish.position.z = -radius * 0.18;
  group.add(dish);

  // Glowing inner LED/filament core (balanced intensity for crisp lens clarity)
  const coreMat = new THREE.MeshStandardMaterial({
    color: glowColor,
    emissive: new THREE.Color(glowColor),
    emissiveIntensity: 1.45,
    roughness: 0.22,
    metalness: 0.1,
  });
  const core = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.56, 18, 14), coreMat);
  core.scale.set(1, 1, 0.55);
  core.position.z = -radius * 0.04;
  group.add(core);

  // Curved optical glass dome lens on front
  const glass = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 0.96, 22, 16, 0, Math.PI * 2, 0, Math.PI * 0.48),
    mats.lensGlass
  );
  glass.rotation.x = Math.PI * 0.5;
  glass.position.z = radius * 0.02;
  group.add(glass);

  group.userData.coreMat = coreMat;
  return group;
}

// ============================================================================
// NIGHT ROOM, WORKBENCH, PENDANT LIGHT, PICTORIAL RULE SIGN & HARDWARE CLUTTER
// ============================================================================
export function createWorkshopEnvironment(mats) {
  const root = new THREE.Group();

  // 1. Night Room Floor (y = 0) & Dark Atmospheric Walls
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), mats.floorWood);
  floor.rotation.x = -Math.PI * 0.5;
  floor.position.y = 0.0;
  floor.receiveShadow = true;
  root.add(floor);

  // Cozy woven dark-indigo/slate night rug in cleanup/dance zone (around z = 1.6..4.0)
  const rugGroup = new THREE.Group();
  rugGroup.position.set(0, 0.008, 2.55);
  const rugMain = new THREE.Mesh(
    new RoundedBoxGeometry(3.4, 0.024, 2.45, 3, 0.01),
    new THREE.MeshStandardMaterial({
      color: 0x1c2536,
      normalMap: mats.outfitFabrics[0].normalMap,
      normalScale: new THREE.Vector2(1.2, 1.2),
      roughness: 0.92,
    })
  );
  rugMain.receiveShadow = true;
  rugGroup.add(rugMain);
  const rugBorder = new THREE.Mesh(
    new RoundedBoxGeometry(3.52, 0.018, 2.57, 2, 0.008),
    new THREE.MeshStandardMaterial({ color: 0x3b2d22, roughness: 0.9 })
  );
  rugBorder.position.y = -0.003;
  rugBorder.receiveShadow = true;
  rugGroup.add(rugBorder);
  root.add(rugGroup);

  // Dim background walls & perforated brushed-steel workshop tool rack for atmospheric depth!
  const backWall = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 8),
    new THREE.MeshStandardMaterial({ color: 0x0b0f18, roughness: 0.92 })
  );
  backWall.position.set(0, 3.8, -3.2);
  root.add(backWall);

  // Dimly lit brushed-metal workshop pegboard / tool rail behind workbench
  const toolRail = new THREE.Group();
  toolRail.position.set(0, 1.58, -1.25);
  const railBar = new THREE.Mesh(
    new RoundedBoxGeometry(2.6, 0.06, 0.035, 2, 0.008),
    mats.silverBrushed
  );
  toolRail.add(railBar);
  [-0.95, -0.55, 0.55, 0.95].forEach((wx, idx) => {
    const wrench = new THREE.Mesh(
      new RoundedBoxGeometry(0.045, 0.28 + (idx % 2) * 0.06, 0.016, 2, 0.006),
      mats.silverChrome
    );
    wrench.position.set(wx, -0.14, 0.02);
    const jaw = new THREE.Mesh(
      new THREE.TorusGeometry(0.038, 0.012, 8, 16, Math.PI * 1.45),
      mats.silverChrome
    );
    jaw.position.set(wx, -0.29, 0.02);
    toolRail.add(wrench, jaw);
  });
  root.add(toolRail);

  // Subtle night window frame far in background catching faint moonlight
  const winFrame = new THREE.Group();
  winFrame.position.set(-2.5, 2.55, -3.15);
  const nightGlass = new THREE.Mesh(
    new THREE.PlaneGeometry(1.3, 1.7),
    new THREE.MeshBasicMaterial({ color: 0x111d33 })
  );
  winFrame.add(nightGlass);
  const mullionMat = new THREE.MeshStandardMaterial({ color: 0x181412, roughness: 0.7 });
  const mV = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.76, 0.08), mullionMat);
  const mH = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.06, 0.08), mullionMat);
  winFrame.add(mV, mH);
  root.add(winFrame);

  // 2. Heavy Workbench (top surface at y = 1.0, centered at x = 0, z = 0)
  const benchGroup = new THREE.Group();
  root.add(benchGroup);

  const benchTop = new THREE.Mesh(
    new RoundedBoxGeometry(3.45, 0.12, 1.95, 4, 0.022),
    mats.benchWood
  );
  benchTop.position.set(0, 0.94, 0);
  benchTop.castShadow = true;
  benchTop.receiveShadow = true;
  benchGroup.add(benchTop);

  // Brushed stainless steel front protective lip & recessed magnetic work mat!
  // Fills huge portion of workbench with authentic anisotropic silver metal & screws!
  const steelMatPlate = new THREE.Mesh(
    new RoundedBoxGeometry(2.72, 0.018, 1.46, 4, 0.008),
    mats.silverBrushed
  );
  steelMatPlate.position.set(0, 1.005, 0.08);
  steelMatPlate.receiveShadow = true;
  benchGroup.add(steelMatPlate);

  // Corner countersunk screws anchoring the brushed steel work plate
  [
    [-1.26, -0.56],
    [1.26, -0.56],
    [-1.26, 0.72],
    [1.26, 0.72],
    [0.0, 0.74],
    [-0.65, 0.74],
    [0.65, 0.74],
  ].forEach(([sx, sz], i) => {
    const sc = createMachinedScrew(mats, 0.36, i % 2);
    sc.position.set(sx, 1.012, sz);
    sc.rotation.y = i * 1.1;
    benchGroup.add(sc);
  });

  // Workbench sturdy legs
  [
    [-1.52, -0.78],
    [1.52, -0.78],
    [-1.52, 0.78],
    [1.52, 0.78],
  ].forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.92, 0.14), mats.benchWood);
    leg.position.set(lx, 0.46, lz);
    benchGroup.add(leg);
  });

  // 3. Single Overhead Pendant Lamp (Physical shade + warm glowing bulb)
  const pendantGroup = new THREE.Group();
  pendantGroup.position.set(0.05, 2.68, 0.25);
  root.add(pendantGroup);

  const cord = new THREE.Mesh(
    new THREE.CylinderGeometry(0.014, 0.014, 1.8, 10),
    mats.darkSteel
  );
  cord.position.y = 1.05;
  pendantGroup.add(cord);

  const shadePts = [
    new THREE.Vector2(0.04, 0.22),
    new THREE.Vector2(0.11, 0.18),
    new THREE.Vector2(0.36, 0.02),
    new THREE.Vector2(0.42, -0.02),
  ];
  const shadeOuter = new THREE.Mesh(
    new THREE.LatheGeometry(shadePts, 32),
    mats.silverTurned
  );
  pendantGroup.add(shadeOuter);

  const shadeInner = new THREE.Mesh(
    new THREE.LatheGeometry(shadePts, 32),
    new THREE.MeshBasicMaterial({ color: 0xffdfab, side: THREE.BackSide })
  );
  shadeInner.scale.setScalar(0.985);
  pendantGroup.add(shadeInner);

  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.085, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xfff3d6 })
  );
  bulb.position.y = 0.05;
  pendantGroup.add(bulb);

  // 4. ONE PICTORIAL RULE SIGNBOARD ("ルールは絵の看板1枚で見せる")
  // Physical wood-and-brass easel picture board with 3 wordless painted steps + brass status slider!
  const ruleBoard = new THREE.Group();
  ruleBoard.position.set(0.76, 1.22, -0.48);
  ruleBoard.rotation.set(-0.18, -0.32, 0);
  root.add(ruleBoard);

  const boardFrame = new THREE.Mesh(
    new RoundedBoxGeometry(0.66, 0.36, 0.032, 3, 0.008),
    mats.brushedBrass
  );
  boardFrame.castShadow = true;
  boardFrame.receiveShadow = true;
  ruleBoard.add(boardFrame);

  const ruleTex = createPictorialRuleBoardTexture();
  const boardFace = new THREE.Mesh(
    new THREE.PlaneGeometry(0.61, 0.31),
    new THREE.MeshStandardMaterial({
      map: ruleTex,
      roughness: 0.62,
      metalness: 0.04,
    })
  );
  boardFace.position.z = 0.017;
  ruleBoard.add(boardFace);

  // Corner brass rivets on rule board
  [
    [-0.3, -0.15],
    [0.3, -0.15],
    [-0.3, 0.15],
    [0.3, 0.15],
  ].forEach(([rx, ry]) => {
    const riv = createMachinedScrew(mats, 0.16, 0);
    riv.rotation.x = Math.PI * 0.5;
    riv.position.set(rx, ry, 0.018);
    ruleBoard.add(riv);
  });

  // Tiny warm brass indicator bead above active panel (slides across panels 0, 1, 2!)
  const activeClip = new THREE.Group();
  activeClip.position.set(-0.2, 0.185, 0.014);
  const clipBody = new THREE.Mesh(
    new RoundedBoxGeometry(0.095, 0.036, 0.04, 2, 0.008),
    mats.silverChrome
  );
  const clipGemMat = new THREE.MeshStandardMaterial({
    color: 0xffe082,
    emissive: 0xffb74d,
    emissiveIntensity: 1.1,
    roughness: 0.2,
  });
  const clipGem = new THREE.Mesh(new THREE.SphereGeometry(0.018, 12, 10), clipGemMat);
  clipGem.position.z = 0.022;
  activeClip.add(clipBody, clipGem);
  ruleBoard.add(activeClip);
  ruleBoard.userData.activeClip = activeClip;

  // Rear easel strut
  const strut = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.36, 0.025), mats.benchWood);
  strut.position.set(0, -0.04, -0.1);
  strut.rotation.x = 0.42;
  ruleBoard.add(strut);

  // 5. Ambient Silver Hardware Clutter around Workbench Perimeter (Loose Screws, Nuts, Springs, Trays!)
  // Ensures screen is lushly filled with realistic silver metal & screws, and tappable for subtle clink!
  const clutterItems = [];
  const g = getSharedGeos();

  // Left & Right Brushed Aluminum Small Screw Dishes
  [-1.12, 1.14].forEach((tx, sideIdx) => {
    const dishPts = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.18, 0),
      new THREE.Vector2(0.22, 0.055),
      new THREE.Vector2(0.2, 0.062),
      new THREE.Vector2(0.17, 0.014),
      new THREE.Vector2(0, 0.014),
    ];
    const dish = new THREE.Mesh(
      new THREE.LatheGeometry(dishPts, 28),
      mats.screwHeadMetal
    );
    dish.position.set(tx, 1.014, 0.52 - sideIdx * 0.08);
    dish.castShadow = true;
    dish.receiveShadow = true;
    benchGroup.add(dish);

    // Fill each dish with gleaming loose screws, hex nuts, and steel ball bearings
    for (let k = 0; k < 7; k++) {
      const ang = (k / 7) * Math.PI * 2 + sideIdx;
      const rad = 0.04 + (k % 3) * 0.042;
      const sc = createMachinedScrew(mats, 0.42 + (k % 2) * 0.12, k % 3);
      sc.position.set(
        dish.position.x + Math.cos(ang) * rad,
        1.045,
        dish.position.z + Math.sin(ang) * rad
      );
      sc.rotation.set(1.25 + (k % 3) * 0.25, ang * 1.7, 0.4 * k);
      benchGroup.add(sc);
      clutterItems.push(sc);
    }
  });

  // Loose oversized bolts, nuts, coiled springs, and perforated steel bracket along foreground bench edge!
  const looseSpecs = [
    [-0.92, 0.66, 0.66, 2],
    [-0.64, 0.63, 0.58, 0],
    [-0.36, 0.65, 0.64, 1],
    [-0.08, 0.66, 0.56, 2],
    [0.2, 0.64, 0.62, 0],
    [0.82, 0.68, 0.58, 1],
    [0.98, 0.62, 0.52, 2],
    [-1.18, 0.12, 0.56, 0],
    [1.22, 0.08, 0.6, 2],
  ];
  looseSpecs.forEach(([lx, lz, scScale, st], idx) => {
    const bolt = createMachinedScrew(mats, scScale, st);
    bolt.position.set(lx, 1.036, lz);
    bolt.rotation.set(Math.PI * 0.46, idx * 0.95 + 0.4, 0.2);
    benchGroup.add(bolt);
    clutterItems.push(bolt);

    const nut = new THREE.Mesh(g.hexNutGeo, mats.silverChrome);
    nut.scale.setScalar(0.55);
    nut.position.set(lx + 0.09, 1.03, lz - 0.05);
    nut.rotation.y = idx * 0.5;
    nut.castShadow = true;
    benchGroup.add(nut);
  });

  // Two coiled chrome springs resting on bench
  [-0.98, 1.02].forEach((sx, idx) => {
    const sp = new THREE.Mesh(g.springGeo, mats.silverChrome);
    sp.scale.setScalar(0.45);
    sp.position.set(sx, 1.052, -0.18 + idx * 0.15);
    sp.rotation.set(Math.PI * 0.5, 0.4 + idx, 0.3);
    sp.castShadow = true;
    benchGroup.add(sp);
    clutterItems.push(sp);
  });

  return {
    root,
    benchGroup,
    pendantGroup,
    ruleBoard,
    rugGroup,
    clutterItems,
  };
}

// ============================================================================
// SCENE 1 PROPS: DELIVERY PARCEL BOX, WORKBENCH TOOLS, MAGNETIC STAND
// ============================================================================
export function createDeliveryParcel(mats) {
  const box = new THREE.Group();
  const W = 0.88;
  const H = 0.22;
  const D = 0.64;

  // Base cardboard walls + brushed aluminum corner brackets!
  const bottom = new THREE.Mesh(new THREE.BoxGeometry(W, 0.02, D), mats.cardboard);
  bottom.position.y = 0.01;
  bottom.receiveShadow = true;
  box.add(bottom);

  // Dark molded foam/steel compartment liner inside box
  const liner = new THREE.Mesh(
    new RoundedBoxGeometry(W - 0.05, 0.03, D - 0.05, 2, 0.008),
    mats.darkSteel
  );
  liner.position.y = 0.025;
  liner.receiveShadow = true;
  box.add(liner);

  const wallFB = new THREE.BoxGeometry(W, H, 0.024);
  const wallLR = new THREE.BoxGeometry(0.024, H, D);
  const frontW = new THREE.Mesh(wallFB, mats.cardboard);
  frontW.position.set(0, H * 0.5, D * 0.5);
  const backW = new THREE.Mesh(wallFB, mats.cardboard);
  backW.position.set(0, H * 0.5, -D * 0.5);
  const leftW = new THREE.Mesh(wallLR, mats.cardboard);
  leftW.position.set(-W * 0.5, H * 0.5, 0);
  const rightW = new THREE.Mesh(wallLR, mats.cardboard);
  rightW.position.set(W * 0.5, H * 0.5, 0);
  [frontW, backW, leftW, rightW].forEach((w) => {
    w.castShadow = true;
    w.receiveShadow = true;
    box.add(w);
  });

  // Riveted silver metal corner protectors on parcel box!
  [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ].forEach(([cx, cz]) => {
    const bracket = new THREE.Mesh(
      new RoundedBoxGeometry(0.065, H + 0.01, 0.065, 2, 0.008),
      mats.silverBrushed
    );
    bracket.position.set(cx * (W * 0.5 - 0.015), H * 0.5, cz * (D * 0.5 - 0.015));
    box.add(bracket);
  });

  // 4 Articulated Flaps (Front, Back, Left, Right)
  const flaps = {};
  const makeFlap = (w, d, px, pz, pivotAxis, openSign) => {
    const pivot = new THREE.Group();
    pivot.position.set(px, H, pz);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 0.018, d), mats.cardboard);
    if (pivotAxis === 'x') {
      mesh.position.z = -openSign * d * 0.5;
    } else {
      mesh.position.x = -openSign * w * 0.5;
    }
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    pivot.add(mesh);
    pivot.userData = { axis: pivotAxis, sign: openSign, openAmount: 0 };
    box.add(pivot);
    return pivot;
  };

  flaps.left = makeFlap(W * 0.49, D - 0.02, -W * 0.5, 0, 'z', 1);
  flaps.right = makeFlap(W * 0.49, D - 0.02, W * 0.5, 0, 'z', -1);
  flaps.front = makeFlap(W - 0.02, D * 0.48, 0, D * 0.5, 'x', 1);
  flaps.back = makeFlap(W - 0.02, D * 0.48, 0, -D * 0.5, 'x', -1);

  // Tearable Kraft Tape Strip with Pull-Tab Curl along center seam!
  const tapeGroup = new THREE.Group();
  tapeGroup.position.set(0, H + 0.014, 0);
  box.add(tapeGroup);

  const tapeSegments = [];
  const segCount = 8;
  for (let i = 0; i < segCount; i++) {
    const sw = (W + 0.08) / segCount;
    const seg = new THREE.Mesh(new THREE.BoxGeometry(sw + 0.005, 0.008, 0.095), mats.paperTape);
    seg.position.x = -W * 0.5 - 0.02 + (i + 0.5) * sw;
    tapeGroup.add(seg);
    tapeSegments.push(seg);
  }

  // Inviting curled brass-riveted pull tab on left end of tape (Affordance: pull/tap!)
  const pullTab = new THREE.Mesh(
    new RoundedBoxGeometry(0.09, 0.024, 0.11, 2, 0.006),
    mats.brushedBrass
  );
  pullTab.position.set(-W * 0.5 - 0.04, 0.024, 0);
  pullTab.rotation.z = 0.35;
  tapeGroup.add(pullTab);

  box.userData = { flaps, tapeGroup, tapeSegments, pullTab };
  return box;
}

// Workbench Tools: Heavy Chrome Ratchet Driver + Chamois Polishing Pad + Magnetic Assembly Turntable
export function createWorkbenchTools(mats) {
  // 1. Magnetic Brushed-Steel Assembly Pedestal (center-stage once box opens!)
  const stand = new THREE.Group();
  const basePts = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.32, 0),
    new THREE.Vector2(0.32, 0.028),
    new THREE.Vector2(0.27, 0.055),
    new THREE.Vector2(0.24, 0.062),
    new THREE.Vector2(0, 0.062),
  ];
  const baseDisc = new THREE.Mesh(new THREE.LatheGeometry(basePts, 36), mats.screwHeadMetal);
  baseDisc.castShadow = true;
  baseDisc.receiveShadow = true;
  stand.add(baseDisc);

  // Brass degree tick ring around turntable
  const brassRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.255, 0.01, 10, 36),
    mats.brushedBrass
  );
  brassRing.rotation.x = Math.PI * 0.5;
  brassRing.position.y = 0.058;
  stand.add(brassRing);

  // 2. Chrome Ratchet Wrench / Screwdriver Tool
  const ratchet = new THREE.Group();
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.036, 0.032, 0.24, 20),
    mats.knurledSteel
  );
  handle.rotation.x = Math.PI * 0.5;
  handle.castShadow = true;
  ratchet.add(handle);

  const headRing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.062, 0.062, 0.042, 24),
    mats.silverChrome
  );
  headRing.position.set(0, 0, -0.14);
  headRing.castShadow = true;
  ratchet.add(headRing);

  const bit = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.022, 0.075, 6),
    mats.darkSteel
  );
  bit.position.set(0, -0.04, -0.14);
  ratchet.add(bit);

  // 3. Soft Buffing/Polishing Block (Wood handle + chamois felt pad)
  const buffer = new THREE.Group();
  const bufTop = new THREE.Mesh(
    new RoundedBoxGeometry(0.15, 0.045, 0.21, 3, 0.012),
    mats.beechWood
  );
  bufTop.position.y = 0.035;
  bufTop.castShadow = true;
  buffer.add(bufTop);
  const bufPad = new THREE.Mesh(
    new RoundedBoxGeometry(0.16, 0.028, 0.22, 2, 0.008),
    mats.outfitCuffs[2]
  );
  bufPad.position.y = 0.012;
  buffer.add(bufPad);
  const brassKnob = createMachinedScrew(mats, 0.35, 2);
  brassKnob.position.y = 0.058;
  buffer.add(brassKnob);

  return { stand, ratchet, buffer };
}

// ============================================================================
// MODULAR SILVER METAL ROBOT PARTS (3 Torsos x 3 Heads x 3 Arms x 3 Legs)
// ============================================================================
export function createRobotTorso(mats, variant = 0) {
  const group = new THREE.Group();
  const metal = makeCustomPartMetal(mats, variant);
  group.userData = { category: 'torso', variant, metal, polishLevel: 0.25, lamps: [] };

  if (variant === 0) {
    // Variant 0: Brushed Aluminum Boiler-Drum Chassis with Big Optical Core Window & Steel Tie-Rods
    const pts = [
      new THREE.Vector2(0, -0.2),
      new THREE.Vector2(0.19, -0.2),
      new THREE.Vector2(0.225, -0.165),
      new THREE.Vector2(0.225, 0.165),
      new THREE.Vector2(0.19, 0.2),
      new THREE.Vector2(0, 0.2),
    ];
    const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 32), metal);
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // Top & bottom chrome flange rings
    [-0.155, 0.155].forEach((ry) => {
      const band = new THREE.Mesh(
        new THREE.TorusGeometry(0.226, 0.014, 10, 32),
        mats.silverChrome
      );
      band.rotation.x = Math.PI * 0.5;
      band.position.y = ry;
      group.add(band);
    });

    // 4 vertical steel tie-rods around drum
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI * 0.25;
      const rod = new THREE.Mesh(
        new THREE.CylinderGeometry(0.014, 0.014, 0.36, 10),
        mats.silverChrome
      );
      rod.position.set(Math.cos(a) * 0.232, 0, Math.sin(a) * 0.232);
      group.add(rod);
    }

    const coreLamp = createOpticalLamp(mats, 0.095, 0x56dcff);
    coreLamp.position.set(0, 0.02, 0.222);
    group.add(coreLamp);
    group.userData.lamps.push(coreLamp);
  } else if (variant === 1) {
    // Variant 1: Beveled Stainless Hex-Plate Chassis with Twin Gauges & Brass Gear Window
    const box = new THREE.Mesh(
      new RoundedBoxGeometry(0.43, 0.39, 0.34, 4, 0.045),
      metal
    );
    box.castShadow = true;
    box.receiveShadow = true;
    group.add(box);

    // Recessed dark steel instrument panel on chest
    const panel = new THREE.Mesh(
      new RoundedBoxGeometry(0.33, 0.25, 0.03, 2, 0.01),
      mats.darkSteel
    );
    panel.position.set(0, 0.02, 0.162);
    group.add(panel);

    // Twin optical gauge lamps (zero numerals!)
    [-0.082, 0.082].forEach((gx, idx) => {
      const gl = createOpticalLamp(mats, 0.062, idx === 0 ? 0x56dcff : 0xffcb6b);
      gl.position.set(gx, 0.055, 0.182);
      group.add(gl);
      group.userData.lamps.push(gl);
    });

    // Exposed brass cog wheel spinning in lower chest slot
    const cog = new THREE.Mesh(
      new THREE.CylinderGeometry(0.068, 0.068, 0.028, 12),
      mats.brushedBrass
    );
    cog.rotation.x = Math.PI * 0.5;
    cog.position.set(0, -0.065, 0.178);
    group.add(cog);
    group.userData.spinGear = cog;
  } else {
    // Variant 2: Fin-Cooled Chrome Gyro Sphere Core
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.235, 32, 24), metal);
    sphere.scale.set(1.04, 0.92, 0.98);
    sphere.castShadow = true;
    sphere.receiveShadow = true;
    group.add(sphere);

    // 4 Machined aluminum cooling fins wrapping horizontally
    [-0.12, -0.04, 0.05, 0.13].forEach((fy, idx) => {
      const r = Math.sqrt(Math.max(0.02, 0.24 * 0.24 - fy * fy)) + 0.024;
      const fin = new THREE.Mesh(
        new THREE.CylinderGeometry(r, r, 0.014, 32),
        idx % 2 === 0 ? mats.silverChrome : mats.screwHeadMetal
      );
      fin.position.y = fy;
      fin.castShadow = true;
      group.add(fin);
    });

    const coreLamp = createOpticalLamp(mats, 0.09, 0x6ef2b1);
    coreLamp.position.set(0, 0.005, 0.232);
    group.add(coreLamp);
    group.userData.lamps.push(coreLamp);
  }

  // Color Prism Dial on lower-right chest (player can twist/tap to tune robot lamp color!)
  const prismDial = new THREE.Group();
  prismDial.position.set(0.13, -0.11, 0.205);
  const dialRing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.042, 0.045, 0.032, 18),
    mats.brushedBrass
  );
  dialRing.rotation.x = Math.PI * 0.5;
  const dialGem = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.026, 0),
    mats.lensGlass
  );
  dialGem.position.z = 0.02;
  prismDial.add(dialRing, dialGem);
  group.add(prismDial);
  group.userData.prismDial = prismDial;

  // Big Tactile Emergency Reset Dome Button on chest/belly (pops forward prominently in Scene 2!)
  const resetBtn = new THREE.Group();
  resetBtn.position.set(0, -0.105, 0.215);
  const btnCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.068, 0.076, 0.028, 24),
    mats.silverChrome
  );
  btnCollar.rotation.x = Math.PI * 0.5;
  const btnCapMat = new THREE.MeshPhysicalMaterial({
    color: 0xd92b2b,
    emissive: new THREE.Color(0x330404),
    emissiveIntensity: 0.4,
    roughness: 0.22,
    metalness: 0.12,
    clearcoat: 0.85,
  });
  const btnCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.056, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.55),
    btnCapMat
  );
  btnCap.rotation.x = Math.PI * 0.5;
  btnCap.position.z = 0.015;
  resetBtn.add(btnCollar, btnCap);
  resetBtn.userData = { btnCap, btnCapMat };
  group.add(resetBtn);
  group.userData.resetBtn = resetBtn;

  return group;
}

export function createRobotHead(mats, variant = 0) {
  const group = new THREE.Group();
  const metal = makeCustomPartMetal(mats, variant);
  const g = getSharedGeos();
  group.userData = { category: 'head', variant, metal, polishLevel: 0.25, lamps: [] };

  // Neck flange collar
  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.085, 0.105, 0.065, 24),
    mats.knurledSteel
  );
  neck.position.y = -0.125;
  group.add(neck);

  if (variant === 0) {
    // Variant 0: Twin-Lens Rangefinder Camera Head + Spring Antennas
    const shell = new THREE.Mesh(
      new RoundedBoxGeometry(0.36, 0.23, 0.25, 4, 0.042),
      metal
    );
    shell.castShadow = true;
    shell.receiveShadow = true;
    group.add(shell);

    [-0.088, 0.088].forEach((ex) => {
      const eye = createOpticalLamp(mats, 0.066, 0xffe082);
      eye.position.set(ex, 0.005, 0.13);
      group.add(eye);
      group.userData.lamps.push(eye);
    });

    // Cute brushed metal mouth grille
    const grille = new THREE.Mesh(
      new RoundedBoxGeometry(0.14, 0.032, 0.02, 2, 0.006),
      mats.darkSteel
    );
    grille.position.set(0, -0.072, 0.122);
    group.add(grille);

    // Twin spring antennas with chrome ball tips
    [-0.11, 0.11].forEach((ax) => {
      const ant = new THREE.Mesh(g.antennaSpringGeo, mats.silverChrome);
      ant.position.set(ax, 0.19, 0);
      group.add(ant);
      const tip = new THREE.Mesh(g.bearingBallGeo, mats.brushedBrass);
      tip.scale.setScalar(0.55);
      tip.position.set(ax, 0.31, 0);
      group.add(tip);
    });
  } else if (variant === 1) {
    // Variant 1: Dome Observatory Cyclops Head + Spinning Radar Dish
    const domePts = [
      new THREE.Vector2(0, -0.11),
      new THREE.Vector2(0.17, -0.11),
      new THREE.Vector2(0.175, 0.03),
      new THREE.Vector2(0.145, 0.11),
      new THREE.Vector2(0.08, 0.155),
      new THREE.Vector2(0, 0.165),
    ];
    const dome = new THREE.Mesh(new THREE.LatheGeometry(domePts, 30), metal);
    dome.castShadow = true;
    dome.receiveShadow = true;
    group.add(dome);

    const bigEye = createOpticalLamp(mats, 0.092, 0x56dcff);
    bigEye.position.set(0, 0.015, 0.168);
    group.add(bigEye);
    group.userData.lamps.push(bigEye);

    // Spinning brass/chrome mini radar dish on crown
    const dishPivot = new THREE.Group();
    dishPivot.position.set(0, 0.195, 0);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.06, 12), mats.silverChrome);
    const dish = new THREE.Mesh(
      new THREE.SphereGeometry(0.075, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.42),
      mats.brushedBrass
    );
    dish.rotation.x = -0.8;
    dish.position.y = 0.04;
    dishPivot.add(stem, dish);
    group.add(dishPivot);
    group.userData.spinTop = dishPivot;
  } else {
    // Variant 2: Wide Visor Periscope Head + Parabolic Ear Dishes
    const cube = new THREE.Mesh(
      new RoundedBoxGeometry(0.39, 0.21, 0.24, 4, 0.038),
      metal
    );
    cube.castShadow = true;
    cube.receiveShadow = true;
    group.add(cube);

    // Wide glowing visor bar behind curved glass
    const visorFrame = new THREE.Mesh(
      new RoundedBoxGeometry(0.32, 0.088, 0.03, 3, 0.012),
      mats.darkSteel
    );
    visorFrame.position.set(0, 0.018, 0.116);
    group.add(visorFrame);

    [-0.085, 0, 0.085].forEach((vx) => {
      const vl = createOpticalLamp(mats, 0.036, 0x6ef2b1);
      vl.position.set(vx, 0.018, 0.132);
      group.add(vl);
      group.userData.lamps.push(vl);
    });

    // Twin parabolic ear dishes + bolts
    [-0.215, 0.215].forEach((ex, idx) => {
      const ear = new THREE.Mesh(
        new THREE.CylinderGeometry(0.068, 0.042, 0.035, 20),
        mats.screwHeadMetal
      );
      ear.rotation.z = (idx === 0 ? 1 : -1) * Math.PI * 0.5;
      ear.position.set(ex, 0.01, 0);
      group.add(ear);
    });
  }

  // Top Fault Siren Dome (glows bright red during Scene 2 malfunction!)
  const beacon = new THREE.Group();
  beacon.position.set(0, 0.165, -0.03);
  const bBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.042, 0.048, 0.022, 18),
    mats.silverChrome
  );
  const bDomeMat = new THREE.MeshPhysicalMaterial({
    color: 0xff4b3e,
    emissive: new THREE.Color(0x000000),
    emissiveIntensity: 0.0,
    roughness: 0.12,
    transmission: 0.55,
    transparent: true,
    opacity: 0.9,
  });
  const bDome = new THREE.Mesh(
    new THREE.SphereGeometry(0.038, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.6),
    bDomeMat
  );
  bDome.position.y = 0.01;
  beacon.add(bBase, bDome);
  beacon.userData.domeMat = bDomeMat;
  group.add(beacon);
  group.userData.faultBeacon = beacon;

  return group;
}

export function createRobotArm(mats, variant = 0, side = 1) {
  // side = -1 (robot's right / viewer's left) or +1 (robot's left / viewer's right)
  const group = new THREE.Group();
  const metal = makeCustomPartMetal(mats, variant);
  group.userData = { category: side < 0 ? 'armL' : 'armR', variant, side, metal, polishLevel: 0.25 };

  // Chrome spherical shoulder ball joint
  const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.072, 20, 16), mats.silverChrome);
  shoulder.castShadow = true;
  group.add(shoulder);

  const limb = new THREE.Group();
  limb.position.set(side * 0.05, -0.02, 0);
  limb.rotation.z = side * 0.26;
  group.add(limb);
  group.userData.limb = limb;

  if (variant === 0) {
    // Variant 0: Precision Steel Struts + Articulated Pincer Claw!
    [-0.024, 0.024].forEach((oz) => {
      const rod = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.018, 0.22, 12),
        metal
      );
      rod.position.set(0, -0.11, oz);
      rod.castShadow = true;
      limb.add(rod);
    });
    const wrist = new THREE.Mesh(
      new THREE.CylinderGeometry(0.048, 0.042, 0.045, 18),
      mats.knurledSteel
    );
    wrist.position.y = -0.22;
    limb.add(wrist);

    // Twin curved pincer jaws
    const jaws = [];
    [-1, 1].forEach((js) => {
      const jaw = new THREE.Mesh(
        new RoundedBoxGeometry(0.028, 0.11, 0.042, 2, 0.008),
        mats.silverChrome
      );
      jaw.position.set(js * 0.036, -0.285, 0);
      jaw.rotation.z = -js * 0.22;
      jaw.castShadow = true;
      limb.add(jaw);
      jaws.push(jaw);
    });
    group.userData.jaws = jaws;
  } else if (variant === 1) {
    // Variant 1: Ribbed Chrome Accordion Bellows + Copper Electromagnetic Bell Scoop!
    for (let i = 0; i < 6; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.046, 0.016, 10, 20),
        i % 2 === 0 ? metal : mats.silverChrome
      );
      ring.rotation.x = Math.PI * 0.5;
      ring.position.y = -0.045 - i * 0.032;
      ring.castShadow = true;
      limb.add(ring);
    }
    const bell = new THREE.Mesh(
      new THREE.CylinderGeometry(0.038, 0.082, 0.07, 22),
      mats.warmCopper
    );
    bell.position.y = -0.255;
    bell.castShadow = true;
    limb.add(bell);
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(0.08, 0.012, 10, 22),
      mats.silverChrome
    );
    rim.rotation.x = Math.PI * 0.5;
    rim.position.y = -0.29;
    limb.add(rim);
  } else {
    // Variant 2: Angled Brushed Tube + Twin Spinning Knurled Rollers!
    const upper = new THREE.Mesh(
      new RoundedBoxGeometry(0.072, 0.21, 0.072, 3, 0.015),
      metal
    );
    upper.position.y = -0.105;
    upper.castShadow = true;
    limb.add(upper);

    const rollerSpin = new THREE.Group();
    rollerSpin.position.y = -0.255;
    [-0.032, 0.032].forEach((rx) => {
      const r = new THREE.Mesh(
        new THREE.CylinderGeometry(0.026, 0.022, 0.095, 16),
        mats.knurledSteel
      );
      r.position.x = rx;
      rollerSpin.add(r);
    });
    limb.add(rollerSpin);
    group.userData.rollerSpin = rollerSpin;
  }

  return group;
}

export function createRobotLegs(mats, variant = 0) {
  const group = new THREE.Group();
  const metal = makeCustomPartMetal(mats, variant);
  const g = getSharedGeos();
  group.userData = { category: 'legs', variant, metal, polishLevel: 0.25 };

  // Pelvis mounting plate
  const pelvis = new THREE.Mesh(
    new RoundedBoxGeometry(0.32, 0.07, 0.24, 3, 0.018),
    mats.darkSteel
  );
  pelvis.position.y = 0.22;
  pelvis.castShadow = true;
  group.add(pelvis);

  if (variant === 0) {
    // Variant 0: Coil-Spring Hydraulic Bipedal Stompers!
    const feet = [];
    [-0.105, 0.105].forEach((lx) => {
      const legG = new THREE.Group();
      legG.position.set(lx, 0, 0);

      const piston = new THREE.Mesh(
        new THREE.CylinderGeometry(0.026, 0.026, 0.2, 14),
        mats.silverChrome
      );
      piston.position.y = 0.12;
      legG.add(piston);

      const sp = new THREE.Mesh(g.springGeo, metal);
      sp.scale.set(0.58, 0.48, 0.58);
      sp.position.y = 0.125;
      sp.castShadow = true;
      legG.add(sp);

      const foot = new THREE.Mesh(
        new RoundedBoxGeometry(0.135, 0.055, 0.21, 3, 0.018),
        metal
      );
      foot.position.set(0, 0.028, 0.025);
      foot.castShadow = true;
      foot.receiveShadow = true;
      legG.add(foot);

      group.add(legG);
      feet.push(legG);
    });
    group.userData.feet = feet;
  } else if (variant === 1) {
    // Variant 1: Machined Aluminum Tri-Wheel Omni Roller Carriage!
    const frame = new THREE.Mesh(
      new RoundedBoxGeometry(0.36, 0.085, 0.28, 3, 0.02),
      metal
    );
    frame.position.y = 0.135;
    frame.castShadow = true;
    group.add(frame);

    const wheels = [];
    [
      [-0.175, 0.08],
      [0.175, 0.08],
      [-0.175, -0.08],
      [0.175, -0.08],
    ].forEach(([wx, wz]) => {
      const wG = new THREE.Group();
      wG.position.set(wx, 0.072, wz);
      const tire = new THREE.Mesh(
        new THREE.CylinderGeometry(0.072, 0.072, 0.048, 22),
        mats.darkSteel
      );
      tire.rotation.z = Math.PI * 0.5;
      tire.castShadow = true;
      const hub = new THREE.Mesh(
        new THREE.CylinderGeometry(0.048, 0.048, 0.052, 18),
        mats.screwHeadMetal
      );
      hub.rotation.z = Math.PI * 0.5;
      wG.add(tire, hub);
      group.add(wG);
      wheels.push(wG);
    });
    group.userData.wheels = wheels;
  } else {
    // Variant 2: Quad Articulated Spider-Walker Chrome Struts!
    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.16, 0.09, 20),
      metal
    );
    hub.position.y = 0.155;
    hub.castShadow = true;
    group.add(hub);

    const struts = [];
    for (let i = 0; i < 4; i++) {
      const ang = (i / 4) * Math.PI * 2 + Math.PI * 0.25;
      const sG = new THREE.Group();
      sG.position.set(Math.cos(ang) * 0.11, 0.15, Math.sin(ang) * 0.11);
      sG.rotation.y = -ang;

      const thigh = new THREE.Mesh(
        new RoundedBoxGeometry(0.14, 0.038, 0.042, 2, 0.01),
        metal
      );
      thigh.position.set(0.065, 0.015, 0);
      thigh.rotation.z = 0.25;
      thigh.castShadow = true;

      const knee = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 10), mats.brushedBrass);
      knee.position.set(0.125, 0.03, 0);

      const shin = new THREE.Mesh(
        new THREE.CylinderGeometry(0.022, 0.014, 0.18, 12),
        mats.silverChrome
      );
      shin.position.set(0.155, -0.055, 0);
      shin.rotation.z = -0.22;
      shin.castShadow = true;

      const pad = new THREE.Mesh(
        new THREE.CylinderGeometry(0.036, 0.042, 0.022, 14),
        mats.knurledSteel
      );
      pad.position.set(0.175, -0.14, 0);

      sG.add(thigh, knee, shin, pad);
      group.add(sG);
      struts.push(sG);
    }
    group.userData.struts = struts;
  }

  return group;
}

// ============================================================================
// SCENE 2 & 3 PROPS: BRUSHED-STEEL BASKET, DAD'S TIN CANISTER, SCATTER ITEMS, DANCE PADS
// ============================================================================
export function createCleanupAndDanceProps(mats) {
  const g = getSharedGeos();

  // 1. Heavy Brushed-Steel & Brass Wire Toy Basket
  const basket = new THREE.Group();
  const bBottom = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.25, 0.03, 28),
    mats.screwHeadMetal
  );
  bBottom.position.y = 0.015;
  bBottom.receiveShadow = true;
  basket.add(bBottom);

  const bTopRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.35, 0.02, 12, 32),
    mats.silverChrome
  );
  bTopRim.rotation.x = Math.PI * 0.5;
  bTopRim.position.y = 0.34;
  bTopRim.castShadow = true;
  basket.add(bTopRim);

  const bMidRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.31, 0.012, 10, 32),
    mats.brushedBrass
  );
  bMidRim.rotation.x = Math.PI * 0.5;
  bMidRim.position.y = 0.18;
  basket.add(bMidRim);

  // Vertical steel ribs around basket
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const rib = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.008, 0.34, 8),
      mats.silverBrushed
    );
    rib.position.set(Math.cos(a) * 0.31, 0.175, Math.sin(a) * 0.31);
    rib.rotation.z = -Math.cos(a) * 0.2;
    rib.rotation.x = Math.sin(a) * 0.2;
    rib.castShadow = true;
    basket.add(rib);
  }

  // Twin brass handles
  [-1, 1].forEach((hs) => {
    const h = new THREE.Mesh(
      new THREE.TorusGeometry(0.065, 0.012, 8, 16, Math.PI),
      mats.brushedBrass
    );
    h.position.set(hs * 0.35, 0.35, 0);
    h.rotation.y = Math.PI * 0.5;
    basket.add(h);
  });

  // 2. Dad's Heavy Brushed-Tin Spare-Parts Canister (double-sided + inner base so tipped view looks solid!)
  const dadTin = new THREE.Group();
  const tinPts = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.14, 0),
    new THREE.Vector2(0.145, 0.26),
    new THREE.Vector2(0.155, 0.27),
    new THREE.Vector2(0.135, 0.27),
    new THREE.Vector2(0.132, 0.015),
    new THREE.Vector2(0, 0.015),
  ];
  const tinBody = new THREE.Mesh(new THREE.LatheGeometry(tinPts, 26), mats.silverTurned);
  tinBody.castShadow = true;
  tinBody.receiveShadow = true;
  dadTin.add(tinBody);
  const tinBand = new THREE.Mesh(
    new THREE.CylinderGeometry(0.147, 0.147, 0.05, 26),
    mats.warmCopper
  );
  tinBand.position.y = 0.13;
  dadTin.add(tinBand);

  // 3. 16 Realistic Tactile Cleanup Objects (Beechwood/Cherry blocks, Brass Cogs, Chrome Spheres, Big Silver Bolts!)
  // Zero cheap plastic toy look — real natural wood, brass, copper, and silver steel!
  const items = [];
  for (let i = 0; i < 16; i++) {
    const item = new THREE.Group();
    const kind = i % 4;
    let mesh;
    if (kind === 0) {
      // Chamfered Beechwood / Cherry Cube
      mesh = new THREE.Mesh(
        new RoundedBoxGeometry(0.115, 0.115, 0.115, 3, 0.018),
        i % 8 === 0 ? mats.cherryWood : mats.beechWood
      );
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      item.add(mesh);
      // Small inlaid brass stud on face
      const stud = new THREE.Mesh(
        new THREE.CylinderGeometry(0.022, 0.022, 0.12, 12),
        mats.brushedBrass
      );
      item.add(stud);
      item.userData.radius = 0.07;
      item.userData.isMetal = false;
    } else if (kind === 1) {
      // Heavy Machined Brass Gear Wheel
      mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.078, 0.078, 0.042, 12),
        mats.brushedBrass
      );
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const centerRing = new THREE.Mesh(
        new THREE.CylinderGeometry(0.036, 0.036, 0.048, 16),
        mats.silverChrome
      );
      item.add(mesh, centerRing);
      item.userData.radius = 0.065;
      item.userData.isMetal = true;
    } else if (kind === 2) {
      // Chunky Oversized Silver Bolt!
      const bigBolt = createMachinedScrew(mats, 0.68, i % 3);
      bigBolt.rotation.z = Math.PI * 0.48;
      item.add(bigBolt);
      item.userData.radius = 0.065;
      item.userData.isMetal = true;
    } else {
      // Polished Chrome / Copper Chime Sphere
      mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.064, 20, 16),
        i % 8 === 3 ? mats.silverChrome : mats.warmCopper
      );
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const band = new THREE.Mesh(
        new THREE.TorusGeometry(0.064, 0.008, 8, 20),
        mats.brushedBrass
      );
      item.add(mesh, band);
      item.userData.radius = 0.064;
      item.userData.isMetal = true;
    }
    item.userData.vel = new THREE.Vector3();
    item.userData.angVel = new THREE.Vector3();
    item.userData.inBasket = false;
    item.userData.index = i;
    items.push(item);
  }

  // 4. 4 Chrome & Brass Rhythm Dance Pads for Scene 3 Free-Play!
  const dancePads = [];
  const padColors = [0xffcf6b, 0x56dcff, 0x6ef2b1, 0xff7eb6];
  for (let i = 0; i < 4; i++) {
    const pad = new THREE.Group();
    const housing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.135, 0.15, 0.036, 26),
      mats.screwHeadMetal
    );
    housing.position.y = 0.018;
    housing.castShadow = true;
    housing.receiveShadow = true;
    pad.add(housing);

    const glowMat = new THREE.MeshStandardMaterial({
      color: padColors[i],
      emissive: new THREE.Color(padColors[i]),
      emissiveIntensity: i === 0 ? 1.5 : 0.45,
      roughness: 0.25,
      metalness: 0.2,
    });
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.105, 0.11, 0.026, 24),
      glowMat
    );
    cap.position.y = 0.036;
    pad.add(cap);

    // Pure geometric relief emblem on top of pad (zero text!):
    // 0: Coil/Bounce ring, 1: Gear/Spin star, 2: Wave bar, 3: Multi-star chime
    let iconMesh;
    if (i === 0) {
      iconMesh = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.01, 8, 18), mats.silverChrome);
      iconMesh.rotation.x = Math.PI * 0.5;
    } else if (i === 1) {
      iconMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.014, 6), mats.silverChrome);
    } else if (i === 2) {
      iconMesh = new THREE.Mesh(new RoundedBoxGeometry(0.095, 0.014, 0.032, 2, 0.005), mats.silverChrome);
    } else {
      iconMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.045, 0), mats.brushedBrass);
      iconMesh.scale.y = 0.35;
    }
    iconMesh.position.y = 0.052;
    pad.add(iconMesh);

    pad.userData = { cap, glowMat, styleIndex: i, pressAnim: 0 };
    dancePads.push(pad);
  }

  return { basket, dadTin, items, dancePads };
}
