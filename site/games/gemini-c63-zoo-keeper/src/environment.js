import * as THREE from 'three';

export function createSanctuaryEnvironment(scene, textures, skyTexture) {
  const envRoot = new THREE.Group();
  scene.add(envRoot);

  // Soft overcast atmospheric mist
  scene.fog = new THREE.FogExp2(0xd3dce2, 0.016);

  // Sky Dome (soft overcast clouds)
  const skyGeo = new THREE.SphereGeometry(48, 32, 20);
  const skyMat = new THREE.MeshBasicMaterial({
    map: skyTexture,
    side: THREE.BackSide,
    fog: false
  });
  const skyDome = new THREE.Mesh(skyGeo, skyMat);
  envRoot.add(skyDome);

  // Overcast Diffuse Lighting Rig ("曇天のやわらかい拡散光")
  const hemiLight = new THREE.HemisphereLight(0xe6eef6, 0x6c6355, 1.35);
  hemiLight.position.set(0, 18, 0);
  envRoot.add(hemiLight);

  const keyLight = new THREE.DirectionalLight(0xfbf6ed, 1.48);
  keyLight.position.set(4.5, 11.5, 6.5);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.near = 1.0;
  keyLight.shadow.camera.far = 28.0;
  keyLight.shadow.camera.left = -7.5;
  keyLight.shadow.camera.right = 7.5;
  keyLight.shadow.camera.top = 7.5;
  keyLight.shadow.camera.bottom = -5.5;
  keyLight.shadow.bias = -0.0006;
  keyLight.shadow.radius = 4.5; // Wide soft overcast penumbra!
  envRoot.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xcfe0f0, 0.52);
  fillLight.position.set(-6.0, 6.5, 4.0);
  envRoot.add(fillLight);

  // Sanctuary Paddock Ground (wet earth, pebbles & mossy grass)
  const groundGeo = new THREE.CircleGeometry(28, 48);
  groundGeo.rotateX(-Math.PI / 2);
  const groundMat = new THREE.MeshStandardMaterial({
    map: textures.groundMap,
    roughness: 0.86,
    metalness: 0.02
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.receiveShadow = true;
  ground.userData.isGround = true;
  envRoot.add(ground);

  // Natural Weathered Sanctuary Boulders
  const rockGeo = new THREE.DodecahedronGeometry(1, 2);
  const rPos = rockGeo.attributes.position;
  for (let i = 0; i < rPos.count; i++) {
    const x = rPos.getX(i), y = rPos.getY(i), z = rPos.getZ(i);
    const n = 1 + 0.18 * Math.sin(x * 3.1 + z * 2.4) + 0.12 * Math.cos(y * 4.2);
    rPos.setXYZ(i, x * n, (y < 0 ? y * 0.55 : y * 0.85) * n, z * n);
  }
  rockGeo.computeVertexNormals();
  const rockMat = new THREE.MeshStandardMaterial({
    color: 0x7d776c,
    roughness: 0.88
  });

  const boulderSpecs = [
    [-4.2, 0.35, -3.8, 1.4, 0.9, 1.1, 0.4],
    [4.6, 0.42, -4.2, 1.7, 1.1, 1.3, 1.2],
    [-2.8, 0.25, -5.6, 1.9, 1.0, 1.4, 2.1],
    [1.8, 0.28, -6.2, 2.2, 1.2, 1.5, 0.8]
  ];
  boulderSpecs.forEach(([bx, by, bz, sx, sy, sz, ry]) => {
    const b = new THREE.Mesh(rockGeo, rockMat);
    b.position.set(bx, by, bz);
    b.scale.set(sx, sy, sz);
    b.rotation.y = ry;
    b.castShadow = true;
    b.receiveShadow = true;
    envRoot.add(b);
  });

  // 700 Instanced Swaying Sanctuary Grass Blades around perimeter & rocks
  const bladeGeo = new THREE.ConeGeometry(0.032, 0.34, 4);
  bladeGeo.translate(0, 0.17, 0);
  const bladeMat = new THREE.MeshStandardMaterial({
    color: 0x567741,
    roughness: 0.78
  });
  const grassCount = 700;
  const grassMesh = new THREE.InstancedMesh(bladeGeo, bladeMat, grassCount);
  const dummy = new THREE.Object3D();
  let gi = 0;
  for (let i = 0; i < grassCount * 2 && gi < grassCount; i++) {
    const ang = Math.random() * Math.PI * 2;
    const dist = 2.6 + Math.random() * 9.5;
    const gx = Math.cos(ang) * dist;
    const gz = Math.sin(ang) * dist - 1.5;
    // Keep foreground stone work area clear
    if (gz > 0.8 && Math.abs(gx) < 3.4) continue;
    dummy.position.set(gx, 0, gz);
    dummy.rotation.set((Math.random() - 0.5) * 0.3, Math.random() * Math.PI, (Math.random() - 0.5) * 0.3);
    const sc = 0.65 + Math.random() * 0.95;
    dummy.scale.set(sc, sc * (0.8 + Math.random() * 0.6), sc);
    dummy.updateMatrix();
    grassMesh.setMatrixAt(gi++, dummy.matrix);
  }
  grassMesh.count = gi;
  grassMesh.receiveShadow = true;
  envRoot.add(grassMesh);

  // Background Sanctuary Acacia & Eucalyptus Trees (Dappled textured botanical foliage, never plastic spheres!)
  const trunkMat = new THREE.MeshStandardMaterial({ map: textures.woodMap, color: 0x5c4734, roughness: 0.92 });
  const leafCanv = document.createElement('canvas');
  leafCanv.width = 256; leafCanv.height = 256;
  const lctx = leafCanv.getContext('2d');
  lctx.fillStyle = '#3d5733';
  lctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) {
    const lx = (i * 73) % 256;
    const ly = (i * 137) % 256;
    const shade = (i % 5) * 9;
    lctx.fillStyle = `rgb(${62 + shade}, ${88 + shade}, ${50 + Math.floor(shade * 0.6)})`;
    lctx.beginPath();
    lctx.ellipse(lx, ly, 9, 4.5, (i % 7) * 0.45, 0, Math.PI * 2);
    lctx.fill();
  }
  const leafTex = new THREE.CanvasTexture(leafCanv);
  leafTex.colorSpace = THREE.SRGBColorSpace;
  leafTex.wrapS = leafTex.wrapT = THREE.RepeatWrapping;
  leafTex.repeat.set(3, 2);

  const canopyGeo = new THREE.SphereGeometry(1, 22, 16);
  const cPos = canopyGeo.attributes.position;
  for (let i = 0; i < cPos.count; i++) {
    const x = cPos.getX(i), y = cPos.getY(i), z = cPos.getZ(i);
    const cl = 1 + 0.16 * Math.sin(x * 3.8 + z * 3.1) * Math.cos(y * 3.9) + 0.08 * Math.sin(y * 6.5 + x * 5.2);
    cPos.setXYZ(i, x * cl, (y < 0 ? y * 0.62 : y * 0.92) * cl, z * cl);
  }
  canopyGeo.computeVertexNormals();
  const canopyMat = new THREE.MeshStandardMaterial({
    map: leafTex,
    bumpMap: leafTex,
    bumpScale: 0.04,
    roughness: 0.88
  });

  const treeCoords = [
    [-5.8, -5.8, 1.15],
    [-2.4, -7.8, 1.35],
    [2.8, -7.5, 1.25],
    [6.2, -5.2, 1.1]
  ];
  treeCoords.forEach(([tx, tz, ts]) => {
    const tg = new THREE.Group();
    tg.position.set(tx, 0, tz);
    tg.scale.setScalar(ts);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.26, 2.7, 10), trunkMat);
    trunk.position.y = 1.35;
    trunk.castShadow = true;
    tg.add(trunk);

    // Forking wooden limbs reaching into leaf boughs
    [-0.55, 0.58].forEach((bx) => {
      const limb = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.11, 1.2, 8), trunkMat);
      limb.position.set(bx * 0.6, 2.35, 0);
      limb.rotation.z = -bx * 0.85;
      tg.add(limb);
    });

    [
      [0, 3.05, 0, 1.65, 0.54, 1.45],
      [-1.05, 2.68, 0.3, 1.18, 0.44, 1.05],
      [1.08, 2.76, -0.2, 1.22, 0.46, 1.08]
    ].forEach(([cx, cy, cz, sx, sy, sz]) => {
      const puff = new THREE.Mesh(canopyGeo, canopyMat);
      puff.position.set(cx, cy, cz);
      puff.scale.set(sx, sy, sz);
      puff.castShadow = true;
      tg.add(puff);
    });
    envRoot.add(tg);
  });

  // Timber Zoo Paddock Fence in Mid/Background + Swinging Right Gate to Next Paddock!
  const woodMat = new THREE.MeshStandardMaterial({ map: textures.woodMap, roughness: 0.82 });
  const fenceGroup = new THREE.Group();
  envRoot.add(fenceGroup);
  for (let x = -5.4; x <= 2.4; x += 1.56) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.095, 1.25, 10), woodMat);
    post.position.set(x, 0.62, -3.45);
    post.castShadow = true;
    fenceGroup.add(post);
  }
  [0.42, 0.88].forEach((ry) => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(8.0, 0.09, 0.06), woodMat);
    rail.position.set(-1.5, ry, -3.45);
    rail.castShadow = true;
    fenceGroup.add(rail);
  });

  // Interactive Wooden Next-Scene Gate on the right side!
  const gatePost = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.11, 1.45, 12), woodMat);
  gatePost.position.set(2.55, 0.72, -2.25);
  gatePost.castShadow = true;
  envRoot.add(gatePost);

  const gatePivot = new THREE.Group();
  gatePivot.position.set(2.55, 0, -2.25);
  envRoot.add(gatePivot);

  const gateFrame = new THREE.Group();
  const gRailTop = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.10, 0.07), woodMat);
  gRailTop.position.set(0.72, 1.02, 0);
  gateFrame.add(gRailTop);
  const gRailBot = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.10, 0.07), woodMat);
  gRailBot.position.set(0.72, 0.45, 0);
  gateFrame.add(gRailBot);
  for (let gx = 0.2; gx <= 1.3; gx += 0.27) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.85, 0.05), woodMat);
    slat.position.set(gx, 0.74, 0);
    gateFrame.add(slat);
  }
  // Invisible generous hit box so 5-year-old finger taps open gate effortlessly!
  const gateHit = new THREE.Mesh(
    new THREE.BoxGeometry(1.65, 1.65, 0.65),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  gateHit.position.set(0.75, 0.82, 0);
  gateHit.userData.isNextGate = true;
  gateFrame.add(gateHit);
  gatePivot.add(gateFrame);

  // Zero-Text Hand-Painted Wooden Picture Signboard ("ルールは絵の看板1枚で見せる")
  const signGroup = new THREE.Group();
  signGroup.position.set(-2.35, 0, -1.65);
  signGroup.rotation.y = 0.38;
  envRoot.add(signGroup);

  const signPost = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, 1.85, 10), woodMat);
  signPost.position.y = 0.92;
  signPost.castShadow = true;
  signGroup.add(signPost);

  const signBoardPivot = new THREE.Group();
  signBoardPivot.position.set(0, 1.56, 0.06);
  signGroup.add(signBoardPivot);

  const boardBack = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.72, 0.055), woodMat);
  boardBack.castShadow = true;
  boardBack.userData.isSignboard = true;
  signBoardPivot.add(boardBack);

  const signFaceMat = new THREE.MeshStandardMaterial({
    map: textures.signMaps[0],
    roughness: 0.68
  });
  const signFace = new THREE.Mesh(new THREE.PlaneGeometry(0.90, 0.67), signFaceMat);
  signFace.position.z = 0.03;
  signFace.userData.isSignboard = true;
  signBoardPivot.add(signFace);

  // Overflowing Wooden & Steel Water Tub ("水を満杯に貯める・溢れさせる・ちょっかいで更に溢れる")
  const tubGroup = new THREE.Group();
  tubGroup.position.set(0.15, 0, 1.15);
  envRoot.add(tubGroup);

  const tubWallGeo = new THREE.CylinderGeometry(0.46, 0.39, 0.38, 22, 1, true);
  const tubWoodMat = new THREE.MeshStandardMaterial({
    map: textures.woodMap,
    roughness: 0.72,
    side: THREE.DoubleSide
  });
  const tubWall = new THREE.Mesh(tubWallGeo, tubWoodMat);
  tubWall.position.y = 0.19;
  tubWall.castShadow = true;
  tubWall.receiveShadow = true;
  tubWall.userData.isWaterTub = true;
  tubGroup.add(tubWall);

  const tubBottom = new THREE.Mesh(new THREE.CircleGeometry(0.39, 20), tubWoodMat);
  tubBottom.rotation.x = -Math.PI / 2;
  tubBottom.position.y = 0.02;
  tubGroup.add(tubBottom);

  // Galvanized metal hoops around wooden tub
  const hoopMat = new THREE.MeshStandardMaterial({ color: 0x767c80, roughness: 0.38, metalness: 0.75 });
  [0.10, 0.30].forEach((hy) => {
    const r = hy > 0.2 ? 0.445 : 0.41;
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(r, 0.014, 8, 24), hoopMat);
    hoop.rotation.x = Math.PI / 2;
    hoop.position.y = hy;
    tubGroup.add(hoop);
  });

  // Rising 3D Water Surface inside the Tub!
  const waterDiscMat = new THREE.MeshPhysicalMaterial({
    color: 0x5fa6c9,
    roughness: 0.06,
    transmission: 0.58,
    transparent: true,
    opacity: 0.84,
    clearcoat: 1.0
  });
  const waterDisc = new THREE.Mesh(new THREE.CircleGeometry(0.43, 22), waterDiscMat);
  waterDisc.rotation.x = -Math.PI / 2;
  waterDisc.position.y = 0.22;
  waterDisc.userData.isWaterTub = true;
  tubGroup.add(waterDisc);

  return {
    envRoot,
    ground,
    keyLight,
    signGroup,
    signBoardPivot,
    signFaceMat,
    gatePivot,
    gatePost,
    tubGroup,
    waterDisc,
    waterLevel: 0.52, // 0..1.05 (>0.98 overflows!)
    signSwing: 0,
    gateOpenTarget: 0,

    setSignScene(idx) {
      signFaceMat.map = textures.signMaps[idx];
      signFaceMat.needsUpdate = true;
      this.signSwing = 0.45;
    },

    update(dt, elapsed) {
      // Signboard gentle swing
      this.signSwing = Math.max(0, this.signSwing - dt * 0.8);
      signBoardPivot.rotation.z = Math.sin(elapsed * 5.5) * this.signSwing * 0.25;

      // Smooth wooden gate opening
      gatePivot.rotation.y += (this.gateOpenTarget - gatePivot.rotation.y) * Math.min(1, dt * 3.8);

      // Tub water level ripple
      const yLvl = 0.06 + Math.min(1.04, this.waterLevel) * 0.31;
      const rScale = 0.88 + Math.min(1.04, this.waterLevel) * 0.14;
      waterDisc.position.y = yLvl + Math.sin(elapsed * 4.2) * 0.006;
      waterDisc.scale.setScalar(rScale);
    }
  };
}
