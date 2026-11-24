import * as THREE from '../vendor/three.module.min.js';

// Anatomically Natural, Warm Realistic 3D Characters (5yo Girl, Dad Sanitation Worker, Neighborhood Kids, and Player's 3D Gloved Hand)
// Sculpted Lathe/Organic anatomy, parted hair well above eyes, fabric normal mapping, and expressive facial rigs!

let sharedFabricNormal = null;
export function setCharacterFabricNormal(tex) {
  sharedFabricNormal = tex;
}

function createSkinMaterial(tint = 0xf1c2a5) {
  return new THREE.MeshPhysicalMaterial({
    color: tint,
    roughness: 0.48,
    metalness: 0.0,
    sheen: 0.28,
    sheenRoughness: 0.62,
    sheenColor: new THREE.Color(0xffb599),
    clearcoat: 0.04,
    clearcoatRoughness: 0.55,
  });
}

function createClothMaterial(colorHex, roughness = 0.78) {
  const mat = new THREE.MeshStandardMaterial({
    color: colorHex,
    roughness,
    metalness: 0.02,
    normalMap: sharedFabricNormal || null,
    normalScale: new THREE.Vector2(0.35, 0.35),
  });
  return mat;
}

// Sculpted organic torso with natural rounded shoulders, chest, and waist taper (NO tin-can cylinders!)
function createSculptedTorsoGeo(height, hipR, waistR, chestR, shoulderR) {
  const pts = [
    new THREE.Vector2(0.001, 0),
    new THREE.Vector2(hipR, 0.02 * height),
    new THREE.Vector2(hipR * 1.02, 0.18 * height),
    new THREE.Vector2(waistR, 0.45 * height),
    new THREE.Vector2(chestR, 0.76 * height),
    new THREE.Vector2(shoulderR, 0.90 * height),
    new THREE.Vector2(shoulderR * 0.68, 0.98 * height),
    new THREE.Vector2(0.032, height),
  ];
  const geo = new THREE.LatheGeometry(pts, 20);
  geo.scale(1.08, 1.0, 0.74); // natural human ribcage front-to-back depth!
  geo.computeVertexNormals();
  return geo;
}

