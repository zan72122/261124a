import * as THREE from 'three';
import { createLoftedGeometry } from './animals.js';

export const BOOT_OPTIONS = [
  { id: 'mustard', color: 0xd99b26, soleColor: 0x4b3822 },
  { id: 'olive', color: 0x56734b, soleColor: 0x2e3b29 },
  { id: 'coral', color: 0xc9564c, soleColor: 0x4a2926 }
];

export const APRON_OPTIONS = [
  { id: 'khaki', color: 0x7c8661, pocketColor: 0x5d6647, strapColor: 0x4e3c2a },
  { id: 'denim', color: 0x4e6b85, pocketColor: 0x3b5369, strapColor: 0x634832 },
  { id: 'terracotta', color: 0xb86b4b, pocketColor: 0x945236, strapColor: 0x4e3828 }
];

// Reusable realistic glossy Zookeeper Rubber Boot pair mesh
export function createRubberBootMesh(colorHex = 0xd99b26, soleHex = 0x4b3822, scale = 1.0) {
  const g = new THREE.Group();
  const bootMat = new THREE.MeshPhysicalMaterial({
    color: colorHex,
    roughness: 0.22,
    clearcoat: 0.72,
    clearcoatRoughness: 0.18
  });
  const soleMat = new THREE.MeshStandardMaterial({ color: soleHex, roughness: 0.85 });

  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.058, 0.22, 16), bootMat);
  shaft.position.y = 0.13;
  shaft.castShadow = true;
  g.add(shaft);

  // Cuff rim
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.011, 8, 18), soleMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.24;
  g.add(rim);

  // Rounded rubber toe vamp
  const foot = new THREE.Mesh(new THREE.CapsuleGeometry(0.058, 0.095, 8, 12), bootMat);
  foot.rotation.x = Math.PI / 2;
  foot.position.set(0, 0.052, 0.042);
  foot.castShadow = true;
  g.add(foot);

  // Lugged sole
  const sole = new THREE.Mesh(new THREE.CapsuleGeometry(0.062, 0.105, 6, 12), soleMat);
  sole.rotation.x = Math.PI / 2;
  sole.scale.set(1.02, 1.02, 0.36);
  sole.position.set(0, 0.018, 0.042);
  g.add(sole);

  g.scale.setScalar(scale);
  return g;
}

// Reusable Canvas Zookeeper Apron mesh (for bench display & worn on girl!)
export function createApronDisplayMesh(opt = APRON_OPTIONS[0]) {
  const g = new THREE.Group();
  const clothMat = new THREE.MeshStandardMaterial({ color: opt.color, roughness: 0.88, side: THREE.DoubleSide });
  const pocketMat = new THREE.MeshStandardMaterial({ color: opt.pocketColor, roughness: 0.9 });
  const strapMat = new THREE.MeshStandardMaterial({ color: opt.strapColor, roughness: 0.65 });

  const bib = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.38, 0.025), clothMat);
  bib.position.y = 0.22;
  bib.castShadow = true;
  g.add(bib);

  const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.13, 0.034), pocketMat);
  pocket.position.set(0, 0.14, 0.008);
  g.add(pocket);

  // Neck loop strap
  const loop = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.014, 8, 18, Math.PI), strapMat);
  loop.position.set(0, 0.41, 0);
  g.add(loop);

  // Wooden mini keeper badge (leaf silhouette, zero text!)
  const badge = new THREE.Mesh(
    new THREE.CylinderGeometry(0.028, 0.028, 0.012, 14),
    new THREE.MeshStandardMaterial({ color: 0xd9b26f, roughness: 0.45 })
  );
  badge.rotation.x = Math.PI / 2;
  badge.position.set(0.068, 0.32, 0.018);
  g.add(badge);

  return g;
}

