import * as THREE from 'three';
import { sound } from './audio.js';
import {
  createStudioRimEnvironment,
  createCounterTextures,
  createGlassCondensationBump,
  createFabricTexture,
  createFruitTextures,
  createPictorialSignTexture,
} from './textures.js';
import { MAX_LIQUID_LAYERS, applySubsurfaceScattering } from './materials.js';
import { MacroBokehPipeline } from './dofPass.js';
import {
  FRUIT_CATALOG,
  createGlassCupAssembly,
  createBlenderAssembly,
  createFruitPieceMesh,
  createToppingMesh,
  createSweetenerProp,
  createApronProp,
  createPictorialSignBoard,
} from './props.js';
import {
  createPersonCharacter,
  updatePersonCharacter,
  createOrderThoughtBubble,
  createChildHandCursor,
  updateChildHandCursor,
} from './characters.js';

// ============================================================================
// Setup Renderer, Scene, Studio 1-Light Rim Rig & Macro Shallow DoF Pipeline
// ============================================================================
const container = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({
  antialias: false, // Handled cleanly with HalfFloat RT + smooth edge shading; pixelRatio capped at 1.5
  powerPreference: 'high-performance',
  preserveDrawingBuffer: true, // Allows crisp thumb.jpg / screenshot verification
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
// Deep velvet studio black background ("黒背景のスタジオ1灯リムライト")
scene.background = new THREE.Color(0x030305);
scene.environment = createStudioRimEnvironment(renderer);

const camera = new THREE.PerspectiveCamera(34, window.innerWidth / window.innerHeight, 0.15, 22.0);
camera.position.set(0, 1.38, 3.05);
camera.lookAt(0, 0.86, 0);

const pixelW = Math.floor(window.innerWidth * renderer.getPixelRatio());
const pixelH = Math.floor(window.innerHeight * renderer.getPixelRatio());
const bokehPipeline = new MacroBokehPipeline(renderer, pixelW, pixelH);

// Studio 1-Light Rim Key Softbox (angled off-axis behind-above-right so glass edges blaze without a flat center bar!)
const rimLight = new THREE.SpotLight(0xfff5e8, 28.0, 16.0, Math.PI * 0.36, 0.72, 1.35);
rimLight.position.set(1.95, 3.25, -2.15);
rimLight.target.position.set(0, 0.65, 0.2);
rimLight.castShadow = true;
rimLight.shadow.mapSize.set(1024, 1024);
rimLight.shadow.bias = -0.0004;
scene.add(rimLight, rimLight.target);

// Gentle moody studio bounce fill so rim-light sculpting dominates like real dark-field photography!
const softBounceFill = new THREE.DirectionalLight(0xffd8b8, 0.48);
softBounceFill.position.set(-1.3, 1.55, 2.5);
scene.add(softBounceFill);

// Dedicated warm rim/hair backlight on background family so they glow cinematically against black studio!
const familyRimLight = new THREE.SpotLight(0xffd2a0, 14.0, 10.0, Math.PI * 0.42, 0.75, 1.4);
familyRimLight.position.set(-1.2, 2.6, -2.6);
familyRimLight.target.position.set(0, 0.5, -0.8);
scene.add(familyRimLight, familyRimLight.target);

const studioAmbient = new THREE.HemisphereLight(0x1b1824, 0x0d0806, 0.26);
scene.add(studioAmbient);

// ============================================================================
// Environment: Dark Oiled Walnut Counter + Deep Background Bokeh Bulbs (玉ボケ)
// ============================================================================
const counterTex = createCounterTextures();
const condensationTex = createGlassCondensationBump();
const fruitTextures = createFruitTextures();
const signTex = createPictorialSignTexture();
const fabricTextures = {
  berry: createFabricTexture('berry'),
  citrus: createFabricTexture('citrus'),
  mint: createFabricTexture('mint'),
};

const counterMat = new THREE.MeshStandardMaterial({
  map: counterTex.map,
  roughnessMap: counterTex.roughnessMap,
  roughness: 0.36,
  metalness: 0.04,
  envMapIntensity: 1.05,
});
// Counter ends cleanly at z = -0.34 so characters stand naturally BEHIND the bar counter (no mannequin torso sitting on table!)
const counterMesh = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.55, 2.28), counterMat);
counterMesh.position.set(0, -0.275, 0.80);
counterMesh.receiveShadow = true;
scene.add(counterMesh);

// Polished walnut + brass back-edge lip along z = -0.34
const counterBackRim = new THREE.Mesh(
  new THREE.BoxGeometry(7.2, 0.028, 0.045),
  new THREE.MeshStandardMaterial({ color: 0x26170f, roughness: 0.28, metalness: 0.12 })
);
counterBackRim.position.set(0, 0.012, -0.32);
scene.add(counterBackRim);

// Subtle brass front trim edge on dark bar counter
const brassEdge = new THREE.Mesh(
  new THREE.BoxGeometry(7.2, 0.022, 0.025),
  new THREE.MeshStandardMaterial({ color: 0xc99c52, roughness: 0.25, metalness: 0.88 })
);
brassEdge.position.set(0, -0.002, 1.94);
scene.add(brassEdge);

// Authentic DSLR Optical Circular Bokeh Orbs (玉ボケ) — warm tungsten champagne & amber lens discs!
const bokehGroup = new THREE.Group();
scene.add(bokehGroup);
const bokehDiscGeo = new THREE.PlaneGeometry(1, 1);
const bokehPalette = [0xffc86b, 0xff9e42, 0xffeab3, 0xff8264, 0xffd782];
const bokehBulbs = [];
for (let i = 0; i < 32; i++) {
  const hex = bokehPalette[i % bokehPalette.length];
  const bokehMat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(hex) },
      uOpacity: { value: 0.12 + Math.random() * 0.18 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec4 mvCenter = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        vec2 scale = vec2(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz));
        mvCenter.xy += (position.xy) * scale;
        gl_Position = projectionMatrix * mvCenter;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        vec2 d = (vUv - 0.5) * 2.0;
        float r = length(d);
        if (r > 1.0) discard;
        float softFill = smoothstep(1.0, 0.65, r) * 0.65;
        float apertureRing = smoothstep(0.66, 0.86, r) * smoothstep(1.0, 0.88, r) * 0.48;
        float alpha = (softFill + apertureRing) * uOpacity;
        gl_FragColor = vec4(uColor * alpha * 1.95, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const orb = new THREE.Mesh(bokehDiscGeo, bokehMat);
  const x = (Math.random() - 0.5) * 6.4;
  const y = 0.52 + Math.random() * 2.25;
  const z = -2.5 - Math.random() * 3.2;
  orb.position.set(x, y, z);
  const s = 0.16 + Math.random() * 0.36;
  orb.scale.set(s, s, 1);
  bokehGroup.add(orb);
  bokehBulbs.push({ mesh: orb, baseY: y, baseX: x, phase: Math.random() * Math.PI * 2 });
}

// Pictorial Wooden Sign Board standing on left back corner of counter (ZERO text!)
const signBoard = createPictorialSignBoard(signTex);
signBoard.scale.setScalar(0.85);
signBoard.position.set(-1.32, 0.0, -0.14);
signBoard.rotation.y = 0.38;
scene.add(signBoard);

// ============================================================================
// Characters: Daughter, Dad, Mom, Little Friend + Daughter's 3D Foreground Hand
// ============================================================================
const daughter = createPersonCharacter('daughter', fabricTextures.berry);
const dad = createPersonCharacter('dad');
const mom = createPersonCharacter('mom');
const friend = createPersonCharacter('friend');

scene.add(daughter, dad, mom, friend);

const orderBubble = createOrderThoughtBubble(condensationTex);
scene.add(orderBubble);

const handCursor = createChildHandCursor();
handCursor.visible = false; // Appears as soon as apron is put on!
scene.add(handCursor);

// ============================================================================
// Dynamic Simulation Props & Spill/Droplet Mess System ("散らかり")
// ============================================================================
const spillGroup = new THREE.Group();
scene.add(spillGroup);
const spillDrops = [];
const dropSphereGeo = new THREE.SphereGeometry(0.032, 12, 8);

function spawnCounterDroplet(x, z, colorHex, size = 1.0) {
  if (spillDrops.length > 55) {
    const old = spillDrops.shift();
    spillGroup.remove(old);
  }
  const mat = applySubsurfaceScattering(
    new THREE.MeshPhysicalMaterial({
      color: colorHex,
      roughness: 0.04,
      clearcoat: 1.0,
      specularIntensity: 1.0,
    }),
    colorHex,
    0.9,
    1.8
  );
  const d = new THREE.Mesh(dropSphereGeo, mat);
  d.scale.set(size * (0.9 + Math.random() * 0.5), 0.24 * size, size * (0.9 + Math.random() * 0.5));
  d.position.set(x + (Math.random() - 0.5) * 0.08, 0.004, z + (Math.random() - 0.5) * 0.08);
  spillGroup.add(d);
  spillDrops.push(d);
}

// Dynamic 3D Pouring Liquid Stream Mesh (curves from tilted pitcher spout right into glass!)
const streamMat = applySubsurfaceScattering(
  new THREE.MeshPhysicalMaterial({
    color: 0xd91936,
    roughness: 0.04,
    clearcoat: 1.0,
  }),
  0xff4466,
  1.2,
  1.7
);
const streamGeo = new THREE.CylinderGeometry(0.018, 0.013, 1.0, 14, 12);
const streamMesh = new THREE.Mesh(streamGeo, streamMat);
streamMesh.visible = false;
scene.add(streamMesh);

// ============================================================================
// Stage-Specific Prop Groups
// ============================================================================
const dressupGroup = new THREE.Group();
const blendStageGroup = new THREE.Group();
const layerStageGroup = new THREE.Group();
const toppingTrayGroup = new THREE.Group();
const partyStageGroup = new THREE.Group();
scene.add(dressupGroup, blendStageGroup, layerStageGroup, toppingTrayGroup, partyStageGroup);

// --- Stage 0: 3 Woven Linen Aprons + Preview Welcome Crystal Glass ---
const apronStyles = [
  { id: 'berry', x: -0.50, trim: 0xffe4e1, cuff: 0x9e1c2f },
  { id: 'citrus', x: 0.0, trim: 0xfff6db, cuff: 0xd98c1e },
  { id: 'mint', x: 0.50, trim: 0xe4fff5, cuff: 0x2d8a6e },
];
const apronProps = apronStyles.map((st, idx) => {
  const ap = createApronProp(st.id, fabricTextures[st.id], st.trim);
  ap.scale.setScalar(0.86);
  ap.position.set(st.x, 0.03, 0.34);
  ap.rotation.set(0.14, (idx - 1) * -0.10, 0);
  ap.userData.homePos = ap.position.clone();
  ap.userData.cuffHex = st.cuff;
  dressupGroup.add(ap);
  return ap;
});

