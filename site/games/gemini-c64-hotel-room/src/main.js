import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { buildHotelEnvironment } from './textures.js';
import { sound } from './audio.js';
import { ExpressivePerson, DaughterHandCursor } from './characters.js';
import { buildHotelRoom, createMessyFabricItem, createHotelChocolate } from './roomScene.js';

const container = document.getElementById('app');

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: true
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.96;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe9e1d5);

const envMap = buildHotelEnvironment(renderer);
scene.environment = envMap;
scene.environmentIntensity = 0.54;

const camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.1, 28);

// Low Grazing Morning Sunlight streaming diagonally through the Right Window Mullions & Sheer Curtains!
const sunLight = new THREE.DirectionalLight(0xfff3de, 3.35);
sunLight.position.set(4.5, 2.38, 0.92);
sunLight.target.position.set(-0.25, 0.65, -0.08);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(1024, 1024);
sunLight.shadow.camera.near = 1.0;
sunLight.shadow.camera.far = 10.5;
sunLight.shadow.camera.left = -2.8;
sunLight.shadow.camera.right = 2.8;
sunLight.shadow.camera.top = 2.5;
sunLight.shadow.camera.bottom = -2.3;
sunLight.shadow.bias = -0.0004;
sunLight.shadow.normalBias = 0.016;
sunLight.shadow.radius = 2.8;
scene.add(sunLight);
scene.add(sunLight.target);

// Cool Morning Sky + Warm Oak Floor Bounce (kept moderate so linen folds retain rich sculpting!)
const hemiLight = new THREE.HemisphereLight(0xd8e6f8, 0xc29c74, 0.44);
scene.add(hemiLight);

const bounceLight = new THREE.DirectionalLight(0xffebd2, 0.24);
bounceLight.position.set(-2.6, 2.2, 2.8);
scene.add(bounceLight);

const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

let gtaoPass = null;
try {
  gtaoPass = new GTAOPass(scene, camera, window.innerWidth, window.innerHeight);
  gtaoPass.output = GTAOPass.OUTPUT.Default;
  gtaoPass.blendIntensity = 0.72;
  gtaoPass.updateGtaoMaterial({
    radius: 0.30,
    distanceExponent: 1.35,
    thickness: 0.72,
    scale: 1.05,
    samples: 14,
    distanceFallOff: 1.0,
    screenSpaceRadius: false
  });
  composer.addPass(gtaoPass);
} catch (e) {
  gtaoPass = null;
}
const outputPass = new OutputPass();
composer.addPass(outputPass);

// ============================================================================
// BUILD HOTEL ROOM, CHARACTERS & 3D HAND
// ============================================================================
const room = buildHotelRoom(scene);

// Full-body Daughter at Uniform Station in Scene 0
const daughter = new ExpressivePerson({
  role: 'girl',
  linenMaterial: room.materials.linen,
  skinWarmth: 0.01,
  upperBodyOnly: false
});
daughter.group.position.set(0, 0.0, 1.94);
scene.add(daughter.group);

// Dedicated Upper-Body Daughter Portrait cleanly framed inside the Walnut Wall Mirror (zero lower-body protrusion!)
const mirrorDaughter = new ExpressivePerson({
  role: 'girl',
  linenMaterial: room.materials.linen,
  skinWarmth: 0.01,
  upperBodyOnly: true
});
mirrorDaughter.group.scale.setScalar(0.76);
mirrorDaughter.group.position.set(0, -0.78, -0.03);
mirrorDaughter.group.visible = false;
room.mirrorFrameGroup.add(mirrorDaughter.group);

const handCursor = new DaughterHandCursor(room.materials.linen);
scene.add(handCursor.group);

const papaChar = new ExpressivePerson({ role: 'papa', linenMaterial: room.materials.linen, skinWarmth: 0.08 });
const mamaChar = new ExpressivePerson({ role: 'mama', linenMaterial: room.materials.linen, skinWarmth: 0.03 });
const grandmaGuest = new ExpressivePerson({ role: 'guestGrandma', linenMaterial: room.materials.linen, skinWarmth: 0.01 });
const gentGuest = new ExpressivePerson({ role: 'guestGentleman', linenMaterial: room.materials.linen, skinWarmth: 0.06 });

[papaChar, mamaChar, grandmaGuest, gentGuest].forEach((c) => {
  c.group.visible = false;
  scene.add(c.group);
});

const state = {
  phase: 'dressup',
  roomNumber: 1,
  uniformEquipped: { dress: false, apron: false, cap: false },
  chosenUniformHex: 0x5c4332,

  messyItems: [],
  tidiedCount: 0,
  blunderTriggered: false,
  blunderActive: false,
  familyHelper: papaChar,
  familyTargetPos: new THREE.Vector3(-1.46, 0, 0.16),

  chocolates: [],
  petals: [],
  swanSpawned: false,
  secondSwanSpawned: false,
  bellReady: false,

  activeGuest: mamaChar,
  guestTargetPos: new THREE.Vector3(-1.12, 0, 0.28),
  guestEntered: false,
  guestSitMode: false,
  doorAngle: 0,
  targetDoorAngle: 0,

  camPos: new THREE.Vector3(0, 1.24, 3.60),
  camLook: new THREE.Vector3(0, 0.68, 2.08),
  targetCamPos: new THREE.Vector3(0, 1.24, 3.60),
  targetCamLook: new THREE.Vector3(0, 0.68, 2.08),

  idleSeconds: 0,
  idleDemoShownThisPhase: false,
  demoAnim: null
};

function setBothDaughtersExpression(expr, duration = 2.0) {
  daughter.setExpression(expr, duration);
  mirrorDaughter.setExpression(expr, duration);
}

function updateCameraFramingTargets() {
  const aspect = window.innerWidth / Math.max(1, window.innerHeight);
  const isPortrait = aspect < 0.92;
  camera.fov = isPortrait ? 58 : 46;
  camera.aspect = aspect;
  camera.updateProjectionMatrix();

  const zPull = isPortrait ? 1.15 : 0.0;
  const yLift = isPortrait ? 0.32 : 0.0;

  if (state.phase === 'dressup') {
    state.targetCamPos.set(0, 1.22 + yLift * 0.35, 3.56 + zPull * 0.72);
    state.targetCamLook.set(0, 0.66, 2.05);
  } else if (state.phase === 'tidy') {
    // Wide cohesive hotel room view: headboard, board, mirror, door, Papa, baskets, bed & sunlit curtains all 100% visible!
    state.targetCamPos.set(0.0, 2.26 + yLift, 3.42 + zPull * 1.15);
    state.targetCamLook.set(0.0, 0.72, -0.18);
  } else if (state.phase === 'style') {
    state.targetCamPos.set(0.04, 2.12 + yLift * 0.85, 2.98 + zPull * 1.05);
    state.targetCamLook.set(0.04, 0.74, -0.24);
  } else if (state.phase === 'guest') {
    state.targetCamPos.set(0.0, 2.18 + yLift * 0.9, 3.28 + zPull * 1.1);
    state.targetCamLook.set(-0.04, 0.76, -0.20);
  }
}

function clearDynamicRoomProps() {
  while (room.dynamicGroup.children.length > 0) {
    room.dynamicGroup.remove(room.dynamicGroup.children[0]);
  }
  state.messyItems = [];
  state.chocolates = [];
  state.petals = [];
}

