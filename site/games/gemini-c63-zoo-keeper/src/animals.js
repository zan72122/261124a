import * as THREE from 'three';
import {
  AnimalCareState,
  createMultiShellFurGroup,
  createElephantMaterial
} from './furMaterial.js';

// Smooth outward-facing anatomical lofted geometry with closed rounded nose/rump caps and zero seams!
export function createLoftedGeometry(stations, radialSegs = 24, samplesPerSpan = 3) {
  // Automatically add closed rounded start & end tip stations so there are NEVER open pipe holes!
  const first = stations[0];
  const second = stations[1];
  const last = stations[stations.length - 1];
  const prev = stations[stations.length - 2];

  const startDir = new THREE.Vector3(first.x - second.x, first.y - second.y, first.z - second.z)
    .normalize()
    .multiplyScalar((first.rx + (first.ryTop ?? first.rx)) * 0.28);
  const endDir = new THREE.Vector3(last.x - prev.x, last.y - prev.y, last.z - prev.z)
    .normalize()
    .multiplyScalar((last.rx + (last.ryTop ?? last.rx)) * 0.28);

  const fullStations = [
    {
      x: first.x + startDir.x,
      y: first.y + startDir.y,
      z: first.z + startDir.z,
      rx: 0.002,
      ryTop: 0.002,
      ryBot: 0.002,
      sq: 0,
      cheek: 0,
      u: first.u ?? 0
    },
    ...stations,
    {
      x: last.x + endDir.x,
      y: last.y + endDir.y,
      z: last.z + endDir.z,
      rx: 0.002,
      ryTop: 0.002,
      ryBot: 0.002,
      sq: 0,
      cheek: 0,
      u: last.u ?? 1
    }
  ];

  const spinePts = fullStations.map((s) => new THREE.Vector3(s.x, s.y, s.z));
  const curve = new THREE.CatmullRomCurve3(spinePts, false, 'centripetal', 0.5);
  const totalRings = (fullStations.length - 1) * samplesPerSpan + 1;

  const interpProp = (t, key, fallback = 0) => {
    const f = t * (fullStations.length - 1);
    const i0 = Math.min(fullStations.length - 2, Math.max(0, Math.floor(f)));
    const i1 = i0 + 1;
    const lt = f - i0;
    const smooth = lt * lt * (3 - 2 * lt);
    const v0 = fullStations[i0][key] ?? fallback;
    const v1 = fullStations[i1][key] ?? fallback;
    return v0 + (v1 - v0) * smooth;
  };

  const positions = [];
  const uvs = [];
  const indices = [];

  const worldUp = new THREE.Vector3(0, 1, 0);
  const tangent = new THREE.Vector3();
  const rightVec = new THREE.Vector3();
  const upVec = new THREE.Vector3();

  // Parallel-transport frame prevents sudden twisting on vertical necks!
  let prevUp = new THREE.Vector3(0, 1, 0);

  for (let r = 0; r < totalRings; r++) {
    const t = r / (totalRings - 1);
    const pt = curve.getPoint(t);
    curve.getTangent(t, tangent).normalize();

    if (r === 0) {
      if (Math.abs(tangent.y) > 0.92) {
        prevUp.set(0, 0, -Math.sign(tangent.y));
      } else {
        prevUp.copy(worldUp);
      }
    }

    // Right-handed frame: rightVec = prevUp x tangent, upVec = tangent x rightVec
    rightVec.crossVectors(prevUp, tangent);
    if (rightVec.lengthSq() < 1e-5) {
      rightVec.set(1, 0, 0);
    } else {
      rightVec.normalize();
    }
    upVec.crossVectors(tangent, rightVec).normalize();
    prevUp.copy(upVec);

    const rx = interpProp(t, 'rx', 0.2);
    const ryTop = interpProp(t, 'ryTop', rx);
    const ryBot = interpProp(t, 'ryBot', rx);
    const squareness = interpProp(t, 'sq', 0.06);
    const cheek = interpProp(t, 'cheek', 0.0);
    const uVal = interpProp(t, 'u', t);

    for (let s = 0; s <= radialSegs; s++) {
      const v = s / radialSegs;
      const ang = (v - 0.5) * Math.PI * 2; // ang=0 at dorsal top (+upVec)
      const cosA = Math.cos(ang);
      const sinA = Math.sin(ang);

      const ry = cosA >= 0 ? ryTop : ryBot;
      const muscle =
        1.0 +
        squareness * Math.cos(ang * 2) +
        cheek * Math.max(0, Math.sin(Math.abs(ang) * 1.3) * (cosA < 0.25 ? 1 : 0));

      const localX = sinA * rx * muscle;
      const localY = cosA * ry * muscle;

      positions.push(
        pt.x + rightVec.x * localX + upVec.x * localY,
        pt.y + rightVec.y * localX + upVec.y * localY,
        pt.z + rightVec.z * localX + upVec.z * localY
      );
      uvs.push(uVal, v);
    }
  }

  // Verified outward-facing counter-clockwise winding!
  // Tangent points along +r; ang increases clockwise around +tangent (from +up toward +right),
  // so (r -> r+1) x (s -> s+1) = tangent x circumferential = OUTWARD NORMAL -> (a, b, d) and (b, c, d)!
  const stride = radialSegs + 1;
  for (let r = 0; r < totalRings - 1; r++) {
    for (let s = 0; s < radialSegs; s++) {
      const a = r * stride + s;
      const b = (r + 1) * stride + s;
      const c = (r + 1) * stride + (s + 1);
      const d = r * stride + (s + 1);
      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// Realistic glossy wet animal eye with dark limbal ring, cornea reflection & eyelid
function createRealisticEye({ radius = 0.04, irisColor = 0x4a2e1b, lidColor = 0x26211e } = {}) {
  const group = new THREE.Group();

  const irisCanvas = document.createElement('canvas');
  irisCanvas.width = 128;
  irisCanvas.height = 64;
  const ctx = irisCanvas.getContext('2d');
  ctx.fillStyle = '#dcd3c6';
  ctx.fillRect(0, 0, 128, 64);

  const col = new THREE.Color(irisColor);
  const grad = ctx.createRadialGradient(64, 32, 2, 64, 32, 27);
  grad.addColorStop(0, '#070606');
  grad.addColorStop(0.46, '#0b0808');
  grad.addColorStop(0.52, `#${col.getHexString()}`);
  grad.addColorStop(0.86, `#${col.clone().multiplyScalar(0.48).getHexString()}`);
  grad.addColorStop(1.0, '#1e1714');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(64, 32, 27, 0, Math.PI * 2);
  ctx.fill();

  const eyeTex = new THREE.CanvasTexture(irisCanvas);
  eyeTex.colorSpace = THREE.SRGBColorSpace;

  const eyeball = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 16, 14),
    new THREE.MeshPhysicalMaterial({
      map: eyeTex,
      roughness: 0.03,
      clearcoat: 1.0,
      clearcoatRoughness: 0.02,
      reflectivity: 1.0
    })
  );
  eyeball.rotation.y = -Math.PI / 2;
  group.add(eyeball);

  // Crisp living cornea sky catchlight pearl!
  const catchPearl = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 0.18, 6, 6),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  );
  catchPearl.position.set(radius * 0.22, radius * 0.28, radius * 0.92);
  group.add(catchPearl);

  const upperLid = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.13, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.34),
    new THREE.MeshStandardMaterial({ color: lidColor, roughness: 0.72 })
  );
  upperLid.rotation.x = -0.55;
  group.add(upperLid);
  group.userData.upperLid = upperLid;

  return group;
}

