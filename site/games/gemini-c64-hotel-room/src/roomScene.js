import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {
  createLinenTextureSet,
  createTerryTowelTextureSet,
  createWoodTextureSet,
  createWoodFloorTextureSet,
  createWickerTextureSet,
  createGarmentTexture,
  createRunnerTexture,
  createPictorialBoardTexture,
  createSoftShadowTexture,
  createSheerCurtainTexture,
  createSunbeamTexture,
  createBoucleRugTextureSet
} from './textures.js';
import { BedClothSimulation, TowelSwanSimulation, CurtainSimulation } from './clothSim.js';

// Sculpt a plump, cloud-soft down hotel pillow with pinched corners & corner gather creases!
function createPlumpHotelPillowGeometry(width = 0.84, height = 0.23, depth = 0.50) {
  const geo = new THREE.SphereGeometry(1.0, 38, 26);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    // Superquadric pillow envelope: rectangular plan with rounded puffed belly & pinched seam rim!
    const sx = Math.sign(v.x) * Math.pow(Math.abs(v.x), 0.72);
    const sz = Math.sign(v.z) * Math.pow(Math.abs(v.z), 0.74);
    const sy = Math.sign(v.y) * Math.pow(Math.abs(v.y), 0.86);

    let px = sx * (width * 0.5);
    let pz = sz * (depth * 0.5);

    // Pinch thickness down along the perimeter seam (classic stitched hotel down pillow!)
    const edgeFactor = Math.min(1, Math.hypot(px / (width * 0.5), pz / (depth * 0.5)));
    const seamPinch = Math.max(0.14, 1.0 - Math.pow(edgeFactor, 2.4) * 0.82);

    // Subtle dog-ear flare at the 4 corners
    const cornerness = Math.pow(Math.abs(sx * sz), 1.6);
    px *= 1.0 + cornerness * 0.07;
    pz *= 1.0 + cornerness * 0.07;

    // Gentle fabric gather creases radiating inward from the 4 corners
    const gather = Math.sin(Math.atan2(pz, px) * 8.0) * 0.0045 * Math.pow(edgeFactor, 1.5);
    const py = sy * (height * 0.5) * seamPinch + gather;

    pos.setXYZ(i, px, py, pz);
  }
  geo.computeVertexNormals();
  return geo;
}