function setupRoomCycle(roomNum) {
  state.roomNumber = roomNum;
  clearDynamicRoomProps();

  daughter.group.visible = false;
  mirrorDaughter.group.visible = true;

  room.bedCloth.scrambleMessy(roomNum * 3 + 1);
  room.pillows[0].position.set(-0.53, 0.86, -0.76);
  room.pillows[0].rotation.set(0.20, 0.20, -0.08);
  room.pillows[0].userData.fluff = 0.68;
  room.pillows[1].position.set(0.50, 0.85, -0.80);
  room.pillows[1].rotation.set(0.10, -0.22, 0.09);
  room.pillows[1].userData.fluff = 0.70;

  room.bedRunner.visible = false;
  room.bedRunner.userData.styleIndex = -1;
  room.runnerSwatches.forEach((sw, idx) => {
    sw.visible = false;
    sw.position.set((idx - 1) * 0.35, 0.47, 1.38);
  });

  room.primarySwan.resetFlat();
  room.primarySwan.group.visible = false;
  room.primarySwan.group.position.set(-0.04, 0.80, 0.08);
  room.primarySwan.group.rotation.set(0, -1.08, 0);

  room.secondarySwan.resetFlat();
  room.secondarySwan.group.visible = false;
  room.secondarySwan.group.position.set(0.24, 0.80, 0.08);
  room.secondarySwan.group.rotation.set(0, 1.08, 0);

  state.swanSpawned = false;
  state.secondSwanSpawned = false;
  state.bellReady = false;
  state.tidiedCount = 0;
  state.blunderTriggered = false;
  state.blunderActive = false;
  state.guestEntered = false;
  state.guestSitMode = false;

  room.hamperGroup.visible = true;
  room.towelBasketGroup.visible = true;
  room.hospitalityTray.visible = false;
  room.nextRoomStand.visible = false;

  [papaChar, mamaChar, grandmaGuest, gentGuest].forEach((c) => { c.group.visible = false; });
  state.familyHelper = roomNum % 2 === 1 ? papaChar : mamaChar;
  state.familyHelper.group.visible = true;
  state.familyHelper.group.position.set(-1.52, 0, 0.30);
  state.familyHelper.group.rotation.y = 0.72;
  state.familyHelper.setExpression('idle', 3.0);
  state.familyTargetPos.set(-1.52, 0, 0.30);
  // Swing oak door outward into hallway (-angle) so it NEVER intersects characters!
  state.targetDoorAngle = -0.82;

  // Spawn 3 sculpted garments + 3 sculpted bath towels 100% in clear center-screen reach!
  const initialSpots = [
    { kind: 'cloth', variant: roomNum + 0, x: -0.44, z: 0.12, surface: 'bed' },
    { kind: 'cloth', variant: roomNum + 1, x: 0.46, z: -0.18, surface: 'bed' },
    { kind: 'cloth', variant: roomNum + 2, x: -0.36, z: 1.36, surface: 'bench' },
    { kind: 'towel', variant: 0, x: 0.20, z: 0.48, surface: 'bed' },
    { kind: 'towel', variant: 1, x: -0.76, z: 0.54, surface: 'bed' },
    { kind: 'towel', variant: 2, x: 0.34, z: 1.36, surface: 'bench' }
  ];

  for (const sp of initialSpots) {
    const item = createMessyFabricItem(sp.kind, sp.variant, room.materials, room.textures);
    const y = sp.surface === 'bed'
      ? room.bedCloth.sampleHeightAt(sp.x, sp.z) + 0.018
      : (sp.surface === 'bench' ? 0.43 : 0.015);
    item.position.set(sp.x, y, sp.z);
    item.rotation.y = (sp.variant * 1.3) % (Math.PI * 2);
    room.dynamicGroup.add(item);
    state.messyItems.push(item);
  }

  // 4 Artisanal Chocolates on the Hospitality Tray
  for (let c = 0; c < 4; c++) {
    const choc = createHotelChocolate(c, room.materials.brass, room.textures.texShadow);
    const col = c % 2;
    const row = Math.floor(c / 2);
    const home = new THREE.Vector3(1.28 + col * 0.20, 0.68, -0.08 + row * 0.14);
    choc.position.copy(home);
    choc.userData.homePos.copy(home);
    choc.visible = false;
    room.dynamicGroup.add(choc);
    state.chocolates.push(choc);
  }

  state.phase = 'tidy';
  state.idleSeconds = 0;
  state.idleDemoShownThisPhase = false;
  setBothDaughtersExpression('curious', 2.5);
  updateCameraFramingTargets();
}

function triggerFamilyBlunder() {
  if (state.blunderTriggered) return;
  state.blunderTriggered = true;
  state.blunderActive = true;

  const helper = state.familyHelper;
  const isPapa = helper === papaChar;
  sound.playVoiceReaction('blunder', isPapa);

  state.familyTargetPos.set(-1.32, 0, 0.42);
  helper.group.rotation.y = 0.68;
  helper.setExpression('blunder', 4.5);
  setBothDaughtersExpression('huh', 1.8);

  const dropSpecs = isPapa
    ? [
        { kind: 'cloth', variant: 3, target: new THREE.Vector3(-0.32, room.bedCloth.sampleHeightAt(-0.32, -0.08) + 0.02, -0.08) },
        { kind: 'towel', variant: 3, target: new THREE.Vector3(-0.42, 0.43, 1.38) }
      ]
    : [
        { kind: 'towel', variant: 4, target: new THREE.Vector3(0.18, room.bedCloth.sampleHeightAt(0.18, 0.14) + 0.02, 0.14) },
        { kind: 'cloth', variant: 1, target: new THREE.Vector3(0.38, 0.43, 1.38) }
      ];

  dropSpecs.forEach((sp, idx) => {
    const item = createMessyFabricItem(sp.kind, sp.variant, room.materials, room.textures);
    item.position.copy(helper.group.position).add(new THREE.Vector3(0.25, 0.95, 0.15));
    item.userData.blunderArc = {
      start: item.position.clone(),
      end: sp.target,
      t: -idx * 0.14
    };
    room.dynamicGroup.add(item);
    state.messyItems.push(item);
  });
}

function enterStylePhase() {
  state.phase = 'style';
  state.idleSeconds = 0;
  state.idleDemoShownThisPhase = false;

  state.familyHelper.setExpression('delight', 2.0);
  sound.playVoiceReaction('delight', state.familyHelper === papaChar);
  state.familyTargetPos.set(-2.85, 0, 0.06);
  state.targetDoorAngle = 0.0;

  setTimeout(() => {
    if (state.phase !== 'tidy') {
      state.familyHelper.group.visible = false;
      room.hamperGroup.visible = false;
      room.towelBasketGroup.visible = false;
      // Also hide collected laundry inside the baskets so corners stay spotless in Scene 2 & 3!
      state.messyItems.forEach((it) => { if (it.userData.collected) it.visible = false; });
    }
  }, 850);

  room.hospitalityTray.visible = true;
  state.chocolates.forEach((ch) => { ch.visible = true; });
  room.runnerSwatches.forEach((sw) => { sw.visible = true; });

  room.primarySwan.resetFlat();
  room.primarySwan.group.position.set(-0.04, room.bedCloth.sampleHeightAt(-0.04, 0.08) + 0.01, 0.08);
  room.primarySwan.group.rotation.set(0, -1.08, 0);
  room.primarySwan.group.visible = true;
  state.swanSpawned = true;

  setBothDaughtersExpression('proud', 2.2);
  updateCameraFramingTargets();
}

