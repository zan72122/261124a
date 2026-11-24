import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Procedural multi-ring iris texture for realistic natural human eyes (512x512 <= 1024px)
let _irisTex = null;
function getIrisTexture() {
  if (_irisTex) return _irisTex;
  const S = 256;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const ctx = c.getContext('2d');
  const half = S / 2;

  const g = ctx.createRadialGradient(half, half, 18, half, half, half);
  g.addColorStop(0, '#090605');
  g.addColorStop(0.34, '#0c0806');
  g.addColorStop(0.4, '#4e2e1b');
  g.addColorStop(0.75, '#3b2214');
  g.addColorStop(0.95, '#1c100a');
  g.addColorStop(1.0, '#120a06');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);

  // Subtle radial iris fibers
  ctx.strokeStyle = 'rgba(135, 88, 52, 0.22)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(half + Math.cos(a) * 44, half + Math.sin(a) * 44);
    ctx.lineTo(half + Math.cos(a) * 108, half + Math.sin(a) * 108);
    ctx.stroke();
  }

  _irisTex = new THREE.CanvasTexture(c);
  _irisTex.colorSpace = THREE.SRGBColorSpace;
  return _irisTex;
}

// ============================================================================
// 1. FIRST-PERSON LARGE CHILD'S HAND & FOREARM ("一人称の手元POVで部品をつかむ大きな手")
// Dorsal (top-down) anatomical right hand — knuckles & fingernails on top (+Y), fingers curl DOWN (-Y)!
// ============================================================================
export function createFirstPersonHand(mats) {
  const root = new THREE.Group();
  const wrist = new THREE.Group();
  root.add(wrist);

  // Dorsal sculpted hand body (wider across knuckles, tapered gently at wrist)
  const palmMain = new THREE.Mesh(
    new RoundedBoxGeometry(0.168, 0.048, 0.172, 5, 0.022),
    mats.childSkin
  );
  palmMain.position.set(0, 0, -0.068);
  palmMain.castShadow = true;
  palmMain.receiveShadow = true;
  wrist.add(palmMain);

  // Subtle dorsal knuckle swells & extensor tendon ridges across back of hand!
  [-0.058, -0.019, 0.02, 0.056].forEach((kx, idx) => {
    const knuckle = new THREE.Mesh(new THREE.SphereGeometry(0.021, 14, 10), mats.childSkin);
    knuckle.scale.set(1.0, 0.58, 1.15);
    knuckle.position.set(kx, 0.016, -0.142 + Math.abs(idx - 1.2) * 0.006);
    wrist.add(knuckle);

    const tendon = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.0065, 0.095, 6, 8),
      mats.childSkin
    );
    tendon.rotation.x = Math.PI * 0.5;
    tendon.rotation.y = kx * -0.35;
    tendon.position.set(kx * 0.85, 0.021, -0.085);
    wrist.add(tendon);
  });

  // Soft thumb web muscle on left side of right hand
  const thumbWeb = new THREE.Mesh(new THREE.SphereGeometry(0.046, 16, 12), mats.childSkin);
  thumbWeb.scale.set(1.1, 0.65, 1.35);
  thumbWeb.position.set(-0.068, -0.004, -0.062);
  wrist.add(thumbWeb);

  // Build realistic 3-segment child finger with dorsal knuckle crease & glossy fingernail on +Y!
  const buildFinger = (lenScale, radius, xPos, zPos, splayY = 0) => {
    const base = new THREE.Group();
    base.position.set(xPos, 0.004, zPos);
    base.rotation.y = splayY;

    const l1 = 0.064 * lenScale;
    const l2 = 0.045 * lenScale;
    const l3 = 0.036 * lenScale;

    const seg1 = new THREE.Mesh(
      new THREE.CapsuleGeometry(radius, l1 * 0.56, 8, 14),
      mats.childSkin
    );
    seg1.rotation.x = Math.PI * 0.5;
    seg1.position.z = -l1 * 0.5;
    seg1.castShadow = true;
    base.add(seg1);

    const mid = new THREE.Group();
    mid.position.z = -l1;
    base.add(mid);

    const seg2 = new THREE.Mesh(
      new THREE.CapsuleGeometry(radius * 0.89, l2 * 0.52, 8, 14),
      mats.childSkin
    );
    seg2.rotation.x = Math.PI * 0.5;
    seg2.position.z = -l2 * 0.5;
    seg2.castShadow = true;
    mid.add(seg2);

    const tip = new THREE.Group();
    tip.position.z = -l2;
    mid.add(tip);

    const seg3 = new THREE.Mesh(
      new THREE.CapsuleGeometry(radius * 0.8, l3 * 0.45, 8, 14),
      mats.childSkin
    );
    seg3.rotation.x = Math.PI * 0.5;
    seg3.position.z = -l3 * 0.48;
    seg3.castShadow = true;
    tip.add(seg3);

    // Subtle pink nail bed + glossy clearcoat fingernail on TOP (+Y) surface!
    const nail = new THREE.Mesh(
      new RoundedBoxGeometry(radius * 1.28, 0.005, l3 * 0.62, 2, 0.002),
      mats.fingernailMat
    );
    nail.position.set(0, radius * 0.72, -l3 * 0.54);
    nail.rotation.x = 0.08;
    tip.add(nail);

    return { base, mid, tip };
  };

  const fingers = {
    index: buildFinger(1.0, 0.02, -0.058, -0.146, 0.045),
    middle: buildFinger(1.08, 0.021, -0.019, -0.153, 0.01),
    ring: buildFinger(0.98, 0.0195, 0.02, -0.148, -0.028),
    pinky: buildFinger(0.8, 0.0175, 0.057, -0.136, -0.075),
  };
  Object.values(fingers).forEach((f) => wrist.add(f.base));

  // Right-hand Thumb on Left (-X) curving naturally inward & downward!
  const thumbRoot = new THREE.Group();
  thumbRoot.position.set(-0.078, -0.006, -0.058);
  thumbRoot.rotation.set(-0.18, 0.58, 0.35);
  const thumbFinger = buildFinger(0.86, 0.022, 0, 0, 0);
  thumbRoot.add(thumbFinger.base);
  wrist.add(thumbRoot);
  fingers.thumb = thumbFinger;

  // Forearm wrist + tailored work sleeve with realistic folded fabric cuff!
  const forearmSkin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.052, 0.06, 0.14, 18),
    mats.childSkin
  );
  forearmSkin.rotation.x = Math.PI * 0.5;
  forearmSkin.scale.set(1.12, 1.0, 0.82);
  forearmSkin.position.set(0, 0, 0.055);
  wrist.add(forearmSkin);

  const sleeveMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.074, 0.096, 0.44, 22),
    mats.outfitFabrics[0]
  );
  sleeveMesh.rotation.x = Math.PI * 0.5;
  sleeveMesh.scale.set(1.1, 1.0, 0.88);
  sleeveMesh.position.set(0.008, -0.002, 0.34);
  sleeveMesh.castShadow = true;
  wrist.add(sleeveMesh);

  const cuffMesh = new THREE.Mesh(
    new RoundedBoxGeometry(0.172, 0.052, 0.068, 4, 0.018),
    mats.outfitCuffs[0]
  );
  cuffMesh.position.set(0.004, 0, 0.105);
  cuffMesh.castShadow = true;
  wrist.add(cuffMesh);

  // Machined brass cuff snap button on top-outer wrist!
  const cuffSnap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.016, 0.016, 0.012, 16),
    mats.brushedBrass
  );
  cuffSnap.position.set(0.042, 0.028, 0.105);
  wrist.add(cuffSnap);

  // IMPORTANT: Negative X rotation curls -Z fingers DOWNWARD (-Y) toward workbench & parts!
  const setPose = (mode = 'idle', amount = 0, twistAngle = 0) => {
    wrist.rotation.z = twistAngle;
    const curl = (f, c1, c2, c3) => {
      f.base.rotation.x = -c1;
      f.mid.rotation.x = -c2;
      f.tip.rotation.x = -c3;
    };

    if (mode === 'poke') {
      // Index extended downward slightly to press big button; middle/ring/pinky tucked naturally!
      curl(fingers.index, 0.16 + amount * 0.22, 0.18, 0.1);
      curl(fingers.middle, 0.88, 0.98, 0.65);
      curl(fingers.ring, 0.96, 1.04, 0.72);
      curl(fingers.pinky, 1.02, 1.06, 0.76);
      thumbRoot.rotation.set(-0.28, 0.42, 0.45);
      curl(fingers.thumb, 0.32, 0.42, 0.25);
      wrist.rotation.x = -0.14 - amount * 0.1;
    } else if (mode === 'pinch') {
      const p = 0.42 + amount * 0.28;
      curl(fingers.index, p, p * 1.05, p * 0.65);
      curl(fingers.middle, p * 1.08, p * 1.05, p * 0.65);
      curl(fingers.ring, 0.88, 0.92, 0.65);
      curl(fingers.pinky, 0.95, 0.95, 0.7);
      thumbRoot.rotation.set(-0.34, 0.28, 0.55);
      curl(fingers.thumb, 0.28, 0.45, 0.32);
      wrist.rotation.x = -0.18;
    } else if (mode === 'grab') {
      const g = 0.28 + amount * 0.52;
      curl(fingers.index, g, g * 0.92, g * 0.58);
      curl(fingers.middle, g * 1.04, g * 0.95, g * 0.6);
      curl(fingers.ring, g * 1.06, g * 0.96, g * 0.62);
      curl(fingers.pinky, g * 1.08, g * 0.98, g * 0.64);
      thumbRoot.rotation.set(-0.28 - amount * 0.18, 0.36, 0.48);
      curl(fingers.thumb, 0.24 + amount * 0.3, 0.36, 0.22);
      wrist.rotation.x = -0.12;
    } else if (mode === 'rub') {
      curl(fingers.index, 0.14, 0.18, 0.1);
      curl(fingers.middle, 0.12, 0.16, 0.1);
      curl(fingers.ring, 0.15, 0.19, 0.12);
      curl(fingers.pinky, 0.18, 0.22, 0.14);
      thumbRoot.rotation.set(-0.18, 0.58, 0.32);
      curl(fingers.thumb, 0.14, 0.18, 0.1);
      wrist.rotation.x = -0.06;
    } else {
      // Natural relaxed downward curve over workbench!
      curl(fingers.index, 0.22, 0.28, 0.18);
      curl(fingers.middle, 0.26, 0.32, 0.2);
      curl(fingers.ring, 0.31, 0.36, 0.22);
      curl(fingers.pinky, 0.36, 0.4, 0.25);
      thumbRoot.rotation.set(-0.22, 0.54, 0.36);
      curl(fingers.thumb, 0.18, 0.24, 0.14);
      wrist.rotation.x = -0.08;
    }
  };
  setPose('idle', 0, 0);

  const setOutfit = (coatIdx = 0, hatIdx = 0) => {
    sleeveMesh.material = mats.outfitFabrics[coatIdx % 3];
    cuffMesh.material = mats.outfitCuffs[hatIdx % 3];
  };

  root.userData = { wrist, sleeveMesh, cuffMesh, setPose, setOutfit };
  return root;
}

