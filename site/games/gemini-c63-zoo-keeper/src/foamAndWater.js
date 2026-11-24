import * as THREE from 'three';

const _mat4 = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _norm = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _tmp = new THREE.Vector3();

// Smooth indexed pillowy soap-cloud puff geometry (~140 smooth triangles per puff -> ZERO flat origami facets & <220k total scene tris!)
function createFoamPuffGeometry() {
  const geo = new THREE.SphereGeometry(1, 8, 6);
  const pos = geo.attributes.position;
  const norm = geo.attributes.normal;
  const uv = geo.attributes.uv;
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const lobe =
      1.0 +
      0.16 * Math.sin(x * 3.2 + 0.5) * Math.cos(z * 3.2 - 0.3) +
      0.12 * Math.sin(y * 3.8 + z * 2.5);
    const vy = y < 0 ? y * 0.68 : y * 1.05;
    v.set(x * lobe, vy * lobe, z * lobe);
    pos.setXYZ(i, v.x, v.y, v.z);
    n.set(x, y * 1.12 + 0.12, z).normalize();
    norm.setXYZ(i, n.x, n.y, n.z);
    uv.setXY(i, uv.getX(i) * 2.5, uv.getY(i) * 2.5);
  }
  return geo;
}

export class FoamSystem {
  constructor(scene, bubbleTexture, maxPuffs = 1200) {
    this.maxPuffs = maxPuffs;
    this.puffs = [];

    const geo = createFoamPuffGeometry();
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      emissive: 0xd6e1eb,
      emissiveIntensity: 0.15,
      bumpMap: bubbleTexture,
      bumpScale: 0.095,
      roughness: 0.26,
      metalness: 0.0,
      clearcoat: 0.55,
      clearcoatRoughness: 0.18,
      sheen: 0.85,
      sheenRoughness: 0.28,
      sheenColor: new THREE.Color(0xffffff),
      iridescence: 0.34,
      iridescenceIOR: 1.33
    });

    // Add soft subsurface creamy wrap lighting so foam mountains never look grey/metallic in shadows!
    mat.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
        gl_FragColor.rgb = max(gl_FragColor.rgb, vColor * 0.46);
        `
      );
    };
    mat.vertexColors = false;

    this.mesh = new THREE.InstancedMesh(geo, mat, maxPuffs);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;

    // Initialize instanceColor buffer
    const white = new THREE.Color(0xfcfdff);
    for (let i = 0; i < maxPuffs; i++) {
      this.mesh.setColorAt(i, white);
    }
    this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.mesh);
  }

  // Add or grow lush mountains of foam anchored right onto an animated 3D object's surface!
  addFoamAtWorldPoint(anchorObject, worldPoint, worldNormal, {
    baseRadius = 0.09,
    growBoost = 0.032,
    color = new THREE.Color(0xfcfdff),
    animalId = null
  } = {}) {
    anchorObject.updateWorldMatrix(true, false);
    const inv = _mat4.copy(anchorObject.matrixWorld).invert();
    const localPos = worldPoint.clone().applyMatrix4(inv);
    const localNorm = worldNormal.clone().transformDirection(inv).normalize();

    // Check if an existing puff is very close so repeated scrubbing piles TALLER foam mountains!
    let grownCount = 0;
    for (let i = 0; i < this.puffs.length; i++) {
      const p = this.puffs[i];
      if (p.anchor === anchorObject && !p.sliding) {
        const d = p.localPos.distanceTo(localPos);
        if (d < p.maxRadius * 0.95 && p.targetRadius < 0.28) {
          p.targetRadius = Math.min(0.28, p.targetRadius + growBoost);
          p.heightScale = Math.min(1.65, p.heightScale + growBoost * 2.4);
          p.jiggle = Math.min(1.0, p.jiggle + 0.45);
          p.color.lerp(color, 0.35);
          grownCount++;
          if (grownCount >= 2) break;
        }
      }
    }

    // Also spawn 3-4 rich clustered puffs around the scrub stroke so lush mountains build rapidly!
    const spawnNum = grownCount > 0 ? 2 : 3;
    for (let k = 0; k < spawnNum; k++) {
      const jitter = new THREE.Vector3(
        (Math.random() - 0.5) * baseRadius * 1.35,
        (Math.random() - 0.5) * baseRadius * 1.15,
        (Math.random() - 0.5) * baseRadius * 1.35
      );
      const stackLift = grownCount > 0 ? (0.03 + Math.random() * 0.075) : 0.015;
      const lp = localPos.clone().add(jitter).addScaledVector(localNorm, stackLift);

      const puff = {
        anchor: anchorObject,
        animalId,
        localPos: lp,
        localNorm: localNorm.clone(),
        radius: 0.016,
        targetRadius: baseRadius * (0.85 + Math.random() * 0.72),
        maxRadius: 0.30,
        heightScale: 0.88 + Math.random() * 0.52,
        rotY: Math.random() * Math.PI * 2,
        jiggle: 0.7,
        phase: Math.random() * Math.PI * 2,
        sliding: false,
        velY: 0,
        worldPos: worldPoint.clone(),
        life: 1.0,
        color: color.clone().offsetHSL(0, 0, (Math.random() - 0.5) * 0.02)
      };

      if (this.puffs.length >= this.maxPuffs) {
        // Recycle oldest ground suds first, else oldest puff
        let victim = this.puffs.findIndex((x) => x.sliding);
        if (victim < 0) victim = 0;
        this.puffs.splice(victim, 1);
      }
      this.puffs.push(puff);
    }
  }

  // Hose water washes, slides, and melts foam puffs physically down onto the wet floor!
  rinseNearWorldPoint(worldCenter, radius = 0.42, strength = 1.0, groundY = 0.0) {
    let washed = 0;
    const r2 = radius * radius;
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const p = this.puffs[i];
      const d2 = p.worldPos.distanceToSquared(worldCenter);
      if (d2 < r2) {
        const f = (1 - d2 / r2) * strength;
        p.targetRadius -= 0.16 * f;
        p.jiggle = 1.0;
        if (!p.sliding && (p.targetRadius < 0.065 || Math.random() < 0.28 * f)) {
          // Detach and slide down with water stream onto courtyard stones!
          p.sliding = true;
          p.anchor = null;
          p.velY = -0.35 - Math.random() * 0.45;
          p.groundY = groundY;
        }
        washed++;
      }
    }
    return washed;
  }

  shakeAnimalFoam(animalId, groundY = 0.0) {
    for (let i = 0; i < this.puffs.length; i++) {
      const p = this.puffs[i];
      if (p.animalId === animalId && !p.sliding) {
        p.jiggle = 1.2;
        if (Math.random() < 0.28) {
          p.sliding = true;
          p.anchor = null;
          p.velY = 0.6 + Math.random() * 0.8;
          p.velX = (Math.random() - 0.5) * 1.4;
          p.velZ = (Math.random() - 0.5) * 1.4;
          p.groundY = groundY;
        }
      }
    }
  }

  clearByFilter(predicate) {
    this.puffs = this.puffs.filter((p) => !predicate(p));
  }

  getCountForAnimal(animalId) {
    let n = 0;
    for (let i = 0; i < this.puffs.length; i++) {
      if (this.puffs[i].animalId === animalId && !this.puffs[i].sliding) n++;
    }
    return n;
  }

  update(dt, elapsed) {
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const p = this.puffs[i];
      p.radius += (p.targetRadius - p.radius) * Math.min(1, dt * 11);
      p.jiggle = Math.max(0, p.jiggle - dt * 2.6);

      if (p.sliding) {
        p.velY -= 3.8 * dt;
        p.worldPos.y += p.velY * dt;
        if (p.velX) p.worldPos.x += p.velX * dt;
        if (p.velZ) p.worldPos.z += p.velZ * dt;
        if (p.worldPos.y <= (p.groundY ?? 0) + p.radius * 0.25) {
          p.worldPos.y = (p.groundY ?? 0) + p.radius * 0.22;
          p.velY = 0;
          p.velX = (p.velX || 0) * 0.88;
          p.velZ = (p.velZ || 0) * 0.88;
          p.heightScale = Math.max(0.28, p.heightScale - dt * 0.9);
          p.targetRadius -= dt * 0.028;
        }
      } else if (p.anchor) {
        p.anchor.updateWorldMatrix(true, false);
        p.worldPos.copy(p.localPos).applyMatrix4(p.anchor.matrixWorld);
        _norm.copy(p.localNorm).transformDirection(p.anchor.matrixWorld).normalize();
      }

      if (p.radius < 0.008 || p.targetRadius <= 0.004) {
        this.puffs.splice(i, 1);
        continue;
      }

      const idx = i; // Will compact below
      void idx;
    }

    const count = Math.min(this.puffs.length, this.maxPuffs);
    let drawIdx = 0;
    const isVisibleInTree = (obj) => {
      let cur = obj;
      while (cur) {
        if (!cur.visible) return false;
        cur = cur.parent;
      }
      return true;
    };
    for (let i = 0; i < count; i++) {
      const p = this.puffs[i];
      if (p.anchor && !p.sliding && !isVisibleInTree(p.anchor)) {
        continue;
      }
      if (p.anchor && !p.sliding) {
        _norm.copy(p.localNorm).transformDirection(p.anchor.matrixWorld).normalize();
      } else {
        _norm.set(0, 1, 0);
      }
      _quat.setFromUnitVectors(_up, _norm);
      const wob = 1 + Math.sin(elapsed * 16 + p.phase) * p.jiggle * 0.14;
      _scale.set(
        p.radius * wob,
        p.radius * p.heightScale * (2 - wob),
        p.radius * wob
      );
      _mat4.compose(p.worldPos, _quat, _scale);
      this.mesh.setMatrixAt(drawIdx, _mat4);
      this.mesh.setColorAt(drawIdx, p.color);
      drawIdx++;
    }
    this.mesh.count = drawIdx;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

// High-realism Water Stream, Splash Droplets, Ground Puddles & Camera Lens Water Beads
export class WaterSystem {
  constructor(scene, maxDrops = 2000) {
    this.maxDrops = maxDrops;
    this.drops = [];
    this.puddles = [];
    this.lensDrops = [];

    // Crisp fine sparkling water droplets (never oversized grey blobs!)
    const dropGeo = new THREE.SphereGeometry(1, 6, 5);
    const dropMat = new THREE.MeshPhysicalMaterial({
      color: 0xf2fbff,
      emissive: 0xcfe8f7,
      emissiveIntensity: 0.28,
      roughness: 0.03,
      metalness: 0.0,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.68,
      depthWrite: false
    });

    this.dropMesh = new THREE.InstancedMesh(dropGeo, dropMat, maxDrops);
    this.dropMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.dropMesh.count = 0;
    this.dropMesh.frustumCulled = false;
    scene.add(this.dropMesh);

    // Wet reflective puddles on courtyard ground (up to 48 expanding glossy puddles!)
    this.maxPuddles = 48;
    const puddleGeo = new THREE.CircleGeometry(1, 20);
    puddleGeo.rotateX(-Math.PI / 2);
    const puddleMat = new THREE.MeshPhysicalMaterial({
      color: 0x2f3638,
      roughness: 0.06,
      metalness: 0.08,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      transparent: true,
      opacity: 0.62,
      polygonOffset: true,
      polygonOffsetFactor: -2
    });
    this.puddleMesh = new THREE.InstancedMesh(puddleGeo, puddleMat, this.maxPuddles);
    this.puddleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.puddleMesh.count = 0;
    this.puddleMesh.receiveShadow = true;
    this.puddleMesh.frustumCulled = false;
    scene.add(this.puddleMesh);

    // 2D Canvas overlay for glistening water droplets when Elephant splashes back!
    this.lensCanvas = document.createElement('canvas');
    this.lensCanvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:5;';
    document.body.appendChild(this.lensCanvas);
    this.lensCtx = this.lensCanvas.getContext('2d');
    this.resizeLens();
  }

  resizeLens() {
    this.lensCanvas.width = Math.min(1024, Math.floor(window.innerWidth * 0.75));
    this.lensCanvas.height = Math.min(1024, Math.floor(window.innerHeight * 0.75));
  }

  spawnStream(origin, targetPoint, count = 18, spread = 0.10) {
    const dir = _tmp.subVectors(targetPoint, origin);
    const dist = Math.max(0.4, dir.length());
    dir.normalize();
    const speed = Math.min(14.5, 6.8 + dist * 1.55);

    for (let i = 0; i < count; i++) {
      const core = i < 6 ? 0.28 : 1.0; // Tight glossy core jet + fine outer spray!
      const vx = dir.x * speed + (Math.random() - 0.5) * spread * speed * core;
      const vy = dir.y * speed + 0.85 + (Math.random() - 0.5) * spread * speed * core;
      const vz = dir.z * speed + (Math.random() - 0.5) * spread * speed * core;
      const jitterT = Math.random() * 0.045;
      this._pushDrop({
        pos: new THREE.Vector3(
          origin.x + vx * jitterT,
          origin.y + vy * jitterT,
          origin.z + vz * jitterT
        ),
        vel: new THREE.Vector3(vx, vy, vz),
        size: i < 6 ? 0.011 : (0.0055 + Math.random() * 0.009),
        stretch: i < 6 ? 4.8 : (1.8 + Math.random() * 1.6),
        life: 0.55 + Math.random() * 0.35
      });
    }
  }

  spawnSplash(hitPoint, hitNormal, count = 20, energy = 1.0) {
    for (let i = 0; i < count; i++) {
      const rx = (Math.random() - 0.5) * 2.5;
      const ry = Math.random() * 2.3 + 0.35;
      const rz = (Math.random() - 0.5) * 2.5;
      const vel = new THREE.Vector3(
        hitNormal.x * 1.9 + rx,
        Math.max(0.4, hitNormal.y * 1.7 + ry),
        hitNormal.z * 1.9 + rz
      ).multiplyScalar(energy);

      this._pushDrop({
        pos: hitPoint.clone().addScaledVector(hitNormal, 0.03),
        vel,
        size: 0.005 + Math.random() * 0.011,
        stretch: 1.4 + Math.random() * 1.2,
        life: 0.42 + Math.random() * 0.42
      });
    }
  }

  addPuddle(x, z, addRadius = 0.08, groundY = 0.006) {
    for (let i = 0; i < this.puddles.length; i++) {
      const p = this.puddles[i];
      const dx = p.x - x;
      const dz = p.z - z;
      if (dx * dx + dz * dz < (p.r + 0.35) * (p.r + 0.35)) {
        p.targetR = Math.min(1.45, p.targetR + addRadius * 0.45);
        return;
      }
    }
    if (this.puddles.length >= this.maxPuddles) {
      this.puddles.shift();
    }
    this.puddles.push({
      x,
      y: groundY,
      z,
      r: 0.05,
      targetR: 0.24 + Math.random() * 0.22,
      scaleZ: 0.78 + Math.random() * 0.42,
      rot: Math.random() * Math.PI
    });
  }

  clearPuddles() {
    this.puddles.length = 0;
    this.puddleMesh.count = 0;
  }

  // Celebratory Elephant Trunk Splash onto the camera lens!
  triggerLensSplash(count = 22) {
    for (let i = 0; i < count; i++) {
      this.lensDrops.push({
        x: 0.08 + Math.random() * 0.84,
        y: 0.06 + Math.random() * 0.76,
        r: 6 + Math.random() * 19,
        vy: 0.015 + Math.random() * 0.055,
        alpha: 0.88 + Math.random() * 0.12,
        life: 2.6 + Math.random() * 1.8
      });
    }
  }

  _pushDrop(d) {
    if (this.drops.length >= this.maxDrops) {
      this.drops.shift();
    }
    this.drops.push(d);
  }

  update(dt, groundY = 0.0) {
    // Update 3D water droplets
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.life -= dt;
      d.vel.y -= 9.4 * dt;
      d.pos.addScaledVector(d.vel, dt);
      if (d.pos.y <= groundY + 0.01) {
        if (Math.random() < 0.09) {
          this.addPuddle(d.pos.x, d.pos.z, 0.04, groundY + 0.006);
        }
        this.drops.splice(i, 1);
        continue;
      }
      if (d.life <= 0) {
        this.drops.splice(i, 1);
      }
    }

    const dCount = Math.min(this.drops.length, this.maxDrops);
    this.dropMesh.count = dCount;
    for (let i = 0; i < dCount; i++) {
      const d = this.drops[i];
      const speedDir = _tmp.copy(d.vel);
      if (speedDir.lengthSq() > 0.001) {
        speedDir.normalize();
        _quat.setFromUnitVectors(_up, speedDir);
      } else {
        _quat.identity();
      }
      _scale.set(d.size, d.size * d.stretch, d.size);
      _mat4.compose(d.pos, _quat, _scale);
      this.dropMesh.setMatrixAt(i, _mat4);
    }
    this.dropMesh.instanceMatrix.needsUpdate = true;

    // Update wet puddles
    const pCount = Math.min(this.puddles.length, this.maxPuddles);
    this.puddleMesh.count = pCount;
    for (let i = 0; i < pCount; i++) {
      const p = this.puddles[i];
      p.r += (p.targetR - p.r) * Math.min(1, dt * 4.5);
      _pos.set(p.x, p.y, p.z);
      _quat.setFromAxisAngle(_up, p.rot);
      _scale.set(p.r, 1, p.r * p.scaleZ);
      _mat4.compose(_pos, _quat, _scale);
      this.puddleMesh.setMatrixAt(i, _mat4);
    }
    this.puddleMesh.instanceMatrix.needsUpdate = true;

    // Render glistening lens water beads
    const ctx = this.lensCtx;
    const cw = this.lensCanvas.width;
    const ch = this.lensCanvas.height;
    ctx.clearRect(0, 0, cw, ch);
    if (this.lensDrops.length > 0) {
      for (let i = this.lensDrops.length - 1; i >= 0; i--) {
        const ld = this.lensDrops[i];
        ld.life -= dt;
        ld.y += ld.vy * dt;
        ld.vy *= 0.985;
        if (ld.life <= 0 || ld.y > 1.08) {
          this.lensDrops.splice(i, 1);
          continue;
        }
        const a = Math.min(1, ld.life * 0.7) * ld.alpha;
        const px = ld.x * cw;
        const py = ld.y * ch;
        const r = ld.r;

        const g = ctx.createRadialGradient(px - r * 0.28, py - r * 0.32, r * 0.08, px, py, r);
        g.addColorStop(0, `rgba(255,255,255,${0.82 * a})`);
        g.addColorStop(0.35, `rgba(225,244,255,${0.36 * a})`);
        g.addColorStop(0.85, `rgba(175,212,235,${0.22 * a})`);
        g.addColorStop(1, `rgba(90,120,140,0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(px, py, r * 0.88, r * 1.16, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}