function checkStyleReadiness() {
  if (state.phase !== 'style') return;
  const smooth = room.bedCloth.getSmoothness();
  const swanFold = room.primarySwan.getFoldProgress();
  const chocPlaced = state.chocolates.some((c) => c.userData.placedZone !== 'tray');

  if ((smooth > 0.34 && swanFold > 0.30) || (smooth > 0.48 && chocPlaced) || (swanFold > 0.50 && chocPlaced)) {
    if (!state.bellReady) {
      state.bellReady = true;
      setBothDaughtersExpression('delight', 2.0);
    }
  }
}

function ringBellAndWelcomeGuest() {
  sound.playBrassBell();
  room.bellGroup.userData.pressAnim = 1.0;

  if (state.phase === 'style') {
    state.phase = 'guest';
    state.idleSeconds = 0;
    state.idleDemoShownThisPhase = false;
    room.nextRoomStand.visible = true;

    const miniCount = room.nextRoomStand.userData.keepsakeRow.children.length;
    if (miniCount < 6) {
      const mini = new THREE.Mesh(new THREE.ConeGeometry(0.026, 0.06, 10), room.materials.terry);
      mini.position.set(-0.13 + miniCount * 0.052, 0.03, 0);
      room.nextRoomStand.userData.keepsakeRow.add(mini);
    }

    const guestPool = [mamaChar, gentGuest, grandmaGuest, papaChar];
    const guest = guestPool[(state.roomNumber - 1) % guestPool.length];
    state.activeGuest = guest;
    guest.group.visible = true;
    guest.group.position.set(-2.65, 0, 0.16);
    guest.group.rotation.y = 1.15;
    state.guestTargetPos.set(-1.36, 0, 0.34);
    state.targetDoorAngle = -0.95;

    updateCameraFramingTargets();

    setTimeout(() => {
      if (state.phase !== 'guest') return;
      state.guestEntered = true;
      const swanStyle = room.primarySwan.getSwanStyle();
      const smooth = room.bedCloth.getSmoothness();
      const isLow = guest === papaChar || guest === gentGuest;

      if (swanStyle === 'flatTowel' || swanStyle === 'quirkyAsymmetricSwan' || smooth < 0.25) {
        guest.setExpression('huh', 0.95);
        setBothDaughtersExpression('huh', 0.95);
        sound.playVoiceReaction('huh', isLow);
        setTimeout(() => {
          guest.setExpression('delight', 4.0);
          setBothDaughtersExpression('delight', 4.0);
          sound.playVoiceReaction('delight', isLow);
        }, 950);
      } else {
        guest.setExpression('delight', 4.5);
        setBothDaughtersExpression('proud', 4.5);
        sound.playVoiceReaction('delight', isLow);
      }
    }, 800);
  } else if (state.phase === 'guest') {
    const isLow = state.activeGuest === papaChar || state.activeGuest === gentGuest;
    state.activeGuest.setExpression('delight', 2.4);
    setBothDaughtersExpression('delight', 2.0);
    sound.playVoiceReaction('delight', isLow);
  }
}

// ============================================================================
// SINGLE-FINGER POINTER & RAYCAST INTERACTION ENGINE
// ============================================================================
const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2();
const prevPointerNDC = new THREE.Vector2();
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.82);
const planeHit = new THREE.Vector3();
const prevPlaneHit = new THREE.Vector3();

let activePointerId = null;
let activeDrag = null;

function setPointerFromEvent(e) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
}

function projectToHorizontalPlane(planeY, outVec) {
  dragPlane.constant = -planeY;
  raycaster.setFromCamera(pointerNDC, camera);
  if (!raycaster.ray.intersectPlane(dragPlane, outVec)) {
    outVec.set(0, planeY, 0);
  }
  return outVec;
}

function findInteractiveAncestor(obj) {
  let cur = obj;
  while (cur) {
    if (cur.userData && cur.userData.interactType) return cur;
    cur = cur.parent;
  }
  return null;
}

function spawnFlowerPetal(worldPos) {
  if (state.petals.length > 36) return;
  const styles = room.vaseGroup.userData.flowerStyles;
  const st = styles[room.vaseGroup.userData.styleIndex % styles.length];
  const pMat = new THREE.MeshPhysicalMaterial({
    color: st.color,
    roughness: 0.55,
    sheen: 0.7,
    side: THREE.DoubleSide
  });
  const petal = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 8), pMat);
  petal.scale.set(1.1, 0.18, 0.78);
  const px = worldPos.x + (Math.random() - 0.5) * 0.14;
  const pz = worldPos.z + (Math.random() - 0.5) * 0.14;
  petal.position.set(px, room.bedCloth.sampleHeightAt(px, pz) + 0.015, pz);
  petal.rotation.set((Math.random() - 0.5) * 0.3, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.3);
  petal.castShadow = true;
  room.dynamicGroup.add(petal);
  state.petals.push(petal);
}

function checkUniformCompletion() {
  const eq = state.uniformEquipped;
  if (eq.dress && eq.apron && eq.cap && state.phase === 'dressup') {
    setBothDaughtersExpression('proud', 2.5);
    sound.playVoiceReaction('delight', false);
    state.phase = 'transitionToRoom';
    setTimeout(() => {
      room.uniformStation.visible = false;
      setupRoomCycle(1);
    }, 900);
  }
}

