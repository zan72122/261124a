import * as THREE from 'three';

// ============================================================================
// 1. REAL-TIME HOTEL DUVET / LINEN CLOTH SIMULATION
// Plush rounded corner drape (zero sharp icicle corners!) + grazing sculptural folds
// ============================================================================
export class BedClothSimulation {
  constructor(linenMaterial) {
    this.segsX = 58;
    this.segsZ = 58;
    this.cols = this.segsX + 1;
    this.rows = this.segsZ + 1;
    this.count = this.cols * this.rows;

    this.mattressHalfW = 1.08;
    this.mattressHalfL = 1.05;
    this.mattressTopY = 0.74;
    this.overhangDrop = 0.30;

    this.geo = new THREE.BufferGeometry();
    const positions = new Float32Array(this.count * 3);
    const uvs = new Float32Array(this.count * 2);
    const colors = new Float32Array(this.count * 3);
    const indices = [];

    this.restX = new Float32Array(this.count);
    this.restY = new Float32Array(this.count);
    this.restZ = new Float32Array(this.count);

    this.wrinkle = new Float32Array(this.count);
    this.seedH = new Float32Array(this.count);
    this.seedBX = new Float32Array(this.count);
    this.seedBZ = new Float32Array(this.count);
    this.offX = new Float32Array(this.count);
    this.offY = new Float32Array(this.count);
    this.offZ = new Float32Array(this.count);
    this.velX = new Float32Array(this.count);
    this.velY = new Float32Array(this.count);
    this.velZ = new Float32Array(this.count);
    this.indent = new Float32Array(this.count);

    this.tuckLeft = 0.0;
    this.tuckRight = 0.0;
    this.tuckFoot = 0.0;
    this.tuckHead = 0.25;

    // Smooth radial superellipse drape over rounded hotel mattress (eliminates spiky corner overhangs!)
    for (let iz = 0; iz < this.rows; iz++) {
      const v = iz / this.segsZ; // 0 = near pillows (-Z), 1 = foot (+Z)
      for (let ix = 0; ix < this.cols; ix++) {
        const u = ix / this.segsX; // 0 = left (-X), 1 = right (+X)
        const idx = iz * this.cols + ix;

        const su = (u - 0.5) * 2.0; // -1..+1
        const sv = v * 1.18 - 0.18; // -0.18..+1.0 (only hangs down on left, right, and foot—not head!)

        // Superellipse normalized distance from mattress top center
        const nx = su / 0.80;
        const nz = Math.max(0, (v - 0.82) / 0.18);
        const overAmt = Math.hypot(Math.max(0, Math.abs(nx) - 1.0), nz);

        let rx = Math.sign(su) * Math.min(Math.abs(nx), 1.0) * this.mattressHalfW;
        let rz = -0.66 + Math.min(v / 0.82, 1.0) * (this.mattressHalfL + 0.66);
        let ry = this.mattressTopY + (1 - Math.min(1, nx * nx) * 0.75) * 0.048;

        // Plush hotel duvet folded collar ridge near pillows (v ~ 0.06) + subtle channel quilting loft
        const collar = Math.exp(-((v - 0.055) ** 2) / 0.0016) * 0.032;
        const loftPiping = Math.exp(-((Math.abs(nx) - 0.96) ** 2) / 0.004) * 0.012;
        ry += (collar + loftPiping) * (overAmt < 0.05 ? 1 : 0.2);

        if (overAmt > 0) {
          const tDrop = Math.min(1.15, overAmt);
          const outward = Math.sin(Math.min(1, tDrop) * Math.PI * 0.5) * 0.062;
          if (Math.abs(nx) > 1.0) rx += Math.sign(su) * outward;
          if (nz > 0) rz += outward;
          // Rounded hem curl inward at the very bottom edge so duvet looks thick & tailored, never paper-thin!
          const hemTuck = tDrop > 0.88 ? (tDrop - 0.88) * 0.08 : 0;
          if (Math.abs(nx) > 1.0) rx -= Math.sign(su) * hemTuck;
          if (nz > 0) rz -= hemTuck;
          ry = this.mattressTopY - Math.pow(tDrop, 1.25) * this.overhangDrop;
        }

        this.restX[idx] = rx;
        this.restY[idx] = ry;
        this.restZ[idx] = rz;

        uvs[idx * 2] = u;
        uvs[idx * 2 + 1] = v;
        colors[idx * 3] = 1;
        colors[idx * 3 + 1] = 1;
        colors[idx * 3 + 2] = 1;
      }
    }

    for (let iz = 0; iz < this.segsZ; iz++) {
      for (let ix = 0; ix < this.segsX; ix++) {
        const a = iz * this.cols + ix;
        const b = a + 1;
        const c = a + this.cols;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }

    this.geo.setIndex(indices);
    this.geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    this.geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = linenMaterial.clone();
    mat.vertexColors = true;
    mat.side = THREE.DoubleSide;

    this.mesh = new THREE.Mesh(this.geo, mat);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.name = 'bedSheetCloth';

    this.scrambleMessy(1);
    this.updateGeometry(0.016);
  }

  scrambleMessy(roomSeed = 1) {
    this.tuckLeft = 0.04;
    this.tuckRight = 0.04;
    this.tuckFoot = 0.04;
    this.tuckHead = 0.15;

    const p1 = roomSeed * 1.63;
    const p2 = roomSeed * 2.77;

    for (let iz = 0; iz < this.rows; iz++) {
      const v = iz / this.segsZ;
      for (let ix = 0; ix < this.cols; ix++) {
        const u = ix / this.segsX;
        const idx = iz * this.cols + ix;

        // Bold sculptural linen folds sweeping diagonally across the ENTIRE bed so grazing morning sun casts dramatic crease shadows!
        const fold1 = 1.0 - Math.pow(Math.abs(Math.sin((u * 3.4 + v * 2.6 + p1) * Math.PI)), 0.58);
        const fold2 = 1.0 - Math.pow(Math.abs(Math.sin((u * 2.2 - v * 3.7 + p2) * Math.PI)), 0.62);
        const fold3 = 1.0 - Math.pow(Math.abs(Math.cos((u * 5.6 + v * 4.2 - p1) * Math.PI)), 0.72);
        const centerRumple = 0.75 + 0.55 * Math.exp(-(((u - 0.44) ** 2 + (v - 0.48) ** 2) / 0.14));

        const h = (fold1 * 0.54 + fold2 * 0.46 + fold3 * 0.24 - 0.34) * centerRumple;
        this.seedH[idx] = h;

        this.seedBX[idx] = (0.44 - u) * 0.14 * centerRumple + Math.cos((u * 4.5 + v * 3 + p1) * Math.PI) * 0.032;
        this.seedBZ[idx] = (0.48 - v) * 0.15 * centerRumple + Math.sin((u * 3 - v * 4.5 + p2) * Math.PI) * 0.032;

        this.wrinkle[idx] = 0.96 + Math.sin(u * 5 + v * 4 + roomSeed) * 0.14;
        this.offX[idx] = 0;
        this.offY[idx] = 0;
        this.offZ[idx] = 0;
        this.velX[idx] = 0;
        this.velY[idx] = 0;
        this.velZ[idx] = 0;
        this.indent[idx] = 0;
      }
    }
    this.updateGeometry(0.016);
  }

  sampleHeightAt(worldX, worldZ) {
    const u = Math.max(0, Math.min(1, (worldX / this.mattressHalfW) * 0.40 + 0.5));
    const v = Math.max(0, Math.min(1, ((worldZ + 0.66) / (this.mattressHalfL + 0.66)) * 0.82));
    const ix = Math.round(u * this.segsX);
    const iz = Math.round(v * this.segsZ);
    const idx = (iz * this.cols + ix) * 3;
    return this.geo.attributes.position.array[idx + 1] || (this.mattressTopY + 0.06);
  }

  applyHandStroke(worldPoint, dragDeltaX, dragDeltaZ, allowSmoothing = true) {
    const dragDist = Math.hypot(dragDeltaX, dragDeltaZ);
    const radius = 0.56;
    const r2 = radius * radius;

    let smoothedAmount = 0;
    let snappedTaut = false;

    for (let iz = 0; iz < this.rows; iz++) {
      for (let ix = 0; ix < this.cols; ix++) {
        const idx = iz * this.cols + ix;
        const vx = this.restX[idx] + this.offX[idx];
        const vz = this.restZ[idx] + this.offZ[idx];
        const dx = vx - worldPoint.x;
        const dz = vz - worldPoint.z;
        const d2 = dx * dx + dz * dz;

        if (d2 < r2) {
          const weight = Math.pow(1 - d2 / r2, 1.5);
          this.velX[idx] += dragDeltaX * weight * 11.5;
          this.velZ[idx] += dragDeltaZ * weight * 11.5;
          this.velY[idx] += Math.min(0.055, dragDist * 0.42) * weight * 3.2;

          if (allowSmoothing && dragDist > 0.0012) {
            const outwardDot =
              (vx * dragDeltaX + (vz - 0.15) * dragDeltaZ) /
              (Math.hypot(vx, vz - 0.15) * (dragDist + 1e-5) + 0.25);
            const stretchBonus = Math.max(0.42, 0.82 + outwardDot * 0.95);
            const deltaW = Math.min(this.wrinkle[idx], dragDist * 2.35 * weight * stretchBonus);
            this.wrinkle[idx] = Math.max(0, this.wrinkle[idx] - deltaW);
            smoothedAmount += deltaW;
          }
        }
      }
    }

    if (allowSmoothing && dragDist > 0.002) {
      const prevSum = this.tuckLeft + this.tuckRight + this.tuckFoot + this.tuckHead;
      if (worldPoint.x < -0.40 && dragDeltaX < 0) {
        this.tuckLeft = Math.min(1, this.tuckLeft + Math.abs(dragDeltaX) * 1.55);
      }
      if (worldPoint.x > 0.40 && dragDeltaX > 0) {
        this.tuckRight = Math.min(1, this.tuckRight + Math.abs(dragDeltaX) * 1.55);
      }
      if (worldPoint.z > 0.30 && dragDeltaZ > 0) {
        this.tuckFoot = Math.min(1, this.tuckFoot + Math.abs(dragDeltaZ) * 1.65);
      }
      if (worldPoint.z < -0.15 && dragDeltaZ < 0) {
        this.tuckHead = Math.min(1, this.tuckHead + Math.abs(dragDeltaZ) * 1.45);
      }

      const edgePull = (this.tuckLeft + this.tuckRight + this.tuckFoot + this.tuckHead) - prevSum;
      if (edgePull > 0.001) {
        for (let i = 0; i < this.count; i++) {
          this.wrinkle[i] = Math.max(0, this.wrinkle[i] - edgePull * 0.32);
        }
        if (edgePull > 0.04) snappedTaut = true;
      }
    }

    return { smoothedAmount, snappedTaut };
  }

  applyIndent(worldX, worldZ, radius = 0.42, depth = 0.085) {
    const r2 = radius * radius;
    for (let i = 0; i < this.count; i++) {
      const dx = this.restX[i] - worldX;
      const dz = this.restZ[i] - worldZ;
      const d2 = dx * dx + dz * dz;
      if (d2 < r2) {
        const w = Math.pow(1 - d2 / r2, 1.5);
        this.indent[i] = Math.max(this.indent[i], depth * w);
      }
    }
  }

  getSmoothness() {
    let sum = 0;
    for (let i = 0; i < this.count; i++) sum += this.wrinkle[i];
    const avgW = sum / this.count;
    return Math.max(0, Math.min(1, 1 - avgW / 0.94));
  }

  updateGeometry(dt) {
    const clampedDt = Math.min(0.033, Math.max(0.004, dt));
    const posAttr = this.geo.attributes.position;
    const colAttr = this.geo.attributes.color;
    const pos = posAttr.array;
    const col = colAttr.array;

    const springK = 28.0;
    const damp = Math.exp(-9.5 * clampedDt);

    for (let iz = 0; iz < this.rows; iz++) {
      const v = iz / this.segsZ;
      for (let ix = 0; ix < this.cols; ix++) {
        const u = ix / this.segsX;
        const idx = iz * this.cols + ix;

        let nx = 0, ny = 0, nz = 0, nw = 0, nCount = 0;
        if (ix > 0) { nx += this.offX[idx - 1]; ny += this.offY[idx - 1]; nz += this.offZ[idx - 1]; nw += this.wrinkle[idx - 1]; nCount++; }
        if (ix < this.segsX) { nx += this.offX[idx + 1]; ny += this.offY[idx + 1]; nz += this.offZ[idx + 1]; nw += this.wrinkle[idx + 1]; nCount++; }
        if (iz > 0) { nx += this.offX[idx - this.cols]; ny += this.offY[idx - this.cols]; nz += this.offZ[idx - this.cols]; nw += this.wrinkle[idx - this.cols]; nCount++; }
        if (iz < this.segsZ) { nx += this.offX[idx + this.cols]; ny += this.offY[idx + this.cols]; nz += this.offZ[idx + this.cols]; nw += this.wrinkle[idx + this.cols]; nCount++; }
        nx /= nCount; ny /= nCount; nz /= nCount; nw /= nCount;

        this.wrinkle[idx] += (nw - this.wrinkle[idx]) * 0.032;

        this.velX[idx] = (this.velX[idx] + ((nx - this.offX[idx]) * 18.0 - this.offX[idx] * springK) * clampedDt) * damp;
        this.velY[idx] = (this.velY[idx] + ((ny - this.offY[idx]) * 18.0 - this.offY[idx] * springK) * clampedDt) * damp;
        this.velZ[idx] = (this.velZ[idx] + ((nz - this.offZ[idx]) * 18.0 - this.offZ[idx] * springK) * clampedDt) * damp;

        this.offX[idx] += this.velX[idx] * clampedDt;
        this.offY[idx] += this.velY[idx] * clampedDt;
        this.offZ[idx] += this.velZ[idx] * clampedDt;
        this.indent[idx] *= Math.exp(-1.8 * clampedDt);

        const w = this.wrinkle[idx];
        const leftEdge = Math.max(0, (0.18 - u) / 0.18);
        const rightEdge = Math.max(0, (u - 0.82) / 0.18);
        const footEdge = Math.max(0, (v - 0.82) / 0.18);
        const headSkew = Math.max(0, (0.18 - v) / 0.18);

        const waveL = leftEdge * (1 - this.tuckLeft) * 0.055 * Math.sin(v * Math.PI * 3.0);
        const waveR = rightEdge * (1 - this.tuckRight) * 0.055 * Math.cos(v * Math.PI * 2.8);
        const waveF = footEdge * (1 - this.tuckFoot) * 0.065 * Math.sin(u * Math.PI * 3.0);
        const skewH = headSkew * (1 - this.tuckHead) * 0.12 * Math.sin(u * Math.PI * 2.0);

        // Damp wrinkle amplitude cleanly along outer hem so hem stays plush & tailored
        const onTopMask = (1 - leftEdge * 0.65) * (1 - rightEdge * 0.65) * (1 - footEdge * 0.65);
        const creaseH = this.seedH[idx] * w * 0.135 * onTopMask;

        let px = this.restX[idx] + this.seedBX[idx] * w * onTopMask + waveL * -0.5 + waveR * 0.5 + this.offX[idx];
        let py = this.restY[idx] + creaseH - Math.abs(waveL + waveR + waveF) * 0.4 - this.indent[idx] + this.offY[idx];
        let pz = this.restZ[idx] + this.seedBZ[idx] * w * onTopMask + skewH + waveF * 0.5 + this.offZ[idx];

        const inTop = Math.abs(px) < this.mattressHalfW - 0.03 && pz > -0.68 && pz < this.mattressHalfL - 0.03;
        if (inTop) {
          const minMattressY = this.mattressTopY - 0.012 - this.indent[idx];
          if (py < minMattressY) py = minMattressY;
        }

        const p3 = idx * 3;
        pos[p3] = px;
        pos[p3 + 1] = py;
        pos[p3 + 2] = pz;

        // Rich linen fold self-AO (cool sky-tinted shadow in valleys, warm bright ivory on crests!)
        const valleyAO = Math.max(0.71, Math.min(1.0, 0.98 + creaseH * 1.85 - w * 0.055 - this.indent[idx] * 0.95));
        col[p3] = valleyAO * 0.992;
        col[p3 + 1] = valleyAO * 0.995;
        col[p3 + 2] = Math.min(1.0, valleyAO * 1.012);
      }
    }

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    this.geo.computeVertexNormals();
  }
}

// ============================================================================
// 2. INTERACTIVE TOWEL FOLDING -> CONTINUOUS 3D SWAN SCULPTURE
// ============================================================================
export class TowelSwanSimulation {
  constructor(terryMaterial, shadowTexture, isSecondary = false) {
    this.group = new THREE.Group();
    this.isSecondary = isSecondary;
    this.mat = terryMaterial;

    this.leftRoll = 0.0;
    this.rightRoll = 0.0;
    this.neckPull = 0.0;
    this.neckCurve = 0.35;
    this.wingSpread = 0.0;

    const shMat = new THREE.MeshBasicMaterial({
      map: shadowTexture,
      transparent: true,
      depthWrite: false,
      opacity: 0.72
    });
    this.shadowMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.68, 0.68), shMat);
    this.shadowMesh.rotation.x = -Math.PI / 2;
    this.shadowMesh.position.y = 0.004;
    this.group.add(this.shadowMesh);

