import * as THREE from 'three';

let cachedIrisCache = {};
function getIrisTexture(hexHue = '#5e3d24') {
  if (cachedIrisCache[hexHue]) return cachedIrisCache[hexHue];
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx = size / 2;
  const cy = size / 2;

  const scleraGrad = ctx.createRadialGradient(cx, cy, size * 0.2, cx, cy, size * 0.5);
  scleraGrad.addColorStop(0, '#faf5ef');
  scleraGrad.addColorStop(0.72, '#efe4d8');
  scleraGrad.addColorStop(1, '#dccbbe');
  ctx.fillStyle = scleraGrad;
  ctx.fillRect(0, 0, size, size);

  // Proportional natural human iris (smaller & warmer so eyes look natural, never doll-like)
  const irisR = size * 0.22;
  const irisGrad = ctx.createRadialGradient(cx, cy, irisR * 0.15, cx, cy, irisR);
  irisGrad.addColorStop(0, '#22130a');
  irisGrad.addColorStop(0.55, hexHue);
  irisGrad.addColorStop(0.88, '#382112');
  irisGrad.addColorStop(1, '#24140a');
  ctx.fillStyle = irisGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, irisR, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#120a06';
  ctx.beginPath();
  ctx.arc(cx, cy, irisR * 0.40, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 253, 248, 0.92)';
  ctx.beginPath();
  ctx.ellipse(cx + irisR * 0.28, cy - irisR * 0.28, irisR * 0.17, irisR * 0.13, -0.35, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  cachedIrisCache[hexHue] = tex;
  return tex;
}

// Warm skin texture with subtle rosy cheek & nose subsurface warmth (eliminates pale mannequin look!)
let cachedSkinTex = null;
function getWarmSkinTexture() {
  if (cachedSkinTex) return cachedSkinTex;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f4c6ab';
  ctx.fillRect(0, 0, size, size);

  // Subtle warm subsurface flush across mid-face band (equator of UV sphere)
  const flush = ctx.createLinearGradient(0, size * 0.35, 0, size * 0.72);
  flush.addColorStop(0, 'rgba(244, 198, 171, 0)');
  flush.addColorStop(0.5, 'rgba(235, 146, 128, 0.22)');
  flush.addColorStop(1, 'rgba(225, 168, 142, 0.08)');
  ctx.fillStyle = flush;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  cachedSkinTex = tex;
  return tex;
}

function createSculptedHeadGeometry(isChild = true, isMale = false) {
  const geo = new THREE.SphereGeometry(0.134, 46, 36);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const nx = v.x / 0.134;
    const ny = v.y / 0.134;
    const nz = v.z / 0.134;

    v.y *= isChild ? 1.04 : 1.12;
    v.x *= isChild ? 0.95 : (isMale ? 0.93 : 0.90);
    v.z *= 0.97;

    if (ny < 0) {
      const jawTaper = isChild ? 0.17 : (isMale ? 0.19 : 0.25);
      v.x *= 1.0 - Math.pow(-ny, 1.35) * jawTaper;
      v.z *= 1.0 - Math.pow(-ny, 1.6) * 0.10;
    }

    if (nz > 0.18) {
      const chin = Math.exp(-((nx * nx) / 0.14 + ((ny + 0.78) ** 2) / 0.08)) * (isMale ? 0.011 : 0.008);
      v.z += chin;
      v.y -= chin * 0.30;

      const cheekAmp = isChild ? 0.016 : 0.010;
      const cheekL = Math.exp(-(((nx + 0.45) ** 2) / 0.14 + ((ny + 0.22) ** 2) / 0.13));
      const cheekR = Math.exp(-(((nx - 0.45) ** 2) / 0.14 + ((ny + 0.22) ** 2) / 0.13));
      v.z += (cheekL + cheekR) * cheekAmp;
      v.x += (-cheekL + cheekR) * (cheekAmp * 0.50);

      const eyeY = isChild ? 0.02 : 0.08;
      const eyeX = 0.32;
      const sockL = Math.exp(-(((nx + eyeX) ** 2) / 0.05 + ((ny - eyeY) ** 2) / 0.038));
      const sockR = Math.exp(-(((nx - eyeX) ** 2) / 0.05 + ((ny - eyeY) ** 2) / 0.038));
      v.z -= (sockL + sockR) * 0.009;

      const noseBridge = Math.exp(-((nx * nx) / 0.018 + ((ny + 0.05) ** 2) / 0.065)) * (isChild ? 0.010 : 0.015);
      const noseTipY = isChild ? -0.16 : -0.14;
      const noseTip = Math.exp(-((nx * nx) / 0.022 + ((ny - noseTipY) ** 2) / 0.020)) * (isChild ? 0.019 : 0.024);
      v.z += noseBridge + noseTip;
      v.y -= noseTip * 0.10;
    }
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

export function createSkinMaterial(warmth = 0) {
  const tint = new THREE.Color().setHSL(0.052 - warmth * 0.004, 0.22 + warmth * 0.06, 0.94 - warmth * 0.05);
  return new THREE.MeshPhysicalMaterial({
    color: tint,
    map: getWarmSkinTexture(),
    roughness: 0.54,
    metalness: 0.0,
    sheen: 0.35,
    sheenRoughness: 0.62,
    sheenColor: new THREE.Color(0xffb8a0),
    clearcoat: 0.05,
    clearcoatRoughness: 0.55
  });
}

// Create a soft flattened organic hair lock (wide ribbon cross-section instead of sausage cylinder!)
function createSoftHairRibbon(points, width = 0.036, thickness = 0.012, mat) {
  const curve = new THREE.CatmullRomCurve3(points);
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 14, 1.0, 8, false), mat);
  // Taper & flatten cross-section along curve so it blends seamlessly like real brushed hair!
  const pos = mesh.geometry.attributes.position;
  const v = new THREE.Vector3();
  const cPt = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const seg = Math.floor(i / 9);
    const t = Math.min(1, seg / 14);
    curve.getPointAt(t, cPt);
    v.fromBufferAttribute(pos, i).sub(cPt);
    const taper = (1.0 - Math.pow(t, 2.2) * 0.65) * (0.75 + Math.sin(t * Math.PI) * 0.35);
    // Flatten radially toward head surface
    v.x *= width * taper;
    v.y *= width * 0.7 * taper;
    v.z *= thickness * taper;
    v.add(cPt);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  mesh.geometry.computeVertexNormals();
  mesh.castShadow = true;
  return mesh;
}

