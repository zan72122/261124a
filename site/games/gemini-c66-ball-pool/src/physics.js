import * as THREE from 'three';

export const BALL_RADIUS = 0.045; // 9.0cm vibrant jumbo LDPE ball-pit ball
export const MAX_BALLS = 2250;

export const POOL_CONFIG = {
  cx: 0.14,
  cz: 0.04,
  hx: 0.90,      // larger 1.80m inner width so colorful balls fill the screen!
  hz: 0.65,      // 1.30m inner depth
  wallT: 0.115,  // plump 11.5cm cushioned foam wall
  wallH: 0.43,   // 43cm tall foam rim
  matY: 0.026    // padded vinyl inner floor mat
};

export const SLIDE_CONFIG = {
  xTop: -1.58,
  yTop: 0.75,
  xBot: -0.70,
  yBot: 0.44,
  cz: 0.04,
  halfW: 0.21
};

export const PLAY_BOUNDS = {
  minX: -1.86,
  maxX: 1.86,
  minZ: -1.32,
  maxZ: 1.32
};

// BALL STATE: 0 = free in pool/floor, 1 = inside sorting crate, 2 = held in player's hand scoop
export class BallPhysicsWorld {
  constructor() {
    this.count = 0;
    this.px = new Float32Array(MAX_BALLS);
    this.py = new Float32Array(MAX_BALLS);
    this.pz = new Float32Array(MAX_BALLS);
    this.vx = new Float32Array(MAX_BALLS);
    this.vy = new Float32Array(MAX_BALLS);
    this.vz = new Float32Array(MAX_BALLS);

    // Quaternion for genuine 3D rolling of plastic seam & micro-roughness
    this.qx = new Float32Array(MAX_BALLS);
    this.qy = new Float32Array(MAX_BALLS);
    this.qz = new Float32Array(MAX_BALLS);
    this.qw = new Float32Array(MAX_BALLS);

    this.colorId = new Uint8Array(MAX_BALLS); // 0: Pink, 1: Blue, 2: Yellow
    this.shade = new Float32Array(MAX_BALLS); // Smoothed burial/neighbor ambient occlusion [0..1]
    this.state = new Uint8Array(MAX_BALLS);   // 0: world, 1: in crate, 2: scooped
    this.crateId = new Int8Array(MAX_BALLS);  // -1 or 0..2

    // Spatial hash grid for O(N) rigid-body sphere-sphere collisions
    this.cellSize = BALL_RADIUS * 2.02;
    this.gridMinX = -2.3;
    this.gridMinY = 0.0;
    this.gridMinZ = -1.75;
    this.gridNX = 54;
    this.gridNY = 20;
    this.gridNZ = 42;
    this.totalCells = this.gridNX * this.gridNY * this.gridNZ;
    this.cellHead = new Int32Array(this.totalCells);
    this.nextInCell = new Int32Array(MAX_BALLS);
    this.rawOcc = new Float32Array(MAX_BALLS);

    // Dynamic body colliders (Hand, Girl, Dad, Mom)
    this.colliders = [];

    // 3 Color-coded sorting crates (enabled in Scene 3 & Free Play)
    this.cratesActive = false;
    this.crates = [
      { id: 0, colorId: 0, x: -1.44, z: -0.96, hx: 0.25, hz: 0.20, h: 0.26, count: 0, pureCount: 0, tilt: 0 },
      { id: 1, colorId: 1, x: 0.14,  z: -1.10, hx: 0.25, hz: 0.20, h: 0.26, count: 0, pureCount: 0, tilt: 0 },
      { id: 2, colorId: 2, x: 1.50,  z: -0.94, hx: 0.25, hz: 0.20, h: 0.26, count: 0, pureCount: 0, tilt: 0 }
    ];

    // Real-time 256x256 soft contact shadow map projected onto floor & pool mat
    this.shadowSize = 256;
    this.shadowData = new Uint8Array(this.shadowSize * this.shadowSize * 4);
    this.shadowTexture = new THREE.DataTexture(
      this.shadowData,
      this.shadowSize,
      this.shadowSize,
      THREE.RGBAFormat
    );
    this.shadowTexture.needsUpdate = true;
    this.shadowTexture.magFilter = THREE.LinearFilter;
    this.shadowTexture.minFilter = THREE.LinearFilter;

    this.floorBounceCallback = null;
  }