function onPointerDown(e) {
  if (activePointerId !== null) return;
  activePointerId = e.pointerId;
  sound.unlock();

  state.idleSeconds = 0;
  state.demoAnim = null;

  setPointerFromEvent(e);
  prevPointerNDC.copy(pointerNDC);
  raycaster.setFromCamera(pointerNDC, camera);

  if (state.phase === 'dressup') {
    const hits = raycaster.intersectObjects(room.uniformStation.children, true);
    const hitItem = hits.length > 0 ? findInteractiveAncestor(hits[0].object) : null;
    projectToHorizontalPlane(0.55, planeHit);
    prevPlaneHit.copy(planeHit);

    if (hitItem && hitItem.userData.interactType === 'uniformItem') {
      sound.playFabricRustle(1.1);
      activeDrag = { type: 'uniformItem', obj: hitItem, movedDist: 0 };
      setBothDaughtersExpression('curious', 1.5);
    }
    return;
  }

  if (state.phase === 'transitionToRoom') return;

  // Intersect room interactive objects first so tray props (Brass Bell, Towels, Next Key) take priority over background curtains!
  const hits = raycaster.intersectObjects(room.root.children, true);
  let picked = null;
  let pickedPoint = null;
  for (const h of hits) {
    let vis = true;
    let p = h.object;
    while (p) { if (!p.visible) { vis = false; break; } p = p.parent; }
    if (!vis) continue;
    if (h.object.userData && h.object.userData.curtainPanel) continue;

    if (h.object === room.bedCloth.mesh) {
      if (!picked) {
        picked = { userData: { interactType: 'bedCloth' } };
        pickedPoint = h.point.clone();
      }
      continue;
    }
    const anc = findInteractiveAncestor(h.object);
    if (anc) {
      picked = anc;
      pickedPoint = h.point.clone();
      break;
    }
  }

  if (!picked) {
    const curtainHits = raycaster.intersectObjects(room.curtainSim.group.children, true);
    if (curtainHits.length > 0) {
      sound.playFabricRustle(1.2);
      activeDrag = { type: 'curtain', startX: pointerNDC.x, movedDist: 0 };
      handCursor.setTarget(curtainHits[0].point, 'pinch', true);
      return;
    }
  }

  const activePerson = state.phase === 'tidy' ? state.familyHelper : (state.phase === 'guest' ? state.activeGuest : null);
  if (activePerson && activePerson.group.visible) {
    const pHits = raycaster.intersectObjects([activePerson.group], true);
    if (pHits.length > 0 && (!picked || picked.userData.interactType === 'bedCloth')) {
      if (state.phase === 'guest') {
        state.guestSitMode = !state.guestSitMode;
        if (state.guestSitMode) {
          state.guestTargetPos.set(-0.62, 0.0, 0.12);
          room.bedCloth.applyIndent(-0.48, 0.12, 0.48, 0.095);
          sound.playPillowFluff();
        } else {
          state.guestTargetPos.set(-1.18, 0, 0.28);
        }
        activePerson.setExpression('delight', 2.2);
        sound.playVoiceReaction('delight', activePerson === papaChar || activePerson === gentGuest);
        handCursor.setTarget(pHits[0].point, 'tap', true);
        return;
      }
    }
  }

  projectToHorizontalPlane(0.84, planeHit);
  prevPlaneHit.copy(planeHit);

  if (!picked) {
    handCursor.setTarget(planeHit, 'hover', true);
    return;
  }

  const itype = picked.userData.interactType;

  if (itype === 'messyItem' && !picked.userData.collected) {
    sound.playFabricRustle(picked.userData.kind === 'towel' ? 0.9 : 1.15);
    picked.userData.isFlying = false;
    activeDrag = {
      type: 'messyItem',
      obj: picked,
      planeY: 0.92,
      lastVel: new THREE.Vector3(),
      movedDist: 0
    };
    projectToHorizontalPlane(0.92, prevPlaneHit);
    handCursor.setTarget(picked.position.clone().add(new THREE.Vector3(0, 0.12, 0)), 'pinch', true);
    setBothDaughtersExpression('concentrate', 1.5);
    return;
  }

  if (itype === 'chocolate') {
    sound.playChocolatePlace();
    activeDrag = { type: 'chocolate', obj: picked, planeY: 0.94, movedDist: 0 };
    projectToHorizontalPlane(0.94, prevPlaneHit);
    handCursor.setTarget(picked.position.clone().add(new THREE.Vector3(0, 0.08, 0)), 'pinch', true);
    setBothDaughtersExpression('concentrate', 1.5);
    return;
  }

  if (itype === 'freshTowelSource') {
    sound.playFabricRustle(0.95);
    if (!room.primarySwan.group.visible) {
      room.primarySwan.resetFlat();
      room.primarySwan.group.position.set(0.0, room.bedCloth.sampleHeightAt(0, 0.16) + 0.01, 0.16);
      room.primarySwan.group.visible = true;
      state.swanSpawned = true;
    } else if (!room.secondarySwan.group.visible) {
      room.secondarySwan.resetFlat();
      room.secondarySwan.leftRoll = 0.85;
      room.secondarySwan.rightRoll = 0.85;
      room.secondarySwan.neckPull = 0.78;
      room.secondarySwan.neckCurve = 0.52;
      room.secondarySwan.rebuildMesh();
      room.secondarySwan.group.position.set(0.24, room.bedCloth.sampleHeightAt(0.24, 0.08) + 0.01, 0.08);
      room.secondarySwan.group.rotation.y = 1.08;
      room.secondarySwan.group.visible = true;
      state.secondSwanSpawned = true;
      setBothDaughtersExpression('delight', 1.8);
      sound.playVoiceReaction('delight', false);
    }
    handCursor.setTarget(pickedPoint, 'tap', true);
    return;
  }

  if (itype === 'towelSwan') {
    sound.playFabricRustle(0.92);
    const sim = picked.userData.sim;
    const localHit = picked.worldToLocal(pickedPoint.clone());
    const wantMove = sim.getFoldProgress() > 0.78 && (state.phase === 'guest' || localHit.z > 0.16);
    activeDrag = {
      type: wantMove ? 'moveSwan' : 'sculptSwan',
      obj: picked,
      sim,
      localStart: localHit,
      movedDist: 0
    };
    projectToHorizontalPlane(0.84, prevPlaneHit);
    handCursor.setTarget(pickedPoint.clone().add(new THREE.Vector3(0, 0.06, 0)), wantMove ? 'pinch' : 'smooth', true);
    setBothDaughtersExpression('concentrate', 1.8);
    return;
  }

  if (itype === 'bedCloth') {
    activeDrag = { type: 'bedCloth', movedDist: 0 };
    projectToHorizontalPlane(0.80, prevPlaneHit);
    room.bedCloth.applyHandStroke(pickedPoint, 0, 0, state.phase !== 'tidy');
    handCursor.setTarget(pickedPoint.clone().add(new THREE.Vector3(0, 0.03, 0)), 'smooth', true);
    setBothDaughtersExpression('concentrate', 1.8);
    return;
  }

  if (itype === 'pillow') {
    sound.playPillowFluff();
    picked.userData.fluff = Math.min(1.18, picked.userData.fluff + 0.16);
    picked.userData.bounceVel = 0.65;
    activeDrag = { type: 'pillow', obj: picked, movedDist: 0 };
    projectToHorizontalPlane(0.84, prevPlaneHit);
    handCursor.setTarget(pickedPoint.clone().add(new THREE.Vector3(0, 0.05, 0)), 'smooth', true);
    return;
  }

  if (itype === 'runnerSwatch') {
    sound.playSheetSnap(0.65);
    const sIdx = picked.userData.styleIndex;
    const rTex = picked.userData.runnerTextures[sIdx];
    room.bedRunner.material.map = rTex.map;
    room.bedRunner.material.normalMap = rTex.normalMap;
    room.bedRunner.material.needsUpdate = true;
    room.bedRunner.visible = true;
    room.bedRunner.userData.styleIndex = sIdx;
    activeDrag = { type: 'bedRunner', obj: room.bedRunner, movedDist: 0 };
    projectToHorizontalPlane(0.82, prevPlaneHit);
    handCursor.setTarget(pickedPoint, 'pinch', true);
    return;
  }
  if (itype === 'bedRunner') {
    sound.playFabricRustle(0.95);
    activeDrag = { type: 'bedRunner', obj: picked, movedDist: 0 };
    projectToHorizontalPlane(0.82, prevPlaneHit);
    handCursor.setTarget(pickedPoint, 'smooth', true);
    return;
  }

  if (itype === 'lamp') {
    sound.playWoodTap(1.35);
    const ud = picked.userData;
    ud.isOn = !ud.isOn;
    ud.lampLight.intensity = ud.isOn ? 1.35 : 0.0;
    ud.shadeMat.emissiveIntensity = ud.isOn ? 0.58 : 0.02;
    handCursor.setTarget(pickedPoint, 'tap', true);
    return;
  }

  if (itype === 'flowerVase') {
    sound.playFabricRustle(1.35);
    const ud = picked.userData;
    ud.styleIndex = (ud.styleIndex + 1) % ud.flowerStyles.length;
    const st = ud.flowerStyles[ud.styleIndex];
    ud.petalMat.color.setHex(st.color);
    ud.flowerCore.material.color.setHex(st.center);
    activeDrag = { type: 'petalScatter', lastScatterPos: pickedPoint.clone(), movedDist: 0 };
    projectToHorizontalPlane(0.84, prevPlaneHit);
    handCursor.setTarget(pickedPoint, 'pinch', true);
    return;
  }

  if (itype === 'brassBell') {
    handCursor.setTarget(pickedPoint.clone().add(new THREE.Vector3(0, 0.05, 0)), 'tap', true);
    ringBellAndWelcomeGuest();
    return;
  }

  if (itype === 'nextRoomKey') {
    sound.playWoodTap(1.1);
    sound.playBrassBell();
    picked.userData.keySwing.rotation.z = 0.55;
    handCursor.setTarget(pickedPoint, 'tap', true);
    setTimeout(() => { setupRoomCycle(state.roomNumber + 1); }, 420);
    return;
  }

  if (itype === 'pictorialBoard') {
    sound.playWoodTap(1.05);
    picked.userData.wobble = 0.14;
    handCursor.setTarget(pickedPoint, 'tap', true);
    return;
  }
  if (itype === 'woodFurniture' || itype === 'hamper' || itype === 'towelBasket') {
    sound.playWoodTap(0.92);
    handCursor.setTarget(pickedPoint, 'tap', true);
  }
}