export class ExpressivePerson {
  constructor(options = {}) {
    const {
      role = 'girl',
      linenMaterial = null,
      skinWarmth = 0.0,
      upperBodyOnly = false
    } = options;

    this.role = role;
    this.isChild = role === 'girl';
    this.isMale = role === 'papa' || role === 'guestGentleman';
    this.upperBodyOnly = upperBodyOnly;

    this.group = new THREE.Group();
    this.bodyPivot = new THREE.Group();
    this.group.add(this.bodyPivot);

    this.expression = 'idle';
    this.exprTimer = 0;
    this.blinkTimer = 1.6 + Math.random() * 2.5;
    this.blinkAmount = 0;
    this.lookTargetOffset = new THREE.Vector2(0, 0);

    const skinMat = createSkinMaterial(skinWarmth);
    this.skinMat = skinMat;

    const scaleH = this.isChild ? 0.82 : (this.isMale ? 1.10 : 1.02);
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, this.isChild ? 0.98 : 1.33 * (scaleH / 1.04), 0);
    this.bodyPivot.add(this.headGroup);

    const headMesh = new THREE.Mesh(createSculptedHeadGeometry(this.isChild, this.isMale), skinMat);
    headMesh.castShadow = true;
    headMesh.receiveShadow = true;
    this.headGroup.add(headMesh);