  spawnBall(x, y, z, vx, vy, vz, colorId) {
    if (this.count >= MAX_BALLS) return -1;
    const i = this.count++;
    this.px[i] = x;
    this.py[i] = y;
    this.pz[i] = z;
    this.vx[i] = vx;
    this.vy[i] = vy;
    this.vz[i] = vz;

    // Random initial orientation quaternion
    const u1 = Math.random();
    const u2 = Math.random() * Math.PI * 2;
    const u3 = Math.random() * Math.PI * 2;
    const s1 = Math.sqrt(1 - u1);
    const s2 = Math.sqrt(u1);
    this.qx[i] = s1 * Math.sin(u2);
    this.qy[i] = s1 * Math.cos(u2);
    this.qz[i] = s2 * Math.sin(u3);
    this.qw[i] = s2 * Math.cos(u3);

    this.colorId[i] = colorId;
    this.shade[i] = 0.0;
    this.state[i] = 0;
    this.crateId[i] = -1;
    return i;
  }

  isInsidePoolXZ(x, z, margin = 0) {
    return (
      Math.abs(x - POOL_CONFIG.cx) < POOL_CONFIG.hx - margin &&
      Math.abs(z - POOL_CONFIG.cz) < POOL_CONFIG.hz - margin
    );
  }

  getStats() {
    let inPool = 0;
    let onFloor = 0;
    let inCrates = 0;
    let scooped = 0;
    const colorCounts = [0, 0, 0];

    for (let i = 0; i < this.count; i++) {
      colorCounts[this.colorId[i]]++;
      if (this.state[i] === 1) {
        inCrates++;
      } else if (this.state[i] === 2) {
        scooped++;
      } else if (
        Math.abs(this.px[i] - POOL_CONFIG.cx) <= POOL_CONFIG.hx + POOL_CONFIG.wallT * 0.55 &&
        Math.abs(this.pz[i] - POOL_CONFIG.cz) <= POOL_CONFIG.hz + POOL_CONFIG.wallT * 0.55
      ) {
        inPool++;
      } else {
        onFloor++;
      }
    }
    return { total: this.count, inPool, onFloor, inCrates, scooped, colorCounts };
  }

  // Release balls from a tipped crate during Free Play
  pourFromCrate(crateIdx, targetX, targetY, targetZ, maxRelease = 6) {
    const crate = this.crates[crateIdx];
    if (!crate) return 0;
    let released = 0;
    for (let i = this.count - 1; i >= 0 && released < maxRelease; i--) {
      if (this.state[i] === 1 && this.crateId[i] === crateIdx) {
        this.state[i] = 0;
        this.crateId[i] = -1;
        this.px[i] = targetX + (Math.random() - 0.5) * 0.12;
        this.py[i] = targetY + (Math.random() - 0.5) * 0.06;
        this.pz[i] = targetZ + (Math.random() - 0.5) * 0.12;
        this.vx[i] = (Math.random() - 0.5) * 0.7;
        this.vy[i] = -1.2 - Math.random() * 0.8;
        this.vz[i] = (Math.random() - 0.5) * 0.7;
        crate.count = Math.max(0, crate.count - 1);
        released++;
      }
    }
    return released;
  }

