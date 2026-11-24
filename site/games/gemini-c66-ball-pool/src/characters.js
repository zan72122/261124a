import * as THREE from 'three';
import { createFabricTexture } from './textures.js';
import { BALL_COLORS } from './environment.js';

export const OUTFIT_DEFS = [
  {
    id: 0,
    mainHex: '#e4424b',    // Rich coral-crimson canvas playroom smock
    subHex: '#fbf2e6',     // Cream & coral striped cotton sleeves
    stripeHex: '#e4424b',
    style: 'twill',
    sleeveStyle: 'stripes',
    accentHex: '#ff6b7d'
  },
  {
    id: 1,
    mainHex: '#2f5b8f',    // Authentic indigo denim overalls
    subHex: '#e6f5ee',     // Mint-and-cream striped jersey sleeves
    stripeHex: '#3fa88c',
    style: 'denim',
    sleeveStyle: 'stripes',
    accentHex: '#389de0'
  },
  {
    id: 2,
    mainHex: '#df961d',    // Warm honey-mustard quilted vest
    subHex: '#eae0f8',     // Soft lavender cotton knit sleeves
    stripeHex: '#b87610',
    style: 'quilted',
    sleeveStyle: 'twill',
    accentHex: '#f5b222'
  }
];

function createSkinMaterial(hex = '#f2be9f') {
  return new THREE.MeshPhysicalMaterial({
    color: hex,
    roughness: 0.52,
    metalness: 0.0,
    clearcoat: 0.10,
    clearcoatRoughness: 0.58,
    sheen: 0.28,
    sheenColor: new THREE.Color('#ff8e78'),
    envMapIntensity: 0.48
  });
}

function createHairMaterial(hex = '#2a1a13') {
  return new THREE.MeshPhysicalMaterial({
    color: hex,
    roughness: 0.42,
    clearcoat: 0.20,
    clearcoatRoughness: 0.38,
    sheen: 0.30,
    sheenColor: new THREE.Color('#6b4634'),
    envMapIntensity: 0.52
  });
}

