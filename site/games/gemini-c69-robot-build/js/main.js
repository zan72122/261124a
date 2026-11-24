import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { SoundEngine } from './audio.js';
import { createMaterialLibrary } from './materials.js';
import {
  createWorkshopEnvironment,
  createDeliveryParcel,
  createWorkbenchTools,
  createMachinedScrew,
  createRobotTorso,
  createRobotHead,
  createRobotArm,
  createRobotLegs,
  createCleanupAndDanceProps,
} from './geometry.js';
import {
  createFirstPersonHand,
  createGirlCharacter,
  createWorkshopMirror,
  createDressUpTray,
  createDadCharacter,
} from './characters.js';

// ============================================================================
// INITIALIZE RENDERER, SCENE, CAMERA & POST-PROCESSING
// ============================================================================
const container = document.getElementById('app');
const sound = new SoundEngine();

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: true, // Enables crisp canvas snapshot & thumbnail capture
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;
renderer.info.autoReset = false;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05070c);
scene.fog = new THREE.FogExp2(0x05070c, 0.085);

const mats = createMaterialLibrary(renderer);
scene.environment = mats.envMap;

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 25);

// Subtle optical bloom ONLY on incandescent filament & robot lamp cores (high threshold = zero plastic blur)
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(Math.floor(window.innerWidth * 0.5), Math.floor(window.innerHeight * 0.5)),
  0.07,
  0.25,
  1.38
);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

// ============================================================================
// NIGHT ROOM LIGHTING: SINGLE PENDANT LIGHT + ROBOT COLORED LAMP LIGHT
// ============================================================================
// Very dim cool night-sky ambient so shadows stay rich and cinematic
const nightAmbient = new THREE.HemisphereLight(0x1b2842, 0x120b06, 0.15);
scene.add(nightAmbient);

// THE SINGLE OVERHEAD PENDANT LIGHT (Warm 2900K Tungsten Pool!)
const pendantSpot = new THREE.SpotLight(0xffd296, 8.8, 9.5, Math.PI * 0.36, 0.65, 1.45);
pendantSpot.position.set(0.08, 2.62, 0.28);
pendantSpot.target.position.set(0, 0.95, 0.12);
pendantSpot.castShadow = true;
pendantSpot.shadow.mapSize.set(1024, 1024);
pendantSpot.shadow.camera.near = 0.5;
pendantSpot.shadow.camera.far = 6.5;
pendantSpot.shadow.bias = -0.0005;
pendantSpot.shadow.normalBias = 0.018;
scene.add(pendantSpot);
scene.add(pendantSpot.target);

// Subtle warm bounce under pendant shade so characters' faces read naturally in the dark room
const pendantFill = new THREE.PointLight(0xffc987, 1.35, 4.2, 1.6);
pendantFill.position.set(0.0, 1.85, 0.65);
scene.add(pendantFill);

// ROBOT'S DYNAMIC COLORED LAMP LIGHT (Casts real cyan/amber/emerald/crimson light onto metal & wood!)
const robotLampLight = new THREE.PointLight(0x56dcff, 0.0, 3.2, 1.5);
scene.add(robotLampLight);

// ============================================================================
// BUILD WORLD, CHARACTERS, HARDWARE & ROBOT PARTS
// ============================================================================
const env = createWorkshopEnvironment(mats);
scene.add(env.root);

// Girl Character (Starts standing behind Dress-Up Tray in Scene 0, then moves into Mirror for Scenes 1-3!)
const girl = createGirlCharacter(mats);
const stageGirlAnchor = new THREE.Group();
stageGirlAnchor.position.set(-0.08, 1.42, -0.34);
stageGirlAnchor.scale.setScalar(1.38);
scene.add(stageGirlAnchor);
stageGirlAnchor.add(girl);

const mirrorGirl = createGirlCharacter(mats);
const workshopMirror = createWorkshopMirror(mats, mirrorGirl);
workshopMirror.position.set(-0.84, 1.014, -0.44);
workshopMirror.rotation.y = 0.42;
workshopMirror.visible = false; // Appears once girl steps into POV mode!
scene.add(workshopMirror);

// Dad Character
const dad = createDadCharacter(mats);
dad.position.set(-0.74, 1.36, -0.56);
dad.rotation.y = 0.36;
scene.add(dad);

// First-Person Big Child's Hand ("一人称の手元POVで部品をつかむ大きな手")
const fpHand = createFirstPersonHand(mats);
fpHand.scale.setScalar(1.32); // Large, tactile foreground child hand POV!
fpHand.position.set(0.46, 1.24, 0.72);
scene.add(fpHand);

// Scene 0: Dress-Up Tray + Ready Bell/Parcel Preview
const dressTray = createDressUpTray(mats);
dressTray.position.set(0, 1.02, 0.24);
scene.add(dressTray);

// Scene 1: Delivery Parcel Box + Workbench Tools
const parcelBox = createDeliveryParcel(mats);
parcelBox.position.set(0.68, 1.015, -0.08);
parcelBox.scale.setScalar(0.58);
parcelBox.rotation.y = -0.28;
scene.add(parcelBox);

const tools = createWorkbenchTools(mats);
tools.stand.position.set(0, 1.014, 0.06);
tools.stand.visible = false;
scene.add(tools.stand);

tools.ratchet.position.set(0.88, 1.048, 0.42);
tools.ratchet.rotation.y = -0.45;
tools.ratchet.visible = false;
scene.add(tools.ratchet);

tools.buffer.position.set(-0.88, 1.018, 0.44);
tools.buffer.rotation.y = 0.35;
tools.buffer.visible = false;
scene.add(tools.buffer);

// Pre-build all selectable Robot Parts so switching/experimenting is instant & zero-GC!
const partPools = {
  torso: [0, 1, 2].map((v) => createRobotTorso(mats, v)),
  head: [0, 1, 2].map((v) => createRobotHead(mats, v)),
  armL: [0, 1, 2].map((v) => createRobotArm(mats, v, -1)),
  armR: [0, 1, 2].map((v) => createRobotArm(mats, v, 1)),
  legs: [0, 1, 2].map((v) => createRobotLegs(mats, v)),
};

// Rack Display Slots around the Central Assembly Stand on Workbench (cleanly separated from center stand!)
const rackLayout = {
  head: [
    new THREE.Vector3(-1.08, 1.12, -0.22),
    new THREE.Vector3(-0.76, 1.12, -0.22),
    new THREE.Vector3(-0.46, 1.12, -0.22),
  ],
  torso: [
    new THREE.Vector3(-1.08, 1.15, 0.22),
    new THREE.Vector3(-0.76, 1.15, 0.22),
    new THREE.Vector3(-0.46, 1.15, 0.22),
  ],
  armL: [
    new THREE.Vector3(0.48, 1.17, -0.28),
    new THREE.Vector3(0.76, 1.17, -0.28),
    new THREE.Vector3(1.04, 1.17, -0.28),
  ],
  armR: [
    new THREE.Vector3(0.48, 1.17, 0.02),
    new THREE.Vector3(0.76, 1.17, 0.02),
    new THREE.Vector3(1.04, 1.17, 0.02),
  ],
  legs: [
    new THREE.Vector3(0.48, 1.03, 0.32),
    new THREE.Vector3(0.78, 1.03, 0.32),
    new THREE.Vector3(1.08, 1.03, 0.32),
  ],
};

// Brushed silver rack trays under left & right part zones
const rackTrays = [];
[-0.72, 0.74].forEach((rx) => {
  const rt = new THREE.Mesh(
    new THREE.BoxGeometry(0.82, 0.016, 0.84),
    mats.silverTurned
  );
  rt.position.set(rx, 1.018, -0.02);
  rt.receiveShadow = true;
  rt.visible = false;
  scene.add(rt);
  rackTrays.push(rt);
});

Object.entries(partPools).forEach(([cat, arr]) => {
  arr.forEach((mesh, idx) => {
    mesh.visible = false;
    mesh.scale.setScalar(0.68);
    mesh.position.copy(rackLayout[cat][idx]);
    scene.add(mesh);
  });
});

// ============================================================================
// ASSEMBLED ROBOT RIG (Lives on Stand in Scene 1, Walks & Dances on Floor in Scenes 2-3!)
// ============================================================================
const robotRoot = new THREE.Group();
robotRoot.position.set(0, 1.065, 0.06);
robotRoot.scale.setScalar(0.88);
scene.add(robotRoot);

// Subtle brushed-steel guide spine on stand before parts are attached (Affordance: shows missing silhouette!)
const guideSpine = new THREE.Group();
const spineRod = new THREE.Mesh(
  new THREE.CylinderGeometry(0.022, 0.026, 0.56, 16),
  mats.knurledSteel
);
spineRod.position.y = 0.28;
guideSpine.add(spineRod);
[0.14, 0.36, 0.56].forEach((gy) => {
  const collar = new THREE.Mesh(
    new THREE.TorusGeometry(0.055, 0.009, 8, 20),
    mats.brushedBrass
  );
  collar.rotation.x = Math.PI * 0.5;
  collar.position.y = gy;
  guideSpine.add(collar);
});
guideSpine.visible = false;
robotRoot.add(guideSpine);