// ============================================================================
// 2. THE 5-YEAR-OLD GIRL (Natural Grounded Sculpted Proportions, Clean Warm Skin!)
// ============================================================================
export function createGirlCharacter(mats) {
  const root = new THREE.Group();
  const irisTex = getIrisTexture();

  // Natural sloped shoulders & upper bust (Lathe + sculpted sleeves, NO boxy peg-doll look!)
  const torsoGroup = new THREE.Group();
  root.add(torsoGroup);

  const innerShirtMat = new THREE.MeshStandardMaterial({
    color: 0xc89648, // Warm ochre rib-knit sweater under overalls so clothing contrasts clearly from skin!
    normalMap: mats.outfitFabrics[2].normalMap,
    normalScale: new THREE.Vector2(0.9, 0.9),
    roughness: 0.86,
  });
  const shirtChest = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.115, 0.14, 10, 18),
    innerShirtMat
  );
  shirtChest.scale.set(1.28, 1.0, 0.82);
  shirtChest.position.y = -0.18;
  torsoGroup.add(shirtChest);

  const shirtCollar = new THREE.Mesh(
    new THREE.TorusGeometry(0.052, 0.014, 8, 18),
    innerShirtMat
  );
  shirtCollar.rotation.x = Math.PI * 0.5;
  shirtCollar.position.y = -0.095;
  torsoGroup.add(shirtCollar);

  // Natural sloped shoulders + upper arms angling down toward workbench
  [-1, 1].forEach((s) => {
    const shArm = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.048, 0.18, 8, 14),
      innerShirtMat
    );
    shArm.position.set(s * 0.155, -0.195, 0.01);
    shArm.rotation.z = s * 0.32;
    shArm.rotation.x = 0.18;
    shArm.castShadow = true;
    torsoGroup.add(shArm);
  });

  // Tailored Work Bib / Apron / Overalls over shirt
  const coatBody = new THREE.Mesh(
    new RoundedBoxGeometry(0.245, 0.22, 0.178, 5, 0.048),
    mats.outfitFabrics[0]
  );
  coatBody.position.set(0, -0.205, 0.008);
  coatBody.castShadow = true;
  torsoGroup.add(coatBody);

  [-0.068, 0.068].forEach((sx) => {
    const strap = new THREE.Mesh(
      new RoundedBoxGeometry(0.038, 0.145, 0.186, 3, 0.008),
      mats.outfitCuffs[0]
    );
    strap.position.set(sx, -0.125, 0.008);
    torsoGroup.add(strap);

    const buckle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, 0.01, 14),
      mats.brushedBrass
    );
    buckle.rotation.x = Math.PI * 0.5;
    buckle.position.set(sx, -0.142, 0.102);
    torsoGroup.add(buckle);
  });

  // Mini machined silver spanner wrench in bib pocket
  const pocketWrench = new THREE.Mesh(
    new RoundedBoxGeometry(0.02, 0.075, 0.01, 2, 0.004),
    mats.silverChrome
  );
  pocketWrench.position.set(0.032, -0.185, 0.102);
  pocketWrench.rotation.z = -0.22;
  torsoGroup.add(pocketWrench);

  // Neck + Collar
  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.042, 0.05, 0.09, 16),
    mats.childSkin
  );
  neck.position.y = -0.055;
  root.add(neck);

  // Expressive Head Group
  const head = new THREE.Group();
  head.position.y = 0.065;
  root.add(head);

  // Sculpted cranium + soft lower jaw/cheeks (smooth single continuous surface — zero protruding spheres!)
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.116, 32, 26), mats.childSkin);
  skull.scale.set(0.97, 1.04, 0.95);
  skull.castShadow = true;
  skull.receiveShadow = true;
  head.add(skull);

  // Ears
  [-0.108, 0.108].forEach((ex) => {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 10), mats.childSkin);
    ear.scale.set(0.55, 1.05, 0.75);
    ear.position.set(ex, 0.0, -0.005);
    head.add(ear);
  });

  // Soft natural nose bridge + tip
  const nose = new THREE.Mesh(new THREE.CapsuleGeometry(0.011, 0.016, 8, 10), mats.childSkin);
  nose.position.set(0, -0.004, 0.108);
  nose.rotation.x = -0.25;
  head.add(nose);

  // Natural Human Eyes (textured brown iris, dark pupil, wet clearcoat sclera, upper lash line, blinking skin lid)
  const eyeWhiteMat = new THREE.MeshPhysicalMaterial({
    color: 0xf4f0ea,
    roughness: 0.15,
    clearcoat: 0.9,
  });
  const irisMat = new THREE.MeshPhysicalMaterial({
    map: irisTex,
    roughness: 0.08,
    clearcoat: 1.0,
  });
  const lashMat = new THREE.MeshStandardMaterial({ color: 0x1c120d, roughness: 0.6 });
  const catchMat = new THREE.MeshBasicMaterial({ color: 0xfff5e0 });

  const eyes = [];
  const brows = [];
  [-0.041, 0.041].forEach((ex, idx) => {
    const eyeG = new THREE.Group();
    eyeG.position.set(ex, 0.015, 0.096);

    const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.0175, 16, 12), eyeWhiteMat);
    sclera.scale.set(1.12, 0.88, 0.6);

    const iris = new THREE.Mesh(new THREE.CircleGeometry(0.0115, 18), irisMat);
    iris.position.z = 0.0108;

    const glint = new THREE.Mesh(new THREE.CircleGeometry(0.0028, 8), catchMat);
    glint.position.set(0.0035, 0.0038, 0.0114);

    // Subtle upper lash arch
    const lash = new THREE.Mesh(
      new THREE.TorusGeometry(0.0175, 0.0022, 6, 14, Math.PI * 0.85),
      lashMat
    );
    lash.rotation.z = Math.PI * 0.075;
    lash.position.set(0, 0.002, 0.009);

    const lid = new THREE.Mesh(
      new THREE.SphereGeometry(0.0195, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.52),
      mats.childSkin
    );
    lid.scale.set(1.14, 0.92, 0.68);
    lid.rotation.x = -0.45;

    eyeG.add(sclera, iris, glint, lash, lid);
    head.add(eyeG);
    eyes.push({ eyeG, iris, lid });

    const brow = new THREE.Mesh(
      new RoundedBoxGeometry(0.032, 0.0055, 0.008, 2, 0.0025),
      mats.darkBrownHair
    );
    brow.position.set(ex, 0.041, 0.102);
    brow.rotation.z = (idx === 0 ? 1 : -1) * 0.05;
    head.add(brow);
    brows.push(brow);
  });

  // Soft natural lips & expressive mouth
  const mouthGroup = new THREE.Group();
  mouthGroup.position.set(0, -0.044, 0.1);
  head.add(mouthGroup);

  const lipMat = new THREE.MeshStandardMaterial({ color: 0xc47268, roughness: 0.45 });
  const smileArc = new THREE.Mesh(
    new THREE.TorusGeometry(0.019, 0.0042, 8, 16, Math.PI * 0.82),
    lipMat
  );
  smileArc.rotation.z = Math.PI * 1.09;
  smileArc.position.y = 0.007;
  mouthGroup.add(smileArc);

  const openMouth = new THREE.Mesh(
    new THREE.SphereGeometry(0.014, 14, 10),
    new THREE.MeshStandardMaterial({ color: 0x6b2826, roughness: 0.7 })
  );
  openMouth.scale.set(1.05, 0.8, 0.32);
  openMouth.visible = false;
  mouthGroup.add(openMouth);

  // FIXED HAIR: Tilted cleanly BACK (-0.65 rad on X) so face is 100% open & naturally lit!
  const hairBack = new THREE.Mesh(
    new THREE.SphereGeometry(0.123, 26, 20, 0, Math.PI * 2, 0, Math.PI * 0.68),
    mats.darkBrownHair
  );
  hairBack.rotation.x = -0.68;
  hairBack.position.set(0, 0.012, -0.008);
  hairBack.castShadow = true;
  head.add(hairBack);

  // Side bob hair framing temples & ears (behind cheek plane z = 0.025)
  [-0.102, 0.102].forEach((hx, idx) => {
    const sideLock = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.032, 0.115, 8, 12),
      mats.darkBrownHair
    );
    sideLock.position.set(hx, -0.022, 0.01);
    sideLock.rotation.z = (idx === 0 ? 1 : -1) * 0.1;
    sideLock.rotation.x = 0.08;
    head.add(sideLock);
  });

  // High soft forehead fringe ABOVE eyebrows (y = 0.078..0.095)
  for (let b = -2; b <= 2; b++) {
    const bang = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.018, 0.034, 6, 10),
      mats.darkBrownHair
    );
    bang.position.set(b * 0.023, 0.082, 0.092 - Math.abs(b) * 0.006);
    bang.rotation.z = b * -0.1;
    bang.rotation.x = -0.45;
    head.add(bang);
  }

  // 3 INTERCHANGEABLE ENGINEER HEADGEARS!
  const headgearSlot = new THREE.Group();
  headgearSlot.position.set(0, 0.088, 0.005);
  head.add(headgearSlot);

  // Headgear 0: Denim Mechanic Cap + Brushed Silver Workshop Goggles!
  const hg0 = new THREE.Group();
  const capDome = new THREE.Mesh(
    new THREE.SphereGeometry(0.124, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.46),
    mats.outfitFabrics[0]
  );
  capDome.rotation.x = -0.12;
  const capVisor = new THREE.Mesh(
    new RoundedBoxGeometry(0.165, 0.012, 0.085, 2, 0.004),
    mats.outfitCuffs[0]
  );
  capVisor.position.set(0, 0.008, 0.112);
  capVisor.rotation.x = 0.12;
  const goggleStrap = new THREE.Mesh(
    new THREE.TorusGeometry(0.121, 0.01, 8, 24),
    mats.darkSteel
  );
  goggleStrap.rotation.x = Math.PI * 0.5;
  goggleStrap.position.y = 0.024;
  [-0.042, 0.042].forEach((gx) => {
    const gCup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.032, 0.034, 0.025, 18),
      mats.silverChrome
    );
    gCup.rotation.x = Math.PI * 0.5;
    gCup.position.set(gx, 0.028, 0.118);
    const gGlass = new THREE.Mesh(new THREE.CircleGeometry(0.026, 16), mats.lensGlass);
    gGlass.position.set(gx, 0.028, 0.132);
    hg0.add(gCup, gGlass);
  });
  hg0.add(capDome, capVisor, goggleStrap);

  // Headgear 1: Copper-Rimmed Inventor Loupe Visor!
  const hg1 = new THREE.Group();
  const band1 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.125, 0.125, 0.032, 26, 1, true),
    mats.outfitCuffs[1]
  );
  const visorPlate = new THREE.Mesh(
    new RoundedBoxGeometry(0.195, 0.036, 0.068, 2, 0.008),
    mats.warmCopper
  );
  visorPlate.position.set(0, -0.004, 0.11);
  const loupe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.028, 0.032, 0.04, 18),
    mats.brushedBrass
  );
  loupe.rotation.x = Math.PI * 0.5;
  loupe.position.set(0.048, -0.014, 0.142);
  hg1.add(band1, visorPlate, loupe);

  // Headgear 2: Chrome Engineer Headlamp Band!
  const hg2 = new THREE.Group();
  const band2 = new THREE.Mesh(
    new THREE.TorusGeometry(0.123, 0.012, 10, 26),
    mats.outfitFabrics[2]
  );
  band2.rotation.x = Math.PI * 0.5;
  const lampMount = new THREE.Mesh(
    new RoundedBoxGeometry(0.072, 0.046, 0.038, 2, 0.008),
    mats.silverChrome
  );
  lampMount.position.set(0, 0.01, 0.12);
  const headBulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.018, 14, 10),
    new THREE.MeshStandardMaterial({
      color: 0xfff3d1,
      emissive: 0xffd57e,
      emissiveIntensity: 1.5,
    })
  );
  headBulb.position.set(0, 0.01, 0.142);
  hg2.add(band2, lampMount, headBulb);

  const headgears = [hg0, hg1, hg2];
  headgears.forEach((h, i) => {
    h.visible = i === 0;
    headgearSlot.add(h);
  });

  let currentExpr = 'curious';
  let exprTimer = 0;

  const setExpression = (expr, duration = 1.6) => {
    currentExpr = expr;
    exprTimer = duration;
  };

  const setOutfit = (coatIdx = 0, hatIdx = 0, visorTilt = 0) => {
    coatBody.material = mats.outfitFabrics[coatIdx % 3];
    headgears.forEach((h, idx) => {
      h.visible = idx === hatIdx % 3;
    });
    headgearSlot.rotation.x = visorTilt * 0.25;
  };

  const update = (dt, elapsed) => {
    if (exprTimer > 0) {
      exprTimer -= dt;
      if (exprTimer <= 0 && currentExpr !== 'dancing') {
        currentExpr = 'curious';
      }
    }

    const blinkCycle = elapsed % 3.9;
    const isBlinking = blinkCycle > 3.76;

    let targetHeadZ = Math.sin(elapsed * 1.4) * 0.035;
    let targetHeadX = Math.sin(elapsed * 0.9) * 0.025;
    let targetHeadY = Math.sin(elapsed * 0.7) * 0.05;

    if (currentExpr === 'huh') {
      targetHeadZ = 0.22;
      targetHeadX = -0.04;
      brows[0].position.y = 0.051;
      brows[0].rotation.z = 0.2;
      brows[1].position.y = 0.039;
      brows[1].rotation.z = 0.06;
      smileArc.visible = false;
      openMouth.visible = true;
      openMouth.scale.set(0.65, 0.85, 0.32);
    } else if (currentExpr === 'delighted' || currentExpr === 'dancing') {
      targetHeadZ = Math.sin(elapsed * 6.5) * 0.1;
      targetHeadX = -0.05 + Math.abs(Math.sin(elapsed * 6.5)) * 0.07;
      brows[0].position.y = 0.047;
      brows[0].rotation.z = 0.12;
      brows[1].position.y = 0.047;
      brows[1].rotation.z = -0.12;
      smileArc.visible = true;
      smileArc.scale.set(1.18, 1.22, 1);
      openMouth.visible = true;
      openMouth.scale.set(1.1, 0.88, 0.32);
      openMouth.position.y = -0.003;
    } else if (currentExpr === 'gasp') {
      targetHeadX = 0.06;
      brows[0].position.y = 0.053;
      brows[1].position.y = 0.053;
      smileArc.visible = false;
      openMouth.visible = true;
      openMouth.scale.set(0.9, 1.2, 0.32);
    } else if (currentExpr === 'focused') {
      targetHeadX = 0.08;
      targetHeadZ = -0.06;
      brows[0].position.y = 0.038;
      brows[0].rotation.z = -0.1;
      brows[1].position.y = 0.038;
      brows[1].rotation.z = 0.1;
      smileArc.visible = true;
      smileArc.scale.set(0.82, 0.72, 1);
      openMouth.visible = false;
    } else {
      brows[0].position.y = 0.041;
      brows[0].rotation.z = 0.05;
      brows[1].position.y = 0.041;
      brows[1].rotation.z = -0.05;
      smileArc.visible = true;
      smileArc.scale.set(1.0, 1.0, 1.0);
      openMouth.visible = false;
    }

    head.rotation.z += (targetHeadZ - head.rotation.z) * Math.min(1, dt * 8);
    head.rotation.x += (targetHeadX - head.rotation.x) * Math.min(1, dt * 8);
    head.rotation.y += (targetHeadY - head.rotation.y) * Math.min(1, dt * 6);

    eyes.forEach(({ lid }) => {
      const targetLid = isBlinking ? 0.95 : currentExpr === 'delighted' ? -0.22 : -0.45;
      lid.rotation.x += (targetLid - lid.rotation.x) * Math.min(1, dt * 22);
    });
  };

  root.userData = { head, torsoGroup, setExpression, setOutfit, update };
  return root;
}

