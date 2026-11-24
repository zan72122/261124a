// Realistic, Organic, Expressive 3D Human Characters + 3D Player Cabin-Crew Hand
// Pass 3 Upgraded: Smooth organic clavicle/shoulder/chest topology (zero peg-doll arm gaps!),
// tailored V-neck airline uniform blazer/vest with lapels, natural layered hair volumes,
// realistic almond eye proportions with subtle eyelid crease & warm gradient irises.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

function createSkinMaterial(hex = 0xf2c2a8) {
  return new THREE.MeshPhysicalMaterial({
    color: hex,
    roughness: 0.50,
    metalness: 0.0,
    sheen: 0.35,
    sheenRoughness: 0.62,
    sheenColor: new THREE.Color(0xff8e75),
    clearcoat: 0.08,
    clearcoatRoughness: 0.48
  });
}

function createHairMaterial(hex = 0x241813) {
  return new THREE.MeshPhysicalMaterial({
    color: hex,
    roughness: 0.38,
    metalness: 0.06,
    sheen: 0.52,
    sheenRoughness: 0.36,
    sheenColor: new THREE.Color(0x7d604f),
    clearcoat: 0.16,
    clearcoatRoughness: 0.30
  });
}

// Create a radial-gradient iris texture for realistic human eye depth!
let sharedIrisTextures = {};
function getIrisTexture(hexColor) {
  if (sharedIrisTextures[hexColor]) return sharedIrisTextures[hexColor];
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const base = new THREE.Color(hexColor);
  const dark = base.clone().multiplyScalar(0.35);
  const mid = base.clone().multiplyScalar(1.15);

  // Dark limbal ring -> rich iris fibers -> dark pupil center
  const rg = ctx.createRadialGradient(64, 64, 14, 64, 64, 62);
  rg.addColorStop(0.0, '#09090d');
  rg.addColorStop(0.34, '#0d0d12');
  rg.addColorStop(0.45, `#${mid.getHexString()}`);
  rg.addColorStop(0.82, `#${base.getHexString()}`);
  rg.addColorStop(1.0, `#${dark.getHexString()}`);
  ctx.fillStyle = rg;
  ctx.beginPath();
  ctx.arc(64, 64, 62, 0, Math.PI * 2);
  ctx.fill();

  // Subtle radial iris stroma fibers
  ctx.strokeStyle = 'rgba(255,220,185,0.16)';
  ctx.lineWidth = 1.5;
  for (let a = 0; a < Math.PI * 2; a += 0.22) {
    ctx.beginPath();
    ctx.moveTo(64 + Math.cos(a) * 22, 64 + Math.sin(a) * 22);
    ctx.lineTo(64 + Math.cos(a) * 54, 64 + Math.sin(a) * 54);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  sharedIrisTextures[hexColor] = tex;
  return tex;
}

// Sculpt an organic human upper torso with natural sloped shoulders (zero robotic box edges!)
function createOrganicTorsoGeometry(widthScale = 1.0, depthScale = 1.0) {
  const geo = new THREE.CylinderGeometry(0.135, 0.125, 0.38, 24, 10);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i); // -0.19 .. +0.19
    let z = pos.getZ(i);
    const t = (y + 0.19) / 0.38; // 0 bottom waist .. 1 top neck/clavicle

    // Natural human ribcage & shoulder width curve: wider at deltoid/chest (t~0.76), sloping smoothly inward to neck at t=1.0!
    let wProfile;
    if (t < 0.76) {
      wProfile = 0.88 + (t / 0.76) * 0.34;
    } else {
      const k = (t - 0.76) / 0.24;
      wProfile = 1.22 * (1.0 - k * k * 0.62);
    }
    const dProfile = t < 0.8 ? (0.72 + Math.sin(t * Math.PI) * 0.16) : (0.78 * (1.0 - (t - 0.8) * 1.4));

    x *= wProfile * widthScale;
    z *= Math.max(0.42, dProfile) * depthScale;
    // Slight natural chest forward contour
    if (z > 0) z += Math.sin(t * Math.PI) * 0.014;
    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return geo;
}

class ExpressiveHuman {
  constructor(opts) {
    this.role = opts.role;
    this.scaleFactor = opts.scale || 1.0;
    this.root = new THREE.Group();

    this.skinMat = createSkinMaterial(opts.skinHex || 0xf1c1a6);
    this.cheekMat = new THREE.MeshPhysicalMaterial({
      color: 0xe88278,
      roughness: 0.58,
      transparent: true,
      opacity: 0.26
    });
    this.hairMat = createHairMaterial(opts.hairHex || 0x261913);
    this.lipMat = new THREE.MeshPhysicalMaterial({
      color: opts.lipHex || 0xcf6e6a,
      roughness: 0.34,
      clearcoat: 0.30
    });

    this.expression = 'smile';
    this.exprTimer = 0;
    this.blinkTimer = 1.5 + Math.random() * 2.5;
    this.blinkPhase = 0;

    this._buildBody(opts);
    this._buildHead(opts);
    this.root.scale.setScalar(this.scaleFactor);
  }