function buildExpressiveHead(scale = 1.0, hairColor = 0x221814, isChild = true) {
  const headGroup = new THREE.Group();
  const skinMat = createSkinMaterial(isChild ? 0xf3c6ab : 0xe9b496);

  // Sculpted natural head shape (soft chin, cheekbones, forehead)
  const headPts = [
    new THREE.Vector2(0.001, -0.125 * scale),
    new THREE.Vector2(0.058 * scale, -0.115 * scale), // chin
    new THREE.Vector2(0.106 * scale, -0.065 * scale), // jaw/cheeks
    new THREE.Vector2(0.122 * scale, -0.005 * scale), // cheekbones
    new THREE.Vector2(0.124 * scale, 0.055 * scale),  // temples
    new THREE.Vector2(0.106 * scale, 0.108 * scale),  // forehead
    new THREE.Vector2(0.055 * scale, 0.135 * scale),
    new THREE.Vector2(0.001, 0.142 * scale),          // crown
  ];
  const skullGeo = new THREE.LatheGeometry(headPts, 24);
  skullGeo.scale(0.96, 1.0, 1.02);
  skullGeo.computeVertexNormals();
  const skull = new THREE.Mesh(skullGeo, skinMat);
  skull.castShadow = true;
  skull.receiveShadow = true;
  headGroup.add(skull);

  // Soft natural nose bridge & tip
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.015 * scale, 12, 10), skinMat);
  nose.scale.set(0.82, 1.25, 1.15);
  nose.position.set(0, -0.012 * scale, 0.122 * scale);
  headGroup.add(nose);

  // Ears
  [-1, 1].forEach((sx) => {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.024 * scale, 10, 10), skinMat);
    ear.scale.set(0.42, 0.92, 0.68);
    ear.position.set(sx * 0.118 * scale, -0.006 * scale, -0.005 * scale);
    headGroup.add(ear);
  });

  // Subtle warm cheek blush
  const blushMat = new THREE.MeshBasicMaterial({
    color: 0xe87a84,
    transparent: true,
    opacity: isChild ? 0.19 : 0.09,
  });
  [-1, 1].forEach((sx) => {
    const blush = new THREE.Mesh(new THREE.CircleGeometry(0.024 * scale, 14), blushMat);
    blush.position.set(sx * 0.062 * scale, -0.028 * scale, 0.109 * scale);
    blush.rotation.y = sx * 0.42;
    headGroup.add(blush);
  });

  // Natural Almond Eyes (positioned cleanly in eye sockets with warm dark lashes, rich brown iris, corneal specular)
  const scleraMat = new THREE.MeshStandardMaterial({ color: 0xf7f5f2, roughness: 0.16 });
  const irisMat = new THREE.MeshPhysicalMaterial({
    color: 0x3d2417,
    roughness: 0.06,
    clearcoat: 1.0,
  });
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x0c0a09 });
  const catchMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const lidMat = createSkinMaterial(isChild ? 0xebb99c : 0xdfa788);
  const lashMat = new THREE.MeshStandardMaterial({ color: 0x1c1411, roughness: 0.6 });
  const browMat = new THREE.MeshStandardMaterial({ color: hairColor, roughness: 0.75 });

  const eyes = [];
  const brows = [];
  [-1, 1].forEach((sx) => {
    const eyeSocket = new THREE.Group();
    eyeSocket.position.set(sx * 0.043 * scale, 0.012 * scale, 0.108 * scale);
    eyeSocket.rotation.y = sx * 0.16;

    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.0185 * scale, 14, 12), scleraMat);
    ball.scale.set(1.08, 0.88, 0.58);
    eyeSocket.add(ball);

    const pupilPivot = new THREE.Group();
    const iris = new THREE.Mesh(new THREE.CircleGeometry(0.0115 * scale, 14), irisMat);
    iris.position.z = 0.0114 * scale;
    pupilPivot.add(iris);

    const pupil = new THREE.Mesh(new THREE.CircleGeometry(0.0062 * scale, 12), pupilMat);
    pupil.position.z = 0.0118 * scale;
    pupilPivot.add(pupil);

    const catchlight = new THREE.Mesh(new THREE.CircleGeometry(0.0032 * scale, 8), catchMat);
    catchlight.position.set(-0.0035 * scale, 0.0038 * scale, 0.0122 * scale);
    pupilPivot.add(catchlight);
    eyeSocket.add(pupilPivot);

    // Subtle upper lash line for natural human definition
    const lash = new THREE.Mesh(
      new THREE.TorusGeometry(0.018 * scale, 0.0022 * scale, 6, 14, Math.PI * 0.88),
      lashMat
    );
    lash.position.set(0, 0.001 * scale, 0.009 * scale);
    lash.rotation.z = Math.PI * 0.06;
    eyeSocket.add(lash);

    const upperLid = new THREE.Mesh(
      new THREE.SphereGeometry(0.020 * scale, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5),
      lidMat
    );
    upperLid.scale.set(1.1, 0.95, 0.66);
    upperLid.rotation.x = -1.05;
    eyeSocket.add(upperLid);

    headGroup.add(eyeSocket);
    eyes.push({ eyeSocket, pupilPivot, upperLid, sx });

    // Soft natural Eyebrow clearly visible on forehead!
    const brow = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.0042 * scale, 0.024 * scale, 4, 8),
      browMat
    );
    brow.rotation.z = Math.PI / 2 - sx * 0.07;
    brow.rotation.y = sx * 0.2;
    brow.position.set(sx * 0.044 * scale, 0.042 * scale, 0.114 * scale);
    headGroup.add(brow);
    brows.push({ mesh: brow, sx });
  });

  // Natural Soft Coral Lips (NOT bright red toy loop!)
  const mouthGroup = new THREE.Group();
  mouthGroup.position.set(0, -0.052 * scale, 0.113 * scale);

  const smileCurve = new THREE.TorusGeometry(0.020 * scale, 0.0036 * scale, 8, 16, Math.PI * 0.82);
  const lipMat = new THREE.MeshStandardMaterial({
    color: isChild ? 0xd47474 : 0xb86b64,
    roughness: 0.42,
  });
  const smileLip = new THREE.Mesh(smileCurve, lipMat);
  smileLip.rotation.z = Math.PI * 1.09;
  smileLip.position.y = 0.010 * scale;
  mouthGroup.add(smileLip);

  const oMouth = new THREE.Mesh(
    new THREE.CircleGeometry(0.012 * scale, 14),
    new THREE.MeshBasicMaterial({ color: 0x6e2a2e })
  );
  oMouth.visible = false;
  mouthGroup.add(oMouth);
  headGroup.add(mouthGroup);

  // Natural Full Hair Crown & Swept Bangs — seamless coverage across top of head & hairline well above eyebrows!
  const hairMat = new THREE.MeshStandardMaterial({
    color: hairColor,
    roughness: 0.54,
    metalness: 0.08,
  });

  // Main hair dome covering top & back of skull cleanly above forehead & eyebrows!
  const hairCrown = new THREE.Mesh(
    new THREE.SphereGeometry(0.131 * scale, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.48),
    hairMat
  );
  hairCrown.position.set(0, 0.028 * scale, -0.010 * scale);
  hairCrown.rotation.x = -0.20;
  hairCrown.castShadow = true;
  headGroup.add(hairCrown);

  // Back nape hair fullness
  const hairNape = new THREE.Mesh(
    new THREE.SphereGeometry(0.122 * scale, 20, 14),
    hairMat
  );
  hairNape.scale.set(0.98, 0.95, 0.85);
  hairNape.position.set(0, -0.015 * scale, -0.032 * scale);
  headGroup.add(hairNape);

  // Smooth side-parted temple hair tucked cleanly behind cheekbones (never touching eyebrows!)
  [-1, 1].forEach((sx) => {
    const sideLock = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.024 * scale, 0.080 * scale, 6, 10),
      hairMat
    );
    sideLock.position.set(sx * 0.108 * scale, 0.012 * scale, -0.012 * scale);
    sideLock.rotation.z = sx * 0.10;
    sideLock.rotation.x = 0.06;
    headGroup.add(sideLock);
  });

  if (isChild) {
    // Seamless soft side-swept fringe bridging across upper forehead above eyebrows!
    const fringeL = new THREE.Mesh(new THREE.SphereGeometry(0.068 * scale, 16, 12), hairMat);
    fringeL.scale.set(1.25, 0.52, 0.65);
    fringeL.position.set(-0.028 * scale, 0.092 * scale, 0.078 * scale);
    fringeL.rotation.z = 0.18;
    fringeL.rotation.x = 0.25;
    headGroup.add(fringeL);

    const fringeR = new THREE.Mesh(new THREE.SphereGeometry(0.062 * scale, 16, 12), hairMat);
    fringeR.scale.set(1.15, 0.48, 0.62);
    fringeR.position.set(0.038 * scale, 0.094 * scale, 0.076 * scale);
    fringeR.rotation.z = -0.22;
    fringeR.rotation.x = 0.25;
    headGroup.add(fringeR);
  }

  return {
    headGroup,
    eyes,
    brows,
    smileLip,
    oMouth,
    hairMat,
    skinMat,
    scale,
  };
}

