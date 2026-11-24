// Real 3D Rigid-Body Impulse Physics Solver for Square Blocks (Tumbling Towers & Stacking)
import * as THREE from 'three';

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _rA = new THREE.Vector3();
const _rB = new THREE.Vector3();
const _velA = new THREE.Vector3();
const _velB = new THREE.Vector3();
const _relVel = new THREE.Vector3();
const _tangent = new THREE.Vector3();
const _imp = new THREE.Vector3();
const _qDelta = new THREE.Quaternion();
const _invQ = new THREE.Quaternion();

const LOCAL_CORNERS = [
  new THREE.Vector3(-1, -1, -1),
  new THREE.Vector3( 1, -1, -1),
  new THREE.Vector3(-1,  1, -1),
  new THREE.Vector3( 1,  1, -1),
  new THREE.Vector3(-1, -1,  1),
  new THREE.Vector3( 1, -1,  1),
  new THREE.Vector3(-1,  1,  1),
  new THREE.Vector3( 1,  1,  1),
];

export class RigidBlock {
  constructor({ mesh, type = 'stone', pos, halfSize = 0.48, mass = 1.2, restitution = 0.22, friction = 0.62 }) {
    this.mesh = mesh;
    this.type = type;
    this.pos = pos.clone();
    this.quat = mesh.quaternion.clone();
    this.half = new THREE.Vector3(halfSize, halfSize, halfSize);
    this.vel = new THREE.Vector3();
    this.angVel = new THREE.Vector3();
    this.mass = mass;
    this.invMass = mass > 0 ? 1 / mass : 0;
    // Solid cube moment of inertia: I = (1/6) * m * s^2 where s = 2 * halfSize
    const side = halfSize * 2;
    const inertia = (1 / 6) * mass * side * side;
    this.invInertia = mass > 0 ? 1 / inertia : 0;
    this.restitution = restitution;
    this.friction = friction;
    this.sleeping = false;
    this.sleepTimer = 0;
    this.canRescue = false; // True when part of Dad's fallen tower waiting for daughter
    this.rescued = false;
    this.age = 0;
  }

  wake() {
    this.sleeping = false;
    this.sleepTimer = 0;
  }

  applyWorldImpulse(impulse, worldPoint) {
    if (this.invMass === 0) return;
    this.wake();
    this.vel.addScaledVector(impulse, this.invMass);
    _v1.subVectors(worldPoint, this.pos).cross(impulse);
    this.angVel.addScaledVector(_v1, this.invInertia);
  }

  syncMesh() {
    this.mesh.position.copy(this.pos);
    this.mesh.quaternion.copy(this.quat);
  }
}

export class RigidBodyWorld {
  constructor({ getGroundHeight, onImpact }) {
    this.bodies = [];
    this.staticBoxes = []; // Array of { min: Vector3, max: Vector3 }
    this.getGroundHeight = getGroundHeight;
    this.onImpact = onImpact;
    this.gravity = -15.5;
  }

  addBody(body) {
    this.bodies.push(body);
    body.syncMesh();
    return body;
  }

  removeBody(body) {
    const idx = this.bodies.indexOf(body);
    if (idx >= 0) this.bodies.splice(idx, 1);
  }

  setStaticBoxes(boxes) {
    this.staticBoxes = boxes;
  }

  step(dt) {
    const clampedDt = Math.min(dt, 0.033);
    const substeps = 3;
    const h = clampedDt / substeps;

    for (let s = 0; s < substeps; s++) {
      this._substep(h);
    }

    for (let i = 0; i < this.bodies.length; i++) {
      this.bodies[i].syncMesh();
    }
  }

