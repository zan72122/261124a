import * as THREE from 'three';
import {
  createOakFloorTextures,
  createBoucleRugTextures,
  createQuiltedFoamTextures,
  createMeshBagTexture,
  createPictureSignboardCanvas
} from './textures.js';
import { POOL_CONFIG, SLIDE_CONFIG } from './physics.js';

// High-saturation commercial photography LDPE ball palette (Pink, Sky-Cyan Blue, Sunny Canary Yellow)
export const BALL_COLORS = [
  new THREE.Color('#ff2674'), // Punchy commercial rose-pink
  new THREE.Color('#069eff'), // Punchy commercial sky-cyan blue
  new THREE.Color('#ffd60a')  // Bright radiant canary-sunshine yellow (never dull ochre!)
];

export const BALL_HEX = ['#ff2674', '#069eff', '#ffd60a'];

// Build custom HDR studio softbox + sunlit living-room PMREM environment map
// Balanced diffuse ambient + bright localized specular softboxes so glossy clearcoat sparkles!
export function createStudioEnvironment(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x58524a);

  // Mid-dark warm interior room shell so clearcoat reflections have high contrast!
  const shellGeo = new THREE.SphereGeometry(14, 24, 16);
  const shellMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0.32, 0.29, 0.26),
    side: THREE.BackSide
  });
  envScene.add(new THREE.Mesh(shellGeo, shellMat));

  // Warm honey-oak floor bounce
  const floorBounce = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 20),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 0.38, 0.22), side: THREE.DoubleSide })
  );
  floorBounce.rotation.x = -Math.PI * 0.5;
  floorBounce.position.y = -3.0;
  envScene.add(floorBounce);

  // Crisp bright sunlit balcony window softbox (creates sharp curved white specular catchlights on every ball!)
  const keyWindow = new THREE.Mesh(
    new THREE.PlaneGeometry(5.8, 4.0),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(9.5, 9.2, 8.6), side: THREE.DoubleSide })
  );
  keyWindow.position.set(-4.2, 8.2, -3.4);
  keyWindow.lookAt(0, 0, 0);
  envScene.add(keyWindow);

  // Secondary overhead studio strip softbox
  const topStrip = new THREE.Mesh(
    new THREE.PlaneGeometry(4.4, 1.8),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(6.5, 6.8, 7.4), side: THREE.DoubleSide })
  );
  topStrip.position.set(2.4, 9.6, -1.0);
  topStrip.lookAt(0, 0, 0);
  envScene.add(topStrip);

  // Subtle cool fill window on right
  const fillWindow = new THREE.Mesh(
    new THREE.PlaneGeometry(5.0, 3.6),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.85, 2.2), side: THREE.DoubleSide })
  );
  fillWindow.position.set(7.5, 4.8, 2.6);
  fillWindow.lookAt(0, 0, 0);
  envScene.add(fillWindow);

  const envRT = pmrem.fromScene(envScene, 0.018);
  pmrem.dispose();
  return envRT.texture;
}