export function buildHotelRoom(scene) {
  const texLinen = createLinenTextureSet(11);
  const texPillowLinen = createLinenTextureSet(5);
  const texTerry = createTerryTowelTextureSet(7);
  const texWalnut = createWoodTextureSet('walnut', 1, 1);
  const texOak = createWoodTextureSet('oak', 1, 1);
  const texLightOak = createWoodTextureSet('lightOak', 1, 1);
  const texFloor = createWoodFloorTextureSet(3, 3);
  const texWicker = createWickerTextureSet(5, 3);
  const texBoard = createPictorialBoardTexture();
  const texShadow = createSoftShadowTexture();
  const texSheer = createSheerCurtainTexture();
  const texSunbeam = createSunbeamTexture();
  const texRug = createBoucleRugTextureSet(6, 5);
  const runnerTextures = [
    createRunnerTexture(0),
    createRunnerTexture(1),
    createRunnerTexture(2)
  ];
  const garmentTextures = [
    createGarmentTexture(0),
    createGarmentTexture(1),
    createGarmentTexture(2),
    createGarmentTexture(3)
  ];

  const materials = {
    linen: new THREE.MeshPhysicalMaterial({
      color: 0xfbf9f5,
      map: texLinen.map,
      normalMap: texLinen.normalMap,
      normalScale: new THREE.Vector2(0.60, 0.60),
      roughnessMap: texLinen.roughnessMap,
      roughness: 0.84,
      metalness: 0.0,
      sheen: 0.80,
      sheenRoughness: 0.64,
      sheenColor: new THREE.Color(0xfffcf6)
    }),
    pillowLinen: new THREE.MeshPhysicalMaterial({
      color: 0xfcfaf6,
      map: texPillowLinen.map,
      normalMap: texPillowLinen.normalMap,
      normalScale: new THREE.Vector2(0.48, 0.48),
      roughnessMap: texPillowLinen.roughnessMap,
      roughness: 0.80,
      sheen: 0.84,
      sheenRoughness: 0.60,
      sheenColor: new THREE.Color(0xffffff)
    }),
    terry: new THREE.MeshPhysicalMaterial({
      color: 0xfaf7f1,
      map: texTerry.map,
      normalMap: texTerry.normalMap,
      normalScale: new THREE.Vector2(0.88, 0.88),
      roughness: 0.90,
      sheen: 0.86,
      sheenRoughness: 0.72,
      sheenColor: new THREE.Color(0xffffff)
    }),
    walnut: new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: texWalnut.map,
      normalMap: texWalnut.normalMap,
      normalScale: new THREE.Vector2(0.32, 0.32),
      roughnessMap: texWalnut.roughnessMap,
      roughness: 0.44,
      clearcoat: 0.24,
      clearcoatRoughness: 0.38
    }),
    oak: new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: texOak.map,
      normalMap: texOak.normalMap,
      normalScale: new THREE.Vector2(0.30, 0.30),
      roughnessMap: texOak.roughnessMap,
      roughness: 0.46,
      clearcoat: 0.20,
      clearcoatRoughness: 0.42
    }),
    lightOak: new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: texLightOak.map,
      normalMap: texLightOak.normalMap,
      normalScale: new THREE.Vector2(0.28, 0.28),
      roughnessMap: texLightOak.roughnessMap,
      roughness: 0.48,
      clearcoat: 0.16,
      clearcoatRoughness: 0.46
    }),
    floor: new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: texFloor.map,
      normalMap: texFloor.normalMap,
      normalScale: new THREE.Vector2(0.35, 0.35),
      roughnessMap: texFloor.roughnessMap,
      roughness: 0.46,
      clearcoat: 0.22,
      clearcoatRoughness: 0.36
    }),
    wicker: new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: texWicker.map,
      normalMap: texWicker.normalMap,
      normalScale: new THREE.Vector2(0.8, 0.8),
      roughness: 0.76
    }),
    brass: new THREE.MeshPhysicalMaterial({
      color: 0xdcb360,
      metalness: 0.86,
      roughness: 0.24,
      clearcoat: 0.35
    }),
    wall: new THREE.MeshPhysicalMaterial({
      color: 0xf0eae0,
      roughness: 0.90
    }),
    ceramic: new THREE.MeshPhysicalMaterial({
      color: 0xf7f3ec,
      roughness: 0.22,
      clearcoat: 0.65,
      clearcoatRoughness: 0.15
    })
  };

  const invisibleHitMat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.0,
    depthWrite: false
  });
  const root = new THREE.Group();
  scene.add(root);

  // ==========================================================================
  // 1. COHESIVE BOUTIQUE HOTEL ARCHITECTURE (100% visible in 4:3 & Portrait!)
  // ==========================================================================
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(8.5, 8.0), materials.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  root.add(floor);

  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(8.0, 4.2), materials.wall);
  backWall.position.set(0, 2.1, -1.48);
  backWall.receiveShadow = true;
  root.add(backWall);

  // Left Wall (-X = -2.18) with Hinged Solid Oak Entry Door clearly in view!
  const leftWallBack = new THREE.Mesh(new THREE.BoxGeometry(0.18, 4.2, 1.15), materials.wall);
  leftWallBack.position.set(-2.18, 2.1, -1.00);
  leftWallBack.receiveShadow = true;
  root.add(leftWallBack);

  const leftWallFront = new THREE.Mesh(new THREE.BoxGeometry(0.18, 4.2, 3.4), materials.wall);
  leftWallFront.position.set(-2.18, 2.1, 2.25);
  leftWallFront.receiveShadow = true;
  root.add(leftWallFront);

  const doorHeader = new THREE.Mesh(new THREE.BoxGeometry(0.20, 2.05, 1.02), materials.wall);
  doorHeader.position.set(-2.18, 3.20, 0.06);
  root.add(doorHeader);

  const hallFloor = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.8), materials.floor);
  hallFloor.rotation.x = -Math.PI / 2;
  hallFloor.position.set(-2.9, 0.002, 0.06);
  root.add(hallFloor);
  const hallBack = new THREE.Mesh(
    new THREE.PlaneGeometry(2.0, 3.0),
    new THREE.MeshBasicMaterial({ color: 0xe6dac6 })
  );
  hallBack.rotation.y = Math.PI / 2;
  hallBack.position.set(-3.55, 1.5, 0.06);
  root.add(hallBack);

  const doorPivot = new THREE.Group();
  doorPivot.position.set(-2.10, 0, -0.42);
  const doorSlab = new THREE.Mesh(new RoundedBoxGeometry(0.065, 2.16, 0.94, 3, 0.012), materials.oak);
  doorSlab.position.set(0, 1.08, 0.47);
  doorSlab.castShadow = true;
  doorSlab.receiveShadow = true;
  doorPivot.add(doorSlab);
  const doorHandle = new THREE.Mesh(new RoundedBoxGeometry(0.11, 0.026, 0.12, 3, 0.008), materials.brass);
  doorHandle.position.set(0.05, 0.98, 0.82);
  doorPivot.add(doorHandle);
  root.add(doorPivot);

  for (const cz of [-0.44, 0.54]) {
    const casing = new THREE.Mesh(new RoundedBoxGeometry(0.22, 2.24, 0.07, 2, 0.01), materials.walnut);
    casing.position.set(-2.12, 1.12, cz);
    root.add(casing);
  }

  // Right Wall (+X = +2.10) with Tall Sunlit Window, Oak Mullions & Billowing Sheer Curtains IN FRAME!
  const rightWallBack = new THREE.Mesh(new THREE.BoxGeometry(0.22, 4.2, 0.95), materials.wall);
  rightWallBack.position.set(2.12, 2.1, -1.15);
  rightWallBack.receiveShadow = true;
  root.add(rightWallBack);

  const rightWallFront = new THREE.Mesh(new THREE.BoxGeometry(0.22, 4.2, 2.5), materials.wall);
  rightWallFront.position.set(2.12, 2.1, 2.85);
  rightWallFront.receiveShadow = true;
  root.add(rightWallFront);

  const windowSillWall = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.56, 2.35), materials.wall);
  windowSillWall.position.set(2.12, 0.28, 0.45);
  windowSillWall.receiveShadow = true;
  root.add(windowSillWall);

  // Soft Warm Morning Sky &Sunlit Foliage Bokeh Backdrop outside Window
  const skyBackdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(3.8, 3.8),
    new THREE.MeshBasicMaterial({ color: 0xfff8eb })
  );
  skyBackdrop.rotation.y = -Math.PI / 2;
  skyBackdrop.position.set(2.75, 2.0, 0.45);
  root.add(skyBackdrop);

  const woodSill = new THREE.Mesh(new RoundedBoxGeometry(0.28, 0.055, 2.35, 3, 0.012), materials.oak);
  woodSill.position.set(2.06, 0.57, 0.45);
  woodSill.receiveShadow = true;
  root.add(woodSill);

  // Oak Window Mullions casting warm dappled morning window bars across the white linen bed!
  for (const mz of [-0.52, 0.45, 1.42]) {
    const mullion = new THREE.Mesh(new RoundedBoxGeometry(0.07, 2.85, 0.055, 2, 0.008), materials.oak);
    mullion.position.set(2.14, 1.98, mz);
    mullion.castShadow = true;
    root.add(mullion);
  }
  const transom = new THREE.Mesh(new RoundedBoxGeometry(0.07, 0.055, 2.35, 2, 0.008), materials.oak);
  transom.position.set(2.14, 1.95, 0.45);
  transom.castShadow = true;
  root.add(transom);

  const curtainRod = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 2.85, 14), materials.brass);
  curtainRod.rotation.x = Math.PI / 2;
  curtainRod.position.set(1.96, 3.16, 0.45);
  root.add(curtainRod);

  const curtainSim = new CurtainSimulation(texSheer);
  curtainSim.group.position.set(1.95, 1.60, 0.45);
  root.add(curtainSim.group);

  // Feathered Morning Volumetric Sunbeam Shafts slanting from Right Window (zero hard edges!)
  const sunbeamMat = new THREE.MeshBasicMaterial({
    map: texSunbeam,
    transparent: true,
    opacity: 1.0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  });
  for (const bz of [-0.20, 0.55]) {
    const beam = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.35), sunbeamMat);
    beam.position.set(0.88, 1.52, bz);
    beam.rotation.z = 0.38;
    beam.rotation.x = -0.28;
    root.add(beam);
  }

  // Woven Ivory-Oatmeal Boucle Hotel Area Rug framing the Bed & Footboard Bench on top of Oak Planks!
  const rugMat = new THREE.MeshPhysicalMaterial({
    color: 0xf7f2e9,
    map: texRug.map,
    normalMap: texRug.normalMap,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughness: 0.92,
    sheen: 0.75,
    sheenColor: new THREE.Color(0xfffaf0)
  });
  const areaRug = new THREE.Mesh(new RoundedBoxGeometry(2.92, 0.018, 2.75, 3, 0.008), rugMat);
  areaRug.position.set(0, 0.009, 0.34);
  areaRug.receiveShadow = true;
  root.add(areaRug);

  // ==========================================================================
  // 2. ARCHITECTURAL SLATTED OAK & WALNUT HEADBOARD + TAILORED UPHOLSTERED BED BASE
  // ==========================================================================
  const headboardGroup = new THREE.Group();
  root.add(headboardGroup);

  const wainscot = new THREE.Mesh(new RoundedBoxGeometry(3.88, 1.62, 0.07, 3, 0.014), materials.walnut);
  wainscot.position.set(0, 0.84, -1.40);
  wainscot.castShadow = true;
  wainscot.receiveShadow = true;
  headboardGroup.add(wainscot);

  const slatGeo = new RoundedBoxGeometry(0.058, 1.50, 0.052, 3, 0.011);
  for (let i = -11; i <= 11; i++) {
    const slat = new THREE.Mesh(slatGeo, i % 2 === 0 ? materials.oak : materials.lightOak);
    slat.position.set(i * 0.094, 0.86, -1.34);
    slat.castShadow = true;
    slat.receiveShadow = true;
    headboardGroup.add(slat);
  }

  const headCap = new THREE.Mesh(new RoundedBoxGeometry(3.94, 0.06, 0.14, 3, 0.012), materials.walnut);
  headCap.position.set(0, 1.67, -1.36);
  headCap.castShadow = true;
  headboardGroup.add(headCap);

  // Subtle Warm Architectural Cove Wash grazing down the Oak Headboard Slats!
  const coveGlow = new THREE.PointLight(0xffcf8c, 0.85, 2.8, 1.6);
  coveGlow.position.set(0, 1.60, -1.18);
  headboardGroup.add(coveGlow);

  // Sleek Walnut Plinth Rail + Oatmeal Upholstered Linen Valance Base!
  const walnutPlinth = new THREE.Mesh(new RoundedBoxGeometry(2.28, 0.09, 2.26, 3, 0.02), materials.walnut);
  walnutPlinth.position.set(0, 0.21, -0.06);
  walnutPlinth.castShadow = true;
  walnutPlinth.receiveShadow = true;
  root.add(walnutPlinth);

  const valanceMat = new THREE.MeshPhysicalMaterial({
    color: 0xebe3d5,
    map: texLinen.map,
    normalMap: texLinen.normalMap,
    normalScale: new THREE.Vector2(0.55, 0.55),
    roughness: 0.86,
    sheen: 0.72
  });
  const bedPlatform = new THREE.Mesh(new RoundedBoxGeometry(2.22, 0.22, 2.20, 4, 0.03), valanceMat);
  bedPlatform.position.set(0, 0.36, -0.06);
  bedPlatform.castShadow = true;
  bedPlatform.receiveShadow = true;
  root.add(bedPlatform);

  for (const lx of [-1.00, 1.00]) {
    for (const lz of [-1.04, 0.94]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.030, 0.18, 14), materials.walnut);
      leg.position.set(lx, 0.09, lz);
      leg.castShadow = true;
      root.add(leg);
    }
  }

  const mattress = new THREE.Mesh(new RoundedBoxGeometry(2.14, 0.32, 2.10, 5, 0.065), materials.pillowLinen);
  mattress.position.set(0, 0.58, -0.04);
  mattress.castShadow = true;
  mattress.receiveShadow = true;
  root.add(mattress);

  const bedFloorShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.85, 2.75),
    new THREE.MeshBasicMaterial({ map: texShadow, transparent: true, opacity: 0.72, depthWrite: false })
  );
  bedFloorShadow.rotation.x = -Math.PI / 2;
  bedFloorShadow.position.set(0, 0.020, -0.04);
  root.add(bedFloorShadow);

  // ==========================================================================
  // 3. SIMULATED BED DUVET + PLUMP SCULPTED DOWN PILLOWS + WOVEN RUNNER
  // ==========================================================================
  const bedCloth = new BedClothSimulation(materials.linen);
  root.add(bedCloth.mesh);

  // 2 Tall Upright Luxury Hotel Euro Back Pillows resting against the Oak Slatted Headboard!
  const euroPillowGeo = createPlumpHotelPillowGeometry(0.92, 0.22, 0.56);
  for (const s of [-1, 1]) {
    const euro = new THREE.Mesh(euroPillowGeo, materials.linen);
    euro.position.set(s * 0.52, 0.96, -1.06);
    euro.rotation.x = 0.88; // propped upright against headboard slats
    euro.castShadow = true;
    euro.receiveShadow = true;
    root.add(euro);
  }

  const pillows = [];
  const plumpPillowGeo = createPlumpHotelPillowGeometry(0.86, 0.24, 0.50);
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? -1 : 1;
    const pGroup = new THREE.Group();
    const core = new THREE.Mesh(plumpPillowGeo, materials.pillowLinen);
    core.castShadow = true;
    core.receiveShadow = true;
    pGroup.add(core);

    const flange = new THREE.Mesh(new RoundedBoxGeometry(0.92, 0.014, 0.55, 3, 0.007), materials.linen);
    flange.castShadow = true;
    flange.receiveShadow = true;
    pGroup.add(flange);

    const pShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.00, 0.64),
      new THREE.MeshBasicMaterial({ map: texShadow, transparent: true, opacity: 0.58, depthWrite: false })
    );
    pShadow.rotation.x = -Math.PI / 2;
    pShadow.position.y = -0.095;
    pGroup.add(pShadow);

    const restPos = new THREE.Vector3(side * 0.51, 0.86, -0.78);
    pGroup.position.copy(restPos);
    pGroup.rotation.x = 0.16;
    pGroup.userData = {
      interactType: 'pillow',
      index: i,
      side,
      restPos,
      fluff: 0.88,
      bounceVel: 0,
      bounceOffset: 0
    };
    root.add(pGroup);
    pillows.push(pGroup);
  }

  const runnerMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: runnerTextures[2].map,
    normalMap: runnerTextures[2].normalMap,
    normalScale: new THREE.Vector2(0.65, 0.65),
    roughness: 0.86,
    sheen: 0.72,
    sheenColor: new THREE.Color(0xfaf3e8),
    side: THREE.DoubleSide
  });
  const runnerGeo = new THREE.PlaneGeometry(2.30, 0.52, 40, 8);
  const rPos = runnerGeo.attributes.position;
  for (let k = 0; k < rPos.count; k++) {
    const x = rPos.getX(k);
    const y = rPos.getY(k);
    const su = x / 1.15;
    const absSu = Math.abs(su);
    let rx, ry;
    if (absSu <= 0.90) {
      rx = (su / 0.90) * 1.09;
      ry = 0.795 + (1 - (su / 0.90) ** 2) * 0.042;
    } else {
      const t = (absSu - 0.90) / 0.10;
      rx = Math.sign(su) * (1.095 + Math.sin(t * Math.PI * 0.5) * 0.045);
      ry = 0.795 - t * 0.22;
    }
    rPos.setXYZ(k, rx, ry, -y);
  }
  runnerGeo.computeVertexNormals();
  const bedRunner = new THREE.Mesh(runnerGeo, runnerMat);
  bedRunner.position.set(0, 0, 0.62);
  bedRunner.castShadow = true;
  bedRunner.receiveShadow = true;
  bedRunner.visible = false;
  bedRunner.userData = { interactType: 'bedRunner', styleIndex: -1 };
  root.add(bedRunner);

  const footBench = new THREE.Group();
  footBench.position.set(0, 0, 1.38);
  const benchTop = new THREE.Mesh(new RoundedBoxGeometry(1.48, 0.062, 0.38, 4, 0.02), materials.walnut);
  benchTop.position.y = 0.39;
  benchTop.castShadow = true;
  benchTop.receiveShadow = true;
  footBench.add(benchTop);
  for (const bx of [-0.62, 0.62]) {
    for (const bz of [-0.13, 0.13]) {
      const bLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.019, 0.39, 12), materials.oak);
      bLeg.position.set(bx, 0.195, bz);
      bLeg.castShadow = true;
      footBench.add(bLeg);
    }
  }
  const benchShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.68, 0.56),
    new THREE.MeshBasicMaterial({ map: texShadow, transparent: true, opacity: 0.60, depthWrite: false })
  );
  benchShadow.rotation.x = -Math.PI / 2;
  benchShadow.position.y = 0.003;
  footBench.add(benchShadow);
  root.add(footBench);

  const runnerSwatches = [];
  for (let s = 0; s < 3; s++) {
    const swMat = new THREE.MeshPhysicalMaterial({
      map: runnerTextures[s].map,
      normalMap: runnerTextures[s].normalMap,
      roughness: 0.85,
      sheen: 0.7
    });
    const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.054, 0.054, 0.24, 18), swMat);
    roll.rotation.z = Math.PI / 2;
    roll.position.set((s - 1) * 0.35, 0.47, 1.38);
    roll.castShadow = true;
    roll.receiveShadow = true;
    roll.userData = { interactType: 'runnerSwatch', styleIndex: s, runnerTextures };
    root.add(roll);
    runnerSwatches.push(roll);
  }

  // ==========================================================================
  // 4. NIGHTSTANDS, LAMP, FLOWER VASE, ENCLOSED MIRROR PORTRAIT & PICTORIAL SIGNBOARD
  // ==========================================================================
  const leftStand = new THREE.Mesh(new RoundedBoxGeometry(0.56, 0.50, 0.46, 4, 0.022), materials.walnut);
  leftStand.position.set(-1.42, 0.32, -1.04);
  leftStand.castShadow = true;
  leftStand.receiveShadow = true;
  leftStand.userData = { interactType: 'woodFurniture' };
  root.add(leftStand);

  const rightStand = new THREE.Mesh(new RoundedBoxGeometry(0.56, 0.50, 0.46, 4, 0.022), materials.walnut);
  rightStand.position.set(1.42, 0.32, -1.04);
  rightStand.castShadow = true;
  rightStand.receiveShadow = true;
  rightStand.userData = { interactType: 'woodFurniture' };
  root.add(rightStand);

  // Left Nightstand Lamp
  const lampGroup = new THREE.Group();
  lampGroup.position.set(-1.50, 0.57, -1.08);
  const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.026, 20), materials.brass);
  lampBase.position.y = 0.013;
  lampGroup.add(lampBase);
  const lampStem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.26, 12), materials.brass);
  lampStem.position.y = 0.14;
  lampGroup.add(lampStem);

  const shadeMat = new THREE.MeshPhysicalMaterial({
    color: 0xfff8eb,
    emissive: new THREE.Color(0xffb45c),
    emissiveIntensity: 0.55,
    roughness: 0.72,
    transmission: 0.25,
    side: THREE.DoubleSide
  });
  const lampShade = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.14, 0.19, 24, 1, true), shadeMat);
  lampShade.position.y = 0.28;
  lampShade.castShadow = true;
  lampGroup.add(lampShade);

  const lampLight = new THREE.PointLight(0xffb668, 1.25, 3.8, 1.7);
  lampLight.position.set(-1.46, 0.90, -1.00);
  root.add(lampLight);
  lampGroup.userData = { interactType: 'lamp', isOn: true, shadeMat, lampLight };
  root.add(lampGroup);

  // Ceramic Bud Vase on Left Nightstand
  const vaseGroup = new THREE.Group();
  vaseGroup.position.set(-1.28, 0.57, -0.95);
  const vaseBody = new THREE.Mesh(new THREE.SphereGeometry(0.064, 18, 16), materials.ceramic);
  vaseBody.scale.set(1, 1.32, 1);
  vaseBody.position.y = 0.078;
  vaseBody.castShadow = true;
  vaseGroup.add(vaseBody);
  const vaseNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.034, 0.06, 16), materials.ceramic);
  vaseNeck.position.y = 0.165;
  vaseGroup.add(vaseNeck);

  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.005, 0.006, 0.21, 8),
    new THREE.MeshPhysicalMaterial({ color: 0x567347, roughness: 0.65 })
  );
  stem.position.set(0, 0.22, 0);
  stem.rotation.z = 0.14;
  vaseGroup.add(stem);

  const flowerStyles = [
    { color: 0xfff8f0, center: 0xe6be5a },
    { color: 0xf4cf58, center: 0xd99b26 },
    { color: 0xb59fd4, center: 0x7d65a3 },
    { color: 0xf2a7b0, center: 0xe37686 }
  ];
  const flowerHead = new THREE.Group();
  flowerHead.position.set(-0.02, 0.32, 0);
  const petalMat = new THREE.MeshPhysicalMaterial({
    color: flowerStyles[0].color,
    roughness: 0.55,
    sheen: 0.7,
    side: THREE.DoubleSide
  });
  for (let p = 0; p < 7; p++) {
    const ang = (p / 7) * Math.PI * 2;
    const pet = new THREE.Mesh(new THREE.SphereGeometry(0.028, 12, 10), petalMat);
    pet.scale.set(1.0, 0.28, 0.72);
    pet.position.set(Math.cos(ang) * 0.028, Math.sin(p) * 0.004, Math.sin(ang) * 0.028);
    pet.rotation.y = -ang;
    pet.rotation.z = 0.32;
    flowerHead.add(pet);
  }
  const flowerCore = new THREE.Mesh(
    new THREE.SphereGeometry(0.015, 10, 10),
    new THREE.MeshPhysicalMaterial({ color: flowerStyles[0].center, roughness: 0.6 })
  );
  flowerHead.add(flowerCore);
  vaseGroup.add(flowerHead);
  vaseGroup.userData = { interactType: 'flowerVase', styleIndex: 0, flowerStyles, petalMat, flowerCore };
  root.add(vaseGroup);

  // Enclosed Walnut Vanity Wall Mirror on Right Headboard Side (+1.42, 1.24, -1.28)
  // Lit by a dedicated warm vanity glow so the daughter's expressions shine clearly!
  const mirrorFrameGroup = new THREE.Group();
  mirrorFrameGroup.position.set(1.42, 1.25, -1.31);
  mirrorFrameGroup.rotation.y = -0.18;

  const mirrorBack = new THREE.Mesh(
    new THREE.BoxGeometry(0.60, 0.72, 0.20),
    new THREE.MeshPhysicalMaterial({ color: 0xf4ece0, roughness: 0.48 })
  );
  mirrorBack.position.z = -0.11;
  mirrorFrameGroup.add(mirrorBack);

  const mirrorGlow = new THREE.PointLight(0xfff0d8, 0.65, 1.2, 1.5);
  mirrorGlow.position.set(0, 0.12, 0.24);
  mirrorFrameGroup.add(mirrorGlow);

  const fTop = new THREE.Mesh(new RoundedBoxGeometry(0.70, 0.065, 0.09, 3, 0.012), materials.walnut);
  fTop.position.set(0, 0.35, 0.02);
  const fBot = fTop.clone();
  fBot.position.set(0, -0.35, 0.02);
  const fLeft = new THREE.Mesh(new RoundedBoxGeometry(0.065, 0.76, 0.09, 3, 0.012), materials.walnut);
  fLeft.position.set(-0.315, 0, 0.02);
  const fRight = fLeft.clone();
  fRight.position.set(0.315, 0, 0.02);
  const bTop = new THREE.Mesh(new BoxGeometrySimple(0.58, 0.014, 0.095), materials.brass);
  bTop.position.set(0, 0.315, 0.02);
  const bBot = bTop.clone();
  bBot.position.set(0, -0.315, 0.02);
  mirrorFrameGroup.add(fTop, fBot, fLeft, fRight, bTop, bBot);
  root.add(mirrorFrameGroup);

  // Single Wordless Pictorial Wooden Signboard ("ルールは絵の看板1枚で見せる")
  // Mounted clearly at (-1.44, 1.24, -1.28) on the left headboard panel — 100% uncropped & legible!
  const easelGroup = new THREE.Group();
  easelGroup.position.set(-1.42, 1.24, -1.30);
  easelGroup.rotation.y = 0.16;

  const boardFrame = new THREE.Mesh(new RoundedBoxGeometry(0.56, 0.68, 0.045, 3, 0.014), materials.oak);
  boardFrame.castShadow = true;
  boardFrame.receiveShadow = true;
  easelGroup.add(boardFrame);

  const boardFace = new THREE.Mesh(
    new THREE.PlaneGeometry(0.48, 0.60),
    new THREE.MeshPhysicalMaterial({ map: texBoard, roughness: 0.55, clearcoat: 0.14 })
  );
  boardFace.position.z = 0.024;
  easelGroup.add(boardFace);
  easelGroup.userData = { interactType: 'pictorialBoard', wobble: 0 };
  root.add(easelGroup);

  // ==========================================================================
  // 5. SCENE 1 BASKETS & SCENE 2/3 HOSPITALITY TRAY (Fully Inside 4:3 Frame!)
  // ==========================================================================
  const hamperGroup = new THREE.Group();
  hamperGroup.position.set(-1.26, 0, 1.18);
  const hamperBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.22, 0.50, 24, 1, true),
    new THREE.MeshPhysicalMaterial({
      map: texWicker.map,
      normalMap: texWicker.normalMap,
      roughness: 0.78,
      side: THREE.DoubleSide
    })
  );
  hamperBody.position.y = 0.25;
  hamperBody.castShadow = true;
  hamperBody.receiveShadow = true;
  hamperGroup.add(hamperBody);

  const hamperLiner = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.032, 12, 26), materials.linen);
  hamperLiner.rotation.x = Math.PI / 2;
  hamperLiner.position.y = 0.50;
  hamperLiner.castShadow = true;
  hamperGroup.add(hamperLiner);

  const hamperBottom = new THREE.Mesh(new THREE.CircleGeometry(0.22, 20), materials.walnut);
  hamperBottom.rotation.x = -Math.PI / 2;
  hamperBottom.position.y = 0.02;
  hamperGroup.add(hamperBottom);

  const hamperShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.76, 0.76),
    new THREE.MeshBasicMaterial({ map: texShadow, transparent: true, opacity: 0.68, depthWrite: false })
  );
  hamperShadow.rotation.x = -Math.PI / 2;
  hamperShadow.position.y = 0.003;
  hamperGroup.add(hamperShadow);
  hamperGroup.userData = { interactType: 'hamper', acceptKind: 'cloth', bounce: 0 };
  root.add(hamperGroup);

  const towelBasketGroup = new THREE.Group();
  towelBasketGroup.position.set(1.26, 0, 1.18);
  const tbOuter = new THREE.Mesh(new RoundedBoxGeometry(0.52, 0.40, 0.44, 4, 0.022), materials.oak);
  tbOuter.position.y = 0.20;
  tbOuter.castShadow = true;
  tbOuter.receiveShadow = true;
  towelBasketGroup.add(tbOuter);

  const tbCavity = new THREE.Mesh(
    new THREE.PlaneGeometry(0.42, 0.34),
    new THREE.MeshBasicMaterial({ color: 0x4b3320 })
  );
  tbCavity.rotation.x = -Math.PI / 2;
  tbCavity.position.y = 0.402;
  towelBasketGroup.add(tbCavity);

  const tbHintFold = new THREE.Mesh(new RoundedBoxGeometry(0.22, 0.045, 0.14, 3, 0.015), materials.terry);
  tbHintFold.position.set(0, 0.42, 0.16);
  towelBasketGroup.add(tbHintFold);

  towelBasketGroup.add(hamperShadow.clone());
  towelBasketGroup.userData = { interactType: 'towelBasket', acceptKind: 'towel', bounce: 0 };
  root.add(towelBasketGroup);

  // Right-Side Walnut Hospitality Stand & Tray (100% visible inside 4:3!)
  const hospitalityTray = new THREE.Group();
  hospitalityTray.position.set(1.38, 0.64, 0.18);

  const standPedestal = new THREE.Mesh(new RoundedBoxGeometry(0.58, 0.62, 0.82, 4, 0.022), materials.oak);
  standPedestal.position.set(0, -0.33, 0);
  standPedestal.castShadow = true;
  standPedestal.receiveShadow = true;
  hospitalityTray.add(standPedestal);

  const trayPlatter = new THREE.Mesh(new RoundedBoxGeometry(0.56, 0.034, 0.78, 3, 0.012), materials.walnut);
  trayPlatter.castShadow = true;
  trayPlatter.receiveShadow = true;
  hospitalityTray.add(trayPlatter);

  const trayNapkin = new THREE.Mesh(new RoundedBoxGeometry(0.46, 0.015, 0.34, 2, 0.006), materials.linen);
  trayNapkin.position.set(0, 0.022, -0.17);
  hospitalityTray.add(trayNapkin);

  const freshTowelStack = new THREE.Group();
  freshTowelStack.position.set(-0.10, 0.055, 0.16);
  for (let t = 0; t < 2; t++) {
    const ft = new THREE.Mesh(new RoundedBoxGeometry(0.24, 0.058, 0.20, 4, 0.022), materials.terry);
    ft.position.y = t * 0.056;
    ft.castShadow = true;
    ft.receiveShadow = true;
    freshTowelStack.add(ft);
  }
  freshTowelStack.userData = { interactType: 'freshTowelSource' };
  hospitalityTray.add(freshTowelStack);

  const bellGroup = new THREE.Group();
  bellGroup.position.set(0.14, 0.02, 0.20);
  const bellWoodBase = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.096, 0.022, 22), materials.walnut);
  bellWoodBase.position.y = 0.011;
  bellGroup.add(bellWoodBase);
  const bellDome = new THREE.Mesh(
    new THREE.SphereGeometry(0.076, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.52),
    materials.brass
  );
  bellDome.position.y = 0.020;
  bellDome.castShadow = true;
  bellGroup.add(bellDome);
  const bellPlunger = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.030, 12), materials.brass);
  bellPlunger.position.y = 0.10;
  bellGroup.add(bellPlunger);
  const bellHitProxy = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 8), invisibleHitMat);
  bellHitProxy.position.y = 0.07;
  bellGroup.add(bellHitProxy);
  bellGroup.userData = { interactType: 'brassBell', pressAnim: 0 };
  hospitalityTray.add(bellGroup);

  root.add(hospitalityTray);

  // Angle Primary Swan at -1.08 rad (graceful 3/4 side profile!) so its S-neck, bowed head & arched wings read unmistakably!
  const primarySwan = new TowelSwanSimulation(materials.terry, texShadow, false);
  primarySwan.group.position.set(-0.04, 0.79, 0.08);
  primarySwan.group.rotation.y = -1.08;
  primarySwan.group.visible = false;
  primarySwan.group.userData = { interactType: 'towelSwan', sim: primarySwan };
  root.add(primarySwan.group);

  // Angle Secondary Companion Swan at +1.08 rad facing Primary Swan to form a Heart ❤️!
  const secondarySwan = new TowelSwanSimulation(materials.terry, texShadow, true);
  secondarySwan.group.position.set(0.24, 0.79, 0.08);
  secondarySwan.group.rotation.y = 1.08;
  secondarySwan.group.visible = false;
  secondarySwan.group.userData = { interactType: 'towelSwan', sim: secondarySwan };
  root.add(secondarySwan.group);

  // Next-Room Wooden Key Stand (Scene 3)
  const nextRoomStand = new THREE.Group();
  nextRoomStand.position.set(1.32, 0.68, 1.02);
  nextRoomStand.visible = false;

  const keyPedestal = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.68, 0.38, 4, 0.022), materials.walnut);
  keyPedestal.position.y = -0.34;
  keyPedestal.castShadow = true;
  nextRoomStand.add(keyPedestal);

  const hookArch = new THREE.Mesh(new THREE.TorusGeometry(0.10, 0.012, 10, 22, Math.PI), materials.brass);
  hookArch.position.set(0, 0.18, 0);
  nextRoomStand.add(hookArch);

  const keySwing = new THREE.Group();
  keySwing.position.set(0, 0.27, 0);
  const keyRing = new THREE.Mesh(new THREE.TorusGeometry(0.030, 0.006, 8, 18), materials.brass);
  keyRing.position.y = -0.025;
  keySwing.add(keyRing);
  const woodFob = new THREE.Mesh(new RoundedBoxGeometry(0.092, 0.155, 0.026, 4, 0.012), materials.oak);
  woodFob.position.y = -0.108;
  woodFob.castShadow = true;
  keySwing.add(woodFob);
  const brassStar = new THREE.Mesh(new THREE.OctahedronGeometry(0.025, 0), materials.brass);
  brassStar.scale.set(1, 1, 0.35);
  brassStar.position.set(0, -0.108, 0.016);
  keySwing.add(brassStar);
  nextRoomStand.add(keySwing);

  const keepsakeRow = new THREE.Group();
  keepsakeRow.position.set(0, 0.02, 0.11);
  nextRoomStand.add(keepsakeRow);
  nextRoomStand.userData = { interactType: 'nextRoomKey', keySwing, keepsakeRow };
  root.add(nextRoomStand);

  // Scene 0 Alcove: Uniform Selection Bench
  const uniformStation = new THREE.Group();
  uniformStation.position.set(0, 0, 2.05);

  const dressBench = new THREE.Mesh(new RoundedBoxGeometry(1.48, 0.13, 0.52, 5, 0.045), materials.pillowLinen);
  dressBench.position.set(0, 0.38, 0.40);
  dressBench.castShadow = true;
  dressBench.receiveShadow = true;
  uniformStation.add(dressBench);

  const dressBenchFrame = new THREE.Mesh(new RoundedBoxGeometry(1.52, 0.065, 0.54, 3, 0.018), materials.walnut);
  dressBenchFrame.position.set(0, 0.295, 0.40);
  dressBenchFrame.castShadow = true;
  uniformStation.add(dressBenchFrame);

  for (const lx of [-0.66, 0.66]) {
    for (const lz of [0.19, 0.61]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.019, 0.29, 12), materials.oak);
      leg.position.set(lx, 0.145, lz);
      leg.castShadow = true;
      uniformStation.add(leg);
    }
  }

  const tunicSwatches = [];
  const tunicHexes = [0x5c4332, 0x5a6e5c, 0x3b4b5e];
  for (let c = 0; c < 3; c++) {
    const tGroup = new THREE.Group();
    const tMat = new THREE.MeshPhysicalMaterial({
      color: tunicHexes[c],
      normalMap: texLinen.normalMap,
      roughness: 0.80,
      sheen: 0.65
    });
    const folded = new THREE.Mesh(new RoundedBoxGeometry(0.21, 0.052, 0.23, 4, 0.02), tMat);
    folded.castShadow = true;
    folded.receiveShadow = true;
    tGroup.add(folded);
    const miniCollar = new THREE.Mesh(new THREE.TorusGeometry(0.046, 0.013, 8, 16, Math.PI * 1.4), materials.linen);
    miniCollar.rotation.x = Math.PI / 2;
    miniCollar.rotation.z = Math.PI * 0.8;
    miniCollar.position.set(0, 0.028, -0.038);
    tGroup.add(miniCollar);

    tGroup.position.set(-0.50 + c * 0.14, 0.475 + c * 0.016, 0.42 - c * 0.035);
    tGroup.rotation.y = (c - 1) * 0.12;
    tGroup.userData = {
      interactType: 'uniformItem',
      piece: 'dress',
      variant: c,
      hex: tunicHexes[c],
      homePos: tGroup.position.clone()
    };
    uniformStation.add(tGroup);
    tunicSwatches.push(tGroup);
  }

  const apronProp = new THREE.Group();
  const apBody = new THREE.Mesh(new RoundedBoxGeometry(0.26, 0.045, 0.28, 4, 0.018), materials.linen);
  apBody.castShadow = true;
  apBody.receiveShadow = true;
  apronProp.add(apBody);
  for (let r = -3; r <= 3; r++) {
    const frill = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), materials.pillowLinen);
    frill.scale.set(1.1, 0.5, 0.8);
    frill.position.set(r * 0.035, 0.020, 0.135);
    apronProp.add(frill);
  }
  const apStrapL = new THREE.Mesh(new RoundedBoxGeometry(0.036, 0.018, 0.13, 2, 0.006), materials.linen);
  apStrapL.position.set(-0.075, 0.022, -0.155);
  const apStrapR = apStrapL.clone();
  apStrapR.position.x = 0.075;
  apronProp.add(apStrapL, apStrapR);
  apronProp.position.set(0.08, 0.475, 0.41);
  apronProp.userData = {
    interactType: 'uniformItem',
    piece: 'apron',
    variant: 0,
    homePos: apronProp.position.clone()
  };
  uniformStation.add(apronProp);

  const capProp = new THREE.Group();
  const capBand = new THREE.Mesh(
    new THREE.CylinderGeometry(0.105, 0.115, 0.052, 20, 1, false, 0, Math.PI * 1.3),
    materials.pillowLinen
  );
  capBand.rotation.y = -Math.PI * 0.15;
  capBand.castShadow = true;
  capProp.add(capBand);
  for (let f = 0; f < 9; f++) {
    const a = (f / 8 - 0.5) * 2.1;
    const pleat = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), materials.linen);
    pleat.position.set(Math.sin(a) * 0.11, 0.028, Math.cos(a) * 0.11 * 0.65);
    capProp.add(pleat);
  }
  capProp.position.set(0.48, 0.485, 0.40);
  capProp.userData = {
    interactType: 'uniformItem',
    piece: 'cap',
    variant: 0,
    homePos: capProp.position.clone()
  };
  uniformStation.add(capProp);
  root.add(uniformStation);

  const dynamicGroup = new THREE.Group();
  root.add(dynamicGroup);

  return {
    root,
    materials,
    textures: { texShadow, texLinen, texTerry, runnerTextures, garmentTextures },
    doorPivot,
    curtainSim,
    bedCloth,
    pillows,
    bedRunner,
    footBench,
    runnerSwatches,
    lampGroup,
    lampLight,
    vaseGroup,
    mirrorFrameGroup,
    easelGroup,
    hamperGroup,
    towelBasketGroup,
    hospitalityTray,
    freshTowelStack,
    bellGroup,
    primarySwan,
    secondarySwan,
    nextRoomStand,
    uniformStation,
    tunicSwatches,
    apronProp,
    capProp,
    dynamicGroup
  };
}

