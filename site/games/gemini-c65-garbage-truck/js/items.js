import * as THREE from '../vendor/three.module.min.js';
import { createWorkerCapMesh, createSafetyVestMesh } from './characters.js';

// Store original vertex positions on a BufferGeometry so we can physically crush & crease it in the truck hopper!
function prepareCrushableGeometry(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  g.computeVertexNormals();
  const pos = g.attributes.position;
  g.userData.basePos = new Float32Array(pos.array);
  return g;
}

export function applyCrushDeformation(rootObj, crushFactor) {
  const c = Math.max(0, Math.min(1, crushFactor));
  rootObj.traverse((child) => {
    if (child.isMesh && child.geometry && child.geometry.userData.basePos) {
      const base = child.geometry.userData.basePos;
      const attr = child.geometry.attributes.position;
      const arr = attr.array;
      const seed = child.id * 1.73;

      for (let i = 0; i < arr.length; i += 3) {
        const bx = base[i];
        const by = base[i + 1];
        const bz = base[i + 2];

        // Crumple noise facets (creasing cans, cartons, plastic bags!)
        const crumple = Math.sin(bx * 38.0 + by * 29.0 + seed) * Math.cos(bz * 34.0 - seed) * 0.018 * c;
        // Squash Y down to 24%, bulge X/Z outward slightly as volume compresses
        const squashY = 1.0 - c * 0.74;
        const bulgeXZ = 1.0 + c * 0.28;

        arr[i] = bx * bulgeXZ + crumple;
        arr[i + 1] = by * squashY + crumple * 0.45;
        arr[i + 2] = bz * bulgeXZ - crumple;
      }
      attr.needsUpdate = true;
      child.geometry.computeVertexNormals();
    }
  });
}