function applyExpressionToRig(rig, expr, blinkAmt, t) {
  const s = rig.scale;
  let headTiltZ = 0;
  let headNodX = 0;

  if (expr === 'huh') {
    headTiltZ = 0.28;
    headNodX = -0.05;
    rig.smileLip.visible = false;
    rig.oMouth.visible = true;
    rig.oMouth.scale.set(0.95, 1.15, 1);
  } else if (expr === 'surprised') {
    headTiltZ = -0.12;
    headNodX = -0.08;
    rig.smileLip.visible = false;
    rig.oMouth.visible = true;
    rig.oMouth.scale.set(1.2, 1.3, 1);
  } else if (expr === 'happy' || expr === 'proud' || expr === 'forgive' || expr === 'cheering') {
    headTiltZ = Math.sin(t * 4.2) * 0.055;
    headNodX = expr === 'forgive' ? Math.sin(t * 9.0) * 0.10 : 0.03;
    rig.smileLip.visible = true;
    rig.oMouth.visible = true;
    rig.oMouth.scale.set(1.18, 0.58, 1);
    rig.oMouth.position.y = -0.003 * s;
    rig.smileLip.scale.set(1.2, 1.2, 1);
  } else {
    rig.smileLip.visible = true;
    rig.oMouth.visible = false;
    rig.smileLip.scale.set(1.0, 0.9, 1);
  }

  rig.headGroup.rotation.z += (headTiltZ - rig.headGroup.rotation.z) * 0.16;
  rig.headGroup.rotation.x += (headNodX - rig.headGroup.rotation.x) * 0.16;

  rig.eyes.forEach(({ upperLid }) => {
    let targetLid = -1.05;
    if (blinkAmt > 0.1) targetLid = -0.05;
    else if (expr === 'happy' || expr === 'forgive' || expr === 'cheering') targetLid = -0.62;
    else if (expr === 'huh' || expr === 'surprised') targetLid = -1.22;
    upperLid.rotation.x += (targetLid - upperLid.rotation.x) * 0.25;
  });

  rig.brows.forEach(({ mesh, sx }) => {
    let by = 0.042 * s;
    let rotZ = Math.PI / 2 - sx * 0.07;
    if (expr === 'huh') {
      by = (sx > 0 ? 0.058 : 0.046) * s;
      rotZ = Math.PI / 2 + sx * 0.22;
    } else if (expr === 'happy' || expr === 'forgive' || expr === 'proud') {
      by = 0.049 * s;
      rotZ = Math.PI / 2 - sx * 0.14;
    } else if (expr === 'surprised') {
      by = 0.060 * s;
    }
    mesh.position.y += (by - mesh.position.y) * 0.2;
    mesh.rotation.z += (rotZ - mesh.rotation.z) * 0.2;
  });
}

export function createWorkerCapMesh(colorHex = 0x1d628c, stripeHex = 0xfacc15, scale = 1.0) {
  const cap = new THREE.Group();
  const clothMat = createClothMaterial(colorHex, 0.72);
  const reflMat = new THREE.MeshStandardMaterial({
    color: stripeHex,
    roughness: 0.22,
    metalness: 0.68,
  });

  // Tailored 6-panel canvas work cap crown
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.136 * scale, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.52),
    clothMat
  );
  dome.scale.set(0.98, 0.92, 1.05);
  dome.castShadow = true;
  cap.add(dome);

  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(0.136 * scale, 0.137 * scale, 0.020 * scale, 20, 1, true),
    reflMat
  );
  band.scale.set(0.99, 1.0, 1.06);
  band.position.y = 0.012 * scale;
  cap.add(band);

  // Curved stitched canvas visor brim
  const brim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.142 * scale, 0.142 * scale, 0.010 * scale, 20, 1, false, -0.78, 1.56),
    clothMat
  );
  brim.position.set(0, 0.008 * scale, 0.065 * scale);
  brim.rotation.x = 0.12;
  brim.castShadow = true;
  cap.add(brim);

  return cap;
}

export function createSafetyVestMesh(colorHex = 0x84cc16, scale = 1.0) {
  const vest = new THREE.Group();
  const vestMat = createClothMaterial(colorHex, 0.58);
  const silverTapeMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.88,
    roughness: 0.16,
  });

  // Tailored V-neck open-front safety vest matching sculpted human torso!
  const vestGeo = createSculptedTorsoGeo(0.30 * scale, 0.142 * scale, 0.128 * scale, 0.136 * scale, 0.142 * scale);
  const body = new THREE.Mesh(vestGeo, vestMat);
  body.position.y = -0.15 * scale;
  body.castShadow = true;
  vest.add(body);

  // Retroreflective silver safety bands
  [-0.07 * scale, 0.02 * scale].forEach((sy) => {
    const hBand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.138 * scale, 0.142 * scale, 0.024 * scale, 20, 1, true),
      silverTapeMat
    );
    hBand.scale.set(1.09, 1.0, 0.76);
    hBand.position.y = sy;
    vest.add(hBand);
  });

  return vest;
}