    this.gridSegs = 32;
    this.gridCols = this.gridSegs + 1;
    this.baseGeo = new THREE.BufferGeometry();
    const bCount = this.gridCols * this.gridCols;
    const bPos = new Float32Array(bCount * 3);
    const bUv = new Float32Array(bCount * 2);
    const bIdx = [];

    for (let iz = 0; iz < this.gridCols; iz++) {
      for (let ix = 0; ix < this.gridCols; ix++) {
        const i = iz * this.gridCols + ix;
        bUv[i * 2] = ix / this.gridSegs;
        bUv[i * 2 + 1] = iz / this.gridSegs;
      }
    }
    for (let iz = 0; iz < this.gridSegs; iz++) {
      for (let ix = 0; ix < this.gridSegs; ix++) {
        const a = iz * this.gridCols + ix;
        const b = a + 1;
        const c = a + this.gridCols;
        const d = c + 1;
        bIdx.push(a, c, b, b, c, d);
      }
    }
    this.baseGeo.setIndex(bIdx);
    this.baseGeo.setAttribute('position', new THREE.BufferAttribute(bPos, 3));
    this.baseGeo.setAttribute('uv', new THREE.BufferAttribute(bUv, 2));

    const doubleTerry = terryMaterial.clone();
    doubleTerry.side = THREE.DoubleSide;
    this.baseMesh = new THREE.Mesh(this.baseGeo, doubleTerry);
    this.baseMesh.castShadow = true;
    this.baseMesh.receiveShadow = true;
    this.group.add(this.baseMesh);

