import * as THREE from 'three';
import { RoundedBoxGeometry } from '../vendor/RoundedBoxGeometry.js';
import { applySubsurfaceScattering, createCrystalGlassMaterial } from './materials.js';

function createFaceSkinTexture(baseHex = '#eec0a8', lipHex = '#cc6e72') {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 256, 256);

  // Subtle warm subsurface cheek & nose bridge warmth (sphere UV: front of face is around u=0.5, v=0.5)
  // Wait: Three.js SphereGeometry UV has u=0.5 at -X or +Z depending on rotation; we align headMesh.rotation.y = -Math.PI/2 so u=0.5 faces +Z!
  const blushSpots = [
    { x: 104, y: 140, r: 26, a: 0.22 },
    { x: 152, y: 140, r: 26, a: 0.22 },
    { x: 128, y: 126, r: 16, a: 0.12 },
  ];
  blushSpots.forEach((b) => {
    const g = ctx.createRadialGradient(b.x, b.y, 2, b.x, b.y, b.r);
    g.addColorStop(0, `rgba(235, 95, 95, ${b.a})`);
    g.addColorStop(1, 'rgba(235, 95, 95, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
  });

  // Soft natural forehead/chin tonal gradient
  const topGrad = ctx.createLinearGradient(0, 0, 0, 256);
  topGrad.addColorStop(0, 'rgba(255,242,232,0.08)');
  topGrad.addColorStop(0.5, 'rgba(0,0,0,0)');
  topGrad.addColorStop(1, 'rgba(110,55,40,0.12)');
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, 256, 256);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createSkinMaterial(baseHexStr = '#f0c2aa', sssHex = 0xe85a46) {
  const tex = createFaceSkinTexture(baseHexStr);
  const mat = new THREE.MeshPhysicalMaterial({
    map: tex,
    roughness: 0.48,
    metalness: 0.0,
    clearcoat: 0.08,
    clearcoatRoughness: 0.55,
    sheen: 0.22,
    sheenColor: new THREE.Color(0xffe3d8),
    sheenRoughness: 0.65,
  });
  return applySubsurfaceScattering(mat, sssHex, 0.48, 2.2);
}

function createIrisTexture(irisHex = '#382214') {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f5f0eb';
  ctx.fillRect(0, 0, 128, 128);
  const cx = 64, cy = 64;
  const g = ctx.createRadialGradient(cx, cy, 7, cx, cy, 36);
  g.addColorStop(0.0, '#090707');
  g.addColorStop(0.38, '#120d0a');
  g.addColorStop(0.45, irisHex);
  g.addColorStop(0.86, irisHex);
  g.addColorStop(1.0, '#1a110c');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, 36, 0, Math.PI * 2);
  ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

let sharedIrisTex = null;