// Build Compact Low Municipal Gear Bench with 3 Caps & 3 Folded/Draped Reflective Safety Vests
// Kept intentionally low (y <= 0.42m) so the wet mirror pavement, puddles, long shadows, and giant Garbage Truck fill the view!
export function createDressUpStand() {
  const group = new THREE.Group();

  const woodMat = new THREE.MeshStandardMaterial({ color: 0x6f4e37, roughness: 0.72 });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.88, roughness: 0.24 });

  // Low two-tier steel-framed municipal gear bench
  const topPlank = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.032, 0.56), woodMat);
  topPlank.position.y = 0.20;
  topPlank.castShadow = true;
  topPlank.receiveShadow = true;
  group.add(topPlank);

  [-0.52, 0.52].forEach((lx) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.20, 0.50), steelMat);
    leg.position.set(lx, 0.10, 0);
    leg.castShadow = true;
    group.add(leg);
  });

  const capSpecs = [
    { color: 0x165b88, stripe: 0xfacc15, x: -0.36 },
    { color: 0xeab308, stripe: 0xf8fafc, x: 0.0 },
    { color: 0x0d9488, stripe: 0xfde047, x: 0.36 },
  ];

  const vestSpecs = [
    { color: 0x84cc16, x: -0.36 },
    { color: 0xf97316, x: 0.0 },
    { color: 0x38bdf8, x: 0.36 },
  ];

  const items = [];

  capSpecs.forEach((spec, i) => {
    const holder = new THREE.Group();
    const mesh = createWorkerCapMesh(spec.color, spec.stripe, 0.96);
    mesh.rotation.y = -0.14 + i * 0.14;
    holder.add(mesh);

    const hit = new THREE.Mesh(
      new THREE.SphereGeometry(0.20, 8, 8),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hit.position.y = 0.05;
    holder.add(hit);

    const home = new THREE.Vector3(spec.x, 0.22, 0.13);
    holder.position.copy(home);
    group.add(holder);

    const itemObj = {
      kind: 'cap',
      color: spec.color,
      stripe: spec.stripe,
      group: holder,
      hit,
      homePos: home.clone(),
      equipped: false,
    };
    hit.userData = { interactType: 'dressItem', dressObj: itemObj };
    items.push(itemObj);
  });

  vestSpecs.forEach((spec) => {
    const holder = new THREE.Group();
    const mesh = createSafetyVestMesh(spec.color, 0.78);
    // Draped neatly at a slight presentation tilt on the bench back row so it doesn't tower up!
    mesh.rotation.x = -0.68;
    holder.add(mesh);

    const hit = new THREE.Mesh(
      new THREE.SphereGeometry(0.21, 8, 8),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    holder.add(hit);

    const home = new THREE.Vector3(spec.x, 0.30, -0.12);
    holder.position.copy(home);
    group.add(holder);

    const itemObj = {
      kind: 'vest',
      color: spec.color,
      group: holder,
      hit,
      homePos: home.clone(),
      equipped: false,
    };
    hit.userData = { interactType: 'dressItem', dressObj: itemObj };
    items.push(itemObj);
  });

  group.position.set(-0.28, 0.0, 2.06);
  group.rotation.y = 0.14;

  return { group, items };
}

// Build the 4 Large Tactile Color & Pictorial Sorting Crates (びん・かん・紙・生ゴミ)
export function createSortingCrates(crateEmblems) {
  const specs = [
    { category: 'bottle', color: 0x1d4ed8, x: -0.66, z: 2.04, rotY: 0.16 },  // Cobalt Blue (Bottles)
    { category: 'can', color: 0xeab308, x: -0.10, z: 1.96, rotY: 0.05 },     // Sunny Yellow (Cans)
    { category: 'paper', color: 0xe2e8f0, x: 0.46, z: 1.98, rotY: -0.06 },   // Warm Ivory (Paper)
    { category: 'organic', color: 0x16a34a, x: 1.02, z: 2.10, rotY: -0.18 }, // Leaf Green (Organic)
  ];

  const crates = [];

  specs.forEach((s) => {
    const crateGroup = new THREE.Group();
    const hdpeMat = new THREE.MeshPhysicalMaterial({
      color: s.color,
      roughness: 0.36,
      metalness: 0.05,
      clearcoat: 0.28,
      clearcoatRoughness: 0.35,
    });
    const rimMat = new THREE.MeshStandardMaterial({
      color: s.category === 'paper' ? 0x64748b : s.color,
      roughness: 0.32,
      metalness: 0.15,
    });

    const w = 0.46;
    const h = 0.33;
    const d = 0.38;
    const t = 0.026;

    // Open-top molded crate floor + 4 ribbed walls + rolled rim handles!
    const bottom = new THREE.Mesh(new THREE.BoxGeometry(w, t, d), hdpeMat);
    bottom.position.y = t * 0.5;
    bottom.castShadow = true;
    bottom.receiveShadow = true;
    crateGroup.add(bottom);

    const frontWall = new THREE.Mesh(new THREE.BoxGeometry(w, h, t), hdpeMat);
    frontWall.position.set(0, h * 0.5, d * 0.5 - t * 0.5);
    frontWall.castShadow = true;
    frontWall.receiveShadow = true;
    crateGroup.add(frontWall);

    const backWall = new THREE.Mesh(new THREE.BoxGeometry(w, h, t), hdpeMat);
    backWall.position.set(0, h * 0.5, -d * 0.5 + t * 0.5);
    backWall.castShadow = true;
    crateGroup.add(backWall);

    [-1, 1].forEach((sx) => {
      const sideWall = new THREE.Mesh(new THREE.BoxGeometry(t, h, d - t * 2), hdpeMat);
      sideWall.position.set(sx * (w * 0.5 - t * 0.5), h * 0.5, 0);
      sideWall.castShadow = true;
      crateGroup.add(sideWall);
    });

    // Rolled top lip
    const topLip = new THREE.Mesh(new THREE.BoxGeometry(w + 0.03, 0.028, d + 0.03), rimMat);
    topLip.position.y = h;
    // Carve inner opening visually using dark interior shadow liner on bottom
    crateGroup.remove(topLip);
    [
      [0, h, d * 0.5, w + 0.03, 0.03, 0.035],
      [0, h, -d * 0.5, w + 0.03, 0.03, 0.035],
      [-w * 0.5, h, 0, 0.035, 0.03, d + 0.03],
      [w * 0.5, h, 0, 0.035, 0.03, d + 0.03],
    ].forEach(([px, py, pz, bw, bh, bd]) => {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), rimMat);
      bar.position.set(px, py, pz);
      bar.castShadow = true;
      crateGroup.add(bar);
    });

    // Large Pictorial Emblem Plate on Front Wall facing the player!
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(0.25, 0.24),
      new THREE.MeshStandardMaterial({
        map: crateEmblems[s.category],
        roughness: 0.28,
        metalness: 0.08,
      })
    );
    plate.position.set(0, h * 0.51, d * 0.5 + 0.004);
    crateGroup.add(plate);

    // Container mount inside crate where sorted items physically stack!
    const contentsMount = new THREE.Group();
    contentsMount.position.set(0, 0.06, 0);
    crateGroup.add(contentsMount);

    // Generous Hit Collider for dropping items in Scene 1 & grabbing crates to load Hopper in Scene 2!
    const hit = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.10, h + 0.24, d + 0.12),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hit.position.y = h * 0.55;
    crateGroup.add(hit);

    const homePos = new THREE.Vector3(s.x, 0.0, s.z);
    crateGroup.position.copy(homePos);
    crateGroup.rotation.y = s.rotY;

    const crateObj = {
      category: s.category,
      color: s.color,
      group: crateGroup,
      contentsMount,
      hit,
      homePos,
      homeRotY: s.rotY,
      items: [],
      loadedIntoHopper: false,
      bounceVel: 0,
    };
    hit.userData = { interactType: 'crate', crateObj };
    crates.push(crateObj);
  });

  return crates;
}