class BaseAnimal {
  constructor(id, root) {
    this.id = id;
    this.root = root;
    this.headPivot = null;
    this.jawPivot = null;
    this.ears = [];
    this.eyes = [];
    this.tailPivot = null;
    this.furGroups = [];
    this.hitMeshes = [];

    this.mood = 'calm';
    this.moodTimer = 0;
    this.huhPhase = 0;
    this.shakeTimer = 0;
    this.chewTimer = 0;
    this.breathPhase = Math.random() * Math.PI * 2;
    this.blinkTimer = 1.8 + Math.random() * 3.0;
    this.blinkAmount = 0;
    this.baseHeadRot = new THREE.Euler();
  }

  collectHitMeshes() {
    this.hitMeshes.length = 0;
    this.root.traverse((obj) => {
      if (obj.isMesh && obj.userData.isAnimalHitSurface) {
        obj.userData.animal = this;
        this.hitMeshes.push(obj);
      }
    });
  }

  triggerHuhThenHappy() {
    this.mood = 'huh';
    this.moodTimer = 2.1;
    this.huhPhase = 0;
  }

  triggerBliss(duration = 1.4) {
    if (this.mood !== 'huh') {
      this.mood = 'bliss';
      this.moodTimer = Math.max(this.moodTimer, duration);
    }
  }

  triggerEat(duration = 1.8) {
    this.mood = 'eating';
    this.moodTimer = duration;
    this.chewTimer = duration;
    this.careState.fedCount++;
  }

  triggerHappyShake() {
    this.shakeTimer = 0.85;
    this.mood = 'happy';
    this.moodTimer = 2.2;
  }

  updateCommon(dt, elapsed) {
    this.careState.evaporateSlowly(dt);

    for (const fg of this.furGroups) {
      const mats = fg.userData.furMaterials || [];
      for (const m of mats) {
        if (m.userData.furUniforms) {
          m.userData.furUniforms.uTime.value = elapsed;
          m.userData.furUniforms.uBrushFlow.value.set(this.careState.brushDirX, this.careState.brushDirY);
        }
      }
    }

    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blinkAmount = 1.0;
      this.blinkTimer = 2.6 + Math.random() * 3.8;
    }
    this.blinkAmount = Math.max(0, this.blinkAmount - dt * 8.5);

    if (this.moodTimer > 0) {
      this.moodTimer -= dt;
      if (this.mood === 'huh') {
        this.huhPhase += dt;
        if (this.huhPhase > 0.95) this.mood = 'happy';
      }
      if (this.moodTimer <= 0) this.mood = 'calm';
    }

    if (this.shakeTimer > 0) this.shakeTimer = Math.max(0, this.shakeTimer - dt);
    if (this.chewTimer > 0) this.chewTimer = Math.max(0, this.chewTimer - dt);

    const breath = Math.sin(elapsed * 1.65 + this.breathPhase);
    if (this.bodyGroup) {
      const shakeZ = this.shakeTimer > 0 ? Math.sin(elapsed * 42) * 0.075 * this.shakeTimer : 0;
      this.bodyGroup.scale.set(1 + breath * 0.011, 1 + breath * 0.013, 1 + breath * 0.008);
      this.bodyGroup.rotation.z = shakeZ;
    }

    if (this.headPivot) {
      let rx = this.baseHeadRot.x + Math.sin(elapsed * 1.2 + this.breathPhase) * 0.03;
      let ry = this.baseHeadRot.y + Math.sin(elapsed * 0.7 + this.breathPhase) * 0.055;
      let rz = this.baseHeadRot.z;

      if (this.mood === 'huh') {
        rz += 0.34 * Math.sin(Math.min(1, this.huhPhase * 4.5) * Math.PI * 0.5);
        ry += 0.14;
        rx -= 0.06;
      } else if (this.mood === 'happy') {
        rx += Math.sin(elapsed * 9.5) * 0.10;
        rz += Math.cos(elapsed * 5.0) * 0.05;
      } else if (this.mood === 'bliss') {
        rx -= 0.08;
        rz += Math.sin(elapsed * 2.5) * 0.08;
      }
      if (this.shakeTimer > 0) {
        rz += Math.sin(elapsed * 46) * 0.20 * this.shakeTimer;
      }

      this.headPivot.rotation.x += (rx - this.headPivot.rotation.x) * Math.min(1, dt * 7);
      this.headPivot.rotation.y += (ry - this.headPivot.rotation.y) * Math.min(1, dt * 7);
      this.headPivot.rotation.z += (rz - this.headPivot.rotation.z) * Math.min(1, dt * 8);
    }

    if (this.jawPivot) {
      const chew = this.chewTimer > 0 ? Math.abs(Math.sin(elapsed * 13.5)) * 0.28 : 0;
      const huhOpen = this.mood === 'huh' ? 0.11 : 0;
      const targetJaw = Math.max(chew, huhOpen);
      this.jawPivot.rotation.x += (targetJaw - this.jawPivot.rotation.x) * Math.min(1, dt * 14);
    }

    for (const eye of this.eyes) {
      const lid = eye.userData.upperLid;
      if (!lid) continue;
      let targetLid = -0.55;
      if (this.mood === 'huh') targetLid = -0.88;
      else if (this.mood === 'bliss' || this.mood === 'happy') targetLid = -0.24;
      targetLid = THREE.MathUtils.lerp(targetLid, 0.36, this.blinkAmount);
      lid.rotation.x += (targetLid - lid.rotation.x) * Math.min(1, dt * 16);
    }

    this.ears.forEach((ear, idx) => {
      const side = idx === 0 ? 1 : -1;
      const flick = Math.sin(elapsed * 2.3 + idx * 1.7 + this.breathPhase) > 0.92 ? 0.16 : 0;
      const moodLift = this.mood === 'huh' ? 0.20 : (this.mood === 'bliss' ? -0.12 : 0);
      ear.rotation.z = ear.userData.baseZ + side * (flick + moodLift);
    });

    if (this.tailPivot) {
      const speed = this.mood === 'happy' ? 7.5 : 2.1;
      const amp = this.mood === 'happy' ? 0.30 : 0.12;
      this.tailPivot.rotation.z = Math.sin(elapsed * speed + this.breathPhase) * amp;
    }
  }
}

// Seamless muscular hoofed limb nested deeply into the shoulder/haunch so zero joint gap ever shows!
function buildHoofLeg({ length = 0.96, topR = 0.16, midR = 0.066, hoofR = 0.075, furOpts, shellCount = 3, uOffset = 0.45 }) {
  const legGroup = new THREE.Group();
  const stations = [
    { x: 0, y: 0.22, z: 0, rx: topR * 0.92, ryTop: topR * 1.15, ryBot: topR * 1.1, u: uOffset },
    { x: 0, y: -length * 0.28, z: 0.02, rx: midR * 1.45, ryTop: midR * 1.55, ryBot: midR * 1.4, u: uOffset + 0.06 },
    { x: 0, y: -length * 0.65, z: -0.01, rx: midR * 0.98, ryTop: midR, ryBot: midR, u: uOffset + 0.13 },
    { x: 0, y: -length * 0.90, z: 0.01, rx: hoofR * 0.92, ryTop: hoofR, ryBot: hoofR, u: uOffset + 0.19 }
  ];
  const geo = createLoftedGeometry(stations, 16, 3);
  const fur = createMultiShellFurGroup(geo, furOpts, shellCount);
  legGroup.add(fur);

  const hoof = new THREE.Mesh(
    new THREE.CylinderGeometry(hoofR * 0.88, hoofR * 1.05, length * 0.12, 14),
    new THREE.MeshStandardMaterial({ color: 0x221e1c, roughness: 0.42 })
  );
  hoof.position.set(0, -length * 0.95, 0.015);
  hoof.castShadow = true;
  legGroup.add(hoof);

  legGroup.userData.furGroup = fur;
  return legGroup;
}