// Slots inside robotRoot
const robotSlots = {
  legs: new THREE.Group(),
  torso: new THREE.Group(),
  head: new THREE.Group(),
  armL: new THREE.Group(),
  armR: new THREE.Group(),
};
robotSlots.legs.position.set(0, 0, 0);
robotSlots.torso.position.set(0, 0.39, 0);
robotSlots.head.position.set(0, 0.69, 0);
robotSlots.armL.position.set(-0.25, 0.49, 0);
robotSlots.armR.position.set(0.25, 0.49, 0);
Object.values(robotSlots).forEach((s) => robotRoot.add(s));

// Interactive Joint Screws on Robot! (Tightening changes bolt depth + posture stiffness continuously!)
const jointScrews = {};
const screwOffsets = {
  torso: new THREE.Vector3(-0.17, 0.24, 0.16),
  head: new THREE.Vector3(0.09, 0.58, 0.12),
  armL: new THREE.Vector3(-0.26, 0.55, 0.08),
  armR: new THREE.Vector3(0.26, 0.55, 0.08),
  legs: new THREE.Vector3(0.15, 0.19, 0.13),
};
Object.entries(screwOffsets).forEach(([slot, pos], idx) => {
  const sc = createMachinedScrew(mats, 0.42, idx % 3);
  sc.position.copy(pos);
  sc.rotation.x = Math.PI * 0.42;
  sc.visible = false;
  sc.userData.slot = slot;
  robotRoot.add(sc);
  jointScrews[slot] = sc;
});

// Power Activation Switch Lever (emerges on right of stand when all 5 slots have parts!)
const powerSwitch = new THREE.Group();
powerSwitch.position.set(0.34, 1.06, 0.34);
powerSwitch.visible = false;
const swBase = new THREE.Mesh(
  new THREE.CylinderGeometry(0.088, 0.098, 0.045, 24),
  mats.screwHeadMetal
);
const swPivot = new THREE.Group();
swPivot.position.y = 0.025;
swPivot.rotation.z = 0.52;
const swRod = new THREE.Mesh(
  new THREE.CylinderGeometry(0.016, 0.016, 0.13, 12),
  mats.silverChrome
);
swRod.position.y = 0.065;
const swKnobMat = new THREE.MeshStandardMaterial({
  color: 0x56f2a6,
  emissive: 0x28c77a,
  emissiveIntensity: 1.8,
  roughness: 0.2,
});
const swKnob = new THREE.Mesh(new THREE.SphereGeometry(0.038, 18, 14), swKnobMat);
swKnob.position.y = 0.135;
swPivot.add(swRod, swKnob);
powerSwitch.add(swBase, swPivot);
powerSwitch.userData = { swPivot, swKnobMat };
scene.add(powerSwitch);

// Scene 2 & 3 Props
const floorProps = createCleanupAndDanceProps(mats);
floorProps.basket.position.set(-0.74, 0.008, 2.48);
floorProps.basket.visible = false;
scene.add(floorProps.basket);

floorProps.dadTin.position.set(0.75, 0.65, 1.75);
floorProps.dadTin.visible = false;
scene.add(floorProps.dadTin);

floorProps.items.forEach((it) => {
  it.visible = false;
  scene.add(it);
});

floorProps.dancePads.forEach((pad, i) => {
  pad.position.set((i - 1.5) * 0.36, -0.2, 3.06);
  pad.visible = false;
  scene.add(pad);
});

// Small Spare Parcel Crate on background bench in Scene 3 (optional double-tap to build a brand new robot!)
const replayCrate = createDeliveryParcel(mats);
replayCrate.scale.setScalar(0.32);
replayCrate.position.set(0.95, 1.015, 0.58);
replayCrate.visible = false;
scene.add(replayCrate);

// ============================================================================
// SIMULATION STATE (Discrete Choices x Continuous Analog Parameters!)
// ============================================================================
const LAMP_PALETTE = [
  0x56dcff, // Icy Cyan
  0xffcf6b, // Warm Tungsten Gold
  0x6ef2b1, // Mint Emerald
  0x8fa8ff, // Cobalt Periwinkle
  0xff8e72, // Warm Coral Amber
];

const sim = {
  phase: 'dressup', // 'dressup' | 'unbox' | 'build' | 'tidy_intro' | 'malfunction' | 'cleanup' | 'dance'
  phaseTime: 0,
  idleTime: 0,
  idleHintShownForPhase: false,

  // Dress-up state (9 discrete combos x continuous visor tilt)
  coatIdx: 0,
  hatIdx: 0,
  visorTilt: 0.0,
  dressedCount: 0,
  pickedHat: false,
  pickedCoat: false,
  autoAdvanceTimer: 0,

  // Unboxing continuous state
  tapeProgress: 0.0,
  flapProgress: 0.0,

  // Robot build state (243 part combos x continuous torque[5] x continuous polish[5] x lampHue!)
  selected: {
    torso: null,
    head: null,
    armL: null,
    armR: null,
    legs: null,
  },
  torque: {
    torso: 0.25,
    head: 0.25,
    armL: 0.25,
    armR: 0.25,
    legs: 0.25,
  },
  polish: {
    torso: 0.25,
    head: 0.25,
    armL: 0.25,
    armR: 0.25,
    legs: 0.25,
  },
  lampHueIdx: 0,
  lampCustomHue: 0.54, // Continuous 0..1 HSV hue if dial dragged!
  useCustomHue: false,
  activeTool: 'hand', // 'hand' | 'ratchet' | 'buffer'

  // Scene 2 Dad Blunder & Fault state
  dadGoofTriggered: false,
  dadTinDropped: false,
  dadTinRescued: false,
  repairProgress: 0.0,
  faultBeepTimer: 0,

  // Robot autonomous locomotion & dance state
  robotPos: new THREE.Vector3(0, 0.015, 2.35),
  robotRotY: 0,
  robotCarryItem: null,
  robotHeadHatItem: null,
  robotHeadHatTimer: 0,
  danceStyle: 0,
  manualSpinVel: 0,
  replayTapTime: 0,
};

// Camera Smooth Framing Targets (Responsive to Portrait vs Landscape!)
const camGoalPos = new THREE.Vector3(0, 1.84, 1.62);
const camGoalLook = new THREE.Vector3(0, 1.18, -0.05);
const camCurrPos = camGoalPos.clone();
const camCurrLook = camGoalLook.clone();

function syncCharacterOutfits() {
  girl.userData.setOutfit(sim.coatIdx, sim.hatIdx, sim.visorTilt);
  mirrorGirl.userData.setOutfit(sim.coatIdx, sim.hatIdx, sim.visorTilt);
  fpHand.userData.setOutfit(sim.coatIdx, sim.hatIdx);
}
syncCharacterOutfits();

function syncGirlExpression(expr, dur = 1.6) {
  girl.userData.setExpression(expr, dur);
  mirrorGirl.userData.setExpression(expr, dur);
}

function getCurrentRobotColor() {
  if (sim.phase === 'malfunction') {
    return new THREE.Color(0xff2a22);
  }
  if (sim.useCustomHue) {
    return new THREE.Color().setHSL(sim.lampCustomHue, 0.88, 0.62);
  }
  return new THREE.Color(LAMP_PALETTE[sim.lampHueIdx % LAMP_PALETTE.length]);
}

function updateRobotLampColors(pulse = 1.0) {
  const col = getCurrentRobotColor();
  Object.entries(sim.selected).forEach(([cat, v]) => {
    if (v === null) return;
    const mesh = partPools[cat][v];
    if (mesh.userData.lamps) {
      mesh.userData.lamps.forEach((lamp) => {
        lamp.userData.coreMat.color.copy(col);
        lamp.userData.coreMat.emissive.copy(col);
        lamp.userData.coreMat.emissiveIntensity = 2.4 * pulse;
      });
    }
    if (cat === 'head' && mesh.userData.faultBeacon) {
      const dm = mesh.userData.faultBeacon.userData.domeMat;
      if (sim.phase === 'malfunction') {
        dm.emissive.setHex(0xff2218);
        dm.emissiveIntensity = 3.2 * pulse;
      } else {
        dm.emissive.setHex(0x000000);
        dm.emissiveIntensity = 0.0;
      }
    }
    if (cat === 'torso' && mesh.userData.resetBtn) {
      const bm = mesh.userData.resetBtn.userData.btnCapMat;
      if (sim.phase === 'malfunction') {
        bm.emissive.setHex(0xff261b);
        bm.emissiveIntensity = 2.6 * pulse;
        mesh.userData.resetBtn.scale.setScalar(1.38 + Math.sin(performance.now() * 0.012) * 0.1);
      } else {
        bm.emissive.setHex(0x280404);
        bm.emissiveIntensity = 0.25;
        mesh.userData.resetBtn.scale.setScalar(0.88);
      }
    }
  });
  robotLampLight.color.copy(col);
}

// Attach or swap a robot part into robotSlots[cat]
function attachRobotPart(cat, variant) {
  const prev = sim.selected[cat];
  if (prev !== null && prev !== variant) {
    const oldMesh = partPools[cat][prev];
    scene.add(oldMesh);
    oldMesh.scale.setScalar(0.68);
    oldMesh.position.copy(rackLayout[cat][prev]);
    oldMesh.rotation.set(0, 0, 0);
    oldMesh.visible = sim.phase === 'build';
  }

  sim.selected[cat] = variant;
  const partMesh = partPools[cat][variant];
  partMesh.visible = true;
  partMesh.scale.setScalar(1.0);
  partMesh.position.set(0, 0, 0);
  partMesh.rotation.set(0, 0, 0);
  robotSlots[cat].add(partMesh);

  // Reveal chunky silver joint screw for this part!
  const sc = jointScrews[cat];
  sc.visible = true;
  sim.torque[cat] = Math.max(0.2, sim.torque[cat]);
  updateJointScrewVisual(cat);

  sound.socketSnap(variant);
  syncGirlExpression('delighted', 1.2);
  updateRobotLampColors(1.0);

  // Check if all 5 body slots are filled!
  const allReady = Object.values(sim.selected).every((v) => v !== null);
  if (allReady && sim.phase === 'build' && !powerSwitch.visible) {
    powerSwitch.visible = true;
    sound.happySparkle();
  }
  guideSpine.visible = !allReady && sim.phase === 'build';
}