// Sparkling welcome crystal glasses with glowing ruby-amber-emerald layers right on the counter in Stage 0!
const welcomeGlass = createGlassCupAssembly(condensationTex, 'parfait');
welcomeGlass.scale.setScalar(0.84);
welcomeGlass.position.set(0.92, 0.0, 0.16);
syncGlassLiquidUniforms(welcomeGlass, [
  { color: new THREE.Color(0xd91936), thickness: 0.30, blur: 0.014, pulp: 0.3 },
  { color: new THREE.Color(0xf59218), thickness: 0.28, blur: 0.018, pulp: 0.25 },
  { color: new THREE.Color(0x45b526), thickness: 0.22, blur: 0.014, pulp: 0.35 },
], 0.055);
dressupGroup.add(welcomeGlass);

const welcomeGlassLeft = createGlassCupAssembly(condensationTex, 'party');
welcomeGlassLeft.scale.setScalar(0.82);
welcomeGlassLeft.position.set(-0.92, 0.0, 0.18);
syncGlassLiquidUniforms(welcomeGlassLeft, [
  { color: new THREE.Color(0x4e259e), thickness: 0.36, blur: 0.015, pulp: 0.25 },
  { color: new THREE.Color(0xd91936), thickness: 0.36, blur: 0.020, pulp: 0.30 },
], 0.05);
dressupGroup.add(welcomeGlassLeft);

// --- Stage 1: Fruit Bowls + Blender + 3 Waiting Crystal Mini-Carafes ---
const blender = createBlenderAssembly(condensationTex);
blender.position.set(0.18, 0.0, 0.15);
blendStageGroup.add(blender);

const fruitSpawners = [];
const fruitBowlLayout = [
  { id: 'strawberry', x: -0.90, z: 0.56 },
  { id: 'orange', x: -0.56, z: 0.70 },
  { id: 'mango', x: -0.22, z: 0.74 },
  { id: 'kiwi', x: -0.90, z: 0.18 },
  { id: 'blueberry', x: -0.56, z: 0.24 },
  { id: 'lemon', x: -0.22, z: 0.30 },
];

// Dark oiled walnut serving board under cut fruits
const fruitPlatter = new THREE.Mesh(
  new THREE.CylinderGeometry(0.60, 0.56, 0.036, 36),
  new THREE.MeshStandardMaterial({ color: 0x1c120d, roughness: 0.34, metalness: 0.06 })
);
fruitPlatter.scale.set(1.08, 1.0, 0.84);
fruitPlatter.position.set(-0.56, 0.018, 0.45);
blendStageGroup.add(fruitPlatter);

fruitBowlLayout.forEach((slot) => {
  // Visual cluster of 3 pieces + active pickable hero piece on top
  const cluster = new THREE.Group();
  cluster.position.set(slot.x, 0.05, slot.z);
  for (let k = 0; k < 2; k++) {
    const deco = createFruitPieceMesh(slot.id, fruitTextures, false);
    deco.scale.setScalar(0.82);
    deco.position.set((k === 0 ? -1 : 1) * 0.075, 0.03, (k === 0 ? 0.04 : -0.04));
    deco.rotation.set(0.3 * k, k * 1.4, 0.2);
    cluster.add(deco);
  }
  const topPiece = createFruitPieceMesh(slot.id, fruitTextures, false);
  topPiece.position.set(0, 0.085, 0.02);
  cluster.add(topPiece);
  blendStageGroup.add(cluster);
  fruitSpawners.push({ slot, cluster, topPiece });
});

// 3 Crystal Mini-Carafes that hold your blended batches (shared across Stage 1 -> Stage 2 -> Stage 3!)
const miniCarafes = [];
for (let i = 0; i < 3; i++) {
  const carafe = createGlassCupAssembly(condensationTex, 'carafe');
  carafe.userData.carafeIndex = i;
  carafe.userData.batchData = null; // { color, pulp, foam, fruitIds }
  scene.add(carafe);
  miniCarafes.push(carafe);
}

// --- Stage 2: Hero Tall Crystal Parfait Glass + Dad's Fumbled Lemon + 3 Sweet Rescue Props ---
const heroGlass = createGlassCupAssembly(condensationTex, 'parfait');
heroGlass.position.set(0.0, 0.0, 0.38);
scene.add(heroGlass);

const dadFumbleLemon = createFruitPieceMesh('lemon', fruitTextures, false);
dadFumbleLemon.visible = false;
scene.add(dadFumbleLemon);

const sweetenerProps = ['honey', 'syrup', 'cream'].map((kind, idx) => {
  const sp = createSweetenerProp(kind, condensationTex);
  sp.position.set(-0.78 + idx * 0.78, 0.0, 0.78);
  sp.userData.homePos = sp.position.clone();
  sp.visible = false;
  layerStageGroup.add(sp);
  return sp;
});

// --- Stage 3A: Topping Studio Tray + Golden Serve Coaster Bell ---
const toppingCatalogSlots = [
  { type: 'straw_red', x: -0.96, y: 0.34, z: 0.42 },
  { type: 'straw_gold', x: -0.78, y: 0.34, z: 0.56 },
  { type: 'straw_mint', x: -0.60, y: 0.34, z: 0.44 },
  { type: 'cherry', x: 0.66, y: 0.09, z: 0.68 },
  { type: 'rim_strawberry', x: 0.92, y: 0.11, z: 0.56 },
  { type: 'rim_orange', x: 0.68, y: 0.10, z: 0.36 },
  { type: 'rim_kiwi', x: 0.96, y: 0.09, z: 0.28 },
  { type: 'ice', x: -0.72, y: 0.08, z: 0.80 },
];
const toppingSpawners = toppingCatalogSlots.map((slot) => {
  const mesh = createToppingMesh(slot.type, fruitTextures, condensationTex);
  mesh.position.set(slot.x, slot.y, slot.z);
  if (slot.type.startsWith('straw_')) {
    mesh.scale.setScalar(0.75);
    mesh.rotation.z = -0.18;
  }
  toppingTrayGroup.add(mesh);
  return { slot, mesh };
});

// Brass cafe serve bell (to bring decorated drink to the full party table!)
const serveBell = new THREE.Group();
{
  const brass = new THREE.MeshStandardMaterial({ color: 0xf0c465, roughness: 0.16, metalness: 0.92 });
  const darkWood = new THREE.MeshStandardMaterial({ color: 0x24160e, roughness: 0.5 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.03, 24), darkWood);
  base.position.y = 0.015;
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.135, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.52),
    brass
  );
  dome.position.y = 0.028;
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.018, 0.04, 14), brass);
  pin.position.y = 0.17;
  const hit = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.y = 0.1;
  serveBell.add(base, dome, pin, hit);
  serveBell.position.set(1.06, 0.0, -0.15);
  serveBell.userData = { hitMesh: hit };
  toppingTrayGroup.add(serveBell);
}

// --- Stage 3B: Party Table Extra Glasses + Mini Replay Blender ---
const partyGlasses = [];
for (let i = 0; i < 4; i++) {
  const pg = createGlassCupAssembly(condensationTex, i % 2 === 0 ? 'party' : 'parfait');
  pg.scale.setScalar(i % 2 === 0 ? 0.88 : 0.76);
  partyStageGroup.add(pg);
  partyGlasses.push(pg);
}

// Mini blender icon prop on far left of party table to make a new custom drink anytime!
const replayMiniBlender = createBlenderAssembly(condensationTex);
replayMiniBlender.scale.setScalar(0.42);
replayMiniBlender.position.set(-1.55, 0.0, 0.55);
partyStageGroup.add(replayMiniBlender);

// ============================================================================
// Liquid Layer Sync Helper
// ============================================================================
function syncGlassLiquidUniforms(glassObj, layers, foamHeight = 0.035) {
  const ud = glassObj.userData;
  ud.layers = layers;
  const mat = ud.liquidMat;
  const u = mat.uniforms;

  let cumH = 0;
  const count = Math.min(MAX_LIQUID_LAYERS, layers.length);
  for (let i = 0; i < MAX_LIQUID_LAYERS; i++) {
    if (i < count) {
      cumH += layers[i].thickness;
      u.uLayerColors.value[i].copy(layers[i].color);
      u.uLayerTops.value[i] = cumH;
      u.uLayerBlurs.value[i] = layers[i].blur ?? 0.016;
      u.uLayerPulps.value[i] = layers[i].pulp ?? 0.25;
    } else {
      u.uLayerTops.value[i] = cumH + 0.1;
    }
  }
  ud.fillLevel = Math.min(1.03, cumH);
  ud.foamHeight = foamHeight;
  u.uLayerCount.value = Math.max(1, count);
  u.uFillLevel.value = ud.fillLevel;
  u.uFoamHeight.value = foamHeight;
  if (ud.causticMat) {
    if (count > 0 && ud.fillLevel > 0.04) {
      ud.causticMat.uniforms.uColor.value.copy(layers[0].color);
      ud.causticMat.uniforms.uStrength.value = Math.min(0.85, ud.fillLevel * 1.1);
    } else {
      ud.causticMat.uniforms.uStrength.value = 0.0;
    }
  }
}

// ============================================================================
// Core Simulation State
// ============================================================================
const state = {
  stage: 'dressup', // 'dressup' | 'blend' | 'layer' | 'sweet_rescue' | 'topping' | 'party'
  apronChoice: null,
  orderColors: [], // 3 target fruit definitions shown in customer's thought bubble
  // Blender state
  blenderFruits: [], // { id, info, mesh }
  blendDuration: 0,
  isBlending: false,
  blendedColor: new THREE.Color(0xd91936),
  blendedPulp: 0.75,
  blendedFoam: 0.02,
  filledCarafeCount: 0,
  // Layering & Dad goof-up state
  dadGoofTriggered: false,
  dadGoofAnimTime: -1,
  sweetAdded: 0,
  pourSettledTimer: 0,
  // Drag / Active Touch Interaction
  pointerDown: false,
  pointerNDC: new THREE.Vector2(0, 0),
  dragMode: null, // 'apron' | 'fruit' | 'blender_btn' | 'blender_jar' | 'carafe_pour' | 'sweet_pour' | 'topping' | 'party_glass'
  dragItem: null,
  dragData: null,
  idleSeconds: 0,
  demoHandPhase: 0,
  // Camera smooth targets
  camPosTarget: new THREE.Vector3(0, 1.32, 2.95),
  camLookTarget: new THREE.Vector3(0, 0.72, 0.05),
  focusDistTarget: 2.55,
  focusRangeTarget: 0.95,
  maxBlurTarget: 0.017,
  focusDist: 2.55,
  focusRange: 0.95,
  maxBlur: 0.017,
  simTimers: [],
};