// 1. LIFE-SIZED PLAINS ZEBRA
export function createZebra(textures) {
  const root = new THREE.Group();
  const animal = new BaseAnimal('zebra', root);
  animal.careState = new AnimalCareState({ initialMud: 0.48, initialGloss: 0.18, seed: 3 });

  const furOpts = {
    map: textures.zebraMap,
    strandMap: textures.strandMap,
    bubbleMap: textures.bubbleMap,
    careState: animal.careState,
    furLength: 0.036,
    furRepeat: new THREE.Vector2(11, 8),
    roughness: 0.75,
    sheenTint: new THREE.Color(0xfdf8ef)
  };

  const bodyGroup = new THREE.Group();
  bodyGroup.position.set(0, 1.15, 0);
  root.add(bodyGroup);
  animal.bodyGroup = bodyGroup;

  // Seamless muscular barrel torso extending well forward into base of neck!
  const torsoStations = [
    { x: 0, y: 0.22, z: 0.66, rx: 0.24, ryTop: 0.26, ryBot: 0.27, sq: 0.06, u: 0.26 },
    { x: 0, y: 0.09, z: 0.44, rx: 0.31, ryTop: 0.36, ryBot: 0.35, sq: 0.08, u: 0.36 },
    { x: 0, y: 0.02, z: 0.06, rx: 0.36, ryTop: 0.34, ryBot: 0.39, sq: 0.05, u: 0.54 },
    { x: 0, y: 0.05, z: -0.36, rx: 0.34, ryTop: 0.36, ryBot: 0.33, sq: 0.07, u: 0.76 },
    { x: 0, y: 0.0, z: -0.68, rx: 0.24, ryTop: 0.27, ryBot: 0.26, sq: 0.05, u: 0.94 }
  ];
  const torsoFur = createMultiShellFurGroup(createLoftedGeometry(torsoStations, 24, 4), furOpts, 5);
  bodyGroup.add(torsoFur);
  animal.furGroups.push(torsoFur);

  // Articulated Neck + Equine Skull (nested deep into chest so zero seam ever appears!)
  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.16, 0.52);
  bodyGroup.add(headPivot);
  animal.headPivot = headPivot;

  const headNeckStations = [
    { x: 0, y: -0.10, z: -0.12, rx: 0.26, ryTop: 0.28, ryBot: 0.28, u: 0.30 },
    { x: 0, y: 0.16, z: 0.12, rx: 0.20, ryTop: 0.25, ryBot: 0.21, u: 0.23 },
    { x: 0, y: 0.40, z: 0.28, rx: 0.15, ryTop: 0.19, ryBot: 0.16, u: 0.17 },
    { x: 0, y: 0.38, z: 0.44, rx: 0.145, ryTop: 0.16, ryBot: 0.16, cheek: 0.20, u: 0.12 },
    { x: 0, y: 0.25, z: 0.64, rx: 0.105, ryTop: 0.11, ryBot: 0.10, u: 0.06 },
    { x: 0, y: 0.16, z: 0.80, rx: 0.092, ryTop: 0.095, ryBot: 0.082, u: 0.015 }
  ];
  const headFur = createMultiShellFurGroup(createLoftedGeometry(headNeckStations, 22, 4), furOpts, 5);
  headPivot.add(headFur);
  animal.furGroups.push(headFur);

  // Soft dark nostrils on velvety muzzle
  const nostrilMat = new THREE.MeshStandardMaterial({ color: 0x120f0e, roughness: 0.55 });
  [-1, 1].forEach((s) => {
    const nos = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), nostrilMat);
    nos.scale.set(0.7, 1.1, 0.8);
    nos.position.set(s * 0.056, 0.18, 0.82);
    headPivot.add(nos);
  });

  // Upright bristled Zebra mohawk mane along dorsal crest!
  for (let i = 0; i < 14; i++) {
    const t = i / 13;
    const isDark = i % 2 === 0;
    const tuft = new THREE.Mesh(
      new THREE.ConeGeometry(0.036, 0.19, 7),
      new THREE.MeshStandardMaterial({ color: isDark ? 0x1a1614 : 0xebe3d5, roughness: 0.85 })
    );
    tuft.scale.set(0.45, 1, 1.35);
    tuft.position.set(0, 0.14 + t * 0.39, -0.06 + t * 0.36);
    tuft.rotation.x = -0.52;
    tuft.userData.isAnimalHitSurface = true;
    headPivot.add(tuft);
  }

  const jawPivot = new THREE.Group();
  jawPivot.position.set(0, 0.22, 0.52);
  headPivot.add(jawPivot);
  animal.jawPivot = jawPivot;
  const jawMesh = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.058, 0.18, 6, 10),
    new THREE.MeshStandardMaterial({ color: 0x2c2623, roughness: 0.72 })
  );
  jawMesh.rotation.x = Math.PI / 2 + 0.35;
  jawMesh.position.set(0, -0.06, 0.14);
  jawPivot.add(jawMesh);

  [-1, 1].forEach((side) => {
    const eye = createRealisticEye({ radius: 0.036, irisColor: 0x3b2416, lidColor: 0x221d1a });
    eye.position.set(side * 0.128, 0.40, 0.45);
    eye.rotation.y = side * 0.92;
    headPivot.add(eye);
    animal.eyes.push(eye);

    const earPivot = new THREE.Group();
    earPivot.position.set(side * 0.088, 0.52, 0.28);
    const earMesh = new THREE.Mesh(
      new THREE.ConeGeometry(0.052, 0.18, 12),
      new THREE.MeshStandardMaterial({ color: 0x241f1c, roughness: 0.78 })
    );
    earMesh.scale.set(0.85, 1, 0.52);
    earMesh.position.y = 0.08;
    earPivot.add(earMesh);
    earPivot.rotation.z = -side * 0.30;
    earPivot.rotation.x = 0.16;
    earPivot.userData.baseZ = -side * 0.30;
    headPivot.add(earPivot);
    animal.ears.push(earPivot);
  });

  [
    [-0.19, -0.19, 0.44, 0.36],
    [0.19, -0.19, 0.44, 0.36],
    [-0.20, -0.18, -0.44, 0.76],
    [0.20, -0.18, -0.44, 0.76]
  ].forEach(([lx, ly, lz, uOff]) => {
    const leg = buildHoofLeg({ length: 0.96, topR: 0.155, midR: 0.065, hoofR: 0.074, furOpts, shellCount: 1, uOffset: uOff });
    leg.position.set(lx, ly, lz);
    bodyGroup.add(leg);
    animal.furGroups.push(leg.userData.furGroup);
  });

  const tailPivot = new THREE.Group();
  tailPivot.position.set(0, 0.04, -0.70);
  bodyGroup.add(tailPivot);
  animal.tailPivot = tailPivot;
  const tailRod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.018, 0.42, 8),
    new THREE.MeshStandardMaterial({ color: 0xe6ded0, roughness: 0.8 })
  );
  tailRod.position.set(0, -0.20, -0.05);
  tailRod.rotation.x = 0.22;
  tailPivot.add(tailRod);
  const tailTuft = new THREE.Mesh(
    new THREE.ConeGeometry(0.055, 0.24, 10),
    new THREE.MeshStandardMaterial({ color: 0x1a1614, roughness: 0.88 })
  );
  tailTuft.position.set(0, -0.42, -0.09);
  tailTuft.rotation.x = Math.PI + 0.22;
  tailPivot.add(tailTuft);

  animal.collectHitMeshes();
  return animal;
}