function buildArticulatedArm(sx, shoulderY, upperLen, foreLen, sleeveMat, skinMat, gloveMat) {
  const armPivot = new THREE.Group();
  armPivot.position.set(sx * 0.135, shoulderY, 0);

  // Seamless shoulder deltoid cap so raised/cheering arms never show a gap!
  const deltoid = new THREE.Mesh(new THREE.SphereGeometry(0.042, 12, 10), sleeveMat);
  armPivot.add(deltoid);

  const upper = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.033, upperLen, 6, 10),
    sleeveMat
  );
  upper.position.y = -upperLen * 0.5;
  upper.castShadow = true;
  armPivot.add(upper);

  const elbow = new THREE.Group();
  elbow.position.y = -upperLen - 0.015;
  elbow.rotation.x = -0.28; // natural slight human elbow bend!
  const fore = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.029, foreLen, 6, 10),
    sleeveMat
  );
  fore.position.y = -foreLen * 0.5;
  fore.castShadow = true;
  elbow.add(fore);

  const hand = new THREE.Mesh(new THREE.SphereGeometry(0.032, 12, 10), skinMat);
  hand.scale.set(0.85, 1.15, 0.65);
  hand.position.y = -foreLen - 0.02;
  elbow.add(hand);

  let glove = null;
  if (gloveMat) {
    glove = new THREE.Mesh(new THREE.SphereGeometry(0.037, 12, 10), gloveMat);
    glove.scale.set(0.9, 1.18, 0.72);
    glove.position.y = -foreLen - 0.02;
    elbow.add(glove);
  }

  armPivot.add(elbow);
  return { armPivot, elbow, sx, glove };
}