// Create Realistic Individual Recyclable 3D Objects (with crushable vertex buffers!)
export function createRecyclableItem(spec, textures) {
  const group = new THREE.Group();
  const { category, variant } = spec;

  if (category === 'bottle') {
    // Realistic Sculpted Glass Bottle (Emerald Green or Warm Amber) catching dawn speculars!
    const pts = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.046, 0.0),
      new THREE.Vector2(0.048, 0.13),
      new THREE.Vector2(0.022, 0.185),
      new THREE.Vector2(0.019, 0.245),
      new THREE.Vector2(0.023, 0.255),
      new THREE.Vector2(0.015, 0.255),
    ];
    const geo = prepareCrushableGeometry(new THREE.LatheGeometry(pts, 18));
    const isEmerald = variant % 2 === 0;
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: isEmerald ? 0x167954 : 0x9c4e18,
      roughness: 0.07,
      metalness: 0.05,
      transmission: 0.58,
      ior: 1.52,
      clearcoat: 1.0,
      envMapIntensity: 2.0,
    });
    const bottle = new THREE.Mesh(geo, glassMat);
    bottle.position.y = -0.11;
    bottle.castShadow = true;
    group.add(bottle);

    // Metallic cap ring
    const capRing = new THREE.Mesh(
      prepareCrushableGeometry(new THREE.CylinderGeometry(0.022, 0.022, 0.018, 14)),
      new THREE.MeshStandardMaterial({ color: 0xeab308, metalness: 0.85, roughness: 0.22 })
    );
    capRing.position.y = 0.14;
    group.add(capRing);
  } else if (category === 'can') {
    // Realistic Brushed Aluminum Can with Fruit Graphic Band (Zero text!)
    const canGeo = prepareCrushableGeometry(new THREE.CylinderGeometry(0.046, 0.046, 0.155, 20));
    const labelTex = variant % 2 === 0 ? textures.canOrange : textures.canBerry;
    const bodyMat = new THREE.MeshStandardMaterial({
      map: labelTex,
      metalness: 0.72,
      roughness: 0.24,
      envMapIntensity: 1.6,
    });
    const aluminumMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.94,
      roughness: 0.16,
      envMapIntensity: 1.9,
    });
    const body = new THREE.Mesh(canGeo, [bodyMat, aluminumMat, aluminumMat]);
    body.castShadow = true;
    group.add(body);

    const rim = new THREE.Mesh(
      prepareCrushableGeometry(new THREE.TorusGeometry(0.044, 0.005, 8, 18)),
      aluminumMat
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.078;
    group.add(rim);
  } else if (category === 'paper') {
    if (variant % 2 === 0) {
      // Folded Morning Newspaper Stack tied with twine (wordless photo-blocks!)
      const stackGeo = prepareCrushableGeometry(new THREE.BoxGeometry(0.19, 0.065, 0.15, 3, 2, 3));
      const paperMat = new THREE.MeshStandardMaterial({
        map: textures.newspaper,
        roughness: 0.82,
      });
      const stack = new THREE.Mesh(stackGeo, paperMat);
      stack.castShadow = true;
      group.add(stack);

      const twine = new THREE.Mesh(
        prepareCrushableGeometry(new THREE.BoxGeometry(0.196, 0.07, 0.012)),
        new THREE.MeshStandardMaterial({ color: 0xb48252, roughness: 0.9 })
      );
      group.add(twine);
    } else {
      // Gable-Top Milk / Juice Carton (zero letters!)
      const boxGeo = prepareCrushableGeometry(new THREE.BoxGeometry(0.095, 0.155, 0.095, 2, 3, 2));
      const cartonMat = new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        roughness: 0.45,
      });
      const carton = new THREE.Mesh(boxGeo, cartonMat);
      carton.castShadow = true;
      group.add(carton);

      const stripe = new THREE.Mesh(
        prepareCrushableGeometry(new THREE.BoxGeometry(0.098, 0.055, 0.098)),
        new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.42 })
      );
      stripe.position.y = -0.015;
      group.add(stripe);

      const roofGeo = prepareCrushableGeometry(new THREE.ConeGeometry(0.068, 0.055, 4));
      const roof = new THREE.Mesh(roofGeo, cartonMat);
      roof.rotation.y = Math.PI / 4;
      roof.position.y = 0.105;
      group.add(roof);
    }
  } else {
    // Organic Food Scraps (Realistic Red Apple Core or Curved Ripe Banana Peel!)
    if (variant % 2 === 0) {
      // Sculpted Red Apple Core with stem & leaf
      const coreGeo = prepareCrushableGeometry(new THREE.CylinderGeometry(0.022, 0.022, 0.09, 12));
      const fleshMat = new THREE.MeshStandardMaterial({ color: 0xfef0c7, roughness: 0.65 });
      const skinMat = new THREE.MeshPhysicalMaterial({ color: 0xdc2626, roughness: 0.26, clearcoat: 0.6 });
      const core = new THREE.Mesh(coreGeo, fleshMat);
      core.castShadow = true;
      group.add(core);

      [-0.048, 0.048].forEach((ay, idx) => {
        const cap = new THREE.Mesh(
          prepareCrushableGeometry(new THREE.SphereGeometry(0.052, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.48)),
          skinMat
        );
        cap.position.y = ay;
        if (idx === 0) cap.rotation.x = Math.PI;
        cap.castShadow = true;
        group.add(cap);
      });

      const leaf = new THREE.Mesh(
        prepareCrushableGeometry(new THREE.SphereGeometry(0.022, 8, 6)),
        new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.5 })
      );
      leaf.scale.set(1.5, 0.35, 0.8);
      leaf.position.set(0.022, 0.082, 0);
      group.add(leaf);
    } else {
      // Realistic 3-petal Curved Yellow Banana Peel
      const peelMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.45 });
      for (let p = 0; p < 3; p++) {
        const ang = (p / 3) * Math.PI * 2;
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, 0.065, 0),
          new THREE.Vector3(Math.cos(ang) * 0.045, 0.02, Math.sin(ang) * 0.045),
          new THREE.Vector3(Math.cos(ang) * 0.095, -0.035, Math.sin(ang) * 0.095),
        ]);
        const strip = new THREE.Mesh(
          prepareCrushableGeometry(new THREE.TubeGeometry(curve, 10, 0.015, 6, false)),
          peelMat
        );
        strip.castShadow = true;
        group.add(strip);
      }
      const tip = new THREE.Mesh(
        prepareCrushableGeometry(new THREE.CylinderGeometry(0.012, 0.016, 0.03, 8)),
        new THREE.MeshStandardMaterial({ color: 0x713f12, roughness: 0.8 })
      );
      tip.position.y = 0.075;
      group.add(tip);
    }
  }

  // Generous invisible grab sphere for effortless single-finger pickup!
  const hit = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 8, 8),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  group.add(hit);

  const itemObj = {
    category,
    variant,
    group,
    hit,
    state: 'ground', // 'inBag' | 'ground' | 'dragging' | 'sorted' | 'inHopper'
    vel: new THREE.Vector3(),
    sortedCrate: null,
    wasMatched: true,
    crushLevel: 0,
  };
  hit.userData = { interactType: 'trashItem', itemObj };

  return itemObj;
}