  _buildBody(opts) {
    this.torsoPivot = new THREE.Group();
    this.torsoPivot.position.y = opts.seated ? 0.52 : 0.58;
    this.root.add(this.torsoPivot);

    const clothMat = new THREE.MeshPhysicalMaterial({
      color: opts.clothHex || 0x365588,
      map: opts.clothMap || null,
      normalMap: opts.fabricNormal || null,
      normalScale: new THREE.Vector2(0.45, 0.45),
      roughness: 0.80,
      sheen: 0.38,
      sheenRoughness: 0.6,
      sheenColor: new THREE.Color(0xffffff)
    });

    // Organic sculpted torso with sloped human shoulders!
    const torsoGeo = createOrganicTorsoGeometry(opts.role === 'dad' ? 1.12 : 0.98, 0.96);
    const torso = new THREE.Mesh(torsoGeo, clothMat);
    torso.position.y = 0.16;
    torso.castShadow = true;
    torso.receiveShadow = true;
    this.torsoPivot.add(torso);

    // Tailored Shirt Collar & Neckline
    const collarMat = new THREE.MeshStandardMaterial({
      color: opts.collarHex || 0xf8fafd,
      roughness: 0.62
    });
    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(0.056, 0.016, 10, 22),
      collarMat
    );
    collar.rotation.x = Math.PI / 2 + 0.16;
    collar.position.set(0, 0.345, 0.012);
    this.torsoPivot.add(collar);