export class GirlCharacter {
  constructor(gloveTex) {
    this.group = new THREE.Group();
    this.expression = 'happy';
    this.exprTimer = 0;
    this.nextExpr = 'happy';
    this.blinkTimer = 2.5;
    this.blinkDur = 0;
    this.time = 0;

    this.hasCap = false;
    this.hasVest = false;
    this.capColor = 0x165b88;
    this.vestColor = 0x84cc16;

    this.rig = buildExpressiveHead(0.96, 0x241914, true);
    this.rig.headGroup.position.y = 0.95;
    this.group.add(this.rig.headGroup);

    // Natural twin low ponytails behind ears
    [-1, 1].forEach((sx) => {
      const tail = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.028, 0.085, 6, 10),
        this.rig.hairMat
      );
      tail.position.set(sx * 0.115, -0.045, -0.055);
      tail.rotation.z = sx * 0.35;
      tail.rotation.x = 0.25;
      tail.castShadow = true;
      this.rig.headGroup.add(tail);

      const tie = new THREE.Mesh(
        new THREE.TorusGeometry(0.020, 0.006, 6, 12),
        createClothMaterial(0xe11d48, 0.5)
      );
      tie.position.set(sx * 0.102, -0.008, -0.048);
      tie.rotation.y = Math.PI / 2;
      this.rig.headGroup.add(tie);
    });

    const neck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.034, 0.040, 0.075, 12),
      this.rig.skinMat
    );
    neck.position.y = 0.81;
    this.group.add(neck);

    // Warm Cream Ribbed Knit Sweater + Soft Collar + Pleated Denim Skirt
    const sweaterMat = createClothMaterial(0xf5efe6, 0.84);
    const torsoGeo = createSculptedTorsoGeo(0.31, 0.125, 0.112, 0.120, 0.128);
    const torso = new THREE.Mesh(torsoGeo, sweaterMat);
    torso.position.y = 0.49;
    torso.castShadow = true;
    torso.receiveShadow = true;
    this.group.add(torso);

    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(0.046, 0.012, 8, 18),
      sweaterMat
    );
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 0.79;
    this.group.add(collar);

    const denimMat = createClothMaterial(0x36587d, 0.82);
    const skirtGeo = createSculptedTorsoGeo(0.22, 0.168, 0.145, 0.130, 0.124);
    const skirt = new THREE.Mesh(skirtGeo, denimMat);
    skirt.position.y = 0.31;
    skirt.castShadow = true;
    skirt.receiveShadow = true;
    this.group.add(skirt);

    // Tights & Realistic Matte Rubber Rainboots with Sole Tread
    const tightsMat = createClothMaterial(0x334155, 0.85);
    const bootMat = new THREE.MeshPhysicalMaterial({
      color: 0xd99b26,
      roughness: 0.32,
      clearcoat: 0.45,
    });
    const soleMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.85 });

    [-0.058, 0.058].forEach((lx) => {
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.031, 0.22, 6, 10), tightsMat);
      leg.position.set(lx, 0.21, 0);
      leg.castShadow = true;
      this.group.add(leg);

      const bootShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.039, 0.036, 0.11, 14), bootMat);
      bootShaft.position.set(lx, 0.075, 0);
      bootShaft.castShadow = true;
      this.group.add(bootShaft);

      const bootFoot = new THREE.Mesh(new THREE.CapsuleGeometry(0.036, 0.065, 6, 12), bootMat);
      bootFoot.rotation.x = Math.PI / 2;
      bootFoot.position.set(lx, 0.036, 0.026);
      bootFoot.castShadow = true;
      this.group.add(bootFoot);

      const sole = new THREE.Mesh(new THREE.BoxGeometry(0.074, 0.016, 0.135), soleMat);
      sole.position.set(lx, 0.008, 0.025);
      this.group.add(sole);
    });

    const gloveMat = new THREE.MeshStandardMaterial({ map: gloveTex, roughness: 0.78 });
    this.arms = [-1, 1].map((sx) => {
      const arm = buildArticulatedArm(sx, 0.75, 0.11, 0.10, sweaterMat, this.rig.skinMat, gloveMat);
      arm.glove.visible = false;
      arm.armPivot.rotation.z = sx * 0.22;
      this.group.add(arm.armPivot);
      return arm;
    });

    this.capMount = new THREE.Group();
    this.capMount.position.set(0, 0.062, -0.005);
    this.rig.headGroup.add(this.capMount);

    this.vestMount = new THREE.Group();
    this.vestMount.position.set(0, 0.64, 0);
    this.group.add(this.vestMount);

    this.bodyHit = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.28, 1.18, 10),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    this.bodyHit.position.y = 0.58;
    this.bodyHit.userData = { interactType: 'girlTarget' };
    this.group.add(this.bodyHit);
  }

  equipCap(colorHex, stripeHex, tiltZ = 0) {
    while (this.capMount.children.length) this.capMount.remove(this.capMount.children[0]);
    const cap = createWorkerCapMesh(colorHex, stripeHex, 1.0);
    cap.rotation.z = Math.max(-0.20, Math.min(0.20, tiltZ));
    cap.rotation.x = -0.14; // tilted slightly back so face & eyes stay brightly lit!
    this.capMount.add(cap);
    this.hasCap = true;
    this.capColor = colorHex;
    this.triggerExpression('proud', 1.5);
  }

  equipVest(colorHex) {
    while (this.vestMount.children.length) this.vestMount.remove(this.vestMount.children[0]);
    const vest = createSafetyVestMesh(colorHex, 1.0);
    this.vestMount.add(vest);
    this.hasVest = true;
    this.vestColor = colorHex;
    this.arms.forEach((a) => {
      a.glove.visible = true;
    });
    this.triggerExpression('proud', 1.5);
  }

  triggerExpression(expr, duration = 1.4, followUp = 'happy') {
    this.expression = expr;
    this.exprTimer = duration;
    this.nextExpr = followUp;
  }

  lookAtWorld(targetWorld) {
    if (!targetWorld) return;
    const headWorld = new THREE.Vector3();
    this.rig.headGroup.getWorldPosition(headWorld);
    const dir = new THREE.Vector3().subVectors(targetWorld, headWorld).normalize();
    const localDir = dir.clone().applyQuaternion(this.group.quaternion.clone().invert());
    const yaw = Math.max(-0.42, Math.min(0.42, Math.atan2(localDir.x, localDir.z)));
    this.rig.headGroup.rotation.y += (yaw - this.rig.headGroup.rotation.y) * 0.14;
  }

  update(dt) {
    this.time += dt;
    if (this.exprTimer > 0) {
      this.exprTimer -= dt;
      if (this.exprTimer <= 0) this.expression = this.nextExpr;
    }

    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blinkTimer = 2.6 + Math.random() * 2.8;
      this.blinkDur = 0.13;
    }
    if (this.blinkDur > 0) this.blinkDur -= dt;

    applyExpressionToRig(this.rig, this.expression, this.blinkDur > 0 ? 1 : 0, this.time);

    const bounce =
      this.expression === 'proud' || this.expression === 'cheering'
        ? Math.abs(Math.sin(this.time * 8.5)) * 0.04
        : Math.sin(this.time * 2.2) * 0.005;
    this.rig.headGroup.position.y = 0.95 + bounce * 0.35;

    this.arms.forEach(({ armPivot, sx }) => {
      let targetZ = sx * 0.22;
      let targetX = -0.12;
      if (this.expression === 'proud' || this.expression === 'cheering') {
        targetZ = sx * 2.25 + Math.sin(this.time * 10 + sx) * 0.20;
        targetX = -0.22;
      } else if (this.expression === 'huh') {
        targetZ = sx > 0 ? 1.45 : -0.28;
        targetX = sx > 0 ? -0.78 : -0.1;
      } else if (this.expression === 'forgive') {
        targetZ = sx * 0.78;
        targetX = -0.5 + Math.sin(this.time * 11) * 0.18;
      } else if (this.expression === 'surprised') {
        targetZ = sx * 1.05;
        targetX = -0.95;
      }
      armPivot.rotation.z += (targetZ - armPivot.rotation.z) * Math.min(1, dt * 8.0);
      armPivot.rotation.x += (targetX - armPivot.rotation.x) * Math.min(1, dt * 8.0);
    });
  }
}