// Translucent Polyethylene Town Garbage Bag (つまんで振ると中から資源が出る・そのまま箱にも入れられる！)
export function createTownGarbageBag(pos, containedItems) {
  const group = new THREE.Group();

  // Crinkled organic pear-shaped translucent polyethylene bag!
  const bagGeo = prepareCrushableGeometry(new THREE.SphereGeometry(0.23, 20, 16));
  const posAttr = bagGeo.attributes.position;
  const base = bagGeo.userData.basePos;
  for (let i = 0; i < posAttr.count; i++) {
    const ix = i * 3;
    let x = base[ix];
    let y = base[ix + 1];
    let z = base[ix + 2];
    const hNorm = (y + 0.23) / 0.46; // 0 bottom .. 1 top
    const taper = 1.18 - hNorm * 0.52;
    const crinkle = 1.0 + Math.sin(x * 26 + y * 19) * Math.cos(z * 24) * 0.09;
    x *= taper * crinkle;
    z *= taper * crinkle;
    y = y * 0.92 + 0.19;
    base[ix] = x;
    base[ix + 1] = y;
    base[ix + 2] = z;
    posAttr.array[ix] = x;
    posAttr.array[ix + 1] = y;
    posAttr.array[ix + 2] = z;
  }
  bagGeo.computeVertexNormals();

  const plasticMat = new THREE.MeshPhysicalMaterial({
    color: 0xeef6ff,
    roughness: 0.24,
    metalness: 0.02,
    transparent: true,
    opacity: 0.72,
    clearcoat: 0.85,
    clearcoatRoughness: 0.18,
    depthWrite: false,
  });

  const bagMesh = new THREE.Mesh(bagGeo, plasticMat);
  bagMesh.castShadow = true;
  group.add(bagMesh);

  // Knotted Bunny-Ear Tie Handles at top of garbage bag!
  [-1, 1].forEach((sx) => {
    const ear = new THREE.Mesh(
      new THREE.ConeGeometry(0.042, 0.14, 10),
      plasticMat
    );
    ear.position.set(sx * 0.052, 0.43, 0);
    ear.rotation.z = -sx * 0.48;
    group.add(ear);
  });

  // Realistic household recyclable silhouettes visible through the translucent polyethylene film (NO faceted dodecahedrons!)
  const innerGroup = new THREE.Group();
  innerGroup.position.y = 0.15;
  containedItems.forEach((it, idx) => {
    const a = (idx / Math.max(1, containedItems.length)) * Math.PI * 2 + 0.4;
    let silhouette;
    if (it.category === 'bottle') {
      silhouette = new THREE.Mesh(
        new THREE.CylinderGeometry(0.022, 0.036, 0.14, 12),
        new THREE.MeshStandardMaterial({ color: 0x1e6b4e, roughness: 0.25 })
      );
    } else if (it.category === 'can') {
      silhouette = new THREE.Mesh(
        new THREE.CylinderGeometry(0.034, 0.034, 0.11, 12),
        new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.6, roughness: 0.3 })
      );
    } else if (it.category === 'paper') {
      silhouette = new THREE.Mesh(
        new THREE.BoxGeometry(0.085, 0.11, 0.065),
        new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.6 })
      );
    } else {
      silhouette = new THREE.Mesh(
        new THREE.SphereGeometry(0.045, 12, 10),
        new THREE.MeshStandardMaterial({ color: 0xc2410c, roughness: 0.5 })
      );
    }
    silhouette.position.set(Math.cos(a) * 0.068, (idx % 2) * 0.04 - 0.01, Math.sin(a) * 0.068);
    silhouette.rotation.set(0.35 * idx, a, -0.28);
    innerGroup.add(silhouette);
  });
  group.add(innerGroup);

  const hit = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 10, 10),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hit.position.y = 0.22;
  group.add(hit);

  group.position.copy(pos);

  const bagObj = {
    group,
    bagMesh,
    innerGroup,
    hit,
    items: containedItems,
    homePos: pos.clone(),
    wiggle: 0,
    empty: false,
  };
  hit.userData = { interactType: 'garbageBag', bagObj };
  return bagObj;
}