// Natural, warm, non-toy 3D human bust with sculpted shoulders, arms, parted hair (NO face mask!),
// soft subsurface skin, and expressive facial rig.
export function createPersonCharacter(role = 'daughter', fabricTex = null) {
  if (!sharedIrisTex) sharedIrisTex = createIrisTexture('#3b2416');

  const root = new THREE.Group();
  const isChild = role === 'daughter' || role === 'friend';
  const headScale = isChild ? 0.84 : 1.0;
  const skinStr = role === 'dad' ? '#e2ae92' : role === 'mom' ? '#f0c4ae' : '#f3c8b3';
  const skinMat = createSkinMaterial(skinStr);

  // Torso, Sloped Shoulders, Collar & Natural Resting Arms
  const torsoGroup = new THREE.Group();
  root.add(torsoGroup);

  const shirtColors = {
    daughter: 0xf4ece1,
    dad: 0x253346,
    mom: 0x6b364b,
    friend: 0xc98b32,
  };
  const shirtMat = new THREE.MeshStandardMaterial({
    color: shirtColors[role] || 0x3b4856,
    roughness: 0.84,
  });

  // Sculpted organic torso lathe (sits behind bar counter so waist is naturally grounded!)
  const tScale = isChild ? 0.78 : 1.0;
  const torsoPts = [
    new THREE.Vector2(0.001, -0.18),
    new THREE.Vector2(0.23 * tScale, -0.18),
    new THREE.Vector2(0.24 * tScale, 0.24 * tScale),
    new THREE.Vector2(0.25 * tScale, 0.44 * tScale),
    new THREE.Vector2(0.21 * tScale, 0.56 * tScale),
    new THREE.Vector2(0.09 * tScale, 0.62 * tScale),
    new THREE.Vector2(0.001, 0.62 * tScale),
  ];
  const chestMesh = new THREE.Mesh(new THREE.LatheGeometry(torsoPts, 24), shirtMat);
  chestMesh.scale.set(1.18, 1.0, 0.74);
  torsoGroup.add(chestMesh);

  // Seamless sloped shoulders + natural arms curving smoothly into chest (zero bump!)
  [-1, 1].forEach((side) => {
    const armCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.17 * tScale, 0.51 * tScale, 0.0),
      new THREE.Vector3(side * 0.255 * tScale, 0.43 * tScale, 0.01 * tScale),
      new THREE.Vector3(side * 0.285 * tScale, 0.22 * tScale, 0.03 * tScale),
      new THREE.Vector3(side * 0.26 * tScale, -0.18, 0.08 * tScale),
    ]);
    const arm = new THREE.Mesh(new THREE.TubeGeometry(armCurve, 14, 0.068 * tScale, 10, false), shirtMat);
    torsoGroup.add(arm);
  });

  const torsoTopY = 0.60 * tScale;

  // Neck + Collarbone
  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.058 * headScale, 0.070 * headScale, 0.14, 16),
    skinMat
  );
  neck.position.y = torsoTopY + 0.03;
  torsoGroup.add(neck);

  // Soft shirt neckline collar ring
  const collar = new THREE.Mesh(
    new THREE.TorusGeometry(0.082 * tScale, 0.018 * tScale, 8, 20),
    shirtMat
  );
  collar.rotation.x = Math.PI * 0.52;
  collar.position.y = torsoTopY + 0.005;
  torsoGroup.add(collar);

  // Worn Apron on Daughter (softly curved around chest!)
  let wornApron = null;
  let wornApronMat = null;
  let wornTrimMat = null;
  if (role === 'daughter') {
    wornApron = new THREE.Group();
    wornApronMat = new THREE.MeshStandardMaterial({
      map: fabricTex,
      roughness: 0.82,
    });
    wornTrimMat = new THREE.MeshStandardMaterial({ color: 0xf7e6d4, roughness: 0.78 });
    const bib = new THREE.Mesh(new RoundedBoxGeometry(0.24, 0.28, 0.03, 4, 0.012), wornApronMat);
    bib.position.set(0, torsoTopY * 0.56, 0.145);
    bib.rotation.x = -0.08;
    const strapL = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.16, 0.02), wornTrimMat);
    strapL.position.set(-0.085, torsoTopY * 0.90, 0.11);
    strapL.rotation.x = -0.42;
    const strapR = strapL.clone();
    strapR.position.x = 0.085;
    wornApron.add(bib, strapL, strapR);
    wornApron.visible = false;
    torsoGroup.add(wornApron);
  }

  // Head Group
  const headGroup = new THREE.Group();
  headGroup.position.y = torsoTopY + 0.09 + 0.135 * headScale;
  root.add(headGroup);

  // Sculpted anatomical oval head (rotated -PI/2 in Y so UV center u=0.5 faces straight +Z!)
  const headGeo = new THREE.SphereGeometry(0.175 * headScale, 28, 22);
  headGeo.rotateY(-Math.PI * 0.5);
  const pos = headGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    if (y < 0) {
      const chinT = Math.min(1, -y / (0.175 * headScale));
      x *= isChild ? 1.0 - chinT * 0.18 : 1.0 - chinT * 0.24;
      z *= 1.0 - chinT * 0.10;
      y *= isChild ? 0.98 : 1.08;
    } else {
      y *= 1.06;
      x *= 0.96;
    }
    pos.setXYZ(i, x, y, z);
  }
  headGeo.computeVertexNormals();
  const headMesh = new THREE.Mesh(headGeo, skinMat);
  headGroup.add(headMesh);

  // Subtle sculpted nose bridge & tip
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.020 * headScale, 12, 10), skinMat);
  nose.scale.set(0.78, 1.35, 1.15);
  nose.position.set(0, -0.010 * headScale, 0.168 * headScale);
  headGroup.add(nose);

  // Ears
  [-1, 1].forEach((side) => {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.032 * headScale, 10, 8), skinMat);
    ear.scale.set(0.42, 1.15, 0.75);
    ear.position.set(side * 0.165 * headScale, -0.008 * headScale, -0.01 * headScale);
    headGroup.add(ear);
  });

  // Keep blushMat hidden (lit PBR face texture + SSS handles warm rosy cheeks naturally without unlit glow!)
  const blushMat = new THREE.MeshBasicMaterial({
    color: 0xe8646c,
    transparent: true,
    opacity: 0.0,
    visible: false,
    depthWrite: false,
  });
  const cheeks = [];
  [-1, 1].forEach((side) => {
    const ch = new THREE.Mesh(new THREE.SphereGeometry(0.036 * headScale, 10, 8), blushMat);
    ch.scale.set(1.1, 0.7, 0.25);
    ch.position.set(side * 0.086 * headScale, -0.038 * headScale, 0.148 * headScale);
    ch.rotation.y = side * 0.42;
    headGroup.add(ch);
    cheeks.push(ch);
  });

  // Realistic Almond Eyes + Upper Eyelids + Natural Brows
  const eyeMat = new THREE.MeshPhysicalMaterial({
    map: sharedIrisTex,
    roughness: 0.03,
    clearcoat: 1.0,
    clearcoatRoughness: 0.01,
  });
  const hairHex = role === 'dad' ? 0x1d1613 : role === 'mom' ? 0x2c1b14 : role === 'friend' ? 0x3d2618 : 0x261812;
  const hairMat = new THREE.MeshPhysicalMaterial({
    color: hairHex,
    roughness: 0.46,
    clearcoat: 0.18,
    clearcoatRoughness: 0.38,
  });

  const eyes = [];
  const lids = [];
  const brows = [];
  const squintLines = [];

  [-1, 1].forEach((side) => {
    const eyePivot = new THREE.Group();
    eyePivot.position.set(side * 0.060 * headScale, 0.018 * headScale, 0.146 * headScale);
    headGroup.add(eyePivot);

    const eyeball = new THREE.Mesh(new THREE.SphereGeometry(0.024 * headScale, 16, 12), eyeMat);
    eyeball.scale.set(1.08, 0.88, 0.95);
    eyeball.rotation.y = -Math.PI * 0.5;
    eyePivot.add(eyeball);

    const glint = new THREE.Mesh(
      new THREE.SphereGeometry(0.0042 * headScale, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    glint.position.set(side * 0.006 * headScale, 0.007 * headScale, 0.023 * headScale);
    eyePivot.add(glint);

    const lid = new THREE.Mesh(
      new THREE.SphereGeometry(0.0265 * headScale, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.52),
      skinMat
    );
    lid.scale.set(1.08, 0.92, 0.98);
    lid.rotation.x = -1.28;
    eyePivot.add(lid);

    // Sour squeeze "><" crinkle bar
    const sq = new THREE.Mesh(new RoundedBoxGeometry(0.048 * headScale, 0.008 * headScale, 0.01, 2, 0.003), hairMat);
    sq.position.set(0, 0, 0.023 * headScale);
    sq.rotation.z = side * -0.34;
    sq.visible = false;
    eyePivot.add(sq);

    const brow = new THREE.Mesh(
      new RoundedBoxGeometry(0.048 * headScale, 0.0085 * headScale, 0.012, 3, 0.004),
      hairMat
    );
    brow.position.set(side * 0.062 * headScale, 0.056 * headScale, 0.156 * headScale);
    brow.rotation.z = side * -0.05;
    headGroup.add(brow);

    eyes.push(eyeball);
    lids.push(lid);
    brows.push(brow);
    squintLines.push(sq);
  });

  // Delicate, Natural Lips & Mouth Rig (NO thick toy sausage!)
  const mouthGroup = new THREE.Group();
  mouthGroup.position.set(0, -0.068 * headScale, 0.154 * headScale);
  headGroup.add(mouthGroup);

  const lipMat = applySubsurfaceScattering(
    new THREE.MeshPhysicalMaterial({
      color: isChild ? 0xcf6c70 : role === 'mom' ? 0xbf5660 : 0xba756e,
      roughness: 0.36,
      clearcoat: 0.35,
    }),
    0xe85060,
    0.42,
    2.2
  );
  const smileTorus = new THREE.Mesh(
    new THREE.TorusGeometry(0.028 * headScale, 0.0052 * headScale, 8, 18, Math.PI),
    lipMat
  );
  smileTorus.rotation.z = Math.PI;
  mouthGroup.add(smileTorus);

  const mouthInner = new THREE.Mesh(
    new THREE.SphereGeometry(0.021 * headScale, 12, 8),
    new THREE.MeshStandardMaterial({ color: 0x4d141b, roughness: 0.75 })
  );
  mouthInner.scale.set(1.1, 0.35, 0.35);
  mouthInner.position.set(0, -0.009 * headScale, -0.003);
  mouthInner.visible = false;
  mouthGroup.add(mouthInner);

  const puckerMesh = new THREE.Mesh(
    new THREE.TorusGeometry(0.011 * headScale, 0.0055 * headScale, 8, 14),
    lipMat
  );
  puckerMesh.visible = false;
  mouthGroup.add(puckerMesh);

  const foamMustache = new THREE.Mesh(
    new RoundedBoxGeometry(0.068 * headScale, 0.015 * headScale, 0.018, 3, 0.006),
    new THREE.MeshStandardMaterial({ color: 0xfffaf5, roughness: 0.32 })
  );
  foamMustache.position.set(0, 0.015 * headScale, 0.010);
  foamMustache.visible = false;
  mouthGroup.add(foamMustache);

  // Natural Cranium Hair Sculpt — tilted BACK so face, forehead, brows & eyes are 100% open & clean!
  const hairBack = new THREE.Mesh(
    new THREE.SphereGeometry(0.184 * headScale, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.58),
    hairMat
  );
  hairBack.position.set(0, 0.022 * headScale, -0.026 * headScale);
  hairBack.rotation.x = -0.68; // Tilted toward the back of the skull!
  headGroup.add(hairBack);

  // Soft natural side-parted fringe above the eyebrows (y >= +0.10, NEVER covering eyes!)
  if (role === 'dad') {
    const crownSweep = new THREE.Mesh(new THREE.SphereGeometry(0.12 * headScale, 16, 12), hairMat);
    crownSweep.scale.set(1.25, 0.45, 0.85);
    crownSweep.position.set(0.02 * headScale, 0.155 * headScale, 0.06 * headScale);
    crownSweep.rotation.z = -0.14;
    headGroup.add(crownSweep);
  } else {
    // Soft parted curtain bangs high on forehead
    [-1, 1].forEach((side) => {
      const bang = new THREE.Mesh(new THREE.SphereGeometry(0.088 * headScale, 14, 10), hairMat);
      bang.scale.set(1.05, 0.52, 0.55);
      bang.position.set(side * 0.072 * headScale, 0.132 * headScale, 0.112 * headScale);
      bang.rotation.z = side * -0.36;
      bang.rotation.y = side * 0.28;
      headGroup.add(bang);
    });
  }

  if (role === 'daughter') {
    [-1, 1].forEach((side) => {
      const tail = new THREE.Mesh(new THREE.SphereGeometry(0.062 * headScale, 14, 10), hairMat);
      tail.scale.set(0.8, 1.45, 0.8);
      tail.position.set(side * 0.18 * headScale, -0.035 * headScale, -0.04 * headScale);
      tail.rotation.z = side * 0.28;
      headGroup.add(tail);
    });
  } else if (role === 'mom') {
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.085 * headScale, 14, 12), hairMat);
    bun.position.set(0, -0.01 * headScale, -0.18 * headScale);
    headGroup.add(bun);
  }

  root.userData = {
    role,
    headScale,
    torsoGroup,
    headGroup,
    eyes,
    lids,
    brows,
    squintLines,
    cheeks,
    blushMat,
    mouthGroup,
    smileTorus,
    mouthInner,
    puckerMesh,
    foamMustache,
    wornApron,
    wornApronMat,
    wornTrimMat,
    expression: 'neutral',
    exprTimer: 0,
    blinkTimer: 1.5 + Math.random() * 2.5,
  };

  return root;
}