export class PlayerGlovedHand {
  constructor(gloveTex) {
    this.group = new THREE.Group();
    this.group.visible = false;

    const gloveMat = new THREE.MeshStandardMaterial({
      map: gloveTex,
      roughness: 0.74,
      metalness: 0.02,
    });
    this.cuffMat = createClothMaterial(0x84cc16, 0.68);

    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.064, 16, 14), gloveMat);
    palm.scale.set(1.04, 0.58, 1.16);
    palm.castShadow = true;
    this.group.add(palm);

    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.058, 0.06, 16), this.cuffMat);
    cuff.rotation.x = Math.PI / 2;
    cuff.position.set(0, 0.004, 0.09);
    this.group.add(cuff);

    const sleeve = new THREE.Mesh(
      new THREE.CylinderGeometry(0.054, 0.068, 0.25, 14),
      createClothMaterial(0xf5efe6, 0.82)
    );
    sleeve.rotation.x = Math.PI / 2 - 0.16;
    sleeve.position.set(0, -0.018, 0.22);
    this.group.add(sleeve);

    this.fingers = [];
    for (let i = 0; i < 4; i++) {
      const fp = new THREE.Group();
      fp.position.set((i - 1.5) * 0.029, 0.0, -0.055);
      const seg = new THREE.Mesh(new THREE.CapsuleGeometry(0.0145, 0.048, 6, 8), gloveMat);
      seg.rotation.x = Math.PI / 2;
      seg.position.z = -0.03;
      seg.castShadow = true;
      fp.add(seg);
      this.group.add(fp);
      this.fingers.push(fp);
    }

    this.thumbPivot = new THREE.Group();
    this.thumbPivot.position.set(-0.058, -0.008, -0.012);
    const thumbSeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.0165, 0.042, 6, 8), gloveMat);
    thumbSeg.rotation.z = 0.55;
    thumbSeg.rotation.x = Math.PI / 2;
    thumbSeg.position.set(-0.018, 0, -0.022);
    thumbSeg.castShadow = true;
    this.thumbPivot.add(thumbSeg);
    this.group.add(this.thumbPivot);

    this.pinchAmount = 0;
    this.targetPos = new THREE.Vector3();
    this.enabledAfterDress = false;
  }

  setCuffColor(hex) {
    this.cuffMat.color.setHex(hex);
  }

  setTarget(worldPos, isPinching, visible = true) {
    if (!this.enabledAfterDress) {
      this.group.visible = false;
      return;
    }
    this.group.visible = visible;
    if (worldPos) this.targetPos.copy(worldPos);
    this.pinchAmount = isPinching ? 1.0 : 0.15;
  }

  update(dt) {
    if (!this.group.visible) return;
    this.group.position.lerp(this.targetPos, Math.min(1, dt * 22.0));

    const curl = -this.pinchAmount * 0.88;
    this.fingers.forEach((f, idx) => {
      const targetX = curl * (0.9 + idx * 0.06);
      f.rotation.x += (targetX - f.rotation.x) * Math.min(1, dt * 16.0);
    });
    const thumbCurl = this.pinchAmount * 0.65;
    this.thumbPivot.rotation.y += (-thumbCurl - this.thumbPivot.rotation.y) * Math.min(1, dt * 16.0);
  }
}