function updateJointScrewVisual(cat) {
  const sc = jointScrews[cat];
  const tq = sim.torque[cat];
  if (sc && sc.userData.bolt) {
    // Tightening threads bolt deeper into washer & spins the slotted head!
    sc.userData.bolt.position.y = (1.0 - tq) * 0.085;
    sc.userData.bolt.rotation.y = tq * Math.PI * 6.0;
  }
}

function applyPartPolish(cat, delta) {
  const v = sim.selected[cat];
  if (v === null) return;
  sim.polish[cat] = Math.max(0, Math.min(1, sim.polish[cat] + delta));
  const mesh = partPools[cat][v];
  if (mesh.userData.metal) {
    // Continuous transition from machined satin (0.31) to high-gleam mirror chrome (0.065)!
    mesh.userData.metal.roughness = 0.31 - sim.polish[cat] * 0.245;
    mesh.userData.metal.envMapIntensity = 1.35 + sim.polish[cat] * 0.55;
  }
}

// ============================================================================
// PHASE TRANSITIONS
// ============================================================================
function enterPhase(nextPhase) {
  sim.phase = nextPhase;
  sim.phaseTime = 0;
  sim.idleTime = 0;
  sim.idleHintShownForPhase = false;

  // Update Pictorial Rule Signboard brass clip indicator (Panel 0, 1, or 2)
  const clip = env.ruleBoard.userData.activeClip;
  if (nextPhase === 'dressup' || nextPhase === 'unbox' || nextPhase === 'build') {
    clip.position.x = -0.2;
  } else if (nextPhase === 'tidy_intro' || nextPhase === 'malfunction') {
    clip.position.x = 0.0;
  } else {
    clip.position.x = 0.2;
  }

  // Ensure Dress-Up props hide & Girl's Mirror Reflection appears in ALL post-dressup phases!
  if (nextPhase !== 'dressup') {
    stageGirlAnchor.visible = false;
    dressTray.visible = false;
    workshopMirror.visible = true;
  } else {
    stageGirlAnchor.visible = true;
    dressTray.visible = true;
    workshopMirror.visible = false;
  }

  if (nextPhase === 'unbox') {
    workshopMirror.position.set(-0.78, 1.014, -0.42);
    workshopMirror.rotation.y = 0.36;

    dad.position.set(0.24, 1.34, -0.64);
    dad.rotation.y = -0.15;

    env.ruleBoard.position.set(0.76, 1.21, -0.46);
    env.ruleBoard.rotation.set(-0.18, -0.32, 0);

    parcelBox.position.set(0, 1.015, 0.16);
    parcelBox.scale.setScalar(1.0);
    parcelBox.rotation.y = 0;

    pendantSpot.position.set(0.06, 2.58, 0.28);
    pendantSpot.target.position.set(0, 1.02, 0.08);
    sound.metalClink(0.6);
  } else if (nextPhase === 'build') {
    workshopMirror.position.set(-0.82, 1.014, -0.46);
    workshopMirror.rotation.y = 0.38;
    dad.position.set(0.38, 1.35, -0.68);
    dad.rotation.y = -0.18;
    env.ruleBoard.position.set(0.8, 1.21, -0.46);
    env.ruleBoard.rotation.set(-0.18, -0.32, 0);

    parcelBox.visible = false;
    tools.stand.visible = true;
    tools.ratchet.visible = true;
    tools.buffer.visible = true;
    guideSpine.visible = true;
    rackTrays.forEach((rt) => (rt.visible = true));

    Object.entries(partPools).forEach(([cat, arr]) => {
      arr.forEach((mesh, idx) => {
        mesh.visible = true;
        mesh.position.copy(rackLayout[cat][idx]);
        mesh.scale.setScalar(0.68);
      });
    });
    robotRoot.position.set(0, 1.075, 0.06);
    robotRoot.rotation.set(0, 0, 0);
    robotLampLight.intensity = 1.6;
    sound.happySparkle();
  } else if (nextPhase === 'tidy_intro') {
    // Transition camera & action down to the cozy Pendant-Lit Night Room Floor!
    tools.stand.visible = false;
    tools.ratchet.visible = false;
    tools.buffer.visible = false;
    powerSwitch.visible = false;
    guideSpine.visible = false;
    rackTrays.forEach((rt) => (rt.visible = false));

    // Hide unchosen parts cleanly
    Object.entries(partPools).forEach(([cat, arr]) => {
      arr.forEach((mesh, idx) => {
        if (sim.selected[cat] !== idx) mesh.visible = false;
      });
    });
    // Seat joint screws cleanly for floor action
    Object.values(jointScrews).forEach((sc) => (sc.visible = true));

    // Move pendant spotlight pool onto the floor rug!
    pendantSpot.position.set(0.05, 2.55, 2.35);
    pendantSpot.target.position.set(0, 0.0, 2.42);
    pendantFill.position.set(0, 1.45, 2.65);

    // Place Workshop Mirror & Rule Board clearly inside frame beside the floor rug!
    workshopMirror.position.set(-0.74, 0.18, 1.88);
    workshopMirror.rotation.y = 0.38;
    env.ruleBoard.position.set(0.76, 0.22, 1.9);
    env.ruleBoard.rotation.set(-0.18, -0.32, 0);

    // Dad kneels warmly by the back edge of the rug holding the heavy tin!
    dad.position.set(0.46, 0.48, 1.66);
    dad.rotation.y = -0.22;
    dad.userData.setState('warm', 3.0);

    floorProps.basket.visible = true;
    floorProps.dadTin.visible = true;
    floorProps.dadTin.position.set(0.46, 0.42, 1.95);
    floorProps.dadTin.rotation.set(0, 0, 0);

    sim.robotPos.set(0.12, 0.015, 2.32);
    sim.robotRotY = -0.4;
    robotRoot.position.copy(sim.robotPos);

    // Place initial 5 blocks neatly on floor for robot to start helping tidy!
    floorProps.items.forEach((it, idx) => {
      it.userData.inBasket = false;
      it.userData.vel.set(0, 0, 0);
      if (idx < 5) {
        it.visible = true;
        it.position.set(-0.25 + idx * 0.22, 0.075, 2.55 + (idx % 2) * 0.22);
      } else {
        it.visible = false;
      }
    });

    robotLampLight.intensity = 2.4;
    syncGirlExpression('delighted', 2.2);
  } else if (nextPhase === 'malfunction') {
    // DAD'S GUARANTEED BLUNDER! Drops heavy silver tin onto robot -> Red Fault Lamp & Toy Scatter!
    sim.dadGoofTriggered = true;
    sim.dadTinDropped = true;
    sim.repairProgress = 0;

    dad.userData.setState('oops', 5.5);
    syncGirlExpression('gasp', 2.8);
    sound.dadClatter();

    // Tin tumbles onto floor right edge
    floorProps.dadTin.position.set(0.62, 0.14, 2.22);
    floorProps.dadTin.rotation.set(0.25, 0.4, 1.48);

    // Spawn ALL 16 items flying outward from the dizzy robot & spilled tin!
    floorProps.items.forEach((it, i) => {
      it.visible = true;
      it.userData.inBasket = false;
      const ang = (i / floorProps.items.length) * Math.PI * 2 + Math.random() * 0.35;
      const spd = 1.05 + Math.random() * 1.35;
      it.position.set(
        sim.robotPos.x + Math.cos(ang) * 0.18,
        0.28 + (i % 4) * 0.08,
        sim.robotPos.z + Math.sin(ang) * 0.18
      );
      it.userData.vel.set(Math.cos(ang) * spd, 1.4 + Math.random() * 1.1, Math.sin(ang) * spd * 0.85);
      it.userData.angVel.set(
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 8
      );
    });

    updateRobotLampColors(1.3);
    robotLampLight.intensity = 4.2;
  } else if (nextPhase === 'cleanup') {
    // Robot fixed! Red fault lamp turns back into crisp healthy glow!
    sim.robotCarryItem = null;
    dad.userData.setState('laugh', 2.0);
    syncGirlExpression('delighted', 2.2);
    updateRobotLampColors(1.0);
    robotLampLight.intensity = 2.6;
  } else if (nextPhase === 'dance') {
    // All tidied! Free-Play Robot Dance Finale!
    floorProps.dancePads.forEach((pad) => {
      pad.visible = true;
    });
    replayCrate.visible = true;
    sim.robotPos.set(0.08, 0.015, 2.38);
    sim.robotRotY = 0;
    dad.userData.setState('dance', 999);
    syncGirlExpression('dancing', 999);
    updateRobotLampColors(1.0);
    sound.happySparkle();
    robotLampLight.intensity = 2.6;
  }
}