function scheduleSimAction(delaySec, fn) {
  state.simTimers.push({ remaining: delaySec, fn });
}

function generateNewOrder() {
  const shuffled = [...FRUIT_CATALOG].sort(() => Math.random() - 0.5);
  state.orderColors = [shuffled[0], shuffled[1], shuffled[2]];
  state.orderColors.forEach((f, idx) => {
    orderBubble.userData.bands[idx].color.setHex(f.color);
    orderBubble.userData.bands[idx].userData.sss.uSssColor.value.setHex(f.sss);
  });
}

// ============================================================================
// Stage Layout & Camera Transitions (Responsive Portrait & Landscape!)
// ============================================================================
function applyStageConfiguration(newStage) {
  state.stage = newStage;
  state.idleSeconds = 0;
  sound.stopBlender();
  sound.stopPour();
  streamMesh.visible = false;

  const aspect = window.innerWidth / Math.max(1, window.innerHeight);
  const portraitZoomOut = aspect < 0.85 ? (0.85 - aspect) * 2.35 : 0;

  dressupGroup.visible = newStage === 'dressup';
  blendStageGroup.visible = newStage === 'blend';
  layerStageGroup.visible = newStage === 'layer' || newStage === 'sweet_rescue';
  toppingTrayGroup.visible = newStage === 'topping';
  partyStageGroup.visible = newStage === 'party';

  if (newStage === 'dressup') {
    daughter.visible = true;
    daughter.position.set(0.0, -0.14, -0.62);
    daughter.rotation.y = 0;
    daughter.userData.expression = 'excited';

    dad.visible = true;
    dad.position.set(-0.88, -0.18, -1.25);
    dad.rotation.y = 0.25;
    mom.visible = true;
    mom.position.set(0.88, -0.18, -1.28);
    mom.rotation.y = -0.25;
    friend.visible = false;
    orderBubble.visible = false;

    heroGlass.visible = false;
    miniCarafes.forEach((c) => { c.visible = false; });

    state.camPosTarget.set(0, 1.18 + portraitZoomOut * 0.22, 2.75 + portraitZoomOut * 1.15);
    state.camLookTarget.set(0, 0.56, 0.05);
    state.focusDistTarget = 2.25 + portraitZoomOut * 1.1;
    state.focusRangeTarget = 1.05;
    state.maxBlurTarget = 0.0055;
  } else if (newStage === 'blend') {
    generateNewOrder();
    // Reset blender & carafes for fresh round
    clearBlenderContents();
    state.filledCarafeCount = 0;
    miniCarafes.forEach((c, idx) => {
      c.visible = true;
      c.scale.setScalar(0.76);
      const cx = idx === 0 ? 0.64 : idx === 1 ? 0.94 : 0.78;
      const cz = idx === 0 ? 0.76 : idx === 1 ? 0.64 : 0.32;
      c.position.set(cx, 0.0, cz);
      c.rotation.set(0, Math.PI, 0);
      c.userData.homePos = c.position.clone();
      c.userData.batchData = null;
      syncGlassLiquidUniforms(c, [], 0.0);
    });

    // Hero glass waits on right edge once >=2 carafes filled
    heroGlass.visible = false;
    syncGlassLiquidUniforms(heroGlass, [], 0.0);
    clearHeroToppings();
    heroGlass.userData.liquidMat.uniforms.uSourRipple.value = 0;
    heroGlass.userData.liquidMat.uniforms.uSweetSwirl.value = 0;

    // Daughter & customers stand naturally behind the bar counter (waist below counter height y=0)
    daughter.visible = true;
    daughter.position.set(-1.02, -0.12, -0.62);
    daughter.rotation.y = 0.32;
    daughter.userData.expression = 'neutral';

    dad.visible = true;
    dad.position.set(0.28, -0.16, -1.08);
    dad.rotation.y = -0.12;
    dad.userData.expression = 'neutral';
    dad.userData.foamMustache.visible = false;

    mom.visible = false;
    friend.visible = true;
    friend.position.set(0.98, -0.16, -1.14);
    friend.rotation.y = -0.25;

    orderBubble.visible = true;
    orderBubble.position.set(0.74, 1.02, -0.84);

    state.camPosTarget.set(-0.02, 1.36 + portraitZoomOut * 0.25, 2.72 + portraitZoomOut * 1.25);
    state.camLookTarget.set(0.0, 0.56, 0.16);
    state.focusDistTarget = 2.52 + portraitZoomOut * 1.2;
    state.focusRangeTarget = 1.05;
    state.maxBlurTarget = 0.0055;
  } else if (newStage === 'layer') {
    state.dadGoofTriggered = false;
    state.dadGoofAnimTime = -1;
    state.sweetAdded = 0;
    state.pourSettledTimer = 0;
    dadFumbleLemon.visible = false;
    sweetenerProps.forEach((sp) => { sp.visible = false; });

    // Ensure if player skipped 3rd carafe, 3rd carafe gets a sparkling golden-citrus nectar so they still have 3 vivid colors!
    miniCarafes.forEach((c, idx) => {
      c.visible = true;
      c.scale.setScalar(0.86);
      const sideX = idx === 0 ? -0.70 : idx === 1 ? 0.70 : -0.58;
      const sideZ = idx === 2 ? 0.16 : 0.60;
      c.position.set(sideX, 0.0, sideZ);
      c.rotation.set(0, idx === 1 ? Math.PI : 0, 0);
      c.userData.homePos = c.position.clone();
      if (!c.userData.batchData) {
        const fallback = state.orderColors[idx] || FRUIT_CATALOG[idx];
        const col = new THREE.Color(fallback.color);
        c.userData.batchData = { color: col, pulp: 0.25, foam: 0.04, fruitIds: [fallback.id] };
        syncGlassLiquidUniforms(c, [{ color: col, thickness: 0.78, blur: 0.01, pulp: 0.25 }], 0.05);
      }
    });

    // ULTRA-MACRO shot of the Hero Tall Crystal Parfait Glass filling the screen!
    heroGlass.visible = true;
    heroGlass.scale.setScalar(1.06);
    heroGlass.position.set(0.0, 0.0, 0.42);
    heroGlass.rotation.set(0, 0, 0);

    daughter.visible = true;
    daughter.position.set(-0.74, -0.12, -0.66);
    daughter.rotation.y = 0.28;
    daughter.userData.expression = 'excited';

    // Frame Dad clearly behind the bar counter to the upper-right of the Hero Glass!
    dad.visible = true;
    dad.position.set(0.68, -0.15, -0.68);
    dad.rotation.y = -0.26;
    dad.userData.expression = 'neutral';

    mom.visible = false;
    friend.visible = false;

    orderBubble.visible = true;
    orderBubble.position.set(0.84, 1.05, -0.58);

    // Shallow DoF keeps foreground glass razor-sharp while background family softly defocuses like an 85mm f/1.8 lens!
    state.camPosTarget.set(0.0, 1.18 + portraitZoomOut * 0.20, 2.48 + portraitZoomOut * 1.02);
    state.camLookTarget.set(0.0, 0.72, 0.22);
    state.focusDistTarget = 2.12 + portraitZoomOut * 0.98;
    state.focusRangeTarget = 0.46;
    state.maxBlurTarget = 0.0085;
  } else if (newStage === 'sweet_rescue') {
    orderBubble.visible = false;
    miniCarafes.forEach((c) => { c.visible = false; });
    sweetenerProps.forEach((sp, idx) => {
      sp.visible = true;
      const sx = idx === 0 ? -0.78 : idx === 1 ? 0.78 : -0.60;
      const sz = idx === 2 ? 0.16 : 0.68;
      sp.position.set(sx, 0.0, sz);
      sp.rotation.set(0, 0, 0);
      sp.userData.homePos = sp.position.clone();
    });
    state.focusRangeTarget = 0.75;
    state.maxBlurTarget = 0.0065;
  } else if (newStage === 'topping') {
    orderBubble.visible = false;
    dadFumbleLemon.visible = false;
    miniCarafes.forEach((c) => { c.visible = false; });

    heroGlass.visible = true;
    heroGlass.scale.setScalar(1.02);
    heroGlass.position.set(0.0, 0.0, 0.42);

    daughter.userData.expression = 'excited';
    dad.userData.expression = 'delighted';

    state.camPosTarget.set(0.0, 1.24 + portraitZoomOut * 0.22, 2.62 + portraitZoomOut * 1.05);
    state.camLookTarget.set(0.0, 0.78, 0.26);
    state.focusDistTarget = 2.22 + portraitZoomOut * 1.0;
    state.focusRangeTarget = 0.48;
    state.maxBlurTarget = 0.0085;
  } else if (newStage === 'party') {
    // Stage 3B: Full Party Table Free-Play & Musical Crystal Cheers!
    orderBubble.visible = false;
    dadFumbleLemon.visible = false;

    daughter.visible = true;
    daughter.position.set(-1.05, -0.14, -0.78);
    daughter.rotation.y = 0.34;
    daughter.userData.expression = 'delighted';

    dad.visible = true;
    dad.position.set(-0.34, -0.16, -0.92);
    dad.rotation.y = 0.10;
    dad.userData.expression = 'delighted';

    mom.visible = true;
    mom.position.set(0.38, -0.16, -0.92);
    mom.rotation.y = -0.10;
    mom.userData.expression = 'delighted';

    friend.visible = true;
    friend.position.set(1.04, -0.15, -0.80);
    friend.rotation.y = -0.34;
    friend.userData.expression = 'excited';

    // Place player's custom hero glass right at center + line up colorful party glasses across the table!
    heroGlass.visible = true;
    heroGlass.scale.setScalar(0.86);
    heroGlass.position.set(0.0, 0.0, 0.36);

    const presetPalettes = [
      [0xd91936, 0xf59218, 0xebdb23],
      [0x4e259e, 0xd91936, 0xfff0d4],
      [0x45b526, 0xf4b616, 0xf57d14],
      [0xf57d14, 0xd91936, 0x4e259e],
    ];
    const tableX = [-0.82, -0.42, 0.44, 0.86];
    const tableZ = [0.28, 0.56, 0.54, 0.26];
    partyGlasses.forEach((pg, i) => {
      pg.position.set(tableX[i], 0.0, tableZ[i]);
      const pal = presetPalettes[i];
      const fill = 0.22 + i * 0.05; // Varied liquid heights => musical crystal xylophone pitches when clinked!
      syncGlassLiquidUniforms(
        pg,
        pal.map((hex) => ({ color: new THREE.Color(hex), thickness: fill, blur: 0.018, pulp: 0.2 })),
        0.04 + (i === 1 ? 0.12 : 0.02)
      );
      // Add a cherry & straw on party glasses too if not already added
      if (pg.userData.toppings.length === 0) {
        const ch = createToppingMesh('cherry', fruitTextures, condensationTex);
        ch.position.set(0.04, pg.userData.cavityBottomY + pg.userData.cavityHeight * pg.userData.fillLevel + 0.02, 0);
        pg.add(ch);
        pg.userData.toppings.push({ mesh: ch, floating: true, baseOffset: new THREE.Vector3(0.04, 0.02, 0) });

        const stType = ['straw_red', 'straw_gold', 'straw_mint', 'straw_red'][i];
        const st = createToppingMesh(stType, fruitTextures, condensationTex);
        st.scale.setScalar(0.75);
        st.position.set(-0.08, pg.userData.rimY - 0.12, 0);
        st.rotation.z = 0.22;
        pg.add(st);
        pg.userData.toppings.push({ mesh: st, isStraw: true });
      }
    });

    // Keep mini carafes on right side of party table so player can STILL pour extra layers into any party glass!
    miniCarafes.forEach((c, idx) => {
      c.visible = true;
      c.scale.setScalar(0.68);
      c.position.set(1.24, 0.0, 0.18 + idx * 0.30);
      c.rotation.set(0, Math.PI, 0);
      c.userData.homePos = c.position.clone();
      if (c.userData.fillLevel < 0.25 && c.userData.batchData) {
        syncGlassLiquidUniforms(c, [{ color: c.userData.batchData.color, thickness: 0.75, blur: 0.01, pulp: 0.2 }], 0.04);
      }
    });

    sound.playPartyCheers();

    state.camPosTarget.set(0.0, 1.24 + portraitZoomOut * 0.26, 2.68 + portraitZoomOut * 1.25);
    state.camLookTarget.set(0.0, 0.56, 0.05);
    state.focusDistTarget = 2.42 + portraitZoomOut * 1.2;
    state.focusRangeTarget = 1.35;
    state.maxBlurTarget = 0.0055;
  }
}