// Expressive, warm human figure whose upturned face (+Z local -> tilted up toward overhead camera!) is 100% clear!
export function createHumanFigure(role = 'girl') {
  const isChild = role === 'girl';
  const isMom = role === 'mom';
  const scale = isChild ? 0.86 : isMom ? 1.02 : 1.12;

  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const skinMat = createSkinMaterial(isChild ? '#f4c2a4' : isMom ? '#f0bc9e' : '#e6af90');
  const hairMat = createHairMaterial(isChild ? '#281812' : isMom ? '#3d2419' : '#211611');

  const outfitMats = OUTFIT_DEFS.map((od) => ({
    torso: new THREE.MeshStandardMaterial({
      map: createFabricTexture(od.mainHex, od.stripeHex, od.style),
      roughness: 0.78,
      envMapIntensity: 0.42
    }),
    sleeve: new THREE.MeshStandardMaterial({
      map: createFabricTexture(od.subHex, od.stripeHex, od.sleeveStyle),
      roughness: 0.74,
      envMapIntensity: 0.42
    }),
    accent: new THREE.MeshStandardMaterial({ color: od.accentHex, roughness: 0.48 })
  }));

  const adultTopMat = new THREE.MeshStandardMaterial({
    map: createFabricTexture(
      isMom ? '#e8cfc0' : '#4a6b8c',
      isMom ? '#c9a894' : '#314c69',
      isMom ? 'twill' : 'stripes'
    ),
    roughness: 0.78,
    envMapIntensity: 0.42
  });
  const pantsMat = new THREE.MeshStandardMaterial({
    color: isChild ? 0x3e526e : isMom ? 0x4d6078 : 0x353f4d,
    roughness: 0.84,
    envMapIntensity: 0.35
  });
  const sockMat = new THREE.MeshStandardMaterial({ color: 0xf5efe6, roughness: 0.8 });

  const torsoMat = isChild ? outfitMats[0].torso : adultTopMat;
  const sleeveMat = isChild ? outfitMats[0].sleeve : adultTopMat;

  // Natural sculpted torso + collar
  const torsoMesh = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.135 * scale, 0.16 * scale, 8, 14),
    torsoMat
  );
  torsoMesh.scale.set(1.14, 1.0, 0.80);
  torsoMesh.position.y = 0.24 * scale;
  torsoMesh.castShadow = true;
  torsoMesh.receiveShadow = true;
  body.add(torsoMesh);

  const collarRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.088 * scale, 0.022 * scale, 8, 16),
    sleeveMat
  );
  collarRing.rotation.x = Math.PI * 0.5;
  collarRing.position.set(0, 0.36 * scale, 0.01 * scale);
  body.add(collarRing);

  // Seated legs + cozy socks
  const legGeo = new THREE.CapsuleGeometry(0.055 * scale, 0.15 * scale, 6, 10);
  [-1, 1].forEach((side) => {
    const leg = new THREE.Mesh(legGeo, pantsMat);
    leg.position.set(side * 0.082 * scale, 0.075 * scale, 0.10 * scale);
    leg.rotation.x = Math.PI * 0.47;
    leg.rotation.z = -side * 0.14;
    leg.castShadow = true;
    body.add(leg);

    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.048 * scale, 10, 8), sockMat);
    foot.scale.set(0.9, 0.65, 1.25);
    foot.position.set(side * 0.098 * scale, 0.05 * scale, 0.22 * scale);
    foot.castShadow = true;
    body.add(foot);
  });

  // Head Pivot: pitched upward (-1.08 rad ~ 62 deg) so the face (+Z local) looks warmly right up at the overhead camera!
  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.40 * scale, 0.02 * scale);
  headPivot.rotation.x = -1.08;
  body.add(headPivot);

  const headR = (isChild ? 0.155 : 0.136) * scale;
  const hcY = headR * 0.72; // Head sphere center inside headPivot

  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(headR, 20, 16), skinMat);
  headMesh.scale.set(0.98, 1.03, 0.96);
  headMesh.position.y = hcY;
  headMesh.castShadow = true;
  headPivot.add(headMesh);

  // Ears
  [-1, 1].forEach((side) => {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(headR * 0.22, 8, 8), skinMat);
    ear.scale.set(0.55, 0.95, 0.7);
    ear.position.set(side * headR * 0.94, hcY, -headR * 0.02);
    headPivot.add(ear);
  });

  // Soft sculpted nose (warm skin tone, subtle shadow, NOT white!)
  const noseMat = createSkinMaterial(isChild ? '#eeb394' : '#e5aa8a');
  const nose = new THREE.Mesh(new THREE.SphereGeometry(headR * 0.125, 10, 8), noseMat);
  nose.scale.set(0.92, 0.85, 1.1);
  nose.position.set(0, hcY - headR * 0.04, headR * 0.94);
  headPivot.add(nose);

  // Warm rosy cheek blushes
  const blushMat = new THREE.MeshBasicMaterial({
    color: 0xf46d6d,
    transparent: true,
    opacity: 0.34,
    depthWrite: false
  });
  const cheeks = [];
  [-1, 1].forEach((side) => {
    const cheek = new THREE.Mesh(new THREE.CircleGeometry(headR * 0.22, 12), blushMat);
    cheek.position.set(side * headR * 0.52, hcY - headR * 0.12, headR * 0.83);
    cheek.rotation.y = side * 0.42;
    headPivot.add(cheek);
    cheeks.push(cheek);
  });

  // Expressive Eyes clearly framed on the open face (+Z side)
  const eyeGroups = [];
  const smileArcs = [];
  const brows = [];
  const scleraMat = new THREE.MeshBasicMaterial({ color: 0xfbf9f5 });
  const irisMat = new THREE.MeshBasicMaterial({ color: 0x2c1810 });
  const specMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const browMat = new THREE.MeshStandardMaterial({ color: 0x2a1810, roughness: 0.65 });

  [-1, 1].forEach((side) => {
    const eg = new THREE.Group();
    eg.position.set(side * headR * 0.36, hcY + headR * 0.10, headR * 0.86);
    eg.rotation.y = side * 0.20;
    headPivot.add(eg);

    const sclera = new THREE.Mesh(new THREE.SphereGeometry(headR * 0.155, 10, 8), scleraMat);
    sclera.scale.set(1.08, 0.95, 0.48);
    eg.add(sclera);

    const iris = new THREE.Mesh(new THREE.CircleGeometry(headR * 0.108, 12), irisMat);
    iris.position.z = headR * 0.078;
    eg.add(iris);

    const catchlight = new THREE.Mesh(new THREE.CircleGeometry(headR * 0.040, 8), specMat);
    catchlight.position.set(-headR * 0.030, headR * 0.034, headR * 0.084);
    eg.add(catchlight);

    const arc = new THREE.Mesh(
      new THREE.TorusGeometry(headR * 0.125, headR * 0.026, 6, 12, Math.PI),
      browMat
    );
    arc.position.set(side * headR * 0.36, hcY + headR * 0.08, headR * 0.90);
    arc.rotation.y = side * 0.20;
    arc.visible = false;
    headPivot.add(arc);
    smileArcs.push(arc);

    const brow = new THREE.Mesh(
      new THREE.CapsuleGeometry(headR * 0.028, headR * 0.17, 4, 6),
      browMat
    );
    brow.rotation.z = Math.PI * 0.5 - side * 0.08;
    brow.position.set(side * headR * 0.37, hcY + headR * 0.32, headR * 0.84);
    brow.rotation.y = side * 0.20;
    headPivot.add(brow);

    eyeGroups.push(eg);
    brows.push({ mesh: brow, side });
  });

  // Mouth morph shapes
  const lipMat = new THREE.MeshStandardMaterial({ color: 0xd8525c, roughness: 0.45 });
  const innerMouthMat = new THREE.MeshBasicMaterial({ color: 0x8e2430 });

  const mouthSmile = new THREE.Mesh(
    new THREE.TorusGeometry(headR * 0.17, headR * 0.028, 6, 14, Math.PI),
    lipMat
  );
  mouthSmile.rotation.z = Math.PI;
  mouthSmile.position.set(0, hcY - headR * 0.20, headR * 0.87);
  headPivot.add(mouthSmile);

  const mouthOpen = new THREE.Mesh(new THREE.CircleGeometry(headR * 0.14, 14), innerMouthMat);
  mouthOpen.position.set(0, hcY - headR * 0.26, headR * 0.90);
  mouthOpen.visible = false;
  headPivot.add(mouthOpen);

  // Natural Continuous Sculpted Hairline & Crown (seamless hairline framing forehead & temples—no floating gaps!)
  const hairBack = new THREE.Mesh(
    new THREE.SphereGeometry(headR * 1.05, 22, 16),
    hairMat
  );
  hairBack.scale.set(1.03, 1.04, 0.92);
  hairBack.position.set(0, hcY + headR * 0.14, -headR * 0.18);
  hairBack.castShadow = true;
  headPivot.add(hairBack);

  // Seamless upper-forehead hairline arch wrapping smoothly from left ear over crown to right ear
  const hairlineArch = new THREE.Mesh(
    new THREE.TorusGeometry(headR * 0.86, headR * 0.24, 10, 22, Math.PI * 1.08),
    hairMat
  );
  hairlineArch.position.set(0, hcY + headR * 0.22, headR * 0.18);
  hairlineArch.rotation.x = -0.48;
  hairlineArch.rotation.z = -0.06;
  hairlineArch.castShadow = true;
  headPivot.add(hairlineArch);

  if (isChild || isMom) {
    // Soft natural side-parted fringe resting gently along the top of the forehead
    const fringeL = new THREE.Mesh(
      new THREE.SphereGeometry(headR * 0.56, 14, 10),
      hairMat
    );
    fringeL.scale.set(1.15, 0.42, 0.65);
    fringeL.position.set(-headR * 0.26, hcY + headR * 0.68, headR * 0.52);
    fringeL.rotation.z = 0.24;
    fringeL.rotation.x = 0.35;
    headPivot.add(fringeL);

    const fringeR = new THREE.Mesh(
      new THREE.SphereGeometry(headR * 0.46, 14, 10),
      hairMat
    );
    fringeR.scale.set(1.05, 0.38, 0.62);
    fringeR.position.set(headR * 0.36, hcY + headR * 0.68, headR * 0.48);
    fringeR.rotation.z = -0.28;
    fringeR.rotation.x = 0.35;
    headPivot.add(fringeR);
  } else {
    // Dad's neat natural short textured side-parted top hair
    const dadTop = new THREE.Mesh(
      new THREE.SphereGeometry(headR * 0.72, 14, 10),
      hairMat
    );
    dadTop.scale.set(1.12, 0.48, 0.82);
    dadTop.position.set(-headR * 0.08, hcY + headR * 0.74, headR * 0.32);
    dadTop.rotation.z = 0.12;
    headPivot.add(dadTop);
  }

  const hairAccessories = [];
  if (isChild) {
    [-1, 1].forEach((side) => {
      const bun = new THREE.Mesh(new THREE.SphereGeometry(headR * 0.38, 12, 10), hairMat);
      bun.position.set(side * headR * 0.96, hcY + headR * 0.14, -headR * 0.18);
      bun.castShadow = true;
      headPivot.add(bun);

      const tie = new THREE.Mesh(
        new THREE.TorusGeometry(headR * 0.22, headR * 0.072, 8, 12),
        outfitMats[0].accent
      );
      tie.position.set(side * headR * 0.80, hcY + headR * 0.16, -headR * 0.10);
      tie.rotation.y = side * 0.9;
      headPivot.add(tie);
      hairAccessories.push(tie);
    });
  } else if (isMom) {
    const momBun = new THREE.Mesh(new THREE.SphereGeometry(headR * 0.44, 12, 10), hairMat);
    momBun.position.set(0, hcY + headR * 0.25, -headR * 0.88);
    headPivot.add(momBun);
  }

  const hairBall = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 12, 8),
    new THREE.MeshPhysicalMaterial({
      color: BALL_COLORS[0],
      roughness: 0.12,
      clearcoat: 1.0
    })
  );
  hairBall.position.set(headR * 0.28, hcY + headR * 0.92, headR * 0.18);
  hairBall.visible = false;
  headPivot.add(hairBall);

  const arms = [];
  [-1, 1].forEach((side) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.17 * scale, 0.32 * scale, 0.02 * scale);
    body.add(shoulder);

    const upperArm = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.045 * scale, 0.14 * scale, 6, 10),
      sleeveMat
    );
    upperArm.position.set(0, -0.06 * scale, 0.06 * scale);
    upperArm.rotation.x = -0.95;
    upperArm.castShadow = true;
    shoulder.add(upperArm);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.046 * scale, 10, 8), skinMat);
    hand.scale.set(0.95, 0.72, 1.18);
    hand.position.set(0, -0.12 * scale, 0.15 * scale);
    hand.castShadow = true;
    shoulder.add(hand);

    arms.push({ shoulder, upperArm, hand, side });
  });

  const charObj = {
    role,
    root,
    body,
    torsoMesh,
    collarRing,
    headPivot,
    eyeGroups,
    smileArcs,
    brows,
    mouthSmile,
    mouthOpen,
    cheeks,
    arms,
    hairBall,
    hairAccessories,
    outfitMats,
    expression: 'happy',
    exprTimer: 0,
    queuedJoyTimer: 0,
    blinkTimer: 1.5 + Math.random() * 2.5,
    outfitIndex: 0,

    setOutfit(idx) {
      if (!isChild) return;
      this.outfitIndex = idx;
      const mats = outfitMats[idx % outfitMats.length];
      torsoMesh.material = mats.torso;
      collarRing.material = mats.sleeve;
      arms.forEach((a) => { a.upperArm.material = mats.sleeve; });
      hairAccessories.forEach((h) => { h.material = mats.accent; });
    },

    setExpression(expr, duration = 1.6) {
      this.expression = expr;
      this.exprTimer = duration;
      if (expr === 'huh') {
        this.queuedJoyTimer = 0.64;
      } else {
        this.queuedJoyTimer = 0;
      }
    },

    update(dt, time, lookTargetXZ = null) {
      this.blinkTimer -= dt;
      let isBlinking = false;
      if (this.blinkTimer <= 0) {
        isBlinking = true;
        if (this.blinkTimer < -0.11) {
          this.blinkTimer = 2.2 + Math.random() * 2.6;
        }
      }

      if (this.queuedJoyTimer > 0) {
        this.queuedJoyTimer -= dt;
        if (this.queuedJoyTimer <= 0) {
          this.expression = 'joy';
          this.exprTimer = 1.5;
        }
      } else if (this.exprTimer > 0 && this.expression !== 'happy' && this.expression !== 'clap') {
        this.exprTimer -= dt;
        if (this.exprTimer <= 0) {
          this.expression = 'happy';
        }
      }

      const expr = this.expression;
      const showCrescentEyes = expr === 'joy' || expr === 'clap';
      eyeGroups.forEach((eg) => {
        eg.visible = !showCrescentEyes;
        eg.scale.y = isBlinking ? 0.12 : expr === 'oops' || expr === 'huh' ? 1.2 : 1.0;
      });
      smileArcs.forEach((sa) => { sa.visible = showCrescentEyes; });

      if (expr === 'huh') {
        mouthSmile.visible = false;
        mouthOpen.visible = true;
        mouthOpen.scale.set(0.54, 0.60, 1);
      } else if (expr === 'pour') {
        mouthSmile.visible = false;
        mouthOpen.visible = true;
        mouthOpen.scale.set(0.64, 0.70, 1);
      } else if (expr === 'oops') {
        mouthSmile.visible = false;
        mouthOpen.visible = true;
        mouthOpen.scale.set(1.06, 0.88, 1);
      } else if (expr === 'joy' || expr === 'excited' || expr === 'clap') {
        mouthSmile.visible = true;
        mouthOpen.visible = true;
        mouthOpen.scale.set(0.95, 0.72, 1);
      } else {
        mouthSmile.visible = true;
        mouthOpen.visible = false;
      }

      let targetHeadRoll = Math.sin(time * 1.6 + (isChild ? 0 : 1.5)) * 0.04;
      let targetHeadPitch = -1.08;
      let targetHeadYaw = 0;

      if (lookTargetXZ) {
        const dx = lookTargetXZ.x - root.position.x;
        const dz = lookTargetXZ.z - root.position.z;
        const localAng = Math.atan2(dx, dz) - root.rotation.y;
        const wrapped = Math.atan2(Math.sin(localAng), Math.cos(localAng));
        targetHeadYaw = Math.max(-0.38, Math.min(0.38, wrapped * 0.42));
      }

      if (expr === 'huh') {
        targetHeadRoll = 0.38;
        targetHeadPitch = -1.14;
        brows[0].mesh.position.y = hcY + headR * 0.42;
        brows[0].mesh.rotation.z = Math.PI * 0.5 + 0.24;
        brows[1].mesh.position.y = hcY + headR * 0.30;
        brows[1].mesh.rotation.z = Math.PI * 0.5 - 0.05;
      } else if (expr === 'oops') {
        targetHeadRoll = -0.18;
        targetHeadPitch = -1.15;
        brows.forEach((b) => {
          b.mesh.position.y = hcY + headR * 0.40;
          b.mesh.rotation.z = Math.PI * 0.5 + b.side * 0.34;
        });
      } else if (expr === 'joy' || expr === 'clap') {
        targetHeadPitch = -1.12 + Math.sin(time * 10) * 0.06;
        brows.forEach((b) => {
          b.mesh.position.y = hcY + headR * 0.38;
          b.mesh.rotation.z = Math.PI * 0.5 - b.side * 0.12;
        });
      } else {
        brows.forEach((b) => {
          b.mesh.position.y = hcY + headR * 0.32;
          b.mesh.rotation.z = Math.PI * 0.5 - b.side * 0.08;
        });
      }

      headPivot.rotation.z += (targetHeadRoll - headPivot.rotation.z) * 0.18;
      headPivot.rotation.x += (targetHeadPitch - headPivot.rotation.x) * 0.16;
      headPivot.rotation.y += (targetHeadYaw - headPivot.rotation.y) * 0.14;

      arms.forEach((a) => {
        if (expr === 'clap' || expr === 'joy') {
          const clapOsc = Math.abs(Math.sin(time * 9.5));
          a.shoulder.rotation.x = -0.62;
          a.shoulder.rotation.z = -a.side * (0.12 + clapOsc * 0.34);
          a.shoulder.rotation.y = -a.side * 0.38;
        } else if (expr === 'huh') {
          if (a.side === 1) {
            a.shoulder.rotation.x = -1.18;
            a.shoulder.rotation.z = -0.25;
          } else {
            a.shoulder.rotation.x = -0.18;
            a.shoulder.rotation.z = 0.25;
          }
          a.shoulder.rotation.y = 0;
        } else if (expr === 'oops') {
          a.shoulder.rotation.x = -1.18;
          a.shoulder.rotation.z = -a.side * 0.35;
          a.shoulder.rotation.y = 0;
        } else {
          a.shoulder.rotation.x += (-0.22 + Math.sin(time * 2.2 + a.side) * 0.06 - a.shoulder.rotation.x) * 0.14;
          a.shoulder.rotation.z += (a.side * 0.18 - a.shoulder.rotation.z) * 0.14;
          a.shoulder.rotation.y *= 0.85;
        }
      });

      blushMat.opacity = (expr === 'joy' || expr === 'clap' || expr === 'oops') ? 0.46 : 0.32;
    }
  };

  return charObj;
}