// ============================================================================
// RESPONSIVE CAMERA UPDATE (Handles both iPad 4:3 Landscape & iPhone Portrait!)
// ============================================================================
function computeCameraGoals() {
  const aspect = window.innerWidth / Math.max(1, window.innerHeight);
  const isPortrait = aspect < 0.95;
  camera.fov = isPortrait ? Math.min(62, 43 / Math.max(0.54, aspect * 0.88)) : 41;
  camera.aspect = aspect;
  camera.updateProjectionMatrix();

  const pullBack = isPortrait ? 1.36 : 1.0;

  if (sim.phase === 'dressup') {
    camGoalLook.set(0, 1.2, -0.06);
    camGoalPos.set(0, 1.2 + 0.68 * pullBack, -0.06 + 1.66 * pullBack);
  } else if (sim.phase === 'unbox' || sim.phase === 'build') {
    camGoalLook.set(0, 1.23, 0.02);
    camGoalPos.set(0, 1.23 + 0.86 * pullBack, 1.56 * pullBack);
  } else {
    // Floor POV for Scenes 2 & 3
    camGoalLook.set(0, 0.33, 2.38);
    camGoalPos.set(0, 0.33 + 1.06 * pullBack, 2.38 + 1.62 * pullBack);
  }
}
computeCameraGoals();
camCurrPos.copy(camGoalPos);
camCurrLook.copy(camGoalLook);

window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(w, h);
  composer.setSize(w, h);
  bloomPass.setSize(Math.floor(w * 0.5), Math.floor(h * 0.5));
  computeCameraGoals();
});

// ============================================================================
// ONE-FINGER UNIFIED POINTER INTERACTION & CONTINUOUS HAND SIMULATION
// ============================================================================
const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2(0.35, -0.35);
const workPlaneBench = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.16);
const workPlaneFloor = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.22);
const hitWorld = new THREE.Vector3(0.35, 1.18, 0.55);

let activePointerId = null;
let isPointerDown = false;
let dragMode = null;
// dragMode values:
// 'outfit' | 'tape' | 'part' | 'screw' | 'polish' | 'prism' | 'power' | 'resetBtn' | 'item' | 'robotSpin' | 'visorAdjust'
let draggedObj = null;
let dragCat = null;
let dragVariant = null;
let lastPointerNDC = new THREE.Vector2();
let ruleBoardTiltBoost = 0;

function updatePointerRay(clientX, clientY) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointerNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointerNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointerNDC, camera);

  const activePlane =
    sim.phase === 'dressup' || sim.phase === 'unbox' || sim.phase === 'build'
      ? workPlaneBench
      : workPlaneFloor;
  raycaster.ray.intersectPlane(activePlane, hitWorld);
}

// Project 3D world point to NDC distance for super-generous child-friendly hitboxes!
const _projTmp = new THREE.Vector3();
const _worldTmp = new THREE.Vector3();
function ndcDistToObject(obj, padY = 0) {
  obj.getWorldPosition(_worldTmp);
  _worldTmp.y += padY;
  _projTmp.copy(_worldTmp).project(camera);
  return Math.hypot(_projTmp.x - pointerNDC.x, _projTmp.y - pointerNDC.y);
}

function onPointerDown(e) {
  if (activePointerId !== null && e.pointerId !== activePointerId) return; // Multi-touch safe!
  activePointerId = e.pointerId;
  isPointerDown = true;
  sim.idleTime = 0;
  sound.unlock();

  updatePointerRay(e.clientX, e.clientY);
  lastPointerNDC.copy(pointerNDC);

  // Always let child tap the 1-Board Rule Signboard to tilt/inspect it with a gentle wooden tap!
  if (ndcDistToObject(env.ruleBoard, 0) < 0.22) {
    ruleBoardTiltBoost = 1.0;
    sound.woodTap(1.1);
  }

  // Always let child tap loose ambient silver screws/springs on bench for tactile metallic feedback!
  if (sim.phase === 'dressup' || sim.phase === 'unbox' || sim.phase === 'build') {
    for (const cl of env.clutterItems) {
      if (ndcDistToObject(cl, 0) < 0.09) {
        cl.rotation.y += 0.9;
        cl.position.y += 0.025;
        sound.metalClink(0.25);
        break;
      }
    }
  }

  // ---------------- SCENE 0: DRESS-UP ----------------
  if (sim.phase === 'dressup') {
    // Check 6 outfit pads (generous radius!)
    let bestPad = null;
    let bestDist = 0.24;
    for (const pad of dressTray.userData.items) {
      const d = ndcDistToObject(pad, 0.04);
      if (d < bestDist) {
        bestDist = d;
        bestPad = pad;
      }
    }
    if (bestPad) {
      dragMode = 'outfit';
      draggedObj = bestPad;
      if (bestPad.userData.outfitKind === 'hat') {
        sim.hatIdx = bestPad.userData.index;
        sim.pickedHat = true;
      } else {
        sim.coatIdx = bestPad.userData.index;
        sim.pickedCoat = true;
      }
      sim.dressedCount++;
      if ((sim.pickedHat && sim.pickedCoat) || sim.dressedCount >= 2) {
        if (sim.autoAdvanceTimer === 0) sim.autoAdvanceTimer = 0.95;
      }
      syncCharacterOutfits();
      syncGirlExpression('delighted', 1.8);
      sound.clothEquip(bestPad.userData.index);
      return;
    }

    // Touching the girl directly adjusts goggle/visor tilt continuously!
    if (ndcDistToObject(stageGirlAnchor, 0.06) < 0.26) {
      dragMode = 'visorAdjust';
      syncGirlExpression('delighted', 1.2);
      sound.clothEquip(sim.hatIdx);
      return;
    }

    // Touching the waiting parcel box (super-generous hitbox!):
    if (ndcDistToObject(parcelBox, 0.1) < 0.44) {
      if (sim.dressedCount > 0) {
        enterPhase('unbox');
      } else {
        // Gentle wobble on parcel + outfit pads bounce subtly to invite picking costume first!
        parcelBox.rotation.z = 0.12;
        sound.woodTap(0.8);
      }
      return;
    }
  }

  // ---------------- SCENE 1A: UNBOXING PARCEL ----------------
  if (sim.phase === 'unbox') {
    if (ndcDistToObject(parcelBox, 0.1) < 0.48) {
      dragMode = 'tape';
      advanceUnboxing(0.36);
      return;
    }
  }

  // ---------------- SCENE 1B: ROBOT ASSEMBLY ----------------
  if (sim.phase === 'build') {
    // 1. Power Lever check (when visible!)
    if (powerSwitch.visible && ndcDistToObject(powerSwitch, 0.08) < 0.22) {
      dragMode = 'power';
      powerSwitch.userData.swPivot.rotation.z = -0.55;
      sound.powerUp();
      setTimeout(() => {
        if (sim.phase === 'build') enterPhase('tidy_intro');
      }, 420);
      return;
    }

    // 2. Tool pickup / toggle (Ratchet Wrench or Polishing Buffer)
    if (ndcDistToObject(tools.ratchet, 0.02) < 0.18) {
      sim.activeTool = sim.activeTool === 'ratchet' ? 'hand' : 'ratchet';
      sound.metalClink(0.45, 0.3);
      dragMode = 'screw';
      return;
    }
    if (ndcDistToObject(tools.buffer, 0.02) < 0.18) {
      sim.activeTool = sim.activeTool === 'buffer' ? 'hand' : 'buffer';
      sound.polishBrush(0.6);
      dragMode = 'polish';
      return;
    }

    // 3. Chest Color Prism Dial check (if torso attached!)
    if (sim.selected.torso !== null) {
      const torsoMesh = partPools.torso[sim.selected.torso];
      if (
        torsoMesh.userData.prismDial &&
        ndcDistToObject(torsoMesh.userData.prismDial, 0) < 0.16
      ) {
        dragMode = 'prism';
        sim.useCustomHue = false;
        sim.lampHueIdx = (sim.lampHueIdx + 1) % LAMP_PALETTE.length;
        torsoMesh.userData.prismDial.rotation.z += 0.8;
        updateRobotLampColors(1.2);
        sound.happySparkle();
        return;
      }
    }

    // 4. Joint Screws check (generous hitbox so 5yo can easily turn screws!)
    for (const [slot, sc] of Object.entries(jointScrews)) {
      if (sc.visible && ndcDistToObject(sc, 0.02) < 0.17) {
        dragMode = 'screw';
        dragCat = slot;
        sim.torque[slot] = Math.min(1.0, sim.torque[slot] + (sim.activeTool === 'ratchet' ? 0.26 : 0.18));
        updateJointScrewVisual(slot);
        sound.ratchetTick(sim.torque[slot]);
        syncGirlExpression('focused', 1.1);
        return;
      }
    }

    // 5. Rack Parts check (Drag or Tap to attach/swap!)
    let bestPart = null;
    let bestCat = null;
    let bestVar = null;
    let bestD = 0.22;
    Object.entries(partPools).forEach(([cat, arr]) => {
      arr.forEach((mesh, idx) => {
        if (!mesh.visible || sim.selected[cat] === idx) return;
        const d = ndcDistToObject(mesh, 0.04);
        if (d < bestD) {
          bestD = d;
          bestPart = mesh;
          bestCat = cat;
          bestVar = idx;
        }
      });
    });

    if (bestPart) {
      dragMode = 'part';
      draggedObj = bestPart;
      dragCat = bestCat;
      dragVariant = bestVar;
      sim.activeTool = 'hand';
      sound.metalClink(0.5, bestVar * 0.2);
      return;
    }

    // 6. Rubbing/Touching assembled robot directly -> polishes metal or spins stand!
    if (ndcDistToObject(robotRoot, 0.35) < 0.28) {
      if (sim.activeTool === 'buffer') {
        dragMode = 'polish';
      } else {
        dragMode = 'robotSpin';
      }
      return;
    }
  }

  // ---------------- SCENE 2: MALFUNCTION & BIG RESET BUTTON ----------------
  if (sim.phase === 'malfunction') {
    // Big Red Reset Button on robot chest (huge forgiving hitbox around wobbling robot!)
    if (ndcDistToObject(robotRoot, 0.32) < 0.44) {
      dragMode = 'resetBtn';
      pressRepairButton(0.52);
      return;
    }
    // Rescuing Dad's spilled silver tin canister!
    if (!sim.dadTinRescued && ndcDistToObject(floorProps.dadTin, 0.05) < 0.24) {
      sim.dadTinRescued = true;
      floorProps.dadTin.position.set(0.72, 0.01, 1.85);
      floorProps.dadTin.rotation.set(0, 0, 0);
      dad.userData.setState('warm', 2.5);
      sound.metalClink(0.6);
      return;
    }
  }

  // ---------------- SCENE 2A & SCENE 3A: TIDYING ITEMS ----------------
  if (sim.phase === 'tidy_intro' || sim.phase === 'cleanup' || sim.phase === 'dance') {
    // In Dance Free-Play: check 4 Rhythm Dance Pads first!
    if (sim.phase === 'dance') {
      for (const pad of floorProps.dancePads) {
        if (ndcDistToObject(pad, 0.02) < 0.17) {
          sim.danceStyle = pad.userData.styleIndex;
          pad.userData.pressAnim = 1.0;
          floorProps.dancePads.forEach((p, idx) => {
            p.userData.glowMat.emissiveIntensity = idx === sim.danceStyle ? 1.8 : 0.4;
          });
          sim.lampHueIdx = (sim.danceStyle + 1) % LAMP_PALETTE.length;
          sim.useCustomHue = false;
          updateRobotLampColors(1.25);
          sound.happySparkle();
          return;
        }
      }

      // Optional Replay Crate in background (double-tap within 1.2s builds a fresh robot!)
      if (replayCrate.visible && ndcDistToObject(replayCrate, 0.05) < 0.16) {
        const now = performance.now();
        if (now - sim.replayTapTime < 1200) {
          resetForNewRobotBuild();
          return;
        }
        sim.replayTapTime = now;
        replayCrate.rotation.z = 0.15;
        sound.woodTap(1.2);
        return;
      }
    }

    // Check scattered floor items to grab with Big Hand!
    let bestItem = null;
    let bestDist = 0.22;
    for (const it of floorProps.items) {
      if (!it.visible || it.userData.inBasket || sim.robotCarryItem === it) continue;
      const d = ndcDistToObject(it, 0.02);
      if (d < bestDist) {
        bestDist = d;
        bestItem = it;
      }
    }
    if (bestItem) {
      dragMode = 'item';
      draggedObj = bestItem;
      bestItem.userData.vel.set(0, 0, 0);
      if (bestItem.userData.isMetal) sound.metalClink(0.35);
      else sound.woodTap(1.0);
      return;
    }

    // In Dance phase: tapping the filled silver basket pops 3 items back out onto the floor for endless free play!
    if (sim.phase === 'dance' && ndcDistToObject(floorProps.basket, 0.16) < 0.25) {
      let popped = 0;
      for (const it of floorProps.items) {
        if (it.userData.inBasket && popped < 3) {
          it.userData.inBasket = false;
          it.visible = true;
          it.position.set(-0.55 + popped * 0.25, 0.38, 2.48);
          it.userData.vel.set(0.45 + Math.random() * 0.6, 1.3, (Math.random() - 0.5) * 0.6);
          popped++;
        }
      }
      if (popped > 0) sound.metalClink(0.5);
      return;
    }

    // Touching Robot directly in Cleanup or Dance -> spin/high-five/lamp color shift!
    if (ndcDistToObject(robotRoot, 0.32) < 0.28) {
      dragMode = 'robotSpin';
      sim.lampHueIdx = (sim.lampHueIdx + 1) % LAMP_PALETTE.length;
      updateRobotLampColors(1.3);
      sound.metalClink(0.4, 0.4);
      syncGirlExpression('delighted', 1.4);
      return;
    }

    // Touching Dad directly -> warm wave / laugh!
    if (ndcDistToObject(dad, 0.05) < 0.24) {
      dad.userData.setState('laugh', 1.6);
      sound.happySparkle();
      return;
    }
  }
}