function clearBlenderContents() {
  const fc = blender.userData.fruitContainer;
  while (fc.children.length > 0) fc.remove(fc.children[0]);
  state.blenderFruits = [];
  state.blendDuration = 0;
  state.isBlending = false;
  state.blendedFoam = 0.02;
  state.blendedPulp = 0.75;
  syncGlassLiquidUniforms(
    { userData: { liquidMat: blender.userData.liquidMat, layers: [], fillLevel: 0 } },
    [],
    0.0
  );
  blender.userData.liquidMat.uniforms.uVortex.value = 0;
}

function clearHeroToppings() {
  heroGlass.userData.toppings.forEach((t) => heroGlass.remove(t.mesh));
  heroGlass.userData.toppings = [];
}

// ============================================================================
// Raycasting & One-Finger Tactile Physical Input
// ============================================================================
const raycaster = new THREE.Raycaster();
const dragPlaneCounter = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.15);
const dragPlaneVertical = new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.38);
const tmpVec3 = new THREE.Vector3();

function updatePointerNDC(clientX, clientY) {
  state.pointerNDC.x = (clientX / window.innerWidth) * 2 - 1;
  state.pointerNDC.y = -(clientY / window.innerHeight) * 2 + 1;
}

function projectToPlane(plane, out) {
  raycaster.setFromCamera(state.pointerNDC, camera);
  return raycaster.ray.intersectPlane(plane, out);
}

function addFruitToBlender(fruitInfo, mesh) {
  sound.playFruitPlop(Math.min(1, state.blenderFruits.length * 0.2), fruitInfo.mass);
  blender.userData.fruitContainer.add(mesh);
  const idx = state.blenderFruits.length;
  mesh.position.set(
    (Math.random() - 0.5) * 0.14,
    0.08 + idx * 0.11,
    (Math.random() - 0.5) * 0.14
  );
  mesh.rotation.set(Math.random() * 2, Math.random() * 2, Math.random() * 2);
  mesh.scale.setScalar(0.88);
  state.blenderFruits.push({ id: fruitInfo.id, info: fruitInfo, mesh });

  // Splash a tiny base juice puddle in bottom of blender jar immediately for visual feedback!
  recomputeBlenderMixture();
  daughter.userData.expression = 'excited';
}

function recomputeBlenderMixture() {
  if (state.blenderFruits.length === 0) return;
  let r = 0, g = 0, b = 0, pulp = 0;
  const tmpC = new THREE.Color();
  state.blenderFruits.forEach((item) => {
    tmpC.setHex(item.info.color);
    r += tmpC.r;
    g += tmpC.g;
    b += tmpC.b;
    pulp += item.info.pulpBase;
  });
  const n = state.blenderFruits.length;
  state.blendedColor.setRGB(r / n, g / n, b / n);

  // Continuous blend duration transforms color, pulpiness, and foam!
  const tBlend = state.blendDuration;
  const smoothFactor = Math.min(1, tBlend / 3.5);
  const whipFactor = Math.max(0, Math.min(1, (tBlend - 1.6) / 3.0));

  // Longer whip aerates & pastelizes the liquid slightly + builds thick creamy froth!
  const finalCol = state.blendedColor.clone().lerp(new THREE.Color(0xfffaf5), whipFactor * 0.26);
  state.blendedPulp = Math.max(0.04, (pulp / n) * (1.0 - smoothFactor * 0.92));
  state.blendedFoam = tBlend < 0.25 ? 0.01 : 0.025 + smoothFactor * 0.06 + whipFactor * 0.22;

  const baseFill = Math.min(0.82, 0.12 + n * 0.13) * (tBlend < 0.1 ? 0.28 : Math.min(1, 0.45 + tBlend * 0.45));
  syncGlassLiquidUniforms(
    { userData: { liquidMat: blender.userData.liquidMat, layers: [], fillLevel: 0 } },
    [{ color: finalCol, thickness: baseFill, blur: 0.01, pulp: state.blendedPulp }],
    state.blendedFoam * Math.min(1, tBlend * 0.7)
  );
  blender.userData.liquidMat.uniforms.uBubbleRate.value = 0.25 + whipFactor * 0.75;

  // Shrink whole fruit chunks continuously as they break down into juice!
  const chunkScale = Math.max(0.0, 0.88 * (1.0 - tBlend / 2.1));
  state.blenderFruits.forEach((f) => {
    f.mesh.scale.setScalar(chunkScale);
    f.mesh.visible = chunkScale > 0.05;
  });
}

function decantBlenderIntoCarafe(targetCarafe) {
  if (state.blenderFruits.length === 0 || state.blendDuration < 0.25) return;
  sound.playFruitPlop(0.65, 0.9);
  sound.playGlassClink(0.55, 0.65);

  const whipFactor = Math.max(0, Math.min(1, (state.blendDuration - 1.6) / 3.0));
  const finalCol = state.blendedColor.clone().lerp(new THREE.Color(0xfffaf5), whipFactor * 0.26);
  const fruitIds = state.blenderFruits.map((f) => f.id);

  targetCarafe.userData.batchData = {
    color: finalCol.clone(),
    pulp: state.blendedPulp,
    foam: state.blendedFoam,
    fruitIds,
  };
  syncGlassLiquidUniforms(
    targetCarafe,
    [{ color: finalCol.clone(), thickness: 0.78, blur: 0.01, pulp: state.blendedPulp }],
    Math.min(0.22, state.blendedFoam)
  );

  // Quick tilt animation cue on blender jar
  blender.userData.jarGroup.rotation.z = -0.58;
  clearBlenderContents();

  const filled = miniCarafes.filter((c) => c.userData.batchData !== null).length;
  state.filledCarafeCount = filled;

  if (filled >= 2 && state.stage === 'blend') {
    // Reveal Hero Parfait Glass at side as optional early-start target!
    heroGlass.visible = true;
    heroGlass.scale.setScalar(0.75);
    heroGlass.position.set(1.22, 0.0, 0.12);
  }
  if (filled >= 3 && state.stage === 'blend') {
    scheduleSimAction(0.65, () => {
      if (state.stage === 'blend') applyStageConfiguration('layer');
    });
  }
}

function pourIntoGlassStep(sourceColor, sourcePulp, sourceFoam, targetGlass, dt, pourHeight, wallOffset) {
  const ud = targetGlass.userData;
  const layers = ud.layers;

  // Gentle low/wall pour -> razor-sharp layer interface; high center pour -> marbled gradient!
  const turbulence = Math.min(1, Math.max(0, (pourHeight - 0.15) * 1.4 + (0.28 - Math.abs(wallOffset)) * 1.2));
  const blur = 0.008 + turbulence * 0.038;
  const rate = 0.23 * dt;

  // Brim overflow droplets if already full! ("水を満杯に貯める・溢れさせる・ちょっかいで更に溢れる")
  if (ud.fillLevel >= 0.98) {
    if (Math.random() < 0.35) {
      spawnCounterDroplet(
        targetGlass.position.x + (Math.random() - 0.5) * 0.35,
        targetGlass.position.z + (Math.random() - 0.5) * 0.35,
        sourceColor.getHex(),
        0.95
      );
      sound.playDrip();
    }
    ud.sloshVel.x += (Math.random() - 0.5) * 1.8 * dt;
    return;
  }

  // Merge into top layer if identical color, else create a new distinct rainbow stratum!
  const topLayer = layers[layers.length - 1];
  if (
    topLayer &&
    Math.abs(topLayer.color.r - sourceColor.r) +
      Math.abs(topLayer.color.g - sourceColor.g) +
      Math.abs(topLayer.color.b - sourceColor.b) <
      0.06
  ) {
    topLayer.thickness = Math.min(1.02 - (ud.fillLevel - topLayer.thickness), topLayer.thickness + rate);
    topLayer.blur = topLayer.blur * 0.92 + blur * 0.08;
  } else if (layers.length < MAX_LIQUID_LAYERS) {
    layers.push({
      color: sourceColor.clone(),
      thickness: rate,
      blur,
      pulp: sourcePulp,
    });
  } else if (topLayer) {
    topLayer.color.lerp(sourceColor, 0.25);
    topLayer.thickness += rate;
  }

  const newFoam = Math.min(0.18, ud.foamHeight * 0.96 + sourceFoam * 0.22);
  syncGlassLiquidUniforms(targetGlass, layers, newFoam);

  // Slosh & counter splash when pouring from high up
  ud.sloshVel.x += (wallOffset * 2.5 + (Math.random() - 0.5) * turbulence * 2.0) * dt;
  ud.sloshVel.y += (Math.random() - 0.5) * turbulence * 1.6 * dt;
  if (turbulence > 0.65 && Math.random() < 0.08) {
    spawnCounterDroplet(
      targetGlass.position.x + (Math.random() - 0.5) * 0.48,
      targetGlass.position.z + (Math.random() - 0.5) * 0.42,
      sourceColor.getHex(),
      0.65
    );
  }
}

