import * as THREE from 'three';
import {
  BALL_RADIUS,
  MAX_BALLS,
  POOL_CONFIG,
  SLIDE_CONFIG,
  BallPhysicsWorld
} from './physics.js';
import {
  BALL_COLORS,
  createStudioEnvironment,
  createPlayroomEnvironment
} from './environment.js';
import { createPlasticBallBumpTexture } from './textures.js';
import {
  createHumanFigure,
  createFoldedOutfits,
  createPlayerHand
} from './characters.js';
import { SoundEngine } from './audio.js';

// ---- Renderer & Overhead Commercial Photography Camera Setup ----
const canvas = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: true
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.96; // Balanced studio commercial photo exposure!
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xc8ad8c);

// Fixed overhead camera ("真上の俯瞰カメラ" & "カメラはプレイヤーが動かさない")
const camera = new THREE.PerspectiveCamera(36, window.innerWidth / window.innerHeight, 0.2, 18);
const BASE_CAM_POS = new THREE.Vector3(0.0, 4.85, 0.34);
const BASE_CAM_TARGET = new THREE.Vector3(0.0, 0.06, 0.04);

function updateCameraFraming() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(w, h);
  camera.aspect = w / h;

  // Tighter commercial photography framing so the colorful ball pit fills the frame!
  const targetWidth = 3.92;
  const targetHeight = 2.88;
  const dist = BASE_CAM_POS.distanceTo(BASE_CAM_TARGET);
  const reqHalfH = Math.max(targetHeight * 0.5, (targetWidth * 0.5) / camera.aspect);
  const vFovRad = 2 * Math.atan(reqHalfH / dist);
  camera.fov = THREE.MathUtils.radToDeg(vFovRad);
  camera.updateProjectionMatrix();
}
updateCameraFraming();
window.addEventListener('resize', updateCameraFraming);

// Studio / Sunlit Living-Room Environment Map & Balanced Directional Sun Key
scene.environment = createStudioEnvironment(renderer);

const hemiLight = new THREE.HemisphereLight(0xfff6e8, 0x9c7650, 0.48);
scene.add(hemiLight);

const sunKey = new THREE.DirectionalLight(0xfff7ea, 1.48);
sunKey.position.set(-2.4, 5.6, -1.8);
sunKey.castShadow = true;
sunKey.shadow.mapSize.set(1024, 1024);
sunKey.shadow.camera.near = 1.0;
sunKey.shadow.camera.far = 12.0;
sunKey.shadow.camera.left = -3.6;
sunKey.shadow.camera.right = 3.6;
sunKey.shadow.camera.top = 3.6;
sunKey.shadow.camera.bottom = -3.6;
sunKey.shadow.bias = -0.0005;
sunKey.shadow.normalBias = 0.016;
scene.add(sunKey);

const skyFill = new THREE.DirectionalLight(0xdceeff, 0.38);
skyFill.position.set(2.8, 4.2, 2.2);
scene.add(skyFill);

// ---- Physics & Playroom World ----
const sound = new SoundEngine();
const physics = new BallPhysicsWorld();
const env = createPlayroomEnvironment(scene, physics.shadowTexture);

env.crateMeshes.forEach((cm, idx) => {
  physics.crates[idx].x = cm.homeX;
  physics.crates[idx].z = cm.homeZ;
});

physics.floorBounceCallback = (colorId, speed, xPos) => {
  sound.playBallPop(colorId, Math.min(1.0, (speed - 1.1) * 0.35), xPos * 0.4, 'wood');
};

// ---- Glossy LDPE Plastic Ball InstancedMesh (< 300,000 triangles strictly!) ----
// SphereGeometry(R, 11, 6): 11 + 11 + 4*22 = 110 tris * 2,250 balls = 247,500 tris max!
const ballGeo = new THREE.SphereGeometry(BALL_RADIUS, 11, 6);
const shadeAttr = new THREE.InstancedBufferAttribute(new Float32Array(MAX_BALLS), 1);
shadeAttr.setUsage(THREE.DynamicDrawUsage);
ballGeo.setAttribute('aShade', shadeAttr);

const ballBump = createPlasticBallBumpTexture();
const ballMat = new THREE.MeshPhysicalMaterial({
  color: 0xffffff,
  roughness: 0.11,
  metalness: 0.0,
  clearcoat: 1.0,
  clearcoatRoughness: 0.05,
  ior: 1.50,
  bumpMap: ballBump,
  bumpScale: 0.0014,
  envMapIntensity: 1.45
});