    this.neckSegs = 28;
    this.radialSegs = 14;
    const nVerts = (this.neckSegs + 1) * (this.radialSegs + 1);
    this.neckGeo = new THREE.BufferGeometry();
    const nPos = new Float32Array(nVerts * 3);
    const nUv = new Float32Array(nVerts * 2);
    const nIdx = [];
    for (let s = 0; s <= this.neckSegs; s++) {
      for (let r = 0; r <= this.radialSegs; r++) {
        const k = s * (this.radialSegs + 1) + r;
        nUv[k * 2] = r / this.radialSegs;
        nUv[k * 2 + 1] = (s / this.neckSegs) * 2.5;
      }
    }
    for (let s = 0; s < this.neckSegs; s++) {
      for (let r = 0; r < this.radialSegs; r++) {
        const a = s * (this.radialSegs + 1) + r;
        const b = a + 1;
        const c = a + (this.radialSegs + 1);
        const d = c + 1;
        nIdx.push(a, b, c, b, d, c);
      }
    }
    this.neckGeo.setIndex(nIdx);
    this.neckGeo.setAttribute('position', new THREE.BufferAttribute(nPos, 3));
    this.neckGeo.setAttribute('uv', new THREE.BufferAttribute(nUv, 2));
    this.neckMesh = new THREE.Mesh(this.neckGeo, terryMaterial);
    this.neckMesh.castShadow = true;
    this.neckMesh.receiveShadow = true;
    this.group.add(this.neckMesh);