  step(dt) {
    const n = this.count;
    if (n === 0) return;

    const clampedDt = Math.min(dt, 0.033);
    const substeps = 2;
    const subDt = clampedDt / substeps;
    const R = BALL_RADIUS;
    const diam = R * 2;
    const diamSq = diam * diam;
    const invCell = 1.0 / this.cellSize;

    const { cx: pcx, cz: pcz, hx: phx, hz: phz, wallT, wallH, matY } = POOL_CONFIG;
    const outHx = phx + wallT;
    const outHz = phz + wallT;
    const midHx = phx + wallT * 0.5;
    const midHz = phz + wallT * 0.5;
    const rimRadius = wallT * 0.5;
    const wallCoreY = wallH - rimRadius;

    // Precompute slide plane vector
    const sx0 = SLIDE_CONFIG.xTop;
    const sy0 = SLIDE_CONFIG.yTop;
    const sx1 = SLIDE_CONFIG.xBot;
    const sy1 = SLIDE_CONFIG.yBot;
    const sdx = sx1 - sx0;
    const sdy = sy1 - sy0;
    const sLenSq = sdx * sdx + sdy * sdy;
    const sLen = Math.sqrt(sLenSq);
    const snx = -sdy / sLen; // upward normal x (>0, sloping down toward +x)
    const sny = sdx / sLen;  // upward normal y (>0)

    const px = this.px, py = this.py, pz = this.pz;
    const vx = this.vx, vy = this.vy, vz = this.vz;
    const state = this.state, crateId = this.crateId;
    const cellHead = this.cellHead, nextInCell = this.nextInCell;
    const nxGrid = this.gridNX, nyGrid = this.gridNY, nzGrid = this.gridNZ;
    const gMinX = this.gridMinX, gMinY = this.gridMinY, gMinZ = this.gridMinZ;

    for (let sub = 0; sub < substeps; sub++) {
      // 1. Integrate forces & boundaries
      for (let i = 0; i < n; i++) {
        if (state[i] === 2) continue; // scooped balls controlled directly by hand

        vy[i] -= 9.8 * subDt;
        // Subtle air drag
        vx[i] *= 0.996;
        vy[i] *= 0.997;
        vz[i] *= 0.996;

        const oldX = px[i];
        const oldZ = pz[i];

        px[i] += vx[i] * subDt;
        py[i] += vy[i] * subDt;
        pz[i] += vz[i] * subDt;

        // If inside a sorting crate: confine cleanly inside that crate's 3D walls!
        if (state[i] === 1) {
          const c = this.crates[crateId[i]];
          if (c) {
            const minX = c.x - c.hx + R;
            const maxX = c.x + c.hx - R;
            const minZ = c.z - c.hz + R;
            const maxZ = c.z + c.hz - R;
            const botY = 0.02 + R;
            if (px[i] < minX) { px[i] = minX; vx[i] *= -0.25; }
            if (px[i] > maxX) { px[i] = maxX; vx[i] *= -0.25; }
            if (pz[i] < minZ) { pz[i] = minZ; vz[i] *= -0.25; }
            if (pz[i] > maxZ) { pz[i] = maxZ; vz[i] *= -0.25; }
            if (py[i] < botY) {
              py[i] = botY;
              vy[i] *= -0.2;
              vx[i] *= 0.86;
              vz[i] *= 0.86;
            }
            if (py[i] > c.h + R * 1.4) {
              py[i] = c.h + R * 1.4;
              vy[i] = Math.min(0, vy[i]);
            }
          }
          continue;
        }

        // Determine floor height (padded pool mat vs hardwood floor)
        const inPoolFootprint = Math.abs(px[i] - pcx) < midHx && Math.abs(pz[i] - pcz) < midHz;
        const floorY = (inPoolFootprint ? matY : 0.0) + R;

        if (py[i] < floorY) {
          const impactSpeed = -vy[i];
          py[i] = floorY;
          if (inPoolFootprint) {
            vy[i] = impactSpeed > 0.35 ? impactSpeed * 0.24 : 0;
            vx[i] *= 0.92;
            vz[i] *= 0.92;
          } else {
            vy[i] = impactSpeed > 0.32 ? impactSpeed * 0.48 : 0;
            vx[i] *= 0.965;
            vz[i] *= 0.965;
            if (sub === 0 && impactSpeed > 1.35 && this.floorBounceCallback) {
              this.floorBounceCallback(this.colorId[i], impactSpeed, px[i]);
            }
          }
        }

        // Slide chute inclined collider (allows pouring balls down the wooden slide!)
        if (
          px[i] >= sx0 - 0.08 &&
          px[i] <= sx1 + 0.05 &&
          Math.abs(pz[i] - SLIDE_CONFIG.cz) < SLIDE_CONFIG.halfW + R
        ) {
          const t = Math.max(0, Math.min(1, ((px[i] - sx0) * sdx + (py[i] - sy0) * sdy) / sLenSq));
          const cxSlide = sx0 + t * sdx;
          const cySlide = sy0 + t * sdy;
          const dxS = px[i] - cxSlide;
          const dyS = py[i] - cySlide;
          const signedDist = dxS * snx + dyS * sny;
          if (signedDist > -0.05 && signedDist < R + 0.018 && Math.abs(pz[i] - SLIDE_CONFIG.cz) < SLIDE_CONFIG.halfW) {
            const pen = R + 0.016 - signedDist;
            px[i] += snx * pen;
            py[i] += sny * pen;
            const vn = vx[i] * snx + vy[i] * sny;
            if (vn < 0) {
              vx[i] -= (1.28) * vn * snx;
              vy[i] -= (1.28) * vn * sny;
            }
            // Keep inside slide side rails
            const zRel = pz[i] - SLIDE_CONFIG.cz;
            const maxRailZ = SLIDE_CONFIG.halfW - R * 0.85;
            if (zRel < -maxRailZ) { pz[i] = SLIDE_CONFIG.cz - maxRailZ; vz[i] *= -0.3; }
            if (zRel > maxRailZ) { pz[i] = SLIDE_CONFIG.cz + maxRailZ; vz[i] *= -0.3; }
          }
        }

        // Cushioned Ball Pool 4 Rounded Walls
        const rx = px[i] - pcx;
        const rz = pz[i] - pcz;
        const absRx = Math.abs(rx);
        const absRz = Math.abs(rz);

        if (absRx < outHx + R && absRz < outHz + R && py[i] < wallH + R) {
          // Below rounded rim top: hard inner/outer vertical cushioned wall faces
          if (py[i] < wallCoreY) {
            const insidePrev = Math.abs(oldX - pcx) < midHx && Math.abs(oldZ - pcz) < midHz;
            if (insidePrev) {
              if (absRx > phx - R) {
                px[i] = pcx + Math.sign(rx || 1) * (phx - R);
                vx[i] *= -0.35;
              }
              if (absRz > phz - R) {
                pz[i] = pcz + Math.sign(rz || 1) * (phz - R);
                vz[i] *= -0.35;
              }
            } else {
              // Outside pool colliding against outer foam walls
              const penX = outHx + R - absRx;
              const penZ = outHz + R - absRz;
              if (penX > 0 && penZ > 0) {
                if (penX < penZ) {
                  px[i] = pcx + Math.sign(rx || 1) * (outHx + R);
                  vx[i] *= -0.38;
                } else {
                  pz[i] = pcz + Math.sign(rz || 1) * (outHz + R);
                  vz[i] *= -0.38;
                }
              }
            }
          } else {
            // Rounded cylindrical top rim of the foam pool (balls can balance & spill over!)
            const clampedRimX = Math.max(-midHx, Math.min(midHx, rx));
            const clampedRimZ = Math.max(-midHz, Math.min(midHz, rz));
            // Closest point on the rectangular rim spine
            let spineX = rx, spineZ = rz;
            if (Math.abs(midHx - absRx) < Math.abs(midHz - absRz)) {
              spineX = Math.sign(rx || 1) * midHx;
              spineZ = clampedRimZ;
            } else {
              spineX = clampedRimX;
              spineZ = Math.sign(rz || 1) * midHz;
            }
            const dxRim = rx - spineX;
            const dyRim = py[i] - wallCoreY;
            const dzRim = rz - spineZ;
            const dSq = dxRim * dxRim + dyRim * dyRim + dzRim * dzRim;
            const minSum = rimRadius + R;
            if (dSq < minSum * minSum && dSq > 1e-8) {
              const d = Math.sqrt(dSq);
              const nx = dxRim / d, ny = dyRim / d, nz = dzRim / d;
              const push = minSum - d;
              px[i] += nx * push;
              py[i] += ny * push;
              pz[i] += nz * push;
              const vn = vx[i] * nx + vy[i] * ny + vz[i] * nz;
              if (vn < 0) {
                vx[i] -= 1.25 * vn * nx;
                vy[i] -= 1.25 * vn * ny;
                vz[i] -= 1.25 * vn * nz;
              }
            }
          }
        }

        // Exterior collision against sorting crates (and drop-in capture from top!)
        if (this.cratesActive) {
          for (let cIdx = 0; cIdx < 3; cIdx++) {
            const c = this.crates[cIdx];
            const dxC = px[i] - c.x;
            const dzC = pz[i] - c.z;
            const absCX = Math.abs(dxC);
            const absCZ = Math.abs(dzC);
            if (absCX < c.hx + R && absCZ < c.hz + R && py[i] < c.h + R) {
              if (py[i] > c.h - R * 0.65 && absCX < c.hx && absCZ < c.hz && vy[i] <= 0.4) {
                // Ball dropped right into open crate mouth!
                state[i] = 1;
                crateId[i] = cIdx;
                c.count++;
                if (this.colorId[i] === c.colorId) c.pureCount++;
                if (this.onCrateBallAdded) {
                  this.onCrateBallAdded(cIdx, this.colorId[i], i);
                }
                break;
              } else {
                const penX = c.hx + R - absCX;
                const penZ = c.hz + R - absCZ;
                if (penX < penZ) {
                  px[i] = c.x + Math.sign(dxC || 1) * (c.hx + R);
                  vx[i] *= -0.4;
                } else {
                  pz[i] = c.z + Math.sign(dzC || 1) * (c.hz + R);
                  vz[i] *= -0.4;
                }
              }
            }
          }
        }

        // Playroom reachable boundaries
        if (px[i] < PLAY_BOUNDS.minX) { px[i] = PLAY_BOUNDS.minX; vx[i] = Math.abs(vx[i]) * 0.5; }
        if (px[i] > PLAY_BOUNDS.maxX) { px[i] = PLAY_BOUNDS.maxX; vx[i] = -Math.abs(vx[i]) * 0.5; }
        if (pz[i] < PLAY_BOUNDS.minZ) { pz[i] = PLAY_BOUNDS.minZ; vz[i] = Math.abs(vz[i]) * 0.5; }
        if (pz[i] > PLAY_BOUNDS.maxZ) { pz[i] = PLAY_BOUNDS.maxZ; vz[i] = -Math.abs(vz[i]) * 0.5; }

        // Keep loose floor balls from clipping through the wooden Picture Signboard easel at (-1.18, -1.04)
        const dxSign = px[i] - (-1.18);
        const dzSign = pz[i] - (-1.04);
        if (Math.abs(dxSign) < 0.46 + R && Math.abs(dzSign) < 0.24 + R && py[i] < 0.45) {
          const penSX = 0.46 + R - Math.abs(dxSign);
          const penSZ = 0.24 + R - Math.abs(dzSign);
          if (penSX < penSZ) {
            px[i] = -1.18 + Math.sign(dxSign || 1) * (0.46 + R);
            vx[i] *= -0.45;
          } else {
            pz[i] = -1.04 + Math.sign(dzSign || 1) * (0.24 + R);
            vz[i] *= -0.45;
          }
        }

        // Dynamic sphere colliders (Hand, Girl, Dad, Mom)
        for (let c = 0; c < this.colliders.length; c++) {
          const col = this.colliders[c];
          if (!col.active) continue;
          const dx = px[i] - col.x;
          const dy = py[i] - col.y;
          const dz = pz[i] - col.z;
          const sumR = R + col.r;
          const dSq = dx * dx + dy * dy + dz * dz;
          if (dSq < sumR * sumR && dSq > 1e-8) {
            const d = Math.sqrt(dSq);
            const nx = dx / d;
            const ny = dy / d;
            const nz = dz / d;
            const pen = sumR - d;
            px[i] += nx * pen;
            py[i] += ny * pen;
            pz[i] += nz * pen;

            const rvx = vx[i] - col.vx;
            const rvy = vy[i] - col.vy;
            const rvz = vz[i] - col.vz;
            const relN = rvx * nx + rvy * ny + rvz * nz;
            if (relN < 0) {
              const bounce = col.bounce || 1.35;
              vx[i] -= bounce * relN * nx;
              vy[i] -= bounce * relN * ny;
              vz[i] -= bounce * relN * nz;
            }
            if (col.upBoost) {
              // Splash fountain upward + radial launch on big jumps!
              const horiz = Math.sqrt(nx * nx + nz * nz) + 0.001;
              vx[i] += (nx / horiz) * col.radialBoost * (0.65 + Math.random() * 0.7);
              vz[i] += (nz / horiz) * col.radialBoost * (0.65 + Math.random() * 0.7);
              vy[i] += col.upBoost * (0.55 + Math.random() * 0.8);
            }
          }
        }

        // Update 3D rolling rotation quaternion from horizontal velocity
        const moveX = px[i] - oldX;
        const moveZ = pz[i] - oldZ;
        const moveSq = moveX * moveX + moveZ * moveZ;
        if (moveSq > 1e-8) {
          const dist = Math.sqrt(moveSq);
          const halfAngle = (dist / R) * 0.5;
          const sinH = Math.sin(halfAngle) / dist;
          const cosH = Math.cos(halfAngle);
          // Axis perpendicular to movement in XZ plane: (moveZ, 0, -moveX)
          const ax = moveZ * sinH;
          const az = -moveX * sinH;
          const qx0 = this.qx[i], qy0 = this.qy[i], qz0 = this.qz[i], qw0 = this.qw[i];
          const nqx = cosH * qx0 + ax * qw0 - az * qy0;
          const nqy = cosH * qy0 + az * qx0 - ax * qz0;
          const nqz = cosH * qz0 + az * qw0 + ax * qy0;
          const nqw = cosH * qw0 - ax * qx0 - az * qz0;
          const invL = 1.0 / Math.sqrt(nqx * nqx + nqy * nqy + nqz * nqz + nqw * nqw);
          this.qx[i] = nqx * invL;
          this.qy[i] = nqy * invL;
          this.qz[i] = nqz * invL;
          this.qw[i] = nqw * invL;
        }
      }

      // 2. Populate Uniform 3D Grid & Solve Rigid-Body Sphere-Sphere Collisions
      cellHead.fill(-1);
      if (sub === substeps - 1) this.rawOcc.fill(0);

      for (let i = 0; i < n; i++) {
        if (state[i] === 2) continue;
        let gx = ((px[i] - gMinX) * invCell) | 0;
        let gy = ((py[i] - gMinY) * invCell) | 0;
        let gz = ((pz[i] - gMinZ) * invCell) | 0;
        if (gx < 0) gx = 0; else if (gx >= nxGrid) gx = nxGrid - 1;
        if (gy < 0) gy = 0; else if (gy >= nyGrid) gy = nyGrid - 1;
        if (gz < 0) gz = 0; else if (gz >= nzGrid) gz = nzGrid - 1;

        const cIdx = gx + nxGrid * (gy + nyGrid * gz);
        nextInCell[i] = cellHead[cIdx];
        cellHead[cIdx] = i;
      }

      const recordOcc = sub === substeps - 1;
      for (let i = 0; i < n; i++) {
        if (state[i] === 2) continue;
        const xi = px[i], yi = py[i], zi = pz[i];
        const si = state[i];
        let gx = ((xi - gMinX) * invCell) | 0;
        let gy = ((yi - gMinY) * invCell) | 0;
        let gz = ((zi - gMinZ) * invCell) | 0;
        if (gx < 1) gx = 1; else if (gx >= nxGrid - 1) gx = nxGrid - 2;
        if (gy < 1) gy = 1; else if (gy >= nyGrid - 1) gy = nyGrid - 2;
        if (gz < 1) gz = 1; else if (gz >= nzGrid - 1) gz = nzGrid - 2;

        for (let dz = -1; dz <= 1; dz++) {
          const zOff = (gz + dz) * nyGrid;
          for (let dy = -1; dy <= 1; dy++) {
            const yzOff = (gy + dy + zOff) * nxGrid;
            for (let dx = -1; dx <= 1; dx++) {
              let j = cellHead[gx + dx + yzOff];
              while (j !== -1) {
                if (j > i && state[j] === si) {
                  const rx = px[j] - xi;
                  const ry = py[j] - yi;
                  const rz = pz[j] - zi;
                  const dSq = rx * rx + ry * ry + rz * rz;
                  if (dSq < diamSq * 1.28) {
                    if (recordOcc) {
                      // Balls overhead cast deeper cavity occlusion onto buried layers
                      this.rawOcc[i] += ry > 0.015 ? 0.24 : 0.08;
                      this.rawOcc[j] += ry < -0.015 ? 0.24 : 0.08;
                    }
                    if (dSq < diamSq && dSq > 1e-9) {
                      const d = Math.sqrt(dSq);
                      const overlap = (diam - d) * 0.48;
                      const invD = 1.0 / d;
                      const nx = rx * invD;
                      const ny = ry * invD;
                      const nz = rz * invD;

                      px[i] -= nx * overlap;
                      py[i] -= ny * overlap;
                      pz[i] -= nz * overlap;
                      px[j] += nx * overlap;
                      py[j] += ny * overlap;
                      pz[j] += nz * overlap;

                      const rvx = vx[j] - vx[i];
                      const rvy = vy[j] - vy[i];
                      const rvz = vz[j] - vz[i];
                      const vn = rvx * nx + rvy * ny + rvz * nz;
                      if (vn < 0) {
                        const imp = -0.66 * vn; // e = 0.32 plastic restitution
                        vx[i] -= imp * nx;
                        vy[i] -= imp * ny;
                        vz[i] -= imp * nz;
                        vx[j] += imp * nx;
                        vy[j] += imp * ny;
                        vz[j] += imp * nz;

                        // Mild plastic-on-plastic tangential damping so piles settle stably
                        vx[i] += rvx * 0.03;
                        vz[i] += rvz * 0.03;
                        vx[j] -= rvx * 0.03;
                        vz[j] -= rvz * 0.03;
                      }
                    }
                  }
                }
                j = nextInCell[j];
              }
            }
          }
        }
      }
    }

    // Smooth ambient burial occlusion & micro-sleep resting balls
    for (let i = 0; i < n; i++) {
      const targetShade = state[i] === 2 ? 0.0 : Math.min(1.0, this.rawOcc[i]);
      this.shade[i] += (targetShade - this.shade[i]) * 0.18;

      const spSq = vx[i] * vx[i] + vy[i] * vy[i] + vz[i] * vz[i];
      if (spSq < 0.0018 && py[i] < 0.48) {
        vx[i] *= 0.75;
        vy[i] *= 0.75;
        vz[i] *= 0.75;
      }
    }

    this.updateContactShadowTexture();
  }