function onPointerMove(e) {
  if (activePointerId !== null && e.pointerId !== activePointerId) return;
  updatePointerRay(e.clientX, e.clientY);
  if (!isPointerDown) return;

  sim.idleTime = 0;
  const dx = pointerNDC.x - lastPointerNDC.x;
  const dy = pointerNDC.y - lastPointerNDC.y;
  const moveDist = Math.hypot(dx, dy);

  if (dragMode === 'visorAdjust') {
    sim.visorTilt = Math.max(-0.8, Math.min(0.8, sim.visorTilt - dy * 2.4));
    syncCharacterOutfits();
  } else if (dragMode === 'tape' && moveDist > 0.025) {
    advanceUnboxing(moveDist * 1.65);
  } else if (dragMode === 'part' && draggedObj) {
    draggedObj.position.set(
      THREE.MathUtils.clamp(hitWorld.x, -1.15, 1.15),
      1.26,
      THREE.MathUtils.clamp(hitWorld.z, -0.58, 0.58)
    );
    draggedObj.rotation.y += dx * 2.5;
  } else if (dragMode === 'screw') {
    // Turning or rubbing over ANY visible joint screw tightens it continuously!
    for (const [slot, sc] of Object.entries(jointScrews)) {
      if (sc.visible && ndcDistToObject(sc, 0.02) < 0.22 && moveDist > 0.012) {
        const prevStep = Math.floor(sim.torque[slot] * 10);
        sim.torque[slot] = Math.min(
          1.0,
          sim.torque[slot] + moveDist * (sim.activeTool === 'ratchet' ? 2.2 : 1.35)
        );
        updateJointScrewVisual(slot);
        if (Math.floor(sim.torque[slot] * 10) > prevStep) {
          sound.ratchetTick(sim.torque[slot]);
        }
        dragCat = slot;
        syncGirlExpression('focused', 0.8);
      }
    }
  } else if (dragMode === 'polish' || (dragMode === 'robotSpin' && sim.phase === 'build')) {
    if (moveDist > 0.015) {
      if (sim.activeTool === 'buffer' || dragMode === 'polish') {
        Object.keys(sim.selected).forEach((cat) => applyPartPolish(cat, moveDist * 0.85));
        if (Math.random() < 0.25) sound.polishBrush(0.7);
      } else {
        robotRoot.rotation.y += dx * 4.2;
        Object.keys(sim.selected).forEach((cat) => applyPartPolish(cat, moveDist * 0.35));
      }
    }
  } else if (dragMode === 'prism') {
    sim.useCustomHue = true;
    sim.lampCustomHue = (sim.lampCustomHue + dx * 0.8 + 1.0) % 1.0;
    updateRobotLampColors(1.2);
  } else if (dragMode === 'item' && draggedObj) {
    draggedObj.position.set(
      THREE.MathUtils.clamp(hitWorld.x, -1.25, 1.25),
      0.32,
      THREE.MathUtils.clamp(hitWorld.z, 1.55, 3.15)
    );
    draggedObj.rotation.y += dx * 3.0;
    draggedObj.rotation.x += dy * 3.0;
  } else if (dragMode === 'robotSpin') {
    sim.manualSpinVel = THREE.MathUtils.clamp(sim.manualSpinVel + dx * 18.0, -14, 14);
  }

  lastPointerNDC.copy(pointerNDC);
}

function onPointerUp(e) {
  if (activePointerId !== null && e.pointerId !== activePointerId) return;

  if (dragMode === 'part' && draggedObj && dragCat) {
    // Check if handed to Dad ("違う物を渡すと相手は「あれ？」の顔→喜ぶ")!
    if (ndcDistToObject(dad, 0.05) < 0.28) {
      dad.userData.triggerHuhThenHappy();
      syncGirlExpression('huh', 0.75);
      sound.huhSound();
      setTimeout(() => {
        syncGirlExpression('delighted', 1.4);
        sound.happySparkle();
      }, 780);
      // Return part to its rack slot
      draggedObj.position.copy(rackLayout[dragCat][dragVariant]);
      draggedObj.rotation.set(0, 0, 0);
    } else {
      // Generous snap: either dropped near robot stand OR tapped cleanly on the rack!
      attachRobotPart(dragCat, dragVariant);
    }
  } else if (dragMode === 'item' && draggedObj) {
    const item = draggedObj;
    // 1. Handed to Dad? -> Dad makes "あれ？" face -> laughs & tosses into basket!
    if (ndcDistToObject(dad, 0.05) < 0.26) {
      dad.userData.triggerHuhThenHappy();
      syncGirlExpression('huh', 0.75);
      sound.huhSound();
      item.position.set(dad.position.x - 0.1, dad.position.y - 0.05, dad.position.z + 0.28);
      setTimeout(() => {
        sound.happySparkle();
        syncGirlExpression('delighted', 1.5);
        placeItemIntoBasket(item);
      }, 800);
    }
    // 2. Placed on Robot's Head? -> Robot tilts head "あれ？" -> balances & flips into basket!
    else if (ndcDistToObject(robotRoot, 0.52) < 0.22 && item.position.y > 0.22) {
      sim.robotHeadHatItem = item;
      sim.robotHeadHatTimer = 1.15;
      syncGirlExpression('huh', 0.65);
      sound.huhSound();
      setTimeout(() => {
        sound.happySparkle();
        syncGirlExpression('delighted', 1.4);
      }, 650);
    }
    // 3. Dropped near Brushed-Steel Basket (generous magnetic catch!)
    else if (
      Math.hypot(
        item.position.x - floorProps.basket.position.x,
        item.position.z - floorProps.basket.position.z
      ) < 0.56
    ) {
      placeItemIntoBasket(item);
    } else {
      // Release with gentle flick velocity on floor!
      item.userData.vel.set(
        (pointerNDC.x - lastPointerNDC.x) * 6.0,
        0.4,
        -(pointerNDC.y - lastPointerNDC.y) * 6.0
      );
    }
  }

  isPointerDown = false;
  activePointerId = null;
  dragMode = null;
  draggedObj = null;
  dragCat = null;
  dragVariant = null;
}