// 2. LIFE-SIZED SANCTUARY ELEPHANT (Seamless wrinkled skin, continuous muscular trunk, flapping ears!)
export function createElephant(textures) {
  const root = new THREE.Group();
  const animal = new BaseAnimal('elephant', root);
  animal.careState = new AnimalCareState({ initialMud: 0.54, initialGloss: 0.12, seed: 8 });

  const skinMat = createElephantMaterial({
    map: textures.elephantMap,
    bumpMap: textures.elephantBump,
    bubbleMap: textures.bubbleMap,
    careState: animal.careState
  });

  const bodyGroup = new THREE.Group();
  bodyGroup.position.set(0, 1.48, 0);
  root.add(bodyGroup);
  animal.bodyGroup = bodyGroup;

  const torsoStations = [
    { x: 0, y: 0.14, z: 0.86, rx: 0.45, ryTop: 0.48, ryBot: 0.48, sq: 0.05, u: 0.25 },
    { x: 0, y: 0.22, z: 0.40, rx: 0.58, ryTop: 0.62, ryBot: 0.58, sq: 0.06, u: 0.42 },
    { x: 0, y: 0.26, z: -0.08, rx: 0.64, ryTop: 0.66, ryBot: 0.64, sq: 0.05, u: 0.58 },
    { x: 0, y: 0.14, z: -0.60, rx: 0.55, ryTop: 0.56, ryBot: 0.56, sq: 0.06, u: 0.78 },
    { x: 0, y: -0.04, z: -1.00, rx: 0.35, ryTop: 0.38, ryBot: 0.38, sq: 0.04, u: 0.96 }
  ];
  const bodyMesh = new THREE.Mesh(createLoftedGeometry(torsoStations, 30, 4), skinMat);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  bodyMesh.userData.isAnimalHitSurface = true;
  bodyGroup.add(bodyMesh);

  // Seamless heavy pillar legs nested deeply into shoulder/hip mass
  [
    [-0.35, -0.22, 0.58],
    [0.35, -0.22, 0.58],
    [-0.34, -0.22, -0.56],
    [0.34, -0.22, -0.56]
  ].forEach(([lx, ly, lz]) => {
    const lStations = [
      { x: 0, y: 0.28, z: 0, rx: 0.27, ryTop: 0.28, ryBot: 0.28, u: 0.4 },
      { x: 0, y: -0.42, z: 0.02, rx: 0.20, ryTop: 0.20, ryBot: 0.20, u: 0.55 },
      { x: 0, y: -0.92, z: 0.01, rx: 0.185, ryTop: 0.185, ryBot: 0.185, u: 0.7 },
      { x: 0, y: -1.24, z: 0.03, rx: 0.215, ryTop: 0.20, ryBot: 0.18, u: 0.85 }
    ];
    const lm = new THREE.Mesh(createLoftedGeometry(lStations, 18, 3), skinMat);
    lm.position.set(lx, ly, lz);
    lm.castShadow = true;
    lm.receiveShadow = true;
    lm.userData.isAnimalHitSurface = true;
    bodyGroup.add(lm);

    const nailMat = new THREE.MeshStandardMaterial({ color: 0xc5bca8, roughness: 0.55 });
    for (let n = -1.5; n <= 1.5; n += 1) {
      const nail = new THREE.Mesh(new THREE.SphereGeometry(0.038, 8, 6), nailMat);
      const ang = n * 0.28;
      nail.position.set(lx + Math.sin(ang) * 0.20, ly - 1.22, lz + 0.03 + Math.cos(ang) * 0.20);
      nail.scale.set(1, 0.85, 0.7);
      bodyGroup.add(nail);
    }
  });

  // Domed Elephant Skull +Seamless Overlapping Trunk!
  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.26, 0.76);
  bodyGroup.add(headPivot);
  animal.headPivot = headPivot;

  const skullStations = [
    { x: 0, y: -0.06, z: -0.18, rx: 0.42, ryTop: 0.44, ryBot: 0.42, u: 0.28 },
    { x: 0, y: 0.15, z: 0.14, rx: 0.38, ryTop: 0.46, ryBot: 0.36, sq: 0.08, u: 0.18 },
    { x: 0, y: 0.08, z: 0.38, rx: 0.30, ryTop: 0.34, ryBot: 0.30, cheek: 0.14, u: 0.11 },
    { x: 0, y: -0.08, z: 0.56, rx: 0.20, ryTop: 0.22, ryBot: 0.20, u: 0.05 }
  ];
  const skullMesh = new THREE.Mesh(createLoftedGeometry(skullStations, 28, 4), skinMat);
  skullMesh.castShadow = true;
  skullMesh.receiveShadow = true;
  skullMesh.userData.isAnimalHitSurface = true;
  headPivot.add(skullMesh);

  // Sparse coarse fuzzy crown hairs
  const bristleMat = new THREE.MeshStandardMaterial({ color: 0x2c2723, roughness: 0.9 });
  for (let i = 0; i < 24; i++) {
    const br = new THREE.Mesh(new THREE.ConeGeometry(0.006, 0.09, 5), bristleMat);
    br.position.set((Math.random() - 0.5) * 0.28, 0.56 + Math.random() * 0.04, 0.12 + (Math.random() - 0.5) * 0.22);
    br.rotation.set((Math.random() - 0.5) * 0.4, 0, (Math.random() - 0.5) * 0.5);
    headPivot.add(br);
  }

  const jawPivot = new THREE.Group();
  jawPivot.position.set(0, -0.18, 0.36);
  headPivot.add(jawPivot);
  animal.jawPivot = jawPivot;
  const lipMesh = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), skinMat);
  lipMesh.scale.set(0.85, 0.55, 1.35);
  lipMesh.position.set(0, -0.04, 0.10);
  jawPivot.add(lipMesh);

  // Curved Ivory Tusks, Warm Eyes & Scalloped Ears
  const tuskMat = new THREE.MeshStandardMaterial({ color: 0xf1ead8, roughness: 0.30 });
  [-1, 1].forEach((side) => {
    const tuskCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.18, -0.12, 0.46),
      new THREE.Vector3(side * 0.22, -0.22, 0.68),
      new THREE.Vector3(side * 0.19, -0.13, 0.88)
    ]);
    const tuskGeo = new THREE.TubeGeometry(tuskCurve, 12, 0.038, 10, false);
    const tusk = new THREE.Mesh(tuskGeo, tuskMat);
    tusk.castShadow = true;
    headPivot.add(tusk);

    const eye = createRealisticEye({ radius: 0.038, irisColor: 0x4b321e, lidColor: 0x5c5b59 });
    eye.position.set(side * 0.275, 0.11, 0.38);
    eye.rotation.y = side * 1.05;
    headPivot.add(eye);
    animal.eyes.push(eye);

    const earPivot = new THREE.Group();
    earPivot.position.set(side * 0.32, 0.18, 0.10);
    const earShape = new THREE.Shape();
    earShape.moveTo(0, 0.22);
    earShape.bezierCurveTo(side * 0.46, 0.35, side * 0.66, 0.06, side * 0.52, -0.34);
    earShape.bezierCurveTo(side * 0.38, -0.60, side * 0.14, -0.54, 0, -0.26);
    earShape.closePath();
    const earGeo = new THREE.ExtrudeGeometry(earShape, {
      depth: 0.026,
      bevelEnabled: true,
      bevelThickness: 0.014,
      bevelSize: 0.014,
      bevelSegments: 2
    });
    const uvAttr = earGeo.attributes.uv;
    for (let i = 0; i < uvAttr.count; i++) {
      uvAttr.setXY(i, uvAttr.getX(i) * 0.8 + 0.5, uvAttr.getY(i) * 0.8 + 0.5);
    }
    const earMesh = new THREE.Mesh(earGeo, skinMat);
    earMesh.castShadow = true;
    earMesh.userData.isAnimalHitSurface = true;
    earPivot.add(earMesh);
    earPivot.rotation.y = -side * 0.42;
    earPivot.userData.baseY = -side * 0.42;
    earPivot.userData.baseZ = 0;
    headPivot.add(earPivot);
    animal.ears.push(earPivot);
  });

  // Seamless Overlapping Capsule-Linked Trunk (ZERO cylinder gaps even when curled steeply!)
  animal.trunkLinks = [];
  let parentLink = headPivot;
  for (let i = 0; i < 12; i++) {
    const t = i / 11;
    const pivot = new THREE.Group();
    if (i === 0) {
      pivot.position.set(0, -0.06, 0.50);
    } else {
      pivot.position.set(0, -0.095, 0.014);
    }
    const rad = THREE.MathUtils.lerp(0.165, 0.058, t);
    // Overlapping CapsuleGeometry eliminates every gap between trunk links!
    const segGeo = new THREE.CapsuleGeometry(rad, 0.065, 8, 16);
    const segMesh = new THREE.Mesh(segGeo, skinMat);
    segMesh.position.y = -0.045;
    segMesh.castShadow = true;
    segMesh.userData.isAnimalHitSurface = true;
    pivot.add(segMesh);
    parentLink.add(pivot);
    animal.trunkLinks.push(pivot);
    parentLink = pivot;
  }
  const trunkTip = new THREE.Group();
  trunkTip.position.set(0, -0.10, 0.02);
  parentLink.add(trunkTip);
  animal.trunkTip = trunkTip;

  animal.sprayBackState = 'idle';
  animal.sprayBackTimer = 0;
  animal.sprayCharge = 0;

  const tailPivot = new THREE.Group();
  tailPivot.position.set(0, 0.04, -1.04);
  bodyGroup.add(tailPivot);
  animal.tailPivot = tailPivot;
  const tailMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.018, 0.56, 8), skinMat);
  tailMesh.position.set(0, -0.26, -0.05);
  tailPivot.add(tailMesh);

  animal.updateElephant = (dt, elapsed) => {
    animal.updateCommon(dt, elapsed);

    animal.ears.forEach((ear, idx) => {
      const side = idx === 0 ? -1 : 1;
      const flapSpeed = animal.sprayBackState === 'spraying' || animal.mood === 'happy' ? 6.5 : 1.8;
      const flapAmp = animal.sprayBackState === 'spraying' || animal.mood === 'happy' ? 0.26 : 0.08;
      ear.rotation.y = ear.userData.baseY + side * Math.sin(elapsed * flapSpeed + idx) * flapAmp;
    });

    if (animal.sprayBackState !== 'idle') {
      animal.sprayBackTimer -= dt;
      if (animal.sprayBackState === 'dipping' && animal.sprayBackTimer <= 0) {
        animal.sprayBackState = 'aiming';
        animal.sprayBackTimer = 0.42;
      } else if (animal.sprayBackState === 'aiming' && animal.sprayBackTimer <= 0) {
        animal.sprayBackState = 'spraying';
        animal.sprayBackTimer = 1.5;
      } else if (animal.sprayBackState === 'spraying' && animal.sprayBackTimer <= 0) {
        animal.sprayBackState = 'idle';
      }
    }

    animal.trunkLinks.forEach((link, idx) => {
      const t = idx / (animal.trunkLinks.length - 1);
      let targetX = 0.03 + Math.sin(elapsed * 1.6 + t * 2.4) * 0.05;
      let targetZ = Math.cos(elapsed * 1.1 + t * 2.1) * 0.04;

      if (animal.sprayBackState === 'dipping') {
        targetX = -0.05 + t * 0.12;
        targetZ = -0.06 * t;
      } else if (animal.sprayBackState === 'aiming' || animal.sprayBackState === 'spraying') {
        targetX = -0.20 - t * 0.075 + Math.sin(elapsed * 14 + idx) * (animal.sprayBackState === 'spraying' ? 0.025 : 0);
        targetZ = Math.sin(elapsed * 4) * 0.03;
      } else if (animal.mood === 'eating') {
        targetX = 0.16 + t * 0.20;
      } else if (animal.mood === 'huh') {
        targetX = t < 0.5 ? -0.16 : 0.20;
        targetZ = 0.07;
      }

      link.rotation.x += (targetX - link.rotation.x) * Math.min(1, dt * 7.5);
      link.rotation.z += (targetZ - link.rotation.z) * Math.min(1, dt * 7.5);
    });
  };

  animal.collectHitMeshes();
  return animal;
}