function BoxGeometrySimple(w, h, d) {
  return new THREE.BoxGeometry(w, h, d);
}

// Recognizable Sculpted Garments (Striped Button Shirt / Ribbed Knit Sweater) & Soft S-Folded Terry Bath Towels!
export function createMessyFabricItem(kind, variant, materials, textures) {
  const group = new THREE.Group();

  const sh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.50, 0.50),
    new THREE.MeshBasicMaterial({ map: textures.texShadow, transparent: true, opacity: 0.62, depthWrite: false })
  );
  sh.rotation.x = -Math.PI / 2;
  sh.position.y = 0.004;
  group.add(sh);

  if (kind === 'cloth') {
    // Recognizable Soft Draped Shirt / Knit Cardigan with Body, Collar & Two Draped Sleeves!
    const gTex = textures.garmentTextures[variant % textures.garmentTextures.length];
    const clothMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: gTex,
      normalMap: materials.linen.normalMap,
      normalScale: new THREE.Vector2(0.55, 0.55),
      roughness: 0.85,
      sheen: 0.72,
      sheenColor: new THREE.Color(0xf8f2ea),
      side: THREE.DoubleSide
    });

    // Soft rumpled shirt body cushion
    const bodyGeo = new RoundedBoxGeometry(0.32, 0.068, 0.34, 6, 0.028);
    const bPos = bodyGeo.attributes.position;
    for (let i = 0; i < bPos.count; i++) {
      const x = bPos.getX(i);
      const y = bPos.getY(i);
      const z = bPos.getZ(i);
      const wave = Math.sin(x * 16 + variant) * 0.014 + Math.cos(z * 14 - variant) * 0.014;
      bPos.setXYZ(i, x + z * 0.08, Math.max(0.006, y + 0.036 + wave), z);
    }
    bodyGeo.computeVertexNormals();
    const body = new THREE.Mesh(bodyGeo, clothMat);
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // Two soft curved shirt sleeves sprawled organically
    for (const s of [-1, 1]) {
      const slvCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(s * 0.13, 0.052, -0.09),
        new THREE.Vector3(s * 0.23, 0.038, -0.01 + s * 0.04),
        new THREE.Vector3(s * 0.21, 0.024, 0.13)
      ]);
      const slv = new THREE.Mesh(new THREE.TubeGeometry(slvCurve, 12, 0.042, 10, false), clothMat);
      slv.scale.set(1, 0.62, 1);
      slv.castShadow = true;
      slv.receiveShadow = true;
      group.add(slv);
    }

    // Tailored Shirt Collar & Placket Strip
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.016, 8, 18, Math.PI * 1.45), materials.pillowLinen);
    collar.rotation.x = Math.PI / 2;
    collar.rotation.z = Math.PI * 0.78;
    collar.position.set(0, 0.076, -0.10);
    collar.castShadow = true;
    group.add(collar);
  } else {
    // Plush Rumpled Hotel Terry-Cloth Bath Towel (Soft S-folded thick textile—NO paper-towel cylinder!)
    const terryMat = materials.terry.clone();
    terryMat.side = THREE.DoubleSide;

    const ribbonGeo = new RoundedBoxGeometry(0.40, 0.046, 0.32, 8, 0.020);
    const rPos = ribbonGeo.attributes.position;
    const ph = variant * 1.9;
    for (let i = 0; i < rPos.count; i++) {
      const x = rPos.getX(i);
      const y = rPos.getY(i);
      const z = rPos.getZ(i);
      // Organic crumpled S-fold wave across thick terry towel
      const arch = Math.sin(x * 13 + ph) * 0.028 + Math.sin(z * 11 - ph) * 0.022;
      const pinch = Math.cos(z * 8 + ph) * 0.045;
      rPos.setXYZ(i, x + pinch, Math.max(0.006, y + 0.032 + arch), z + Math.sin(x * 7) * 0.035);
    }
    ribbonGeo.computeVertexNormals();
    const towelBody = new THREE.Mesh(ribbonGeo, terryMat);
    towelBody.castShadow = true;
    towelBody.receiveShadow = true;
    group.add(towelBody);

    // Second draped corner fold overlapping softly on top
    const topFoldGeo = new RoundedBoxGeometry(0.24, 0.034, 0.20, 5, 0.015);
    const topFold = new THREE.Mesh(topFoldGeo, terryMat);
    topFold.position.set(0.04, 0.058, -0.02);
    topFold.rotation.set(0.12, 0.45 + variant, -0.08);
    topFold.castShadow = true;
    topFold.receiveShadow = true;
    group.add(topFold);
  }

  const hitProxy = new THREE.Mesh(
    new THREE.SphereGeometry(0.30, 8, 8),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.0, depthWrite: false })
  );
  hitProxy.position.y = 0.08;
  group.add(hitProxy);

  group.userData = {
    interactType: 'messyItem',
    kind,
    variant,
    shadowMesh: sh,
    velocity: new THREE.Vector3(),
    isFlying: false,
    collected: false
  };

  return group;
}