renderer.domElement.addEventListener('pointerdown', onPointerDown);
window.addEventListener('pointermove', onPointerMove);
window.addEventListener('pointerup', onPointerUp);
window.addEventListener('pointercancel', onPointerUp);

// ============================================================================
// SIMULATION HELPERS (Unboxing, Repair Button, Basket Stacking, Reset)
// ============================================================================
function advanceUnboxing(delta) {
  if (sim.tapeProgress < 1.0) {
    const prevSeg = Math.floor(sim.tapeProgress * 8);
    sim.tapeProgress = Math.min(1.0, sim.tapeProgress + delta);
    const curSeg = Math.floor(sim.tapeProgress * 8);
    if (curSeg > prevSeg) sound.tapeRip(sim.tapeProgress);

    parcelBox.userData.tapeSegments.forEach((seg, idx) => {
      const thresh = (idx + 1) / 8;
      if (sim.tapeProgress >= thresh) {
        seg.visible = false;
      } else if (idx === curSeg) {
        seg.position.y = 0.03;
        seg.rotation.z = 0.45;
      }
    });
    parcelBox.userData.pullTab.position.x = -0.46 + sim.tapeProgress * 0.92;
  } else {
    sim.flapProgress = Math.min(1.0, sim.flapProgress + delta * 1.15);
    sound.tapeRip(0.8);
    if (sim.flapProgress >= 0.98) {
      enterPhase('build');
    }
  }
}

function pressRepairButton(delta) {
  if (sim.phase !== 'malfunction') return;
  const prevStage = Math.floor(sim.repairProgress * 3);
  sim.repairProgress = Math.min(1.0, sim.repairProgress + delta);
  const nextStage = Math.floor(sim.repairProgress * 3);

  if (sim.selected.torso !== null) {
    const rb = partPools.torso[sim.selected.torso].userData.resetBtn;
    if (rb) rb.userData.btnCap.position.z = 0.002;
  }

  if (sim.repairProgress >= 1.0) {
    sound.bigButtonClick(3, true);
    enterPhase('cleanup');
  } else if (nextStage > prevStage) {
    sound.bigButtonClick(nextStage, false);
  }
}

function placeItemIntoBasket(item) {
  if (item.userData.inBasket) return;
  item.userData.inBasket = true;
  item.userData.vel.set(0, 0, 0);

  // Stack items physically in layers inside the brushed-steel wire basket!
  const countIn = floorProps.items.filter((x) => x.userData.inBasket).length - 1;
  const layer = Math.floor(countIn / 5);
  const slotInLayer = countIn % 5;
  const ang = (slotInLayer / 5) * Math.PI * 2 + layer * 0.7;
  const r = slotInLayer === 4 ? 0.0 : 0.13;

  item.position.set(
    floorProps.basket.position.x + Math.cos(ang) * r,
    floorProps.basket.position.y + 0.08 + layer * 0.085,
    floorProps.basket.position.z + Math.sin(ang) * r
  );
  item.visible = true;

  if (item.userData.isMetal) sound.metalClink(0.45, countIn * 0.1);
  else sound.woodTap(1.05 + countIn * 0.03);

  syncGirlExpression('delighted', 0.9);

  // Check if floor is completely tidied during Scene 3A!
  if (sim.phase === 'cleanup') {
    const remaining = floorProps.items.filter((x) => x.visible && !x.userData.inBasket);
    if (remaining.length === 0) {
      setTimeout(() => {
        if (sim.phase === 'cleanup') enterPhase('dance');
      }, 450);
    }
  }
}

function resetForNewRobotBuild() {
  // Cleanly return to Scene 1 Parcel Box while keeping Girl's chosen outfit!
  floorProps.basket.visible = false;
  floorProps.dadTin.visible = false;
  floorProps.items.forEach((it) => {
    it.visible = false;
    it.userData.inBasket = false;
  });
  floorProps.dancePads.forEach((p) => (p.visible = false));
  replayCrate.visible = false;

  Object.entries(sim.selected).forEach(([cat, v]) => {
    if (v !== null) {
      const m = partPools[cat][v];
      scene.add(m);
      m.visible = false;
      sim.selected[cat] = null;
    }
    jointScrews[cat].visible = false;
    sim.torque[cat] = 0.25;
    sim.polish[cat] = 0.25;
  });

  sim.tapeProgress = 0;
  sim.flapProgress = 0;
  sim.dadGoofTriggered = false;
  sim.dadTinDropped = false;
  sim.dadTinRescued = false;
  parcelBox.visible = true;
  parcelBox.userData.tapeSegments.forEach((s, idx) => {
    s.visible = true;
    s.position.y = 0;
    s.rotation.z = 0;
  });
  parcelBox.userData.pullTab.position.x = -0.46;
  Object.values(parcelBox.userData.flaps).forEach((f) => {
    f.rotation.set(0, 0, 0);
  });

  powerSwitch.userData.swPivot.rotation.z = 0.52;
  enterPhase('unbox');
}

// ============================================================================
// MAIN REALTIME SIMULATION & ANIMATION LOOP
// ============================================================================
const clock = new THREE.Clock();
let elapsedTotal = 0;