export function updatePersonCharacter(charRoot, dt, elapsed) {
  const ud = charRoot.userData;
  const hs = ud.headScale;

  ud.blinkTimer -= dt;
  let blinkAmt = 0;
  if (ud.blinkTimer < 0.14) {
    blinkAmt = Math.sin(Math.max(0, ud.blinkTimer / 0.14) * Math.PI);
    if (ud.blinkTimer <= 0) ud.blinkTimer = 2.4 + Math.random() * 3.2;
  }

  const expr = ud.expression;
  ud.exprTimer += dt;

  const breath = Math.sin(elapsed * 2.1 + (ud.role === 'dad' ? 1.2 : 0)) * 0.007;
  ud.torsoGroup.position.y = breath;

  let headRotZ = 0;
  let headRotX = 0;
  let headRotY = 0;
  let lidRotX = -1.28 + blinkAmt * 1.15;
  let browOffsetY = 0;
  let browTilt = -0.05;
  let blushOpacity = 0.05;

  ud.squintLines[0].visible = false;
  ud.squintLines[1].visible = false;
  ud.smileTorus.visible = true;
  ud.puckerMesh.visible = false;
  ud.mouthInner.visible = false;

  if (expr === 'sour') {
    const shiver = Math.sin(elapsed * 38.0) * 0.085;
    headRotZ = shiver;
    headRotX = 0.14;
    lidRotX = -0.04;
    ud.squintLines[0].visible = true;
    ud.squintLines[1].visible = true;
    browOffsetY = -0.014 * hs;
    browTilt = 0.34;
    ud.smileTorus.visible = false;
    ud.puckerMesh.visible = true;
    const puckerPulse = 0.85 + Math.sin(elapsed * 28.0) * 0.18;
    ud.puckerMesh.scale.set(puckerPulse, puckerPulse, 1.2);
    ud.headGroup.scale.set(0.95, 1.03, 1.02);
    blushOpacity = 0.16;
  } else {
    ud.headGroup.scale.lerp(new THREE.Vector3(1, 1, 1), Math.min(1, dt * 8));

    if (expr === 'curious') {
      headRotZ = 0.25;
      headRotX = -0.04;
      browOffsetY = 0.016 * hs;
      browTilt = -0.20;
      ud.smileTorus.visible = false;
      ud.puckerMesh.visible = true;
      ud.puckerMesh.scale.set(1.2, 1.3, 1.0);
    } else if (expr === 'excited' || expr === 'delighted') {
      const bounce = Math.abs(Math.sin(elapsed * 5.2)) * 0.014;
      ud.torsoGroup.position.y += bounce;
      headRotZ = Math.sin(elapsed * 3.0) * 0.05;
      browOffsetY = 0.010 * hs;
      browTilt = -0.12;
      ud.smileTorus.scale.set(1.18, 1.25, 1.0);
      ud.mouthInner.visible = expr === 'delighted';
      ud.mouthInner.scale.set(1.05, 0.55, 0.35);
      blushOpacity = 0.15;
      if (expr === 'delighted') {
        lidRotX = -0.92 + blinkAmt * 0.75;
      }
    } else if (expr === 'sipping') {
      headRotX = 0.18;
      lidRotX = -0.55;
      ud.smileTorus.visible = false;
      ud.puckerMesh.visible = true;
      ud.puckerMesh.scale.set(0.9, 0.9, 1.0);
    } else {
      ud.smileTorus.scale.set(1.0, 0.82, 1.0);
      headRotY = Math.sin(elapsed * 0.8) * 0.05;
    }
  }

  ud.blushMat.opacity += (blushOpacity - ud.blushMat.opacity) * Math.min(1, dt * 8);
  ud.headGroup.rotation.z += (headRotZ - ud.headGroup.rotation.z) * Math.min(1, dt * 10);
  ud.headGroup.rotation.x += (headRotX - ud.headGroup.rotation.x) * Math.min(1, dt * 10);
  ud.headGroup.rotation.y += (headRotY - ud.headGroup.rotation.y) * Math.min(1, dt * 8);

  [-1, 1].forEach((side, idx) => {
    ud.lids[idx].rotation.x += (lidRotX - ud.lids[idx].rotation.x) * Math.min(1, dt * 18);
    const targetBrowY = 0.056 * hs + browOffsetY + (expr === 'curious' && idx === 1 ? 0.010 * hs : 0);
    ud.brows[idx].position.y += (targetBrowY - ud.brows[idx].position.y) * Math.min(1, dt * 12);
    ud.brows[idx].rotation.z = side * browTilt;
  });
}