// 3. CLOSE-UP BENGAL TIGER (8-Shell Thick Striped Fur that gleams silky when brushed!)
export function createTiger(textures) {
  const root = new THREE.Group();
  const animal = new BaseAnimal('tiger', root);
  animal.careState = new AnimalCareState({ initialMud: 0.34, initialGloss: 0.08, seed: 19 });

  const furOpts = {
    map: textures.tigerMap,
    strandMap: textures.strandMap,
    bubbleMap: textures.bubbleMap,
    careState: animal.careState,
    furLength: 0.048,
    furRepeat: new THREE.Vector2(9, 7),
    roughness: 0.78,
    sheenTint: new THREE.Color(0xffe7bf)
  };

  const bodyGroup = new THREE.Group();
  bodyGroup.position.set(0, 0.76, 0);
  root.add(bodyGroup);
  animal.bodyGroup = bodyGroup;

  const torsoStations = [
    { x: 0, y: 0.12, z: 0.62, rx: 0.26, ryTop: 0.27, ryBot: 0.28, sq: 0.07, u: 0.24 },
    { x: 0, y: 0.13, z: 0.35, rx: 0.32, ryTop: 0.34, ryBot: 0.32, sq: 0.09, u: 0.38 },
    { x: 0, y: 0.06, z: 0.0, rx: 0.30, ryTop: 0.30, ryBot: 0.32, sq: 0.05, u: 0.56 },
    { x: 0, y: 0.08, z: -0.38, rx: 0.29, ryTop: 0.31, ryBot: 0.28, sq: 0.07, u: 0.78 },
    { x: 0, y: 0.01, z: -0.68, rx: 0.19, ryTop: 0.21, ryBot: 0.20, sq: 0.04, u: 0.96 }
  ];
  const torsoFur = createMultiShellFurGroup(createLoftedGeometry(torsoStations, 24, 4), furOpts, 6);
  bodyGroup.add(torsoFur);
  animal.furGroups.push(torsoFur);

  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.18, 0.54);
  bodyGroup.add(headPivot);
  animal.headPivot = headPivot;

  const headStations = [
    { x: 0, y: -0.02, z: -0.10, rx: 0.25, ryTop: 0.25, ryBot: 0.24, u: 0.26 },
    { x: 0, y: 0.08, z: 0.12, rx: 0.27, ryTop: 0.24, ryBot: 0.22, cheek: 0.30, u: 0.16 },
    { x: 0, y: 0.09, z: 0.27, rx: 0.20, ryTop: 0.185, ryBot: 0.16, cheek: 0.15, u: 0.10 },
    { x: 0, y: 0.02, z: 0.42, rx: 0.135, ryTop: 0.125, ryBot: 0.095, u: 0.045 }
  ];
  const headFur = createMultiShellFurGroup(createLoftedGeometry(headStations, 24, 4), furOpts, 6);
  headPivot.add(headFur);
  animal.furGroups.push(headFur);

  // Distinct sculptural feline pink-terracotta nose pad & muzzle cushions!
  const nosePad = new THREE.Mesh(
    new THREE.SphereGeometry(0.042, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0xc9706b, roughness: 0.42 })
  );
  nosePad.scale.set(1.15, 0.72, 0.65);
  nosePad.position.set(0, 0.055, 0.485);
  headPivot.add(nosePad);

  const jawPivot = new THREE.Group();
  jawPivot.position.set(0, -0.03, 0.25);
  headPivot.add(jawPivot);
  animal.jawPivot = jawPivot;
  const chin = new THREE.Mesh(
    new THREE.SphereGeometry(0.088, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0xe6ded0, roughness: 0.85 })
  );
  chin.scale.set(0.95, 0.48, 1.25);
  chin.position.set(0, -0.025, 0.12);
  jawPivot.add(chin);

  const whiskerMat = new THREE.MeshBasicMaterial({ color: 0xf7f4ec, transparent: true, opacity: 0.72 });
  [-1, 1].forEach((side) => {
    const eye = createRealisticEye({ radius: 0.036, irisColor: 0xe6a128, lidColor: 0x1b1614 });
    eye.position.set(side * 0.098, 0.138, 0.398);
    eye.rotation.y = side * 0.18;
    headPivot.add(eye);
    animal.eyes.push(eye);

    const earPivot = new THREE.Group();
    earPivot.position.set(side * 0.17, 0.25, 0.10);
    const earMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.068, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0x1d1816, roughness: 0.82 })
    );
    earMesh.scale.set(0.95, 1.05, 0.40);
    earPivot.add(earMesh);
    const spot = new THREE.Mesh(
      new THREE.SphereGeometry(0.032, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xf3eee4, roughness: 0.8 })
    );
    spot.position.set(0, 0.01, -0.02);
    earPivot.add(spot);
    earPivot.userData.baseZ = -side * 0.28;
    earPivot.rotation.z = -side * 0.28;
    headPivot.add(earPivot);
    animal.ears.push(earPivot);

    for (let w = 0; w < 4; w++) {
      const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.0008, 0.21, 4), whiskerMat);
      wh.rotation.z = side * (Math.PI / 2 + 0.12 - w * 0.09);
      wh.rotation.y = -side * 0.25;
      wh.position.set(side * 0.16, 0.0 + w * 0.014, 0.42);
      headPivot.add(wh);
    }
  });

  // Seamless heavy feline legs nested high into body
  [
    [-0.19, -0.12, 0.40, 0.35],
    [0.19, -0.12, 0.40, 0.35],
    [-0.20, -0.12, -0.42, 0.78],
    [0.20, -0.12, -0.42, 0.78]
  ].forEach(([lx, ly, lz, uOff]) => {
    const lStations = [
      { x: 0, y: 0.18, z: 0, rx: 0.155, ryTop: 0.16, ryBot: 0.16, u: uOff },
      { x: 0, y: -0.28, z: 0.02, rx: 0.10, ryTop: 0.105, ryBot: 0.105, u: uOff + 0.08 },
      { x: 0, y: -0.58, z: 0.03, rx: 0.09, ryTop: 0.092, ryBot: 0.092, u: uOff + 0.14 },
      { x: 0, y: -0.62, z: 0.08, rx: 0.115, ryTop: 0.075, ryBot: 0.065, u: uOff + 0.18 }
    ];
    const lf = createMultiShellFurGroup(createLoftedGeometry(lStations, 14, 3), furOpts, 2);
    lf.position.set(lx, ly, lz);
    bodyGroup.add(lf);
    animal.furGroups.push(lf);
  });

  const tailPivot = new THREE.Group();
  tailPivot.position.set(0, 0.02, -0.68);
  bodyGroup.add(tailPivot);
  animal.tailPivot = tailPivot;
  const tailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.06, -0.22, -0.28),
    new THREE.Vector3(0.14, -0.34, -0.56),
    new THREE.Vector3(0.18, -0.24, -0.78)
  ]);
  const tailMesh = new THREE.Mesh(
    new THREE.TubeGeometry(tailCurve, 16, 0.048, 10, false),
    new THREE.MeshStandardMaterial({ map: textures.tigerMap, roughness: 0.75 })
  );
  tailMesh.castShadow = true;
  tailPivot.add(tailMesh);

  animal.collectHitMeshes();
  return animal;
}