// Apply thin-walled LDPE subsurface glow, commercial color-graded shadow tint,
// AND razor-sharp analytical studio 2-pane balcony window reflection on glossy plastic!
ballMat.onBeforeCompile = (shader) => {
  shader.vertexShader = shader.vertexShader
    .replace(
      '#include <common>',
      `#include <common>
      attribute float aShade;
      varying float vShade;
      varying vec3 vWorldNorm;
      varying vec3 vWorldPos;`
    )
    .replace(
      '#include <beginnormal_vertex>',
      `#include <beginnormal_vertex>
      vShade = aShade;
      vec3 instN = objectNormal;
      #ifdef USE_INSTANCING
        instN = mat3( instanceMatrix ) * instN;
      #endif
      vWorldNorm = normalize( mat3( modelMatrix ) * instN );`
    )
    .replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      vec4 wp = vec4( transformed, 1.0 );
      #ifdef USE_INSTANCING
        wp = instanceMatrix * wp;
      #endif
      vWorldPos = ( modelMatrix * wp ).xyz;`
    );

  shader.fragmentShader = shader.fragmentShader
    .replace(
      '#include <common>',
      `#include <common>
      varying float vShade;
      varying vec3 vWorldNorm;
      varying vec3 vWorldPos;`
    )
    .replace(
      '#include <lights_fragment_end>',
      `#include <lights_fragment_end>
      vec3 N = normalize(vWorldNorm);
      vec3 V = normalize(cameraPosition - vWorldPos);
      vec3 R = reflect(-V, N);
      float occ = clamp(vShade, 0.0, 1.0);

      // 1. Commercial-grade warm subsurface & shadow hue shift (bright sunny Yellow, vibrant Pink & Sky-Blue!)
      vec3 sunDir = normalize(vec3(-0.38, 0.86, -0.30));
      float wrap = clamp(dot(N, sunDir) * 0.5 + 0.5, 0.0, 1.0);
      vec3 warmDeep = vec3(
        pow(diffuseColor.r, 0.86),
        pow(diffuseColor.g, 0.98),
        pow(diffuseColor.b, 1.04)
      );
      vec3 sssGlow = mix(warmDeep, diffuseColor.rgb, wrap) * (0.42 * wrap + 0.24) * (1.0 - occ * 0.34);
      reflectedLight.indirectDiffuse += sssGlow;

      // Rich saturated shadow cavities between stacked spheres
      vec3 cavityColor = mix(vec3(1.0), warmDeep * 0.78 + vec3(0.22), occ * 0.82);
      reflectedLight.directDiffuse *= mix(1.0, 0.48, occ) * cavityColor;
      reflectedLight.indirectDiffuse *= mix(1.0, 0.40, occ) * cavityColor;

      // 2. Razor-sharp curved 2-pane studio window specular catchlight + Fresnel plastic rim!
      vec3 winCenter = normalize(vec3(-0.36, 0.88, -0.30));
      vec3 winRight = normalize(cross(vec3(0.0, 1.0, 0.0), winCenter));
      vec3 winUp = cross(winCenter, winRight);
      float rDot = dot(R, winCenter);
      if (rDot > 0.0) {
        float uWin = dot(R, winRight) / max(0.15, rDot);
        float vWin = dot(R, winUp) / max(0.15, rDot);
        float boxMask = (1.0 - smoothstep(0.19, 0.24, abs(uWin))) * (1.0 - smoothstep(0.13, 0.18, abs(vWin)));
        float mullion = smoothstep(0.010, 0.020, abs(uWin - 0.01));
        float winSpec = boxMask * (0.26 + 0.74 * mullion) * mix(1.0, 0.52, occ);
        reflectedLight.indirectSpecular += vec3(2.85, 2.80, 2.68) * winSpec;
      }

      // Secondary soft overhead fill catchlight + glossy Fresnel plastic rim
      vec3 fillDir = normalize(vec3(0.28, 0.92, 0.24));
      float fillCatch = smoothstep(0.955, 0.985, dot(R, fillDir)) * mix(0.55, 0.22, occ);
      float fresnel = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 4.0);
      reflectedLight.indirectSpecular += vec3(1.1, 1.15, 1.25) * fillCatch + vec3(0.22, 0.21, 0.20) * fresnel * (1.0 - occ * 0.5);
      reflectedLight.directSpecular *= mix(1.0, 0.50, occ);
      `
    );
};

const ballInstMesh = new THREE.InstancedMesh(ballGeo, ballMat, MAX_BALLS);
ballInstMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
ballInstMesh.count = 0;
ballInstMesh.frustumCulled = false;
const initCol = new THREE.Color();
for (let i = 0; i < MAX_BALLS; i++) {
  ballInstMesh.setColorAt(i, initCol.setHex(0xffffff));
}
scene.add(ballInstMesh);

// ---- Characters, Outfits & Player's Hand ----
const girl = createHumanFigure('girl');
girl.root.position.set(0.14, 0.02, -0.94);
girl.root.rotation.y = 0.0;
scene.add(girl.root);

const dad = createHumanFigure('dad');
dad.root.position.set(1.44, 0.02, -0.45);
dad.root.rotation.y = -1.15;
dad.root.visible = false;
scene.add(dad.root);

const mom = createHumanFigure('mom');
mom.root.position.set(-1.58, 0.72, 0.04);
mom.root.rotation.y = 1.52;
mom.root.visible = false;
scene.add(mom.root);

const outfits = createFoldedOutfits(scene);
const playerHand = createPlayerHand(scene);

const handCollider = { active: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, r: 0.15, bounce: 1.45, upBoost: 0, radialBoost: 0 };
const girlCollider = { active: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, r: 0.22, bounce: 1.5, upBoost: 0, radialBoost: 0 };
const dadCollider  = { active: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, r: 0.26, bounce: 1.6, upBoost: 0, radialBoost: 0 };
const momCollider  = { active: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, r: 0.28, bounce: 1.8, upBoost: 0, radialBoost: 0 };
physics.colliders.push(handCollider, girlCollider, dadCollider, momCollider);

// ---- Game Simulation State ----
const game = {
  phase: 'dressup',
  selectedOutfit: -1,
  pourSequence: [],
  fillGoalCount: 1750,
  poolFullReached: false,
  poolFullHoldTimer: 0,
  splashCount: 0,
  momMishapTriggered: false,
  momSlideTimer: -1,
  applauseTriggered: false,
  applauseTimer: 0,
  camShake: 0,
  idleSeconds: 0,
  simTime: 0
};

const pointer = {
  activeId: null,
  down: false,
  ndc: new THREE.Vector2(),
  world: new THREE.Vector3(0, 0.2, 0.6),
  prevWorld: new THREE.Vector3(0, 0.2, 0.6),
  vel: new THREE.Vector3(),
  mode: 'none',
  draggedOutfit: -1,
  heldBagIdx: -1,
  heldChar: null,
  heldCrateIdx: -1,
  pourEmitCarry: 0,
  scoopedIndices: []
};

const raycaster = new THREE.Raycaster();
const hitPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.10);

function screenToWorld(clientX, clientY, planeY = 0.10, out = new THREE.Vector3()) {
  pointer.ndc.x = (clientX / window.innerWidth) * 2 - 1;
  pointer.ndc.y = -(clientY / window.innerHeight) * 2 + 1;
  hitPlane.constant = -planeY;
  raycaster.setFromCamera(pointer.ndc, camera);
  raycaster.ray.intersectPlane(hitPlane, out);
  out.x = Math.max(-1.92, Math.min(1.92, out.x));
  out.z = Math.max(-1.36, Math.min(1.36, out.z));
  return out;
}

const tempColor = new THREE.Color();
const hslObj = { h: 0, s: 0, l: 0 };
function emitBall(x, y, z, vx, vy, vz, colorId) {
  const idx = physics.spawnBall(x, y, z, vx, vy, vz, colorId);
  if (idx === -1) return -1;
  BALL_COLORS[colorId].getHSL(hslObj);
  tempColor.setHSL(
    (hslObj.h + (Math.random() - 0.5) * 0.016 + 1) % 1,
    Math.min(1.0, hslObj.s + (Math.random() - 0.5) * 0.03),
    Math.min(0.82, Math.max(0.38, hslObj.l + (Math.random() - 0.5) * 0.04))
  );
  ballInstMesh.setColorAt(idx, tempColor);
  ballInstMesh.instanceColor.needsUpdate = true;
  ballInstMesh.count = physics.count;
  return idx;
}

function chooseOutfit(outfitIdx) {
  if (game.phase !== 'dressup') return;
  game.selectedOutfit = outfitIdx;
  girl.setOutfit(outfitIdx);
  playerHand.setOutfit(outfitIdx);
  playerHand.root.visible = true;
  girl.setExpression('joy', 1.8);
  sound.playDressUp(outfitIdx);

  game.phase = 'pour';
  game.idleSeconds = 0;
  env.redrawSignboard(0);

  // Slide the 3 plump mesh bags forward into the ergonomic foreground pouring zone!
  env.bags.forEach((b) => {
    b.homeX = b.pourX;
    b.homeZ = b.pourZ;
  });
}

const activeJumps = [];
function triggerCharacterJump(charObj, targetX, targetZ, power = 1.0) {
  const clampedX = Math.max(POOL_CONFIG.cx - 0.62, Math.min(POOL_CONFIG.cx + 0.62, targetX));
  const clampedZ = Math.max(POOL_CONFIG.cz - 0.42, Math.min(POOL_CONFIG.cz + 0.42, targetZ));

  charObj.setExpression('excited', 1.8);
  sound.playSlideWhoosh(0.28, false);

  activeJumps.push({
    charObj,
    startX: charObj.root.position.x,
    startY: charObj.root.position.y,
    startZ: charObj.root.position.z,
    endX: clampedX,
    endY: 0.05,
    endZ: clampedZ,
    t: 0,
    dur: 0.46,
    power,
    landed: false
  });
}

function startMomSlideMishap() {
  if (game.momMishapTriggered) return;
  game.momMishapTriggered = true;
  mom.root.visible = true;
  mom.root.position.set(SLIDE_CONFIG.xTop - 0.08, SLIDE_CONFIG.yTop - 0.02, SLIDE_CONFIG.cz);
  mom.root.rotation.y = Math.PI * 0.5;
  mom.setExpression('excited', 2.0);
  girl.setExpression('excited', 1.6);
  dad.setExpression('excited', 1.6);
  game.momSlideTimer = 0.0;
}

let lastHuhTime = -10;
physics.onCrateBallAdded = (crateIdx, ballColorId) => {
  const crate = physics.crates[crateIdx];
  env.crateMeshes[crateIdx].bounce = 0.16;
  const fillRatio = Math.min(1, crate.count / 90);
  sound.playCrateDrop(ballColorId, fillRatio);

  const watcher = crateIdx === 0 ? mom : crateIdx === 1 ? girl : dad;
  if (ballColorId !== crate.colorId) {
    watcher.setExpression('huh', 1.9);
    if (girl !== watcher) girl.setExpression('huh', 1.9);
    const nowSec = game.simTime;
    if (nowSec - lastHuhTime > 1.0) {
      lastHuhTime = nowSec;
      sound.playHuhThenJoy();
    }
  } else {
    watcher.setExpression('excited', 0.9);
  }
};

function releaseScoopedBalls(dropX, dropZ) {
  if (pointer.scoopedIndices.length === 0) return;

  let targetCrate = null;
  if (physics.cratesActive) {
    for (let c = 0; c < physics.crates.length; c++) {
      const cr = physics.crates[c];
      const dist = Math.hypot(dropX - cr.x, dropZ - cr.z);
      if (dist < 0.54) {
        targetCrate = cr;
        break;
      }
    }
  }

  const count = pointer.scoopedIndices.length;
  for (let k = 0; k < count; k++) {
    const idx = pointer.scoopedIndices[k];
    if (targetCrate) {
      physics.state[idx] = 1;
      physics.crateId[idx] = targetCrate.id;
      physics.px[idx] = targetCrate.x + (Math.random() - 0.5) * (targetCrate.hx * 1.3);
      physics.py[idx] = targetCrate.h + 0.02 + k * 0.018;
      physics.pz[idx] = targetCrate.z + (Math.random() - 0.5) * (targetCrate.hz * 1.3);
      physics.vx[idx] = (Math.random() - 0.5) * 0.35;
      physics.vy[idx] = -0.8;
      physics.vz[idx] = (Math.random() - 0.5) * 0.35;
      targetCrate.count++;
      if (physics.colorId[idx] === targetCrate.colorId) targetCrate.pureCount++;
      if (k === 0 || physics.colorId[idx] !== targetCrate.colorId) {
        physics.onCrateBallAdded(targetCrate.id, physics.colorId[idx], idx);
      }
    } else {
      physics.state[idx] = 0;
      physics.crateId[idx] = -1;
      physics.vy[idx] = -0.5;
      physics.vx[idx] = pointer.vel.x * 0.55 + (Math.random() - 0.5) * 0.3;
      physics.vz[idx] = pointer.vel.z * 0.55 + (Math.random() - 0.5) * 0.3;
    }
  }
  pointer.scoopedIndices.length = 0;
}

let signWobble = 0;
let poolWobble = 0;

function onPointerDown(e) {
  if (pointer.activeId !== null && pointer.activeId !== e.pointerId) return;
  pointer.activeId = e.pointerId;
  pointer.down = true;
  sound.unlock();
  game.idleSeconds = 0;

  screenToWorld(e.clientX, e.clientY, 0.12, pointer.world);
  pointer.prevWorld.copy(pointer.world);
  pointer.vel.set(0, 0, 0);
  const wx = pointer.world.x;
  const wz = pointer.world.z;

  if (Math.hypot(wx - env.signGroup.position.x, wz - env.signGroup.position.z) < 0.48) {
    signWobble = 0.22;
    sound.playSoftWobble();
  }

  if (game.phase === 'dressup') {
    let picked = -1;
    let bestD = 0.48;
    outfits.forEach((o, idx) => {
      const d = Math.hypot(wx - o.group.position.x, wz - o.group.position.z);
      if (d < bestD) {
        bestD = d;
        picked = idx;
      }
    });
    if (picked !== -1) {
      pointer.mode = 'outfit';
      pointer.draggedOutfit = picked;
      sound.playSoftWobble();
    } else if (Math.hypot(wx - girl.root.position.x, wz - girl.root.position.z) < 0.42) {
      girl.setExpression('excited', 1.0);
      sound.playSoftWobble();
    } else {
      poolWobble = 0.06;
      sound.playSoftWobble();
    }
    return;
  }

  if (game.phase === 'pour' || game.phase === 'freeplay') {
    if (game.phase === 'freeplay') {
      for (let c = 0; c < env.crateMeshes.length; c++) {
        const cm = env.crateMeshes[c];
        if (physics.crates[c].count > 0 && Math.hypot(wx - cm.group.position.x, wz - cm.group.position.z) < 0.42) {
          pointer.mode = 'crate_pour';
          pointer.heldCrateIdx = c;
          sound.playSoftWobble();
          return;
        }
      }
    }

    let bestBag = -1;
    let bestBagD = 0.46;
    env.bags.forEach((b, idx) => {
      const d = Math.hypot(wx - b.group.position.x, wz - b.group.position.z);
      if (d < bestBagD) {
        bestBagD = d;
        bestBag = idx;
      }
    });
    if (bestBag !== -1 && physics.count < MAX_BALLS) {
      pointer.mode = 'bag';
      pointer.heldBagIdx = bestBag;
      girl.setExpression('pour', 1.2);
      return;
    }

    if (game.phase === 'pour' && game.poolFullReached) {
      if (Math.hypot(wx - girl.root.position.x, wz - girl.root.position.z) < 0.48) {
        enterSplashPhase();
        return;
      }
    }

    if (game.phase === 'freeplay') {
      if (Math.hypot(wx - dad.root.position.x, wz - dad.root.position.z) < 0.42) {
        triggerCharacterJump(dad, POOL_CONFIG.cx + 0.24, POOL_CONFIG.cz, 1.15);
        return;
      }
      if (Math.hypot(wx - mom.root.position.x, wz - mom.root.position.z) < 0.42) {
        mom.hairBall.visible = false;
        triggerCharacterJump(mom, POOL_CONFIG.cx - 0.24, POOL_CONFIG.cz + 0.05, 1.2);
        return;
      }
      if (Math.hypot(wx - girl.root.position.x, wz - girl.root.position.z) < 0.42) {
        triggerCharacterJump(girl, POOL_CONFIG.cx, POOL_CONFIG.cz - 0.08, 1.0);
        return;
      }
    }

    pointer.mode = 'stir';
    return;
  }

  if (game.phase === 'splash') {
    if (Math.hypot(wx - dad.root.position.x, wz - dad.root.position.z) < 0.48) {
      pointer.mode = 'jump_char';
      pointer.heldChar = dad;
      return;
    }
    if (Math.hypot(wx - girl.root.position.x, wz - girl.root.position.z) < 0.46) {
      pointer.mode = 'jump_char';
      pointer.heldChar = girl;
      return;
    }
    if (
      (mom.root.visible && Math.hypot(wx - mom.root.position.x, wz - mom.root.position.z) < 0.52) ||
      (wx < -0.68 && Math.abs(wz - SLIDE_CONFIG.cz) < 0.45 && game.splashCount >= 1)
    ) {
      startMomSlideMishap();
      return;
    }
    if (physics.isInsidePoolXZ(wx, wz, -0.15)) {
      const jumper = game.splashCount % 2 === 0 ? dad : girl;
      triggerCharacterJump(jumper, wx, wz, 1.15);
      pointer.mode = 'stir';
      return;
    }
    pointer.mode = 'stir';
    return;
  }

  if (game.phase === 'cleanup') {
    if (mom.hairBall.visible && Math.hypot(wx - mom.root.position.x, wz - mom.root.position.z) < 0.44) {
      mom.hairBall.visible = false;
      mom.setExpression('joy', 1.4);
      emitBall(mom.root.position.x + 0.15, 0.55, mom.root.position.z + 0.25, 0.6, 1.2, 0.9, 0);
      sound.playBallPop(0, 0.8, -0.2, 'ball');
    }
    pointer.mode = 'scoop';
  }
}

function onPointerMove(e) {
  if (pointer.activeId !== e.pointerId) return;
  game.idleSeconds = 0;
  const planeH = pointer.mode === 'bag' || pointer.mode === 'crate_pour' ? 0.55 : 0.12;
  screenToWorld(e.clientX, e.clientY, planeH, pointer.world);

  if (pointer.mode === 'outfit' && pointer.draggedOutfit !== -1) {
    const o = outfits[pointer.draggedOutfit];
    o.group.position.x = pointer.world.x;
    o.group.position.z = pointer.world.z;
    o.group.position.y = 0.16;
    if (Math.hypot(pointer.world.x - girl.root.position.x, pointer.world.z - girl.root.position.z) < 0.55) {
      const chosen = pointer.draggedOutfit;
      pointer.mode = 'none';
      pointer.draggedOutfit = -1;
      chooseOutfit(chosen);
    }
  }
}

function onPointerUp(e) {
  if (pointer.activeId !== e.pointerId) return;

  if (pointer.mode === 'outfit' && pointer.draggedOutfit !== -1) {
    const chosen = pointer.draggedOutfit;
    pointer.draggedOutfit = -1;
    chooseOutfit(chosen);
  } else if (pointer.mode === 'jump_char' && pointer.heldChar) {
    const targetX = physics.isInsidePoolXZ(pointer.world.x, pointer.world.z, -0.2)
      ? pointer.world.x
      : POOL_CONFIG.cx + (pointer.heldChar === dad ? 0.26 : -0.20);
    const targetZ = physics.isInsidePoolXZ(pointer.world.x, pointer.world.z, -0.2)
      ? pointer.world.z
      : POOL_CONFIG.cz + (Math.random() - 0.5) * 0.28;
    triggerCharacterJump(pointer.heldChar, targetX, targetZ, 1.2);
    pointer.heldChar = null;
  } else if (pointer.mode === 'scoop') {
    releaseScoopedBalls(pointer.world.x, pointer.world.z);
  } else if (pointer.mode === 'bag') {
    if (game.phase === 'pour' && game.poolFullReached) {
      enterSplashPhase();
    }
  }

  pointer.down = false;
  pointer.activeId = null;
  pointer.mode = 'none';
  pointer.heldBagIdx = -1;
  pointer.heldCrateIdx = -1;
}

canvas.addEventListener('pointerdown', onPointerDown);
window.addEventListener('pointermove', onPointerMove);
window.addEventListener('pointerup', onPointerUp);
window.addEventListener('pointercancel', onPointerUp);

function enterSplashPhase() {
  if (game.phase !== 'pour') return;
  game.phase = 'splash';
  game.idleSeconds = 0;
  env.redrawSignboard(1);

  env.bags.forEach((b) => {
    b.homeX = b.parkX;
    b.homeZ = b.parkZ;
  });

  dad.root.visible = true;
  dad.root.position.set(1.36, 0.02, -0.52);
  dad.root.rotation.y = -0.55;
  dad.setExpression('excited', 2.2);

  mom.root.visible = true;
  mom.root.position.set(SLIDE_CONFIG.xTop - 0.06, SLIDE_CONFIG.yTop - 0.02, SLIDE_CONFIG.cz);
  mom.root.rotation.y = 0.65;
  mom.setExpression('happy', 2.0);

  girl.setExpression('excited', 2.0);
  sound.playDressUp(1);
}

function enterCleanupPhase() {
  if (game.phase === 'cleanup' || game.phase === 'freeplay') return;
  game.phase = 'cleanup';
  game.idleSeconds = 0;
  env.redrawSignboard(2);

  // Tuck the deflated empty mesh bags neatly side-by-side in the upper-right without overlapping!
  const cleanupBagSpots = [
    [0.98, -1.06],
    [1.36, -1.06],
    [1.66, -0.82]
  ];
  env.bags.forEach((b, idx) => {
    b.homeX = cleanupBagSpots[idx][0];
    b.homeZ = cleanupBagSpots[idx][1];
  });

  physics.cratesActive = true;
  env.crateMeshes.forEach((cm) => {
    cm.group.visible = true;
    cm.group.scale.set(0.01, 0.01, 0.01);
  });

  girl.setExpression('excited', 1.8);
}

function triggerFinalApplauseAndFreePlay() {
  if (game.applauseTriggered) return;
  game.applauseTriggered = true;
  game.phase = 'freeplay';
  game.applauseTimer = 3.6;

  girl.setExpression('clap', 3.8);
  dad.setExpression('clap', 3.8);
  mom.hairBall.visible = false;
  mom.setExpression('clap', 3.8);

  sound.playLastBallApplause();
}

// ---- Core Single-Frame Simulation Step (used by rAF & deterministic headless testing!) ----
const dummyMat = new THREE.Matrix4();
const dummyPos = new THREE.Vector3();
const dummyQuat = new THREE.Quaternion();
const dummyScale = new THREE.Vector3(1, 1, 1);

function stepSimulation(dt) {
  game.simTime += dt;
  const elapsed = game.simTime;
  game.idleSeconds += dt;

  pointer.vel.subVectors(pointer.world, pointer.prevWorld).divideScalar(Math.max(dt, 0.008));
  pointer.prevWorld.copy(pointer.world);

  // 1. Outfits
  outfits.forEach((o, idx) => {
    if (game.phase === 'dressup') {
      if (pointer.draggedOutfit !== idx) {
        o.group.position.x += (o.baseX - o.group.position.x) * 0.18;
        o.group.position.z += (o.baseZ - o.group.position.z) * 0.18;
        const idleWave = game.idleSeconds > 10 ? Math.sin(elapsed * 3.5 + idx * 1.4) * 0.015 : 0;
        o.group.position.y = 0.024 + Math.max(0, idleWave);
      }
    } else if (o.group.visible) {
      o.group.scale.multiplyScalar(0.82);
      o.group.position.y += 0.01;
      if (o.group.scale.x < 0.03) o.group.visible = false;
    }
  });

  // 2. Bags & Pouring
  let pouringActive = false;
  let pouringColor = 0;
  let pouringPan = 0;

  env.bags.forEach((b, idx) => {
    const isHeld = pointer.down && pointer.mode === 'bag' && pointer.heldBagIdx === idx;
    if (isHeld && physics.count < MAX_BALLS) {
      pouringActive = true;
      pouringColor = b.colorId;
      pouringPan = pointer.world.x * 0.42;

      b.x += (pointer.world.x - b.x) * 0.26;
      b.z += (pointer.world.z - b.z) * 0.26;
      b.y += (0.64 - b.y) * 0.22;
      b.group.position.set(b.x, b.y, b.z);

      b.bodyPivot.rotation.z += (2.35 - b.bodyPivot.rotation.z) * 0.18;
      b.bodyPivot.rotation.x += (0.28 - b.bodyPivot.rotation.x) * 0.18;

      const overPool = physics.isInsidePoolXZ(b.x, b.z, -0.18);
      const overSlide = b.x < -0.60 && b.x > -1.75 && Math.abs(b.z - SLIDE_CONFIG.cz) < 0.36;
      const rate = overPool ? 275 : overSlide ? 175 : 55;
      pointer.pourEmitCarry += dt * rate;

      const mouthX = b.x + 0.14;
      const mouthY = overSlide ? Math.max(0.84, b.y + 0.14) : 0.62;
      const mouthZ = b.z;

      let emittedNow = 0;
      while (pointer.pourEmitCarry >= 1 && physics.count < MAX_BALLS && emittedNow < 10) {
        pointer.pourEmitCarry -= 1;
        emittedNow++;
        const jitterX = (Math.random() - 0.5) * 0.16;
        const jitterZ = (Math.random() - 0.5) * 0.16;
        const res = emitBall(
          mouthX + jitterX,
          mouthY + (Math.random() - 0.5) * 0.08,
          mouthZ + jitterZ,
          pointer.vel.x * 0.18 + (Math.random() - 0.5) * 0.65 + (overSlide ? 0.48 : 0),
          -1.9 - Math.random() * 0.9,
          pointer.vel.z * 0.18 + (Math.random() - 0.5) * 0.65,
          b.colorId
        );
        if (res !== -1) b.pouredCount++;
      }

      if (emittedNow > 0) {
        const seq = game.pourSequence;
        if (seq.length === 0 || seq[seq.length - 1].colorId !== b.colorId) {
          seq.push({ colorId: b.colorId, count: emittedNow });
        } else {
          seq[seq.length - 1].count += emittedNow;
        }
      }
    } else {
      b.x += (b.homeX - b.x) * 0.14;
      b.z += (b.homeZ - b.z) * 0.14;
      b.y += (0 - b.y) * 0.18;
      b.group.position.set(b.x, b.y, b.z);
      const idleRustle =
        game.phase === 'pour' && game.idleSeconds > 10 && idx === 0
          ? Math.sin(elapsed * 4.2) * 0.09
          : 0;
      b.bodyPivot.rotation.z += (idleRustle - b.bodyPivot.rotation.z) * 0.16;
      b.bodyPivot.rotation.x += (0 - b.bodyPivot.rotation.x) * 0.16;
    }

    const deflate = Math.max(0.56, 1.0 - b.pouredCount / 1050);
    b.bodyPivot.scale.set(0.86 + deflate * 0.14, deflate, 0.86 + deflate * 0.14);
  });

  // Free-play Crate Pouring
  if (pointer.down && pointer.mode === 'crate_pour' && pointer.heldCrateIdx !== -1) {
    const cIdx = pointer.heldCrateIdx;
    const cm = env.crateMeshes[cIdx];
    cm.group.position.x += (pointer.world.x - cm.group.position.x) * 0.24;
    cm.group.position.z += (pointer.world.z - cm.group.position.z) * 0.24;
    cm.group.position.y += (0.62 - cm.group.position.y) * 0.22;
    cm.group.rotation.z += (1.95 - cm.group.rotation.z) * 0.18;

    const released = physics.pourFromCrate(
      cIdx,
      cm.group.position.x + 0.12,
      cm.group.position.y - 0.04,
      cm.group.position.z,
      4
    );
    if (released > 0) {
      pouringActive = true;
      pouringColor = cIdx;
      pouringPan = cm.group.position.x * 0.4;
    }
  } else {
    env.crateMeshes.forEach((cm, idx) => {
      if (!cm.group.visible) return;
      cm.group.position.x += (cm.homeX - cm.group.position.x) * 0.16;
      cm.group.position.z += (cm.homeZ - cm.group.position.z) * 0.16;
      cm.group.position.y += (0 - cm.group.position.y) * 0.2;
      cm.group.rotation.z += (0 - cm.group.rotation.z) * 0.18;
      const bounceScale = 1.0 + cm.bounce;
      cm.bounce *= 0.82;
      cm.group.scale.lerp(new THREE.Vector3(bounceScale, Math.max(0.75, 2 - bounceScale), bounceScale), 0.24);
      physics.crates[idx].x = cm.group.position.x;
      physics.crates[idx].z = cm.group.position.z;
    });
  }

  sound.updatePour(dt, pouringActive, 0.85, pouringColor, pouringPan, physics.count / 1850);

  if (game.phase === 'pour') {
    const stats = physics.getStats();
    if (stats.inPool >= game.fillGoalCount && !game.poolFullReached) {
      game.poolFullReached = true;
      girl.setExpression('clap', 2.4);
      sound.playDressUp(2);
    }
    if (game.poolFullReached && !pointer.down) {
      game.poolFullHoldTimer += dt;
      if (game.poolFullHoldTimer > 1.05) {
        enterSplashPhase();
      }
    }
  }

  // 3. Jumps & Mom's Slide Mishap
  for (let j = activeJumps.length - 1; j >= 0; j--) {
    const jmp = activeJumps[j];
    jmp.t += dt / jmp.dur;
    const u = Math.min(1, jmp.t);
    const arcY = Math.sin(u * Math.PI) * 0.72;
    jmp.charObj.root.position.set(
      THREE.MathUtils.lerp(jmp.startX, jmp.endX, u),
      THREE.MathUtils.lerp(jmp.startY, jmp.endY, u) + arcY,
      THREE.MathUtils.lerp(jmp.startZ, jmp.endZ, u)
    );

    if (u >= 0.82 && !jmp.landed) {
      jmp.landed = true;
      const col = jmp.charObj === dad ? dadCollider : jmp.charObj === mom ? momCollider : girlCollider;
      col.active = true;
      col.x = jmp.endX;
      col.y = 0.16;
      col.z = jmp.endZ;
      col.r = jmp.charObj === dad ? 0.35 : 0.29;
      col.upBoost = 3.2 * jmp.power;
      col.radialBoost = 2.0 * jmp.power;
      sound.playBigSplash(0.85, false);
      game.camShake = 0.018;
      jmp.charObj.setExpression('joy', 2.0);
      game.splashCount++;
      col.boostFrames = 6;

      if (game.phase === 'splash' && game.splashCount >= 2 && !game.momMishapTriggered) {
        game.pendingMomDelay = 0.85;
      }
    }
    if (u >= 1) activeJumps.splice(j, 1);
  }

  [girlCollider, dadCollider, momCollider].forEach((col) => {
    if (col.boostFrames > 0) {
      col.boostFrames--;
      if (col.boostFrames === 0) {
        col.upBoost = 0;
        col.radialBoost = 0;
        col.r = col === dadCollider ? 0.24 : 0.20;
      }
    }
  });

  if (game.pendingMomDelay > 0) {
    game.pendingMomDelay -= dt;
    if (game.pendingMomDelay <= 0) {
      game.pendingMomDelay = 0;
      startMomSlideMishap();
    }
  }

  if (game.momSlideTimer >= 0) {
    const prevT = game.momSlideTimer;
    game.momSlideTimer += dt;
    const t = game.momSlideTimer;

    if (t < 0.36) {
      mom.root.position.set(
        SLIDE_CONFIG.xTop - 0.06,
        SLIDE_CONFIG.yTop + Math.sin((t / 0.36) * Math.PI) * 0.15,
        SLIDE_CONFIG.cz
      );
      if (t >= 0.30 && prevT < 0.30) {
        sound.playSlideWhoosh(0.50, true);
      }
    } else if (t < 0.84) {
      const s = (t - 0.36) / 0.48;
      const ease = s * s;
      mom.root.position.set(
        THREE.MathUtils.lerp(SLIDE_CONFIG.xTop, POOL_CONFIG.cx + 0.04, ease),
        THREE.MathUtils.lerp(SLIDE_CONFIG.yTop, 0.08, ease) + Math.sin(s * Math.PI) * 0.18,
        SLIDE_CONFIG.cz
      );
      mom.root.rotation.z = -Math.sin(s * Math.PI) * 0.30;
    } else if (t >= 0.84 && prevT < 0.84) {
      mom.root.position.set(POOL_CONFIG.cx + 0.04, 0.05, POOL_CONFIG.cz);
      mom.root.rotation.z = 0;
      mom.root.rotation.y = 0.08;
      mom.hairBall.visible = true;
      mom.setExpression('oops', 6.5);
      dad.setExpression('oops', 2.2);
      girl.setExpression('huh', 2.0);

      momCollider.active = true;
      momCollider.x = POOL_CONFIG.cx + 0.04;
      momCollider.y = 0.16;
      momCollider.z = POOL_CONFIG.cz;
      momCollider.r = 0.44;

      // Blast ~175-210 balls of ALL colors (coprime stride across entire pool!) over all 4 walls onto the oak floor!
      let launchedCount = 0;
      const totalN = physics.count;
      const stride = 797; // Coprime with any count <= 2250 unless multiple of 797 (use 1 if divisible)
      const stepStride = totalN % stride === 0 ? 793 : stride;
      for (let k = 0; k < totalN; k++) {
        const i = (k * stepStride) % totalN;
        if (physics.state[i] !== 0) continue;
        const dx = physics.px[i] - momCollider.x;
        const dz = physics.pz[i] - momCollider.z;
        const d = Math.hypot(dx, dz);
        if (d < 1.05) {
          const strength = 1.0 - d / 1.05;
          // Spread explosively in all 360-degree directions across left, top, right & bottom floor!
          const ang = (k * 2.39996) + (Math.random() - 0.5) * 0.35;
          const canLaunchOut = launchedCount < 235 && physics.py[i] > 0.15 && Math.random() < 0.46;
          if (canLaunchOut) {
            launchedCount++;
            const hSpeed = (2.65 + Math.random() * 1.95) * (0.72 + strength * 0.48);
            physics.vx[i] = Math.cos(ang) * hSpeed;
            physics.vz[i] = Math.sin(ang) * hSpeed;
            physics.vy[i] = (3.95 + Math.random() * 2.15) * (0.72 + strength * 0.45);
          } else {
            physics.vx[i] += Math.cos(ang) * 1.15 * strength;
            physics.vz[i] += Math.sin(ang) * 1.15 * strength;
            physics.vy[i] += (1.2 + Math.random() * 1.1) * strength;
          }
        }
      }

      sound.playBigSplash(1.0, true);
      game.camShake = 0.042;
    } else if (t > 2.20) {
      game.momSlideTimer = -1;
      momCollider.r = 0.22;
      enterCleanupPhase();
    }
  }

  if (game.phase === 'cleanup' && activeJumps.length === 0) {
    momCollider.active = false;
    dadCollider.active = false;
    girlCollider.active = false;
    mom.root.position.lerp(new THREE.Vector3(-1.54, 0.02, 0.52), 0.09);
    mom.root.rotation.y += (0.35 - mom.root.rotation.y) * 0.1;

    girl.root.position.lerp(new THREE.Vector3(0.14, 0.02, -0.94), 0.09);
    girl.root.rotation.y += (0.0 - girl.root.rotation.y) * 0.1;

    dad.root.position.lerp(new THREE.Vector3(1.56, 0.02, 0.50), 0.09);
    dad.root.rotation.y += (-0.35 - dad.root.rotation.y) * 0.1;
  }

  // 4. Cleanup Scoop & Last-Ball Detection
  let loneLastBallPos = null;
  if (game.phase === 'cleanup') {
    let floorBalls = 0;
    let lastFloorIdx = -1;
    for (let i = 0; i < physics.count; i++) {
      if (physics.state[i] === 0 && !physics.isInsidePoolXZ(physics.px[i], physics.pz[i], -0.06)) {
        floorBalls++;
        lastFloorIdx = i;
      }
    }

    if (floorBalls > 14 && Math.random() < 0.12) {
      for (let k = 0; k < 4; k++) {
        const ri = (Math.random() * physics.count) | 0;
        if (physics.state[ri] === 0 && !physics.isInsidePoolXZ(physics.px[ri], physics.pz[ri], -0.06)) {
          if (Math.abs(physics.px[ri]) > 1.62 || Math.abs(physics.pz[ri]) > 1.18) {
            physics.vx[ri] -= physics.px[ri] * 0.45;
            physics.vz[ri] -= physics.pz[ri] * 0.45;
          }
        }
      }
    }

    if (floorBalls === 1 && lastFloorIdx !== -1) {
      loneLastBallPos = { x: physics.px[lastFloorIdx], z: physics.pz[lastFloorIdx] };
    }

    if (pointer.down && pointer.mode === 'scoop') {
      const maxScoop = 16;
      const grabRadius = floorBalls <= 3 ? 0.38 : 0.30;
      if (pointer.scoopedIndices.length < maxScoop) {
        const prefColor = pointer.scoopedIndices.length > 0 ? physics.colorId[pointer.scoopedIndices[0]] : -1;
        for (let i = 0; i < physics.count && pointer.scoopedIndices.length < maxScoop; i++) {
          if (physics.state[i] !== 0) continue;
          if (physics.isInsidePoolXZ(physics.px[i], physics.pz[i], -0.06)) continue;
          const d = Math.hypot(physics.px[i] - pointer.world.x, physics.pz[i] - pointer.world.z);
          const rAllow = (prefColor === -1 || physics.colorId[i] === prefColor || floorBalls <= 12)
            ? grabRadius
            : grabRadius * 0.62;
          if (d < rAllow) {
            physics.state[i] = 2;
            pointer.scoopedIndices.push(i);
            sound.playBallPop(physics.colorId[i], 0.38, pointer.world.x * 0.4, 'wood');
          }
        }
      }

      for (let k = 0; k < pointer.scoopedIndices.length; k++) {
        const bi = pointer.scoopedIndices[k];
        const ring = k === 0 ? 0 : k < 7 ? 0.068 : 0.125;
        const ang = k * 1.05 + elapsed * 1.5;
        const layerY = k < 7 ? 0.12 : 0.19;
        physics.px[bi] += (pointer.world.x + Math.cos(ang) * ring - physics.px[bi]) * 0.38;
        physics.py[bi] += (layerY - physics.py[bi]) * 0.38;
        physics.pz[bi] += (pointer.world.z + Math.sin(ang) * ring - physics.pz[bi]) * 0.38;
        physics.vx[bi] = 0;
        physics.vy[bi] = 0;
        physics.vz[bi] = 0;
      }
    }

    if (floorBalls === 0 && pointer.scoopedIndices.length === 0 && physics.count > 100) {
      triggerFinalApplauseAndFreePlay();
    }
  }

  // 5. Player Hand
  if (playerHand.root.visible) {
    const targetHandY =
      pointer.mode === 'bag' || pointer.mode === 'crate_pour'
        ? 0.56
        : pointer.down
          ? 0.11
          : 0.24;
    playerHand.root.position.x += (pointer.world.x - playerHand.root.position.x) * 0.34;
    playerHand.root.position.y += (targetHandY - playerHand.root.position.y) * 0.28;
    playerHand.root.position.z += (pointer.world.z - playerHand.root.position.z) * 0.34;

    const bankZ = Math.max(-0.35, Math.min(0.35, -pointer.vel.x * 0.08));
    const pitchX = Math.max(-0.35, Math.min(0.35, pointer.vel.z * 0.06));
    playerHand.root.rotation.z += (bankZ - playerHand.root.rotation.z) * 0.2;
    playerHand.root.rotation.x += (pitchX - playerHand.root.rotation.x) * 0.2;

    const pose =
      pointer.mode === 'bag' || pointer.mode === 'crate_pour'
        ? 'grab'
        : pointer.mode === 'scoop'
          ? 'scoop'
          : 'open';
    playerHand.setPose(pose, pointer.scoopedIndices.length);

    if (pointer.down && (pointer.mode === 'stir' || pointer.mode === 'scoop')) {
      handCollider.active = pointer.mode === 'stir';
      handCollider.vx = (playerHand.root.position.x - handCollider.x) / Math.max(dt, 0.008);
      handCollider.vy = (playerHand.root.position.y - handCollider.y) / Math.max(dt, 0.008);
      handCollider.vz = (playerHand.root.position.z - handCollider.z) / Math.max(dt, 0.008);
      handCollider.x = playerHand.root.position.x;
      handCollider.y = 0.12;
      handCollider.z = playerHand.root.position.z;

      const speed = Math.hypot(handCollider.vx, handCollider.vz);
      if (speed > 1.8 && Math.random() < 0.35 && physics.isInsidePoolXZ(handCollider.x, handCollider.z)) {
        sound.playBallPop((Math.random() * 3) | 0, Math.min(0.7, speed * 0.15), handCollider.x * 0.4, 'ball');
      }
    } else {
      handCollider.active = false;
    }
  }

  // 6. Physics & InstancedMesh Sync
  physics.step(dt);

  const n = physics.count;
  const shadeArray = shadeAttr.array;
  for (let i = 0; i < n; i++) {
    dummyPos.set(physics.px[i], physics.py[i], physics.pz[i]);
    dummyQuat.set(physics.qx[i], physics.qy[i], physics.qz[i], physics.qw[i]);
    dummyMat.compose(dummyPos, dummyQuat, dummyScale);
    ballInstMesh.setMatrixAt(i, dummyMat);
    shadeArray[i] = physics.shade[i];
  }
  if (n > 0) {
    ballInstMesh.instanceMatrix.needsUpdate = true;
    shadeAttr.needsUpdate = true;
  }

  // 7. Character Expressions & Prop Wobbles
  const gazeTarget = loneLastBallPos || (pointer.down ? { x: pointer.world.x, z: pointer.world.z } : null);
  girl.update(dt, elapsed, gazeTarget);
  if (dad.root.visible) dad.update(dt, elapsed, gazeTarget);
  if (mom.root.visible) mom.update(dt, elapsed, gazeTarget);

  if (signWobble > 0.001) {
    env.boardPivot.rotation.z = 0.04 + Math.sin(elapsed * 26) * signWobble;
    signWobble *= 0.88;
  }
  if (poolWobble > 0.001) {
    env.poolGroup.scale.y = 1.0 - Math.sin(elapsed * 28) * poolWobble;
    poolWobble *= 0.86;
  } else {
    env.poolGroup.scale.y = 1.0;
  }

  if (game.camShake > 0.0005) {
    camera.position.set(
      BASE_CAM_POS.x + (Math.random() - 0.5) * game.camShake,
      BASE_CAM_POS.y,
      BASE_CAM_POS.z + (Math.random() - 0.5) * game.camShake
    );
    game.camShake *= 0.86;
  } else {
    camera.position.copy(BASE_CAM_POS);
  }
  camera.lookAt(BASE_CAM_TARGET);
}

const clock = new THREE.Clock();
let fpsFrames = 0;
let fpsAccum = 0;
let currentFps = 60;

function animate() {
  requestAnimationFrame(animate);
  const rawDt = clock.getDelta();
  const dt = Math.min(rawDt, 0.035);
  fpsFrames++;
  fpsAccum += rawDt;
  if (fpsAccum >= 0.5) {
    currentFps = Math.round(fpsFrames / fpsAccum);
    fpsFrames = 0;
    fpsAccum = 0;
  }
  stepSimulation(dt);
  renderer.render(scene, camera);
}
animate();

window.__ballPoolSim = {
  getMetrics() {
    return {
      phase: game.phase,
      selectedOutfit: game.selectedOutfit,
      fps: currentFps,
      triangles: renderer.info.render.triangles,
      calls: renderer.info.render.calls,
      pixelRatio: renderer.getPixelRatio(),
      stats: physics.getStats(),
      pourLayers: game.pourSequence.length,
      crates: physics.crates.map((c) => ({ count: c.count, pureCount: c.pureCount }))
    };
  },
  stepFrames(count = 1, dt = 1 / 60) {
    for (let i = 0; i < count; i++) stepSimulation(dt);
    renderer.render(scene, camera);
  },
  chooseOutfit,
  emitBall,
  enterSplashPhase,
  startMomSlideMishap,
  enterCleanupPhase,
  triggerCharacterJump,
  pointer,
  girl,
  mom,
  dad,
  physics,
  env,
  renderer,
  scene,
  camera
};