    // Multi-layered pleated hotel towel wings (2 arched folds per side!)
    this.wingMeshes = [];
    for (const side of [-1, 1]) {
      for (let layer = 0; layer < 2; layer++) {
        const wMesh = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), terryMaterial);
        wMesh.castShadow = true;
        wMesh.receiveShadow = true;
        this.group.add(wMesh);
        this.wingMeshes.push({ mesh: wMesh, side, layer });
      }
    }

    this.scaleFactor = isSecondary ? 0.82 : 1.0;
    this.group.scale.setScalar(this.scaleFactor);
    this.rebuildMesh();
  }

  resetFlat() {
    this.leftRoll = 0.0;
    this.rightRoll = 0.0;
    this.neckPull = 0.0;
    this.neckCurve = 0.35;
    this.wingSpread = 0.0;
    this.rebuildMesh();
  }

  getFoldProgress() {
    const rollScore = Math.min(1, (Math.min(1, this.leftRoll) + Math.min(1, this.rightRoll)) * 0.5);
    const neckScore = Math.min(1, this.neckPull / 0.65);
    return rollScore * 0.55 + neckScore * 0.45;
  }

  getSwanStyle() {
    if (this.leftRoll < 0.25 && this.rightRoll < 0.25) return 'flatTowel';
    if (this.neckPull < 0.25) return 'rolledBoat';
    if (this.neckPull > 0.95 && this.neckCurve < 0.25) return 'royalTallSwan';
    if (this.neckCurve > 0.55) return 'heartSwan';
    if (Math.abs(this.leftRoll - this.rightRoll) > 0.32) return 'quirkyAsymmetricSwan';
    return 'classicGracefulSwan';
  }

  applySculptDrag(localX, localZ, dx, dyScreen, dz) {
    const bothRolled = this.leftRoll > 0.38 && this.rightRoll > 0.38;

    if ((bothRolled && dyScreen > 0.002) || (this.neckPull > 0.12 && Math.abs(localX) < 0.18)) {
      this.neckPull = Math.max(0.08, Math.min(1.32, this.neckPull + dyScreen * 1.9 - dz * 0.9));
      this.neckCurve = Math.max(-0.25, Math.min(0.95, this.neckCurve + dz * 1.8 + dx * 0.7));
      this.wingSpread = Math.min(1.0, this.wingSpread + Math.abs(dx) * 0.8);
      this.leftRoll = Math.min(1.15, Math.max(this.leftRoll, 0.55 + this.neckPull * 0.35));
      this.rightRoll = Math.min(1.15, Math.max(this.rightRoll, 0.55 + this.neckPull * 0.35));
      this.rebuildMesh();
      return 'neck';
    }

    const speed = Math.hypot(dx, dz) + Math.abs(dyScreen) * 0.5;
    if (localX <= 0.06) {
      const inwardBoost = dx > 0 ? 1.5 : 0.7;
      this.leftRoll = Math.min(1.2, this.leftRoll + speed * 1.85 * inwardBoost);
      if (localX > -0.06) this.rightRoll = Math.min(1.2, this.rightRoll + speed * 0.65);
    }
    if (localX >= -0.06) {
      const inwardBoost = dx < 0 ? 1.5 : 0.7;
      this.rightRoll = Math.min(1.2, this.rightRoll + speed * 1.85 * inwardBoost);
      if (localX < 0.06) this.leftRoll = Math.min(1.2, this.leftRoll + speed * 0.65);
    }

    if (this.leftRoll > 0.72 && this.rightRoll > 0.72 && dyScreen > -0.005) {
      this.neckPull = Math.min(1.25, this.neckPull + speed * 0.85);
    }

    this.rebuildMesh();
    return 'roll';
  }

  rebuildMesh() {
    const lr = Math.min(1.15, this.leftRoll);
    const rr = Math.min(1.15, this.rightRoll);
    const np = this.neckPull;
    const foldFold = Math.min(1, np * 1.15);

    const pos = this.baseGeo.attributes.position.array;
    const halfW = 0.28;
    const halfL = 0.29;

    for (let iz = 0; iz < this.gridCols; iz++) {
      const v = iz / this.gridSegs;
      for (let ix = 0; ix < this.gridCols; ix++) {
        const u = ix / this.gridSegs;
        const idx = (iz * this.gridCols + ix) * 3;

        const su = (u - 0.5) * 2.0;
        const sideRoll = su < 0 ? lr : rr;
        const absSu = Math.abs(su);
        const sign = su < 0 ? -1 : 1;

        const coneWidth = (0.06 + v * 0.94) * halfW;
        const flatX = su * halfW;

        const rollStart = Math.max(0.05, 1.0 - sideRoll * 0.88);
        // Plush towel edge thickness curl even when flat!
        const edgeLoft = Math.sin(u * Math.PI) * Math.sin(v * Math.PI) * 0.018;
        let x = flatX;
        let y = 0.016 + edgeLoft;
        let z = (v - 0.5) * 2 * halfL;

        if (absSu > rollStart) {
          const tRoll = (absSu - rollStart) / (1.0 - rollStart + 1e-4);
          const spiralAngle = tRoll * Math.PI * (1.35 + sideRoll * 1.25);
          const rollRadius = (0.026 + v * 0.038) * Math.min(1, sideRoll);
          const targetEdgeX = sign * Math.min(Math.abs(flatX), coneWidth * (1.0 - sideRoll * 0.42));
          x = targetEdgeX - sign * Math.sin(spiralAngle) * rollRadius;
          y = 0.022 + rollRadius * (1.0 - Math.cos(spiralAngle)) + sideRoll * 0.016;
        } else {
          x = sign * Math.abs(flatX) * (1.0 - sideRoll * 0.38 * (1 - v * 0.45));
        }

        if (foldFold > 0.01) {
          const zCompress = 1.0 - foldFold * 0.38;
          z = z * zCompress - foldFold * 0.02;
          y += foldFold * (1 - absSu * 0.45) * Math.sin(v * Math.PI) * 0.065;
        }

        pos[idx] = x;
        pos[idx + 1] = y;
        pos[idx + 2] = z;
      }
    }
    this.baseGeo.attributes.position.needsUpdate = true;
    this.baseGeo.computeVertexNormals();

    const neckVisible = np > 0.04;
    this.neckMesh.visible = neckVisible;
    this.wingMeshes.forEach((wm) => { wm.mesh.visible = np > 0.16; });

    if (neckVisible) {
      const nPos = this.neckGeo.attributes.position.array;
      const hScale = 0.09 + np * 0.31;
      const curveAmt = this.neckCurve;
      const asymTilt = (lr - rr) * 0.14;

      // Graceful S-curve swan neck arching up and bowing toward +Z (viewer)
      const sampleSpine = (t) => {
        const rise = Math.sin(t * Math.PI * 0.76) * hScale + t * hScale * 0.28;
        const zCurve =
          0.06 +
          Math.sin(t * Math.PI * 1.18) * (0.10 - curveAmt * 0.03) -
          Math.pow(Math.max(0, t - 0.56) / 0.44, 1.55) * (0.15 + curveAmt * 0.09);
        const beakDip = Math.pow(Math.max(0, t - 0.75) / 0.25, 1.8) * (0.08 + curveAmt * 0.065);
        return new THREE.Vector3(asymTilt * t, 0.048 + rise - beakDip, zCurve);
      };

      for (let s = 0; s <= this.neckSegs; s++) {
        const t = s / this.neckSegs;
        const p = sampleSpine(t);
        const pNext = sampleSpine(Math.min(1, t + 0.02));
        const pPrev = sampleSpine(Math.max(0, t - 0.02));
        const tangent = pNext.clone().sub(pPrev).normalize();

        const side = new THREE.Vector3(1, 0, 0);
        const normal = new THREE.Vector3().crossVectors(tangent, side).normalize();
        const binormal = new THREE.Vector3().crossVectors(normal, tangent).normalize();

        const baseRad = (0.060 * (1 - t * 0.60) + Math.exp(-((t - 0.74) ** 2) / 0.008) * 0.014) * Math.min(1, np * 2.2);
        const tipTaper = t > 0.84 ? Math.max(0.08, 1 - (t - 0.84) / 0.16) : 1.0;
        const rad = baseRad * tipTaper;

        for (let r = 0; r <= this.radialSegs; r++) {
          const theta = (r / this.radialSegs) * Math.PI * 2;
          const seamGroove = 1.0 - 0.16 * (1 - t * 0.7) * Math.pow(Math.abs(Math.cos(theta)), 3);
          const rx = Math.sin(theta) * rad * 1.08 * seamGroove;
          const ry = Math.cos(theta) * rad * 0.92 * seamGroove;

          const k = (s * (this.radialSegs + 1) + r) * 3;
          nPos[k] = p.x + binormal.x * rx + normal.x * ry;
          nPos[k + 1] = p.y + binormal.y * rx + normal.y * ry;
          nPos[k + 2] = p.z + binormal.z * rx + normal.z * ry;
        }
      }
      this.neckGeo.attributes.position.needsUpdate = true;
      this.neckGeo.computeVertexNormals();

      // Plush arched towel wings cradling both sides of the swan body
      const wingAlpha = Math.min(1, (np - 0.14) * 1.6);
      for (const wm of this.wingMeshes) {
        const sRoll = wm.side < 0 ? lr : rr;
        const lOff = wm.layer * 0.042;
        wm.mesh.position.set(
          wm.side * (0.11 + lOff * 0.5 + sRoll * 0.015),
          0.075 * wingAlpha + lOff * 0.9 + 0.025,
          -0.04 - lOff * 0.7
        );
        wm.mesh.scale.set(0.36 + sRoll * 0.06, 0.55 + wingAlpha * 0.35, 1.25 - wm.layer * 0.22);
        wm.mesh.rotation.set(0.38 + wm.layer * 0.16, wm.side * 0.24, -wm.side * (0.35 + this.wingSpread * 0.22));
      }
    }

    const sSize = 0.68 - foldFold * 0.14;
    this.shadowMesh.scale.set(sSize / 0.68, (0.68 - foldFold * 0.08) / 0.68, 1);
  }
}