export function createPlayroomEnvironment(scene, shadowTexture) {
  const root = new THREE.Group();
  scene.add(root);

  // 1. Wide-Plank Honey Oak Hardwood Floor
  const oak = createOakFloorTextures();
  const floorMat = new THREE.MeshStandardMaterial({
    map: oak.map,
    bumpMap: oak.bumpMap,
    bumpScale: 0.010,
    roughnessMap: oak.roughnessMap,
    roughness: 0.48,
    metalness: 0.0,
    envMapIntensity: 0.45
  });
  const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(11.2, 12.4), floorMat);
  floorMesh.rotation.x = -Math.PI * 0.5;
  floorMesh.receiveShadow = true;
  root.add(floorMesh);

  // 2. Warm Oatmeal-Greige Woven Boucle Play Rug beneath pool & slide
  const boucle = createBoucleRugTextures();
  const rugShape = new THREE.Shape();
  const rw = 3.16, rh = 2.12, rr = 0.28;
  rugShape.moveTo(-rw * 0.5 + rr, -rh * 0.5);
  rugShape.lineTo(rw * 0.5 - rr, -rh * 0.5);
  rugShape.quadraticCurveTo(rw * 0.5, -rh * 0.5, rw * 0.5, -rh * 0.5 + rr);
  rugShape.lineTo(rw * 0.5, rh * 0.5 - rr);
  rugShape.quadraticCurveTo(rw * 0.5, rh * 0.5, rw * 0.5 - rr, rh * 0.5);
  rugShape.lineTo(-rw * 0.5 + rr, rh * 0.5);
  rugShape.quadraticCurveTo(-rw * 0.5, rh * 0.5, -rw * 0.5, rh * 0.5 - rr);
  rugShape.lineTo(-rw * 0.5, -rh * 0.5 + rr);
  rugShape.quadraticCurveTo(-rw * 0.5, -rh * 0.5, -rw * 0.5 + rr, -rh * 0.5);

  const rugGeo = new THREE.ExtrudeGeometry(rugShape, {
    depth: 0.010,
    bevelEnabled: true,
    bevelThickness: 0.005,
    bevelSize: 0.014,
    bevelSegments: 2,
    curveSegments: 12
  });
  rugGeo.rotateX(-Math.PI * 0.5);
  const rugPos = rugGeo.attributes.position;
  const rugUv = rugGeo.attributes.uv;
  for (let i = 0; i < rugPos.count; i++) {
    rugUv.setXY(i, (rugPos.getX(i) + rw * 0.5) / rw, (rugPos.getZ(i) + rh * 0.5) / rh);
  }
  const rugMat = new THREE.MeshStandardMaterial({
    map: boucle.map,
    bumpMap: boucle.bumpMap,
    bumpScale: 0.016,
    roughness: 0.92,
    metalness: 0.0,
    envMapIntensity: 0.35
  });
  const rugMesh = new THREE.Mesh(rugGeo, rugMat);
  rugMesh.position.set(-0.04, 0.002, 0.06);
  rugMesh.castShadow = true;
  rugMesh.receiveShadow = true;
  root.add(rugMesh);

  // 3. Real-time Ball Contact Shadow Overlay Planes (floor + inner pool mat)
  const contactShadowMat = new THREE.MeshBasicMaterial({
    map: shadowTexture,
    transparent: true,
    depthWrite: false,
    opacity: 0.92
  });
  const floorShadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 3.36), contactShadowMat);
  floorShadowPlane.rotation.x = -Math.PI * 0.5;
  floorShadowPlane.position.set(0, 0.016, 0);
  root.add(floorShadowPlane);

  const innerShadowGeo = new THREE.PlaneGeometry(POOL_CONFIG.hx * 2, POOL_CONFIG.hz * 2);
  const uvAttr = innerShadowGeo.attributes.uv;
  const uMin = (POOL_CONFIG.cx - POOL_CONFIG.hx - (-2.25)) / 4.5;
  const uMax = (POOL_CONFIG.cx + POOL_CONFIG.hx - (-2.25)) / 4.5;
  const vTop = 1.0 - (POOL_CONFIG.cz - POOL_CONFIG.hz - (-1.68)) / 3.36;
  const vBot = 1.0 - (POOL_CONFIG.cz + POOL_CONFIG.hz - (-1.68)) / 3.36;
  uvAttr.setXY(0, uMin, vTop);
  uvAttr.setXY(1, uMax, vTop);
  uvAttr.setXY(2, uMin, vBot);
  uvAttr.setXY(3, uMax, vBot);
  const poolShadowPlane = new THREE.Mesh(innerShadowGeo, contactShadowMat);
  poolShadowPlane.rotation.x = -Math.PI * 0.5;
  poolShadowPlane.position.set(POOL_CONFIG.cx, POOL_CONFIG.matY + 0.003, POOL_CONFIG.cz);
  root.add(poolShadowPlane);

  // 4. Cushioned Quilted PU-Leather Ball Pool
  const poolGroup = new THREE.Group();
  root.add(poolGroup);

  const foamTex = createQuiltedFoamTextures();
  const foamMat = new THREE.MeshPhysicalMaterial({
    map: foamTex.map,
    bumpMap: foamTex.bumpMap,
    bumpScale: 0.012,
    color: 0xf4efe6,
    roughness: 0.48,
    metalness: 0.0,
    clearcoat: 0.22,
    clearcoatRoughness: 0.42,
    envMapIntensity: 0.55
  });

  const innerMatMat = new THREE.MeshStandardMaterial({
    map: foamTex.map,
    bumpMap: foamTex.bumpMap,
    bumpScale: 0.008,
    color: 0xe3dcd0,
    roughness: 0.62,
    envMapIntensity: 0.4
  });

  const { cx, cz, hx, hz, wallT, wallH, matY } = POOL_CONFIG;
  const rimR = wallT * 0.5;
  const bodyH = wallH - rimR;
  const midX = hx + rimR;
  const midZ = hz + rimR;

  const innerMat = new THREE.Mesh(
    new THREE.BoxGeometry(hx * 2 + wallT, matY, hz * 2 + wallT),
    innerMatMat
  );
  innerMat.position.set(cx, matY * 0.5, cz);
  innerMat.receiveShadow = true;
  poolGroup.add(innerMat);

  // Subtle inner-corner AO vignette on pool floor so empty pool has realistic 3D depth!
  const poolAoCanvas = document.createElement('canvas');
  poolAoCanvas.width = 256;
  poolAoCanvas.height = 256;
  const paoCtx = poolAoCanvas.getContext('2d');
  paoCtx.strokeStyle = 'rgba(65, 52, 38, 0.34)';
  paoCtx.lineWidth = 26;
  paoCtx.filter = 'blur(10px)';
  paoCtx.strokeRect(8, 8, 240, 240);
  const poolAoTex = new THREE.CanvasTexture(poolAoCanvas);
  const poolAoPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(hx * 2 + 0.02, hz * 2 + 0.02),
    new THREE.MeshBasicMaterial({ map: poolAoTex, transparent: true, depthWrite: false })
  );
  poolAoPlane.rotation.x = -Math.PI * 0.5;
  poolAoPlane.position.set(cx, matY + 0.001, cz);
  poolGroup.add(poolAoPlane);

  const buildFoamWall = (len, alongX, wx, wz) => {
    const g = new THREE.Group();
    const box = new THREE.Mesh(
      alongX ? new THREE.BoxGeometry(len, bodyH, wallT) : new THREE.BoxGeometry(wallT, bodyH, len),
      foamMat
    );
    box.position.y = bodyH * 0.5;
    box.castShadow = true;
    box.receiveShadow = true;
    g.add(box);

    const cyl = new THREE.Mesh(
      new THREE.CylinderGeometry(rimR, rimR, len, 16, 1),
      foamMat
    );
    if (alongX) cyl.rotation.z = Math.PI * 0.5;
    else cyl.rotation.x = Math.PI * 0.5;
    cyl.position.y = bodyH;
    cyl.castShadow = true;
    cyl.receiveShadow = true;
    g.add(cyl);

    g.position.set(wx, 0, wz);
    poolGroup.add(g);
  };

  buildFoamWall(hx * 2, true, cx, cz - midZ);
  buildFoamWall(hx * 2, true, cx, cz + midZ);
  buildFoamWall(hz * 2, false, cx - midX, cz);
  buildFoamWall(hz * 2, false, cx + midX, cz);

  const cornerCoords = [
    [cx - midX, cz - midZ],
    [cx + midX, cz - midZ],
    [cx - midX, cz + midZ],
    [cx + midX, cz + midZ]
  ];
  for (const [corX, corZ] of cornerCoords) {
    const cCyl = new THREE.Mesh(new THREE.CylinderGeometry(rimR, rimR, bodyH, 16), foamMat);
    cCyl.position.set(corX, bodyH * 0.5, corZ);
    cCyl.castShadow = true;
    cCyl.receiveShadow = true;
    poolGroup.add(cCyl);

    const cCap = new THREE.Mesh(
      new THREE.SphereGeometry(rimR, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5),
      foamMat
    );
    cCap.position.set(corX, bodyH, corZ);
    cCap.castShadow = true;
    cCap.receiveShadow = true;
    poolGroup.add(cCap);
  }

  // 5. Sleek Modern Beechwood & Satin-Cream Indoor Slide
  const slideGroup = new THREE.Group();
  root.add(slideGroup);

  const beechMat = new THREE.MeshStandardMaterial({
    map: oak.map,
    roughness: 0.40,
    color: 0xdfb888,
    envMapIntensity: 0.5
  });
  const slideWhiteMat = new THREE.MeshPhysicalMaterial({
    color: 0xf6f2ea,
    roughness: 0.16,
    clearcoat: 0.9,
    clearcoatRoughness: 0.1,
    envMapIntensity: 0.75
  });

  const dx = SLIDE_CONFIG.xBot - SLIDE_CONFIG.xTop;
  const dy = SLIDE_CONFIG.yBot - SLIDE_CONFIG.yTop;
  const chuteLen = Math.hypot(dx, dy);
  const chuteAngle = Math.atan2(dy, dx);
  const midSlideX = (SLIDE_CONFIG.xTop + SLIDE_CONFIG.xBot) * 0.5;
  const midSlideY = (SLIDE_CONFIG.yTop + SLIDE_CONFIG.yBot) * 0.5;

  // Subtle gradient texture on slide chute so its downward slope into the pool reads clearly from overhead!
  const chuteCanvas = document.createElement('canvas');
  chuteCanvas.width = 256;
  chuteCanvas.height = 128;
  const chCtx = chuteCanvas.getContext('2d');
  const chGrad = chCtx.createLinearGradient(0, 0, 256, 0);
  chGrad.addColorStop(0, '#fcfaf5');
  chGrad.addColorStop(0.55, '#f2ece2');
  chGrad.addColorStop(1, '#e4dcd0');
  chCtx.fillStyle = chGrad;
  chCtx.fillRect(0, 0, 256, 128);
  // Subtle rail-edge AO along top & bottom edges of chute
  chCtx.fillStyle = 'rgba(90, 72, 50, 0.12)';
  chCtx.fillRect(0, 0, 256, 9);
  chCtx.fillRect(0, 119, 256, 9);
  const chuteTex = new THREE.CanvasTexture(chuteCanvas);
  chuteTex.colorSpace = THREE.SRGBColorSpace;

  const slideChuteMat = new THREE.MeshPhysicalMaterial({
    map: chuteTex,
    roughness: 0.14,
    clearcoat: 0.92,
    clearcoatRoughness: 0.08,
    envMapIntensity: 0.8
  });

  const chuteMesh = new THREE.Mesh(
    new THREE.BoxGeometry(chuteLen + 0.08, 0.028, SLIDE_CONFIG.halfW * 2),
    slideChuteMat
  );
  chuteMesh.position.set(midSlideX, midSlideY, SLIDE_CONFIG.cz);
  chuteMesh.rotation.z = chuteAngle;
  chuteMesh.castShadow = true;
  chuteMesh.receiveShadow = true;
  slideGroup.add(chuteMesh);

  const topPlat = new THREE.Mesh(
    new THREE.BoxGeometry(0.20, 0.032, SLIDE_CONFIG.halfW * 2),
    slideWhiteMat
  );
  topPlat.position.set(SLIDE_CONFIG.xTop - 0.08, SLIDE_CONFIG.yTop, SLIDE_CONFIG.cz);
  topPlat.castShadow = true;
  topPlat.receiveShadow = true;
  slideGroup.add(topPlat);

  // Overhead beechwood safety grip bar across top of slide (casts real 3D shadow onto chute!)
  const safetyBar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.018, SLIDE_CONFIG.halfW * 2 + 0.05, 12),
    beechMat
  );
  safetyBar.rotation.x = Math.PI * 0.5;
  safetyBar.position.set(SLIDE_CONFIG.xTop - 0.01, SLIDE_CONFIG.yTop + 0.11, SLIDE_CONFIG.cz);
  safetyBar.castShadow = true;
  slideGroup.add(safetyBar);

  [-1, 1].forEach((side) => {
    const zOff = SLIDE_CONFIG.cz + side * (SLIDE_CONFIG.halfW + 0.022);
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(chuteLen + 0.12, 0.095, 0.034),
      beechMat
    );
    rail.position.set(midSlideX, midSlideY + 0.036, zOff);
    rail.rotation.z = chuteAngle;
    rail.castShadow = true;
    slideGroup.add(rail);

    const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.034), beechMat);
    topRail.position.set(SLIDE_CONFIG.xTop - 0.08, SLIDE_CONFIG.yTop + 0.048, zOff);
    topRail.castShadow = true;
    slideGroup.add(topRail);

    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.026, 0.84, 10), beechMat);
    leg.position.set(SLIDE_CONFIG.xTop - 0.24, 0.39, zOff);
    leg.rotation.z = -0.26;
    leg.castShadow = true;
    slideGroup.add(leg);

    const frontLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.024, 0.56, 10), beechMat);
    frontLeg.position.set(-1.02, 0.27, zOff);
    frontLeg.castShadow = true;
    slideGroup.add(frontLeg);
  });

  // Visible stair treads extending to the left of the platform so the ladder reads from overhead!
  const stepMat = new THREE.MeshStandardMaterial({
    map: oak.map,
    color: 0xc89a66,
    roughness: 0.48
  });
  for (let s = 0; s < 3; s++) {
    const step = new THREE.Mesh(
      new THREE.BoxGeometry(0.085, 0.026, SLIDE_CONFIG.halfW * 1.92),
      stepMat
    );
    step.position.set(SLIDE_CONFIG.xTop - 0.36 + s * 0.085, 0.20 + s * 0.19, SLIDE_CONFIG.cz);
    step.castShadow = true;
    step.receiveShadow = true;
    slideGroup.add(step);
  }

  // 6. Single Wordless Wooden Picture Signboard ("ルールは絵の看板1枚で見せる")
  const signData = createPictureSignboardCanvas();
  const signGroup = new THREE.Group();
  signGroup.position.set(-1.18, 0.0, -1.04);
  root.add(signGroup);

  const boardPivot = new THREE.Group();
  boardPivot.position.set(0, 0.16, 0);
  boardPivot.rotation.x = -1.22;
  boardPivot.rotation.z = 0.04;
  signGroup.add(boardPivot);

  const signBack = new THREE.Mesh(
    new THREE.BoxGeometry(0.84, 0.42, 0.028),
    beechMat
  );
  signBack.castShadow = true;
  signBack.receiveShadow = true;
  boardPivot.add(signBack);

  const signFace = new THREE.Mesh(
    new THREE.PlaneGeometry(0.81, 0.395),
    new THREE.MeshStandardMaterial({
      map: signData.texture,
      roughness: 0.58,
      metalness: 0.0,
      envMapIntensity: 0.30
    })
  );
  signFace.position.z = 0.015;
  boardPivot.add(signFace);

  [-0.28, 0.28].forEach((fx) => {
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.032, 0.28), beechMat);
    foot.position.set(fx, 0.016, 0.02);
    foot.castShadow = true;
    signGroup.add(foot);
  });

  // 7. Three Plump Translucent Nylon-Mesh Ball Bags
  // Parked neatly on right during Dress-Up so outfits have 100% clean foreground space, then glide front in Scene 1!
  const bagConfigs = [
    { colorId: 0, hex: BALL_HEX[0], parkX: 1.54, parkZ: -0.68, pourX: -1.16, pourZ: 1.00 },
    { colorId: 1, hex: BALL_HEX[1], parkX: 1.58, parkZ: -0.06, pourX: 0.14,  pourZ: 1.06 },
    { colorId: 2, hex: BALL_HEX[2], parkX: 1.54, parkZ: 0.56,  pourX: 1.38,  pourZ: 0.98 }
  ];

  const bags = bagConfigs.map((cfg) => {
    const bagGroup = new THREE.Group();
    bagGroup.position.set(cfg.parkX, 0, cfg.parkZ);
    root.add(bagGroup);

    const bodyPivot = new THREE.Group();
    bodyPivot.position.y = 0.22;
    bagGroup.add(bodyPivot);

    const sackGeo = new THREE.CylinderGeometry(0.19, 0.24, 0.42, 18, 5, false);
    const sPos = sackGeo.attributes.position;
    for (let i = 0; i < sPos.count; i++) {
      const y = sPos.getY(i);
      const bulge = 1.0 + Math.cos((y / 0.21) * 1.15) * 0.15;
      sPos.setX(i, sPos.getX(i) * bulge);
      sPos.setZ(i, sPos.getZ(i) * bulge);
    }
    sackGeo.computeVertexNormals();

    const meshTex = createMeshBagTexture(cfg.hex);
    const sackMat = new THREE.MeshPhysicalMaterial({
      map: meshTex,
      transparent: true,
      alphaTest: 0.05,
      roughness: 0.36,
      clearcoat: 0.22,
      envMapIntensity: 0.5,
      side: THREE.DoubleSide
    });
    const sackMesh = new THREE.Mesh(sackGeo, sackMat);
    sackMesh.castShadow = true;
    bodyPivot.add(sackMesh);

    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(0.178, 0.025, 10, 20),
      new THREE.MeshStandardMaterial({ color: cfg.hex, roughness: 0.48, envMapIntensity: 0.5 })
    );
    collar.rotation.x = Math.PI * 0.5;
    collar.position.y = 0.21;
    bodyPivot.add(collar);

    const innerBallGeo = new THREE.SphereGeometry(0.044, 10, 7);
    const innerBallMat = new THREE.MeshPhysicalMaterial({
      color: BALL_COLORS[cfg.colorId],
      roughness: 0.12,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      envMapIntensity: 1.1
    });
    const innerCount = 38;
    const innerInst = new THREE.InstancedMesh(innerBallGeo, innerBallMat, innerCount);
    const dummy = new THREE.Object3D();
    for (let k = 0; k < innerCount; k++) {
      const layer = Math.floor(k / 9);
      const ang = (k % 9) * ((Math.PI * 2) / 9) + layer * 0.45;
      const rad = k % 9 === 8 ? 0.02 : 0.132 - layer * 0.011;
      const yy = -0.15 + layer * 0.082 + (k % 2) * 0.012;
      dummy.position.set(Math.cos(ang) * rad, yy, Math.sin(ang) * rad);
      dummy.updateMatrix();
      innerInst.setMatrixAt(k, dummy.matrix);
    }
    innerInst.instanceMatrix.needsUpdate = true;
    bodyPivot.add(innerInst);

    return {
      colorId: cfg.colorId,
      group: bagGroup,
      bodyPivot,
      parkX: cfg.parkX,
      parkZ: cfg.parkZ,
      pourX: cfg.pourX,
      pourZ: cfg.pourZ,
      homeX: cfg.parkX,
      homeZ: cfg.parkZ,
      x: cfg.parkX,
      y: 0,
      z: cfg.parkZ,
      pouredCount: 0,
      wobble: 0
    };
  });

  // 8. Three Color-Coded Molded Storage Crates for Scene 3 Cleanup & Free Play
  const cratePositions = [
    { colorId: 0, hex: '#f02874', darkHex: '#b81854', x: -1.18, z: 0.98 },
    { colorId: 1, hex: '#0c92f5', darkHex: '#0864b5', x: 0.14,  z: 1.04 },
    { colorId: 2, hex: '#f5b806', darkHex: '#be8904', x: 1.38,  z: 0.98 }
  ];

  // Inner crate ambient-occlusion floor vignette texture so crates have deep 3D cavity volume from overhead!
  const crateAoCanvas = document.createElement('canvas');
  crateAoCanvas.width = 128;
  crateAoCanvas.height = 128;
  const caoCtx = crateAoCanvas.getContext('2d');
  const caoGrad = caoCtx.createRadialGradient(64, 64, 18, 64, 64, 78);
  caoGrad.addColorStop(0, 'rgba(0,0,0,0.08)');
  caoGrad.addColorStop(0.7, 'rgba(0,0,0,0.28)');
  caoGrad.addColorStop(1, 'rgba(0,0,0,0.52)');
  caoCtx.fillStyle = caoGrad;
  caoCtx.fillRect(0, 0, 128, 128);
  // Subtle molded crate floor ribs
  caoCtx.strokeStyle = 'rgba(255,255,255,0.14)';
  caoCtx.lineWidth = 3;
  for (let r = 20; r <= 108; r += 18) {
    caoCtx.beginPath();
    caoCtx.moveTo(14, r);
    caoCtx.lineTo(114, r);
    caoCtx.stroke();
  }
  const crateAoTex = new THREE.CanvasTexture(crateAoCanvas);

  const crateMeshes = cratePositions.map((cp) => {
    const cg = new THREE.Group();
    cg.position.set(cp.x, 0, cp.z);
    cg.visible = false;
    root.add(cg);

    const crateMat = new THREE.MeshPhysicalMaterial({
      color: cp.hex,
      roughness: 0.24,
      clearcoat: 0.72,
      clearcoatRoughness: 0.14,
      envMapIntensity: 0.78
    });
    const innerWallMat = new THREE.MeshStandardMaterial({
      color: cp.darkHex,
      roughness: 0.42,
      envMapIntensity: 0.45
    });
    const creamTrimMat = new THREE.MeshStandardMaterial({
      color: 0xf4eee2,
      roughness: 0.36
    });

    const hxC = 0.25, hzC = 0.20, hC = 0.26, wt = 0.024;
    const bottom = new THREE.Mesh(new THREE.BoxGeometry(hxC * 2, wt, hzC * 2), innerWallMat);
    bottom.position.y = wt * 0.5;
    bottom.castShadow = true;
    bottom.receiveShadow = true;
    cg.add(bottom);

    const bottomAo = new THREE.Mesh(
      new THREE.PlaneGeometry(hxC * 1.92, hzC * 1.92),
      new THREE.MeshBasicMaterial({ map: crateAoTex, transparent: true, depthWrite: false })
    );
    bottomAo.rotation.x = -Math.PI * 0.5;
    bottomAo.position.y = wt + 0.002;
    cg.add(bottomAo);

    const wFront = new THREE.Mesh(new THREE.BoxGeometry(hxC * 2, hC, wt), crateMat);
    wFront.position.set(0, hC * 0.5, hzC - wt * 0.5);
    wFront.castShadow = true;
    wFront.receiveShadow = true;
    cg.add(wFront);

    const wBack = new THREE.Mesh(new THREE.BoxGeometry(hxC * 2, hC, wt), crateMat);
    wBack.position.set(0, hC * 0.5, -hzC + wt * 0.5);
    wBack.castShadow = true;
    wBack.receiveShadow = true;
    cg.add(wBack);

    const wLeft = new THREE.Mesh(new THREE.BoxGeometry(wt, hC, hzC * 2), crateMat);
    wLeft.position.set(-hxC + wt * 0.5, hC * 0.5, 0);
    wLeft.castShadow = true;
    wLeft.receiveShadow = true;
    cg.add(wLeft);

    const wRight = new THREE.Mesh(new THREE.BoxGeometry(wt, hC, hzC * 2), crateMat);
    wRight.position.set(hxC - wt * 0.5, hC * 0.5, 0);
    wRight.castShadow = true;
    wRight.receiveShadow = true;
    cg.add(wRight);

    // Molded rounded top rim + side grip handles
    const rimFront = new THREE.Mesh(new THREE.BoxGeometry(hxC * 2 + 0.024, 0.028, 0.034), creamTrimMat);
    rimFront.position.set(0, hC, hzC);
    cg.add(rimFront);
    const rimBack = rimFront.clone();
    rimBack.position.z = -hzC;
    cg.add(rimBack);

    const rimL = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.028, hzC * 2 + 0.024), creamTrimMat);
    rimL.position.set(-hxC, hC, 0);
    cg.add(rimL);
    const rimRMesh = rimL.clone();
    rimRMesh.position.x = hxC;
    cg.add(rimRMesh);

    // Glossy matching plastic ball badge centered on inside bottom & front rim
    const emblem = new THREE.Mesh(
      new THREE.SphereGeometry(0.044, 12, 8),
      new THREE.MeshPhysicalMaterial({
        color: BALL_COLORS[cp.colorId],
        roughness: 0.10,
        clearcoat: 1.0
      })
    );
    emblem.scale.set(1, 0.35, 1);
    emblem.position.set(0, wt + 0.008, 0);
    cg.add(emblem);

    return {
      colorId: cp.colorId,
      group: cg,
      homeX: cp.x,
      homeZ: cp.z,
      bounce: 0
    };
  });

  return {
    root,
    poolGroup,
    slideGroup,
    signGroup,
    boardPivot,
    redrawSignboard: signData.redraw,
    bags,
    crateMeshes
  };
}