function triggerDadSourGoofUp() {
  if (state.dadGoofTriggered) return;
  state.dadGoofTriggered = true;
  state.dadGoofAnimTime = 0;

  // Check if player poured colors matching Dad's order bubble or totally different creative colors!
  const usedHexes = heroGlass.userData.layers.map((l) => l.color);
  let matched = 0;
  state.orderColors.forEach((ord) => {
    const oc = new THREE.Color(ord.color);
    if (usedHexes.some((uh) => Math.abs(uh.r - oc.r) + Math.abs(uh.g - oc.g) + Math.abs(uh.b - oc.b) < 0.45)) {
      matched++;
    }
  });

  if (matched < 2) {
    // Different colors -> cute "あれ？ (Huh?)" expression first -> chuckles happily!
    dad.userData.expression = 'curious';
    sound.playCuriousHuh();
  } else {
    dad.userData.expression = 'excited';
  }
}

// ============================================================================
// Pointer Event Handlers
// ============================================================================
function onPointerDown(e) {
  if (e.button !== undefined && e.button !== 0) return;
  sound.unlock();
  state.pointerDown = true;
  state.idleSeconds = 0;
  updatePointerNDC(e.clientX, e.clientY);
  raycaster.setFromCamera(state.pointerNDC, camera);

  // Always allow rocking the pictorial wooden board if tapped!
  if (raycaster.intersectObject(signBoard.userData.hitMesh).length > 0) {
    signBoard.userData.rockVel = 0.28;
    sound.playWoodTap();
    return;
  }

  if (state.stage === 'dressup') {
    const hits = raycaster.intersectObjects(apronProps.map((a) => a.userData.hitMesh));
    if (hits.length > 0) {
      const chosen = apronProps.find((a) => a.userData.hitMesh === hits[0].object);
      if (chosen) {
        state.dragMode = 'apron';
        state.dragItem = chosen;
        sound.playPickSoft(1.0);
      }
      return;
    }
    if (raycaster.intersectObject(welcomeGlass.userData.hitMesh).length > 0) {
      sound.playGlassClink(welcomeGlass.userData.fillLevel, 0.9);
      welcomeGlass.userData.sloshVel.x += 0.45;
    }
    return;
  }

  if (state.stage === 'blend') {
    // 1) Press & Hold Big Blender Button!
    if (raycaster.intersectObject(blender.userData.buttonHit).length > 0) {
      state.dragMode = 'blender_btn';
      state.isBlending = true;
      sound.startBlender();
      blender.userData.buttonMesh.position.z = 0.326;
      return;
    }

    // 2) Pick up any fruit from the 6 fruit bowls!
    const fruitHits = raycaster.intersectObjects(fruitSpawners.map((s) => s.topPiece.userData.hitMesh));
    if (fruitHits.length > 0) {
      const spawner = fruitSpawners.find((s) => s.topPiece.userData.hitMesh === fruitHits[0].object);
      if (spawner) {
        const piece = createFruitPieceMesh(spawner.slot.id, fruitTextures, false);
        piece.position.copy(spawner.cluster.position).add(new THREE.Vector3(0, 0.14, 0));
        scene.add(piece);
        state.dragMode = 'fruit';
        state.dragItem = piece;
        state.dragData = { startX: e.clientX, startY: e.clientY, movedPx: 0 };
        sound.playPickSoft(1.1);
        return;
      }
    }

    // 3) Tap any mini carafe (automatically routes to next empty carafe if tapped one is full!)
    const carafeHits = raycaster.intersectObjects(miniCarafes.map((c) => c.userData.hitMesh));
    if (carafeHits.length > 0) {
      const clickedC = miniCarafes.find((c) => c.userData.hitMesh === carafeHits[0].object);
      if (clickedC && state.blenderFruits.length > 0 && state.blendDuration >= 0.25) {
        const destC = !clickedC.userData.batchData
          ? clickedC
          : miniCarafes.find((c) => !c.userData.batchData) || clickedC;
        decantBlenderIntoCarafe(destC);
      } else if (clickedC) {
        sound.playGlassClink(clickedC.userData.fillLevel, 0.75);
      }
      return;
    }

    if (raycaster.intersectObject(blender.userData.jarHit).length > 0) {
      if (state.blenderFruits.length > 0 && state.blendDuration >= 0.25) {
        state.dragMode = 'blender_jar';
        sound.playPickSoft(0.85);
      } else if (state.blenderFruits.length > 0) {
        // Holding jar when unblended also starts blending so 5yo never gets stuck!
        state.dragMode = 'blender_btn';
        state.isBlending = true;
        sound.startBlender();
      }
      return;
    }

    if (heroGlass.visible && raycaster.intersectObject(heroGlass.userData.hitMesh).length > 0) {
      sound.playGlassClink(0.2, 0.9);
      applyStageConfiguration('layer');
      return;
    }
  }

  if (state.stage === 'layer') {
    const carafeHits = raycaster.intersectObjects(miniCarafes.map((c) => c.userData.hitMesh));
    if (carafeHits.length > 0) {
      const carafe = miniCarafes.find((c) => c.userData.hitMesh === carafeHits[0].object);
      if (carafe && carafe.userData.fillLevel > 0.04) {
        state.dragMode = 'carafe_pour';
        state.dragItem = carafe;
        state.dragData = { movedPx: 0, startX: e.clientX, startY: e.clientY, holdTime: 0 };
        sound.playPickSoft(0.95);
        return;
      }
    }
    if (raycaster.intersectObject(heroGlass.userData.hitMesh).length > 0) {
      sound.playGlassClink(heroGlass.userData.fillLevel, 0.85);
      heroGlass.userData.sloshVel.x += 0.35;
      if (heroGlass.userData.fillLevel >= 0.55 && !state.dadGoofTriggered) {
        triggerDadSourGoofUp();
      }
      return;
    }
  }

  if (state.stage === 'sweet_rescue') {
    const sweetHits = raycaster.intersectObjects(sweetenerProps.map((s) => s.userData.hitMesh));
    if (sweetHits.length > 0) {
      const sw = sweetenerProps.find((s) => s.userData.hitMesh === sweetHits[0].object);
      if (sw) {
        state.dragMode = 'sweet_pour';
        state.dragItem = sw;
        state.dragData = { movedPx: 0, startX: e.clientX, startY: e.clientY, holdTime: 0 };
        sound.playPickSoft(1.05);
        return;
      }
    }
  }

  if (state.stage === 'topping') {
    // Check serve bell first!
    if (raycaster.intersectObject(serveBell.userData.hitMesh).length > 0) {
      sound.playGlassClink(0.1, 1.1);
      applyStageConfiguration('party');
      return;
    }

    // Check spawning a new topping from tray
    const topHits = raycaster.intersectObjects(toppingSpawners.map((t) => t.mesh.userData.hitMesh));
    if (topHits.length > 0) {
      const sp = toppingSpawners.find((t) => t.mesh.userData.hitMesh === topHits[0].object);
      if (sp) {
        const item = createToppingMesh(sp.slot.type, fruitTextures, condensationTex);
        if (sp.slot.type.startsWith('straw_')) item.scale.setScalar(0.85);
        item.position.copy(sp.mesh.position);
        scene.add(item);
        state.dragMode = 'topping';
        state.dragItem = item;
        sound.playPickSoft(1.15);
        return;
      }
    }

    // Tapping existing toppings on hero glass -> bob cherries/ice or blow straw bubbles!
    const placedHits = raycaster.intersectObjects(
      heroGlass.userData.toppings.map((t) => t.mesh.userData.hitMesh).filter(Boolean)
    );
    if (placedHits.length > 0) {
      const found = heroGlass.userData.toppings.find((t) => t.mesh.userData.hitMesh === placedHits[0].object);
      if (found) {
        if (found.isStraw) {
          sound.playStrawBubbles();
          heroGlass.userData.sloshVel.x += 0.4;
        } else {
          found.bobVel = -0.35;
          sound.playFruitPlop(0.8, 0.7);
        }
        return;
      }
    }

    if (raycaster.intersectObject(heroGlass.userData.hitMesh).length > 0) {
      sound.playGlassClink(heroGlass.userData.fillLevel, 0.9);
      heroGlass.userData.sloshVel.x += 0.35;
    }
  }

  if (state.stage === 'party') {
    // Mini blender on left restarts a new custom drink round!
    if (raycaster.intersectObject(replayMiniBlender.userData.jarHit).length > 0 ||
        raycaster.intersectObject(replayMiniBlender.userData.buttonHit).length > 0) {
      sound.playPickSoft(1.2);
      applyStageConfiguration('blend');
      return;
    }

    // Pouring extra layers from mini carafes on party table!
    const carafeHits = raycaster.intersectObjects(miniCarafes.map((c) => c.userData.hitMesh));
    if (carafeHits.length > 0) {
      const carafe = miniCarafes.find((c) => c.userData.hitMesh === carafeHits[0].object);
      if (carafe) {
        state.dragMode = 'carafe_pour';
        state.dragItem = carafe;
        sound.playPickSoft(0.95);
        return;
      }
    }

    // Grabbing / clinking / serving any glass on the party table!
    const allGlasses = [heroGlass, ...partyGlasses];
    const gHits = raycaster.intersectObjects(allGlasses.map((g) => g.userData.hitMesh));
    if (gHits.length > 0) {
      const g = allGlasses.find((x) => x.userData.hitMesh === gHits[0].object);
      if (g) {
        state.dragMode = 'party_glass';
        state.dragItem = g;
        state.dragData = { startPos: g.position.clone(), moved: 0 };
        sound.playGlassClink(g.userData.fillLevel, 0.85);
        g.userData.sloshVel.x += 0.35;
      }
    }
  }
}