// 3D Aerodynamic Fluttering Paper Sheet System (for Dad's puddle slip blunder!)
export class FlutteringPaperSystem {
  constructor(scene, newspaperTex) {
    this.scene = scene;
    this.sheets = [];
    this.newspaperTex = newspaperTex;
  }

  spawnScatter(originPos, count = 12) {
    this.clear();
    const pastelTints = [0xffffff, 0xfef9c3, 0xe0f2fe, 0xfce7f3, 0xf1f5f9];

    for (let i = 0; i < count; i++) {
      const geo = new THREE.PlaneGeometry(0.24, 0.31, 6, 4);
      geo.userData.flatPos = new Float32Array(geo.attributes.position.array);

      const mat = new THREE.MeshStandardMaterial({
        color: pastelTints[i % pastelTints.length],
        map: i % 2 === 0 ? this.newspaperTex : null,
        roughness: 0.72,
        side: THREE.DoubleSide,
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      // Launch upward & outward in a dramatic fan into the morning breeze!
      const angle = (i / count) * Math.PI * 1.65 - 0.45;
      const speed = 1.2 + Math.random() * 1.45;
      mesh.position.set(
        originPos.x + (Math.random() - 0.5) * 0.25,
        originPos.y + 0.85 + Math.random() * 0.35,
        originPos.z + (Math.random() - 0.5) * 0.25
      );
      mesh.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );

      // Generous invisible touch target so catching floating or fallen paper feels magical!
      const hit = new THREE.Mesh(
        new THREE.SphereGeometry(0.32, 8, 8),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      mesh.add(hit);

      this.scene.add(mesh);

      const sheet = {
        mesh,
        geo,
        hit,
        vel: new THREE.Vector3(
          Math.cos(angle) * speed * 0.75 - 0.35,
          1.85 + Math.random() * 1.55,
          Math.sin(angle) * speed * 0.55 + 0.25
        ),
        phase: Math.random() * Math.PI * 2,
        flutterFreq: 4.2 + Math.random() * 2.8,
        state: 'airborne', // 'airborne' | 'landed' | 'flyingToHopper' | 'inHopper'
        caughtMidAir: false,
        landedWet: false,
        flyProgress: 0,
        flyStart: new THREE.Vector3(),
        flyTarget: new THREE.Vector3(),
      };
      hit.userData = { interactType: 'flutterPaper', sheet };
      this.sheets.push(sheet);
    }
  }

  update(dt, time) {
    for (let i = 0; i < this.sheets.length; i++) {
      const s = this.sheets[i];
      if (s.state === 'airborne') {
        s.phase += dt * s.flutterFreq;

        // Aerodynamic flutter: gentle gravity balanced by oscillating lift, side-slip glide, and morning breeze!
        const gustX = Math.sin(time * 1.7 + i * 0.9) * 0.65;
        const lift = 0.82 + 0.38 * Math.sin(s.phase * 2.0);
        s.vel.y -= (2.15 - lift) * dt;
        s.vel.y = Math.max(s.vel.y, -0.62); // terminal paper glide speed so child has fun catching mid-air!
        s.vel.x += (Math.sin(s.phase) * 2.1 + gustX - s.vel.x * 1.4) * dt;
        s.vel.z += (Math.cos(s.phase * 0.85) * 1.4 - s.vel.z * 1.4) * dt;

        s.mesh.position.addScaledVector(s.vel, dt);

        // Keep papers comfortably inside visible playfield!
        s.mesh.position.x = Math.max(-1.45, Math.min(1.65, s.mesh.position.x));
        s.mesh.position.z = Math.max(0.25, Math.min(2.55, s.mesh.position.z));

        // Banking & pitching with glide velocity
        s.mesh.rotation.z = Math.sin(s.phase) * 0.58;
        s.mesh.rotation.x = Math.cos(s.phase * 0.8) * 0.42;
        s.mesh.rotation.y += dt * 0.95 * Math.sin(s.phase * 0.5);

        // Live 3D aerodynamic paper curl & wave bending!
        const flat = s.geo.userData.flatPos;
        const arr = s.geo.attributes.position.array;
        for (let k = 0; k < arr.length; k += 3) {
          const fx = flat[k];
          const fy = flat[k + 1];
          arr[k + 2] =
            Math.sin(fx * 11.0 + s.phase * 1.6) * 0.026 +
            (fx * fx + fy * fy) * 1.25 * Math.cos(s.phase);
        }
        s.geo.attributes.position.needsUpdate = true;
        s.geo.computeVertexNormals();

        // Land gently on wet pavement!
        if (s.mesh.position.y <= 0.028) {
          s.mesh.position.y = 0.018 + (i % 4) * 0.003;
          s.mesh.rotation.set(-Math.PI / 2, 0, Math.random() * Math.PI * 2);
          s.state = 'landed';
          // Check if landed in puddle -> slightly darkened damp pulp look!
          const distPuddle = Math.hypot(s.mesh.position.x - 1.0, s.mesh.position.z - 1.38);
          if (distPuddle < 1.15) {
            s.landedWet = true;
            s.mesh.material.color.multiplyScalar(0.90);
            s.mesh.material.roughness = 0.22;
          }
        }
      } else if (s.state === 'landed') {
        // Gentle corner flutter in the morning breeze to invite pickup
        const flat = s.geo.userData.flatPos;
        const arr = s.geo.attributes.position.array;
        const liftCorner = Math.max(0, Math.sin(time * 3.4 + s.phase)) * 0.022;
        for (let k = 0; k < arr.length; k += 3) {
          const fx = flat[k];
          arr[k + 2] = fx > 0 ? fx * liftCorner * 6.0 : 0;
        }
        s.geo.attributes.position.needsUpdate = true;
      } else if (s.state === 'flyingToHopper') {
        s.flyProgress = Math.min(1, s.flyProgress + dt * 2.8);
        const t = s.flyProgress;
        const ease = 1 - Math.pow(1 - t, 3);
        s.mesh.position.lerpVectors(s.flyStart, s.flyTarget, ease);
        s.mesh.position.y += Math.sin(t * Math.PI) * 0.65;
        s.mesh.rotation.x += dt * 7.0;
        s.mesh.rotation.y += dt * 5.0;
        if (t >= 1) {
          s.state = 'inHopper';
          // Prepare for hydraulic crushing inside hopper!
          s.geo.userData.basePos = new Float32Array(s.geo.attributes.position.array);
        }
      }
    }
  }

  catchSheet(sheet, hopperWorldPos) {
    if (sheet.state === 'flyingToHopper' || sheet.state === 'inHopper') return false;
    sheet.caughtMidAir = sheet.state === 'airborne';
    sheet.state = 'flyingToHopper';
    sheet.flyProgress = 0;
    sheet.flyStart.copy(sheet.mesh.position);
    sheet.flyTarget.set(
      hopperWorldPos.x + (Math.random() - 0.5) * 0.55,
      hopperWorldPos.y + 0.04 + Math.random() * 0.14,
      hopperWorldPos.z + (Math.random() - 0.5) * 0.22
    );
    return sheet.caughtMidAir;
  }

  remainingToCatch() {
    return this.sheets.filter((s) => s.state === 'airborne' || s.state === 'landed').length;
  }

  allInHopper() {
    return this.sheets.length > 0 && this.sheets.every((s) => s.state === 'inHopper');
  }

  clear() {
    this.sheets.forEach((s) => {
      this.scene.remove(s.mesh);
      s.geo.dispose();
      s.mesh.material.dispose();
    });
    this.sheets = [];
  }
}

// Scene 3: Realistic Blooming Flowers & Custom Recycled Crafts (shaped by player's Scene 1 & 2 simulation!)
// Shared Flower Geometries for ultra-fast 60fps mobile rendering even with dozens of planted blooms!
let sharedStemGeo = null;
let sharedLeafGeo = null;
let sharedPetalGeo = null;
let sharedCenterGeo = null;
let sharedFlowerHitGeo = null;

export function createRealisticFlower(paletteHex, initialScale = 0.55) {
  if (!sharedStemGeo) {
    sharedStemGeo = new THREE.CylinderGeometry(0.008, 0.011, 0.30, 6);
    sharedLeafGeo = new THREE.SphereGeometry(0.030, 6, 5);
    sharedPetalGeo = new THREE.SphereGeometry(0.036, 7, 5);
    sharedCenterGeo = new THREE.SphereGeometry(0.024, 8, 6);
    sharedFlowerHitGeo = new THREE.SphereGeometry(0.18, 6, 6);
  }

  const flower = new THREE.Group();
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.62 });
  const stemHeight = 0.30;
  const stem = new THREE.Mesh(sharedStemGeo, stemMat);
  stem.position.y = stemHeight * 0.5;
  stem.castShadow = true;
  flower.add(stem);

