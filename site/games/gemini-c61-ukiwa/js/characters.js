import * as THREE from '../vendor/three.module.min.js';

// Expressive 3D Family Characters, 3 Tactile Summer Outfits on Wooden Rack, and Player's 3D Hand

export const OUTFIT_THEMES = [
  {
    id: 0,
    primary: 0xffd43b,   // Sunny Yellow
    secondary: 0xffffff, // Crisp White Stripes
    hatColor: 0xf5d693,  // Woven Straw Sunhat
    ribbonColor: 0xffb703
  },
  {
    id: 1,
    primary: 0xff6b8b,   // Coral Rose
    secondary: 0xffe3ec, // Soft Blossom Ruffle
    hatColor: 0xff6b8b,  // Coral Sun Visor
    ribbonColor: 0xffffff
  },
  {
    id: 2,
    primary: 0x4dabf7,   // Marine Sky Blue
    secondary: 0xffffff, // Sailor Collar White
    hatColor: 0xf8f9fa,  // Crisp Summer Sunhat
    ribbonColor: 0x228be6
  }
];

function createSkinMaterial(tint = 0xffe0c8) {
  return new THREE.MeshPhysicalMaterial({
    color: tint,
    roughness: 0.58,
    metalness: 0.0,
    sheen: 0.35,
    sheenRoughness: 0.65,
    sheenColor: new THREE.Color(0xffbfa8),
    clearcoat: 0.05
  });
}

function createFabricMaterial(color) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.78,
    metalness: 0.0,
    sheen: 0.75,
    sheenRoughness: 0.6,
    sheenColor: new THREE.Color(0xffffff)
  });
}

export class FamilyCharacter {
  constructor(role = 'girl') {
    this.role = role; // 'girl' | 'dad' | 'mom'
    this.group = new THREE.Group();
    this.mood = 'happy'; // 'happy' | 'huh' | 'excited' | 'calm'
    this.moodTimer = 0;
    this.blinkTimer = Math.random() * 3.0;
    this.outfitIndex = 0;
    this.seated = false;

    this._build();
  }