function stepSimulation(dt) {
  elapsedTotal += dt;
  sim.phaseTime += dt;
  sim.idleTime += dt;

  // 1. Smooth Responsive Camera Interpolation (Player never drags camera!)
  computeCameraGoals();
  camCurrPos.lerp(camGoalPos, Math.min(1, dt * 5.2));
  camCurrLook.lerp(camGoalLook, Math.min(1, dt * 5.8));
  camera.position.copy(camCurrPos);
  camera.lookAt(camCurrLook);

  // Subtle organic sway of single overhead pendant lamp
  env.pendantGroup.rotation.z = Math.sin(elapsedTotal * 0.75) * 0.016;
  ruleBoardTiltBoost = Math.max(0, ruleBoardTiltBoost - dt * 2.2);
  env.ruleBoard.scale.setScalar(1.0 + Math.sin(ruleBoardTiltBoost * Math.PI) * 0.14);

  // Decay any tapped loose bench screw bounce
  env.clutterItems.forEach((cl) => {
    if (cl.position.y > 1.055) {
      cl.position.y = Math.max(1.038, cl.position.y - dt * 0.18);
    }
  });

  // 2. Scene 0 Dress-Up: Once an outfit is chosen, gently bring Parcel Box forward (above sleeve!) to invite unboxing!
  if (sim.phase === 'dressup') {
    parcelBox.rotation.z *= 0.88;
    if (sim.dressedCount > 0) {
      parcelBox.position.lerp(new THREE.Vector3(0.64, 1.03, -0.02), Math.min(1, dt * 4));
      parcelBox.scale.lerp(new THREE.Vector3(0.68, 0.68, 0.68), Math.min(1, dt * 4));
    }
    if (sim.autoAdvanceTimer > 0) {
      sim.autoAdvanceTimer -= dt;
      if (sim.autoAdvanceTimer <= 0 && sim.phase === 'dressup') {
        enterPhase('unbox');
      }
    }
    // Subtle idle breathing on outfit pads after 10s of zero input (Wordless §4: 0-6s nothing, 10s+ subtle environment nudge)
    if (sim.idleTime > 10.0) {
      const pulse = Math.sin((sim.idleTime - 10.0) * 3.2) * 0.015;
      dressTray.userData.items[0].position.y = 0.035 + Math.max(0, pulse);
    }
  }

  // 3. Scene 1A Unboxing Flap Animation
  if (sim.phase === 'unbox') {
    if (sim.tapeProgress >= 1.0 && sim.flapProgress < 1.0) {
      // Once tape is torn, flaps smoothly blossom open even on a light pull!
      sim.flapProgress = Math.min(1.0, sim.flapProgress + dt * 1.6);
      if (sim.flapProgress >= 0.99) enterPhase('build');
    }
    const fl = parcelBox.userData.flaps;
    const ang = sim.flapProgress * Math.PI * 0.68;
    fl.left.rotation.z = ang;
    fl.right.rotation.z = -ang;
    fl.front.rotation.x = ang;
    fl.back.rotation.x = -ang;
  }

  // 4. Scene 1B Build Phase: Continuous Screw Holding & Tool Visuals
  if (sim.phase === 'build') {
    if (isPointerDown && dragMode === 'screw' && dragCat) {
      const prevStep = Math.floor(sim.torque[dragCat] * 12);
      sim.torque[dragCat] = Math.min(1.0, sim.torque[dragCat] + dt * 0.85);
      updateJointScrewVisual(dragCat);
      if (Math.floor(sim.torque[dragCat] * 12) > prevStep) {
        sound.ratchetTick(sim.torque[dragCat]);
      }
    }
    if (powerSwitch.visible) {
      powerSwitch.userData.swKnobMat.emissiveIntensity =
        1.5 + Math.sin(elapsedTotal * 5.0) * 0.65;
    }
    // Gently highlight equipped tool on bench
    tools.ratchet.position.y = sim.activeTool === 'ratchet' ? 1.11 : 1.048;
    tools.buffer.position.y = sim.activeTool === 'buffer' ? 1.08 : 1.018;
  }

  // 5. Scene 2A -> Dad's Guaranteed Blunder Trigger!
  if (sim.phase === 'tidy_intro') {
    // Robot walks toward first wooden block and helps tidy it before Dad accidentally spills the tin!
    const targetBlock = floorProps.items[0];
    if (targetBlock && !targetBlock.userData.inBasket) {
      const dx = targetBlock.position.x - sim.robotPos.x;
      const dz = targetBlock.position.z - sim.robotPos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.14) {
        sim.robotPos.x += (dx / dist) * dt * 0.48;
        sim.robotPos.z += (dz / dist) * dt * 0.48;
        sim.robotRotY = Math.atan2(dx, dz);
      } else {
        placeItemIntoBasket(targetBlock);
      }
    }
    // Dad eagerly leans forward with the heavy silver tin... and at 2.8s drops it!
    floorProps.dadTin.position.x = 0.46 - sim.phaseTime * 0.11;
    floorProps.dadTin.position.z = 1.95 + sim.phaseTime * 0.12;
    floorProps.dadTin.rotation.z = sim.phaseTime * 0.25;
    if (sim.phaseTime >= 2.75 && !sim.dadGoofTriggered) {
      enterPhase('malfunction');
    }
  }

  // 6. Scene 2B Malfunction Simulation (Red Fault Lamp + Dizzy Spin + Hold-to-Fix Button)
  if (sim.phase === 'malfunction') {
    if (isPointerDown && dragMode === 'resetBtn') {
      pressRepairButton(dt * 1.15);
    } else if (sim.selected.torso !== null) {
      const rb = partPools.torso[sim.selected.torso].userData.resetBtn;
      if (rb) rb.userData.btnCap.position.z = 0.016;
    }

    // Dizzy spin slows down proportionally as daughter presses the repair button!
    const spinFactor = 1.0 - sim.repairProgress * 0.85;
    sim.robotRotY += dt * 5.8 * spinFactor;
    sim.robotPos.x = Math.sin(sim.phaseTime * 2.3) * 0.34 * spinFactor;
    sim.robotPos.z = 2.38 + Math.cos(sim.phaseTime * 1.9) * 0.22 * spinFactor;

    const sirenPulse = 0.65 + 0.55 * Math.sin(elapsedTotal * 12.0);
    updateRobotLampColors(sirenPulse);
    robotLampLight.intensity = 3.2 + sirenPulse * 2.2;

    sim.faultBeepTimer += dt;
    if (sim.faultBeepTimer > 0.65) {
      sim.faultBeepTimer = 0;
      sound.faultPulse();
    }
  }

  // 7. Physical Rigid-Body Bounce & Floor Collisions for All 16 Cleanup Objects!
  if (sim.phase === 'malfunction' || sim.phase === 'cleanup' || sim.phase === 'dance') {
    for (const it of floorProps.items) {
      if (
        !it.visible ||
        it.userData.inBasket ||
        it === draggedObj ||
        it === sim.robotCarryItem ||
        it === sim.robotHeadHatItem
      ) {
        continue;
      }
      const v = it.userData.vel;
      if (v.lengthSq() > 0.0001 || it.position.y > it.userData.radius + 0.016) {
        v.y -= 6.8 * dt; // Gravity
        it.position.addScaledVector(v, dt);
        it.rotation.x += it.userData.angVel.x * dt;
        it.rotation.y += it.userData.angVel.y * dt;

        const floorY = it.userData.radius + 0.015;
        if (it.position.y < floorY) {
          it.position.y = floorY;
          if (Math.abs(v.y) > 0.45) {
            if (it.userData.isMetal) sound.metalClink(0.2);
            else sound.woodTap(0.95);
          }
          v.y = -v.y * 0.42;
          v.x *= 0.82;
          v.z *= 0.82;
          it.userData.angVel.multiplyScalar(0.75);
        }

        // Keep items inside visible rug play arena so none roll offscreen!
        if (it.position.x < -1.08 || it.position.x > 1.08) {
          it.position.x = THREE.MathUtils.clamp(it.position.x, -1.08, 1.08);
          v.x *= -0.6;
        }
        if (it.position.z < 1.82 || it.position.z > 2.98) {
          it.position.z = THREE.MathUtils.clamp(it.position.z, 1.82, 2.98);
          v.z *= -0.6;
        }
      }
    }
  }

  // 8. Robot Head-Hat Playful Balance ("あれ？" -> Joy -> Toss into Basket!)
  if (sim.robotHeadHatItem) {
    sim.robotHeadHatTimer -= dt;
    sim.robotHeadHatItem.position.set(
      robotRoot.position.x,
      robotRoot.position.y + 0.96,
      robotRoot.position.z
    );
    sim.robotHeadHatItem.rotation.y += dt * 4.0;
    if (sim.robotHeadHatTimer <= 0) {
      placeItemIntoBasket(sim.robotHeadHatItem);
      sim.robotHeadHatItem = null;
    }
  }

  // 9. Scene 3A Co-op Robot Autonomous Tidying!
  if (sim.phase === 'cleanup' || (sim.phase === 'dance' && !sim.robotHeadHatItem)) {
    const looseItems = floorProps.items.filter(
      (x) => x.visible && !x.userData.inBasket && x !== draggedObj && x !== sim.robotHeadHatItem
    );

    if (sim.phase === 'cleanup' && looseItems.length > 0) {
      if (!sim.robotCarryItem || sim.robotCarryItem.userData.inBasket || sim.robotCarryItem === draggedObj) {
        // Pick an item on the opposite side from the player's hand so you cooperate naturally!
        sim.robotCarryItem = looseItems[looseItems.length - 1];
      }
      const target = sim.robotCarryItem;
      const carryingDist = Math.hypot(
        target.position.x - sim.robotPos.x,
        target.position.z - sim.robotPos.z
      );
      if (carryingDist > 0.18 && target.position.y < 0.22) {
        // Walk toward item
        const dx = target.position.x - sim.robotPos.x;
        const dz = target.position.z - sim.robotPos.z;
        const spd = sim.selected.legs === 1 ? 0.85 : 0.68;
        sim.robotPos.x += (dx / carryingDist) * dt * spd;
        sim.robotPos.z += (dz / carryingDist) * dt * spd;
        sim.robotRotY = Math.atan2(dx, dz);
      } else {
        // Carry item in robot's arms toward the Brushed-Steel Basket!
        const bx = floorProps.basket.position.x + 0.28;
        const bz = floorProps.basket.position.z;
        const bDist = Math.hypot(bx - sim.robotPos.x, bz - sim.robotPos.z);
        target.position.set(
          sim.robotPos.x + Math.sin(sim.robotRotY) * 0.24,
          0.34,
          sim.robotPos.z + Math.cos(sim.robotRotY) * 0.24
        );
        if (bDist > 0.16) {
          const spd = sim.selected.legs === 1 ? 0.92 : 0.74;
          sim.robotPos.x += ((bx - sim.robotPos.x) / bDist) * dt * spd;
          sim.robotPos.z += ((bz - sim.robotPos.z) / bDist) * dt * spd;
          sim.robotRotY = Math.atan2(bx - sim.robotPos.x, bz - sim.robotPos.z);
        } else {
          placeItemIntoBasket(target);
          sim.robotCarryItem = null;
        }
      }
    }
  }

  // 10. Scene 3B Free-Play Robot Dance Choreography + Rhythm Pads!
  if (sim.phase === 'dance') {
    replayCrate.rotation.z *= 0.88;
    sound.updateDanceMusic(dt, sim.danceStyle);

    // Smoothly raise the 4 chrome rhythm pads onto the front rug edge
    floorProps.dancePads.forEach((pad) => {
      pad.userData.pressAnim = Math.max(0, pad.userData.pressAnim - dt * 4.5);
      const targetY = 0.012 - pad.userData.pressAnim * 0.015;
      pad.position.y += (targetY - pad.position.y) * Math.min(1, dt * 8);
    });

    sim.manualSpinVel *= Math.pow(0.25, dt);
    const beat = elapsedTotal * (sim.danceStyle === 1 ? 9.5 : 7.5);

    if (sim.danceStyle === 0) {
      // Style 0: Joyful Spring Hop & Side-to-Side Groove
      sim.robotPos.x = Math.sin(beat * 0.5) * 0.26;
      sim.robotPos.y = 0.015 + Math.abs(Math.sin(beat)) * 0.11;
      sim.robotRotY = Math.sin(beat * 0.5) * 0.45 + sim.manualSpinVel * dt * 8;
    } else if (sim.danceStyle === 1) {
      // Style 1: Gyro Breakdance Spin!
      sim.robotRotY += dt * 4.8 + sim.manualSpinVel * dt;
      sim.robotPos.y = 0.015 + Math.abs(Math.cos(beat)) * 0.06;
    } else if (sim.danceStyle === 2) {
      // Style 2: Moonwalk Glide & Mechanical Wave
      sim.robotPos.x = Math.sin(beat * 0.35) * 0.42;
      sim.robotPos.y = 0.015;
      sim.robotRotY = Math.cos(beat * 0.35) * 0.35;
    } else {
      // Style 3: Grand Starburst Jump & Color Shimmer!
      sim.robotPos.y = 0.015 + Math.pow(Math.abs(Math.sin(beat * 0.8)), 2) * 0.16;
      sim.robotRotY = Math.sin(beat * 0.4) * 0.65;
      const rainbowCol = new THREE.Color().setHSL((elapsedTotal * 0.35) % 1.0, 0.88, 0.62);
      robotLampLight.color.copy(rainbowCol);
    }
  }

  // 11. Apply Robot Position, Screw-Torque Posture, & Part-Specific Mechanical Sub-Animations!
  if (sim.phase === 'tidy_intro' || sim.phase === 'malfunction' || sim.phase === 'cleanup' || sim.phase === 'dance') {
    robotRoot.position.copy(sim.robotPos);
    robotRoot.rotation.y = sim.robotRotY + sim.manualSpinVel * 0.05;
  }

  // Joint stiffness / jaunty tilt directly reflects continuous `sim.torque` from Scene 1!
  const looseHead = 1.0 - sim.torque.head;
  const looseArmL = 1.0 - sim.torque.armL;
  const looseArmR = 1.0 - sim.torque.armR;
  const movePhase = elapsedTotal * (sim.phase === 'dance' ? 9.0 : 6.0);
  const isMoving =
    sim.phase === 'tidy_intro' ||
    sim.phase === 'malfunction' ||
    sim.phase === 'cleanup' ||
    sim.phase === 'dance';

  robotSlots.head.rotation.z =
    looseHead * 0.22 + (isMoving ? Math.sin(movePhase) * (0.06 + looseHead * 0.12) : 0);
  robotSlots.head.rotation.y = sim.robotHeadHatItem
    ? Math.sin(elapsedTotal * 10) * 0.22
    : Math.sin(elapsedTotal * 1.8) * 0.12;

  if (sim.phase === 'dance') {
    robotSlots.armL.rotation.z = -0.85 + Math.sin(movePhase) * (0.45 + looseArmL * 0.25);
    robotSlots.armR.rotation.z = 0.85 - Math.cos(movePhase) * (0.45 + looseArmR * 0.25);
    robotSlots.armL.rotation.x = -0.35 + Math.cos(movePhase * 0.5) * 0.35;
    robotSlots.armR.rotation.x = -0.35 - Math.cos(movePhase * 0.5) * 0.35;
  } else if (isMoving) {
    robotSlots.armL.rotation.x = Math.sin(movePhase) * (0.35 + looseArmL * 0.25);
    robotSlots.armR.rotation.x = -Math.sin(movePhase) * (0.35 + looseArmR * 0.25);
    robotSlots.armL.rotation.z = -looseArmL * 0.18;
    robotSlots.armR.rotation.z = looseArmR * 0.18;
  }

  // Animate internal gears, radar dishes, rollers, wheels, spring feet & spider struts!
  if (sim.selected.torso !== null) {
    const tm = partPools.torso[sim.selected.torso];
    if (tm.userData.spinGear) tm.userData.spinGear.rotation.y += dt * (isMoving ? 4.5 : 1.2);
  }
  if (sim.selected.head !== null) {
    const hm = partPools.head[sim.selected.head];
    if (hm.userData.spinTop) hm.userData.spinTop.rotation.y += dt * (isMoving ? 5.2 : 1.8);
  }
  ['armL', 'armR'].forEach((ac) => {
    if (sim.selected[ac] !== null) {
      const am = partPools[ac][sim.selected[ac]];
      if (am.userData.rollerSpin && isMoving) {
        am.userData.rollerSpin.rotation.y += dt * 9.0;
      }
      if (am.userData.jaws) {
        const pinch = sim.robotCarryItem ? 0.08 : 0.22 + Math.sin(elapsedTotal * 4) * 0.06;
        am.userData.jaws[0].rotation.z = pinch;
        am.userData.jaws[1].rotation.z = -pinch;
      }
    }
  });
  if (sim.selected.legs !== null && isMoving) {
    const lm = partPools.legs[sim.selected.legs];
    if (lm.userData.feet) {
      lm.userData.feet[0].position.y = Math.max(0, Math.sin(movePhase)) * 0.065;
      lm.userData.feet[1].position.y = Math.max(0, -Math.sin(movePhase)) * 0.065;
    }
    if (lm.userData.wheels) {
      lm.userData.wheels.forEach((w) => (w.rotation.x += dt * 7.5));
    }
    if (lm.userData.struts) {
      lm.userData.struts.forEach((s, idx) => {
        s.rotation.z = Math.sin(movePhase + idx * Math.PI * 0.5) * 0.18;
      });
    }
  }

  // Update Robot's Colored Lamp PointLight Position in World Space
  robotRoot.getWorldPosition(_worldTmp);
  robotLampLight.position.set(_worldTmp.x, _worldTmp.y + 0.52, _worldTmp.z + 0.32);

  // 12. Update Characters & First-Person Big Child's Hand POV!
  girl.userData.update(dt, elapsedTotal);
  mirrorGirl.userData.update(dt, elapsedTotal);
  dad.userData.update(dt, elapsedTotal);

  // Position First-Person Big Hand naturally from lower-right camera space toward active touch point!
  const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  const camUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
  const camFwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);

  let handGoal = new THREE.Vector3();
  if (isPointerDown) {
    handGoal
      .copy(hitWorld)
      .addScaledVector(camRight, 0.08)
      .addScaledVector(camUp, 0.04)
      .addScaledVector(camFwd, -0.14);
  } else if (sim.idleTime > 10.5 && !sim.idleHintShownForPhase) {
    // Wordless §4 & Summary §誘導: Only when idle > 10s, demonstrate ONCE gently with the child's own hand!
    const demoT = sim.idleTime - 10.5;
    if (demoT < 2.2) {
      const targetDemo =
        sim.phase === 'dressup'
          ? dressTray.position
          : sim.phase === 'unbox'
          ? parcelBox.position
          : sim.phase === 'malfunction'
          ? robotRoot.position
          : robotRoot.position;
      handGoal
        .copy(targetDemo)
        .add(new THREE.Vector3(Math.sin(demoT * 3.0) * 0.14, 0.22, 0.24));
    } else {
      sim.idleHintShownForPhase = true;
    }
  }

  if (!isPointerDown && (sim.idleTime <= 10.5 || sim.idleHintShownForPhase)) {
    // Rest naturally in lower-right foreground POV so all 5 fingers, knuckles, cuff & silver parts are clearly visible!
    handGoal
      .copy(camera.position)
      .addScaledVector(camFwd, 0.86)
      .addScaledVector(camRight, 0.22 + Math.sin(elapsedTotal * 1.3) * 0.012)
      .addScaledVector(camUp, -0.175 + Math.cos(elapsedTotal * 1.6) * 0.01);
  }

  fpHand.position.lerp(handGoal, Math.min(1, dt * (isPointerDown ? 18 : 7)));
  // Orient dorsal right hand naturally reaching into the workbench/floor scene!
  fpHand.quaternion.copy(camera.quaternion);
  fpHand.rotateY(0.1);
  fpHand.rotateX(-0.04);
  fpHand.rotateZ(-0.16);

  if (dragMode === 'screw') {
    fpHand.userData.setPose('pinch', 0.85, Math.sin(elapsedTotal * 16.0) * 0.42);
  } else if (dragMode === 'resetBtn' || dragMode === 'power') {
    fpHand.userData.setPose('poke', isPointerDown ? 1.0 : 0.0, 0);
  } else if (dragMode === 'polish') {
    fpHand.userData.setPose('rub', 0.6, Math.sin(elapsedTotal * 12.0) * 0.15);
  } else if (isPointerDown) {
    fpHand.userData.setPose('grab', 0.82, 0);
  } else if (sim.phase === 'dance') {
    fpHand.userData.setPose('idle', 0, Math.sin(elapsedTotal * 7.5) * 0.18);
  } else {
    fpHand.userData.setPose('idle', 0, 0);
  }

  renderer.info.reset();
  composer.render();
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());
  stepSimulation(dt);
}

// Expose minimal read-only telemetry hook for automated performance/state verification (zero UI!)
window.__gameState = {
  sim,
  enterPhase,
  attachRobotPart,
  step: (dt = 0.016, steps = 1) => {
    for (let i = 0; i < steps; i++) stepSimulation(dt);
  },
  captureJPEG: (w = 800, h = 600, q = 0.78) => {
    stepSimulation(0.016);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    ctx.drawImage(renderer.domElement, 0, 0, w, h);
    return c.toDataURL('image/jpeg', q);
  },
  getStats: () => ({
    triangles: renderer.info.render.triangles,
    calls: renderer.info.render.calls,
    textures: renderer.info.memory.textures,
    pixelRatio: renderer.getPixelRatio(),
    phase: sim.phase,
  }),
};

animate();