    // Neck with subtle under-chin ambient shadow ring
    const neck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.043, 0.052, 0.105, 18),
      this.skinMat
    );
    neck.position.set(0, 0.39, 0.004);
    this.torsoPivot.add(neck);

    if (opts.seated) {
      const pantsMat = new THREE.MeshStandardMaterial({
        color: opts.pantsHex || 0x22314a,
        normalMap: opts.fabricNormal || null,
        normalScale: new THREE.Vector2(0.35, 0.35),
        roughness: 0.84
      });
      [-0.082, 0.082].forEach((lx) => {
        const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.056, 0.22, 6, 12), pantsMat);
        thigh.rotation.x = Math.PI / 2;
        thigh.position.set(lx, -0.05, 0.14);
        this.torsoPivot.add(thigh);
      });

      // Subtle cardigan/shirt placket detail on Dad & Grandma
      if (opts.role === 'dad') {
        const placket = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.28, 0.008), collarMat);
        placket.position.set(0, 0.18, 0.106);
        this.torsoPivot.add(placket);
      }
    } else {
      // Daughter's Tailored Airline Cabin-Crew Uniform!
      const navyUniformMat = new THREE.MeshPhysicalMaterial({
        map: opts.navyMap || null,
        normalMap: opts.fabricNormal || null,
        normalScale: new THREE.Vector2(0.55, 0.55),
        color: 0xffffff,
        roughness: 0.78,
        sheen: 0.48,
        sheenColor: new THREE.Color(0x4568ab)
      });

      // Tailored Navy Vest/Bodice sculpted organically to match torso + V-neck white blouse front!
      const vestGeo = createOrganicTorsoGeometry(1.01, 1.02);
      const vest = new THREE.Mesh(vestGeo, navyUniformMat);
      vest.scale.set(1.0, 0.84, 1.0);
      vest.position.y = 0.135;
      vest.castShadow = true;
      this.torsoPivot.add(vest);

      // Crisp White V-neck Blouse Bib flush at chest top
      const vBib = new THREE.Mesh(
        new THREE.PlaneGeometry(0.10, 0.12),
        collarMat
      );
      vBib.position.set(0, 0.285, 0.102);
      vBib.rotation.x = -0.18;
      this.torsoPivot.add(vBib);

      // Gold Wing Pin Badge on Left Chest + Gold Airline Vest Buttons!
      const goldMat = new THREE.MeshStandardMaterial({ color: 0xeac058, metalness: 0.90, roughness: 0.18 });
      const chestWing = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.008, 0.006), goldMat);
      chestWing.position.set(-0.052, 0.245, 0.108);
      chestWing.rotation.y = -0.22;
      this.torsoPivot.add(chestWing);

      [0.075, 0.135, 0.195].forEach((by) => {
        const btn = new THREE.Mesh(new THREE.SphereGeometry(0.0095, 10, 8), goldMat);
        btn.scale.set(1, 1, 0.55);
        btn.position.set(0, by, 0.114);
        this.torsoPivot.add(btn);
      });

      // A-line Navy Cabin Skirt
      const skirt = new THREE.Mesh(
        new THREE.CylinderGeometry(0.122, 0.175, 0.25, 22),
        navyUniformMat
      );
      skirt.position.set(0, -0.09, 0);
      skirt.castShadow = true;
      this.torsoPivot.add(skirt);

      // Standing legs & shoes
      const shoeMat = new THREE.MeshPhysicalMaterial({ color: 0x151e34, roughness: 0.20, clearcoat: 0.88 });
      [-0.064, 0.064].forEach((lx) => {
        const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.036, 0.29, 6, 12), this.skinMat);
        leg.position.set(lx, -0.34, 0);
        this.torsoPivot.add(leg);

        const shoe = new THREE.Mesh(new RoundedBoxGeometry(0.074, 0.048, 0.135, 3, 0.018), shoeMat);
        shoe.position.set(lx, -0.525, 0.024);
        this.torsoPivot.add(shoe);
      });
    }

    // Seamlessly Integrated Deltoid Shoulder Caps + Tapered Human Arms!
    this.arms = {};
    const shoulderX = opts.role === 'dad' ? 0.155 : 0.142;
    [-1, 1].forEach((side) => {
      const shoulder = new THREE.Group();
      // Nested inside the sloped deltoid cap so there is ZERO gap between torso and sleeve!
      shoulder.position.set(side * shoulderX, 0.275, 0.008);

      const sleeveMat = opts.isDaughter
        ? new THREE.MeshPhysicalMaterial({
            color: 0xf6f8fc,
            normalMap: opts.fabricNormal || null,
            normalScale: new THREE.Vector2(0.3, 0.3),
            roughness: 0.68,
            sheen: 0.3
          })
        : clothMat;

      // Rounded deltoid cap blending into upper arm
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.048, 12, 10), sleeveMat);
      cap.scale.set(0.95, 1.05, 0.92);
      shoulder.add(cap);

      const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.043, 0.036, 0.165, 14), sleeveMat);
      upper.position.y = -0.085;
      upper.castShadow = true;
      shoulder.add(upper);

      const elbow = new THREE.Group();
      elbow.position.y = -0.165;
      shoulder.add(elbow);

      const elbowJoint = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), sleeveMat);
      elbow.add(elbowJoint);

      const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.028, 0.15, 14), sleeveMat);
      fore.position.y = -0.075;
      elbow.add(fore);

      if (opts.isDaughter) {
        // Navy & gold cuff trim on Daughter's blouse wrists!
        const cuff = new THREE.Mesh(
          new THREE.CylinderGeometry(0.030, 0.030, 0.024, 14),
          new THREE.MeshStandardMaterial({ map: opts.navyMap, roughness: 0.75 })
        );
        cuff.position.y = -0.142;
        elbow.add(cuff);
      }

      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.032, 12, 10), this.skinMat);
      hand.scale.set(0.84, 1.16, 0.62);
      hand.position.y = -0.168;
      elbow.add(hand);

      shoulder.rotation.x = opts.seated ? -0.34 : -0.14;
      shoulder.rotation.z = side * -0.09;
      elbow.rotation.x = opts.seated ? -0.68 : -0.38;

      this.torsoPivot.add(shoulder);
      this.arms[side === -1 ? 'right' : 'left'] = { shoulder, elbow, hand };
    });
  }

  _buildHead(opts) {
    this.headPivot = new THREE.Group();
    this.headPivot.position.set(0, 0.455, 0.014);
    this.torsoPivot.add(this.headPivot);

    // Sculpted natural human head (cheekbones, subtle eye-socket hollow, soft jawline & chin)
    const headGeo = new THREE.SphereGeometry(0.114, 32, 26);
    const pos = headGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i);
      let y = pos.getY(i);
      let z = pos.getZ(i);
      if (y < 0) {
        const k = Math.min(1, -y / 0.114);
        // Cheekbone fullness around k=0.25, tapering smoothly to natural chin at k=1.0
        const jawTaper = k < 0.25 ? 1.02 : 1.02 - (k - 0.25) * 0.30;
        x *= jawTaper;
        z *= 1.0 - k * 0.12;
        if (z > 0) z += Math.sin(k * Math.PI) * 0.010;
      } else {
        y *= 1.07;
        x *= 0.97;
      }
      // Gentle eye-socket contour on front face around y ~ +0.015, |x| ~ 0.04
      if (z > 0.06 && Math.abs(y - 0.014) < 0.028 && Math.abs(Math.abs(x) - 0.040) < 0.028) {
        z -= 0.005;
      }
      pos.setXYZ(i, x, y, z);
    }
    headGeo.computeVertexNormals();

    const headMesh = new THREE.Mesh(headGeo, this.skinMat);
    headMesh.castShadow = true;
    headMesh.receiveShadow = true;
    this.headPivot.add(headMesh);

    // Ears
    [-0.107, 0.107].forEach((ex) => {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.024, 10, 10), this.skinMat);
      ear.scale.set(0.42, 0.92, 0.65);
      ear.position.set(ex, -0.004, -0.008);
      this.headPivot.add(ear);
    });

    // Sculpted Nose Bridge + Soft Tip
    const noseBridge = new THREE.Mesh(new THREE.CapsuleGeometry(0.0095, 0.022, 6, 10), this.skinMat);
    noseBridge.position.set(0, -0.003, 0.108);
    noseBridge.rotation.x = -0.26;
    this.headPivot.add(noseBridge);

    const noseTip = new THREE.Mesh(new THREE.SphereGeometry(0.0125, 12, 10), this.skinMat);
    noseTip.scale.set(1.06, 0.85, 0.95);
    noseTip.position.set(0, -0.015, 0.115);
    this.headPivot.add(noseTip);

    // Subtle Warm Cheek Blush
    this.cheeks = [];
    [-0.054, 0.054].forEach((cx) => {
      const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.024, 12, 10), this.cheekMat.clone());
      cheek.scale.set(1.18, 0.68, 0.30);
      cheek.position.set(cx, -0.022, 0.095);
      this.cheeks.push(cheek);
      this.headPivot.add(cheek);
    });

    // Realistic Almond-Proportioned Human Eyes with Gradient Iris Texture & Cornea Specular!
    this.eyes = [];
    const scleraMat = new THREE.MeshStandardMaterial({ color: 0xf7f9fc, roughness: 0.20 });
    const irisTex = getIrisTexture(opts.irisHex || 0x4a2e1d);
    const irisMat = new THREE.MeshStandardMaterial({ map: irisTex, roughness: 0.25 });
    const corneaMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.01,
      transparent: true,
      opacity: 0.16,
      clearcoat: 1.0,
      clearcoatRoughness: 0.01
    });
    const lashMat = new THREE.MeshStandardMaterial({ color: 0x1a1210, roughness: 0.55 });

    [-0.039, 0.039].forEach((ex, idx) => {
      const eyeGroup = new THREE.Group();
      eyeGroup.position.set(ex, 0.014, 0.094);
      // Natural almond horizontal proportion (not round toy circles!)
      eyeGroup.scale.set(1.05, 0.80, 0.90);

      const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.0185, 16, 14), scleraMat);
      sclera.scale.set(1.08, 0.94, 0.70);
      eyeGroup.add(sclera);

      const iris = new THREE.Mesh(new THREE.CircleGeometry(0.0108, 20), irisMat);
      iris.position.z = 0.0134;
      eyeGroup.add(iris);

      // Tiny crisp natural window catchlight
      const catchLight = new THREE.Mesh(
        new THREE.CircleGeometry(0.0024, 8),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      catchLight.position.set(-0.0034, 0.0036, 0.0142);
      eyeGroup.add(catchLight);

      const cornea = new THREE.Mesh(new THREE.SphereGeometry(0.0192, 14, 12), corneaMat);
      cornea.scale.set(1.08, 0.94, 0.75);
      eyeGroup.add(cornea);

      // Upper & Lower Sculpted Eyelids
      const upperLid = new THREE.Mesh(
        new THREE.SphereGeometry(0.0205, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.56),
        this.skinMat
      );
      upperLid.scale.set(1.10, 1.0, 0.82);
      upperLid.rotation.x = -1.08;
      eyeGroup.add(upperLid);

      const lowerLid = new THREE.Mesh(
        new THREE.SphereGeometry(0.0202, 16, 10, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5),
        this.skinMat
      );
      lowerLid.scale.set(1.08, 0.95, 0.80);
      lowerLid.rotation.x = 0.98;
      eyeGroup.add(lowerLid);

      // Delicate upper eyelash line
      const lash = new THREE.Mesh(
        new THREE.TorusGeometry(0.0176, 0.0019, 6, 16, Math.PI * 0.92),
        lashMat
      );
      lash.position.set(0, 0.0025, 0.010);
      lash.rotation.z = Math.PI * 0.04;
      eyeGroup.add(lash);

      // Natural tapered eyebrow
      const brow = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.0028, 0.024, 4, 8),
        this.hairMat
      );
      brow.rotation.z = Math.PI / 2 + (idx === 0 ? 0.05 : -0.05);
      brow.position.set(0, 0.028, 0.012);
      eyeGroup.add(brow);

      this.eyes.push({ eyeGroup, upperLid, lowerLid, brow, iris, side: idx === 0 ? -1 : 1 });
      this.headPivot.add(eyeGroup);
    });

    // Natural Sculpted Mouth
    this.mouthGroup = new THREE.Group();
    this.mouthGroup.position.set(0, -0.045, 0.100);
    this.headPivot.add(this.mouthGroup);

    this.smileArc = new THREE.Mesh(
      new THREE.TorusGeometry(0.019, 0.0036, 8, 18, Math.PI * 0.84),
      this.lipMat
    );
    this.smileArc.rotation.z = Math.PI * 1.08;
    this.smileArc.position.y = 0.010;
    this.mouthGroup.add(this.smileArc);

    this.openMouth = new THREE.Mesh(
      new THREE.SphereGeometry(0.0125, 14, 12),
      new THREE.MeshStandardMaterial({ color: 0x692226, roughness: 0.62 })
    );
    this.openMouth.scale.set(1.0, 0.82, 0.42);
    this.openMouth.visible = false;
    this.mouthGroup.add(this.openMouth);

    this._buildHairStyle(opts);
  }

  _buildHairStyle(opts) {
    const hg = new THREE.Group();
    this.headPivot.add(hg);

    // Sculpted cranial hair base tilted back so forehead, eyebrows & eyes are 100% open & bright!
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.119, 26, 20, 0, Math.PI * 2, 0, Math.PI * 0.56),
      this.hairMat
    );
    cap.position.set(0, 0.016, -0.012);
    cap.rotation.x = -0.44;
    hg.add(cap);

    if (opts.role === 'daughter') {
      // Natural tapered glossy bob tucked behind ears + high wispy side-swept bangs above eyebrows!
      [-1, 1].forEach((s) => {
        const lock = new THREE.Mesh(new THREE.CapsuleGeometry(0.028, 0.105, 8, 12), this.hairMat);
        lock.scale.set(0.72, 1.0, 1.05);
        lock.position.set(s * 0.098, -0.024, -0.006);
        lock.rotation.z = s * 0.10;
        hg.add(lock);
      });
      const backBob = new THREE.Mesh(new RoundedBoxGeometry(0.21, 0.155, 0.105, 4, 0.048), this.hairMat);
      backBob.position.set(0, -0.022, -0.062);
      hg.add(backBob);

      // Gentle airy bangs resting high on forehead (y > +0.052, well above eyebrows!)
      [-0.032, 0.004, 0.038].forEach((bx, bi) => {
        const wisp = new THREE.Mesh(new THREE.SphereGeometry(0.028, 12, 10), this.hairMat);
        wisp.scale.set(0.95, 0.65, 0.42);
        wisp.position.set(bx, 0.072 - bi * 0.003, 0.088);
        wisp.rotation.z = -0.22 + bi * 0.16;
        wisp.rotation.x = -0.32;
        hg.add(wisp);
      });
    } else if (opts.role === 'mom') {
      // Flowing shoulder-length side-parted chestnut waves framing temples & shoulders naturally!
      [-1, 1].forEach((s) => {
        const templeSweep = new THREE.Mesh(new THREE.SphereGeometry(0.042, 14, 10), this.hairMat);
        templeSweep.scale.set(0.85, 0.72, 0.55);
        templeSweep.position.set(s * 0.052, 0.074, 0.074);
        templeSweep.rotation.z = s * -0.38;
        hg.add(templeSweep);

        const wave = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.165, 8, 12), this.hairMat);
        wave.scale.set(0.72, 1.0, 1.15);
        wave.position.set(s * 0.100, -0.058, -0.024);
        wave.rotation.z = s * -0.08;
        hg.add(wave);

        const pearl = new THREE.Mesh(
          new THREE.SphereGeometry(0.008, 10, 10),
          new THREE.MeshPhysicalMaterial({ color: 0xfefcf6, roughness: 0.14, clearcoat: 1.0 })
        );
        pearl.position.set(s * 0.108, -0.026, 0.004);
        this.headPivot.add(pearl);
      });
      const backWave = new THREE.Mesh(new RoundedBoxGeometry(0.225, 0.22, 0.11, 4, 0.052), this.hairMat);
      backWave.position.set(0, -0.048, -0.068);
      hg.add(backWave);
    } else if (opts.role === 'dad') {
      // Clean side-parted men's short hair well above forehead & eyebrows!
      const sidePart = new THREE.Mesh(
        new THREE.SphereGeometry(0.118, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.36),
        this.hairMat
      );
      sidePart.scale.set(1.01, 1.05, 1.04);
      sidePart.position.set(0.004, 0.022, -0.002);
      sidePart.rotation.x = -0.14;
      sidePart.rotation.z = -0.08;
      hg.add(sidePart);

      [-1, 1].forEach((s) => {
        const temple = new THREE.Mesh(new THREE.CapsuleGeometry(0.013, 0.038, 4, 8), this.hairMat);
        temple.scale.set(0.42, 1.0, 0.85);
        temple.position.set(s * 0.104, 0.022, 0.012);
        hg.add(temple);
      });
    } else if (opts.role === 'grandma') {
      // Soft silver-champagne swept hairline high above glasses + warm low bun!
      const softSweep = new THREE.Mesh(
        new THREE.SphereGeometry(0.119, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.38),
        this.hairMat
      );
      softSweep.scale.set(1.03, 1.02, 1.03);
      softSweep.position.set(0, 0.022, -0.004);
      softSweep.rotation.x = -0.16;
      hg.add(softSweep);

      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.058, 16, 14), this.hairMat);
      bun.position.set(0, 0.055, -0.108);
      hg.add(bun);

      const goldMat = new THREE.MeshStandardMaterial({ color: 0xe2c472, metalness: 0.90, roughness: 0.18 });
      [-0.039, 0.039].forEach((gx) => {
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.023, 0.0018, 8, 22), goldMat);
        rim.scale.set(1.12, 0.88, 1);
        rim.position.set(gx, 0.014, 0.109);
        this.headPivot.add(rim);
      });
      const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.0016, 0.0016, 0.028, 6), goldMat);
      bridge.rotation.z = Math.PI / 2;
      bridge.position.set(0, 0.016, 0.110);
      this.headPivot.add(bridge);
    }
  }

  setExpression(expr, duration = 0) {
    this.expression = expr;
    this.exprTimer = duration;
  }

  update(dt, elapsed) {
    if (this.exprTimer > 0) {
      this.exprTimer -= dt;
      if (this.exprTimer <= 0 && this.expression !== 'sleep' && this.expression !== 'clap') {
        this.expression = 'smile';
      }
    }

    const breath = Math.sin(elapsed * 2.1 + (this.role.length * 1.3)) * 0.004;
    this.torsoPivot.scale.y = 1.0 + breath;

    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blinkPhase = 0.15;
      this.blinkTimer = 2.8 + Math.random() * 3.4;
    }
    if (this.blinkPhase > 0) this.blinkPhase = Math.max(0, this.blinkPhase - dt);
    const isBlinking = this.blinkPhase > 0;

    let targetUpperLid = isBlinking ? -0.04 : -1.08;
    let targetLowerLid = 0.98;
    let browLift = 0.028;
    let browTilt = 0.05;
    let headRoll = 0.0;
    let headNod = 0.0;
    let cheekAlpha = 0.25;

    this.smileArc.visible = true;
    this.openMouth.visible = false;
    this.smileArc.scale.set(1, 1, 1);

    if (this.expression === 'delighted' || this.expression === 'proud') {
      targetUpperLid = isBlinking ? -0.04 : -0.74;
      targetLowerLid = 0.64;
      browLift = 0.033;
      cheekAlpha = 0.45;
      this.smileArc.scale.set(1.22, 1.26, 1);
      headNod = Math.sin(elapsed * 8.0) * 0.045;
    } else if (this.expression === 'huh') {
      targetUpperLid = -1.24;
      browLift = 0.036;
      browTilt = -0.16;
      headRoll = 0.18;
      this.smileArc.visible = false;
      this.openMouth.visible = true;
      this.openMouth.scale.set(0.68, 0.78, 0.42);
    } else if (this.expression === 'oops') {
      targetUpperLid = -1.28;
      browLift = 0.040;
      browTilt = -0.20;
      this.smileArc.visible = false;
      this.openMouth.visible = true;
      this.openMouth.scale.set(1.02, 1.15, 0.42);
      headRoll = Math.sin(elapsed * 14.0) * 0.07;
    } else if (this.expression === 'sleepy') {
      targetUpperLid = -0.40;
      this.smileArc.visible = false;
      this.openMouth.visible = true;
      this.openMouth.scale.set(0.82, 0.95 + Math.sin(elapsed * 4.0) * 0.22, 0.42);
      headNod = 0.08;
    } else if (this.expression === 'sleep') {
      targetUpperLid = -0.03;
      targetLowerLid = 0.88;
      browLift = 0.025;
      headRoll = this.role === 'mom' ? -0.13 : 0.11;
      headNod = 0.10 + Math.sin(elapsed * 1.5) * 0.014;
      this.smileArc.scale.set(0.88, 0.74, 1);
      cheekAlpha = 0.38;
    } else if (this.expression === 'clap') {
      targetUpperLid = isBlinking ? -0.04 : -0.72;
      targetLowerLid = 0.62;
      cheekAlpha = 0.48;
      this.smileArc.scale.set(1.24, 1.30, 1);
      headNod = Math.sin(elapsed * 9.0) * 0.055;
    }

    const lerpK = Math.min(1, dt * 10.0);
    for (const e of this.eyes) {
      e.upperLid.rotation.x += (targetUpperLid - e.upperLid.rotation.x) * lerpK;
      e.lowerLid.rotation.x += (targetLowerLid - e.lowerLid.rotation.x) * lerpK;
      e.brow.position.y += (browLift - e.brow.position.y) * lerpK;
      const desiredRotZ = Math.PI / 2 + (e.side === -1 ? browTilt : -browTilt);
      e.brow.rotation.z += (desiredRotZ - e.brow.rotation.z) * lerpK;
    }
    for (const ch of this.cheeks) {
      ch.material.opacity += (cheekAlpha - ch.material.opacity) * lerpK;
    }

    this.headPivot.rotation.z += (headRoll - this.headPivot.rotation.z) * lerpK;
    this.headPivot.rotation.x += (headNod - this.headPivot.rotation.x) * lerpK;

    const rArm = this.arms.right;
    const lArm = this.arms.left;
    if (this.expression === 'oops' && this.role === 'dad') {
      rArm.shoulder.rotation.x += (-0.65 - rArm.shoulder.rotation.x) * lerpK;
      lArm.shoulder.rotation.x += (-0.65 - lArm.shoulder.rotation.x) * lerpK;
      rArm.shoulder.rotation.z += (-0.28 - rArm.shoulder.rotation.z) * lerpK;
      lArm.shoulder.rotation.z += (0.28 - lArm.shoulder.rotation.z) * lerpK;
      rArm.elbow.rotation.x += (-1.05 - rArm.elbow.rotation.x) * lerpK;
      lArm.elbow.rotation.x += (-1.05 - lArm.elbow.rotation.x) * lerpK;
    } else if (this.expression === 'clap') {
      const clapWave = Math.abs(Math.sin(elapsed * 11.5)) * 0.24;
      rArm.shoulder.rotation.x += (-0.58 - rArm.shoulder.rotation.x) * lerpK;
      lArm.shoulder.rotation.x += (-0.58 - lArm.shoulder.rotation.x) * lerpK;
      rArm.shoulder.rotation.z = 0.26 - clapWave;
      lArm.shoulder.rotation.z = -0.26 + clapWave;
      rArm.elbow.rotation.x += (-0.95 - rArm.elbow.rotation.x) * lerpK;
      lArm.elbow.rotation.x += (-0.95 - lArm.elbow.rotation.x) * lerpK;
    } else {
      const baseShX = this.role === 'daughter' ? -0.14 : -0.34;
      const baseElX = this.role === 'daughter' ? -0.38 : -0.68;
      rArm.shoulder.rotation.x += (baseShX - rArm.shoulder.rotation.x) * lerpK;
      lArm.shoulder.rotation.x += (baseShX - lArm.shoulder.rotation.x) * lerpK;
      rArm.shoulder.rotation.z += (-0.09 - rArm.shoulder.rotation.z) * lerpK;
      lArm.shoulder.rotation.z += (0.09 - lArm.shoulder.rotation.z) * lerpK;
      rArm.elbow.rotation.x += (baseElX - rArm.elbow.rotation.x) * lerpK;
      lArm.elbow.rotation.x += (baseElX - lArm.elbow.rotation.x) * lerpK;
    }
  }
}