  _build() {
    const scale = this.role === 'dad' ? 1.24 : this.role === 'mom' ? 1.12 : 0.84;
    // Warm sunlit realistic human skin tones (not chalky white!)
    const skinTint = this.role === 'dad' ? 0xe8af88 : this.role === 'mom' ? 0xf2c2a2 : 0xf6c9ab;
    this.skinMat = createSkinMaterial(skinTint);

    this.root = new THREE.Group();
    this.root.scale.setScalar(scale);
    this.group.add(this.root);

    // Pelvis / Shorts
    const shortsColor = this.role === 'dad' ? 0x3b5bdb : this.role === 'mom' ? 0x5c7cfa : 0xf783ac;
    this.shortsMat = createFabricMaterial(shortsColor);
    const pelvis = new THREE.Mesh(new THREE.SphereGeometry(0.18, 20, 16), this.shortsMat);
    pelvis.scale.set(1.12, 0.85, 0.92);
    pelvis.position.y = 0.50;
    pelvis.castShadow = true;
    this.root.add(pelvis);

    // Legs (with hip pivots so characters can stand OR sit naturally inside pool floats!)
    this.leftLeg = new THREE.Group();
    this.leftLeg.position.set(-0.10, 0.46, 0);
    this.rightLeg = new THREE.Group();
    this.rightLeg.position.set(0.10, 0.46, 0);

    [this.leftLeg, this.rightLeg].forEach((leg) => {
      const shortCuff = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.076, 0.16, 16), this.shortsMat);
      shortCuff.position.y = -0.07;
      const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.058, 0.24, 8, 14), this.skinMat);
      shin.position.y = -0.25;
      shin.castShadow = true;
      const sandalMat = createFabricMaterial(this.role === 'dad' ? 0x495057 : 0xffec99);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.055, 0.18), sandalMat);
      foot.position.set(0, -0.43, 0.035);
      foot.castShadow = true;
      leg.add(shortCuff, shin, foot);
      this.root.add(leg);
    });

    // Torso / Summer Shirt
    const baseTopColor = this.role === 'dad' ? 0x74c0fc : this.role === 'mom' ? 0xe5dbff : 0xffd43b;
    this.topMat = createFabricMaterial(baseTopColor);
    this.collarMat = createFabricMaterial(0xffffff);

    this.torsoGroup = new THREE.Group();
    this.torsoGroup.position.y = 0.56;
    this.root.add(this.torsoGroup);

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.175, 0.24, 12, 20), this.topMat);
    torso.scale.set(1.08, 1.0, 0.84);
    torso.position.y = 0.20;
    torso.castShadow = true;
    this.torsoGroup.add(torso);

    // Collar / Capelet accent (changes with outfit on girl)
    this.collarMesh = new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.038, 12, 24), this.collarMat);
    this.collarMesh.rotation.x = Math.PI / 2 + 0.12;
    this.collarMesh.position.y = 0.37;
    this.torsoGroup.add(this.collarMesh);

    // Arms
    this.leftArm = new THREE.Group();
    this.leftArm.position.set(-0.21, 0.35, 0);
    this.rightArm = new THREE.Group();
    this.rightArm.position.set(0.21, 0.35, 0);

    [this.leftArm, this.rightArm].forEach((arm, idx) => {
      const side = idx === 0 ? -1 : 1;
      const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.074, 0.14, 16), this.topMat);
      sleeve.position.set(side * 0.02, -0.05, 0);
      sleeve.rotation.z = side * 0.22;
      const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.048, 0.20, 8, 14), this.skinMat);
      forearm.position.set(side * 0.05, -0.20, 0.03);
      forearm.rotation.z = side * 0.18;
      forearm.castShadow = true;
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.058, 14, 12), this.skinMat);
      hand.position.set(side * 0.08, -0.34, 0.05);
      arm.add(sleeve, forearm, hand);
      this.torsoGroup.add(arm);
    });

    // Head & Expressive Face Rig
    this.headGroup = new THREE.Group();
    this.headGroup.position.y = 0.44;
    this.torsoGroup.add(this.headGroup);

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.075, 0.10, 14), this.skinMat);
    neck.position.y = 0.03;
    this.headGroup.add(neck);

    const headRadius = this.role === 'girl' ? 0.225 : 0.195;
    const head = new THREE.Mesh(new THREE.SphereGeometry(headRadius, 28, 24), this.skinMat);
    head.scale.set(0.98, 1.04, 0.96);
    head.position.y = 0.22;
    head.castShadow = true;
    this.headGroup.add(head);

    // Sculpted Natural Hair (high crown + parted side bangs ABOVE eyebrows so eyes & expressions shine clearly!)
    const hairColor = this.role === 'dad' ? 0x261c16 : this.role === 'mom' ? 0x452d1e : 0x3b2417;
    const hairMat = new THREE.MeshPhysicalMaterial({
      color: hairColor,
      roughness: 0.46,
      sheen: 0.55,
      sheenRoughness: 0.45,
      sheenColor: new THREE.Color(0x8f654c)
    });
    const hairBack = new THREE.Mesh(
      new THREE.SphereGeometry(headRadius * 1.04, 24, 20, 0, Math.PI * 2, 0, Math.PI * 0.58),
      hairMat
    );
    hairBack.position.set(0, 0.245, -0.032);
    hairBack.rotation.x = -0.46; // Tilted back so face & forehead are open and bright!
    this.headGroup.add(hairBack);

    // Soft side-parted bangs framing upper temples above eyebrows
    [-1, 1].forEach((side) => {
      const bang = new THREE.Mesh(new THREE.CapsuleGeometry(headRadius * 0.19, headRadius * 0.42, 8, 12), hairMat);
      bang.position.set(side * headRadius * 0.46, 0.335, headRadius * 0.68);
      bang.rotation.z = side * 0.88;
      bang.rotation.x = 0.25;
      this.headGroup.add(bang);

      // Natural ears
      const ear = new THREE.Mesh(new THREE.SphereGeometry(headRadius * 0.18, 10, 10), this.skinMat);
      ear.scale.set(0.55, 1.0, 0.75);
      ear.position.set(side * headRadius * 0.95, 0.21, 0.0);
      this.headGroup.add(ear);
    });

    if (this.role === 'girl') {
      // Natural shoulder-skimming twin ponytails
      [-1, 1].forEach((side) => {
        const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.062, 0.12, 8, 12), hairMat);
        tail.position.set(side * 0.215, 0.155, -0.055);
        tail.rotation.z = side * 0.32;
        this.headGroup.add(tail);
      });
    } else if (this.role === 'mom') {
      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.105, 16, 14), hairMat);
      bun.position.set(0, 0.31, -0.19);
      this.headGroup.add(bun);
    }

    // Hat (on Girl & Mom)
    this.hatGroup = new THREE.Group();
    this.hatGroup.position.set(0, 0.36, 0);
    this.headGroup.add(this.hatGroup);

    if (this.role === 'girl' || this.role === 'mom') {
      this.hatBrimMat = createFabricMaterial(this.role === 'mom' ? 0xf3d9a4 : 0xf5d693);
      this.hatRibbonMat = createFabricMaterial(this.role === 'mom' ? 0xffffff : 0xffb703);

      this.hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.34, 0.018, 28), this.hatBrimMat);
      this.hatBrim.scale.set(1.0, 1.0, 1.05);
      this.hatBrim.rotation.x = -0.14;
      this.hatBrim.castShadow = true;

      this.hatCrown = new THREE.Mesh(new THREE.SphereGeometry(0.195, 22, 16, 0, Math.PI * 2, 0, Math.PI * 0.52), this.hatBrimMat);
      this.hatCrown.position.y = -0.01;
      this.hatCrown.rotation.x = -0.14;

      const ribbon = new THREE.Mesh(new THREE.TorusGeometry(0.192, 0.018, 10, 26), this.hatRibbonMat);
      ribbon.rotation.x = Math.PI / 2 - 0.14;
      ribbon.position.y = 0.015;

      this.hatGroup.add(this.hatBrim, this.hatCrown, ribbon);
      if (this.role === 'girl') this.hatGroup.visible = false; // Appears once player picks her outfit!
    }

    // Facial Features: Eyes, Eyebrows, Cheeks, Expressive Mouths!
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x241712, roughness: 0.25 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
    const blushMat = new THREE.MeshBasicMaterial({ color: 0xff9aa2, transparent: true, opacity: 0.45 });
    const mouthMat = new THREE.MeshStandardMaterial({ color: 0xe05263, roughness: 0.4 });

    const fz = headRadius * 0.93;
    this.eyes = [];
    this.brows = [];

    [-1, 1].forEach((side) => {
      const eyePivot = new THREE.Group();
      eyePivot.position.set(side * headRadius * 0.36, 0.22, fz);

      const iris = new THREE.Mesh(new THREE.SphereGeometry(0.028, 14, 12), darkMat);
      iris.scale.set(1, 1.15, 0.4);
      const highlight = new THREE.Mesh(new THREE.SphereGeometry(0.010, 8, 8), whiteMat);
      highlight.position.set(side * 0.008, 0.010, 0.012);
      eyePivot.add(iris, highlight);
      this.headGroup.add(eyePivot);
      this.eyes.push(eyePivot);

      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.012, 0.014), darkMat);
      brow.position.set(side * headRadius * 0.36, 0.278, fz + 0.005);
      this.headGroup.add(brow);
      this.brows.push(brow);

      const blush = new THREE.Mesh(new THREE.CircleGeometry(0.036, 14), blushMat);
      blush.position.set(side * headRadius * 0.54, 0.178, fz * 0.92);
      blush.rotation.y = side * 0.35;
      this.headGroup.add(blush);
    });

    // Nose
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 10), this.skinMat);
    nose.position.set(0, 0.195, fz + 0.02);
    this.headGroup.add(nose);

    // 3 Mouth states: Happy Smile Arc, Delighted Open Laugh, and Surprised "Huh?!" ("あれ？") Small O!
    this.smileMouth = new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.009, 8, 18, Math.PI), mouthMat);
    this.smileMouth.rotation.z = Math.PI;
    this.smileMouth.position.set(0, 0.158, fz + 0.006);

    this.laughMouth = new THREE.Mesh(new THREE.CircleGeometry(0.046, 16, 0, Math.PI), mouthMat);
    this.laughMouth.rotation.z = Math.PI;
    this.laughMouth.position.set(0, 0.158, fz + 0.008);
    this.laughMouth.visible = false;

    this.huhMouth = new THREE.Mesh(new THREE.RingGeometry(0.012, 0.026, 16), mouthMat);
    this.huhMouth.position.set(0, 0.145, fz + 0.01);
    this.huhMouth.visible = false;

    this.headGroup.add(this.smileMouth, this.laughMouth, this.huhMouth);
  }

  applyOutfit(outfitIndex) {
    this.outfitIndex = outfitIndex;
    const theme = OUTFIT_THEMES[outfitIndex % OUTFIT_THEMES.length];
    this.topMat.color.setHex(theme.primary);
    this.collarMat.color.setHex(theme.secondary);
    if (this.hatGroup) {
      this.hatGroup.visible = true;
      this.hatBrimMat.color.setHex(theme.hatColor);
      this.hatRibbonMat.color.setHex(theme.ribbonColor);
      // Outfit 1 is a sporty sun visor (crown open)
      this.hatCrown.visible = outfitIndex !== 1;
    }
  }

  setMood(mood, duration = 1.6) {
    this.mood = mood;
    this.moodTimer = duration;
    this.smileMouth.visible = mood === 'calm' || mood === 'happy';
    this.laughMouth.visible = mood === 'excited';
    this.huhMouth.visible = mood === 'huh';
  }

  setSeated(isSeated) {
    this.seated = isSeated;
    if (isSeated) {
      this.leftLeg.rotation.x = -1.25;
      this.leftLeg.rotation.z = -0.18;
      this.rightLeg.rotation.x = -1.25;
      this.rightLeg.rotation.z = 0.18;
      this.root.position.y = -0.28;
    } else {
      this.leftLeg.rotation.set(0, 0, 0);
      this.rightLeg.rotation.set(0, 0, 0);
      this.root.position.y = 0;
    }
  }

  update(dt, elapsed, lookTargetWorld = null) {
    if (this.moodTimer > 0) {
      this.moodTimer -= dt;
      if (this.moodTimer <= 0) {
        // After "huh" ("あれ？"), always transition into delighted laughter!
        if (this.mood === 'huh') {
          this.setMood('excited', 1.8);
        } else {
          this.setMood('happy', 0);
        }
      }
    }

    // Natural eye blinking
    this.blinkTimer -= dt;
    let eyeScaleY = 1.0;
    if (this.blinkTimer < 0) {
      eyeScaleY = 0.1;
      if (this.blinkTimer < -0.11) {
        this.blinkTimer = 2.4 + Math.random() * 2.8;
      }
    }
    if (this.mood === 'excited') eyeScaleY = Math.min(eyeScaleY, 0.45);
    if (this.mood === 'huh') eyeScaleY = 1.28;

    this.eyes.forEach((e) => {
      e.scale.y = eyeScaleY;
    });

    // Expressive eyebrows + head tilt
    if (this.mood === 'huh') {
      // Cute "あれ？" tilted head & asymmetric raised brow!
      this.headGroup.rotation.z = THREE.MathUtils.lerp(this.headGroup.rotation.z, 0.28, dt * 10);
      this.brows[0].position.y = 0.298;
      this.brows[0].rotation.z = 0.22;
      this.brows[1].position.y = 0.272;
      this.brows[1].rotation.z = -0.08;
      this.leftArm.rotation.z = -0.65;
      this.rightArm.rotation.z = 0.85;
    } else if (this.mood === 'excited') {
      this.headGroup.rotation.z = Math.sin(elapsed * 12) * 0.08;
      this.brows[0].position.y = 0.288;
      this.brows[1].position.y = 0.288;
      this.brows[0].rotation.z = 0.12;
      this.brows[1].rotation.z = -0.12;
      // Joyful raised arms!
      this.leftArm.rotation.z = -2.2 + Math.sin(elapsed * 14) * 0.25;
      this.rightArm.rotation.z = 2.2 - Math.sin(elapsed * 14) * 0.25;
      this.torsoGroup.position.y = 0.56 + Math.abs(Math.sin(elapsed * 9)) * 0.05;
    } else {
      this.headGroup.rotation.z = THREE.MathUtils.lerp(this.headGroup.rotation.z, Math.sin(elapsed * 1.5) * 0.03, dt * 6);
      this.brows[0].position.y = 0.278;
      this.brows[1].position.y = 0.278;
      this.brows[0].rotation.z = 0.05;
      this.brows[1].rotation.z = -0.05;
      this.leftArm.rotation.z = THREE.MathUtils.lerp(this.leftArm.rotation.z, -0.18 - Math.sin(elapsed * 2) * 0.05, dt * 6);
      this.rightArm.rotation.z = THREE.MathUtils.lerp(this.rightArm.rotation.z, 0.18 + Math.sin(elapsed * 2) * 0.05, dt * 6);
      this.torsoGroup.position.y = 0.56 + Math.sin(elapsed * 2.4) * 0.012;
    }

    if (this.seated) {
      // Gentle playful leg kicking on the water!
      const kick = Math.sin(elapsed * 5.5) * 0.16;
      this.leftLeg.rotation.x = -1.2 + kick;
      this.rightLeg.rotation.x = -1.2 - kick;
    }

    if (lookTargetWorld) {
      const localLook = this.group.worldToLocal(lookTargetWorld.clone());
      const yaw = THREE.MathUtils.clamp(Math.atan2(localLook.x, localLook.z), -0.55, 0.55);
      this.headGroup.rotation.y = THREE.MathUtils.lerp(this.headGroup.rotation.y, yaw, dt * 5);
    } else {
      this.headGroup.rotation.y = THREE.MathUtils.lerp(this.headGroup.rotation.y, 0, dt * 4);
    }
  }
}