export function createHotelChocolate(variety, brassMat, shadowTex) {
  const group = new THREE.Group();

  const sh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.16, 0.16),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: 0.55, depthWrite: false })
  );
  sh.rotation.x = -Math.PI / 2;
  sh.position.y = 0.002;
  group.add(sh);

  // Crisp Ivory Turn-Down Card + Fluted Gold-Foil Cup under each Artisanal Hotel Chocolate!
  const card = new THREE.Mesh(
    new RoundedBoxGeometry(0.125, 0.005, 0.095, 2, 0.002),
    new THREE.MeshPhysicalMaterial({ color: 0xfbf7ee, roughness: 0.62, clearcoat: 0.1 })
  );
  card.position.y = 0.003;
  card.castShadow = true;
  group.add(card);

  const foil = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.040, 0.016, 20), brassMat);
  foil.position.y = 0.012;
  foil.castShadow = true;
  group.add(foil);

  const chocConfigs = [
    { color: 0x2b170e, rough: 0.20, shape: 'square' },
    { color: 0x5e3620, rough: 0.24, shape: 'dome' },
    { color: 0xb85868, rough: 0.26, shape: 'truffle' },
    { color: 0xf2e6d0, rough: 0.22, shape: 'heart' }
  ];
  const cfg = chocConfigs[variety % chocConfigs.length];
  const chocMat = new THREE.MeshPhysicalMaterial({
    color: cfg.color,
    roughness: cfg.rough,
    clearcoat: 0.65,
    clearcoatRoughness: 0.18
  });

  let piece;
  if (cfg.shape === 'square') {
    piece = new THREE.Mesh(new RoundedBoxGeometry(0.068, 0.036, 0.068, 3, 0.008), chocMat);
    piece.position.y = 0.030;
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.022, 0.018), brassMat);
    leaf.rotation.x = -Math.PI / 2;
    leaf.rotation.z = 0.4;
    leaf.position.set(0.006, 0.049, -0.004);
    group.add(leaf);
  } else if (cfg.shape === 'dome') {
    piece = new THREE.Mesh(new THREE.SphereGeometry(0.038, 18, 14), chocMat);
    piece.scale.set(1, 0.78, 1);
    piece.position.y = 0.028;
    const swirl = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.004, 6, 16), chocMat);
    swirl.rotation.x = Math.PI / 2;
    swirl.position.y = 0.055;
    group.add(swirl);
  } else if (cfg.shape === 'truffle') {
    piece = new THREE.Mesh(new THREE.DodecahedronGeometry(0.036, 2), chocMat);
    piece.scale.set(1, 0.85, 1);
    piece.position.y = 0.032;
  } else {
    piece = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.032, 0.034, 18), chocMat);
    piece.position.y = 0.029;
    const drizzle = new THREE.Mesh(
      new THREE.BoxGeometry(0.048, 0.005, 0.008),
      new THREE.MeshPhysicalMaterial({ color: 0x4a2916, roughness: 0.25 })
    );
    drizzle.position.y = 0.047;
    drizzle.rotation.y = 0.5;
    group.add(drizzle);
  }
  piece.castShadow = true;
  group.add(piece);

  const hitProxy = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 8, 8),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.0, depthWrite: false })
  );
  hitProxy.position.y = 0.04;
  group.add(hitProxy);

  group.scale.setScalar(1.18);
  group.userData = {
    interactType: 'chocolate',
    variety,
    placedZone: 'tray',
    homePos: new THREE.Vector3()
  };

  return group;
}