export function createOrderThoughtBubble(condensationTex) {
  const group = new THREE.Group();
  const bubbleMat = createCrystalGlassMaterial(condensationTex, {
    transmission: 0.92,
    ior: 1.38,
    thickness: 0.06,
    roughness: 0.03,
    bumpScale: 0.0,
  });

  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 22, 18), bubbleMat);
  orb.renderOrder = 4;
  group.add(orb);

  const drop1 = new THREE.Mesh(new THREE.SphereGeometry(0.048, 12, 8), bubbleMat);
  drop1.position.set(-0.13, -0.23, 0);
  const drop2 = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8), bubbleMat);
  drop2.position.set(-0.18, -0.31, 0);
  drop1.renderOrder = 4;
  drop2.renderOrder = 4;
  group.add(drop1, drop2);

  const bands = [];
  const heights = [-0.075, 0.0, 0.075];
  const radii = [0.068, 0.076, 0.084];
  for (let i = 0; i < 3; i++) {
    const m = applySubsurfaceScattering(
      new THREE.MeshPhysicalMaterial({
        color: 0xff3355,
        roughness: 0.10,
        clearcoat: 1.0,
      }),
      0xffffff,
      0.85,
      1.8
    );
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(radii[i] + 0.004, radii[i], 0.072, 18), m);
    cyl.position.y = heights[i];
    cyl.renderOrder = 2;
    group.add(cyl);
    bands.push(m);
  }

  group.userData = { bands };
  return group;
}