function onPointerMove(e) {
  if (e.pointerId !== activePointerId) return;
  state.idleSeconds = 0;

  setPointerFromEvent(e);
  const dNdcX = pointerNDC.x - prevPointerNDC.x;
  const dNdcY = pointerNDC.y - prevPointerNDC.y;

  if (!activeDrag) {
    if (state.phase !== 'dressup' && state.phase !== 'transitionToRoom') {
      projectToHorizontalPlane(0.88, planeHit);
      handCursor.setTarget(planeHit, 'hover', true);
    }
    prevPointerNDC.copy(pointerNDC);
    return;
  }

  if (activeDrag.type === 'uniformItem') {
    projectToHorizontalPlane(0.62, planeHit);
    const localTarget = room.uniformStation.worldToLocal(planeHit.clone());
    activeDrag.obj.position.lerp(
      new THREE.Vector3(localTarget.x, Math.max(0.49, 0.54 + (pointerNDC.y + 0.3) * 0.32), localTarget.z * 0.65),
      0.55
    );
    activeDrag.movedDist += Math.hypot(dNdcX, dNdcY);
    prevPointerNDC.copy(pointerNDC);
    return;
  }

  if (activeDrag.type === 'curtain') {
    room.curtainSim.slideBy(dNdcX * 1.15);
    sound.setLinenRub(Math.min(1, Math.abs(dNdcX) * 18));
    projectToHorizontalPlane(1.4, planeHit);
    handCursor.setTarget(new THREE.Vector3(1.85, 1.35, planeHit.z), 'pinch', true);
    prevPointerNDC.copy(pointerNDC);
    return;
  }

  if (activeDrag.type === 'messyItem') {
    projectToHorizontalPlane(activeDrag.planeY, planeHit);
    const delta = planeHit.clone().sub(prevPlaneHit);
    const obj = activeDrag.obj;
    obj.position.x = Math.max(-1.85, Math.min(1.85, planeHit.x));
    obj.position.z = Math.max(-1.02, Math.min(1.85, planeHit.z));
    obj.position.y = 0.90 + Math.min(0.22, delta.length() * 1.6);
    obj.rotation.z = Math.max(-0.45, Math.min(0.45, -delta.x * 4.2));
    obj.rotation.x = Math.max(-0.45, Math.min(0.45, delta.z * 4.2));
    obj.userData.shadowMesh.position.y = -obj.position.y + 0.02;

    activeDrag.lastVel.copy(delta).multiplyScalar(28.0);
    activeDrag.movedDist += delta.length();
    handCursor.setTarget(obj.position.clone().add(new THREE.Vector3(0, 0.08, 0)), 'pinch', true);
    prevPlaneHit.copy(planeHit);
    prevPointerNDC.copy(pointerNDC);
    return;
  }

  if (activeDrag.type === 'bedCloth') {
    projectToHorizontalPlane(0.80, planeHit);
    const dx = planeHit.x - prevPlaneHit.x;
    const dz = planeHit.z - prevPlaneHit.z;
    const speed = Math.hypot(dx, dz);
    sound.setLinenRub(Math.min(1, speed * 14));

    const res = room.bedCloth.applyHandStroke(planeHit, dx, dz, state.phase !== 'tidy');
    if (res.snappedTaut) {
      sound.playSheetSnap(0.85);
      setBothDaughtersExpression('delight', 1.2);
    }
    handCursor.setTarget(
      new THREE.Vector3(
        Math.max(-1.22, Math.min(1.22, planeHit.x)),
        0.82,
        Math.max(-0.85, Math.min(1.20, planeHit.z))
      ),
      'smooth',
      true
    );
    checkStyleReadiness();
    prevPlaneHit.copy(planeHit);
    prevPointerNDC.copy(pointerNDC);
    return;
  }

  if (activeDrag.type === 'sculptSwan') {
    projectToHorizontalPlane(0.84, planeHit);
    const dx = planeHit.x - prevPlaneHit.x;
    const dz = planeHit.z - prevPlaneHit.z;
    const localCur = activeDrag.obj.worldToLocal(planeHit.clone());
    activeDrag.sim.applySculptDrag(localCur.x, localCur.z, dx, dNdcY, dz);
    sound.setLinenRub(Math.min(1, (Math.hypot(dx, dz) + Math.abs(dNdcY)) * 12));

    handCursor.setTarget(
      activeDrag.obj.position.clone().add(new THREE.Vector3(localCur.x * 0.5, 0.14 + activeDrag.sim.neckPull * 0.18, localCur.z * 0.5)),
      'smooth',
      true
    );
    checkStyleReadiness();
    prevPlaneHit.copy(planeHit);
    prevPointerNDC.copy(pointerNDC);
    return;
  }

  if (activeDrag.type === 'moveSwan') {
    projectToHorizontalPlane(0.82, planeHit);
    const dx = planeHit.x - prevPlaneHit.x;
    activeDrag.obj.position.x = Math.max(-0.84, Math.min(0.84, planeHit.x));
    activeDrag.obj.position.z = Math.max(-0.52, Math.min(0.80, planeHit.z));
    activeDrag.obj.position.y = room.bedCloth.sampleHeightAt(activeDrag.obj.position.x, activeDrag.obj.position.z) + 0.01;
    activeDrag.obj.rotation.y += dx * 0.85;
    handCursor.setTarget(activeDrag.obj.position.clone().add(new THREE.Vector3(0, 0.18, 0)), 'pinch', true);
    prevPlaneHit.copy(planeHit);
    prevPointerNDC.copy(pointerNDC);
    return;
  }

  if (activeDrag.type === 'pillow') {
    projectToHorizontalPlane(0.84, planeHit);
    const p = activeDrag.obj;
    const side = p.userData.side;
    p.position.x = Math.max(side < 0 ? -0.88 : -0.10, Math.min(side < 0 ? 0.10 : 0.88, planeHit.x));
    p.position.z = Math.max(-0.98, Math.min(-0.62, planeHit.z));
    p.rotation.y += (planeHit.x - prevPlaneHit.x) * 0.55;
    p.rotation.z *= 0.88;
    p.rotation.x *= 0.88;
    handCursor.setTarget(p.position.clone().add(new THREE.Vector3(0, 0.12, 0)), 'smooth', true);
    prevPlaneHit.copy(planeHit);
    prevPointerNDC.copy(pointerNDC);
    return;
  }

  if (activeDrag.type === 'bedRunner') {
    projectToHorizontalPlane(0.82, planeHit);
    room.bedRunner.position.z = Math.max(-0.15, Math.min(0.86, planeHit.z));
    sound.setLinenRub(Math.min(1, Math.abs(planeHit.z - prevPlaneHit.z) * 14));
    handCursor.setTarget(new THREE.Vector3(planeHit.x * 0.7, 0.84, room.bedRunner.position.z), 'smooth', true);
    prevPlaneHit.copy(planeHit);
    prevPointerNDC.copy(pointerNDC);
    return;
  }

  if (activeDrag.type === 'chocolate') {
    projectToHorizontalPlane(0.94, planeHit);
    const ch = activeDrag.obj;
    ch.position.set(
      Math.max(-1.45, Math.min(1.62, planeHit.x)),
      0.92,
      Math.max(-1.08, Math.min(1.02, planeHit.z))
    );
    handCursor.setTarget(ch.position.clone().add(new THREE.Vector3(0, 0.05, 0)), 'pinch', true);
    prevPlaneHit.copy(planeHit);
    prevPointerNDC.copy(pointerNDC);
    return;
  }

  if (activeDrag.type === 'petalScatter') {
    projectToHorizontalPlane(0.84, planeHit);
    if (
      Math.abs(planeHit.x) < 1.02 &&
      planeHit.z > -0.82 &&
      planeHit.z < 0.98 &&
      planeHit.distanceTo(activeDrag.lastScatterPos) > 0.22
    ) {
      spawnFlowerPetal(planeHit);
      activeDrag.lastScatterPos.copy(planeHit);
      sound.playFabricRustle(1.45);
    }
    handCursor.setTarget(planeHit.clone().add(new THREE.Vector3(0, 0.08, 0)), 'pinch', true);
    prevPlaneHit.copy(planeHit);
    prevPointerNDC.copy(pointerNDC);
  }
}