function onPointerMove(e) {
  updatePointerNDC(e.clientX, e.clientY);
  state.idleSeconds = 0;

  // Update 3D child hand position smoothly in foreground space
  if (handCursor.visible) {
    const handPlane = new THREE.Plane(new THREE.Vector3(0, 0.35, 0.94).normalize(), -0.82);
    if (projectToPlane(handPlane, tmpVec3)) {
      handCursor.userData.targetPos.set(
        THREE.MathUtils.clamp(tmpVec3.x, -1.65, 1.65),
        THREE.MathUtils.clamp(tmpVec3.y, 0.08, 1.55),
        THREE.MathUtils.clamp(tmpVec3.z, 0.15, 1.35)
      );
    }
  }

  if (!state.pointerDown || !state.dragMode) return;
  if (state.dragData && state.dragData.startX !== undefined) {
    state.dragData.movedPx = Math.hypot(e.clientX - state.dragData.startX, e.clientY - state.dragData.startY);
  }

  if (state.dragMode === 'apron' && state.dragItem) {
    if (projectToPlane(dragPlaneVertical, tmpVec3)) {
      state.dragItem.position.set(
        THREE.MathUtils.clamp(tmpVec3.x, -1.2, 1.2),
        THREE.MathUtils.clamp(tmpVec3.y, 0.15, 1.15),
        0.35
      );
    }
  } else if (state.dragMode === 'fruit' && state.dragItem) {
    const plane = new THREE.Plane(new THREE.Vector3(0, 0.25, 0.97).normalize(), -0.45);
    if (projectToPlane(plane, tmpVec3)) {
      // Gentle funnel assist when near open top of blender jar!
      const jarTopX = blender.position.x;
      const jarTopY = 1.44;
      const dx = tmpVec3.x - jarTopX;
      if (Math.abs(dx) < 0.36 && tmpVec3.y > 0.72) {
        tmpVec3.x = THREE.MathUtils.lerp(tmpVec3.x, jarTopX, 0.42);
        tmpVec3.y = Math.max(tmpVec3.y, jarTopY);
      }
      state.dragItem.position.set(tmpVec3.x, Math.max(0.14, tmpVec3.y), 0.22);
      state.dragItem.rotation.y += 0.08;
    }
  } else if (state.dragMode === 'carafe_pour' && state.dragItem) {
    if (projectToPlane(dragPlaneVertical, tmpVec3)) {
      state.dragItem.position.set(
        THREE.MathUtils.clamp(tmpVec3.x, -1.25, 1.25),
        THREE.MathUtils.clamp(tmpVec3.y + 0.15, 0.55, 1.72),
        0.40
      );
    }
  } else if (state.dragMode === 'sweet_pour' && state.dragItem) {
    if (projectToPlane(dragPlaneVertical, tmpVec3)) {
      state.dragItem.position.set(
        THREE.MathUtils.clamp(tmpVec3.x, -1.1, 1.1),
        THREE.MathUtils.clamp(tmpVec3.y + 0.18, 0.65, 1.68),
        0.40
      );
    }
  } else if (state.dragMode === 'topping' && state.dragItem) {
    if (projectToPlane(dragPlaneVertical, tmpVec3)) {
      state.dragItem.position.set(
        THREE.MathUtils.clamp(tmpVec3.x, -1.1, 1.1),
        THREE.MathUtils.clamp(tmpVec3.y, 0.22, 1.68),
        0.42
      );
    }
  } else if (state.dragMode === 'party_glass' && state.dragItem) {
    if (projectToPlane(dragPlaneCounter, tmpVec3)) {
      const nx = THREE.MathUtils.clamp(tmpVec3.x, -1.15, 1.05);
      const nz = THREE.MathUtils.clamp(tmpVec3.z, -0.45, 0.85);
      state.dragData.moved += Math.hypot(nx - state.dragItem.position.x, nz - state.dragItem.position.z);
      state.dragItem.position.set(nx, 0.08, nz);

      // Check glass-to-glass collision for instant musical crystal clink ("乾杯！")!
      const allGlasses = [heroGlass, ...partyGlasses];
      allGlasses.forEach((other) => {
        if (other === state.dragItem) return;
        const d = Math.hypot(other.position.x - nx, other.position.z - nz);
        if (d < 0.42 && (!other.userData.lastClink || performance.now() - other.userData.lastClink > 360)) {
          other.userData.lastClink = performance.now();
          sound.playGlassClink(state.dragItem.userData.fillLevel, 1.0);
          setTimeout(() => sound.playGlassClink(other.userData.fillLevel, 0.9), 45);
          other.userData.sloshVel.x += (other.position.x - nx) * 2.2;
          state.dragItem.userData.sloshVel.x -= (other.position.x - nx) * 2.2;
          // Everyone cheers!
          [daughter, dad, mom, friend].forEach((p) => { p.userData.expression = 'delighted'; });
        }
      });
    }
  }
}

function onPointerUp() {
  state.pointerDown = false;

  if (state.dragMode === 'apron' && state.dragItem) {
    // Wearing the chosen apron! (Works both by tapping an apron OR dragging it onto the girl!)
    const ap = state.dragItem;
    state.apronChoice = ap.userData.styleId;
    daughter.userData.wornApron.visible = true;
    daughter.userData.wornApronMat.map = ap.userData.fabricTex;
    daughter.userData.wornApronMat.needsUpdate = true;
    daughter.userData.wornTrimMat.color.setHex(ap.userData.trimHex);
    daughter.userData.expression = 'delighted';

    // Activate Daughter's 3D Hand with matching fabric sleeve cuff!
    handCursor.userData.cuffMat.color.setHex(ap.userData.cuffHex);
    handCursor.visible = true;

    sound.playFabricRustle();
    ap.position.copy(ap.userData.homePos);
    state.dragMode = null;
    state.dragItem = null;

    scheduleSimAction(0.68, () => {
      if (state.stage === 'dressup') applyStageConfiguration('blend');
    });
    return;
  }

  if (state.dragMode === 'blender_btn') {
    state.isBlending = false;
    sound.stopBlender();
    blender.userData.buttonMesh.position.z = 0.344;
  } else if (state.dragMode === 'blender_jar') {
    const emptyCarafe = miniCarafes.find((c) => !c.userData.batchData) || miniCarafes[0];
    decantBlenderIntoCarafe(emptyCarafe);
  } else if (state.dragMode === 'fruit' && state.dragItem) {
    const piece = state.dragItem;
    const dx = piece.position.x - blender.position.x;
    const wasQuickTap = !state.dragData || state.dragData.movedPx < 24;
    if (Math.abs(dx) < 0.60 || wasQuickTap) {
      scene.remove(piece);
      addFruitToBlender(piece.userData.info, piece);
    } else {
      piece.position.y = 0.06;
      spillGroup.add(piece);
      spillDrops.push(piece);
      spawnCounterDroplet(piece.position.x, piece.position.z, piece.userData.info.color, 1.1);
      sound.playFruitPlop(0.1, 1.2);
    }
  } else if (state.dragMode === 'carafe_pour' && state.dragItem) {
    sound.stopPour();
    streamMesh.visible = false;
    const c = state.dragItem;
    c.position.copy(c.userData.homePos);
    c.rotation.z = 0;
  } else if (state.dragMode === 'sweet_pour' && state.dragItem) {
    sound.stopPour();
    streamMesh.visible = false;
    const sw = state.dragItem;
    sw.position.copy(sw.userData.homePos);
    sw.rotation.z = 0;
    if (state.sweetAdded >= 0.30) {
      sound.playSip();
      dad.userData.expression = 'sipping';
      scheduleSimAction(0.42, () => {
        dad.userData.expression = 'delighted';
        daughter.userData.expression = 'delighted';
        sound.playHappySmile();
        scheduleSimAction(1.15, () => {
          if (state.stage === 'sweet_rescue') applyStageConfiguration('topping');
        });
      });
    }
  } else if (state.dragMode === 'topping' && state.dragItem) {
    const item = state.dragItem;
    const type = item.userData.toppingType;
    const gx = heroGlass.position.x;
    const gz = heroGlass.position.z;
    const dx = item.position.x - gx;

    if (Math.abs(dx) < 0.58) {
      scene.remove(item);
      heroGlass.add(item);
      const localX = (item.position.x - gx) / heroGlass.scale.x;
      const fillSurfY =
        heroGlass.userData.cavityBottomY +
        heroGlass.userData.cavityHeight * Math.max(0.35, heroGlass.userData.fillLevel);

      if (type.startsWith('straw_')) {
        const rimSide = localX >= 0 ? 1 : -1;
        item.position.set(rimSide * 0.14 + localX * 0.25, heroGlass.userData.rimY - 0.14, (Math.random() - 0.5) * 0.08);
        item.rotation.set(0, rimSide < 0 ? Math.PI : 0, -rimSide * 0.22);
        heroGlass.userData.toppings.push({ mesh: item, isStraw: true });
        sound.playStrawBubbles();
      } else if (type.startsWith('rim_')) {
        // Perch cut fruit wheel/berry right onto the crystal glass rim at exact angle!
        const ang = Math.atan2((Math.random() - 0.5) * 0.25, localX || 0.2);
        const rRim = heroGlass.userData.rimRadius * 0.92;
        item.position.set(Math.cos(ang) * rRim, heroGlass.userData.rimY + 0.02, Math.sin(ang) * rRim);
        item.rotation.set(0, -ang, 0.25);
        heroGlass.userData.toppings.push({ mesh: item, floating: false });
        sound.playFruitPlop(0.5, 0.85);
      } else {
        // Cherry or ice cube floats & bobs buoyantly on top of the foam/juice!
        const fx = THREE.MathUtils.clamp(localX, -0.20, 0.20);
        const fz = (Math.random() - 0.5) * 0.18;
        item.position.set(fx, fillSurfY + 0.025, fz);
        heroGlass.userData.toppings.push({
          mesh: item,
          floating: true,
          baseOffset: new THREE.Vector3(fx, 0.025, fz),
          bobPos: -0.06,
          bobVel: -0.22,
        });
        sound.playFruitPlop(0.85, 0.75);
        if (type === 'ice') sound.playGlassClink(heroGlass.userData.fillLevel, 0.7);
      }
      heroGlass.userData.sloshVel.x += localX * 0.9;
      daughter.userData.expression = 'delighted';
    } else {
      // Placed on dark counter beside glass as decorative garnish!
      item.position.y = 0.07;
      spillGroup.add(item);
      spillDrops.push(item);
      sound.playFruitPlop(0.2, 1.0);
    }
  } else if (state.dragMode === 'party_glass' && state.dragItem) {
    const g = state.dragItem;
    g.position.y = 0.0;
    // If slid toward the back where family sits (z < -0.08), the nearest person sips & reacts!
    if (g.position.z < -0.05) {
      const people = [daughter, dad, mom, friend];
      let nearest = dad;
      let bestD = 99;
      people.forEach((p) => {
        const d = Math.abs(p.position.x - g.position.x);
        if (d < bestD) { bestD = d; nearest = p; }
      });
      sound.playSip();
      nearest.userData.expression = 'sipping';
      // Drink level actually goes down slightly on sip!
      if (g.userData.layers.length > 0 && g.userData.fillLevel > 0.22) {
        g.userData.layers[g.userData.layers.length - 1].thickness *= 0.88;
        syncGlassLiquidUniforms(g, g.userData.layers, g.userData.foamHeight);
      }
      setTimeout(() => {
        nearest.userData.expression = 'delighted';
        if (g.userData.foamHeight > 0.08) {
          nearest.userData.foamMustache.visible = true; // Cute whipped foam mustache!
        }
        sound.playHappySmile();
      }, 380);
    } else if (state.dragData && state.dragData.moved < 0.04) {
      // Tapped a glass in place -> celebratory Cheers lift!
      g.position.y = 0.16;
      sound.playPartyCheers();
      [daughter, dad, mom, friend].forEach((p) => { p.userData.expression = 'delighted'; });
      setTimeout(() => { g.position.y = 0.0; }, 380);
    }
  }

  state.dragMode = null;
  state.dragItem = null;
  state.dragData = null;
}