  // Paint soft ground contact shadows for all balls into 256x256 DataTexture (0 extra triangles!)
  updateContactShadowTexture() {
    const size = this.shadowSize;
    const data = this.shadowData;
    const totalPx = size * size;

    // Clear alpha to 0, dark warm umber shadow RGB
    for (let p = 0; p < totalPx; p++) {
      const idx = p * 4;
      data[idx] = 28;
      data[idx + 1] = 20;
      data[idx + 2] = 14;
      data[idx + 3] = 0;
    }

    // Shadow world bounds: X in [-2.25, +2.25], Z in [-1.68, +1.68]
    const minX = -2.25, spanX = 4.5;
    const minZ = -1.68, spanZ = 3.36;
    const n = this.count;

    for (let i = 0; i < n; i++) {
      if (this.state[i] === 1) continue;
      const y = this.py[i];
      if (y > 0.34) continue;

      // Sunlit directional offset slightly toward +x, +z
      const h = Math.max(0, y - BALL_RADIUS);
      const sx = this.px[i] + h * 0.24;
      const sz = this.pz[i] + h * 0.22;

      const u = ((sx - minX) / spanX) * size;
      const v = (1.0 - (sz - minZ) / spanZ) * size; // Canvas/UV flip
      const ui = u | 0;
      const vi = v | 0;
      if (ui < 2 || ui >= size - 2 || vi < 2 || vi >= size - 2) continue;

      const strength = Math.floor(Math.max(0, (1.0 - h * 3.1)) * 118);
      if (strength <= 2) continue;

      for (let dz = -2; dz <= 2; dz++) {
        const row = (vi + dz) * size;
        for (let dx = -2; dx <= 2; dx++) {
          const rSq = dx * dx + dz * dz;
          if (rSq > 5) continue;
          const falloff = rSq === 0 ? 1.0 : rSq === 1 ? 0.72 : rSq === 2 ? 0.5 : 0.24;
          const aIdx = (row + ui + dx) * 4 + 3;
          const add = (strength * falloff) | 0;
          const cur = data[aIdx];
          data[aIdx] = cur + add > 175 ? 175 : cur + add;
        }
      }
    }

    this.shadowTexture.needsUpdate = true;
  }
}