// 1. THE 5-YEAR-OLD GIRL ZOOKEEPER (Naturalistic 3D proportions, expressive face morphs, dress-up outfit!)
export function createKeeperGirl() {
  const root = new THREE.Group();

  const skinMat = new THREE.MeshPhysicalMaterial({
    color: 0xf1c7ab,
    roughness: 0.58,
    sheen: 0.28,
    sheenRoughness: 0.65,
    sheenColor: new THREE.Color(0xffbfa8)
  });
  const hairMat = new THREE.MeshStandardMaterial({
    color: 0x261a14,
    roughness: 0.44,
    metalness: 0.04
  });
  const shirtMat = new THREE.MeshStandardMaterial({ color: 0xf4efe4, roughness: 0.86 });
  const shortsMat = new THREE.MeshStandardMaterial({ color: 0x8b7e6a, roughness: 0.88 });

  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  // Torso (natural cotton shirt)
  const torsoStations = [
    { x: 0, y: 0.52, z: 0, rx: 0.115, ryTop: 0.095, ryBot: 0.095, u: 0.8 },
    { x: 0, y: 0.68, z: 0.01, rx: 0.125, ryTop: 0.10, ryBot: 0.095, u: 0.5 },
    { x: 0, y: 0.84, z: 0, rx: 0.115, ryTop: 0.088, ryBot: 0.088, u: 0.2 },
    { x: 0, y: 0.90, z: 0, rx: 0.055, ryTop: 0.055, ryBot: 0.055, u: 0.05 }
  ];
  const shirtMesh = new THREE.Mesh(createLoftedGeometry(torsoStations, 20, 3), shirtMat);
  shirtMesh.castShadow = true;
  bodyPivot.add(shirtMesh);

  // Shorts
  const hipMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.118, 0.125, 0.16, 16), shortsMat);
  hipMesh.position.y = 0.46;
  hipMesh.castShadow = true;
  bodyPivot.add(hipMesh);

  // Worn Zookeeper Apron (hidden until put on!)
  const apronGroup = new THREE.Group();
  apronGroup.visible = false;
  const apronClothMat = new THREE.MeshStandardMaterial({ color: APRON_OPTIONS[0].color, roughness: 0.86 });
  const apronPocketMat = new THREE.MeshStandardMaterial({ color: APRON_OPTIONS[0].pocketColor, roughness: 0.88 });
  const apronStrapMat = new THREE.MeshStandardMaterial({ color: APRON_OPTIONS[0].strapColor, roughness: 0.65 });

  const apronSkirt = new THREE.Mesh(new THREE.CylinderGeometry(0.126, 0.152, 0.42, 20), apronClothMat);
  apronSkirt.position.set(0, 0.61, 0.006);
  apronSkirt.scale.set(1.02, 1, 0.86);
  apronSkirt.castShadow = true;
  apronGroup.add(apronSkirt);

  const apronPocket = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.11, 0.03), apronPocketMat);
  apronPocket.position.set(0, 0.55, 0.112);
  apronGroup.add(apronPocket);

  [-1, 1].forEach((s) => {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.16, 0.14), apronStrapMat);
    strap.position.set(s * 0.068, 0.83, 0.01);
    apronGroup.add(strap);
  });
  bodyPivot.add(apronGroup);

  // Legs + Default Sneakers vs Worn Zookeeper Rubber Boots!
  const legs = [];
  const sneakerGroup = new THREE.Group();
  const wornBootsGroup = new THREE.Group();
  wornBootsGroup.visible = false;
  const bootMats = [];

  [-1, 1].forEach((side) => {
    const legPivot = new THREE.Group();
    legPivot.position.set(side * 0.062, 0.40, 0);
    const calf = new THREE.Mesh(new THREE.CapsuleGeometry(0.038, 0.28, 6, 10), skinMat);
    calf.position.y = -0.17;
    calf.castShadow = true;
    legPivot.add(calf);
    bodyPivot.add(legPivot);
    legs.push(legPivot);

    // Default simple canvas shoe before putting on rain boots
    const shoe = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.044, 0.075, 6, 10),
      new THREE.MeshStandardMaterial({ color: 0xe2ddd2, roughness: 0.85 })
    );
    shoe.rotation.x = Math.PI / 2;
    shoe.position.set(side * 0.062, 0.04, 0.03);
    sneakerGroup.add(shoe);

    // Worn glossy rubber boot
    const bMesh = createRubberBootMesh(BOOT_OPTIONS[0].color, BOOT_OPTIONS[0].soleColor, 0.88);
    bMesh.position.set(side * 0.064, 0, 0);
    wornBootsGroup.add(bMesh);
    bMesh.traverse((m) => {
      if (m.isMesh && m.material.clearcoat) bootMats.push(m.material);
    });
  });
  bodyPivot.add(sneakerGroup);
  bodyPivot.add(wornBootsGroup);

  // Expressive Arms with smooth integrated shoulders!
  const arms = [];
  [-1, 1].forEach((side) => {
    const shCap = new THREE.Mesh(new THREE.SphereGeometry(0.038, 10, 10), shirtMat);
    shCap.position.set(side * 0.112, 0.82, 0);
    bodyPivot.add(shCap);

    const armPivot = new THREE.Group();
    armPivot.position.set(side * 0.118, 0.82, 0);
    const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.036, 0.14, 6, 10), shirtMat);
    sleeve.position.y = -0.08;
    armPivot.add(sleeve);
    const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.028, 0.13, 6, 10), skinMat);
    forearm.position.y = -0.21;
    armPivot.add(forearm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.033, 10, 8), skinMat);
    hand.position.y = -0.29;
    armPivot.add(hand);
    armPivot.rotation.z = side * 0.14;
    bodyPivot.add(armPivot);
    arms.push(armPivot);
  });

  // Expressive 5-Year-Old Head & Face!
  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.91, 0.01);
  bodyPivot.add(headPivot);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.048, 0.08, 12), skinMat);
  neck.position.y = 0.02;
  headPivot.add(neck);

  // Natural child head shape (warm soft cheeks, subtle nose & chin)
  const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.132, 24, 20), skinMat);
  cranium.scale.set(0.95, 1.04, 0.96);
  cranium.position.set(0, 0.145, 0);
  cranium.castShadow = true;
  headPivot.add(cranium);

  // Soft rosy cheeks (glow warmer when smiling/giggling!)
  const blushMat = new THREE.MeshBasicMaterial({
    color: 0xe87b74,
    transparent: true,
    opacity: 0.26,
    depthWrite: false
  });
  [-1, 1].forEach((side) => {
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.034, 10, 8), blushMat);
    cheek.scale.set(1.1, 0.72, 0.35);
    cheek.position.set(side * 0.072, 0.115, 0.108);
    headPivot.add(cheek);
  });

  // Delicate nose
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.016, 10, 8), skinMat);
  nose.scale.set(0.9, 0.85, 1.15);
  nose.position.set(0, 0.128, 0.126);
  headPivot.add(nose);

  // Expressive Eyes, Brows & Eyelids
  const eyeGroups = [];
  const browMeshes = [];
  const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xfaf7f2, roughness: 0.18 });
  const irisMat = new THREE.MeshPhysicalMaterial({
    color: 0x2a1a12,
    roughness: 0.04,
    clearcoat: 1.0
  });
  const catchlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

  [-1, 1].forEach((side) => {
    const eg = new THREE.Group();
    eg.position.set(side * 0.048, 0.152, 0.112);

    const white = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 10), eyeWhiteMat);
    white.scale.set(1.05, 0.95, 0.6);
    eg.add(white);

    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.0145, 12, 10), irisMat);
    iris.scale.set(1, 1, 0.55);
    iris.position.z = 0.008;
    eg.add(iris);

    const spec = new THREE.Mesh(new THREE.SphereGeometry(0.0045, 6, 6), catchlightMat);
    spec.position.set(side * 0.004, 0.005, 0.017);
    eg.add(spec);

    const lid = new THREE.Mesh(
      new THREE.SphereGeometry(0.024, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.52),
      skinMat
    );
    lid.rotation.x = -0.55;
    eg.add(lid);
    eg.userData.lid = lid;

    headPivot.add(eg);
    eyeGroups.push(eg);

    // Expressive eyebrow
    const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.0045, 0.028, 4, 6), hairMat);
    brow.rotation.z = Math.PI / 2 - side * 0.08;
    brow.position.set(side * 0.049, 0.186, 0.118);
    headPivot.add(brow);
    browMeshes.push(brow);
  });

  // Expressive Mouth Shapes (Smile, Big Laugh, "あれ？" Round 'O'!)
  const mouthGroup = new THREE.Group();
  mouthGroup.position.set(0, 0.088, 0.121);
  headPivot.add(mouthGroup);

  const smileCurve = new THREE.Mesh(
    new THREE.TorusGeometry(0.022, 0.0048, 8, 16, Math.PI),
    new THREE.MeshStandardMaterial({ color: 0xb55956, roughness: 0.5 })
  );
  smileCurve.rotation.z = Math.PI;
  mouthGroup.add(smileCurve);

  const openLaugh = new THREE.Mesh(
    new THREE.SphereGeometry(0.022, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0x993b3c, roughness: 0.6 })
  );
  openLaugh.scale.set(1.15, 0.75, 0.35);
  openLaugh.visible = false;
  mouthGroup.add(openLaugh);

  const huhMouth = new THREE.Mesh(
    new THREE.TorusGeometry(0.011, 0.004, 8, 14),
    new THREE.MeshStandardMaterial({ color: 0xad5250, roughness: 0.5 })
  );
  huhMouth.visible = false;
  mouthGroup.add(huhMouth);

  // Realistic Glossy Chestnut Hair with Smooth Contoured Fringe & Twin Low Puffs!
  const hairCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.141, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.54),
    hairMat
  );
  hairCap.position.set(0, 0.155, -0.006);
  hairCap.rotation.x = -0.14;
  hairCap.castShadow = true;
  headPivot.add(hairCap);

  const backHair = new THREE.Mesh(new THREE.SphereGeometry(0.137, 18, 14), hairMat);
  backHair.position.set(0, 0.138, -0.022);
  headPivot.add(backHair);

  // Temple sidelocks hugging cheeks gently
  [-1, 1].forEach((s) => {
    const sideLock = new THREE.Mesh(new THREE.CapsuleGeometry(0.018, 0.085, 6, 8), hairMat);
    sideLock.position.set(s * 0.118, 0.135, 0.042);
    sideLock.rotation.z = s * 0.12;
    headPivot.add(sideLock);
  });

  // Twin low ponytails with soft scrunchies
  const scrunchieMats = [];
  [-1, 1].forEach((side) => {
    const scMat = new THREE.MeshStandardMaterial({ color: 0xd99b26, roughness: 0.7 });
    scrunchieMats.push(scMat);
    const sc = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.009, 8, 12), scMat);
    sc.position.set(side * 0.128, 0.11, -0.03);
    sc.rotation.y = Math.PI / 2;
    headPivot.add(sc);

    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.056, 14, 12), hairMat);
    puff.scale.set(0.92, 1.18, 0.95);
    puff.position.set(side * 0.165, 0.085, -0.035);
    puff.castShadow = true;
    headPivot.add(puff);
  });

  const girl = {
    root,
    bodyPivot,
    headPivot,
    arms,
    legs,
    hasBoots: false,
    hasApron: false,
    bootOption: BOOT_OPTIONS[0],
    apronOption: APRON_OPTIONS[0],
    expression: 'curious', // 'curious' | 'smile' | 'delighted' | 'huh' | 'splashed'
    exprTimer: 0,
    hopTimer: 0,
    blinkTimer: 2.2,
    blink: 0,

    wearBoots(opt) {
      this.hasBoots = true;
      this.bootOption = opt;
      sneakerGroup.visible = false;
      wornBootsGroup.visible = true;
      bootMats.forEach((m) => m.color.setHex(opt.color));
      scrunchieMats.forEach((m) => m.color.setHex(opt.color));
      this.hopTimer = 0.55;
      this.setExpression('delighted', 1.5);
    },

    wearApron(opt) {
      this.hasApron = true;
      this.apronOption = opt;
      apronGroup.visible = true;
      apronClothMat.color.setHex(opt.color);
      apronPocketMat.color.setHex(opt.pocketColor);
      apronStrapMat.color.setHex(opt.strapColor);
      this.hopTimer = 0.55;
      this.setExpression('delighted', 1.5);
    },

    setExpression(expr, duration = 1.6) {
      this.expression = expr;
      this.exprTimer = duration;
    },

    update(dt, elapsed, lookWorldTarget = null) {
      if (this.exprTimer > 0) {
        this.exprTimer -= dt;
        if (this.exprTimer <= 0) this.expression = 'smile';
      }
      if (this.hopTimer > 0) {
        this.hopTimer = Math.max(0, this.hopTimer - dt);
        bodyPivot.position.y = Math.abs(Math.sin(this.hopTimer * Math.PI * 3.6)) * 0.09;
      } else {
        bodyPivot.position.y = Math.sin(elapsed * 2.1) * 0.008;
      }

      this.blinkTimer -= dt;
      if (this.blinkTimer <= 0) {
        this.blink = 1.0;
        this.blinkTimer = 2.4 + Math.random() * 3.2;
      }
      this.blink = Math.max(0, this.blink - dt * 9);

      // Mouth & Brow Expression Morphing!
      const exp = this.expression;
      smileCurve.visible = exp === 'smile' || exp === 'curious';
      openLaugh.visible = exp === 'delighted' || exp === 'splashed';
      huhMouth.visible = exp === 'huh';
      blushMat.opacity = (exp === 'delighted' || exp === 'splashed') ? 0.44 : 0.24;

      eyeGroups.forEach((eg) => {
        let lidX = -0.55;
        if (exp === 'delighted') lidX = -0.15;
        else if (exp === 'splashed') lidX = 0.18; // Cute squint when splashed!
        else if (exp === 'huh') lidX = -0.78;
        lidX = THREE.MathUtils.lerp(lidX, 0.35, this.blink);
        eg.userData.lid.rotation.x += (lidX - eg.userData.lid.rotation.x) * Math.min(1, dt * 15);
      });

      browMeshes.forEach((b, idx) => {
        const side = idx === 0 ? -1 : 1;
        let by = 0.186;
        let bz = Math.PI / 2 - side * 0.08;
        if (exp === 'huh') {
          by = 0.197;
          bz = Math.PI / 2 + side * 0.16;
        } else if (exp === 'delighted') {
          by = 0.193;
        }
        b.position.y += (by - b.position.y) * Math.min(1, dt * 12);
        b.rotation.z += (bz - b.rotation.z) * Math.min(1, dt * 12);
      });

      // Head tilt & gaze
      let targetHeadZ = exp === 'huh' ? 0.28 : (exp === 'delighted' ? Math.sin(elapsed * 8) * 0.08 : 0);
      let targetHeadY = Math.sin(elapsed * 0.9) * 0.08;
      if (lookWorldTarget) {
        const local = root.worldToLocal(lookWorldTarget.clone());
        targetHeadY = THREE.MathUtils.clamp(Math.atan2(local.x, Math.max(0.4, local.z)) * 0.45, -0.55, 0.55);
      }
      headPivot.rotation.z += (targetHeadZ - headPivot.rotation.z) * Math.min(1, dt * 8);
      headPivot.rotation.y += (targetHeadY - headPivot.rotation.y) * Math.min(1, dt * 6);

      // Expressive arms
      if (exp === 'delighted' || exp === 'splashed') {
        arms[0].rotation.x = -0.85 + Math.sin(elapsed * 11) * 0.22;
        arms[1].rotation.x = -0.85 - Math.sin(elapsed * 11) * 0.22;
      } else if (exp === 'huh') {
        arms[0].rotation.x = -0.55;
        arms[1].rotation.x = -0.15;
      } else {
        arms[0].rotation.x += (-0.12 - arms[0].rotation.x) * Math.min(1, dt * 6);
        arms[1].rotation.x += (-0.12 - arms[1].rotation.x) * Math.min(1, dt * 6);
      }
    }
  };

  return girl;
}