export class DadWorker {
  constructor(gloveTex) {
    this.group = new THREE.Group();
    this.expression = 'happy';
    this.exprTimer = 0;
    this.nextExpr = 'happy';
    this.time = 0;
    this.state = 'standing';
    this.slipTimer = 0;

    this.rig = buildExpressiveHead(1.12, 0x1e1a17, false);
    this.rig.headGroup.position.y = 1.52;
    this.group.add(this.rig.headGroup);

    const dadCap = createWorkerCapMesh(0x165b88, 0xfacc15, 1.14);
    dadCap.position.set(0, 0.072, -0.005);
    dadCap.rotation.x = -0.14;
    this.rig.headGroup.add(dadCap);

    this.giftMount = new THREE.Group();
    this.giftMount.position.set(0.11, 0.11, 0.09);
    this.rig.headGroup.add(this.giftMount);

    const neck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.048, 0.056, 0.10, 12),
      this.rig.skinMat
    );
    neck.position.y = 1.36;
    this.group.add(neck);

    // Realistic Municipal Work Jacket, Pelvis/Hip Block & Work Belt (eliminates waist-to-leg joint gap!)
    const suitMat = createClothMaterial(0x1e4b68, 0.76);
    const torsoGeo = createSculptedTorsoGeo(0.56, 0.178, 0.168, 0.188, 0.205);
    const torso = new THREE.Mesh(torsoGeo, suitMat);
    torso.position.y = 0.78;
    torso.castShadow = true;
    torso.receiveShadow = true;
    this.group.add(torso);

    const pelvis = new THREE.Mesh(
      new THREE.SphereGeometry(0.178, 18, 12),
      suitMat
    );
    pelvis.scale.set(1.04, 0.62, 0.74);
    pelvis.position.y = 0.77;
    pelvis.castShadow = true;
    this.group.add(pelvis);

    const belt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.176, 0.178, 0.042, 20),
      new THREE.MeshStandardMaterial({ color: 0x181b20, roughness: 0.45 })
    );
    belt.scale.set(1.09, 1.0, 0.75);
    belt.position.y = 0.81;
    this.group.add(belt);

    const buckle = new THREE.Mesh(
      new THREE.BoxGeometry(0.052, 0.046, 0.02),
      new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.9, roughness: 0.2 })
    );
    buckle.position.set(0, 0.81, 0.134);
    this.group.add(buckle);

    const vest = createSafetyVestMesh(0x84cc16, 1.36);
    vest.position.y = 1.09;
    this.group.add(vest);

    this.legs = [];
    const bootMat = new THREE.MeshStandardMaterial({ color: 0x1e242b, roughness: 0.48 });
    [-0.095, 0.095].forEach((lx, idx) => {
      const legPivot = new THREE.Group();
      legPivot.position.set(lx, 0.78, 0);
      const trousers = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.064, 0.56, 6, 12),
        suitMat
      );
      trousers.position.y = -0.34;
      trousers.castShadow = true;
      legPivot.add(trousers);

      const boot = new THREE.Mesh(new THREE.CapsuleGeometry(0.056, 0.11, 6, 10), bootMat);
      boot.rotation.x = Math.PI / 2;
      boot.position.set(0, -0.72, 0.04);
      boot.castShadow = true;
      legPivot.add(boot);

      this.group.add(legPivot);
      this.legs.push({ legPivot, idx });
    });

    const gloveMat = new THREE.MeshStandardMaterial({ map: gloveTex, roughness: 0.75 });
    this.arms = [-1, 1].map((sx) => {
      const arm = buildArticulatedArm(sx, 1.28, 0.18, 0.16, suitMat, this.rig.skinMat, gloveMat);
      arm.armPivot.position.x = sx * 0.215;
      arm.armPivot.rotation.z = sx * 0.18;
      this.group.add(arm.armPivot);
      return arm;
    });

    this.carryMount = new THREE.Group();
    this.carryMount.position.set(0, 1.04, 0.26);
    this.carryMount.visible = false;
    const stackPreview = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.16, 0.22),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.75 })
    );
    stackPreview.castShadow = true;
    this.carryMount.add(stackPreview);
    this.group.add(this.carryMount);

    this.hitCollider = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.34, 1.65, 10),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    this.hitCollider.position.y = 0.85;
    this.hitCollider.userData = { interactType: 'giftReceiver', receiver: this };
    this.group.add(this.hitCollider);
  }

  triggerExpression(expr, duration = 1.4, followUp = 'happy') {
    this.expression = expr;
    this.exprTimer = duration;
    this.nextExpr = followUp;
  }

  receiveGift(giftMesh) {
    while (this.giftMount.children.length) this.giftMount.remove(this.giftMount.children[0]);
    giftMesh.position.set(0, 0, 0);
    giftMesh.scale.setScalar(0.85);
    this.giftMount.add(giftMesh);
    this.triggerExpression('cheering', 2.4);
  }

  startPaperBlunderRun() {
    this.state = 'trottingIn';
    this.slipTimer = 0;
    this.carryMount.visible = true;
    this.group.position.set(2.55, 0, 1.38);
    this.group.rotation.set(0, -1.25, 0);
    this.triggerExpression('happy', 1.2);
  }

  recoverFromSlip() {
    if (this.state === 'slipped') {
      this.state = 'standing';
      this.group.position.y = 0;
      this.group.rotation.x = 0;
      this.group.rotation.z = 0;
      this.legs.forEach(({ legPivot }) => {
        legPivot.rotation.x = 0;
      });
      this.triggerExpression('cheering', 2.5);
    }
  }

  update(dt) {
    this.time += dt;
    if (this.exprTimer > 0) {
      this.exprTimer -= dt;
      if (this.exprTimer <= 0) this.expression = this.nextExpr;
    }

    const blink = Math.sin(this.time * 1.9) > 0.985 ? 1 : 0;
    applyExpressionToRig(this.rig, this.expression, blink, this.time);

    if (this.state === 'trottingIn') {
      this.slipTimer += dt;
      this.group.position.x -= dt * 1.65;
      this.legs.forEach(({ legPivot, idx }) => {
        legPivot.rotation.x = Math.sin(this.time * 14 + idx * Math.PI) * 0.55;
      });
      this.arms.forEach(({ armPivot }) => {
        armPivot.rotation.x = -0.95;
        armPivot.rotation.z = 0;
      });
    } else if (this.state === 'slipped') {
      this.group.position.y += (-0.62 - this.group.position.y) * Math.min(1, dt * 9.0);
      this.group.rotation.x += (-0.26 - this.group.rotation.x) * Math.min(1, dt * 9.0);
      this.legs.forEach(({ legPivot, idx }) => {
        const targetLeg = -1.35 + Math.sin(this.time * 6 + idx) * 0.08;
        legPivot.rotation.x += (targetLeg - legPivot.rotation.x) * Math.min(1, dt * 10.0);
      });
      this.arms.forEach(({ armPivot, sx }) => {
        const targetZ = sx > 0 ? 2.15 + Math.sin(this.time * 7) * 0.18 : -0.45;
        const targetX = sx > 0 ? -0.52 : 0.32;
        armPivot.rotation.z += (targetZ - armPivot.rotation.z) * Math.min(1, dt * 8.0);
        armPivot.rotation.x += (targetX - armPivot.rotation.x) * Math.min(1, dt * 8.0);
      });
    } else {
      this.group.position.y += (0 - this.group.position.y) * Math.min(1, dt * 8.0);
      this.group.rotation.x += (0 - this.group.rotation.x) * Math.min(1, dt * 8.0);
      this.legs.forEach(({ legPivot }) => {
        legPivot.rotation.x *= 0.85;
      });

      this.arms.forEach(({ armPivot, sx }) => {
        let tz = sx * 0.18;
        let tx = -0.08;
        if (this.expression === 'huh') {
          tz = sx > 0 ? 1.55 : -0.24;
          tx = sx > 0 ? -0.85 : 0;
        } else if (this.expression === 'forgive') {
          tz = sx * 0.68;
          tx = -0.58 + Math.sin(this.time * 12) * 0.20;
        } else if (this.expression === 'cheering' || this.expression === 'proud') {
          tz = sx * 2.35 + Math.sin(this.time * 10 + sx) * 0.2;
          tx = -0.2;
        } else {
          tz = sx > 0 ? 0.35 + Math.sin(this.time * 2.5) * 0.07 : -0.18;
        }
        armPivot.rotation.z += (tz - armPivot.rotation.z) * Math.min(1, dt * 8.0);
        armPivot.rotation.x += (tx - armPivot.rotation.x) * Math.min(1, dt * 8.0);
      });
    }
  }
}