// ============================================================================
// 3. POLISHED BRASS & STEEL TABLETOP MIRROR (Houses Girl's Live Reflection!)
// ============================================================================
export function createWorkshopMirror(mats, girlInstance) {
  const mirrorGroup = new THREE.Group();

  const standBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.145, 0.17, 0.024, 24),
    mats.screwHeadMetal
  );
  standBase.castShadow = true;
  standBase.receiveShadow = true;
  mirrorGroup.add(standBase);

  [-0.2, 0.2].forEach((px) => {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.017, 0.33, 12),
      mats.silverChrome
    );
    post.position.set(px, 0.165, 0);
    mirrorGroup.add(post);

    const knob = new THREE.Mesh(
      new THREE.CylinderGeometry(0.024, 0.024, 0.018, 16),
      mats.brushedBrass
    );
    knob.rotation.z = Math.PI * 0.5;
    knob.position.set(px * 1.08, 0.25, 0);
    mirrorGroup.add(knob);
  });

  const framePivot = new THREE.Group();
  framePivot.position.set(0, 0.255, 0);
  framePivot.rotation.x = 0.16;
  mirrorGroup.add(framePivot);

  const backingBox = new THREE.Mesh(
    new RoundedBoxGeometry(0.4, 0.43, 0.11, 3, 0.018),
    new THREE.MeshStandardMaterial({ color: 0x121620, roughness: 0.85 })
  );
  backingBox.position.z = -0.065;
  framePivot.add(backingBox);

  // Subtle miniature warm pendant reflection inside mirror + soft key light on girl's reflection!
  const mirrorFillLight = new THREE.PointLight(0xffdfb0, 0.65, 0.9, 1.5);
  mirrorFillLight.position.set(0.05, 0.12, 0.22);
  framePivot.add(mirrorFillLight);

  const reflectionAnchor = new THREE.Group();
  reflectionAnchor.position.set(0, -0.035, -0.03);
  reflectionAnchor.scale.set(-0.92, 0.92, 0.92);
  reflectionAnchor.add(girlInstance);
  framePivot.add(reflectionAnchor);

  const bezelThick = 0.032;
  const fW = 0.41;
  const fH = 0.44;
  const topBar = new THREE.Mesh(new RoundedBoxGeometry(fW, bezelThick, 0.038, 2, 0.008), mats.brushedBrass);
  topBar.position.y = fH * 0.5 - bezelThick * 0.5;
  const botBar = new THREE.Mesh(new RoundedBoxGeometry(fW, bezelThick, 0.038, 2, 0.008), mats.brushedBrass);
  botBar.position.y = -fH * 0.5 + bezelThick * 0.5;
  const leftBar = new THREE.Mesh(new RoundedBoxGeometry(bezelThick, fH, 0.038, 2, 0.008), mats.brushedBrass);
  leftBar.position.x = -fW * 0.5 + bezelThick * 0.5;
  const rightBar = new THREE.Mesh(new RoundedBoxGeometry(bezelThick, fH, 0.038, 2, 0.008), mats.brushedBrass);
  rightBar.position.x = fW * 0.5 - bezelThick * 0.5;
  framePivot.add(topBar, botBar, leftBar, rightBar);

  mirrorGroup.userData = { framePivot, reflectionAnchor };
  return mirrorGroup;
}