// 2. FIRST-PERSON 3D ZOOKEEPER HAND ("指がその子の手になる") holding physical tools!
export function createKeeperHand(textures) {
  const root = new THREE.Group();
  root.visible = false;

  const skinMat = new THREE.MeshPhysicalMaterial({
    color: 0xf1c7ab,
    roughness: 0.55,
    sheen: 0.25
  });
  const cuffMat = new THREE.MeshStandardMaterial({ color: APRON_OPTIONS[0].color, roughness: 0.85 });

  // Reaching child forearm + palm + fingers angled down toward lower-right player corner (never a floating tube!)
  const armGroup = new THREE.Group();
  root.add(armGroup);

  const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.052, 0.48, 8, 14), cuffMat);
  sleeve.rotation.x = -0.95;
  sleeve.rotation.z = -0.28;
  sleeve.position.set(0.12, -0.24, 0.22);
  armGroup.add(sleeve);

  const wrist = new THREE.Mesh(new THREE.CapsuleGeometry(0.038, 0.12, 6, 12), skinMat);
  wrist.rotation.x = -1.02;
  wrist.rotation.z = -0.20;
  wrist.position.set(0.032, -0.052, 0.075);
  armGroup.add(wrist);

  const palm = new THREE.Mesh(new THREE.SphereGeometry(0.048, 14, 12), skinMat);
  palm.scale.set(1.05, 0.72, 1.18);
  armGroup.add(palm);

  // Thumb + 4 soft child fingers gripping the active tool
  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.032, 5, 8), skinMat);
  thumb.rotation.z = 0.75;
  thumb.position.set(-0.042, -0.008, -0.018);
  armGroup.add(thumb);

  for (let f = -1.5; f <= 1.5; f += 1) {
    const finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.011, 0.036, 5, 8), skinMat);
    finger.rotation.x = Math.PI / 2 + 0.35;
    finger.position.set(f * 0.016, -0.008, -0.048);
    armGroup.add(finger);
  }

  // Tool attachments held right in her hand!
  const tools = {};

  // A. Natural Sea Sponge (changes foam tint with soap choice!)
  const spongeGroup = new THREE.Group();
  const spongeGeo = new THREE.IcosahedronGeometry(0.095, 2);
  const spPos = spongeGeo.attributes.position;
  for (let i = 0; i < spPos.count; i++) {
    const n = 1 + 0.14 * Math.sin(spPos.getX(i) * 35) * Math.cos(spPos.getZ(i) * 35);
    spPos.setXYZ(i, spPos.getX(i) * n * 1.15, spPos.getY(i) * n * 0.68, spPos.getZ(i) * n * 0.92);
  }
  spongeGeo.computeVertexNormals();
  const spongeMat = new THREE.MeshStandardMaterial({
    color: 0xe6be6a,
    bumpMap: textures.bubbleMap,
    bumpScale: 0.02,
    roughness: 0.85
  });
  const spongeMesh = new THREE.Mesh(spongeGeo, spongeMat);
  spongeMesh.position.set(0, -0.035, -0.06);
  spongeGroup.add(spongeMesh);

  // Frothy lather cap on top of sponge
  const spongeFoamMat = new THREE.MeshStandardMaterial({ color: 0xfcfdff, roughness: 0.3 });
  const sf = new THREE.Mesh(new THREE.SphereGeometry(0.068, 10, 8), spongeFoamMat);
  sf.scale.set(1.2, 0.55, 1.0);
  sf.position.set(0, -0.055, -0.065);
  spongeGroup.add(sf);
  root.add(spongeGroup);
  tools.sponge = spongeGroup;

  // B. Shiny Brass Garden Hose Nozzle + Flexible Green Rubber Hose!
  const hoseGroup = new THREE.Group();
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xd4a43f, roughness: 0.24, metalness: 0.82 });
  const hoseGreenMat = new THREE.MeshStandardMaterial({ color: 0x2d6b45, roughness: 0.42 });
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.032, 0.16, 14), brassMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, -0.015, -0.09);
  hoseGroup.add(barrel);
  const nozzleTip = new THREE.Group();
  nozzleTip.position.set(0, -0.015, -0.18);
  hoseGroup.add(nozzleTip);
  const stub = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.24, 10), hoseGreenMat);
  stub.rotation.x = Math.PI / 2;
  stub.position.set(0, -0.015, 0.09);
  hoseGroup.add(stub);
  root.add(hoseGroup);
  tools.hose = hoseGroup;

  // C. Wooden Boar-Bristle Grooming Brush
  const brushGroup = new THREE.Group();
  const woodBack = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.052, 0.11, 8, 12),
    new THREE.MeshStandardMaterial({ map: textures.woodMap, color: 0xb6814e, roughness: 0.55 })
  );
  woodBack.rotation.x = Math.PI / 2;
  woodBack.scale.set(1.1, 1, 0.45);
  woodBack.position.set(0, -0.025, -0.065);
  brushGroup.add(woodBack);
  const bristles = new THREE.Mesh(
    new THREE.BoxGeometry(0.095, 0.038, 0.16),
    new THREE.MeshStandardMaterial({ color: 0xdfd0b4, roughness: 0.92 })
  );
  bristles.position.set(0, -0.055, -0.065);
  brushGroup.add(bristles);
  root.add(brushGroup);
  tools.brush = brushGroup;

  // D. Savanna Meat / Fish Chunk (for Lion!)
  const meatGroup = new THREE.Group();
  const meatChunk = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.065, 0.09, 8, 12),
    new THREE.MeshStandardMaterial({ color: 0xb53c32, roughness: 0.42 })
  );
  meatChunk.rotation.z = Math.PI / 2;
  meatChunk.position.set(0, -0.03, -0.08);
  meatGroup.add(meatChunk);
  const boneEnd = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.018, 0.22, 8),
    new THREE.MeshStandardMaterial({ color: 0xf1eadc, roughness: 0.55 })
  );
  boneEnd.rotation.z = Math.PI / 2;
  boneEnd.position.set(0, -0.03, -0.08);
  meatGroup.add(boneEnd);
  root.add(meatGroup);
  tools.meat = meatGroup;

  // E. Tall Fresh Acacia / Hibiscus Leafy Branch (for Giraffe!)
  const branchGroup = new THREE.Group();
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.009, 0.016, 0.58, 8),
    new THREE.MeshStandardMaterial({ color: 0x5c4228, roughness: 0.85 })
  );
  stem.rotation.x = -0.65;
  stem.position.set(0, 0.14, -0.22);
  branchGroup.add(stem);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x4b8e38, roughness: 0.58, side: THREE.DoubleSide });
  const flowerLeaves = [];
  for (let i = 0; i < 11; i++) {
    const t = i / 10;
    const side = i % 2 === 0 ? 1 : -1;
    const lf = new THREE.Mesh(new THREE.SphereGeometry(0.042, 8, 6), leafMat);
    lf.scale.set(1.4, 0.22, 0.72);
    lf.position.set(side * 0.055, 0.02 + t * 0.34, -0.08 - t * 0.32);
    lf.rotation.z = side * 0.35;
    branchGroup.add(lf);
    flowerLeaves.push(lf);
  }
  const hibiscus = new THREE.Mesh(
    new THREE.ConeGeometry(0.048, 0.04, 7, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xd93b52, roughness: 0.5, side: THREE.DoubleSide })
  );
  hibiscus.position.set(0.02, 0.35, -0.40);
  hibiscus.visible = false;
  branchGroup.add(hibiscus);
  root.add(branchGroup);
  tools.branch = branchGroup;

  // F. Juicy Sliced Watermelon Wedge!
  const melonGroup = new THREE.Group();
  const wedgeGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.052, 16, 1, false, 0, Math.PI);
  const wedgeMat = new THREE.MeshStandardMaterial({ map: textures.redFleshMap, roughness: 0.28 });
  const wedge = new THREE.Mesh(wedgeGeo, wedgeMat);
  wedge.rotation.z = Math.PI / 2;
  wedge.rotation.y = Math.PI / 2;
  wedge.position.set(0, -0.02, -0.10);
  melonGroup.add(wedge);
  root.add(melonGroup);
  tools.watermelon = melonGroup;

  return {
    root,
    armGroup,
    nozzleTip,
    cuffMat,
    spongeFoamMat,
    wedgeMat,
    hibiscus,
    flowerLeaves,
    tools,
    activeTool: 'sponge',
    setTool(name) {
      this.activeTool = name;
      Object.entries(tools).forEach(([k, grp]) => {
        grp.visible = k === name;
      });
    },
    setCuffColor(hex) {
      cuffMat.color.setHex(hex);
    }
  };
}