// 4. REGAL SAVANNA LION (Lush 3D Golden-Umber Mane Crown + Expressive Feline Face!)
export function createLion(textures) {
  const root = new THREE.Group();
  const animal = new BaseAnimal('lion', root);
  animal.careState = new AnimalCareState({ initialMud: 0.10, initialGloss: 0.35, seed: 27 });

  const furOpts = {
    map: textures.lionMap,
    strandMap: textures.strandMap,
    bubbleMap: textures.bubbleMap,
    careState: animal.careState,
    furLength: 0.038,
    furRepeat: new THREE.Vector2(8, 6),
    roughness: 0.76,
    sheenTint: new THREE.Color(0xffdf9e)
  };

  const bodyGroup = new THREE.Group();
  bodyGroup.position.set(0, 0.82, 0);
  root.add(bodyGroup);
  animal.bodyGroup = bodyGroup;

  const torsoStations = [
    { x: 0, y: 0.12, z: 0.62, rx: 0.28, ryTop: 0.30, ryBot: 0.31, sq: 0.07, u: 0.25 },
    { x: 0, y: 0.14, z: 0.34, rx: 0.33, ryTop: 0.36, ryBot: 0.34, sq: 0.08, u: 0.40 },
    { x: 0, y: 0.06, z: -0.05, rx: 0.29, ryTop: 0.30, ryBot: 0.29, sq: 0.05, u: 0.62 },
    { x: 0, y: 0.07, z: -0.44, rx: 0.27, ryTop: 0.29, ryBot: 0.26, sq: 0.06, u: 0.84 },
    { x: 0, y: 0.0, z: -0.70, rx: 0.17, ryTop: 0.19, ryBot: 0.19, u: 0.98 }
  ];
  const torsoFur = createMultiShellFurGroup(createLoftedGeometry(torsoStations, 28, 4), furOpts, 5);
  bodyGroup.add(torsoFur);
  animal.furGroups.push(torsoFur);

  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.20, 0.56);
  bodyGroup.add(headPivot);
  animal.headPivot = headPivot;

  // Volumetric Multi-Shell Golden-to-Mahogany Lion Mane!
  const maneColorCanvas = document.createElement('canvas');
  maneColorCanvas.width = 256;
  maneColorCanvas.height = 256;
  const mctx = maneColorCanvas.getContext('2d');
  const mgrad = mctx.createLinearGradient(0, 0, 256, 0);
  mgrad.addColorStop(0, '#c88c42');
  mgrad.addColorStop(0.55, '#6e3e1b');
  mgrad.addColorStop(1, '#3d210f');
  mctx.fillStyle = mgrad;
  mctx.fillRect(0, 0, 256, 256);
  const maneTex = new THREE.CanvasTexture(maneColorCanvas);
  maneTex.colorSpace = THREE.SRGBColorSpace;

  const maneStations = [
    { x: 0, y: -0.06, z: -0.28, rx: 0.38, ryTop: 0.40, ryBot: 0.44, u: 0.85 },
    { x: 0, y: 0.08, z: -0.02, rx: 0.43, ryTop: 0.45, ryBot: 0.47, u: 0.45 },
    { x: 0, y: 0.12, z: 0.20, rx: 0.35, ryTop: 0.38, ryBot: 0.35, u: 0.10 }
  ];
  const maneGeo = createLoftedGeometry(maneStations, 28, 3);
  // Sculpt organic shaggy lion mane waves & layered locks so it never looks like a flat circular ring!
  const mPos = maneGeo.attributes.position;
  for (let i = 0; i < mPos.count; i++) {
    const mx = mPos.getX(i), my = mPos.getY(i), mz = mPos.getZ(i);
    const ang = Math.atan2(mx, my);
    const shaggy = 1.0 + 0.12 * Math.sin(ang * 7.0 + mz * 8.0) + 0.08 * Math.cos(ang * 13.0 - mz * 5.0);
    // Elongate chest bib downward like a real male African lion!
    const bibDrop = my < 0 ? Math.abs(my) * 0.22 : 0;
    mPos.setXYZ(i, mx * shaggy * 0.94, my * shaggy - bibDrop, mz);
  }
  maneGeo.computeVertexNormals();

  const maneFur = createMultiShellFurGroup(
    maneGeo,
    {
      ...furOpts,
      map: maneTex,
      furLength: 0.082,
      furRepeat: new THREE.Vector2(7, 7),
      sheenTint: new THREE.Color(0xffcf7c)
    },
    5
  );
  headPivot.add(maneFur);
  animal.furGroups.push(maneFur);

  // Lion Face protruding clearly forward out of the mane!
  const faceStations = [
    { x: 0, y: 0.08, z: 0.12, rx: 0.22, ryTop: 0.23, ryBot: 0.20, u: 0.22 },
    { x: 0, y: 0.09, z: 0.32, rx: 0.185, ryTop: 0.185, ryBot: 0.155, cheek: 0.16, u: 0.12 },
    { x: 0, y: 0.02, z: 0.50, rx: 0.135, ryTop: 0.125, ryBot: 0.095, u: 0.06 }
  ];
  const faceFur = createMultiShellFurGroup(createLoftedGeometry(faceStations, 24, 3), furOpts, 4);
  headPivot.add(faceFur);
  animal.furGroups.push(faceFur);

  const lionNose = new THREE.Mesh(
    new THREE.SphereGeometry(0.044, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0x3b241f, roughness: 0.45 })
  );
  lionNose.scale.set(1.15, 0.72, 0.65);
  lionNose.position.set(0, 0.055, 0.56);
  headPivot.add(lionNose);

  const jawPivot = new THREE.Group();
  jawPivot.position.set(0, -0.03, 0.30);
  headPivot.add(jawPivot);
  animal.jawPivot = jawPivot;
  const lowerJaw = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.072, 0.12, 6, 10),
    new THREE.MeshStandardMaterial({ color: 0xd4b687, roughness: 0.82 })
  );
  lowerJaw.rotation.x = Math.PI / 2;
  lowerJaw.scale.set(1, 1, 0.68);
  lowerJaw.position.set(0, -0.028, 0.14);
  jawPivot.add(lowerJaw);

  [-1, 1].forEach((side) => {
    const eye = createRealisticEye({ radius: 0.042, irisColor: 0xda9226, lidColor: 0x3b2514 });
    eye.position.set(side * 0.102, 0.145, 0.465);
    eye.rotation.y = side * 0.18;
    headPivot.add(eye);
    animal.eyes.push(eye);

    const earPivot = new THREE.Group();
    earPivot.position.set(side * 0.24, 0.31, 0.14);
    const ear = new THREE.Mesh(
      new THREE.SphereGeometry(0.068, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xb98b4e, roughness: 0.8 })
    );
    ear.scale.set(1, 1, 0.42);
    earPivot.add(ear);
    earPivot.userData.baseZ = -side * 0.25;
    headPivot.add(earPivot);
    animal.ears.push(earPivot);
  });

  [
    [-0.20, -0.14, 0.42, 0.38],
    [0.20, -0.14, 0.42, 0.38],
    [-0.20, -0.14, -0.44, 0.8],
    [0.20, -0.14, -0.44, 0.8]
  ].forEach(([lx, ly, lz, uOff]) => {
    const lStations = [
      { x: 0, y: 0.18, z: 0, rx: 0.155, ryTop: 0.16, ryBot: 0.16, u: uOff },
      { x: 0, y: -0.32, z: 0.02, rx: 0.10, ryTop: 0.105, ryBot: 0.105, u: uOff + 0.08 },
      { x: 0, y: -0.64, z: 0.04, rx: 0.09, ryTop: 0.092, ryBot: 0.092, u: uOff + 0.14 },
      { x: 0, y: -0.68, z: 0.09, rx: 0.115, ryTop: 0.08, ryBot: 0.065, u: uOff + 0.18 }
    ];
    const lf = createMultiShellFurGroup(createLoftedGeometry(lStations, 12, 2), furOpts, 1);
    lf.position.set(lx, ly, lz);
    bodyGroup.add(lf);
    animal.furGroups.push(lf);
  });

  const tailPivot = new THREE.Group();
  tailPivot.position.set(0, 0.02, -0.70);
  bodyGroup.add(tailPivot);
  animal.tailPivot = tailPivot;
  const tCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(-0.06, -0.26, -0.32),
    new THREE.Vector3(-0.10, -0.30, -0.60)
  ]);
  tailPivot.add(new THREE.Mesh(
    new THREE.TubeGeometry(tCurve, 12, 0.032, 8, false),
    new THREE.MeshStandardMaterial({ color: 0xc39456, roughness: 0.8 })
  ));
  const tuft = new THREE.Mesh(
    new THREE.SphereGeometry(0.068, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0x3f2210, roughness: 0.88 })
  );
  tuft.scale.set(0.85, 1.35, 0.85);
  tuft.position.set(-0.10, -0.32, -0.64);
  tailPivot.add(tuft);

  animal.collectHitMeshes();
  return animal;
}