// 3 Tactile Hanging Outfits on a Sunlit Natural Wood Stand (Scene 0 Role Selection)
export class OutfitRack {
  constructor() {
    this.group = new THREE.Group();
    this.hangers = [];
    this._build();
  }

  _build() {
    const woodMat = new THREE.MeshStandardMaterial({ color: 0xc9935b, roughness: 0.55 });

    // Wooden A-frame garment rack
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 2.35, 16), woodMat);
    bar.rotation.z = Math.PI / 2;
    bar.position.y = 1.42;
    bar.castShadow = true;
    this.group.add(bar);

    [-1.12, 1.12].forEach((x) => {
      const post1 = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.03, 1.48, 14), woodMat);
      post1.position.set(x, 0.72, 0.18);
      post1.rotation.x = -0.13;
      post1.castShadow = true;
      const post2 = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.03, 1.48, 14), woodMat);
      post2.position.set(x, 0.72, -0.18);
      post2.rotation.x = 0.13;
      post2.castShadow = true;
      this.group.add(post1, post2);
    });

    // 3 Hanger Outfits spaced widely for easy one-finger tapping!
    const xOffsets = [-0.74, 0.0, 0.74];
    OUTFIT_THEMES.forEach((theme, idx) => {
      const itemGroup = new THREE.Group();
      itemGroup.position.set(xOffsets[idx], 1.40, 0);
      itemGroup.userData.outfitIndex = idx;

      // Metal hook + wood hanger
      const hook = new THREE.Mesh(
        new THREE.TorusGeometry(0.045, 0.007, 8, 16, Math.PI * 1.4),
        new THREE.MeshStandardMaterial({ color: 0xced4da, metalness: 0.85, roughness: 0.2 })
      );
      hook.position.y = -0.02;

      const shoulder = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.10, 4), woodMat);
      shoulder.scale.set(1.0, 1.0, 0.22);
      shoulder.position.y = -0.10;

      const mainClothMat = createFabricMaterial(theme.primary);
      const accentClothMat = createFabricMaterial(theme.secondary);
      const hatMat = createFabricMaterial(theme.hatColor);

      // Cute Summer Shirt body + sleeves
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.25, 0.48, 22), mainClothMat);
      body.scale.set(1.05, 1.0, 0.42);
      body.position.y = -0.36;
      body.castShadow = true;

      const collar = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.032, 10, 20), accentClothMat);
      collar.rotation.x = Math.PI / 2 + 0.3;
      collar.position.set(0, -0.15, 0.04);

      [-1, 1].forEach((s) => {
        const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 0.24, 16), mainClothMat);
        sleeve.position.set(s * 0.24, -0.26, 0);
        sleeve.rotation.z = s * 0.48;
        sleeve.castShadow = true;
        const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.082, 0.018, 8, 16), accentClothMat);
        cuff.rotation.x = Math.PI / 2;
        cuff.position.y = -0.11;
        sleeve.add(cuff);
        itemGroup.add(sleeve);
      });

      // Matching Summer Hat perched right above/front of hanger!
      const hatGroup = new THREE.Group();
      hatGroup.position.set(0, 0.14, 0.08);
      hatGroup.rotation.x = 0.35;
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.016, 24), hatMat);
      brim.castShadow = true;
      hatGroup.add(brim);
      if (idx !== 1) {
        const crown = new THREE.Mesh(new THREE.SphereGeometry(0.135, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.5), hatMat);
        hatGroup.add(crown);
      }
      const rib = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.015, 8, 22), createFabricMaterial(theme.ribbonColor));
      rib.rotation.x = Math.PI / 2;
      rib.position.y = 0.015;
      hatGroup.add(rib);

      // Invisible generous hit-box so 5-year-old finger never misses
      const hitBox = new THREE.Mesh(
        new THREE.BoxGeometry(0.66, 0.92, 0.42),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hitBox.position.y = -0.22;
      hitBox.userData.outfitIndex = idx;

      itemGroup.add(hook, shoulder, body, collar, hatGroup, hitBox);
      this.group.add(itemGroup);
      this.hangers.push({ group: itemGroup, hitBox, phase: idx * 1.2 });
    });
  }

  update(elapsed) {
    for (const h of this.hangers) {
      h.group.rotation.z = Math.sin(elapsed * 1.6 + h.phase) * 0.035;
      h.group.rotation.y = Math.cos(elapsed * 1.1 + h.phase) * 0.06;
    }
  }
}