// Dual 3D + Screen-Ray proximity helper so dropping visually onto any basket/pillow/person always matches!
function distanceToTargetVisualOrWorld(itemPos, targetWorldPos) {
  const worldDist = Math.hypot(itemPos.x - targetWorldPos.x, itemPos.z - targetWorldPos.z);
  const itemNdc = itemPos.clone().project(camera);
  const targetNdc = targetWorldPos.clone().project(camera);
  const screenDist = Math.hypot(itemNdc.x - targetNdc.x, itemNdc.y - targetNdc.y) * 1.65;
  return Math.min(worldDist, screenDist);
}

function finishMessyItemDrop(obj) {
  obj.rotation.set(0, obj.rotation.y, 0);
  const pos = obj.position;

  const hamperTop = room.hamperGroup.position.clone().add(new THREE.Vector3(0, 0.42, 0));
  const basketTop = room.towelBasketGroup.position.clone().add(new THREE.Vector3(0, 0.38, 0));
  const distHamper = distanceToTargetVisualOrWorld(pos, hamperTop);
  const distTowelBasket = distanceToTargetVisualOrWorld(pos, basketTop);
  const distFamily = state.familyHelper.group.visible
    ? distanceToTargetVisualOrWorld(pos, state.familyHelper.group.position.clone().add(new THREE.Vector3(0, 0.85, 0)))
    : 99;

  if (distFamily < 0.52) {
    const isPapa = state.familyHelper === papaChar;
    state.familyHelper.setExpression('huh', 0.85);
    setBothDaughtersExpression('huh', 0.85);
    sound.playVoiceReaction('huh', isPapa);

    obj.userData.collected = true;
    setTimeout(() => {
      state.familyHelper.setExpression('delight', 2.0);
      setBothDaughtersExpression('delight', 1.8);
      sound.playVoiceReaction('delight', isPapa);
      sound.playBasketDrop();
      obj.visible = false;
      onMessyItemTidied();
    }, 820);
    return;
  }

  if (distHamper < 0.62 || distTowelBasket < 0.62) {
    const chosenBasket = distHamper < distTowelBasket ? room.hamperGroup : room.towelBasketGroup;
    const rightMatch = chosenBasket.userData.acceptKind === obj.userData.kind;

    obj.userData.collected = true;
    chosenBasket.userData.bounce = 1.0;
    sound.playBasketDrop();

    if (!rightMatch) {
      const isPapa = state.familyHelper === papaChar;
      state.familyHelper.setExpression('huh', 0.8);
      setBothDaughtersExpression('huh', 0.8);
      sound.playVoiceReaction('huh', isPapa);
      setTimeout(() => {
        state.familyHelper.setExpression('delight', 1.8);
        setBothDaughtersExpression('delight', 1.8);
        sound.playVoiceReaction('delight', isPapa);
      }, 780);
    } else {
      setBothDaughtersExpression('delight', 1.4);
    }

    obj.position.set(
      chosenBasket.position.x + (Math.random() - 0.5) * 0.10,
      0.35,
      chosenBasket.position.z + (Math.random() - 0.5) * 0.10
    );
    obj.scale.setScalar(0.62);
    obj.userData.shadowMesh.visible = false;
    onMessyItemTidied();
    return;
  }

  const onBed = Math.abs(pos.x) < 1.06 && pos.z > -0.92 && pos.z < 1.04;
  obj.position.y = onBed ? room.bedCloth.sampleHeightAt(pos.x, pos.z) + 0.018 : 0.025;
  obj.userData.shadowMesh.position.y = 0.004;
  sound.playFabricRustle(0.85);
}

function onMessyItemTidied() {
  state.tidiedCount++;
  if (state.tidiedCount === 3 && !state.blunderTriggered) {
    setTimeout(() => triggerFamilyBlunder(), 300);
    return;
  }
  const remaining = state.messyItems.filter((it) => !it.userData.collected);
  if (remaining.length === 0 && state.blunderTriggered) {
    setTimeout(() => enterStylePhase(), 550);
  }
}

function finishChocolateDrop(ch) {
  const pos = ch.position;

  if (state.phase === 'guest' && state.activeGuest.group.visible) {
    const gPos = state.activeGuest.group.position;
    if (Math.hypot(pos.x - gPos.x, pos.z - gPos.z) < 0.70) {
      const isLow = state.activeGuest === papaChar || state.activeGuest === gentGuest;
      state.activeGuest.setExpression('munch', 2.4);
      setBothDaughtersExpression('delight', 2.2);
      sound.playVoiceReaction('munch', isLow);
      ch.visible = false;
      setTimeout(() => {
        ch.position.copy(ch.userData.homePos);
        ch.userData.placedZone = 'tray';
        ch.visible = true;
      }, 2200);
      return;
    }
  }

  const p0 = room.pillows[0].position;
  const p1 = room.pillows[1].position;
  if (distanceToTargetVisualOrWorld(pos, p0) < 0.48) {
    ch.position.set(p0.x + (Math.random() - 0.5) * 0.08, p0.y + 0.118 * room.pillows[0].scale.y, p0.z + 0.06);
    ch.rotation.x = room.pillows[0].rotation.x * 0.85;
    ch.userData.placedZone = 'pillowLeft';
    sound.playChocolatePlace();
    setBothDaughtersExpression('delight', 1.4);
  } else if (distanceToTargetVisualOrWorld(pos, p1) < 0.48) {
    ch.position.set(p1.x + (Math.random() - 0.5) * 0.08, p1.y + 0.118 * room.pillows[1].scale.y, p1.z + 0.06);
    ch.rotation.x = room.pillows[1].rotation.x * 0.85;
    ch.userData.placedZone = 'pillowRight';
    sound.playChocolatePlace();
    setBothDaughtersExpression('delight', 1.4);
  } else if (
    room.primarySwan.group.visible &&
    Math.hypot(pos.x - room.primarySwan.group.position.x, pos.z - room.primarySwan.group.position.z) < 0.28
  ) {
    ch.position.y = 0.88;
    ch.userData.placedZone = 'swan';
    sound.playChocolatePlace();
    setBothDaughtersExpression('huh', 0.7);
    setTimeout(() => setBothDaughtersExpression('delight', 1.4), 700);
  } else if (Math.abs(pos.x) < 1.04 && pos.z > -0.72 && pos.z < 1.00) {
    ch.position.y = room.bedCloth.sampleHeightAt(pos.x, pos.z) + 0.014;
    ch.userData.placedZone = 'bed';
    sound.playChocolatePlace();
  } else {
    ch.position.copy(ch.userData.homePos);
    ch.userData.placedZone = 'tray';
    sound.playChocolatePlace();
  }
  checkStyleReadiness();
}

