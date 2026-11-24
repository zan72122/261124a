// Main Game Loop, 1-Finger Interaction Simulation, Dad's Collapsing Tower & Telemetry
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { SoundEngine } from './audio.js';
import { RigidBlock, RigidBodyWorld } from './physics.js';
import { createAllMaterialAssets } from './textures.js';
import { PortraitOverlay, ChildHand3D, DadHand3D, AnimalManager } from './characters.js';
import { MacroCinemaPost, BlockVillageWorld } from './world.js';

const PHASES = {
  DRESSUP: 'DRESSUP',
  SCENE1_HOUSE: 'SCENE1_HOUSE',
  SCENE2_GARDEN: 'SCENE2_GARDEN',
  SCENE3_NIGHT: 'SCENE3_NIGHT',
};

class BlockVillageGame {
  constructor() {
    this.webglCanvas = document.getElementById('webgl');
    this.overlayCanvas = document.getElementById('overlay');

    // Strictly cap pixel ratio at 1.5 per iPhone/iPad 30fps+ performance requirement!
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.webglCanvas,
      antialias: false, // Handled cleanly with custom post-shader & <= 1.5 DPR
      powerPreference: 'high-performance',
    });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setPixelRatio(this.dpr);

    this.scene = new THREE.Scene();

    // Miniature photography lens (38deg FOV, locked camera — player NEVER moves camera!)
    this.camera = new THREE.PerspectiveCamera(38, 1.33, 1.5, 68);
    this.camPosTarget = new THREE.Vector3(0.0, 5.8, 9.6);
    this.camLookTarget = new THREE.Vector3(0.0, 1.0, 0.2);
    this.camLookCurrent = this.camLookTarget.clone();
    this.camera.position.copy(this.camPosTarget);
    this.camera.lookAt(this.camLookCurrent);

    this.sound = new SoundEngine();
    this.materials = createAllMaterialAssets();
    this.world = new BlockVillageWorld(this.scene, this.renderer, this.materials, this.sound);
    this.post = new MacroCinemaPost(this.renderer, this.camera);
    this.portraits = new PortraitOverlay(this.overlayCanvas);

    // 3D Girl's Hand & Dad's Hand
    this.childHand = new ChildHand3D(this.materials);
    this.scene.add(this.childHand.group);
    this.dadHand = new DadHand3D(this.materials);
    this.scene.add(this.dadHand.group);

    // Real 3D Rigid-Body Physics World for collapsing towers & free-stacked blocks!
    this.physics = new RigidBodyWorld({
      getGroundHeight: (x, z) => this.world.getGroundHeight(x, z),
      onImpact: (type, speed) => {
        this.sound.playPhysicsImpact(type, speed);
      },
    });

    // Autonomous Photorealistic Square Sheep & Square Chickens
    this.animals = new AnimalManager(
      this.scene,
      this.materials,
      (x, z) => this.world.getGroundHeight(x, z),
      this.sound
    );

    // Dust, soil crumb & golden sparkle particle pool (single InstancedMesh, super fast!)
    this._initParticles();

    // Game State
    this.phase = PHASES.DRESSUP;
    this.selectedSupply = 'stone';
    this.dadSuggestedMaterial = 'stone';
    this.activePointerId = null;
    this.pointerNDC = new THREE.Vector2(0, 0);
    this.isPointerDown = false;
    this.holdTime = 0;
    this.draggedRigidBody = null;
    this.raycaster = new THREE.Raycaster();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.5);
    this.idleSeconds = 0;
    this.idleDemoActive = false;

    // Scene progression counters
    this.houseCompleted = false;
    this.dadTowerState = 'waiting'; // waiting -> building -> wobbling -> crashed -> rebuilt
    this.dadTowerBlocks = [];
    this.dadBuildStep = 0;
    this.dadBuildTimer = 0;
    this.rebuiltBlocksCount = 0;
    this.rebuiltGardenStructures = [];

    // FPS & Budget Telemetry
    this.fps = 60;
    this._fpsFrames = 0;
    this._fpsAccum = 0;

    this._applyCameraFramingForPhase();
    this._onResize();
    window.addEventListener('resize', () => this._onResize());
    this._bindPointerEvents();

    // Expose inspection hook for automated verification & tuning
    window.__GAME_DEBUG__ = {
      game: this,
      getStats: () => this._collectStats(),
      wearOutfit: (idx = 0) => this._completeDressUp(idx),
      jumpToScene: (n) => this._debugSetupScene(n),
      captureFrame: (outW = 800, outH = 600, quality = 0.86) => {
        this._tick();
        const c = document.createElement('canvas');
        c.width = outW;
        c.height = outH;
        const g = c.getContext('2d');
        g.drawImage(this.webglCanvas, 0, 0, outW, outH);
        g.drawImage(this.overlayCanvas, 0, 0, outW, outH);
        return c.toDataURL('image/jpeg', quality);
      },
    };

    this.lastTime = performance.now();
    this.renderer.setAnimationLoop(() => this._tick());
  }

  _initParticles() {
    this.maxParticles = 90;
    const pGeo = new RoundedBoxGeometry(0.11, 0.11, 0.11, 1, 0.02);
    const pMat = new THREE.MeshStandardMaterial({ roughness: 0.75, vertexColors: false, color: 0xffffff });
    this.particleMesh = new THREE.InstancedMesh(pGeo, pMat, this.maxParticles);
    this.particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // Initialize per-instance color buffer
    const colors = new Float32Array(this.maxParticles * 3);
    this.particleMesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
    this.scene.add(this.particleMesh);

    this.particles = [];
    const zeroMat = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < this.maxParticles; i++) {
      this.particleMesh.setMatrixAt(i, zeroMat);
      this.particles.push({
        life: 0,
        maxLife: 1,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        scale: 1,
        gravity: -4,
      });
    }
    this.pCursor = 0;
  }

  spawnBurst(pos, colorHex = 0xd8c3a5, count = 10, speed = 2.2, gravity = -5.5) {
    const col = new THREE.Color(colorHex);
    for (let k = 0; k < count; k++) {
      const idx = this.pCursor;
      this.pCursor = (this.pCursor + 1) % this.maxParticles;
      const p = this.particles[idx];
      p.life = 0.45 + Math.random() * 0.45;
      p.maxLife = p.life;
      p.pos.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 0.4, Math.random() * 0.3, (Math.random() - 0.5) * 0.4));
      p.vel.set(
        (Math.random() - 0.5) * speed,
        (0.5 + Math.random() * 0.9) * speed,
        (Math.random() - 0.5) * speed
      );
      p.scale = 0.65 + Math.random() * 0.75;
      p.gravity = gravity;
      this.particleMesh.setColorAt(idx, col);
    }
    this.particleMesh.instanceColor.needsUpdate = true;
  }

  _updateParticles(dt) {
    const dummy = new THREE.Object3D();
    // Gentle hearth chimney smoke puffs!
    if (this.world.chimneyPositions.length > 0 && Math.random() < dt * 5.5) {
      const cp = this.world.chimneyPositions[0];
      this.spawnBurst(cp, this.world.timeOfDay > 0.6 ? 0xffd296 : 0xe8e2d8, 1, 0.55, 0.85);
    }

    for (let i = 0; i < this.maxParticles; i++) {
      const p = this.particles[i];
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) {
        dummy.scale.set(0, 0, 0);
        dummy.updateMatrix();
        this.particleMesh.setMatrixAt(i, dummy.matrix);
        continue;
      }
      p.vel.y += p.gravity * dt;
      p.pos.addScaledVector(p.vel, dt);
      const t = p.life / p.maxLife;
      const sc = p.scale * Math.sin(t * Math.PI);
      dummy.position.copy(p.pos);
      dummy.rotation.set(p.life * 3, p.life * 2, 0);
      dummy.scale.setScalar(sc);
      dummy.updateMatrix();
      this.particleMesh.setMatrixAt(i, dummy.matrix);
    }
    this.particleMesh.instanceMatrix.needsUpdate = true;
  }

  _onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(w, h);
    this.aspect = w / Math.max(1, h);

    // Adjust FOV automatically for narrow portrait phones vs landscape iPads so EVERYTHING fits in 1 screen!
    this.camera.aspect = this.aspect;
    this.camera.fov = this.aspect < 0.85 ? 50 : this.aspect < 1.1 ? 43 : 37;
    this.camera.updateProjectionMatrix();

    this.post.setSize(w, h, this.dpr);
    this.portraits.resize(w, h, this.dpr);

    const sIdx = this.phase === PHASES.SCENE1_HOUSE ? 1 : this.phase === PHASES.SCENE2_GARDEN ? 2 : this.phase === PHASES.SCENE3_NIGHT ? 3 : 0;
    this.world.layoutSuppliesForScene(sIdx, this.aspect);
    this._applyCameraFramingForPhase();
  }

  _applyCameraFramingForPhase() {
    const portraitPullback = this.aspect < 0.85 ? 2.1 : this.aspect < 1.1 ? 0.95 : 0.0;
    if (this.phase === PHASES.DRESSUP) {
      this.camPosTarget.set(0.0, 3.35 + portraitPullback * 0.35, 7.35 + portraitPullback);
      this.camLookTarget.set(0.0, 1.25, 0.15);
      this.post.material.uniforms.uFocusDist.value = 6.7 + portraitPullback;
      this.post.material.uniforms.uFocusRange.value = 4.4;
    } else if (this.phase === PHASES.SCENE1_HOUSE) {
      this.camPosTarget.set(-0.10, 3.85 + portraitPullback * 0.45, 8.65 + portraitPullback * 1.15);
      this.camLookTarget.set(-0.15, 1.18, -0.35);
      this.post.material.uniforms.uFocusDist.value = 9.2 + portraitPullback;
      this.post.material.uniforms.uFocusRange.value = 5.4;
    } else if (this.phase === PHASES.SCENE2_GARDEN) {
      this.camPosTarget.set(0.10, 4.15 + portraitPullback * 0.48, 9.25 + portraitPullback * 1.25);
      this.camLookTarget.set(0.0, 1.12, -0.15);
      this.post.material.uniforms.uFocusDist.value = 9.6 + portraitPullback;
      this.post.material.uniforms.uFocusRange.value = 5.6;
    } else {
      // Scene 3: Sunset Magic Hour -> Night Glowing House Panorama + Free Play
      this.camPosTarget.set(0.0, 3.95 + portraitPullback * 0.48, 9.10 + portraitPullback * 1.25);
      this.camLookTarget.set(-0.10, 1.22, -0.25);
      this.post.material.uniforms.uFocusDist.value = 9.5 + portraitPullback;
      this.post.material.uniforms.uFocusRange.value = 5.8;
    }
  }

  // ============================================================================
  // SINGLE-FINGER POINTER & EMBODIED HAND SIMULATION
  // ============================================================================
  _bindPointerEvents() {
    const el = this.webglCanvas;

    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.sound.unlock();
      if (this.activePointerId !== null && this.activePointerId !== e.pointerId) return;
      this.activePointerId = e.pointerId;
      this.isPointerDown = true;
      this.holdTime = 0;
      this.idleSeconds = 0;
      this.idleDemoActive = false;

      this._updatePointerCoords(e);
      this._handlePointerDown();
    }, { passive: false });

    el.addEventListener('pointermove', (e) => {
      e.preventDefault();
      if (this.activePointerId !== null && e.pointerId !== this.activePointerId) return;
      this.idleSeconds = 0;
      this._updatePointerCoords(e);
      this._handlePointerMove();
    }, { passive: false });

    const endHandler = (e) => {
      if (this.activePointerId !== null && e.pointerId !== this.activePointerId) return;
      this._handlePointerUp();
      this.isPointerDown = false;
      this.activePointerId = null;
      this.holdTime = 0;
    };
    el.addEventListener('pointerup', endHandler);
    el.addEventListener('pointercancel', endHandler);
  }

  _updatePointerCoords(e) {
    const rect = this.webglCanvas.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.pointerNDC.set(nx, ny);
    this.portraits.pointerNorm.x = nx;
    this.portraits.pointerNorm.y = -ny;

    // Project finger to 3D child's hand hover plane above the blocks!
    this.raycaster.setFromCamera(this.pointerNDC, this.camera);
    const hitPt = new THREE.Vector3();
    const hoverPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.35);
    if (this.raycaster.ray.intersectPlane(hoverPlane, hitPt)) {
      hitPt.x = Math.max(-5.0, Math.min(5.0, hitPt.x));
      hitPt.z = Math.max(-3.6, Math.min(4.4, hitPt.z));
      this.childHand.targetPos.set(hitPt.x + 0.12, 1.55, hitPt.z + 0.35);
    }
  }

  _selectSupply(supplyId) {
    this.selectedSupply = supplyId;
    this.world.supplyItems.forEach((slot) => {
      slot.userData.selected = slot.userData.id === supplyId;
    });
    this.childHand.setHeldPreview(this.world.createPreviewMesh(supplyId, 0.36));
    this.sound.playPickup(supplyId.startsWith('seed') ? 'seed' : supplyId);
  }

  _completeDressUp(outfitIdx) {
    if (this.phase !== PHASES.DRESSUP) return;
    this.sound.playOutfitWear(outfitIdx);
    this.portraits.outfitIndex = outfitIdx;
    this.portraits.dressUpMode = false;
    this.portraits.setGirlMood('delighted', 2.4);

    const stand = this.world.outfitStands[outfitIdx];
    if (stand) {
      const wp = new THREE.Vector3();
      stand.getWorldPosition(wp);
      wp.y += 1.1;
      this.spawnBurst(wp, this.materials.outfits[outfitIdx].hatColor, 18, 2.8, -4.5);
    }

    // Girl's 3D hand appears at natural bottom-right foreground ready position wearing the matching sleeve!
    this.childHand.setOutfit(outfitIdx);
    this.childHand.targetPos.set(2.35, 1.05, 3.05);
    this.childHand.group.position.copy(this.childHand.targetPos);
    this.world.dressUpGroup.visible = false;

    // Enter Scene 1: House Building!
    this.phase = PHASES.SCENE1_HOUSE;
    this.world.foundationGroup.visible = true;
    this.dadSuggestedMaterial = 'stone';
    this.world.updateSignboard(1, this.dadSuggestedMaterial);
    this.world.layoutSuppliesForScene(1, this.aspect);
    this._selectSupply('stone');
    this.portraits.showDad('happy', 3.2);
    this._applyCameraFramingForPhase();
  }

  _handlePointerDown() {
    this.raycaster.setFromCamera(this.pointerNDC, this.camera);

    // --- PHASE 0: DRESS-UP ---
    if (this.phase === PHASES.DRESSUP) {
      const hits = this.raycaster.intersectObjects(
        this.world.outfitStands.map((s) => s.userData.hit),
        false
      );
      if (hits.length > 0) {
        this._completeDressUp(hits[0].object.userData.outfitIndex);
        return;
      }
      // Forgiving fallback: tapping near left/center/right stand area picks nearest stand!
      if (this.pointerNDC.y < 0.45) {
        const idx = this.pointerNDC.x < -0.28 ? 0 : this.pointerNDC.x > 0.28 ? 2 : 1;
        this._completeDressUp(idx);
      }
      return;
    }

    // --- CHECK FOREGROUND SUPPLY TRAY FIRST ---
    const visibleHits = this.world.supplyItems
      .filter((s) => s.visible)
      .map((s) => s.userData.hit);
    const supplyHit = this.raycaster.intersectObjects(visibleHits, false);
    if (supplyHit.length > 0) {
      this._selectSupply(supplyHit[0].object.userData.supplyId);
      this.portraits.setGirlMood('curious', 1.2);
      return;
    }

    // --- CHECK INTERACTIVE CELESTIAL SUN/MOON ORB IN SCENE 3 ---
    if (this.phase === PHASES.SCENE3_NIGHT) {
      const skyHit = this.raycaster.intersectObject(this.world.celestialOrb, true);
      if (skyHit.length > 0 || (this.pointerNDC.y > 0.66 && Math.abs(this.pointerNDC.x) < 0.6)) {
        // Cycle smoothly between Starry Night (1.0), Sunset Magic Hour (0.48), and Crisp Daylight (0.08)!
        if (this.world.targetTimeOfDay > 0.75) this.world.targetTimeOfDay = 0.48;
        else if (this.world.targetTimeOfDay > 0.3) this.world.targetTimeOfDay = 0.08;
        else this.world.targetTimeOfDay = 1.0;
        this.sound.playLanternLight(2);
        this.portraits.setGirlMood('delighted', 1.5);
        return;
      }
    }

    // --- CHECK FALLEN RIGID-BODY BLOCKS (Daughter rescuing Dad's collapsed tower or poking towers!) ---
    const rigidMeshes = this.physics.bodies.map((b) => b.mesh);
    const rigidHits = this.raycaster.intersectObjects(rigidMeshes, false);
    if (rigidHits.length > 0) {
      const hitMesh = rigidHits[0].object;
      const body = this.physics.bodies.find((b) => b.mesh === hitMesh);
      if (body) {
        if (body.canRescue && !body.rescued) {
          this._rescueFallenTowerBlock(body);
          return;
        } else {
          // Playful physics tap/push on freestanding blocks!
          const push = new THREE.Vector3((Math.random() - 0.5) * 3.5, 4.2, -2.5);
          body.applyWorldImpulse(push, rigidHits[0].point);
          this.sound.playBlockPlace(body.type, 2, 1.1);
          return;
        }
      }
    }

    // --- CHECK ANIMALS (Petting or giving an item!) ---
    const animalGroups = this.animals.animals.map((a) => a.group);
    const animalHits = this.raycaster.intersectObjects(animalGroups, true);
    if (animalHits.length > 0) {
      let obj = animalHits[0].object;
      while (obj && !this.animals.animals.find((a) => a.group === obj)) obj = obj.parent;
      const animal = this.animals.animals.find((a) => a.group === obj);
      if (animal) {
        const isFood = this.selectedSupply.startsWith('seed');
        this.animals.interactWithAnimal(animal, isFood ? 'seed' : this.selectedSupply, () => {
          // Gave Stone/Wood/Lantern to Sheep or Chicken -> "あれ？" -> Hop onto stepping block & rejoice!
          this.sound.playHuhThenHappy();
          this.portraits.triggerHuhThenHappy('girl');
          const stepBlock = new THREE.Mesh(
            new RoundedBoxGeometry(0.62, 0.24, 0.62, 2, 0.03),
            this.selectedSupply === 'wood' ? this.materials.matWoodBlock : this.materials.matStone
          );
          stepBlock.position.set(animal.pos.x, this.world.getGroundHeight(animal.pos.x, animal.pos.z) + 0.12, animal.pos.z);
          stepBlock.castShadow = true;
          stepBlock.receiveShadow = true;
          this.scene.add(stepBlock);
          animal.perchY = 0.24;
        });
        this.spawnBurst(animal.pos.clone().add(new THREE.Vector3(0, 0.6, 0)), 0xfff0a8, 8, 1.8, -3.0);
        if (isFood) this.portraits.setGirlMood('delighted', 1.5);
        return;
      }
    }

    // --- INTERSECT WORLD PLAY AREA ---
    const worldPt = this._raycastPlaySurface();
    if (!worldPt) return;

    this._actAtWorldPoint(worldPt, true);
  }

  _handlePointerMove() {
    if (!this.isPointerDown || this.phase === PHASES.DRESSUP) return;
    // Allow dragging across garden plots to plant/water smoothly!
    if (this.phase === PHASES.SCENE2_GARDEN || this.phase === PHASES.SCENE3_NIGHT) {
      const worldPt = this._raycastPlaySurface();
      if (worldPt && this.holdTime > 0.16) {
        const nearPlot = this._findNearestGardenPlot(worldPt, 0.68);
        if (nearPlot && !nearPlot.planted && this.selectedSupply.startsWith('seed')) {
          this._interactGardenPlot(nearPlot, 0.25);
        }
      }
    }
  }

  _handlePointerUp() {
    // Nothing special needed on release; continuous hold is handled in _tick
  }

  _raycastPlaySurface() {
    this.raycaster.setFromCamera(this.pointerNDC, this.camera);
    // Test house blocks + garden soil + terrain
    const targets = [
      this.world.instGrass,
      this.world.instEarth,
      this.world.instStone,
      this.world.instWood,
      ...this.world.gardenPlots.map((p) => p.soilMesh),
    ];
    this.world.houseGrid.forEach((c) => targets.push(c.group));

    const hits = this.raycaster.intersectObjects(targets, true);
    if (hits.length > 0) return hits[0].point;

    const fallback = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(this.groundPlane, fallback);
  }

  _findNearestGardenPlot(pt, maxDist = 0.85) {
    if (!this.world.gardenGroup.visible) return null;
    let best = null;
    let bestD = maxDist;
    for (const p of this.world.gardenPlots) {
      const d = Math.hypot(pt.x - p.x, pt.z - p.z);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  _actAtWorldPoint(pt, isInitialTap) {
    // 1. In Scene 2 or 3, check if touching the Garden Field!
    const plot = this._findNearestGardenPlot(pt, 0.82);
    if (plot && (this.phase === PHASES.SCENE2_GARDEN || (this.phase === PHASES.SCENE3_NIGHT && this.selectedSupply.startsWith('seed')))) {
      this._interactGardenPlot(plot, isInitialTap ? 0.34 : 0.08);
      return;
    }

    // 2. Building on the House Plot (x in [-3.2..2.2], z in [-2.8..0.8])
    const inHouseZone = pt.x >= -3.2 && pt.x <= 2.3 && pt.z >= -2.9 && pt.z <= 0.85;
    if (inHouseZone && !this.selectedSupply.startsWith('seed')) {
      const mat = this.selectedSupply;

      // Check if player placed a DIFFERENT material than Dad's current suggestion on the picture signboard!
      let triggeredHuh = false;
      if (this.phase === PHASES.SCENE1_HOUSE && mat !== this.dadSuggestedMaterial && (this.world.houseGrid.size % 3 === 1)) {
        triggeredHuh = true;
        this.sound.playHuhThenHappy();
        this.portraits.triggerHuhThenHappy('both');
      } else {
        this.portraits.setGirlMood('happy', 1.4);
      }

      const res = this.world.placeOrSculptHouseBlock(pt.x, pt.z, mat, 0);
      this.physics.setStaticBoxes(this.world.getStaticHouseAABBs());
      if (!triggeredHuh) {
        this.sound.playBlockPlace(mat, res.cell.gy, 1.0);
      }

      const fxColor = mat === 'grass' ? 0x6c963e : mat === 'stone' ? 0xa5a29a : mat === 'lantern' ? 0xffd275 : 0xb58352;
      this.spawnBurst(new THREE.Vector3(res.cell.gx, res.cell.gy + 0.6, res.cell.gz), fxColor, 11, 2.1, -5.5);

      // Update Dad's suggested material on the wooden signboard as the house rises!
      if (this.phase === PHASES.SCENE1_HOUSE) {
        const nextSuggested = res.totalCount < 3 ? 'stone' : res.totalCount < 5 ? 'wood' : 'grass';
        if (nextSuggested !== this.dadSuggestedMaterial) {
          this.dadSuggestedMaterial = nextSuggested;
          this.world.updateSignboard(1, this.dadSuggestedMaterial);
        }

        // Small Goal of Scene 1: 6+ blocks form a real cozy house -> celebrate & open Garden Scene 2!
        if (res.totalCount >= 6 && !this.houseCompleted) {
          this.houseCompleted = true;
          this._transitionToScene2();
        }
      }
      return;
    }

    // 3. Free-stacking physical rigid-body blocks outside the house footprint (e.g. Yard / Terrace in Scene 2 & 3, or playful off-plot taps in Scene 1)!
    if (!this.selectedSupply.startsWith('seed')) {
      if (this.phase === PHASES.SCENE1_HOUSE) {
        // Forgiving magnet in Scene 1: if child taps slightly outside the foundation pad, gently snap into nearest edge of house plot so they always succeed effortlessly!
        const clampedX = Math.max(-2, Math.min(1, Math.round(pt.x)));
        const clampedZ = Math.max(-2, Math.min(0, Math.round(pt.z)));
        this._actAtWorldPoint(new THREE.Vector3(clampedX, 0, clampedZ), true);
        return;
      }

      // In Scene 2 & Scene 3: Spawn a real physical block (or glowing lantern!) right where touched in the yard!
      this._spawnPlayerYardBlock(pt.x, pt.z, this.selectedSupply);
    }
  }

  _interactGardenPlot(plot, amount) {
    const res = this.world.plantOrGrowPlot(plot, this.selectedSupply, amount);
    const fxPos = new THREE.Vector3(plot.x, 0.35, plot.z);

    if (res.wrongMaterial) {
      // Planted Stone or Wood in tilled earth -> cute alpine rock-blossom + "あれ？→喜ぶ"!
      this.sound.playHuhThenHappy();
      this.portraits.triggerHuhThenHappy('both');
      this.spawnBurst(fxPos, 0xf2b5c8, 12, 2.2, -4.5);
    } else if (res.justRipened) {
      this.sound.playCropRipe();
      this.portraits.setGirlMood('delighted', 1.8);
      this.spawnBurst(fxPos, 0xffd86b, 14, 2.5, -4.2);

      // Attract a new Photorealistic Square Sheep or Square Chicken!
      const kind = plot.cropKind === 'wheat' ? 'sheep' : plot.cropKind === 'berry' ? 'chicken' : (this.animals.animals.length % 2 === 0 ? 'sheep' : 'chicken');
      this.animals.spawnAnimal(kind);
    } else {
      this.sound.playBlockPlace('seed', plot.growth * 3, 1.0);
      this.spawnBurst(fxPos, 0x7cb342, 7, 1.6, -4.8);
    }

    // Trigger Dad's Tower-Building Blunder once at least 2 crops have sprouted & animals are visiting!
    const plantedCount = this.world.gardenPlots.filter((p) => p.planted).length;
    if (this.phase === PHASES.SCENE2_GARDEN && this.dadTowerState === 'waiting' && plantedCount >= 2) {
      this._startDadTowerSequence();
    }
  }

  _spawnPlayerYardBlock(wx, wz, type) {
    if (this.physics.bodies.length > 26) return;
    const matMap = {
      stone: this.materials.matStone,
      wood: this.materials.matWoodBlock,
      grass: this.materials.matGrassBlock,
      earth: this.materials.matEarth,
      lantern: this.materials.matLantern,
    };
    const mesh = new THREE.Mesh(
      new RoundedBoxGeometry(0.84, 0.84, 0.84, 3, 0.04),
      matMap[type] || this.materials.matWoodBlock
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    if (type === 'lantern') {
      const wrapper = new THREE.Group();
      this.scene.add(wrapper);
      this.world._registerLanternGlow(wrapper, mesh, 0.95);
    }

    // Check highest block already near (wx, wz) so player can stack tall physics towers (`積んで崩れる`)!
    let dropY = this.world.getGroundHeight(wx, wz) + 0.55;
    this.physics.bodies.forEach((b) => {
      if (Math.hypot(b.pos.x - wx, b.pos.z - wz) < 0.68) {
        dropY = Math.max(dropY, b.pos.y + 0.92);
      }
    });

    const rb = new RigidBlock({
      mesh,
      type: type === 'stone' ? 'stone' : 'wood',
      pos: new THREE.Vector3(wx, dropY, wz),
      halfSize: 0.42,
      mass: type === 'stone' ? 1.5 : 1.0,
    });
    this.physics.addBody(rb);
    this.sound.playBlockPlace(type, Math.floor(dropY), 1.0);
    this.spawnBurst(new THREE.Vector3(wx, dropY - 0.3, wz), 0xd8c5a8, 7, 1.6, -5.0);
  }

  // ============================================================================
  // SCENE TRANSITIONS & DAD'S RIGID-BODY COLLAPSING TOWER SEQUENCE
  // ============================================================================
  _transitionToScene2() {
    this.sound.playGoalChime(1);
    this.portraits.setGirlMood('proud', 2.6);
    this.portraits.showDad('proud', 2.8);

    setTimeout(() => {
      this.phase = PHASES.SCENE2_GARDEN;
      this.world.gardenGroup.visible = true;
      this.world.updateSignboard(2);
      this.world.layoutSuppliesForScene(2, this.aspect);
      this._selectSupply('seed_berry');
      this._applyCameraFramingForPhase();

      // One friendly starter Square Sheep trots in curiously to greet your new house!
      this.animals.spawnAnimal('sheep', new THREE.Vector3(-4.2, 0, 1.6));
    }, 1100);
  }

  // `パパが積みすぎて塔が倒れる` -> `毎回1回パパかママがやらかし、娘が立て直す`
  _startDadTowerSequence() {
    this.dadTowerState = 'building';
    this.dadBuildStep = 0;
    this.dadBuildTimer = 0.55;
    this.dadHand.group.visible = true;
    this.dadHand.group.position.set(6.2, 3.2, 1.4);
    this.dadHand.targetPos.set(2.9, 1.8, 1.4);
    this.portraits.showDad('excited', 6.5);
  }

  _updateDadTowerSequence(dt) {
    if (this.dadTowerState === 'building') {
      this.dadBuildTimer -= dt;
      if (this.dadBuildTimer <= 0) {
        const i = this.dadBuildStep;
        const totalBlocks = 6;
        if (i < totalBlocks) {
          this.dadBuildTimer = 0.38;
          const baseX = 1.95;
          const baseZ = 1.35;
          // Dad stacks progressively off-center toward the open yard!
          const leanOffset = i >= 2 ? (i - 1) * -0.15 : 0;
          const bx = baseX + leanOffset;
          const by = 0.38 + i * 0.74;
          const bz = baseZ + (i >= 3 ? (i - 2) * 0.07 : 0);

          const type = i % 2 === 0 ? 'stone' : 'wood';
          const mesh = new THREE.Mesh(
            new RoundedBoxGeometry(0.74, 0.74, 0.74, 1, 0.036),
            type === 'stone' ? this.materials.matStone : this.materials.matWoodBlock
          );
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          this.scene.add(mesh);

          const rb = new RigidBlock({
            mesh,
            type,
            pos: new THREE.Vector3(bx, by, bz),
            halfSize: 0.37,
            mass: 0,
            restitution: 0.28,
            friction: 0.32,
          });
          rb.quat.setFromEuler(new THREE.Euler(0, i * 0.09, i >= 2 ? (i - 1) * 0.05 : 0));
          rb.syncMesh();
          this.dadTowerBlocks.push(rb);

          this.dadHand.targetPos.set(bx + 0.58, by + 0.28, bz);
          this.sound.playBlockPlace(type, i, 1.02);
          if (i >= 3) this.sound.playTowerCreak(i - 2);
          this.dadBuildStep++;
        } else {
          this.dadTowerState = 'wobbling';
          this.dadBuildTimer = 0.75;
          this.portraits.showDad('panic', 2.4);
          this.portraits.setGirlMood('surprised', 1.6);
          this.sound.playTowerUhOh();
          this.dadHand.targetPos.set(6.5, 3.6, 1.4);
        }
      }
    } else if (this.dadTowerState === 'wobbling') {
      this.dadBuildTimer -= dt;
      const prog = (0.75 - this.dadBuildTimer) / 0.75;
      const sway = Math.sin(prog * 22) * 0.07 + prog * prog * 0.32;
      this.dadTowerBlocks.forEach((rb, idx) => {
        const h = idx / this.dadTowerBlocks.length;
        rb.pos.x = 1.95 - idx * 0.11 - h * sway * 1.55;
        rb.quat.setFromEuler(new THREE.Euler(sway * h * 0.35, idx * 0.09, sway * h * 0.95));
        rb.syncMesh();
      });

      if (this.dadBuildTimer <= 0) {
        // Release all 6 blocks into full 3D rigid-body toppling cascade!
        this.dadTowerState = 'crashed';
        this.dadHand.group.visible = false;
        this.dadTowerBlocks.forEach((rb, idx) => {
          rb.mass = rb.type === 'stone' ? 1.4 : 1.0;
          rb.invMass = 1 / rb.mass;
          const side = rb.half.x * 2;
          rb.invInertia = 1 / ((1 / 6) * rb.mass * side * side);
          rb.canRescue = true;
          // Separate slightly & tumble across the open right/center lawn (keeping garden crops at x <= -1 clear!)
          rb.pos.x -= idx * 0.09;
          rb.vel.set(-0.55 - idx * 0.32, 0.30 + idx * 0.10, (idx % 2 === 0 ? 0.75 : -0.35) + idx * 0.14);
          rb.angVel.set((idx % 2 ? 1.7 : -1.3), (idx - 2) * 0.8, 2.2 + idx * 0.45);
          this.physics.addBody(rb);
        });

        this.spawnBurst(new THREE.Vector3(1.8, 1.2, 1.4), 0xc8baa4, 22, 3.4, -5.0);
        this.animals.scareSlightlyFromCrash(new THREE.Vector3(1.8, 0, 1.4));

        setTimeout(() => {
          if (this.dadTowerState === 'crashed') {
            this.portraits.showDad('sheepish', 99);
            this.portraits.setGirlMood('curious', 2.0);
          }
        }, 900);
      }
    }
  }

  // Daughter taps fallen blocks -> snaps them cleanly into a cozy sturdy stone-and-timber animal pen / archway!
  _rescueFallenTowerBlock(body) {
    body.rescued = true;
    body.canRescue = false;
    this.physics.removeBody(body);

    const slotCoords = [
      { x: 1.5, y: 0.43, z: 1.2, ry: 0 },
      { x: 2.38, y: 0.43, z: 1.2, ry: 0 },
      { x: 2.38, y: 0.43, z: 2.08, ry: Math.PI * 0.5 },
      { x: 1.5, y: 0.43, z: 2.08, ry: Math.PI * 0.5 },
      { x: 1.5, y: 1.29, z: 1.2, ry: 0 },
      { x: 2.38, y: 1.29, z: 1.2, ry: 0 },
      { x: 1.94, y: 2.05, z: 1.2, ry: 0 },
    ];
    const target = slotCoords[this.rebuiltBlocksCount % slotCoords.length];
    this.rebuiltBlocksCount++;

    // Animate block flying neatly from tumbled mess into sturdy rebuilt cottage annex / cozy pen!
    const startPos = body.pos.clone();
    const startQuat = body.quat.clone();
    const endPos = new THREE.Vector3(target.x, target.y, target.z);
    const endQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, target.ry, 0));

    this.sound.playBlockPlace(body.type, this.rebuiltBlocksCount, 1.08);
    this.portraits.setGirlMood('delighted', 1.5);

    this.rebuiltGardenStructures.push({
      mesh: body.mesh,
      t: 0,
      startPos,
      endPos,
      startQuat,
      endQuat,
    });

    // Once daughter rescues 4+ blocks, Dad beams with pride & Scene 3 (Sunset Magic Hour -> Night Lights!) begins!
    if (this.rebuiltBlocksCount >= 4 && this.dadTowerState === 'crashed') {
      this.dadTowerState = 'rebuilt';
      this.sound.playGoalChime(2);
      this.portraits.showDad('proud', 3.8);
      this.portraits.setGirlMood('proud', 3.0);

      // Spawn an extra joyful chicken & sheep to celebrate!
      this.animals.spawnAnimal('chicken', new THREE.Vector3(1.9, 0, 1.65));

      setTimeout(() => {
        this._transitionToScene3();
      }, 1500);
    }
  }

  _transitionToScene3() {
    this.phase = PHASES.SCENE3_NIGHT;
    this.world.updateSignboard(3);
    this.world.layoutSuppliesForScene(3, this.aspect);
    this._selectSupply('lantern');
    this._applyCameraFramingForPhase();

    // First glide into breathtaking Golden Sunset Magic Hour (0.48), then into Cozy Glowing Night (1.0)!
    this.world.targetTimeOfDay = 0.50;
    setTimeout(() => {
      if (this.phase === PHASES.SCENE3_NIGHT) {
        this.world.targetTimeOfDay = 1.0;
        this.sound.playGoalChime(3);
        this.portraits.setGirlMood('delighted', 3.0);
        this.portraits.showDad('happy', 3.2);
      }
    }, 3600);
  }

  // Helper for instant scene verification during visual QA
  _debugSetupScene(n) {
    if (this.phase === PHASES.DRESSUP) this._completeDressUp(0);
    if (n >= 2 && this.world.houseGrid.size < 6) {
      this.world.placeOrSculptHouseBlock(-2, -1, 'stone', 0);
      this.world.placeOrSculptHouseBlock(-1, -1, 'stone', 0);
      this.world.placeOrSculptHouseBlock( 0, -1, 'stone', 0);
      this.world.placeOrSculptHouseBlock( 1, -1, 'wood', 0);
      this.world.placeOrSculptHouseBlock(-2, -1, 'wood', 0);
      this.world.placeOrSculptHouseBlock(-1, -1, 'wood', 0);
      this.world.placeOrSculptHouseBlock( 0, -1, 'grass', 0);
      this.world.placeOrSculptHouseBlock(-2, -1, 'wood', 0.6);
      this.world.placeOrSculptHouseBlock( 1, -1, 'stone', 0.5);
      this.physics.setStaticBoxes(this.world.getStaticHouseAABBs());
      this.houseCompleted = true;
      this.phase = PHASES.SCENE2_GARDEN;
      this.world.gardenGroup.visible = true;
      this.world.updateSignboard(2);
      this.world.layoutSuppliesForScene(2, this.aspect);
      this._selectSupply('seed_berry');
      this.world.plantOrGrowPlot(this.world.gardenPlots[0], 'seed_berry', 0.95);
      this.world.plantOrGrowPlot(this.world.gardenPlots[1], 'seed_wheat', 0.95);
      this.world.plantOrGrowPlot(this.world.gardenPlots[4], 'seed_pumpkin', 0.95);
      this.animals.spawnAnimal('sheep', new THREE.Vector3(-2.6, 0, 1.5));
      this.animals.spawnAnimal('chicken', new THREE.Vector3(-1.3, 0, 1.8));
      this._applyCameraFramingForPhase();
    }
    if (n === 2.5) {
      // Trigger Dad's tower immediately for testing physics collapse
      this._startDadTowerSequence();
    }
    if (n >= 3) {
      this.phase = PHASES.SCENE3_NIGHT;
      this.world.updateSignboard(3);
      this.world.layoutSuppliesForScene(3, this.aspect);
      this._selectSupply('lantern');
      this.world.targetTimeOfDay = n === 3.1 ? 0.48 : 1.0;
      this.world.timeOfDay = this.world.targetTimeOfDay;
      this.portraits.setGirlMood('delighted', 4.0);
      this.portraits.showDad('proud', 4.0);
      this._applyCameraFramingForPhase();
    }
  }

  _collectStats() {
    let maxTex = 0;
    this.scene.traverse((obj) => {
      const mats = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [];
      mats.forEach((m) => {
        ['map', 'normalMap', 'roughnessMap', 'emissiveMap'].forEach((k) => {
          const tex = m[k];
          if (tex && tex.image) {
            maxTex = Math.max(maxTex, tex.image.width || 0, tex.image.height || 0);
          }
        });
      });
    });
    return {
      phase: this.phase,
      fps: Math.round(this.fps),
      triangles: this.post.lastSceneTriangles || this.renderer.info.render.triangles,
      calls: this.post.lastSceneCalls || this.renderer.info.render.calls,
      maxTextureSize: maxTex,
      pixelRatio: this.renderer.getPixelRatio(),
      houseBlocks: this.world.houseGrid.size,
      animals: this.animals.animals.length,
      rigidBodies: this.physics.bodies.length,
      dadTowerState: this.dadTowerState,
      timeOfDay: Number(this.world.timeOfDay.toFixed(2)),
    };
  }

  // ============================================================================
  // MAIN ANIMATION & CONTINUOUS SIMULATION TICK
  // ============================================================================
  _tick() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;

    // FPS tracking
    this._fpsFrames++;
    this._fpsAccum += dt;
    if (this._fpsAccum >= 0.5) {
      this.fps = this._fpsFrames / this._fpsAccum;
      this._fpsFrames = 0;
      this._fpsAccum = 0;
    }

    // Continuous Hold Simulation (`どれだけ長く触ったかで状態が変わる`)
    if (this.isPointerDown && this.phase !== PHASES.DRESSUP) {
      this.holdTime += dt;
      if (this.holdTime > 0.22) {
        const pt = this._raycastPlaySurface();
        if (pt) {
          const plot = this._findNearestGardenPlot(pt, 0.85);
          if (plot && (plot.planted || this.selectedSupply.startsWith('seed'))) {
            const res = this.world.plantOrGrowPlot(plot, this.selectedSupply, dt * 0.58);
            this.sound.playHoldTick(Math.min(1, plot.growth), 'grow');
            if (Math.random() < dt * 12) {
              this.spawnBurst(new THREE.Vector3(plot.x, 0.65, plot.z), 0xa8e0ff, 1, 1.1, -4.5);
            }
            if (res.justRipened) {
              this.sound.playCropRipe();
              this.portraits.setGirlMood('delighted', 1.6);
              this.animals.spawnAnimal(plot.cropKind === 'wheat' ? 'sheep' : 'chicken');
            }
          } else if (!this.selectedSupply.startsWith('seed') && pt.x >= -3.2 && pt.x <= 2.3 && pt.z >= -2.9 && pt.z <= 0.85) {
            const res = this.world.placeOrSculptHouseBlock(pt.x, pt.z, this.selectedSupply, dt * 0.65);
            this.sound.playHoldTick(res.cell.sculpt, 'sculpt');
          }
        }
      }
    } else {
      // When finger is off screen for >1.4s on touch devices, gently relax hand toward bottom-right foreground so it never blocks your view of the house!
      if (this.idleSeconds > 1.4 && !this.idleDemoActive && this.phase !== PHASES.DRESSUP) {
        this.childHand.targetPos.lerp(new THREE.Vector3(2.45, 0.95, 3.15), Math.min(1, dt * 2.4));
      }

      // Gentle idle invitation ONLY after 10 seconds of no input (`0-6秒は何もしない、10秒以降に環境の動きでそっと誘う。放置時のみ手で1回実演`)
      this.idleSeconds += dt;
      if (this.idleSeconds > 10.2 && !this.idleDemoActive && this.phase !== PHASES.DRESSUP) {
        this.idleDemoActive = true;
        const demoDest = this.phase === PHASES.SCENE1_HOUSE
          ? new THREE.Vector3(-0.5, 1.3, -1.0)
          : this.phase === PHASES.SCENE2_GARDEN && this.dadTowerState === 'crashed'
            ? new THREE.Vector3(1.8, 1.2, 1.5)
            : new THREE.Vector3(-2.0, 1.2, 1.5);
        this.childHand.targetPos.copy(demoDest);
        setTimeout(() => {
          this.idleSeconds = 3.0;
          this.idleDemoActive = false;
        }, 1600);
      }
    }

    // Dress-up gentle stand breathing
    if (this.phase === PHASES.DRESSUP) {
      const t = now * 0.001;
      this.world.outfitStands.forEach((s, idx) => {
        s.userData.garmentGroup.rotation.y = Math.sin(t * 1.6 + idx * 1.4) * 0.08;
        s.userData.garmentGroup.position.y = 1.15 + Math.sin(t * 2.1 + idx) * 0.03;
      });
    }

    // Update Dad's tower & rebuilt rescue arcs
    this._updateDadTowerSequence(dt);
    for (let i = this.rebuiltGardenStructures.length - 1; i >= 0; i--) {
      const r = this.rebuiltGardenStructures[i];
      r.t = Math.min(1, r.t + dt * 3.4);
      const ease = 1 - Math.pow(1 - r.t, 3);
      r.mesh.position.lerpVectors(r.startPos, r.endPos, ease);
      r.mesh.position.y += Math.sin(r.t * Math.PI) * 1.15;
      r.mesh.quaternion.slerpQuaternions(r.startQuat, r.endQuat, ease);
      if (r.t >= 1) {
        this.spawnBurst(r.endPos, 0xffe8a3, 9, 1.8, -4.5);
        this.rebuiltGardenStructures.splice(i, 1);
      }
    }

    // Step 3D rigid-body physics, world lighting, animals, hands & particles
    this.physics.step(dt);
    this.world.update(dt, this.post);
    this.animals.update(dt, this.world.getRipeCropPositions(), this.world.timeOfDay);
    this.childHand.update(dt, this.isPointerDown);
    this.dadHand.update(dt);
    this._updateParticles(dt);
    this.sound.updateNightAmbience(dt, this.world.timeOfDay);

    // Subtle organic macro-camera breathing (player never moves camera)
    const breatheX = Math.sin(now * 0.00055) * 0.045;
    const breatheY = Math.cos(now * 0.00072) * 0.03;
    this.camera.position.lerp(
      new THREE.Vector3(this.camPosTarget.x + breatheX, this.camPosTarget.y + breatheY, this.camPosTarget.z),
      Math.min(1, dt * 3.2)
    );
    this.camLookCurrent.lerp(this.camLookTarget, Math.min(1, dt * 3.5));
    this.camera.lookAt(this.camLookCurrent);

    // Render 3D world with Macro Depth-of-Field + Warm Highlight Bloom + ACES Filmic
    this.post.render(this.scene);

    // Render soft-lit Girl & Dad portrait cameos
    this.portraits.sunWarmth = this.world.timeOfDay;
    this.portraits.update(dt);
    this.portraits.render();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new BlockVillageGame();
});