  [-1, 1].forEach((sx) => {
    const leaf = new THREE.Mesh(sharedLeafGeo, stemMat);
    leaf.scale.set(1.6, 0.28, 0.75);
    leaf.position.set(sx * 0.035, stemHeight * 0.42, 0);
    leaf.rotation.z = -sx * 0.38;
    flower.add(leaf);
  });

  const blossom = new THREE.Group();
  blossom.position.y = stemHeight;
  blossom.rotation.x = 0.22 + (Math.random() - 0.5) * 0.25;
  blossom.rotation.z = (Math.random() - 0.5) * 0.25;

  const petalMat = new THREE.MeshPhysicalMaterial({
    color: paletteHex,
    roughness: 0.38,
    sheen: 0.6,
    sheenColor: new THREE.Color(0xffffff),
    side: THREE.DoubleSide,
  });

  const petalCount = 6;
  for (let i = 0; i < petalCount; i++) {
    const a = (i / petalCount) * Math.PI * 2;
    const petal = new THREE.Mesh(sharedPetalGeo, petalMat);
    petal.scale.set(0.68, 0.22, 1.48);
    petal.position.set(Math.cos(a) * 0.040, 0.006, Math.sin(a) * 0.040);
    petal.rotation.y = -a + Math.PI / 2;
    petal.rotation.x = 0.24;
    petal.castShadow = true;
    blossom.add(petal);
  }