// Player's 3D Hand & Dressed Sleeve ("指がその子の手になる")
export class PlayerHand {
  constructor() {
    this.group = new THREE.Group();
    this.targetPos = new THREE.Vector3(0, -5, 0);
    this.active = false;
    this.pressing = 0;

    const skinMat = createSkinMaterial(0xffe3ce);
    this.sleeveMat = createFabricMaterial(OUTFIT_THEMES[0].primary);
    this.cuffMat = createFabricMaterial(OUTFIT_THEMES[0].secondary);

    // Inner pivot oriented so palm faces down/forward naturally toward touched object
    this.handPivot = new THREE.Group();
    this.group.add(this.handPivot);

    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.095, 20, 16), skinMat);
    palm.scale.set(1.05, 0.62, 1.15);
    palm.castShadow = true;
    this.handPivot.add(palm);

    // 4 soft fingers + thumb
    [-0.054, -0.018, 0.018, 0.054].forEach((fx, i) => {
      const len = i === 1 || i === 2 ? 0.075 : 0.062;
      const finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.019, len, 6, 10), skinMat);
      finger.rotation.x = Math.PI / 2 + 0.18;
      finger.position.set(fx, -0.012, -0.095);
      finger.castShadow = true;
      this.handPivot.add(finger);
    });
    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.055, 6, 10), skinMat);
    thumb.rotation.set(0.3, 0.65, 0.4);
    thumb.position.set(-0.088, -0.01, -0.03);
    this.handPivot.add(thumb);

    // Forearm + Outfit Sleeve & Cuff!
    const wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.068, 0.16, 16), skinMat);
    wrist.rotation.x = Math.PI / 2 - 0.35;
    wrist.position.set(0.02, 0.04, 0.13);

    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.105, 0.36, 18), this.sleeveMat);
    sleeve.rotation.x = Math.PI / 2 - 0.35;
    sleeve.position.set(0.03, 0.11, 0.32);
    sleeve.castShadow = true;

    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.088, 0.022, 10, 20), this.cuffMat);
    cuff.rotation.x = -0.35;
    cuff.position.set(0.022, 0.055, 0.17);

    this.handPivot.add(wrist, sleeve, cuff);
    this.group.visible = false;
  }

  applyOutfit(outfitIndex) {
    const theme = OUTFIT_THEMES[outfitIndex % OUTFIT_THEMES.length];
    this.sleeveMat.color.setHex(theme.primary);
    this.cuffMat.color.setHex(theme.secondary);
  }

  setTouchWorld(pos, isDown) {
    this.active = isDown;
    if (pos) {
      this.targetPos.copy(pos);
      if (!this.group.visible) {
        this.group.position.copy(pos).add(new THREE.Vector3(0.2, 0.3, 0.4));
      }
      this.group.visible = true;
    }
  }

  update(dt) {
    if (this.active) {
      this.pressing = THREE.MathUtils.lerp(this.pressing, 1.0, Math.min(1, dt * 16));
      const desired = this.targetPos.clone().add(new THREE.Vector3(0.04, 0.06 - this.pressing * 0.03, 0.06));
      this.group.position.lerp(desired, Math.min(1, dt * 22));
      this.handPivot.rotation.x = -0.25 - this.pressing * 0.18;
    } else {
      this.pressing = THREE.MathUtils.lerp(this.pressing, 0.0, Math.min(1, dt * 10));
      this.group.position.y += dt * 0.9;
      this.group.position.z += dt * 0.7;
      if (this.pressing < 0.03) {
        this.group.visible = false;
      }
    }
  }
}