    // Smooth flared neck blending into collarline (zero puppet gap!)
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.062, 0.13, 18), skinMat);
    neck.position.set(0, -0.142, -0.012);
    neck.castShadow = true;
    this.headGroup.add(neck);

    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.027, 14, 12), skinMat);
      ear.scale.set(0.42, 0.92, 0.66);
      ear.position.set(s * 0.124, -0.015, -0.006);
      this.headGroup.add(ear);
    }

    this.cheekMat = new THREE.MeshBasicMaterial({
      color: 0xe66f6b,
      transparent: true,
      opacity: 0.24,
      depthWrite: false
    });
    for (const s of [-1, 1]) {
      const blush = new THREE.Mesh(new THREE.CircleGeometry(0.026, 16), this.cheekMat);
      blush.position.set(s * 0.062, -0.032, 0.124);
      blush.rotation.y = s * 0.35;
      this.headGroup.add(blush);
    }

    const eyeY = this.isChild ? 0.002 : 0.012;
    const eyeX = 0.043;
    const eyeGeo = new THREE.SphereGeometry(0.0185, 20, 16);
    const irisTex = getIrisTexture(role === 'guestGentleman' ? '#4a3525' : '#5e3d24');
    const eyeMat = new THREE.MeshPhysicalMaterial({
      map: irisTex,
      roughness: 0.10,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04
    });

    const hairColors = {
      girl: 0x472d1e,
      papa: 0x2d1e16,
      mama: 0x523423,
      guestGrandma: 0x948a82,
      guestGentleman: 0x4a4039
    };
    const hairMat = new THREE.MeshPhysicalMaterial({
      color: hairColors[role] || 0x472d1e,
      roughness: 0.44,
      sheen: 0.55,
      sheenRoughness: 0.38,
      sheenColor: new THREE.Color(0xb0896c)
    });
    this.hairMat = hairMat;

    const lashMat = new THREE.MeshBasicMaterial({ color: 0x2c1b12 });

    this.eyes = [];
    this.upperLids = [];
    this.lowerLids = [];
    this.brows = [];

    for (const s of [-1, 1]) {
      const socket = new THREE.Group();
      socket.position.set(s * eyeX, eyeY, 0.114);
      this.headGroup.add(socket);

      const eyeball = new THREE.Mesh(eyeGeo, eyeMat);
      eyeball.rotation.y = -Math.PI / 2;
      socket.add(eyeball);
      this.eyes.push(eyeball);

      // Smooth skin upper eyelid + delicate thin lash line (no heavy dark ring!)
      const upperLid = new THREE.Group();
      const lidSkin = new THREE.Mesh(
        new THREE.SphereGeometry(0.0202, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.48),
        skinMat
      );
      lidSkin.rotation.x = -0.45;
      upperLid.add(lidSkin);

      const lashCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.015 * s, -0.001, 0.013),
        new THREE.Vector3(0, 0.006, 0.0185),
        new THREE.Vector3(0.016 * s, 0.001, 0.012)
      ]);
      const lash = new THREE.Mesh(new THREE.TubeGeometry(lashCurve, 10, 0.0013, 5, false), lashMat);
      upperLid.add(lash);
      socket.add(upperLid);
      this.upperLids.push(upperLid);

      const lowerLid = new THREE.Mesh(
        new THREE.SphereGeometry(0.020, 16, 10, 0, Math.PI * 2, Math.PI * 0.58, Math.PI * 0.42),
        skinMat
      );
      lowerLid.rotation.x = 0.44;
      socket.add(lowerLid);
      this.lowerLids.push(lowerLid);

      const browCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.016 * s, 0.001, 0.001),
        new THREE.Vector3(0, 0.0045, 0.004),
        new THREE.Vector3(0.018 * s, -0.001, -0.001)
      ]);
      const brow = new THREE.Mesh(new THREE.TubeGeometry(browCurve, 10, 0.0026, 6, false), hairMat);
      brow.position.set(s * eyeX, eyeY + 0.028, 0.123);
      this.headGroup.add(brow);
      this.brows.push({ mesh: brow, side: s, baseY: eyeY + 0.028 });
    }

    // Soft Warm Lips & Smile
    this.mouthGroup = new THREE.Group();
    this.mouthGroup.position.set(0, this.isChild ? -0.054 : -0.056, 0.123);
    this.headGroup.add(this.mouthGroup);

    const lipMat = new THREE.MeshPhysicalMaterial({
      color: this.isMale ? 0xc87f72 : 0xd97b74,
      roughness: 0.40,
      clearcoat: 0.28
    });
    this.mouthCavity = new THREE.Mesh(
      new THREE.SphereGeometry(0.015, 14, 12),
      new THREE.MeshBasicMaterial({ color: 0x612424 })
    );
    this.mouthCavity.scale.set(1.15, 0.18, 0.42);
    this.mouthGroup.add(this.mouthCavity);

    const smileCurveU = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.021, 0.0025, -0.003),
      new THREE.Vector3(-0.007, 0.003, 0.003),
      new THREE.Vector3(0, 0.002, 0.004),
      new THREE.Vector3(0.007, 0.003, 0.003),
      new THREE.Vector3(0.021, 0.0025, -0.003)
    ]);
    this.upperLip = new THREE.Mesh(new THREE.TubeGeometry(smileCurveU, 14, 0.0030, 8, false), lipMat);
    this.mouthGroup.add(this.upperLip);

    const smileCurveL = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.020, 0.0015, -0.003),
      new THREE.Vector3(0, -0.0038, 0.0035),
      new THREE.Vector3(0.020, 0.0015, -0.003)
    ]);
    this.lowerLip = new THREE.Mesh(new THREE.TubeGeometry(smileCurveL, 14, 0.0035, 8, false), lipMat);
    this.mouthGroup.add(this.lowerLip);

    this._buildNaturalHair(role, hairMat);
    this._buildBodyAndClothes(role, skinMat, linenMaterial);
  }

  _buildNaturalHair(role, hairMat) {
    const hairGroup = new THREE.Group();
    this.headGroup.add(hairGroup);

    // Sculpted back & crown hair volume
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.140, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.66),
      hairMat
    );
    cap.position.set(0, 0.012, -0.014);
    cap.scale.set(1.03, 1.05, 1.04);
    cap.castShadow = true;
    hairGroup.add(cap);

    if (role === 'girl') {
      // Soft side-parted swept bangs using wide overlapping ribbons (looks like real soft brushed hair!)
      const partX = -0.038;
      // Right-sweeping soft curtain bangs
      hairGroup.add(createSoftHairRibbon([
        new THREE.Vector3(partX, 0.132, 0.045),
        new THREE.Vector3(0.018, 0.102, 0.118),
        new THREE.Vector3(0.078, 0.056, 0.122),
        new THREE.Vector3(0.118, 0.008, 0.088)
      ], 0.058, 0.018, hairMat));

      hairGroup.add(createSoftHairRibbon([
        new THREE.Vector3(partX + 0.01, 0.128, 0.065),
        new THREE.Vector3(-0.005, 0.088, 0.124),
        new THREE.Vector3(0.036, 0.052, 0.131)
      ], 0.048, 0.015, hairMat));

      // Left-sweeping soft temple fringe
      hairGroup.add(createSoftHairRibbon([
        new THREE.Vector3(partX, 0.132, 0.045),
        new THREE.Vector3(-0.082, 0.085, 0.112),
        new THREE.Vector3(-0.118, 0.022, 0.082)
      ], 0.050, 0.018, hairMat));

      // Soft rounded bob back volume ONLY behind ears & neck (-Z side, leaving chin & throat 100% clean!)
      const bobSkirt = new THREE.Mesh(
        new THREE.CylinderGeometry(0.122, 0.136, 0.145, 24, 3, false, Math.PI * 0.58, Math.PI * 0.84),
        hairMat
      );
      bobSkirt.position.set(0, -0.048, -0.026);
      bobSkirt.castShadow = true;
      hairGroup.add(bobSkirt);

      for (const s of [-1, 1]) {
        const lowPuff = new THREE.Mesh(new THREE.SphereGeometry(0.048, 16, 14), hairMat);
        lowPuff.position.set(s * 0.105, -0.072, -0.078);
        lowPuff.scale.set(0.95, 1.08, 0.95);
        lowPuff.castShadow = true;
        hairGroup.add(lowPuff);
      }

      // Pleated White Linen Housekeeping Cap
      this.uniformCap = new THREE.Group();
      const capLinen = new THREE.MeshPhysicalMaterial({
        color: 0xfcfaf6,
        roughness: 0.76,
        sheen: 0.78,
        sheenColor: new THREE.Color(0xffffff),
        side: THREE.DoubleSide
      });
      const bandCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.122, 0.052, -0.008),
        new THREE.Vector3(-0.084, 0.132, 0.038),
        new THREE.Vector3(0, 0.158, 0.052),
        new THREE.Vector3(0.084, 0.132, 0.038),
        new THREE.Vector3(0.122, 0.052, -0.008)
      ]);
      const crown = new THREE.Mesh(new THREE.TubeGeometry(bandCurve, 22, 0.022, 10, false), capLinen);
      crown.scale.set(1, 1.18, 0.62);
      crown.castShadow = true;
      this.uniformCap.add(crown);

      for (let f = 0; f < 11; f++) {
        const a = ((f / 10) - 0.5) * 1.45;
        const ruffle = new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 8), capLinen);
        ruffle.position.set(Math.sin(a) * 0.114, 0.154 - a * a * 0.045, 0.058 - a * a * 0.022);
        ruffle.scale.set(1.25, 0.68, 0.48);
        this.uniformCap.add(ruffle);
      }
      this.uniformCap.visible = false;
      this.headGroup.add(this.uniformCap);
    } else if (role === 'mama' || role === 'guestGrandma') {
      for (const s of [-1, 1]) {
        hairGroup.add(createSoftHairRibbon([
          new THREE.Vector3(s * 0.02, 0.132, 0.085),
          new THREE.Vector3(s * 0.105, 0.068, 0.085),
          new THREE.Vector3(s * 0.132, -0.035, 0.01),
          new THREE.Vector3(s * 0.075, -0.085, -0.10)
        ], 0.052, 0.022, hairMat));
      }
      const chignon = new THREE.Mesh(new THREE.SphereGeometry(0.064, 18, 14), hairMat);
      chignon.position.set(0, -0.055, -0.132);
      chignon.scale.set(1.15, 0.95, 0.95);
      hairGroup.add(chignon);
    } else {
      hairGroup.add(createSoftHairRibbon([
        new THREE.Vector3(-0.06, 0.135, 0.055),
        new THREE.Vector3(0.01, 0.122, 0.115),
        new THREE.Vector3(0.095, 0.088, 0.105)
      ], 0.062, 0.020, hairMat));
      hairGroup.add(createSoftHairRibbon([
        new THREE.Vector3(-0.05, 0.132, 0.055),
        new THREE.Vector3(-0.105, 0.088, 0.092)
      ], 0.045, 0.018, hairMat));
    }
  }

  _buildBodyAndClothes(role, skinMat, linenMaterial) {
    const isChild = this.isChild;
    const torsoTopY = isChild ? 0.83 : 1.18;
    const shoulderW = isChild ? 0.152 : (this.isMale ? 0.232 : 0.192);

    const outfitColors = {
      girlCasual: 0xc89e82,   // Warm terracotta-rose knit sweater before uniform
      girlUniform0: 0x5c4332, // Classic Boutique Walnut Brown
      girlUniform1: 0x5a6e5c, // Soft Sage Olive
      girlUniform2: 0x3b4b5e, // Deep Slate Navy
      papa: 0x68849e,
      mama: 0xc69678,
      guestGrandma: 0x8a6d82,
      guestGentleman: 0x506155
    };

    this.dressMat = new THREE.MeshPhysicalMaterial({
      color: role === 'girl' ? outfitColors.girlCasual : (outfitColors[role] || 0x68849e),
      roughness: 0.82,
      sheen: 0.68,
      sheenRoughness: 0.68,
      sheenColor: new THREE.Color(0xf8f0e6)
    });
    if (linenMaterial && linenMaterial.normalMap) {
      this.dressMat.normalMap = linenMaterial.normalMap;
      this.dressMat.normalScale = new THREE.Vector2(0.45, 0.45);
    }
    this.uniformPalette = [
      outfitColors.girlUniform0,
      outfitColors.girlUniform1,
      outfitColors.girlUniform2
    ];

    const whiteLinenMat = linenMaterial
      ? linenMaterial.clone()
      : new THREE.MeshPhysicalMaterial({ color: 0xfaf7f2, roughness: 0.78, sheen: 0.75 });

    // Sculpted Seamless Bodice + Natural Trapezius/Waist Contour
    const torsoH = isChild ? 0.34 : 0.50;
    const torsoGeo = new THREE.CylinderGeometry(shoulderW * 0.90, shoulderW * (isChild ? 0.96 : 0.80), torsoH, 28, 10);
    const tPos = torsoGeo.attributes.position;
    for (let i = 0; i < tPos.count; i++) {
      const x = tPos.getX(i);
      const y = tPos.getY(i);
      const z = tPos.getZ(i);
      const ny = (y + torsoH * 0.5) / torsoH; // 0 = waist, 1 = collarbone
      const slope = ny > 0.72 ? Math.cos(((ny - 0.72) / 0.28) * Math.PI * 0.38) : 1.0;
      // Gentle natural waist taper & soft fabric drape ripples
      const waistCurve = 1.0 - Math.sin(ny * Math.PI) * (isChild ? 0.04 : 0.08);
      const fold = Math.sin(Math.atan2(z, x) * 6.0) * 0.004 * (1 - ny);
      tPos.setXYZ(
        i,
        x * slope * waistCurve * 1.04 + fold,
        y,
        z * 0.64 * (0.94 + Math.sin(ny * Math.PI) * 0.16)
      );
    }
    torsoGeo.computeVertexNormals();
    const torso = new THREE.Mesh(torsoGeo, this.dressMat);
    // Put cylinder radial seam on the back (-Z) so front chest/bodice is 100% seamless!
    torso.rotation.y = Math.PI;
    torso.position.set(0, torsoTopY - torsoH * 0.5, 0);
    torso.castShadow = true;
    torso.receiveShadow = true;
    this.bodyPivot.add(torso);

    // Soft Rolled Shawl/Cardigan Lapels on Adults for Natural Layered Garment Depth
    if (!isChild) {
      for (const s of [-1, 1]) {
        const lapelCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(s * 0.048, torsoTopY - 0.01, 0.065),
          new THREE.Vector3(s * 0.062, torsoTopY - 0.15, 0.108),
          new THREE.Vector3(s * 0.025, torsoTopY - 0.30, 0.112)
        ]);
        const lapelMesh = new THREE.Mesh(new THREE.TubeGeometry(lapelCurve, 12, 0.018, 8, false), this.dressMat);
        lapelMesh.scale.set(1.2, 1, 0.55);
        lapelMesh.castShadow = true;
        this.bodyPivot.add(lapelMesh);
      }
    }

    // Subtle fabric buttons
    const btnMat = new THREE.MeshPhysicalMaterial({ color: 0x704c30, roughness: 0.45 });
    for (let b = 0; b < 3; b++) {
      const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.004, 12), btnMat);
      btn.rotation.x = Math.PI / 2;
      btn.position.set(0, torsoTopY - 0.12 - b * 0.065, shoulderW * 0.62);
      this.bodyPivot.add(btn);
    }

    if (role === 'girl') {
      // Softly pleated A-line skirt with wavy fabric hem folds!
      if (!this.upperBodyOnly) {
        const skirtGeo = new THREE.CylinderGeometry(shoulderW * 0.94, shoulderW * 1.62, 0.36, 36, 6);
        const sPos = skirtGeo.attributes.position;
        for (let i = 0; i < sPos.count; i++) {
          const x = sPos.getX(i);
          const y = sPos.getY(i);
          const z = sPos.getZ(i);
          const ny = 0.5 - y / 0.36; // 0 = waist, 1 = hem
          const ang = Math.atan2(z, x);
          const pleat = 1.0 + Math.sin(ang * 10.0) * 0.055 * ny;
          sPos.setXYZ(i, x * pleat, y, z * 0.80 * pleat);
        }
        skirtGeo.computeVertexNormals();
        const skirt = new THREE.Mesh(skirtGeo, this.dressMat);
        skirt.rotation.y = Math.PI;
        skirt.position.set(0, torsoTopY - torsoH - 0.15, 0);
        skirt.castShadow = true;
        skirt.receiveShadow = true;
        this.bodyPivot.add(skirt);
      }

      // Soft White Linen Peter-Pan Collar (always subtle, fuller with brass pin when uniform equipped)
      this.uniformCollar = new THREE.Group();
      for (const s of [-1, 1]) {
        const lapel = new THREE.Mesh(new THREE.SphereGeometry(0.058, 16, 12), whiteLinenMat);
        lapel.scale.set(1.15, 0.22, 0.95);
        lapel.position.set(s * 0.046, torsoTopY - 0.016, 0.048);
        lapel.rotation.set(0.32, 0, -s * 0.25);
        this.uniformCollar.add(lapel);
      }
      const pin = new THREE.Mesh(
        new THREE.CylinderGeometry(0.016, 0.016, 0.007, 16),
        new THREE.MeshPhysicalMaterial({ color: 0xd8ae58, metalness: 0.8, roughness: 0.25 })
      );
      pin.rotation.x = Math.PI / 2;
      pin.position.set(0, torsoTopY - 0.032, 0.098);
      this.uniformCollar.add(pin);
      this.uniformCollar.visible = false;
      this.bodyPivot.add(this.uniformCollar);

      // Crisp White Linen Housekeeping Apron
      this.uniformApron = new THREE.Group();
      const bib = new THREE.Mesh(new THREE.BoxGeometry(0.165, 0.18, 0.016), whiteLinenMat);
      bib.position.set(0, torsoTopY - 0.12, 0.102);
      bib.castShadow = true;
      this.uniformApron.add(bib);

      for (const s of [-1, 1]) {
        const strap = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.20, 0.018), whiteLinenMat);
        strap.position.set(s * 0.068, torsoTopY - 0.085, 0.086);
        strap.rotation.x = -0.20;
        this.uniformApron.add(strap);
      }

      if (!this.upperBodyOnly) {
        const waistBand = new THREE.Mesh(
          new THREE.CylinderGeometry(shoulderW * 0.99, shoulderW * 1.02, 0.040, 24),
          whiteLinenMat
        );
        waistBand.scale.set(1.02, 1, 0.78);
        waistBand.position.set(0, torsoTopY - 0.22, 0.008);
        this.uniformApron.add(waistBand);

        const apronSkirt = new THREE.Mesh(
          new THREE.CylinderGeometry(shoulderW * 1.0, shoulderW * 1.54, 0.30, 26, 3, false, -Math.PI * 0.42, Math.PI * 0.84),
          whiteLinenMat
        );
        apronSkirt.scale.set(1.03, 1, 0.84);
        apronSkirt.position.set(0, torsoTopY - 0.38, 0.016);
        apronSkirt.castShadow = true;
        this.uniformApron.add(apronSkirt);
      }
      this.uniformApron.visible = false;
      this.bodyPivot.add(this.uniformApron);

      if (!this.upperBodyOnly) {
        const legMat = new THREE.MeshPhysicalMaterial({ color: 0xf6f2eb, roughness: 0.78 });
        const shoeMat = new THREE.MeshPhysicalMaterial({ color: 0x3b261a, roughness: 0.34, clearcoat: 0.42 });
        for (const s of [-1, 1]) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.037, 0.030, 0.28, 14), legMat);
          leg.position.set(s * 0.066, 0.15, 0);
          leg.castShadow = true;
          this.bodyPivot.add(leg);
          const shoe = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 12), shoeMat);
          shoe.scale.set(0.84, 0.60, 1.34);
          shoe.position.set(s * 0.066, 0.025, 0.024);
          shoe.castShadow = true;
          this.bodyPivot.add(shoe);
        }
      }
    } else if (!this.upperBodyOnly) {
      const lowerMat = new THREE.MeshPhysicalMaterial({
        color: this.isMale ? 0x4e4841 : 0x5c5148,
        roughness: 0.84
      });
      const shoeMat = new THREE.MeshPhysicalMaterial({ color: 0x453022, roughness: 0.45 });
      for (const s of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.054, 0.66, 16), lowerMat);
        leg.position.set(s * 0.092, 0.34, 0);
        leg.castShadow = true;
        this.bodyPivot.add(leg);
        const shoe = new THREE.Mesh(new THREE.SphereGeometry(0.058, 14, 12), shoeMat);
        shoe.scale.set(0.86, 0.56, 1.38);
        shoe.position.set(s * 0.092, 0.028, 0.032);
        this.bodyPivot.add(shoe);
      }
      const shirtV = new THREE.Mesh(new THREE.ConeGeometry(0.072, 0.18, 12), whiteLinenMat);
      shirtV.rotation.x = Math.PI;
      shirtV.scale.set(1, 1, 0.45);
      shirtV.position.set(0, torsoTopY - 0.07, 0.10);
      this.bodyPivot.add(shirtV);
    }

    this.leftArm = this._createSeamlessArm(-1, shoulderW, torsoTopY, skinMat, whiteLinenMat);
    this.rightArm = this._createSeamlessArm(1, shoulderW, torsoTopY, skinMat, whiteLinenMat);
    this.bodyPivot.add(this.leftArm.pivot, this.rightArm.pivot);
  }

  // One-piece tailored curved sleeve with smooth rounded deltoid shoulder cap!
  _createSeamlessArm(side, shoulderW, torsoTopY, skinMat, whiteLinenMat) {
    const pivot = new THREE.Group();
    pivot.position.set(side * (shoulderW * 0.82), torsoTopY - 0.056, 0);

    const rSleeve = this.isChild ? 0.036 : 0.048;
    // Rounded deltoid cap eliminates any tube-top shoulder notch!
    const deltoid = new THREE.Mesh(new THREE.SphereGeometry(rSleeve * 1.18, 16, 12), this.dressMat);
    deltoid.scale.set(0.95, 1.08, 0.88);
    deltoid.position.set(-side * 0.006, 0.008, 0);
    deltoid.castShadow = true;
    pivot.add(deltoid);

    // Shorter tucked forearm inside mirror upper-body portrait so hands NEVER poke below mirror frame!
    const armLen = this.upperBodyOnly ? 0.19 : (this.isChild ? 0.29 : 0.43);
    const armCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.01, -0.004),
      new THREE.Vector3(side * 0.030, -armLen * 0.45, 0.018),
      new THREE.Vector3(side * 0.018, -armLen * 0.90, 0.052)
    ]);
    const sleeveGeo = new THREE.TubeGeometry(armCurve, 14, rSleeve, 12, false);
    const sPos = sleeveGeo.attributes.position;
    for (let i = 0; i < sPos.count; i++) {
      const seg = Math.floor(i / 13);
      const t = seg / 14;
      const puff = t < 0.25 ? 1.08 : (1.0 - t * 0.16);
      const cPt = armCurve.getPointAt(t);
      sPos.setXYZ(
        i,
        cPt.x + (sPos.getX(i) - cPt.x) * puff,
        cPt.y + (sPos.getY(i) - cPt.y) * puff,
        cPt.z + (sPos.getZ(i) - cPt.z) * puff
      );
    }
    sleeveGeo.computeVertexNormals();
    const sleeveMesh = new THREE.Mesh(sleeveGeo, this.dressMat);
    sleeveMesh.castShadow = true;
    pivot.add(sleeveMesh);

    const elbow = new THREE.Group();
    elbow.position.set(side * 0.018, -armLen * 0.90, 0.052);
    pivot.add(elbow);

    if (!this.upperBodyOnly) {
      const cuff = new THREE.Mesh(
        new THREE.CylinderGeometry(this.isChild ? 0.034 : 0.044, this.isChild ? 0.035 : 0.045, 0.028, 14),
        whiteLinenMat
      );
      cuff.rotation.x = -0.22;
      elbow.add(cuff);

      const hand = new THREE.Mesh(new THREE.SphereGeometry(this.isChild ? 0.032 : 0.042, 14, 12), skinMat);
      hand.scale.set(0.84, 1.12, 0.68);
      hand.position.set(0, -0.036, 0.012);
      hand.castShadow = true;
      elbow.add(hand);
    }

    return { pivot, elbow, side };
  }

  equipUniformPiece(pieceType, variantIndex = 0, tiltAngle = 0) {
    if (this.role !== 'girl') return;
    if (pieceType === 'dress') {
      const col = this.uniformPalette[variantIndex % this.uniformPalette.length];
      this.dressMat.color.setHex(col);
      if (this.uniformCollar) this.uniformCollar.visible = true;
    } else if (pieceType === 'apron') {
      if (this.uniformApron) this.uniformApron.visible = true;
    } else if (pieceType === 'cap') {
      if (this.uniformCap) {
        this.uniformCap.visible = true;
        this.uniformCap.rotation.z = Math.max(-0.22, Math.min(0.22, tiltAngle));
      }
    }
  }

  setExpression(expr, duration = 2.0) {
    this.expression = expr;
    this.exprTimer = duration;
  }

  update(time, dt) {
    if (this.exprTimer > 0) {
      this.exprTimer -= dt;
      if (this.exprTimer <= 0 && this.expression !== 'concentrate') {
        this.expression = 'idle';
      }
    }

    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blinkAmount = 1.0;
      this.blinkTimer = 2.5 + Math.random() * 3.0;
    } else {
      this.blinkAmount = Math.max(0, this.blinkAmount - dt * 9.5);
    }

    let headTiltZ = Math.sin(time * 1.2) * 0.025;
    let headPitchX = Math.sin(time * 0.9) * 0.02;
    let headYawY = this.lookTargetOffset.x * 0.35;
    let browLiftL = 0, browLiftR = 0, browRotL = 0, browRotR = 0;
    let happySquint = 0;
    let mouthOpen = 0.06;
    let mouthSmile = 0.16;
    let blushAlpha = 0.22;
    let armPose = 'relaxed';

    switch (this.expression) {
      case 'huh':
        headTiltZ = 0.24;
        headPitchX = -0.05;
        browLiftL = 0.011;
        browLiftR = -0.003;
        browRotL = 0.25;
        browRotR = -0.18;
        mouthOpen = 0.44;
        mouthSmile = -0.08;
        blushAlpha = 0.28;
        armPose = 'huh';
        break;

      case 'delight':
      case 'proud':
        headTiltZ = Math.sin(time * 5.5) * 0.065;
        headPitchX = Math.sin(time * 7.0) * 0.04 - 0.03;
        browLiftL = 0.008;
        browLiftR = 0.008;
        happySquint = 0.78;
        mouthOpen = 0.54 + Math.sin(time * 8.0) * 0.10;
        mouthSmile = 0.36;
        blushAlpha = 0.44;
        armPose = this.expression === 'proud' ? 'proud' : 'clap';
        break;

      case 'concentrate':
        headPitchX = 0.08;
        browLiftL = -0.002;
        browLiftR = -0.002;
        mouthOpen = 0.05;
        mouthSmile = 0.18;
        blushAlpha = 0.28;
        break;

      case 'blunder':
        headTiltZ = -0.16;
        headPitchX = 0.10;
        browLiftL = 0.010;
        browLiftR = 0.010;
        browRotL = -0.32;
        browRotR = 0.32;
        mouthOpen = 0.58;
        mouthSmile = -0.12;
        blushAlpha = 0.48;
        armPose = 'oops';
        break;

      case 'munch':
        headTiltZ = Math.sin(time * 7.0) * 0.08;
        happySquint = 0.85;
        mouthOpen = 0.16 + Math.abs(Math.sin(time * 10.5)) * 0.30;
        mouthSmile = 0.32;
        blushAlpha = 0.48;
        armPose = 'munch';
        break;

      default:
        mouthSmile = 0.18;
        break;
    }

    const lerp = Math.min(1, dt * 9.0);
    this.headGroup.rotation.z += (headTiltZ - this.headGroup.rotation.z) * lerp;
    this.headGroup.rotation.x += (headPitchX + this.lookTargetOffset.y * 0.25 - this.headGroup.rotation.x) * lerp;
    this.headGroup.rotation.y += (headYawY - this.headGroup.rotation.y) * lerp;

    this.bodyPivot.position.y = Math.sin(time * 2.1) * 0.005;

    const upperClose = Math.max(this.blinkAmount, happySquint * 0.52);
    this.upperLids.forEach((lid) => { lid.rotation.x = upperClose * 0.78; });
    this.lowerLids.forEach((lid) => { lid.rotation.x = 0.44 - happySquint * 0.38; });

    this.brows[0].mesh.position.y += (this.brows[0].baseY + browLiftL - this.brows[0].mesh.position.y) * lerp;
    this.brows[1].mesh.position.y += (this.brows[1].baseY + browLiftR - this.brows[1].mesh.position.y) * lerp;
    this.brows[0].mesh.rotation.z += (browRotL - this.brows[0].mesh.rotation.z) * lerp;
    this.brows[1].mesh.rotation.z += (browRotR - this.brows[1].mesh.rotation.z) * lerp;

    this.mouthCavity.scale.y += ((0.12 + mouthOpen * 1.1) - this.mouthCavity.scale.y) * lerp;
    this.mouthCavity.scale.x += ((1.15 - (mouthSmile < 0 ? 0.35 : 0)) - this.mouthCavity.scale.x) * lerp;
    this.lowerLip.position.y += ((-0.002 - mouthOpen * 0.014) - this.lowerLip.position.y) * lerp;
    this.mouthGroup.scale.x += ((0.94 + Math.max(0, mouthSmile) * 0.50) - this.mouthGroup.scale.x) * lerp;
    this.cheekMat.opacity += (blushAlpha - this.cheekMat.opacity) * lerp;

    const setArm = (arm, rx, rz) => {
      arm.pivot.rotation.x += (rx - arm.pivot.rotation.x) * lerp;
      arm.pivot.rotation.z += (rz - arm.pivot.rotation.z) * lerp;
    };

    if (armPose === 'clap') {
      const clapWave = Math.abs(Math.sin(time * 9.0)) * 0.22;
      setArm(this.leftArm, -0.78, 0.28 - clapWave);
      setArm(this.rightArm, -0.78, -0.28 + clapWave);
    } else if (armPose === 'proud') {
      setArm(this.leftArm, -0.35, -0.20);
      setArm(this.rightArm, -0.35, 0.20);
    } else if (armPose === 'huh') {
      setArm(this.leftArm, -0.10, -0.05);
      setArm(this.rightArm, -0.95, -0.25);
    } else if (armPose === 'oops') {
      setArm(this.leftArm, -1.05, 0.24);
      setArm(this.rightArm, -1.05, -0.24);
    } else if (armPose === 'munch') {
      setArm(this.leftArm, -0.25, -0.08);
      setArm(this.rightArm, -1.10, -0.26);
    } else {
      const sway = Math.sin(time * 1.6) * 0.03;
      setArm(this.leftArm, -0.04 + sway, -0.04);
      setArm(this.rightArm, -0.04 - sway, 0.04);
    }
  }
}