// 5. GENTLE GIRAFFE (Seamless overlapping cervical neck curving into frame so face & eyelashes shine!)
export function createGiraffe(textures) {
  const root = new THREE.Group();
  const animal = new BaseAnimal('giraffe', root);
  animal.careState = new AnimalCareState({ initialMud: 0.08, initialGloss: 0.30, seed: 41 });

  const furOpts = {
    map: textures.giraffeMap,
    strandMap: textures.strandMap,
    bubbleMap: textures.bubbleMap,
    careState: animal.careState,
    furLength: 0.026,
    furRepeat: new THREE.Vector2(10, 8),
    roughness: 0.74,
    sheenTint: new THREE.Color(0xfff1d4)
  };

  const bodyGroup = new THREE.Group();
  bodyGroup.position.set(0, 1.32, 0);
  root.add(bodyGroup);
  animal.bodyGroup = bodyGroup;

  const torsoStations = [
    { x: 0, y: 0.26, z: 0.44, rx: 0.25, ryTop: 0.32, ryBot: 0.30, u: 0.32 },
    { x: 0, y: 0.14, z: 0.14, rx: 0.30, ryTop: 0.35, ryBot: 0.35, u: 0.48 },
    { x: 0, y: -0.02, z: -0.24, rx: 0.27, ryTop: 0.29, ryBot: 0.30, u: 0.72 },
    { x: 0, y: -0.10, z: -0.50, rx: 0.19, ryTop: 0.21, ryBot: 0.21, u: 0.94 }
  ];
  const torsoFur = createMultiShellFurGroup(createLoftedGeometry(torsoStations, 26, 4), furOpts, 4);
  bodyGroup.add(torsoFur);
  animal.furGroups.push(torsoFur);

  // 3 Overlapping Cervical Neck Segments curving gracefully forward into camera view!
  animal.neckLinks = [];
  let neckParent = bodyGroup;
  const neckLens = [0.38, 0.36, 0.34];
  for (let i = 0; i < 3; i++) {
    const pivot = new THREE.Group();
    if (i === 0) {
      pivot.position.set(0, 0.22, 0.36);
      pivot.rotation.x = 0.52;
    } else {
      pivot.position.set(0, neckLens[i - 1] * 0.84, 0.02);
      pivot.rotation.x = 0.18;
    }
    const r0 = 0.20 - i * 0.032;
    const r1 = 0.165 - i * 0.030;
    const nStations = [
      { x: 0, y: -0.09, z: 0, rx: r0 * 0.88, ryTop: r0, ryBot: r0, u: 0.28 - i * 0.06 },
      { x: 0, y: neckLens[i] * 0.5, z: 0.01, rx: (r0 + r1) * 0.44, ryTop: (r0 + r1) * 0.5, ryBot: (r0 + r1) * 0.5, u: 0.25 - i * 0.06 },
      { x: 0, y: neckLens[i], z: 0.02, rx: r1 * 0.88, ryTop: r1, ryBot: r1, u: 0.22 - i * 0.06 }
    ];
    const nf = createMultiShellFurGroup(createLoftedGeometry(nStations, 20, 3), furOpts, 4);
    pivot.add(nf);
    animal.furGroups.push(nf);
    neckParent.add(pivot);
    animal.neckLinks.push(pivot);
    neckParent = pivot;
  }

  const headPivot = new THREE.Group();
  headPivot.position.set(0, neckLens[2] * 0.86, 0.02);
  headPivot.rotation.x = -0.58;
  animal.baseHeadRot.x = -0.58;
  neckParent.add(headPivot);
  animal.headPivot = headPivot;

  const gHeadStations = [
    { x: 0, y: -0.02, z: -0.08, rx: 0.13, ryTop: 0.14, ryBot: 0.13, u: 0.12 },
    { x: 0, y: 0.06, z: 0.10, rx: 0.135, ryTop: 0.145, ryBot: 0.12, cheek: 0.15, u: 0.08 },
    { x: 0, y: 0.0, z: 0.28, rx: 0.09, ryTop: 0.095, ryBot: 0.08, u: 0.03 },
    { x: 0, y: -0.03, z: 0.42, rx: 0.072, ryTop: 0.08, ryBot: 0.065, u: 0.005 }
  ];
  const gHeadFur = createMultiShellFurGroup(createLoftedGeometry(gHeadStations, 22, 3), furOpts, 4);
  headPivot.add(gHeadFur);
  animal.furGroups.push(gHeadFur);

  const jawPivot = new THREE.Group();
  jawPivot.position.set(0, -0.04, 0.18);
  headPivot.add(jawPivot);
  animal.jawPivot = jawPivot;
  const gJaw = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.048, 0.16, 6, 8),
    new THREE.MeshStandardMaterial({ color: 0xd5c4a3, roughness: 0.76 })
  );
  gJaw.rotation.x = Math.PI / 2 + 0.12;
  gJaw.position.set(0, -0.02, 0.12);
  jawPivot.add(gJaw);

  const tongueMesh = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.024, 0.22, 6, 8),
    new THREE.MeshStandardMaterial({ color: 0x45354c, roughness: 0.32 })
  );
  tongueMesh.rotation.x = Math.PI / 2;
  tongueMesh.position.set(0, 0.01, 0.14);
  tongueMesh.scale.set(1, 0.2, 1);
  jawPivot.add(tongueMesh);
  animal.tongueMesh = tongueMesh;

  [-1, 1].forEach((side) => {
    const oss = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.028, 0.14, 10),
      new THREE.MeshStandardMaterial({ color: 0xd7c199, roughness: 0.75 })
    );
    oss.position.set(side * 0.055, 0.20, 0.06);
    oss.rotation.z = -side * 0.12;
    oss.rotation.x = -0.18;
    headPivot.add(oss);
    const ossTip = new THREE.Mesh(
      new THREE.SphereGeometry(0.032, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0x3b2416, roughness: 0.88 })
    );
    ossTip.position.set(side * 0.062, 0.28, 0.045);
    headPivot.add(ossTip);

    const eye = createRealisticEye({ radius: 0.034, irisColor: 0x2a180f, lidColor: 0x3b2819 });
    eye.position.set(side * 0.118, 0.08, 0.14);
    eye.rotation.y = side * 0.94;
    headPivot.add(eye);
    animal.eyes.push(eye);

    const earPivot = new THREE.Group();
    earPivot.position.set(side * 0.11, 0.14, 0.02);
    const ear = new THREE.Mesh(
      new THREE.ConeGeometry(0.045, 0.17, 10),
      new THREE.MeshStandardMaterial({ color: 0xd8c39b, roughness: 0.78 })
    );
    ear.scale.set(0.8, 1, 0.45);
    ear.position.y = 0.08;
    earPivot.add(ear);
    earPivot.rotation.z = -side * 0.85;
    earPivot.userData.baseZ = -side * 0.85;
    headPivot.add(earPivot);
    animal.ears.push(earPivot);
  });

  [
    [-0.17, -0.06, 0.32, 0.38],
    [0.17, -0.06, 0.32, 0.38],
    [-0.17, -0.16, -0.34, 0.78],
    [0.17, -0.16, -0.34, 0.78]
  ].forEach(([lx, ly, lz, uOff], idx) => {
    const len = idx < 2 ? 1.26 : 1.16;
    const leg = buildHoofLeg({ length: len, topR: 0.125, midR: 0.052, hoofR: 0.066, furOpts, shellCount: 2, uOffset: uOff });
    leg.position.set(lx, ly, lz);
    bodyGroup.add(leg);
    animal.furGroups.push(leg.userData.furGroup);
  });

  animal.targetNeckReachY = 2.05;
  animal.updateGiraffe = (dt, elapsed) => {
    animal.updateCommon(dt, elapsed);
    const normReach = THREE.MathUtils.clamp((animal.targetNeckReachY - 1.35) / 1.55, 0, 1);
    const baseAngles = [
      THREE.MathUtils.lerp(0.82, 0.24, normReach),
      THREE.MathUtils.lerp(0.32, 0.06, normReach),
      THREE.MathUtils.lerp(0.24, 0.02, normReach)
    ];
    animal.neckLinks.forEach((nl, i) => {
      nl.rotation.x += (baseAngles[i] - nl.rotation.x) * Math.min(1, dt * 4.5);
    });
    animal.baseHeadRot.x = THREE.MathUtils.lerp(-0.92, -0.32, normReach);

    const tongueOut = animal.chewTimer > 0 ? 0.35 + Math.abs(Math.sin(elapsed * 9)) * 0.95 : 0.12;
    animal.tongueMesh.scale.y += (tongueOut - animal.tongueMesh.scale.y) * Math.min(1, dt * 12);
    animal.tongueMesh.position.z = 0.10 + animal.tongueMesh.scale.y * 0.12;
  };

  animal.collectHitMeshes();
  return animal;
}