  _substep(dt) {
    const n = this.bodies.length;

    // 1. Integrate forces
    for (let i = 0; i < n; i++) {
      const b = this.bodies[i];
      b.age += dt;
      if (b.sleeping || b.invMass === 0) continue;

      b.vel.y += this.gravity * dt;
      // Gentle air damping so falling towers tumble freely all the way to the ground
      b.vel.multiplyScalar(Math.pow(0.994, dt * 60));
      b.angVel.multiplyScalar(Math.pow(0.990, dt * 60));
    }

    // 2. Solve contacts iteratively (Sequential Impulses)
    const solverIters = 4;
    for (let iter = 0; iter < solverIters; iter++) {
      // Dynamic vs Ground & Static AABBs (8 corners)
      for (let i = 0; i < n; i++) {
        const b = this.bodies[i];
        if (b.sleeping || b.invMass === 0) continue;
        this._solveEnvironmentContacts(b, iter === 0);
      }

      // Dynamic vs Dynamic block collisions
      for (let i = 0; i < n; i++) {
        const a = this.bodies[i];
        for (let j = i + 1; j < n; j++) {
          const b = this.bodies[j];
          if (a.sleeping && b.sleeping) continue;
          this._solvePairContact(a, b, iter === 0);
        }
      }
    }

    // 3. Integrate velocities -> positions & quaternions, update sleep state
    for (let i = 0; i < n; i++) {
      const b = this.bodies[i];
      if (b.sleeping || b.invMass === 0) continue;

      b.pos.addScaledVector(b.vel, dt);

      // Keep inside playtable bounds so blocks never fall off screen!
      const boundX = 5.6;
      const boundZ = 4.6;
      if (b.pos.x < -boundX) { b.pos.x = -boundX; b.vel.x = Math.abs(b.vel.x) * 0.4; }
      if (b.pos.x >  boundX) { b.pos.x =  boundX; b.vel.x = -Math.abs(b.vel.x) * 0.4; }
      if (b.pos.z < -boundZ) { b.pos.z = -boundZ; b.vel.z = Math.abs(b.vel.z) * 0.4; }
      if (b.pos.z >  boundZ) { b.pos.z =  boundZ; b.vel.z = -Math.abs(b.vel.z) * 0.4; }

      const wx = b.angVel.x, wy = b.angVel.y, wz = b.angVel.z;
      const wMag = Math.hypot(wx, wy, wz);
      if (wMag > 0.0001) {
        const halfAngle = 0.5 * wMag * dt;
        const sinH = Math.sin(halfAngle) / wMag;
        _qDelta.set(wx * sinH, wy * sinH, wz * sinH, Math.cos(halfAngle));
        b.quat.premultiply(_qDelta).normalize();
      }

      const speedSq = b.vel.lengthSq() + b.angVel.lengthSq() * 0.35;
      if (speedSq < 0.018 && b.age > 0.5) {
        b.sleepTimer += dt;
        if (b.sleepTimer > 0.45) {
          b.sleeping = true;
          b.vel.set(0, 0, 0);
          b.angVel.set(0, 0, 0);
        }
      } else {
        b.sleepTimer = 0;
      }
    }
  }

  _solveEnvironmentContacts(b, reportSound) {
    let maxImpact = 0;
    for (let c = 0; c < 8; c++) {
      const lc = LOCAL_CORNERS[c];
      _v1.set(lc.x * b.half.x, lc.y * b.half.y, lc.z * b.half.z).applyQuaternion(b.quat).add(b.pos);

      const groundY = this.getGroundHeight(_v1.x, _v1.z);
      const pen = groundY - _v1.y;
      if (pen > 0) {
        const impact = this._applySingleBodyContact(b, _v1, _v2.set(0, 1, 0), pen);
        if (impact > maxImpact) maxImpact = impact;
      }

      // Check static house/ledge boxes
      for (let k = 0; k < this.staticBoxes.length; k++) {
        const sb = this.staticBoxes[k];
        if (
          _v1.x > sb.min.x && _v1.x < sb.max.x &&
          _v1.y > sb.min.y && _v1.y < sb.max.y &&
          _v1.z > sb.min.z && _v1.z < sb.max.z
        ) {
          // Find shallowest exit face
          const dx1 = _v1.x - sb.min.x, dx2 = sb.max.x - _v1.x;
          const dy1 = _v1.y - sb.min.y, dy2 = sb.max.y - _v1.y;
          const dz1 = _v1.z - sb.min.z, dz2 = sb.max.z - _v1.z;
          let minP = dy2;
          _v2.set(0, 1, 0);
          if (dx1 < minP) { minP = dx1; _v2.set(-1, 0, 0); }
          if (dx2 < minP) { minP = dx2; _v2.set( 1, 0, 0); }
          if (dz1 < minP) { minP = dz1; _v2.set(0, 0, -1); }
          if (dz2 < minP) { minP = dz2; _v2.set(0, 0,  1); }
          if (dy1 < minP) { minP = dy1; _v2.set(0, -1, 0); }
          const imp = this._applySingleBodyContact(b, _v1, _v2, minP);
          if (imp > maxImpact) maxImpact = imp;
        }
      }
    }

    if (reportSound && maxImpact > 1.3 && this.onImpact) {
      this.onImpact(b.type, maxImpact);
    }
  }