window.addEventListener('pointerdown', onPointerDown, { passive: true });
window.addEventListener('pointermove', onPointerMove, { passive: true });
window.addEventListener('pointerup', onPointerUp, { passive: true });
window.addEventListener('pointercancel', onPointerUp, { passive: true });

window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / Math.max(1, h);
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(w, h);
  bokehPipeline.setSize(Math.floor(w * renderer.getPixelRatio()), Math.floor(h * renderer.getPixelRatio()));
  applyStageConfiguration(state.stage);
});

// ============================================================================
// Main Real-Time Physics & Animation Loop
// ============================================================================
const clock = new THREE.Clock();
let fpsSmooth = 60;

applyStageConfiguration('dressup');

function stepSimulation(dt, elapsed) {
  state.idleSeconds += dt;
  for (let i = state.simTimers.length - 1; i >= 0; i--) {
    state.simTimers[i].remaining -= dt;
    if (state.simTimers[i].remaining <= 0) {
      const cb = state.simTimers[i].fn;
      state.simTimers.splice(i, 1);
      cb();
    }
  }

  // 1) Camera organic macro breathing + smooth stage glide
  const breathX = Math.sin(elapsed * 0.65) * 0.012;
  const breathY = Math.cos(elapsed * 0.85) * 0.009;
  camera.position.lerp(
    tmpVec3.set(state.camPosTarget.x + breathX, state.camPosTarget.y + breathY, state.camPosTarget.z),
    Math.min(1, dt * 4.2)
  );
  const currentLook = new THREE.Vector3();
  currentLook.copy(state.camLookTarget);
  camera.lookAt(currentLook);

  state.focusDist += (state.focusDistTarget - state.focusDist) * Math.min(1, dt * 4.5);
  state.focusRange += (state.focusRangeTarget - state.focusRange) * Math.min(1, dt * 4.5);
  state.maxBlur += (state.maxBlurTarget - state.maxBlur) * Math.min(1, dt * 4.5);

  // 2) Drift warm circular bokeh background bulbs gently
  bokehBulbs.forEach((b) => {
    b.mesh.position.y = b.baseY + Math.sin(elapsed * 0.55 + b.phase) * 0.06;
    b.mesh.position.x = b.baseX + Math.cos(elapsed * 0.42 + b.phase) * 0.05;
  });

  // 3) Pictorial sign board damped spring rock
  signBoard.userData.rockVel -= signBoard.userData.rockAngle * 28 * dt;
  signBoard.userData.rockVel *= Math.pow(0.08, dt);
  signBoard.userData.rockAngle += signBoard.userData.rockVel;
  signBoard.rotation.z = signBoard.userData.rockAngle;

  // 4) Blender physics when holding button!
  blender.userData.jarGroup.rotation.z *= Math.pow(0.02, dt);
  blender.userData.liquidMat.uniforms.uTime.value = elapsed;

  if (state.isBlending && state.stage === 'blend') {
    if (state.blenderFruits.length > 0) {
      state.blendDuration += dt;
      recomputeBlenderMixture();
      sound.updateBlender(state.blendDuration, dt);
      blender.userData.liquidMat.uniforms.uVortex.value = THREE.MathUtils.lerp(
        blender.userData.liquidMat.uniforms.uVortex.value,
        1.0,
        dt * 7
      );
      // Spin blades & tumble fruit chunks inside vortex!
      blender.userData.bladeGroup.rotation.y += dt * 42;
      blender.userData.jarGroup.position.x = (Math.random() - 0.5) * 0.008;
      state.blenderFruits.forEach((f, idx) => {
        const ang = elapsed * 14 + idx * 2.1;
        f.mesh.position.x = Math.cos(ang) * 0.11;
        f.mesh.position.z = Math.sin(ang) * 0.11;
        f.mesh.position.y = 0.12 + Math.abs(Math.sin(elapsed * 18 + idx)) * 0.22;
        f.mesh.rotation.x += dt * 12;
      });
    } else {
      blender.userData.bladeGroup.rotation.y += dt * 28;
    }
  } else {
    blender.userData.jarGroup.position.x = 0;
    blender.userData.liquidMat.uniforms.uVortex.value *= Math.pow(0.04, dt);
  }

  if (state.stage === 'blend' && state.blenderFruits.length > 0 && state.blendDuration < 0.25) {
    blender.userData.buttonMat.emissiveIntensity = 0.65 + Math.sin(elapsed * 5.0) * 0.35;
  } else {
    blender.userData.buttonMat.emissiveIntensity = 0.45;
  }

  // 5) Continuous Carafe Pouring Physics (Supports BOTH dragging over glass AND press-and-hold!)
  if (state.dragMode === 'carafe_pour' && state.dragItem) {
    const c = state.dragItem;
    let targetG = heroGlass;
    if (state.stage === 'party') {
      const candidates = [heroGlass, ...partyGlasses];
      let best = 99;
      candidates.forEach((cand) => {
        const d = Math.abs(cand.position.x - c.position.x);
        if (d < best) { best = d; targetG = cand; }
      });
    }
    if (state.dragData && state.dragData.movedPx < 22) {
      state.dragData.holdTime = (state.dragData.holdTime || 0) + dt;
      if (state.dragData.holdTime > 0.12) {
        const sideSign = c.userData.homePos.x >= 0 ? 1 : -1;
        c.position.lerp(
          new THREE.Vector3(targetG.position.x + sideSign * 0.28, targetG.userData.rimY * targetG.scale.y + 0.20, 0.40),
          Math.min(1, dt * 8)
        );
      }
    }

    const dx = c.position.x - targetG.position.x;
    const glassTopY = targetG.userData.rimY * targetG.scale.y;
    if (Math.abs(dx) < 0.68 && c.userData.fillLevel > 0.03) {
      const tiltDir = dx >= 0 ? 1 : -1;
      c.rotation.z = THREE.MathUtils.lerp(c.rotation.z, tiltDir * 1.12, Math.min(1, dt * 12));
      const spoutX = c.position.x - tiltDir * 0.20;
      const spoutY = Math.max(glassTopY + 0.08, c.position.y + 0.18);
      const impactX = THREE.MathUtils.clamp(spoutX, targetG.position.x - 0.22, targetG.position.x + 0.22);
      const surfY =
        (targetG.userData.cavityBottomY +
          targetG.userData.cavityHeight * Math.min(1.0, targetG.userData.fillLevel)) *
        targetG.scale.y;

      const pourLen = Math.max(0.08, spoutY - surfY);
      const batch = c.userData.batchData || { color: new THREE.Color(0xf59218), pulp: 0.2, foam: 0.04 };

      streamMat.color.copy(batch.color);
      streamMat.userData.sss.uSssColor.value.copy(batch.color).multiplyScalar(1.35);
      streamMesh.scale.set(1.0, pourLen, 1.0);
      streamMesh.position.set((spoutX + impactX) * 0.5, surfY + pourLen * 0.5, targetG.position.z);
      streamMesh.rotation.z = (spoutX - impactX) * 0.45;
      streamMesh.visible = true;

      const pourHeight = Math.max(0, spoutY - glassTopY);
      const wallOffset = impactX - targetG.position.x;
      pourIntoGlassStep(batch.color, batch.pulp, batch.foam, targetG, dt, pourHeight, wallOffset);

      if (state.stage === 'layer' && c.userData.layers[0]) {
        c.userData.layers[0].thickness = Math.max(0.12, c.userData.layers[0].thickness - 0.11 * dt);
        syncGlassLiquidUniforms(c, c.userData.layers, c.userData.foamHeight);
      }

      sound.startPour(0.25);
      sound.updatePour(targetG.userData.fillLevel, Math.min(1, pourHeight * 1.5), dt);
      state.pourSettledTimer = 0;
    } else {
      c.rotation.z *= Math.pow(0.05, dt);
      streamMesh.visible = false;
      sound.stopPour();
    }
  }

  if (state.stage === 'layer' && !state.dadGoofTriggered && !state.pointerDown && heroGlass.userData.fillLevel >= 0.68) {
    state.pourSettledTimer += dt;
    if (state.pourSettledTimer > 0.75) {
      triggerDadSourGoofUp();
    }
  }

  // 6) Animate Dad's Fumbled Sour Lemon Goof-Up Sequence!
  if (state.dadGoofAnimTime >= 0) {
    state.dadGoofAnimTime += dt;
    const t = state.dadGoofAnimTime;
    const waitOffset = dad.userData.expression === 'curious' && t < 1.05 ? 0 : dad.userData.expression === 'curious' ? 1.05 : 0;

    if (t >= waitOffset && t < waitOffset + 0.65) {
      const p = (t - waitOffset) / 0.65;
      dadFumbleLemon.visible = true;
      if (p < 0.55) {
        const k = p / 0.55;
        dadFumbleLemon.position.set(
          THREE.MathUtils.lerp(0.62, 0.02, k),
          THREE.MathUtils.lerp(1.38, 1.18, k) + Math.sin(k * Math.PI) * 0.16,
          THREE.MathUtils.lerp(-0.45, 0.42, k)
        );
        dadFumbleLemon.rotation.z += dt * 9;
      } else {
        if (!dadFumbleLemon.userData.splashed) {
          dadFumbleLemon.userData.splashed = true;
          sound.playFruitPlop(0.9, 0.85);
          heroGlass.userData.sloshVel.x = 0.85;
          heroGlass.userData.liquidMat.uniforms.uSourRipple.value = 1.0;
          spawnCounterDroplet(0.18, 0.52, 0xebdb23, 1.1);
          spawnCounterDroplet(-0.16, 0.48, 0xebdb23, 0.85);
        }
        const k2 = (p - 0.55) / 0.45;
        dadFumbleLemon.position.set(
          THREE.MathUtils.lerp(0.02, 0.46, k2),
          THREE.MathUtils.lerp(1.18, 0.07, k2 * k2),
          THREE.MathUtils.lerp(0.42, 0.68, k2)
        );
      }
    } else if (t >= waitOffset + 0.65 && t < waitOffset + 1.10) {
      if (!dadFumbleLemon.userData.sipped) {
        dadFumbleLemon.userData.sipped = true;
        dad.userData.expression = 'sipping';
        sound.playSip();
      }
    } else if (t >= waitOffset + 1.10) {
      dad.userData.expression = 'sour';
      daughter.userData.expression = 'curious';
      sound.playSourPucker();
      dadFumbleLemon.userData.splashed = false;
      dadFumbleLemon.userData.sipped = false;
      state.dadGoofAnimTime = -1;
      applyStageConfiguration('sweet_rescue');
    }
  }

  // 7) Sweetener Drizzle Physics in Sweet Rescue sub-stage (supports BOTH drag AND press-and-hold!)
  if (state.dragMode === 'sweet_pour' && state.dragItem) {
    const sw = state.dragItem;
    if (state.dragData && state.dragData.movedPx < 22) {
      state.dragData.holdTime = (state.dragData.holdTime || 0) + dt;
      if (state.dragData.holdTime > 0.12) {
        const sideSign = sw.userData.homePos.x >= 0 ? 1 : -1;
        sw.position.lerp(new THREE.Vector3(sideSign * 0.24, 1.34, 0.40), Math.min(1, dt * 8));
      }
    }
    const dx = sw.position.x - heroGlass.position.x;
    if (Math.abs(dx) < 0.62) {
      const tiltDir = dx >= 0 ? 1 : -1;
      sw.rotation.z = THREE.MathUtils.lerp(sw.rotation.z, tiltDir * 0.95, Math.min(1, dt * 10));
      const spoutX = sw.position.x - tiltDir * 0.14;
      const spoutY = Math.max(1.26, sw.position.y + 0.12);
      const surfY =
        (heroGlass.userData.cavityBottomY + heroGlass.userData.cavityHeight * heroGlass.userData.fillLevel) *
        heroGlass.scale.y;
      const len = Math.max(0.08, spoutY - surfY);

      const swCol = new THREE.Color(sw.userData.color);
      streamMat.color.copy(swCol);
      streamMat.userData.sss.uSssColor.value.copy(swCol).multiplyScalar(1.3);
      streamMesh.scale.set(0.68, len, 0.68);
      streamMesh.position.set(
        spoutX * 0.5 + Math.sin(elapsed * 9.0) * 0.04,
        surfY + len * 0.5,
        heroGlass.position.z
      );
      streamMesh.rotation.z = Math.cos(elapsed * 9.0) * 0.08;
      streamMesh.visible = true;

      state.sweetAdded += dt * 0.42;
      const u = heroGlass.userData.liquidMat.uniforms;
      u.uSweetColor.value.lerp(swCol, Math.min(1, dt * 5));
      u.uSweetSwirl.value = Math.min(1.0, state.sweetAdded);
      u.uSourRipple.value = Math.max(0.0, 1.0 - state.sweetAdded * 2.2);

      sound.startPour(sw.userData.viscosity);
      sound.updatePour(0.85, 0.2, dt);
    } else {
      sw.rotation.z *= Math.pow(0.05, dt);
      streamMesh.visible = false;
      sound.stopPour();
    }
  }

  // 8) Update Slosh & Buoyant Floating Toppings across ALL crystal glasses!
  const allGlasses = [welcomeGlass, heroGlass, ...miniCarafes, ...partyGlasses];
  allGlasses.forEach((g) => {
    if (!g.visible) return;
    const ud = g.userData;
    ud.liquidMat.uniforms.uTime.value = elapsed;

    ud.sloshVel.x -= ud.sloshPos.x * 26.0 * dt;
    ud.sloshVel.y -= ud.sloshPos.y * 26.0 * dt;
    ud.sloshVel.multiplyScalar(Math.pow(0.08, dt));
    ud.sloshPos.addScaledVector(ud.sloshVel, dt);
    ud.liquidMat.uniforms.uSlosh.value.copy(ud.sloshPos);

    const surfY = ud.cavityBottomY + ud.cavityHeight * Math.max(0.32, ud.fillLevel);
    ud.toppings.forEach((t, idx) => {
      if (t.floating) {
        t.bobVel = (t.bobVel || 0) - (t.bobPos || 0) * 22.0 * dt;
        t.bobVel *= Math.pow(0.12, dt);
        t.bobPos = (t.bobPos || 0) + t.bobVel * dt;
        const wave = Math.sin(elapsed * 2.6 + idx * 1.4) * 0.008;
        t.mesh.position.y = surfY + t.baseOffset.y + t.bobPos + wave;
        t.mesh.rotation.z = ud.sloshPos.x * 0.8 + Math.sin(elapsed * 1.9 + idx) * 0.06;
      }
    });
  });

  if (orderBubble.visible) {
    orderBubble.position.y = 1.15 + Math.sin(elapsed * 1.8) * 0.035;
    orderBubble.rotation.y = Math.sin(elapsed * 0.7) * 0.18;
  }

  if (state.idleSeconds > 10.2 && !state.pointerDown) {
    const cycle = state.idleSeconds - 10.2;
    if (cycle < 2.2) {
      const p = cycle / 2.2;
      if (state.stage === 'dressup') {
        apronProps[0].rotation.z = Math.sin(p * Math.PI * 3) * 0.07;
      } else if (state.stage === 'blend' && handCursor.visible) {
        const target = state.blenderFruits.length === 0
          ? new THREE.Vector3(-0.64, 0.32, 0.72)
          : new THREE.Vector3(0.18, 0.34, 0.62);
        handCursor.userData.targetPos.lerp(target, Math.sin(p * Math.PI) * 0.12);
      } else if (state.stage === 'layer' && handCursor.visible) {
        handCursor.userData.targetPos.set(
          THREE.MathUtils.lerp(-0.72, 0.0, Math.sin(p * Math.PI)),
          0.95,
          0.62
        );
      } else if (state.stage === 'sweet_rescue' && handCursor.visible) {
        handCursor.userData.targetPos.set(
          THREE.MathUtils.lerp(-0.68, 0.0, Math.sin(p * Math.PI)),
          0.95,
          0.65
        );
      }
    } else if (cycle > 8.0) {
      state.idleSeconds = 4.0;
    }
  }

  [daughter, dad, mom, friend].forEach((ch) => {
    if (ch.visible) updatePersonCharacter(ch, dt, elapsed);
  });
  if (handCursor.visible) {
    updateChildHandCursor(handCursor, dt, state.pointerDown);
  }

  bokehPipeline.render(scene, camera, state.focusDist, state.focusRange, state.maxBlur);
}