// ============================================================================
// 4. OUTFIT CARDS ON WORKBENCH FOR SCENE 0 DRESS-UP
// ============================================================================
export function createDressUpTray(mats) {
  const tray = new THREE.Group();

  const base = new THREE.Mesh(
    new RoundedBoxGeometry(1.36, 0.03, 0.64, 4, 0.012),
    mats.silverBrushed
  );
  base.receiveShadow = true;
  base.castShadow = true;
  tray.add(base);

  const items = [];
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * 0.42;

    const hatPad = new THREE.Group();
    hatPad.position.set(x, 0.034, -0.14);
    const disc1 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.15, 0.02, 24),
      mats.screwHeadMetal
    );
    disc1.receiveShadow = true;
    hatPad.add(disc1);

    if (i === 0) {
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(0.092, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.5),
        mats.outfitFabrics[0]
      );
      cap.position.y = 0.018;
      const gL = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.022, 16), mats.silverChrome);
      gL.rotation.x = Math.PI * 0.5;
      gL.position.set(-0.032, 0.042, 0.08);
      const gR = gL.clone();
      gR.position.x = 0.032;
      hatPad.add(cap, gL, gR);
    } else if (i === 1) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.084, 0.015, 10, 22), mats.warmCopper);
      band.rotation.x = Math.PI * 0.5;
      band.position.y = 0.036;
      const loupe = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.03, 0.038, 16), mats.brushedBrass);
      loupe.rotation.x = Math.PI * 0.5;
      loupe.position.set(0.032, 0.036, 0.09);
      hatPad.add(band, loupe);
    } else {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.084, 0.015, 10, 22), mats.outfitFabrics[2]);
      band.rotation.x = Math.PI * 0.5;
      band.position.y = 0.036;
      const lamp = new THREE.Mesh(new RoundedBoxGeometry(0.062, 0.042, 0.038, 2, 0.008), mats.silverChrome);
      lamp.position.set(0, 0.042, 0.086);
      hatPad.add(band, lamp);
    }
    hatPad.userData = { outfitKind: 'hat', index: i };
    tray.add(hatPad);
    items.push(hatPad);

    const coatPad = new THREE.Group();
    coatPad.position.set(x, 0.034, 0.155);
    const disc2 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.148, 0.158, 0.02, 24),
      mats.screwHeadMetal
    );
    disc2.receiveShadow = true;
    coatPad.add(disc2);

    const foldedCloth = new THREE.Mesh(
      new RoundedBoxGeometry(0.2, 0.052, 0.165, 3, 0.016),
      mats.outfitFabrics[i]
    );
    foldedCloth.position.y = 0.034;
    foldedCloth.castShadow = true;
    const cuffTrim = new THREE.Mesh(
      new RoundedBoxGeometry(0.205, 0.026, 0.046, 2, 0.008),
      mats.outfitCuffs[i]
    );
    cuffTrim.position.set(0, 0.054, 0.048);
    const snapBtn = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 0.014, 16),
      mats.brushedBrass
    );
    snapBtn.position.set(0, 0.068, 0.048);
    coatPad.add(foldedCloth, cuffTrim, snapBtn);
    coatPad.userData = { outfitKind: 'coat', index: i };
    tray.add(coatPad);
    items.push(coatPad);
  }

  tray.userData = { items };
  return tray;
}