function onPointerUp(e) {
  if (e.pointerId !== activePointerId) return;
  activePointerId = null;
  sound.setLinenRub(0);

  if (activeDrag) {
    if (activeDrag.type === 'uniformItem') {
      const item = activeDrag.obj;
      const ud = item.userData;
      const nearGirl = Math.abs(item.position.x) < 0.48 && item.position.z < 0.36;
      if (activeDrag.movedDist < 0.08 || nearGirl) {
        const tilt = ud.piece === 'cap' ? item.position.x * 0.45 : 0;
        daughter.equipUniformPiece(ud.piece, ud.variant, tilt);
        mirrorDaughter.equipUniformPiece(ud.piece, ud.variant, tilt);

        if (ud.piece === 'dress') {
          state.uniformEquipped.dress = true;
          state.chosenUniformHex = ud.hex;
          handCursor.setSleeveColor(ud.hex);
          room.tunicSwatches.forEach((sw, idx) => { sw.visible = idx !== ud.variant; });
          room.tunicSwatches.forEach((sw) => { if (sw.visible) sw.position.copy(sw.userData.homePos); });
        } else if (ud.piece === 'apron') {
          state.uniformEquipped.apron = true;
          item.visible = false;
        } else if (ud.piece === 'cap') {
          state.uniformEquipped.cap = true;
          item.visible = false;
        }
        sound.playDressEquip(ud.piece === 'dress' ? 0 : (ud.piece === 'apron' ? 1 : 2));
        setBothDaughtersExpression('delight', 1.6);
        checkUniformCompletion();
      } else {
        item.position.copy(ud.homePos);
      }
    } else if (activeDrag.type === 'messyItem') {
      const obj = activeDrag.obj;
      if (activeDrag.lastVel.length() > 3.2) {
        obj.userData.velocity.copy(activeDrag.lastVel).clampLength(0, 6.5);
        obj.userData.velocity.y = 1.8;
        obj.userData.isFlying = true;
      } else {
        finishMessyItemDrop(obj);
      }
    } else if (activeDrag.type === 'chocolate') {
      finishChocolateDrop(activeDrag.obj);
    }
    activeDrag = null;
  }

  handCursor.setTarget(handCursor.targetPos, 'hover', false);
}

renderer.domElement.addEventListener('pointerdown', onPointerDown);
window.addEventListener('pointermove', onPointerMove);
window.addEventListener('pointerup', onPointerUp);
window.addEventListener('pointercancel', onPointerUp);

function updateIdleGuidance(time, dt) {
  if (activePointerId !== null || state.phase === 'transitionToRoom') return;
  state.idleSeconds += dt;

  if (state.idleSeconds > 9.5 && !state.idleDemoShownThisPhase) {
    state.idleDemoShownThisPhase = true;
    if (state.phase === 'tidy') {
      const firstItem = state.messyItems.find((it) => !it.userData.collected);
      if (firstItem) {
        const dst = firstItem.userData.kind === 'cloth' ? room.hamperGroup.position : room.towelBasketGroup.position;
        state.demoAnim = {
          t: 0,
          from: firstItem.position.clone().add(new THREE.Vector3(0, 0.14, 0)),
          to: dst.clone().add(new THREE.Vector3(0, 0.50, 0))
        };
      }
    } else if (state.phase === 'style') {
      state.demoAnim = {
        t: 0,
        from: new THREE.Vector3(-0.35, 0.85, -0.10),
        to: new THREE.Vector3(-0.98, 0.82, 0.45)
      };
    }
  }

  if (state.demoAnim) {
    state.demoAnim.t += dt * 0.85;
    if (state.demoAnim.t >= 1.0) {
      state.demoAnim = null;
      handCursor.setTarget(handCursor.targetPos, 'hover', false);
    } else {
      const s = state.demoAnim.t;
      const smoothS = s * s * (3 - 2 * s);
      const p = new THREE.Vector3().lerpVectors(state.demoAnim.from, state.demoAnim.to, smoothS);
      p.y += Math.sin(s * Math.PI) * 0.16;
      handCursor.setTarget(p, 'pinch', true);
    }
  }
}

function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(w, h);
  composer.setSize(w, h);
  if (gtaoPass) gtaoPass.setSize(w, h);
  updateCameraFramingTargets();
}
window.addEventListener('resize', onResize);
updateCameraFramingTargets();
state.camPos.copy(state.targetCamPos);
state.camLook.copy(state.targetCamLook);