// 3. DAD (パパ - Helpful slightly clumsy assistant + hilarious Scene 3 Watermelon Slip!)
export function createDad() {
  const root = new THREE.Group();

  const skinMat = new THREE.MeshStandardMaterial({ color: 0xe8b898, roughness: 0.65 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: 0x6788a3, roughness: 0.85 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x5c5346, roughness: 0.88 });
  const hatMat = new THREE.MeshStandardMaterial({ color: 0xd8c394, roughness: 0.82 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x241c18, roughness: 0.65 });

  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  // Legs
  const legs = [];
  [-1, 1].forEach((s) => {
    const lp = new THREE.Group();
    lp.position.set(s * 0.11, 0.82, 0);
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.072, 0.62, 6, 10), pantsMat);
    leg.position.y = -0.36;
    leg.castShadow = true;
    lp.add(leg);
    const boot = createRubberBootMesh(0x3b4d3b, 0x222620, 1.15);
    boot.position.set(0, -0.82, 0);
    lp.add(boot);
    bodyPivot.add(lp);
    legs.push(lp);
  });

  // Naturalistic Dad Torso (collared work shirt, chest pocket & leather belt)
  const dadTorsoStations = [
    { x: 0, y: 0.78, z: 0, rx: 0.17, ryTop: 0.13, ryBot: 0.13, u: 0.9 },
    { x: 0, y: 1.05, z: 0.01, rx: 0.20, ryTop: 0.145, ryBot: 0.14, u: 0.5 },
    { x: 0, y: 1.34, z: 0, rx: 0.21, ryTop: 0.135, ryBot: 0.135, u: 0.15 },
    { x: 0, y: 1.44, z: 0, rx: 0.08, ryTop: 0.08, ryBot: 0.08, u: 0.02 }
  ];
  const torso = new THREE.Mesh(createLoftedGeometry(dadTorsoStations, 20, 3), shirtMat);
  torso.castShadow = true;
  torso.userData.isDadSurface = true;
  bodyPivot.add(torso);

  const belt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.175, 0.175, 0.05, 18),
    new THREE.MeshStandardMaterial({ color: 0x3d2b1c, roughness: 0.65 })
  );
  belt.scale.set(1, 1, 0.78);
  belt.position.y = 0.82;
  bodyPivot.add(belt);

  // Head + Sun Hat + Kind Eyes & Big Laugh
  const headPivot = new THREE.Group();
  headPivot.position.set(0, 1.48, 0);
  bodyPivot.add(headPivot);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.138, 18, 16), skinMat);
  head.scale.set(0.92, 1.08, 0.95);
  head.position.y = 0.13;
  head.castShadow = true;
  head.userData.isDadSurface = true;
  headPivot.add(head);

  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.142, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.52), hairMat);
  hair.position.set(0, 0.145, -0.01);
  headPivot.add(hair);

  // Straw safari sun hat
  const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.25, 0.018, 20), hatMat);
  hatBrim.position.y = 0.23;
  headPivot.add(hatBrim);
  const hatCrown = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.14, 0.10, 18), hatMat);
  hatCrown.position.y = 0.28;
  headPivot.add(hatCrown);

  // Dad's eyes & brows & smile
  [-1, 1].forEach((s) => {
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.015, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0x241914, roughness: 0.2 })
    );
    eye.position.set(s * 0.048, 0.14, 0.122);
    headPivot.add(eye);
    const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.006, 0.032, 4, 6), hairMat);
    brow.rotation.z = Math.PI / 2 - s * 0.1;
    brow.position.set(s * 0.048, 0.174, 0.124);
    headPivot.add(brow);
  });
  const mouth = new THREE.Mesh(
    new THREE.TorusGeometry(0.028, 0.006, 8, 14, Math.PI),
    new THREE.MeshStandardMaterial({ color: 0x9c4844, roughness: 0.6 })
  );
  mouth.rotation.z = Math.PI;
  mouth.position.set(0, 0.078, 0.124);
  headPivot.add(mouth);

  // Arms with rolled chambray sleeves
  const arms = [];
  [-1, 1].forEach((s) => {
    const ap = new THREE.Group();
    ap.position.set(s * 0.20, 1.34, 0);
    const rSleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.058, 0.16, 6, 10), shirtMat);
    rSleeve.position.y = -0.09;
    rSleeve.castShadow = true;
    ap.add(rSleeve);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.28, 6, 10), skinMat);
    arm.position.y = -0.28;
    arm.castShadow = true;
    ap.add(arm);
    bodyPivot.add(ap);
    arms.push(ap);
  });

  const dad = {
    root,
    bodyPivot,
    headPivot,
    arms,
    legs,
    state: 'standing', // 'standing' | 'huh' | 'carrying' | 'slipping' | 'sitting_laugh'
    stateTimer: 0,

    triggerFoamHuh() {
      this.state = 'huh';
      this.stateTimer = 2.0;
    },

    startWatermelonWalk(startX = -2.8, startZ = -0.6) {
      root.position.set(startX, 0, startZ);
      root.rotation.y = 1.25;
      this.state = 'carrying';
      this.stateTimer = 1.35;
      bodyPivot.position.set(0, 0, 0);
      bodyPivot.rotation.set(0, 0, 0);
    },

    update(dt, elapsed) {
      if (this.state === 'carrying') {
        this.stateTimer -= dt;
        root.position.x += dt * 1.35;
        root.position.z += dt * 0.35;
        legs[0].rotation.x = Math.sin(elapsed * 10) * 0.45;
        legs[1].rotation.x = -Math.sin(elapsed * 10) * 0.45;
        arms[0].rotation.x = -1.05;
        arms[1].rotation.x = -1.05;
        bodyPivot.rotation.z = Math.sin(elapsed * 10) * 0.06;
        if (this.stateTimer <= 0) {
          this.state = 'slipping';
          this.stateTimer = 0.65;
          this.justDroppedMelons = true;
        }
      } else if (this.state === 'slipping') {
        this.stateTimer -= dt;
        const p = 1 - Math.max(0, this.stateTimer / 0.65);
        // Comical gentle slip onto his bum!
        bodyPivot.position.y = -0.58 * p + Math.sin(p * Math.PI) * 0.22;
        bodyPivot.rotation.x = -0.35 * p;
        legs[0].rotation.x = -1.25 * p;
        legs[1].rotation.x = -1.10 * p;
        arms[0].rotation.x = -2.2 * Math.sin(p * Math.PI);
        arms[1].rotation.x = -2.0 * Math.sin(p * Math.PI);
        if (this.stateTimer <= 0) {
          this.state = 'sitting_laugh';
        }
      } else if (this.state === 'sitting_laugh') {
        bodyPivot.position.y = -0.58;
        bodyPivot.rotation.x = -0.25;
        legs[0].rotation.x = -1.28;
        legs[1].rotation.x = -1.15;
        // Sheepish head scratch & hearty laugh!
        arms[0].rotation.x = -2.35 + Math.sin(elapsed * 7) * 0.12;
        arms[0].rotation.z = -0.45;
        arms[1].rotation.x = -0.45;
        headPivot.rotation.z = Math.sin(elapsed * 4.5) * 0.12;
      } else if (this.state === 'huh') {
        this.stateTimer -= dt;
        headPivot.rotation.z = 0.26 * Math.sin(elapsed * 9);
        arms[0].rotation.x = -1.3;
        arms[1].rotation.x = -1.3;
        if (this.stateTimer <= 0) this.state = 'standing';
      } else {
        // Warm standing wave & helper sway
        bodyPivot.position.y = 0;
        bodyPivot.rotation.set(0, 0, Math.sin(elapsed * 1.4) * 0.02);
        legs[0].rotation.x = 0;
        legs[1].rotation.x = 0;
        arms[0].rotation.x = -0.22;
        arms[0].rotation.z = -0.15;
        arms[1].rotation.x = -0.35 + Math.sin(elapsed * 2.5) * 0.15;
        arms[1].rotation.z = 0.18;
        headPivot.rotation.z = Math.sin(elapsed * 1.2) * 0.05;
      }
    }
  };

  return dad;
}