  _applySingleBodyContact(b, contactPt, normal, penetration) {
    _rA.subVectors(contactPt, b.pos);
    // Point velocity = v + w x r
    _velA.copy(b.angVel).cross(_rA).add(b.vel);

    const vn = _velA.dot(normal);
    // Positional correction (soft Baumgarte projection)
    if (penetration > 0.003) {
      b.pos.addScaledVector(normal, Math.min(0.08, (penetration - 0.003) * 0.28));
    }
    if (vn >= 0) return 0;

    // Effective mass along normal: invM + |(r x n)|^2 * invI
    _v3.copy(_rA).cross(normal);
    const kNormal = b.invMass + _v3.lengthSq() * b.invInertia;
    const e = vn < -1.2 ? b.restitution : 0.0;
    const jn = -(1 + e) * vn / kNormal;

    _imp.copy(normal).multiplyScalar(jn);
    b.vel.addScaledVector(_imp, b.invMass);
    _v3.copy(_rA).cross(_imp);
    b.angVel.addScaledVector(_v3, b.invInertia);

    // Tangential Coulomb friction
    _velA.copy(b.angVel).cross(_rA).add(b.vel);
    _tangent.copy(_velA).addScaledVector(normal, -_velA.dot(normal));
    const vtLen = _tangent.length();
    if (vtLen > 0.0005) {
      _tangent.divideScalar(vtLen);
      _v3.copy(_rA).cross(_tangent);
      const kTan = b.invMass + _v3.lengthSq() * b.invInertia;
      let jt = -vtLen / kTan;
      const maxFriction = jn * b.friction;
      jt = Math.max(-maxFriction, Math.min(maxFriction, jt));
      _imp.copy(_tangent).multiplyScalar(jt);
      b.vel.addScaledVector(_imp, b.invMass);
      _v3.copy(_rA).cross(_imp);
      b.angVel.addScaledVector(_v3, b.invInertia);
    }

    return -vn;
  }