  const center = new THREE.Mesh(
    sharedCenterGeo,
    new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.55 })
  );
  center.scale.y = 0.65;
  blossom.add(center);

  flower.add(blossom);
  flower.scale.setScalar(initialScale);

  const hit = new THREE.Mesh(
    sharedFlowerHitGeo,
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hit.position.y = stemHeight * 0.7;
  flower.add(hit);

  const craftObj = {
    kind: 'flower',
    group: flower,
    hit,
    growth: initialScale,
    spinSpeed: 0,
    swayPhase: Math.random() * 6.28,
  };
  hit.userData = { interactType: 'sandboxCraft', craftObj };
  return craftObj;
}

// Spinning Recycled Can Pinwheel & Glass Prism Gem Lantern (dispensed from Truck in Scene 3!)
export function createRecycledPinwheel(accentHex = 0xf97316, glassColor = 0x167954, crispPaper = true) {
  const group = new THREE.Group();

  const stick = new THREE.Mesh(
    new THREE.CylinderGeometry(0.01, 0.012, 0.42, 10),
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.85, roughness: 0.2 })
  );
  stick.position.y = 0.21;
  stick.castShadow = true;
  group.add(stick);

  // Sparkling Recycled Bottle-Glass Gem Base!
  const gem = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.068, 1),
    new THREE.MeshPhysicalMaterial({
      color: glassColor,
      roughness: 0.06,
      transmission: 0.68,
      ior: 1.54,
      clearcoat: 1.0,
    })
  );
  gem.scale.set(1.15, 0.75, 1.15);
  gem.position.y = 0.048;
  gem.castShadow = true;
  group.add(gem);

  // Spinning Brushed-Aluminum & Origami Rotor Blades!
  const rotor = new THREE.Group();
  rotor.position.set(0, 0.40, 0.025);

  const bladeMat1 = new THREE.MeshStandardMaterial({
    color: accentHex,
    metalness: crispPaper ? 0.35 : 0.78,
    roughness: crispPaper ? 0.32 : 0.18,
    side: THREE.DoubleSide,
  });
  const bladeMat2 = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    metalness: 0.65,
    roughness: 0.22,
    side: THREE.DoubleSide,
  });

  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const vane = new THREE.Mesh(
      new THREE.ConeGeometry(0.052, 0.14, 4),
      i % 2 === 0 ? bladeMat1 : bladeMat2
    );
    vane.position.set(Math.cos(a) * 0.068, Math.sin(a) * 0.068, 0);
    vane.rotation.z = a - Math.PI / 2;
    vane.rotation.x = 0.42;
    vane.castShadow = true;
    rotor.add(vane);
  }

  const hub = new THREE.Mesh(
    new THREE.SphereGeometry(0.024, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0xe11d48, roughness: 0.2 })
  );
  rotor.add(hub);
  group.add(rotor);

  const hit = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 8, 8),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hit.position.y = 0.32;
  group.add(hit);

  const craftObj = {
    kind: 'pinwheel',
    group,
    rotor,
    hit,
    growth: 1.0,
    spinSpeed: 2.8 + Math.random() * 2.0,
    swayPhase: Math.random() * 6.28,
  };
  hit.userData = { interactType: 'sandboxCraft', craftObj };
  return craftObj;
}