export function createCrewHatMesh(mats) {
  const group = new THREE.Group();
  const navyFabric = new THREE.MeshPhysicalMaterial({
    map: mats.navyTex,
    normalMap: mats.fabricNormal,
    normalScale: new THREE.Vector2(0.55, 0.55),
    color: 0xffffff,
    roughness: 0.76,
    sheen: 0.52,
    sheenColor: new THREE.Color(0x4b6cb0)
  });

  // Sculpted Airline Garrison Cap with folded side flaps & crisp crown
  const crown = new THREE.Mesh(
    new THREE.CylinderGeometry(0.102, 0.114, 0.068, 24),
    navyFabric
  );
  crown.scale.set(1.0, 1.0, 1.16);
  crown.castShadow = true;
  group.add(crown);

  const topDome = new THREE.Mesh(
    new THREE.SphereGeometry(0.104, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.45),
    navyFabric
  );
  topDome.scale.set(1.0, 0.34, 1.16);
  topDome.position.y = 0.030;
  group.add(topDome);

  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xf2c95e,
    metalness: 0.92,
    roughness: 0.18
  });
  const piping = new THREE.Mesh(new THREE.TorusGeometry(0.109, 0.0040, 8, 28), goldMat);
  piping.rotation.x = Math.PI / 2;
  piping.scale.set(1.0, 1.16, 1.0);
  piping.position.y = -0.022;
  group.add(piping);

  const emblemCenter = new THREE.Mesh(new THREE.SphereGeometry(0.012, 12, 10), goldMat);
  emblemCenter.scale.set(1.0, 1.1, 0.45);
  emblemCenter.position.set(0, 0.004, 0.127);
  group.add(emblemCenter);

  [-1, 1].forEach((s) => {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.010, 0.005), goldMat);
    wing.position.set(s * 0.022, 0.007, 0.124);
    wing.rotation.z = s * 0.18;
    wing.rotation.y = -s * 0.22;
    group.add(wing);
  });

  return group;
}