export class DaughterHandCursor {
  constructor(linenMaterial) {
    this.group = new THREE.Group();
    const skinMat = createSkinMaterial(0.01);
    this.sleeveMat = new THREE.MeshPhysicalMaterial({
      color: 0x5c4332,
      roughness: 0.80,
      sheen: 0.65,
      sheenColor: new THREE.Color(0xf5ede2)
    });
    const whiteLinen = linenMaterial
      ? linenMaterial.clone()
      : new THREE.MeshPhysicalMaterial({ color: 0xfaf7f2, roughness: 0.76, sheen: 0.75 });

    this.rig = new THREE.Group();
    this.group.add(this.rig);

    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.066, 20, 16), skinMat);
    palm.scale.set(1.02, 0.48, 1.12);
    palm.position.set(0, 0.022, 0.035);
    palm.castShadow = true;
    this.rig.add(palm);

    this.fingers = [];
    const fingerSpecs = [
      { x: -0.042, len: 0.066, r: 0.0145, z: -0.018, yaw: 0.10 },
      { x: -0.014, len: 0.076, r: 0.0155, z: -0.026, yaw: 0.03 },
      { x: 0.014, len: 0.072, r: 0.015, z: -0.024, yaw: -0.03 },
      { x: 0.040, len: 0.058, r: 0.0135, z: -0.014, yaw: -0.11 }
    ];
    for (const sp of fingerSpecs) {
      const fBase = new THREE.Group();
      fBase.position.set(sp.x, 0.022, sp.z);
      fBase.rotation.y = sp.yaw;

      const seg1 = new THREE.Mesh(new THREE.CapsuleGeometry(sp.r, sp.len * 0.48, 6, 10), skinMat);
      seg1.rotation.x = Math.PI / 2;
      seg1.position.set(0, 0, -sp.len * 0.28);
      seg1.castShadow = true;
      fBase.add(seg1);

      const tipPivot = new THREE.Group();
      tipPivot.position.set(0, 0, -sp.len * 0.56);
      fBase.add(tipPivot);

      const seg2 = new THREE.Mesh(new THREE.CapsuleGeometry(sp.r * 0.88, sp.len * 0.40, 6, 10), skinMat);
      seg2.rotation.x = Math.PI / 2;
      seg2.position.set(0, 0, -sp.len * 0.22);
      seg2.castShadow = true;
      tipPivot.add(seg2);

      this.rig.add(fBase);
      this.fingers.push({ fBase, tipPivot });
    }

    this.thumbPivot = new THREE.Group();
    this.thumbPivot.position.set(-0.058, 0.016, 0.042);
    this.thumbPivot.rotation.y = 0.58;
    const thumbMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.016, 0.044, 6, 10), skinMat);
    thumbMesh.rotation.x = Math.PI / 2;
    thumbMesh.position.set(0, 0, -0.026);
    thumbMesh.castShadow = true;
    this.thumbPivot.add(thumbMesh);
    this.rig.add(this.thumbPivot);

    const wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.050, 0.10, 16), skinMat);
    wrist.rotation.x = Math.PI / 2 - 0.20;
    wrist.position.set(0.015, 0.036, 0.115);
    wrist.castShadow = true;
    this.rig.add(wrist);

    const linenCuff = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.062, 0.058, 20), whiteLinen);
    linenCuff.rotation.x = Math.PI / 2 - 0.24;
    linenCuff.position.set(0.026, 0.048, 0.168);
    linenCuff.castShadow = true;
    this.rig.add(linenCuff);

    // Long continuous first-person forearm & upper-arm sleeve extending cleanly off bottom-right of viewport!
    const armCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.030, 0.052, 0.19),
      new THREE.Vector3(0.18, -0.02, 0.68),
      new THREE.Vector3(0.48, -0.22, 1.55)
    ]);
    const sleeve = new THREE.Mesh(new THREE.TubeGeometry(armCurve, 14, 0.064, 16, false), this.sleeveMat);
    sleeve.castShadow = true;
    this.rig.add(sleeve);

    this.targetPos = new THREE.Vector3(0.4, 0.9, 0.8);
    this.group.position.copy(this.targetPos);
    this.mode = 'hover';
    this.group.visible = false;
  }

  setSleeveColor(hex) {
    this.sleeveMat.color.setHex(hex);
  }

  setTarget(worldPos, mode = 'hover', visible = true) {
    this.targetPos.copy(worldPos);
    this.mode = mode;
    if (visible) this.group.visible = true;
    this.wantVisible = visible;
  }

  update(dt) {
    const lerp = Math.min(1, dt * 18.0);
    const prevX = this.group.position.x;
    this.group.position.lerp(this.targetPos, lerp);
    const vx = (this.group.position.x - prevX) / Math.max(0.008, dt);

    const targetRoll = Math.max(-0.35, Math.min(0.35, -vx * 0.08));
    this.rig.rotation.z += (targetRoll - this.rig.rotation.z) * Math.min(1, dt * 10);

    let baseCurl = 0.22, tipCurl = 0.25, pitch = 0.18;
    if (this.mode === 'pinch') { baseCurl = 0.72; tipCurl = 0.78; pitch = 0.34; }
    else if (this.mode === 'smooth') { baseCurl = 0.06; tipCurl = 0.08; pitch = 0.08; }
    else if (this.mode === 'tap') { baseCurl = 0.35; tipCurl = 0.40; pitch = 0.42; }

    const cLerp = Math.min(1, dt * 14.0);
    this.rig.rotation.x += (pitch - this.rig.rotation.x) * cLerp;
    for (const f of this.fingers) {
      f.fBase.rotation.x += (baseCurl - f.fBase.rotation.x) * cLerp;
      f.tipPivot.rotation.x += (tipCurl - f.tipPivot.rotation.x) * cLerp;
    }
    this.thumbPivot.rotation.x += (baseCurl * 0.75 - this.thumbPivot.rotation.x) * cLerp;

    if (!this.wantVisible) {
      this.group.position.z += dt * 2.1;
      this.group.position.y -= dt * 0.45;
      if (this.group.position.z > this.targetPos.z + 1.1) {
        this.group.visible = false;
      }
    }
  }
}
