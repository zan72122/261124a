import * as THREE from 'three';
import { ZooAudio } from './audio.js';
import {
  createOvercastEnvironment,
  createFurStrandDataTexture,
  createZebraCoatTexture,
  createElephantSkinTextures,
  createTigerCoatTexture,
  createLionCoatTexture,
  createGiraffeCoatTexture,
  createFoamBubbleTexture,
  createGroundTextures,
  createWoodTexture,
  createWatermelonTextures,
  createSignboardTexture
} from './textures.js';
import { FoamSystem, WaterSystem } from './foamAndWater.js';
import {
  createZebra,
  createElephant,
  createTiger,
  createLion,
  createGiraffe
} from './animals.js';
import {
  createKeeperGirl,
  createKeeperHand,
  createDad
} from './characters.js';
import { createSanctuaryEnvironment } from './environment.js';
import { ZooSimulationScenes } from './scenes.js';

const container = document.getElementById('app');

// Photorealistic WebGLRenderer with ACESFilmicToneMapping & PixelRatio <= 1.5
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance'
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(44, window.innerWidth / window.innerHeight, 0.1, 90);
camera.position.set(0, 1.25, 3.2);

// Procedural Overcast Sky Environment & PBR Textures (all <= 1024px, zero external assets)
const { envMap, skyTexture } = createOvercastEnvironment(renderer);
scene.environment = envMap;
scene.environmentIntensity = 0.92;

const elephantSkin = createElephantSkinTextures();
const melonTex = createWatermelonTextures();

const textures = {
  strandMap: createFurStrandDataTexture(),
  zebraMap: createZebraCoatTexture(),
  elephantMap: elephantSkin.map,
  elephantBump: elephantSkin.bumpMap,
  tigerMap: createTigerCoatTexture(),
  lionMap: createLionCoatTexture(),
  giraffeMap: createGiraffeCoatTexture(),
  bubbleMap: createFoamBubbleTexture(),
  groundMap: createGroundTextures(),
  woodMap: createWoodTexture(),
  watermelonRind: melonTex.rindMap,
  redFleshMap: melonTex.redFleshMap,
  goldFleshMap: melonTex.goldFleshMap,
  signMaps: [
    createSignboardTexture(0),
    createSignboardTexture(1),
    createSignboardTexture(2),
    createSignboardTexture(3)
  ]
};

const audio = new ZooAudio();
const env = createSanctuaryEnvironment(scene, textures, skyTexture);
const foam = new FoamSystem(scene, textures.bubbleMap, 1500);
const water = new WaterSystem(scene, 1400);

const animals = {
  zebra: createZebra(textures),
  elephant: createElephant(textures),
  tiger: createTiger(textures),
  lion: createLion(textures),
  giraffe: createGiraffe(textures)
};
Object.values(animals).forEach((a) => scene.add(a.root));

const girl = createKeeperGirl();
scene.add(girl.root);

const hand = createKeeperHand(textures);
scene.add(hand.root);

const dad = createDad();
scene.add(dad.root);

const sim = new ZooSimulationScenes({
  scene,
  camera,
  audio,
  textures,
  env,
  foam,
  water,
  animals,
  girl,
  hand,
  dad
});

// Expose debug handle for automated render/triangle/FPS verification
window.__zooGame = { renderer, scene, camera, sim, animals, foam, water, env, girl, hand, dad };

// Unified Single-Finger Pointer Input (Multi-touch tolerant: tracks primary active finger cleanly!)
let activePointerId = null;

function toNDC(clientX, clientY) {
  return [
    (clientX / window.innerWidth) * 2 - 1,
    -(clientY / window.innerHeight) * 2 + 1
  ];
}

renderer.domElement.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  if (activePointerId === null) {
    activePointerId = e.pointerId;
    const [nx, ny] = toNDC(e.clientX, e.clientY);
    sim.onPointerDown(nx, ny);
  }
}, { passive: false });

window.addEventListener('pointermove', (e) => {
  if (e.pointerId === activePointerId || activePointerId === null) {
    const [nx, ny] = toNDC(e.clientX, e.clientY);
    sim.onPointerMove(nx, ny);
  }
}, { passive: true });

const endPointer = (e) => {
  if (e.pointerId === activePointerId) {
    activePointerId = null;
    sim.onPointerUp();
  }
};
window.addEventListener('pointerup', endPointer);
window.addEventListener('pointercancel', endPointer);

window.addEventListener('resize', () => {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / Math.max(1, window.innerHeight);
  camera.updateProjectionMatrix();
  water.resizeLens();
});

// Main High-Stability Simulation Loop
const clock = new THREE.Clock();
let elapsed = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());
  elapsed += dt;
  sim.update(dt, elapsed);
  renderer.render(scene, camera);
}
animate();