  _solvePairContact(a, b, reportSound) {
    // Broadphase bounding sphere check (cube diagonal radius = sqrt(3)*half ~ 1.74*half)
    const maxR = (a.half.x + b.half.x) * 1.76;
    const distSq = a.pos.distanceToSquared(b.pos);
    if (distSq > maxR * maxR) return;

    // Test corners of A inside OBB of B and corners of B inside OBB of A
    let bestPen = 1e9;
    let hit = false;
    const normal = _v2;
    const contactPt = _v3;

    // Check A's corners in B's local frame, and B's corners in A's local frame
    let deepestCornerPen = 0;
    let foundCorner = false;
    const bestNormal = new THREE.Vector3();
    const bestPoint = new THREE.Vector3();

    this._testCornersInBox(a, b, 1, (pen, n, pt) => {
      if (pen > deepestCornerPen) {
        deepestCornerPen = pen;
        bestNormal.copy(n);
        bestPoint.copy(pt);
        foundCorner = true;
      }
    });

    this._testCornersInBox(b, a, -1, (pen, n, pt) => {
      if (pen > deepestCornerPen) {
        deepestCornerPen = pen;
        bestNormal.copy(n);
        bestPoint.copy(pt);
        foundCorner = true;
      }
    });

    if (!foundCorner || deepestCornerPen <= 0) return;
    hit = true;
    bestPen = deepestCornerPen;
    normal.copy(bestNormal); // Points from B toward A
    contactPt.copy(bestPoint);

    if (!hit) return;

    if (a.sleeping) a.wake();
    if (b.sleeping) b.wake();

    // Positional separation
    const totalInvM = a.invMass + b.invMass;
    if (totalInvM === 0) return;

    if (bestPen > 0.004) {
      const corr = Math.min(0.07, (bestPen - 0.004) * 0.35) / totalInvM;
      a.pos.addScaledVector(normal, corr * a.invMass);
      b.pos.addScaledVector(normal, -corr * b.invMass);
    }

    _rA.subVectors(contactPt, a.pos);
    _rB.subVectors(contactPt, b.pos);

    _velA.copy(a.angVel).cross(_rA).add(a.vel);
    _velB.copy(b.angVel).cross(_rB).add(b.vel);
    _relVel.subVectors(_velA, _velB);

    const vn = _relVel.dot(normal);
    if (vn >= 0) return;

    const raCrossN = _v1.copy(_rA).cross(normal).lengthSq() * a.invInertia;
    const rbCrossN = _imp.copy(_rB).cross(normal).lengthSq() * b.invInertia;
    const kNormal = totalInvM + raCrossN + rbCrossN;

    const e = vn < -1.3 ? Math.min(a.restitution, b.restitution) : 0.0;
    const jn = -(1 + e) * vn / kNormal;

    _imp.copy(normal).multiplyScalar(jn);
    a.vel.addScaledVector(_imp, a.invMass);
    a.angVel.addScaledVector(_v1.copy(_rA).cross(_imp), a.invInertia);

    b.vel.addScaledVector(_imp, -b.invMass);
    b.angVel.addScaledVector(_v1.copy(_rB).cross(_imp), -b.invInertia);

    // Friction
    _velA.copy(a.angVel).cross(_rA).add(a.vel);
    _velB.copy(b.angVel).cross(_rB).add(b.vel);
    _relVel.subVectors(_velA, _velB);
    _tangent.copy(_relVel).addScaledVector(normal, -_relVel.dot(normal));
    const vt = _tangent.length();
    if (vt > 0.0005) {
      _tangent.divideScalar(vt);
      const raCrossT = _v1.copy(_rA).cross(_tangent).lengthSq() * a.invInertia;
      const rbCrossT = _imp.copy(_rB).cross(_tangent).lengthSq() * b.invInertia;
      const kTan = totalInvM + raCrossT + rbCrossT;
      let jt = -vt / kTan;
      const mu = Math.sqrt(a.friction * b.friction);
      jt = Math.max(-jn * mu, Math.min(jn * mu, jt));
      _imp.copy(_tangent).multiplyScalar(jt);
      a.vel.addScaledVector(_imp, a.invMass);
      a.angVel.addScaledVector(_v1.copy(_rA).cross(_imp), a.invInertia);
      b.vel.addScaledVector(_imp, -b.invMass);
      b.angVel.addScaledVector(_v1.copy(_rB).cross(_imp), -b.invInertia);
    }

    if (reportSound && -vn > 1.35 && this.onImpact) {
      this.onImpact(a.type === 'stone' || b.type === 'stone' ? 'stone' : 'wood', -vn);
    }
  }

  _testCornersInBox(cornerBody, boxBody, signDir, cb) {
    _invQ.copy(boxBody.quat).invert();
    const hx = boxBody.half.x, hy = boxBody.half.y, hz = boxBody.half.z;
    for (let c = 0; c < 8; c++) {
      const lc = LOCAL_CORNERS[c];
      // World corner of cornerBody
      const wx = lc.x * cornerBody.half.x;
      const wy = lc.y * cornerBody.half.y;
      const wz = lc.z * cornerBody.half.z;
      _v1.set(wx, wy, wz).applyQuaternion(cornerBody.quat).add(cornerBody.pos);
      const worldPtX = _v1.x, worldPtY = _v1.y, worldPtZ = _v1.z;

      // Transform into boxBody local space
      _v1.sub(boxBody.pos).applyQuaternion(_invQ);
      if (Math.abs(_v1.x) < hx && Math.abs(_v1.y) < hy && Math.abs(_v1.z) < hz) {
        const px = hx - Math.abs(_v1.x);
        const py = hy - Math.abs(_v1.y);
        const pz = hz - Math.abs(_v1.z);
        let pen = py;
        let nx = 0, ny = (_v1.y >= 0 ? 1 : -1), nz = 0;
        if (px < pen) { pen = px; nx = (_v1.x >= 0 ? 1 : -1); ny = 0; nz = 0; }
        if (pz < pen) { pen = pz; nx = 0; ny = 0; nz = (_v1.z >= 0 ? 1 : -1); }

        const nWorld = new THREE.Vector3(nx, ny, nz).applyQuaternion(boxBody.quat).multiplyScalar(signDir);
        const ptWorld = new THREE.Vector3(worldPtX, worldPtY, worldPtZ);
        cb(pen, nWorld, ptWorld);
      }
    }
  }
}