export function createChildHandCursor() {
  const group = new THREE.Group();
  const skinMat = createSkinMaterial('#f3c8b3', 0xee624c);

  const handRig = new THREE.Group();
  handRig.rotation.set(0.38, -0.28, 0.18);
  group.add(handRig);

  const palm = new THREE.Mesh(new RoundedBoxGeometry(0.15, 0.056, 0.16, 4, 0.025), skinMat);
  palm.position.set(0.03, 0.02, 0.13);
  handRig.add(palm);

  const fingers = [];
  const fOffsets = [-0.048, -0.016, 0.016, 0.048];
  const fLens = [0.095, 0.105, 0.098, 0.078];
  fOffsets.forEach((fx, idx) => {
    const fPivot = new THREE.Group();
    fPivot.position.set(0.03 + fx, 0.024, 0.058);
    const phalanx = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.0155, fLens[idx] * 0.65, 5, 10),
      skinMat
    );
    phalanx.rotation.x = Math.PI * 0.5;
    phalanx.position.z = -fLens[idx] * 0.48;
    fPivot.add(phalanx);
    handRig.add(fPivot);
    fingers.push(fPivot);
  });

  const thumbPivot = new THREE.Group();
  thumbPivot.position.set(-0.045, 0.01, 0.11);
  thumbPivot.rotation.y = 0.48;
  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.017, 0.055, 5, 10), skinMat);
  thumb.rotation.x = Math.PI * 0.5;
  thumb.position.z = -0.042;
  thumbPivot.add(thumb);
  handRig.add(thumbPivot);

  const wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.062, 0.18, 14), skinMat);
  wrist.rotation.x = Math.PI * 0.5;
  wrist.position.set(0.035, 0.02, 0.27);
  handRig.add(wrist);

  const cuffMat = new THREE.MeshStandardMaterial({ color: 0x9e1c2f, roughness: 0.78 });
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.074, 0.084, 0.22, 16), cuffMat);
  cuff.rotation.x = Math.PI * 0.5;
  cuff.position.set(0.038, 0.02, 0.39);
  handRig.add(cuff);

  const laceTrim = new THREE.Mesh(
    new THREE.TorusGeometry(0.073, 0.009, 6, 16),
    new THREE.MeshStandardMaterial({ color: 0xfff5eb, roughness: 0.7 })
  );
  laceTrim.position.set(0.038, 0.02, 0.285);
  handRig.add(laceTrim);

  group.userData = {
    handRig,
    fingers,
    thumbPivot,
    cuffMat,
    pinchAmount: 0,
    targetPos: new THREE.Vector3(0.8, 0.3, 1.4),
  };

  return group;
}

export function updateChildHandCursor(handGroup, dt, isPinching) {
  const ud = handGroup.userData;
  handGroup.position.lerp(ud.targetPos, Math.min(1, dt * 22));
  const targetPinch = isPinching ? 1.0 : 0.0;
  ud.pinchAmount += (targetPinch - ud.pinchAmount) * Math.min(1, dt * 16);

  ud.fingers.forEach((f, idx) => {
    f.rotation.x = -0.15 - ud.pinchAmount * (idx === 0 ? 0.52 : 0.62);
  });
  ud.thumbPivot.rotation.y = 0.48 - ud.pinchAmount * 0.32;
  ud.thumbPivot.rotation.x = -ud.pinchAmount * 0.25;
}