// ============================================================================
// 3. MORNING BREEZE SHEER WINDOW CURTAINS SIMULATION
// ============================================================================
export class CurtainSimulation {
  constructor(sheerTexture) {
    this.group = new THREE.Group();
    this.openness = 0.62;
    this.targetOpenness = 0.62;

    const mat = new THREE.MeshPhysicalMaterial({
      color: 0xfffdf8,
      alphaMap: sheerTexture,
      map: sheerTexture,
      transparent: true,
      opacity: 0.86,
      roughness: 0.72,
      sheen: 0.85,
      sheenRoughness: 0.58,
      sheenColor: new THREE.Color(0xffffff),
      side: THREE.DoubleSide,
      depthWrite: false
    });

    this.panels = [];
    for (let side of [-1, 1]) {
      const segX = 22;
      const segY = 28;
      const geo = new THREE.PlaneGeometry(1.25, 3.10, segX, segY);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.userData.curtainPanel = true;
      mesh.userData.side = side;
      this.group.add(mesh);
      this.panels.push({ side, mesh, geo, segX, segY });
    }
  }

  slideBy(deltaOpen) {
    this.targetOpenness = Math.max(0.14, Math.min(1.0, this.targetOpenness + deltaOpen));
  }

  update(time, dt) {
    this.openness += (this.targetOpenness - this.openness) * Math.min(1, dt * 8.0);

    for (const p of this.panels) {
      const posAttr = p.geo.attributes.position;
      const arr = posAttr.array;
      const cols = p.segX + 1;
      const rows = p.segY + 1;

      const outerZ = p.side * 1.28;
      const innerZ = p.side * (0.10 + this.openness * 0.86);

      for (let iy = 0; iy < rows; iy++) {
        const v = iy / p.segY;
        const topY = 1.55 - v * 3.10;
        const wind =
          Math.pow(v, 1.4) *
          (Math.sin(time * 1.35 + v * 2.4 + p.side) * 0.11 +
            Math.sin(time * 2.5 - v * 3.8) * 0.038);

        for (let ix = 0; ix < cols; ix++) {
          const u = ix / p.segX;
          const idx = (iy * cols + ix) * 3;
          const z = outerZ + (innerZ - outerZ) * u;
          const pleatDepth = 0.048 + this.openness * 0.048;
          const pleat = Math.sin(u * Math.PI * 9.0) * pleatDepth;

          arr[idx] = -wind - pleat;
          arr[idx + 1] = topY;
          arr[idx + 2] = z + Math.sin(time * 1.1 + u * 3) * 0.015 * v;
        }
      }
      posAttr.needsUpdate = true;
      p.geo.computeVertexNormals();
    }
  }
}