function animate() {
  requestAnimationFrame(animate);
  const rawDt = clock.getDelta();
  const dt = Math.min(0.05, rawDt);
  if (rawDt > 0.0001) fpsSmooth = fpsSmooth * 0.92 + (1 / rawDt) * 0.08;
  stepSimulation(dt, clock.elapsedTime);
}

animate();

// ============================================================================
// Headless Verification & Inspection API (No visible UI, strictly internal)
// ============================================================================
window.__juiceDebug = {
  getStats: () => ({
    stage: state.stage,
    fps: Math.round(fpsSmooth),
    triangles: bokehPipeline.sceneTriangles,
    calls: bokehPipeline.sceneCalls,
    pixelRatio: renderer.getPixelRatio(),
    heroFill: Number(heroGlass.userData.fillLevel.toFixed(3)),
    heroLayers: heroGlass.userData.layers.length,
    toppings: heroGlass.userData.toppings.length,
    dadExpr: dad.userData.expression,
    daughterApron: state.apronChoice,
  }),
  forceStep: (steps = 30, dt = 0.05) => {
    for (let i = 0; i < steps; i++) {
      stepSimulation(dt, clock.elapsedTime + i * dt);
    }
  },
  jumpToShowcaseScene: (mode = 'layer_macro') => {
    state.apronChoice = 'berry';
    daughter.userData.wornApron.visible = true;
    handCursor.visible = true;
    if (mode === 'blend') {
      applyStageConfiguration('blend');
      addFruitToBlender(FRUIT_CATALOG[0], createFruitPieceMesh('strawberry', fruitTextures, false));
      addFruitToBlender(FRUIT_CATALOG[1], createFruitPieceMesh('orange', fruitTextures, false));
      state.blendDuration = 2.4;
      recomputeBlenderMixture();
      decantBlenderIntoCarafe(miniCarafes[0]);
      addFruitToBlender(FRUIT_CATALOG[3], createFruitPieceMesh('kiwi', fruitTextures, false));
      state.blendDuration = 1.2;
      recomputeBlenderMixture();
    } else if (mode === 'sour_dad') {
      applyStageConfiguration('layer');
      syncGlassLiquidUniforms(heroGlass, [
        { color: new THREE.Color(0x4e259e), thickness: 0.24, blur: 0.012, pulp: 0.25 },
        { color: new THREE.Color(0xd91936), thickness: 0.26, blur: 0.018, pulp: 0.45 },
        { color: new THREE.Color(0xf4b616), thickness: 0.24, blur: 0.014, pulp: 0.20 },
      ], 0.07);
      heroGlass.userData.liquidMat.uniforms.uSourRipple.value = 0.85;
      dad.userData.expression = 'sour';
      applyStageConfiguration('sweet_rescue');
    } else if (mode === 'topping_hero') {
      applyStageConfiguration('topping');
      syncGlassLiquidUniforms(heroGlass, [
        { color: new THREE.Color(0xd91936), thickness: 0.28, blur: 0.011, pulp: 0.35 },
        { color: new THREE.Color(0xf58414), thickness: 0.24, blur: 0.022, pulp: 0.25 },
        { color: new THREE.Color(0xf4c418), thickness: 0.20, blur: 0.014, pulp: 0.15 },
        { color: new THREE.Color(0x45b526), thickness: 0.18, blur: 0.012, pulp: 0.55 },
      ], 0.085);
      heroGlass.userData.liquidMat.uniforms.uSweetSwirl.value = 0.55;
      const st = createToppingMesh('straw_red', fruitTextures, condensationTex);
      st.scale.setScalar(0.85);
      st.position.set(0.16, heroGlass.userData.rimY - 0.14, 0);
      st.rotation.z = -0.22;
      heroGlass.add(st);
      heroGlass.userData.toppings.push({ mesh: st, isStraw: true });

      const orangeRim = createToppingMesh('rim_orange', fruitTextures, condensationTex);
      orangeRim.position.set(-0.35, heroGlass.userData.rimY + 0.02, 0.05);
      orangeRim.rotation.z = 0.25;
      heroGlass.add(orangeRim);
      heroGlass.userData.toppings.push({ mesh: orangeRim, floating: false });

      const ch = createToppingMesh('cherry', fruitTextures, condensationTex);
      ch.position.set(-0.04, heroGlass.userData.cavityBottomY + heroGlass.userData.cavityHeight * 0.9 + 0.025, 0.06);
      heroGlass.add(ch);
      heroGlass.userData.toppings.push({ mesh: ch, floating: true, baseOffset: new THREE.Vector3(-0.04, 0.025, 0.06), bobPos: 0, bobVel: 0 });
    } else if (mode === 'party') {
      window.__juiceDebug.jumpToShowcaseScene('topping_hero');
      applyStageConfiguration('party');
    }
  },
};