export function createCrewScarfMesh(mats) {
  const group = new THREE.Group();
  const silkMat = new THREE.MeshPhysicalMaterial({
    map: mats.scarfTex,
    roughness: 0.32,
    metalness: 0.02,
    sheen: 0.80,
    sheenRoughness: 0.24,
    sheenColor: new THREE.Color(0xffffff),
    clearcoat: 0.18
  });

  const collarRing = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.016, 12, 24), silkMat);
  collarRing.rotation.x = Math.PI / 2 + 0.14;
  collarRing.castShadow = true;
  group.add(collarRing);

  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.020, 12, 10), silkMat);
  knot.position.set(0.048, -0.006, 0.052);
  group.add(knot);

  [0, 1].forEach((i) => {
    const tail = new THREE.Mesh(
      new RoundedBoxGeometry(0.034, 0.088, 0.010, 3, 0.004),
      silkMat
    );
    tail.position.set(0.060 + i * 0.020, -0.044, 0.058 - i * 0.008);
    tail.rotation.z = 0.28 + i * 0.24;
    tail.rotation.x = -0.18;
    group.add(tail);
  });

  return group;
}

export function createCharactersAndHand(scene, mats, heroSeatCoords) {
  const daughter = new ExpressiveHuman({
    role: 'daughter',
    isDaughter: true,
    seated: false,
    scale: 0.88,
    skinHex: 0xf4c5ac,
    hairHex: 0x261812,
    irisHex: 0x45281a,
    clothHex: 0xf6f8fc,
    navyMap: mats.navyTex,
    fabricNormal: mats.fabricNormal
  });
  daughter.root.position.set(0.45, 0.0, 0.96);
  daughter.root.rotation.y = -0.36;
  scene.add(daughter.root);

  const wornHat = createCrewHatMesh(mats);
  wornHat.position.set(0, 0.114, -0.006);
  wornHat.rotation.x = -0.14;
  wornHat.rotation.z = -0.07;
  wornHat.visible = false;
  daughter.headPivot.add(wornHat);

  const wornScarf = createCrewScarfMesh(mats);
  wornScarf.position.set(0, 0.355, 0.014);
  wornScarf.visible = false;
  daughter.torsoPivot.add(wornScarf);

  daughter.wornHat = wornHat;
  daughter.wornScarf = wornScarf;

  const passengerConfigs = [
    {
      role: 'mom',
      seated: true,
      scale: 0.98,
      skinHex: 0xf2c2aa,
      hairHex: 0x382219,
      irisHex: 0x4c2e1e,
      clothHex: 0xefe3d5,
      collarHex: 0xfbfcfe,
      pantsHex: 0x263859,
      fabricNormal: mats.fabricNormal,
      wantFirst: 'tea'
    },
    {
      role: 'dad',
      seated: true,
      scale: 1.03,
      skinHex: 0xebb99e,
      hairHex: 0x1c1614,
      irisHex: 0x3b2417,
      clothHex: 0xbdd4ee,
      collarHex: 0xf7fafe,
      pantsHex: 0x202d45,
      fabricNormal: mats.fabricNormal,
      wantFirst: 'juice'
    },
    {
      role: 'grandma',
      seated: true,
      scale: 0.95,
      skinHex: 0xf0c4b0,
      hairHex: 0xcad0da,
      irisHex: 0x4e3424,
      clothHex: 0xd4969a,
      collarHex: 0xfbf7f2,
      pantsHex: 0x2a3752,
      fabricNormal: mats.fabricNormal,
      wantFirst: 'meal'
    }
  ];

  const passengers = passengerConfigs.map((cfg, idx) => {
    const human = new ExpressiveHuman(cfg);
    const coord = heroSeatCoords[idx];
    human.root.position.set(coord.x, -0.06, coord.z + 0.02);
    human.root.rotation.y = idx === 0 ? 0.15 : idx === 1 ? 0.06 : -0.18;
    scene.add(human.root);

    const bubbleMat = new THREE.SpriteMaterial({
      map: mats.thoughtIcons[cfg.wantFirst],
      transparent: true,
      opacity: 0.0,
      depthTest: true
    });
    const bubble = new THREE.Sprite(bubbleMat);
    bubble.scale.set(0.27, 0.27, 1);
    bubble.position.set(
      coord.x + (idx === 0 ? -0.07 : idx === 1 ? 0.04 : 0.07),
      1.35,
      coord.z + 0.12
    );
    scene.add(bubble);

    const blanketMesh = new THREE.Mesh(
      new RoundedBoxGeometry(0.41, 0.27, 0.32, 4, 0.055),
      new THREE.MeshPhysicalMaterial({
        map: mats.blanketTextures[0],
        normalMap: mats.fabricNormal,
        normalScale: new THREE.Vector2(0.65, 0.65),
        roughness: 0.88,
        sheen: 0.55,
        sheenColor: new THREE.Color(0xffffff)
      })
    );
    blanketMesh.position.set(0, 0.06, 0.13);
    blanketMesh.rotation.x = 0.32;
    blanketMesh.visible = false;
    blanketMesh.userData.interactiveType = 'wornBlanket';
    blanketMesh.userData.passengerIndex = idx;
    human.torsoPivot.add(blanketMesh);

    const pillowMesh = new THREE.Mesh(
      new RoundedBoxGeometry(0.29, 0.18, 0.095, 4, 0.042),
      new THREE.MeshPhysicalMaterial({
        color: 0xfbfcfe,
        normalMap: mats.fabricNormal,
        normalScale: new THREE.Vector2(0.35, 0.35),
        roughness: 0.82,
        sheen: 0.4
      })
    );
    pillowMesh.position.set(0.02, 0.42, -0.09);
    pillowMesh.rotation.z = 0.12;
    pillowMesh.visible = false;
    human.torsoPivot.add(pillowMesh);

    return {
      idx,
      role: cfg.role,
      human,
      bubble,
      bubbleMat,
      desiredKind: cfg.wantFirst,
      bubbleTargetAlpha: 0.0,
      servedItems: [],
      hasBlanket: false,
      blanketStyle: 0,
      blanketTuckedHigh: false,
      blanketMesh,
      hasPillow: false,
      pillowMesh,
      isSleeping: false
    };
  });

  // Player's 3D Child Hand ("指がその子の手になる")
  const playerHand = new THREE.Group();
  const handSkin = createSkinMaterial(0xf4c5ac);
  const cuffNavy = new THREE.MeshPhysicalMaterial({
    map: mats.navyTex,
    normalMap: mats.fabricNormal,
    color: 0xffffff,
    roughness: 0.78
  });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xf2c95e, metalness: 0.9, roughness: 0.22 });

  const palm = new THREE.Mesh(new THREE.SphereGeometry(0.040, 16, 14), handSkin);
  palm.scale.set(0.94, 0.60, 1.15);
  playerHand.add(palm);

  [-0.023, -0.008, 0.008, 0.023].forEach((fx, fi) => {
    const finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.0082, 0.034 - Math.abs(fi - 1.5) * 0.004, 6, 8), handSkin);
    finger.rotation.x = Math.PI / 2 + 0.22;
    finger.position.set(fx, -0.005, -0.046);
    playerHand.add(finger);
  });
  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.009, 0.026, 6, 8), handSkin);
  thumb.rotation.z = 0.65;
  thumb.rotation.x = Math.PI / 2;
  thumb.position.set(-0.036, -0.004, -0.017);
  playerHand.add(thumb);

  const whiteCuff = new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.035, 0.034, 14), new THREE.MeshStandardMaterial({ color: 0xfafbfd, roughness: 0.6 }));
  whiteCuff.rotation.x = Math.PI / 2 - 0.28;
  whiteCuff.position.set(0, 0.014, 0.052);
  playerHand.add(whiteCuff);

  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.046, 0.21, 14), cuffNavy);
  sleeve.rotation.x = Math.PI / 2 - 0.28;
  sleeve.position.set(0, 0.046, 0.16);
  playerHand.add(sleeve);

  const cuffStripe = new THREE.Mesh(new THREE.TorusGeometry(0.039, 0.0032, 8, 18), goldMat);
  cuffStripe.rotation.x = -0.28;
  cuffStripe.position.set(0, 0.023, 0.082);
  playerHand.add(cuffStripe);

  playerHand.traverse((obj) => {
    if (obj.isMesh) obj.raycast = () => {};
  });
  playerHand.visible = false;
  scene.add(playerHand);

  return { daughter, passengers, playerHand };
}