// ============================================================================
// 5. WARM NATURAL DAD CHARACTER (Sculpted Knit Shoulders, Collar, Natural Hands & Face!)
// ============================================================================
export function createDadCharacter(mats) {
  const dad = new THREE.Group();
  const irisTex = getIrisTexture();

  const sweaterMat = new THREE.MeshStandardMaterial({
    color: 0x35414d,
    normalMap: mats.outfitFabrics[2].normalMap,
    normalScale: new THREE.Vector2(1.15, 1.15),
    roughness: 0.88,
  });

  // Natural sloped knit sweater torso + collar (NO boxy cube!)
  const chest = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.165, 0.24, 12, 20),
    sweaterMat
  );
  chest.scale.set(1.26, 1.0, 0.78);
  chest.position.y = -0.24;
  chest.castShadow = true;
  dad.add(chest);

  const collar = new THREE.Mesh(
    new THREE.TorusGeometry(0.072, 0.022, 8, 18),
    new THREE.MeshStandardMaterial({ color: 0xdad2c4, roughness: 0.85 })
  );
  collar.rotation.x = Math.PI * 0.52;
  collar.position.set(0, -0.065, 0.015);
  dad.add(collar);

  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.062, 0.1, 16),
    mats.dadSkin
  );
  neck.position.y = -0.02;
  dad.add(neck);

  // Sculpted Dad Head
  const head = new THREE.Group();
  head.position.y = 0.125;
  dad.add(head);

  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.135, 24, 20), mats.dadSkin);
  skull.scale.set(0.91, 1.08, 0.94);
  skull.castShadow = true;
  head.add(skull);

  // Ears & natural nose bridge
  [-0.122, 0.122].forEach((ex) => {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.024, 10, 8), mats.dadSkin);
    ear.scale.set(0.55, 1.1, 0.75);
    ear.position.set(ex, 0.005, -0.008);
    head.add(ear);
  });

  const nose = new THREE.Mesh(new THREE.CapsuleGeometry(0.014, 0.026, 8, 10), mats.dadSkin);
  nose.position.set(0, 0.002, 0.125);
  nose.rotation.x = -0.22;
  head.add(nose);

  // Dad's short parted hair (tilted back cleanly!)
  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.141, 22, 16, 0, Math.PI * 2, 0, Math.PI * 0.58),
    mats.darkBrownHair
  );
  hair.rotation.x = -0.52;
  hair.position.set(0, 0.022, -0.008);
  head.add(hair);

  // Warm thin brass eyeglasses
  const glasses = new THREE.Group();
  glasses.position.set(0, 0.022, 0.126);
  [-0.044, 0.044].forEach((gx) => {
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(0.03, 0.0038, 8, 20),
      mats.brushedBrass
    );
    rim.position.x = gx;
    glasses.add(rim);
  });
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.004, 0.004), mats.brushedBrass);
  glasses.add(bridge);
  head.add(glasses);

  const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf4f0ea, roughness: 0.2 });
  const irisMat = new THREE.MeshPhysicalMaterial({ map: irisTex, roughness: 0.1, clearcoat: 1.0 });
  const dadBrows = [];
  [-0.044, 0.044].forEach((ex) => {
    const sc = new THREE.Mesh(new THREE.SphereGeometry(0.015, 12, 10), eyeWhiteMat);
    sc.scale.set(1.1, 0.85, 0.55);
    sc.position.set(ex, 0.022, 0.116);
    const ir = new THREE.Mesh(new THREE.CircleGeometry(0.0095, 14), irisMat);
    ir.position.set(ex, 0.022, 0.125);
    head.add(sc, ir);

    const brow = new THREE.Mesh(
      new RoundedBoxGeometry(0.038, 0.0075, 0.01, 2, 0.003),
      mats.darkBrownHair
    );
    brow.position.set(ex, 0.058, 0.122);
    head.add(brow);
    dadBrows.push(brow);
  });

  const smile = new THREE.Mesh(
    new THREE.TorusGeometry(0.024, 0.0048, 8, 16, Math.PI * 0.82),
    new THREE.MeshStandardMaterial({ color: 0xa1584e, roughness: 0.5 })
  );
  smile.rotation.z = Math.PI * 1.09;
  smile.position.set(0, -0.042, 0.12);
  head.add(smile);

  const oMouth = new THREE.Mesh(
    new THREE.SphereGeometry(0.019, 14, 10),
    new THREE.MeshStandardMaterial({ color: 0x5c221f, roughness: 0.7 })
  );
  oMouth.scale.set(0.88, 1.1, 0.32);
  oMouth.position.set(0, -0.05, 0.122);
  oMouth.visible = false;
  head.add(oMouth);

  // Connected Shoulder-to-Forearm Knit Arms + Sculpted Hands with Thumbs!
  const buildDadArm = (side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.195, -0.105, 0.02);

    const upper = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.048, 0.18, 8, 12),
      sweaterMat
    );
    upper.position.set(side * 0.02, -0.09, 0.06);
    upper.rotation.x = 0.65;
    upper.rotation.z = side * 0.15;
    pivot.add(upper);

    const forearm = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.045, 0.16, 8, 12),
      sweaterMat
    );
    forearm.position.set(side * 0.01, -0.16, 0.2);
    forearm.rotation.x = 1.35;
    pivot.add(forearm);

    const hand = new THREE.Mesh(
      new RoundedBoxGeometry(0.072, 0.028, 0.085, 3, 0.012),
      mats.dadSkin
    );
    hand.position.set(side * 0.005, -0.182, 0.315);
    hand.castShadow = true;
    pivot.add(hand);

    // Sculpted fingers on Dad's hand so it looks like a real hand, not a block!
    for (let f = -1.5; f <= 1.5; f += 1.0) {
      const fg = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.0085, 0.032, 6, 8),
        mats.dadSkin
      );
      fg.rotation.x = Math.PI * 0.45;
      fg.position.set(side * 0.005 + f * 0.016, -0.186, 0.365);
      pivot.add(fg);
    }

    return pivot;
  };

  const armL = buildDadArm(-1);
  const armR = buildDadArm(1);
  dad.add(armL, armR);

  let state = 'warm';
  let stateTimer = 0;
  let queuedHappy = false;

  const triggerHuhThenHappy = () => {
    state = 'huh';
    stateTimer = 0.85;
    queuedHappy = true;
  };

  const setState = (s, dur = 2.0) => {
    state = s;
    stateTimer = dur;
    queuedHappy = false;
  };

  const update = (dt, elapsed) => {
    if (stateTimer > 0) {
      stateTimer -= dt;
      if (stateTimer <= 0) {
        if (queuedHappy) {
          queuedHappy = false;
          state = 'laugh';
          stateTimer = 1.6;
        } else if (state !== 'dance') {
          state = 'warm';
        }
      }
    }

    let hz = Math.sin(elapsed * 1.1) * 0.025;
    let hx = 0.08;
    let armLX = 0;
    let armRX = 0;
    let armLZ = 0.06;
    let armRZ = -0.06;

    if (state === 'huh') {
      hz = -0.26;
      hx = 0.02;
      glasses.rotation.z = -0.11;
      dadBrows[0].position.y = 0.072;
      dadBrows[1].position.y = 0.054;
      smile.visible = false;
      oMouth.visible = true;
      oMouth.scale.set(0.7, 0.88, 0.32);
      armLX = -0.22;
      armRX = -0.22;
    } else if (state === 'oops') {
      hz = Math.sin(elapsed * 16) * 0.045;
      hx = -0.04;
      glasses.rotation.z = 0.14;
      dadBrows[0].position.y = 0.076;
      dadBrows[1].position.y = 0.076;
      smile.visible = false;
      oMouth.visible = true;
      oMouth.scale.set(1.1, 1.3, 0.32);
      armLX = -0.78;
      armRX = -0.78;
      armLZ = -0.28;
      armRZ = 0.28;
    } else if (state === 'laugh' || state === 'dance') {
      const beat = Math.sin(elapsed * 8.5);
      hz = beat * 0.08;
      hx = 0.06 + Math.abs(beat) * 0.08;
      glasses.rotation.z = 0;
      dadBrows[0].position.y = 0.065;
      dadBrows[1].position.y = 0.065;
      smile.visible = true;
      smile.scale.set(1.2, 1.25, 1);
      oMouth.visible = true;
      oMouth.scale.set(1.0, 0.72, 0.32);
      armLX = -0.42;
      armRX = -0.42;
      armLZ = -0.18 - Math.abs(beat) * 0.22;
      armRZ = 0.18 + Math.abs(beat) * 0.22;
    } else {
      glasses.rotation.z *= 0.85;
      dadBrows[0].position.y = 0.058;
      dadBrows[1].position.y = 0.058;
      smile.visible = true;
      smile.scale.set(1, 1, 1);
      oMouth.visible = false;
    }

    head.rotation.z += (hz - head.rotation.z) * Math.min(1, dt * 8);
    head.rotation.x += (hx - head.rotation.x) * Math.min(1, dt * 8);
    armL.rotation.x += (armLX - armL.rotation.x) * Math.min(1, dt * 8);
    armR.rotation.x += (armRX - armR.rotation.x) * Math.min(1, dt * 8);
    armL.rotation.z += (armLZ - armL.rotation.z) * Math.min(1, dt * 8);
    armR.rotation.z += (armRZ - armR.rotation.z) * Math.min(1, dt * 8);
  };

  dad.userData = { head, armL, armR, triggerHuhThenHappy, setState, update };
  return dad;
}