// 3 Tailored Realistic Garments laid spaciously on the foreground rug for Dress-Up!
export function createFoldedOutfits(scene) {
  const positions = [
    { x: -0.78, z: 1.02 },
    { x: 0.14,  z: 1.05 },
    { x: 1.06,  z: 1.02 }
  ];

  const brassMat = new THREE.MeshStandardMaterial({ color: 0xd9a84e, roughness: 0.28, metalness: 0.75 });

  return OUTFIT_DEFS.map((od, i) => {
    const group = new THREE.Group();
    group.position.set(positions[i].x, 0.024, positions[i].z);
    scene.add(group);

    const torsoTex = createFabricTexture(od.mainHex, od.stripeHex, od.style);
    const sleeveTex = createFabricTexture(od.subHex, od.stripeHex, od.sleeveStyle);

    const bodyMat = new THREE.MeshStandardMaterial({ map: torsoTex, roughness: 0.76, envMapIntensity: 0.42 });
    const sleeveMat = new THREE.MeshStandardMaterial({ map: sleeveTex, roughness: 0.74, envMapIntensity: 0.42 });
    const trimMat = new THREE.MeshStandardMaterial({ color: od.accentHex, roughness: 0.50 });

    // Soft rounded undershirt base
    const shirtShape = new THREE.Shape();
    const sw = 0.38, sh = 0.34, sr = 0.06;
    shirtShape.moveTo(-sw * 0.5 + sr, -sh * 0.5);
    shirtShape.lineTo(sw * 0.5 - sr, -sh * 0.5);
    shirtShape.quadraticCurveTo(sw * 0.5, -sh * 0.5, sw * 0.5, -sh * 0.5 + sr);
    shirtShape.lineTo(sw * 0.5, sh * 0.5 - sr);
    shirtShape.quadraticCurveTo(sw * 0.5, sh * 0.5, sw * 0.5 - sr, sh * 0.5);
    shirtShape.lineTo(-sw * 0.5 + sr, sh * 0.5);
    shirtShape.quadraticCurveTo(-sw * 0.5, sh * 0.5, -sw * 0.5, sh * 0.5 - sr);
    shirtShape.lineTo(-sw * 0.5, -sh * 0.5 + sr);
    shirtShape.quadraticCurveTo(-sw * 0.5, -sh * 0.5, -sw * 0.5 + sr, -sh * 0.5);

    const garmentGeo = new THREE.ExtrudeGeometry(shirtShape, {
      depth: 0.036,
      bevelEnabled: true,
      bevelThickness: 0.012,
      bevelSize: 0.014,
      bevelSegments: 3
    });
    garmentGeo.rotateX(-Math.PI * 0.5);
    // Fix UVs for fabric pattern
    const gPos = garmentGeo.attributes.position;
    const gUv = garmentGeo.attributes.uv;
    for (let k = 0; k < gPos.count; k++) {
      gUv.setXY(k, (gPos.getX(k) + 0.25) * 2.2, (gPos.getZ(k) + 0.25) * 2.2);
    }

    const underTop = new THREE.Mesh(garmentGeo, sleeveMat);
    underTop.castShadow = true;
    underTop.receiveShadow = true;
    group.add(underTop);

    // Outer smock / denim bib / quilted vest layer
    const outerVest = new THREE.Mesh(garmentGeo, bodyMat);
    outerVest.scale.set(0.88, 1.05, 0.92);
    outerVest.position.y = 0.008;
    outerVest.castShadow = true;
    group.add(outerVest);

    // Tailored angled sleeves with cuffs
    [-1, 1].forEach((s) => {
      const slv = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.064, 0.22, 12), sleeveMat);
      slv.rotation.z = Math.PI * 0.5 - s * 0.42;
      slv.rotation.y = s * 0.26;
      slv.position.set(s * 0.25, 0.024, -0.04);
      slv.castShadow = true;
      group.add(slv);

      const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.014, 8, 14), trimMat);
      cuff.position.set(s * 0.34, 0.026, 0.01);
      cuff.rotation.y = Math.PI * 0.5 - s * 0.26;
      group.add(cuff);
    });

    // Neckline collar & buttons/pocket
    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(0.078, 0.020, 8, 16, Math.PI),
      sleeveMat
    );
    collar.rotation.x = Math.PI * 0.5;
    collar.position.set(0, 0.055, -0.10);
    group.add(collar);

    const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.014, 0.10), trimMat);
    pocket.position.set(0, 0.056, 0.05);
    group.add(pocket);

    // Two realistic buttons
    [-0.05, 0.05].forEach((bx) => {
      const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.008, 10), brassMat);
      btn.position.set(bx, 0.058, -0.03);
      group.add(btn);
    });

    return { id: i, group, baseX: positions[i].x, baseZ: positions[i].z, hover: 0 };
  });
}