// Count actual scene geometry triangles & max texture dimension for strict performance verification
function computeSceneStats() {
  let tris = 0;
  let maxTexDim = 0;
  const seenGeo = new Set();
  const seenTex = new Set();
  scene.traverseVisible((obj) => {
    if (obj.isMesh && obj.geometry && !seenGeo.has(obj.geometry.uuid)) {
      seenGeo.add(obj.geometry.uuid);
      if (obj.geometry.index) tris += obj.geometry.index.count / 3;
      else if (obj.geometry.attributes.position) tris += obj.geometry.attributes.position.count / 3;
    }
    if (obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of mats) {
        for (const k of ['map', 'normalMap', 'roughnessMap', 'alphaMap']) {
          const t = m[k];
          if (t && t.image && !seenTex.has(t.uuid)) {
            seenTex.add(t.uuid);
            maxTexDim = Math.max(maxTexDim, t.image.width || 0, t.image.height || 0);
          }
        }
      }
    }
  });
  return { tris: Math.round(tris), maxTexDim };
}

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.033, clock.getDelta());
  const elapsed = clock.elapsedTime;

  room.curtainSim.update(elapsed, dt);
  const openFactor = room.curtainSim.openness;
  sunLight.intensity = 2.35 + openFactor * 1.55;
  hemiLight.intensity = 0.36 + openFactor * 0.16;

  if (state.phase === 'guest' && state.guestSitMode) {
    room.bedCloth.applyIndent(-0.48, 0.12, 0.46, 0.088);
  }
  room.bedCloth.updateGeometry(dt);

  // Dynamically drape the Woven Bed Runner over the live simulated bed cloth surface (zero poke-through!)
  if (room.bedRunner.visible) {
    const rPos = room.bedRunner.geometry.attributes.position;
    const rzBase = room.bedRunner.position.z;
    for (let k = 0; k < rPos.count; k++) {
      const rx = rPos.getX(k);
      const localZ = rPos.getZ(k);
      if (Math.abs(rx) <= 1.07) {
        const clothY = room.bedCloth.sampleHeightAt(rx, rzBase + localZ);
        rPos.setY(k, clothY + 0.016);
      }
    }
    rPos.needsUpdate = true;
    room.bedRunner.geometry.computeVertexNormals();
  }

  for (const p of room.pillows) {
    const ud = p.userData;
    ud.bounceVel -= ud.bounceOffset * 48.0 * dt;
    ud.bounceVel *= Math.exp(-8.5 * dt);
    ud.bounceOffset += ud.bounceVel * dt;
    const sy = Math.max(0.75, ud.fluff + ud.bounceOffset);
    p.scale.set(1.0 + ud.bounceOffset * 0.12, sy, 1.0 + ud.bounceOffset * 0.12);
  }

  for (const item of state.messyItems) {
    const ud = item.userData;
    if (ud.blunderArc) {
      ud.blunderArc.t += dt * 1.85;
      if (ud.blunderArc.t >= 0) {
        const s = Math.min(1, ud.blunderArc.t);
        item.position.lerpVectors(ud.blunderArc.start, ud.blunderArc.end, s);
        item.position.y += Math.sin(s * Math.PI) * 0.45;
        item.rotation.z = (1 - s) * 0.8;
        if (s >= 1) {
          ud.blunderArc = null;
          ud.shadowMesh.position.y = 0.004;
          sound.playFabricRustle(0.95);
        }
      }
    } else if (ud.isFlying && !ud.collected) {
      ud.velocity.y -= 9.8 * dt;
      item.position.addScaledVector(ud.velocity, dt);
      item.position.x = Math.max(-1.85, Math.min(1.85, item.position.x));
      item.position.z = Math.max(-1.02, Math.min(1.85, item.position.z));
      ud.shadowMesh.position.y = Math.max(-item.position.y + 0.01, -0.85);
      if (item.position.y <= 0.46) {
        ud.isFlying = false;
        finishMessyItemDrop(item);
      }
    }
  }

  for (const b of [room.hamperGroup, room.towelBasketGroup]) {
    if (b.userData.bounce > 0.001) {
      b.userData.bounce *= Math.exp(-7.5 * dt);
      const s = 1 + Math.sin(b.userData.bounce * Math.PI * 3) * b.userData.bounce * 0.09;
      b.scale.set(s, 1 / Math.sqrt(s), s);
    }
  }
  if (Math.abs(room.easelGroup.userData.wobble) > 0.001) {
    room.easelGroup.userData.wobble *= Math.exp(-5.5 * dt);
    room.easelGroup.rotation.z = Math.sin(elapsed * 16) * room.easelGroup.userData.wobble;
  }
  if (room.bellGroup.userData.pressAnim > 0.001) {
    room.bellGroup.userData.pressAnim *= Math.exp(-9.0 * dt);
    room.bellGroup.position.y = 0.02 - room.bellGroup.userData.pressAnim * 0.012;
  } else if (state.phase === 'style' && state.bellReady) {
    room.bellGroup.rotation.z = Math.sin(elapsed * 4.5) * 0.055 * Math.max(0, Math.sin(elapsed * 0.9));
  } else {
    room.bellGroup.rotation.z = 0;
  }
  if (room.nextRoomStand.visible) {
    const ks = room.nextRoomStand.userData.keySwing;
    ks.rotation.z += (Math.sin(elapsed * 2.2) * 0.08 - ks.rotation.z) * Math.min(1, dt * 5);
  }

  state.doorAngle += (state.targetDoorAngle - state.doorAngle) * Math.min(1, dt * 4.5);
  room.doorPivot.rotation.y = state.doorAngle;

  if (daughter.group.visible) daughter.update(elapsed, dt);
  if (mirrorDaughter.group.visible) mirrorDaughter.update(elapsed, dt);
  if (state.phase === 'tidy' && state.familyHelper.group.visible) {
    state.familyHelper.group.position.lerp(state.familyTargetPos, Math.min(1, dt * 4.2));
    state.familyHelper.update(elapsed, dt);
  }
  if (state.phase === 'guest' && state.activeGuest.group.visible) {
    state.activeGuest.group.position.lerp(state.guestTargetPos, Math.min(1, dt * 3.8));
    if (state.guestSitMode) {
      state.activeGuest.bodyPivot.position.y = -0.22 + Math.abs(Math.sin(elapsed * 3.5)) * 0.03;
      state.activeGuest.group.rotation.y += (0.25 - state.activeGuest.group.rotation.y) * Math.min(1, dt * 5);
    } else {
      state.activeGuest.group.rotation.y += (0.78 - state.activeGuest.group.rotation.y) * Math.min(1, dt * 4);
    }
    state.activeGuest.update(elapsed, dt);
  }

  if (state.phase === 'dressup') {
    room.apronProp.position.y = room.apronProp.userData.homePos.y + Math.sin(elapsed * 2.2) * 0.006;
    room.capProp.position.y = room.capProp.userData.homePos.y + Math.sin(elapsed * 2.2 + 1.2) * 0.006;
  }

  updateIdleGuidance(elapsed, dt);
  handCursor.update(dt);

  const camLerp = Math.min(1, dt * 3.8);
  state.camPos.lerp(state.targetCamPos, camLerp);
  state.camLook.lerp(state.targetCamLook, camLerp);
  camera.position.copy(state.camPos);
  camera.lookAt(state.camLook);

  composer.render();
}

// Helper to project any 3D world coordinate to current clientX/clientY for rock-solid automated playtesting!
function worldToClient(v3) {
  const rect = renderer.domElement.getBoundingClientRect();
  const p = v3.clone().project(camera);
  return {
    x: rect.left + (p.x * 0.5 + 0.5) * rect.width,
    y: rect.top + (-p.y * 0.5 + 0.5) * rect.height
  };
}

window.__hotelDiag = () => {
  const stats = computeSceneStats();
  const worldPos = new THREE.Vector3();
  return {
    phase: state.phase,
    roomNumber: state.roomNumber,
    sceneTriangles: stats.tris,
    maxTextureDim: stats.maxTexDim,
    pixelRatio: renderer.getPixelRatio(),
    smoothness: Number(room.bedCloth.getSmoothness().toFixed(3)),
    swanProgress: Number(room.primarySwan.getFoldProgress().toFixed(3)),
    swanStyle: room.primarySwan.getSwanStyle(),
    tidiedCount: state.tidiedCount,
    blunderTriggered: state.blunderTriggered,
    bellReady: state.bellReady,
    targets: {
      uniforms: [
        room.tunicSwatches[2],
        room.apronProp,
        room.capProp
      ].map((o) => { o.getWorldPosition(worldPos); return worldToClient(worldPos); }),
      messy: state.messyItems
        .filter((m) => !m.userData.collected)
        .map((m) => { m.getWorldPosition(worldPos); return { kind: m.userData.kind, ...worldToClient(worldPos) }; }),
      hamper: (() => { room.hamperGroup.getWorldPosition(worldPos); worldPos.y = 0.45; return worldToClient(worldPos); })(),
      towelBasket: (() => { room.towelBasketGroup.getWorldPosition(worldPos); worldPos.y = 0.40; return worldToClient(worldPos); })(),
      swan: (() => { room.primarySwan.group.getWorldPosition(worldPos); return worldToClient(worldPos); })(),
      choc0: state.chocolates[0] ? (() => { state.chocolates[0].getWorldPosition(worldPos); return worldToClient(worldPos); })() : null,
      choc2: state.chocolates[2] ? (() => { state.chocolates[2].getWorldPosition(worldPos); return worldToClient(worldPos); })() : null,
      pillow0: (() => { room.pillows[0].getWorldPosition(worldPos); return worldToClient(worldPos); })(),
      pillow1: (() => { room.pillows[1].getWorldPosition(worldPos); return worldToClient(worldPos); })(),
      swatch2: (() => { room.runnerSwatches[2].getWorldPosition(worldPos); return worldToClient(worldPos); })(),
      bell: (() => { room.bellGroup.getWorldPosition(worldPos); return worldToClient(worldPos); })(),
      nextKey: (() => { room.nextRoomStand.getWorldPosition(worldPos); return worldToClient(worldPos); })()
    }
  };
};

animate();