export class TownKid {
  constructor(shirtColor = 0x38bdf8, bootColor = 0xf43f5e, scale = 0.92) {
    this.group = new THREE.Group();
    this.time = Math.random() * 6.0;
    this.spinExcited = 0;

    this.rig = buildExpressiveHead(scale, 0x2b1d14, true);
    this.rig.headGroup.position.y = 0.90 * scale;
    this.group.add(this.rig.headGroup);

    const topMat = createClothMaterial(shirtColor, 0.78);
    const torsoGeo = createSculptedTorsoGeo(0.29 * scale, 0.12 * scale, 0.11 * scale, 0.115 * scale, 0.122 * scale);
    const torso = new THREE.Mesh(torsoGeo, topMat);
    torso.position.y = 0.46 * scale;
    torso.castShadow = true;
    this.group.add(torso);

    const shorts = new THREE.Mesh(
      createSculptedTorsoGeo(0.16 * scale, 0.13 * scale, 0.125 * scale, 0.12 * scale, 0.118 * scale),
      createClothMaterial(0x475569, 0.82)
    );
    shorts.position.y = 0.32 * scale;
    shorts.castShadow = true;
    this.group.add(shorts);

    this.legs = [];
    const bootMat = new THREE.MeshPhysicalMaterial({ color: bootColor, roughness: 0.28, clearcoat: 0.5 });
    [-0.055 * scale, 0.055 * scale].forEach((lx, idx) => {
      const lp = new THREE.Group();
      lp.position.set(lx, 0.30 * scale, 0);
      const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.026 * scale, 0.16 * scale, 6, 10), this.rig.skinMat);
      shin.position.y = -0.10 * scale;
      lp.add(shin);
      const boot = new THREE.Mesh(new THREE.CapsuleGeometry(0.034 * scale, 0.062 * scale, 6, 10), bootMat);
      boot.rotation.x = Math.PI / 2;
      boot.position.set(0, -0.23 * scale, 0.024 * scale);
      boot.castShadow = true;
      lp.add(boot);
      this.group.add(lp);
      this.legs.push({ lp, idx });
    });

    this.arms = [-1, 1].map((sx) => {
      const arm = buildArticulatedArm(sx, 0.68 * scale, 0.09 * scale, 0.09 * scale, topMat, this.rig.skinMat, null);
      arm.armPivot.position.x = sx * 0.13 * scale;
      this.group.add(arm.armPivot);
      return arm;
    });

    this.giftMount = new THREE.Group();
    this.giftMount.position.set(0.15 * scale, 0.55 * scale, 0.12 * scale);
    this.group.add(this.giftMount);

    const hit = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.28, 1.05, 8),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hit.position.y = 0.52;
    hit.userData = { interactType: 'giftReceiver', receiver: this };
    this.group.add(hit);

    this.homePos = new THREE.Vector3();
  }

  receiveGift(giftMesh) {
    while (this.giftMount.children.length) this.giftMount.remove(this.giftMount.children[0]);
    giftMesh.position.set(0, 0, 0);
    giftMesh.scale.setScalar(0.8);
    this.giftMount.add(giftMesh);
    this.excite(2.2);
  }

  excite(dur = 1.6) {
    this.spinExcited = Math.max(this.spinExcited, dur);
  }

  update(dt) {
    this.time += dt;
    applyExpressionToRig(this.rig, 'cheering', Math.sin(this.time * 2.3) > 0.985 ? 1 : 0, this.time);

    if (this.spinExcited > 0) {
      this.spinExcited -= dt;
      this.group.rotation.y += dt * 5.2;
      this.group.position.y = Math.abs(Math.sin(this.time * 10.5)) * 0.10;
    } else {
      this.group.position.x = this.homePos.x + Math.sin(this.time * 1.35) * 0.22;
      this.group.position.z = this.homePos.z + Math.cos(this.time * 1.05) * 0.13;
      this.group.position.y = Math.abs(Math.sin(this.time * 4.8)) * 0.04;
      const targetYaw = Math.sin(this.time * 1.1) * 0.45;
      this.group.rotation.y += (targetYaw - this.group.rotation.y) * Math.min(1, dt * 4.0);
    }

    this.legs.forEach(({ lp, idx }) => {
      lp.rotation.x = Math.sin(this.time * 5.0 + idx * Math.PI) * 0.26;
    });
    this.arms.forEach(({ armPivot, sx }) => {
      armPivot.rotation.z = sx * (0.82 + Math.sin(this.time * 5.2 + sx) * 0.32);
    });
  }
}