// Lifelike 3D Child Hand + Cloth Sleeve that becomes the player's finger!
export function createPlayerHand(scene) {
  const root = new THREE.Group();
  root.visible = false;
  scene.add(root);

  const skinMat = createSkinMaterial('#f4c2a4');
  const sleeveMats = OUTFIT_DEFS.map((od) =>
    new THREE.MeshStandardMaterial({
      map: createFabricTexture(od.subHex, od.stripeHex, od.sleeveStyle),
      roughness: 0.74,
      envMapIntensity: 0.42
    })
  );
  const cuffMats = OUTFIT_DEFS.map((od) =>
    new THREE.MeshStandardMaterial({
      map: createFabricTexture(od.mainHex, od.stripeHex, od.style),
      roughness: 0.76,
      envMapIntensity: 0.42
    })
  );

  const buildHandRig = (mirror = 1) => {
    const g = new THREE.Group();
    const nailMat = new THREE.MeshPhysicalMaterial({
      color: 0xfbe0d4,
      roughness: 0.25,
      clearcoat: 0.6
    });

    // Organic sculpted child palm (wider across knuckles, tapered at wrist)
    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.068, 16, 12), skinMat);
    palm.scale.set(1.06, 0.42, 1.12);
    palm.castShadow = true;
    g.add(palm);

    // 4 Naturally Proportioned & Slightly Splayed Fingers (index, middle, ring, pinky)
    const fingerSpecs = [
      { x: -0.044, len: 0.052, r: 0.0130, splay: 0.09 },  // Index
      { x: -0.015, len: 0.058, r: 0.0135, splay: 0.02 },  // Middle
      { x:  0.015, len: 0.053, r: 0.0128, splay: -0.04 }, // Ring
      { x:  0.042, len: 0.042, r: 0.0115, splay: -0.12 }  // Pinky
    ];
    const fingers = [];
    for (let f = 0; f < 4; f++) {
      const sp = fingerSpecs[f];
      const fg = new THREE.Group();
      fg.position.set(sp.x * mirror, 0.002, -0.058);
      fg.rotation.y = sp.splay * mirror;

      const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(sp.r, sp.len, 6, 10), skinMat);
      mesh.rotation.x = Math.PI * 0.5;
      mesh.scale.set(0.96, 1.0, 0.88);
      mesh.position.z = -sp.len * 0.52;
      mesh.castShadow = true;
      fg.add(mesh);

      const nail = new THREE.Mesh(new THREE.SphereGeometry(sp.r * 0.72, 8, 6), nailMat);
      nail.scale.set(0.95, 0.32, 1.15);
      nail.position.set(0, sp.r * 0.72, -sp.len * 0.92);
      fg.add(nail);

      g.add(fg);
      fingers.push(fg);
    }

    // Natural Opposable Thumb
    const thumbPivot = new THREE.Group();
    thumbPivot.position.set(-0.058 * mirror, -0.003, -0.012);
    thumbPivot.rotation.y = 0.64 * mirror;
    const thumbMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.0148, 0.042, 6, 8), skinMat);
    thumbMesh.rotation.x = Math.PI * 0.5;
    thumbMesh.position.z = -0.026;
    thumbMesh.castShadow = true;
    thumbPivot.add(thumbMesh);
    g.add(thumbPivot);

    const wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.043, 0.049, 0.08, 12), skinMat);
    wrist.rotation.x = Math.PI * 0.44;
    wrist.position.set(0, 0.015, 0.082);
    wrist.castShadow = true;
    g.add(wrist);

    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.054, 0.016, 8, 16), cuffMats[0]);
    cuff.position.set(0, 0.030, 0.122);
    cuff.rotation.x = 0.24;
    g.add(cuff);

    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.054, 0.074, 0.44, 14), sleeveMats[0]);
    sleeve.rotation.x = Math.PI * 0.41;
    sleeve.position.set(0, 0.10, 0.33);
    sleeve.castShadow = true;
    g.add(sleeve);

    return { group: g, fingers, thumbPivot, sleeve, cuff };
  };

  const rightHand = buildHandRig(1);
  const leftHand = buildHandRig(-1);
  leftHand.group.position.set(-0.18, 0, 0.02);
  leftHand.group.visible = false;

  root.add(rightHand.group);
  root.add(leftHand.group);

  return {
    root,
    rightHand,
    leftHand,
    setOutfit(idx) {
      const i = idx % sleeveMats.length;
      [rightHand, leftHand].forEach((h) => {
        h.sleeve.material = sleeveMats[i];
        h.cuff.material = cuffMats[i];
      });
    },
    setPose(mode = 'open', scoopCount = 0) {
      const curl = mode === 'grab' ? 0.85 : mode === 'scoop' ? 0.58 : 0.22;
      [rightHand, leftHand].forEach((h) => {
        h.fingers.forEach((f) => {
          f.rotation.x += (-curl - f.rotation.x) * 0.25;
        });
      });
      if (mode === 'scoop' && scoopCount > 0) {
        // Natural open V-angled forearms extending outward to left & right shoulders (never crossing!)
        leftHand.group.visible = true;
        rightHand.group.position.x += (0.105 - rightHand.group.position.x) * 0.22;
        rightHand.group.rotation.z += (0.20 - rightHand.group.rotation.z) * 0.22;
        rightHand.group.rotation.y += (0.24 - rightHand.group.rotation.y) * 0.22;

        leftHand.group.position.x += (-0.105 - leftHand.group.position.x) * 0.22;
        leftHand.group.rotation.z += (-0.20 - leftHand.group.rotation.z) * 0.22;
        leftHand.group.rotation.y += (-0.24 - leftHand.group.rotation.y) * 0.22;
      } else {
        leftHand.group.visible = false;
        rightHand.group.position.x += (0 - rightHand.group.position.x) * 0.22;
        rightHand.group.rotation.z += (0 - rightHand.group.rotation.z) * 0.22;
        rightHand.group.rotation.y += (0.08 - rightHand.group.rotation.y) * 0.22;
      }
    }
  };
}
