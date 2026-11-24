// Main Game Loop, Wordless Physical Simulation & Multi-Scene Cabin Crew Storyline
// Strictly zero text, single-finger friendly, multi-touch safe, <=1.5 pixel ratio, <=300k tris.

import * as THREE from 'three';
import { CabinAudio } from './audio.js';
import { createMaterialLibrary } from './textures.js';
import { CabinPostFX } from './postfx.js';
import { AirlinerCabin } from './cabin.js';
import { createCharactersAndHand } from './characters.js';
import { GalleyCartSystem } from './cartAndItems.js';

class CabinCrewApp {
  constructor() {
    this.container = document.getElementById('app');
    this.audio = new CabinAudio();

    // Renderer with strict mobile budget (pixelRatio <= 1.5, high-craft shadows)
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping; // Handled in CabinPostFX ACES pass!
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.25, 32.0);
    this.baseCamPos = new THREE.Vector3(0.08, 1.38, 2.38);
    this.baseCamLook = new THREE.Vector3(-0.02, 0.92, -1.65);

    this.mats = createMaterialLibrary(this.renderer);
    this.scene.environment = this.mats.envMaps.day;

    this.cabin = new AirlinerCabin(this.scene, this.mats);
    const chars = createCharactersAndHand(this.scene, this.mats, this.cabin.heroSeatCoords);
    this.daughter = chars.daughter;
    this.passengers = chars.passengers;
    this.playerHand = chars.playerHand;

    this.cartSys = new GalleyCartSystem(this.scene, this.mats);

    const drawBuf = new THREE.Vector2();
    this.renderer.getDrawingBufferSize(drawBuf);
    this.postfx = new CabinPostFX(this.renderer, drawBuf.x, drawBuf.y);

    // Story & Simulation State
    // Stages:
    // 'dressup' -> Hat & Scarf on cart -> Daughter becomes Cabin Crew & finger becomes her hand!
    // 'rollCart' -> Push metallic cart forward down aisle to Row 1 -> Trays flip open & thought bubbles appear!
    // 'serve1'   -> Pour drinks (length = fill volume, mixable!) & warm/peel meals -> Serve Mom, Dad, Grandma!
    // 'spill2'   -> Dad accidentally spills juice -> Wipe tray dry with cloth + pour & serve fresh drink!
    // 'comfort3' -> Sunset -> Night city lights; drape blankets & pillows -> Sleeping smiles -> Touchdown & Applause!
    // 'freeplay' -> Endless sandbox with everything created + Sun/Sunset/Night window cycle!
    this.stage = 'dressup';
    this.hatWorn = false;
    this.scarfWorn = false;
    this.targetTimeOfDay = 0.0;
    this.landingTriggered = false;
    this.touchdownShake = 0.0;

    // Pointer & Single-Finger Physics State
    this.activePointerId = null;
    this.raycaster = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this.dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.82);
    this.verticalDragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.95);
    this.pointerWorld = new THREE.Vector3(0.2, 0.9, 1.1);
    this.prevPointerWorld = new THREE.Vector3();
    this.pointerDownTime = 0;
    this.dragAction = null;
    this.isPointerDown = false;

    // Idle subtle 1-time hand demonstration (>10s idle only, per wordless.short.md!)
    this.idleSeconds = 0;
    this.idleDemoShownForStage = null;
    this.demoAnim = null;

    this._updateCameraFraming();
    this._bindEvents();

    this.clock = new THREE.Clock();
    this.elapsed = 0;
    this.renderer.setAnimationLoop(() => this._tick());
  }

  _updateCameraFraming() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const aspect = w / Math.max(1, h);

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(w, h);

    const drawBuf = new THREE.Vector2();
    this.renderer.getDrawingBufferSize(drawBuf);
    this.postfx.setSize(drawBuf.x, drawBuf.y);

    this.camera.aspect = aspect;
    if (aspect < 0.85) {
      // Portrait iPhone framing: wider vertical FOV & slightly further back so Mom, Dad, Cart, Daughter & Grandma all fit!
      this.camera.fov = 66;
      this.baseCamPos.set(0.10, 1.45, 2.72);
      this.baseCamLook.set(-0.06, 0.84, -1.45);
      this.postfx.material.uniforms.uFocusEnd.value = 3.55;
    } else if (aspect < 1.2) {
      // Square / Tablet portrait
      this.camera.fov = 55;
      this.baseCamPos.set(0.12, 1.42, 2.48);
      this.baseCamLook.set(-0.06, 0.86, -1.60);
      this.postfx.material.uniforms.uFocusEnd.value = 3.30;
    } else {
      // Landscape 4:3 / iPad / Wide: Cinematic wide-angle cabin aisle composition!
      this.camera.fov = 51;
      this.baseCamPos.set(0.14, 1.40, 2.30);
      this.baseCamLook.set(-0.06, 0.86, -1.75);
      this.postfx.material.uniforms.uFocusEnd.value = 3.12;
    }
    this.camera.updateProjectionMatrix();
  }

  _bindEvents() {
    window.addEventListener('resize', () => this._updateCameraFraming());

    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointerdown', (e) => this._onPointerDown(e));
    window.addEventListener('pointermove', (e) => this._onPointerMove(e));
    window.addEventListener('pointerup', (e) => this._onPointerUp(e));
    window.addEventListener('pointercancel', (e) => this._onPointerUp(e));
  }

  _screenToNDC(clientX, clientY) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  }

  _intersectPlane(plane, outVec) {
    this.raycaster.setFromCamera(this.ndc, this.camera);
    return this.raycaster.ray.intersectPlane(plane, outVec);
  }

  _findInteractiveHit() {
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.scene.children, true);
    for (const h of hits) {
      let cur = h.object;
      while (cur) {
        if (cur.userData && cur.userData.interactiveType && cur.visible !== false) {
          // Ensure ancestors are visible!
          let vis = true;
          let p = cur.parent;
          while (p) {
            if (p.visible === false) { vis = false; break; }
            p = p.parent;
          }
          if (vis) return { type: cur.userData.interactiveType, data: cur.userData, object: cur, point: h.point };
        }
        cur = cur.parent;
      }
    }
    return null;
  }

  _onPointerDown(e) {
    // Multi-touch safe: lock onto the first active finger!
    if (this.activePointerId !== null) return;
    this.activePointerId = e.pointerId;
    this.isPointerDown = true;
    this.pointerDownTime = this.elapsed;
    this.idleSeconds = 0;
    this.demoAnim = null;

    this.audio.init();
    this._screenToNDC(e.clientX, e.clientY);

    const hit = this._findInteractiveHit();
    this.dragPlane.constant = -(hit ? Math.max(0.68, Math.min(1.35, hit.point.y)) : 0.86);
    this._intersectPlane(this.dragPlane, this.pointerWorld);
    this.prevPointerWorld.copy(this.pointerWorld);

    if (!hit) {
      // Gentle micro-feedback if tapping Daughter or Passengers directly
      this._checkCharacterTap();
      return;
    }

    const { type, data } = hit;

    // 1. Window Shade sliding (available anytime!)
    if (type === 'windowShade') {
      this.dragAction = {
        kind: 'windowShade',
        shade: data.shade,
        startY: this.ndc.y,
        startRatio: data.shade.targetRatio
      };
      this.audio.playPlasticPlace(1.2);
      return;
    }

    // 2. Overhead Individual Reading Light Toggle
    if (type === 'readingLight') {
      const rl = data.readingLight;
      rl.manualOverride = !rl.isOn;
      this.audio.playPlasticPlace(1.5);
      return;
    }

    // 3. Stage 0: Dress-Up (Hat & Scarf!)
    if (type === 'dressHat' && !this.hatWorn) {
      this.dragAction = { kind: 'dressItem', item: 'hat', mesh: this.cartSys.dressHat };
      this.audio.playFabricPutOn(1.0);
      return;
    }
    if (type === 'dressScarf' && !this.scarfWorn) {
      this.dragAction = { kind: 'dressItem', item: 'scarf', mesh: this.cartSys.dressScarf };
      this.audio.playFabricPutOn(1.15);
      return;
    }

    // 4. Pushing / Rolling the Metallic Galley Cart Handle!
    if (type === 'cartHandle' && this.stage !== 'dressup') {
      this.dragAction = {
        kind: 'pushCart',
        startNDCY: this.ndc.y,
        startZ: this.cartSys.targetZ
      };
      this.audio.playCartRoll(0.6);
      return;
    }

    // 5. Folding Tray Table tap toggle
    if (type === 'trayTable' && this.stage !== 'dressup') {
      const tr = data.tray;
      tr.targetOpen = tr.targetOpen > 0.5 ? 0.0 : 1.0;
      this.audio.playPlasticPlace(0.95);
      if (this.stage === 'rollCart') this._completeRollCart();
      return;
    }

    // 6. Beverage Pitcher: Hold or Drag over Cup to Continuously Pour!
    if (type === 'pitcher' && this.cartSys.serviceStation.visible) {
      const pitcher = data.pitcher;
      if (!this.cartSys.activeCup || this.cartSys.activeCup.served) {
        this.cartSys.spawnFreshCup();
      }
      this.dragAction = {
        kind: 'pourPitcher',
        pitcher,
        pouring: true
      };
      this.audio.startPouring(pitcher.hot);
      this.daughter.setExpression('smile');
      return;
    }

    // 7. Ice Bowl & Garnish Dish (tap to add to active cup!)
    if (type === 'iceBowl' && this.cartSys.activeCup) {
      this.cartSys.addIceToCup(this.cartSys.activeCup);
      this.audio.playIceClink();
      this.daughter.setExpression('delighted', 0.9);
      return;
    }
    if (type === 'garnishDish' && this.cartSys.activeCup) {
      this.cartSys.addGarnishToCup(this.cartSys.activeCup);
      this.audio.playPlasticPlace(1.35);
      this.daughter.setExpression('delighted', 0.9);
      return;
    }

    // 8. Warmer Pad / Button: Hold to continuously bake/toast the hot gratin meal!
    if (type === 'warmerPad' && this.cartSys.activeMeal) {
      this.dragAction = { kind: 'warmMeal', sizzleTimer: 0 };
      if (this.cartSys.activeMeal.targetLidPeeled < 0.5) {
        this.cartSys.activeMeal.targetLidPeeled = 1.0;
        this.audio.playFoilPeel();
      } else {
        this.audio.playWarmerSizzle();
      }
      return;
    }

    // 9. Cup: Drag to serve onto any passenger's tray (or tap a served cup so passenger drinks a sip!)
    if (type === 'cup') {
      const cup = data.cup;
      if (cup.isTippedSpillCup) {
        // Dragging or tapping Dad's tipped spill cup tosses it cleanly into the cart waste bin!
        this._disposeCupToBin(cup);
        return;
      }
      if (cup.served) {
        // In Free Play or after serving: tapping a served cup makes the passenger happily sip it (continuous volume drops!)
        this._passengerSipServedItem(cup);
        return;
      }
      // If cup is still empty and tapped, pour a quick splash automatically or let child drag if filled!
      if (cup.fill < 0.05) {
        cup.mixWeights.juice += 0.28;
        cup.fill = 0.28;
        this.cartSys.updateCupVisuals(cup);
        this.audio.playIceClink();
      }
      this.dragAction = {
        kind: 'dragServeItem',
        record: cup
      };
      return;
    }

    // 10. Hot Meal Dish: First tap peels foil lid with crinkle; dragging serves it onto any passenger's tray!
    if (type === 'mealDish') {
      const meal = data.meal;
      if (meal.served) {
        this._passengerTasteServedMeal(meal);
        return;
      }
      if (meal.targetLidPeeled < 0.5) {
        meal.targetLidPeeled = 1.0;
        this.audio.playFoilPeel();
      }
      this.dragAction = {
        kind: 'dragServeItem',
        record: meal
      };
      return;
    }

    // 11. White Cloth Towel: Drag across Dad's wet tray to wipe up spilled juice!
    if (type === 'wipeCloth' || type === 'spillPuddle') {
      this.dragAction = { kind: 'wipeSpill' };
      this.audio.playWipeScrub(0.6);
      this._scrubSpillAt(hit.point, 0.24);
      return;
    }

    // 12. Comfort Rack: Blankets & Pillows (Scene 3 & Free Play)
    if (type === 'blanketStack') {
      const style = data.blanketStyle;
      const floating = new THREE.Mesh(
        this.cartSys.blanketStacks[style].geometry,
        this.cartSys.blanketStacks[style].material
      );
      floating.scale.setScalar(1.15);
      this.scene.add(floating);
      floating.position.copy(hit.point);
      this.dragAction = { kind: 'dragBlanket', style, floating };
      this.audio.playFabricPutOn(0.95);
      return;
    }

    if (type === 'pillowStack') {
      const floating = new THREE.Mesh(
        this.cartSys.pillowStack.geometry,
        this.cartSys.pillowStack.material
      );
      this.scene.add(floating);
      floating.position.copy(hit.point);
      this.dragAction = { kind: 'dragPillow', floating };
      this.audio.playFabricPutOn(1.08);
      return;
    }

    if (type === 'wornBlanket') {
      // Tapping a passenger's blanket adjusts cozy tuck height!
      const p = this.passengers[data.passengerIndex];
      if (p) {
        p.blanketTuckedHigh = !p.blanketTuckedHigh;
        p.blanketMesh.position.y = p.blanketTuckedHigh ? 0.14 : 0.05;
        this.audio.playFabricPutOn(1.05);
        p.human.setExpression(p.isSleeping ? 'sleep' : 'delighted', 1.2);
      }
    }
  }

  _onPointerMove(e) {
    if (e.pointerId !== this.activePointerId) return;
    this.idleSeconds = 0;
    this._screenToNDC(e.clientX, e.clientY);
    this.prevPointerWorld.copy(this.pointerWorld);
    this._intersectPlane(this.dragPlane, this.pointerWorld);

    if (!this.dragAction) return;
    const act = this.dragAction;

    if (act.kind === 'windowShade') {
      const dy = act.startY - this.ndc.y;
      act.shade.targetRatio = THREE.MathUtils.clamp(act.startRatio + dy * 1.8, 0.04, 1.0);
      // In Free Play, pulling Mom's window shade also gently cycles Day / Sunset / Night sky if pulled all the way & reopened!
      return;
    }

    if (act.kind === 'dressItem') {
      this.verticalDragPlane.constant = -1.02;
      const wp = new THREE.Vector3();
      this._intersectPlane(this.verticalDragPlane, wp);
      this.cartSys.dressTray.worldToLocal(wp);
      act.mesh.position.copy(wp);
      act.mesh.position.y = Math.max(0.05, act.mesh.position.y);

      // Magnetic snap when dragged near Daughter!
      const worldItem = new THREE.Vector3();
      act.mesh.getWorldPosition(worldItem);
      const daughterTarget = new THREE.Vector3(0.45, act.item === 'hat' ? 0.96 : 0.78, 0.96);
      if (worldItem.distanceTo(daughterTarget) < 0.42) {
        this._equipDressItem(act.item);
        this.dragAction = null;
      }
      return;
    }

    if (act.kind === 'pushCart') {
      const deltaY = this.ndc.y - act.startNDCY;
      // Moving finger up into aisle (+NDC Y) pushes cart forward toward -Z!
      const nextZ = THREE.MathUtils.clamp(act.startZ - deltaY * 1.15, 0.72, 1.26);
      if (Math.abs(nextZ - this.cartSys.targetZ) > 0.008) {
        this.audio.playCartRoll(Math.min(1, Math.abs(nextZ - this.cartSys.targetZ) * 18));
      }
      this.cartSys.targetZ = nextZ;
      if (this.stage === 'rollCart' && nextZ <= 0.86) {
        this._completeRollCart();
      }
      return;
    }

    if (act.kind === 'dragServeItem') {
      const rec = act.record;
      const localPos = this.pointerWorld.clone();
      if (rec.group.parent) {
        rec.group.parent.worldToLocal(localPos);
        rec.group.position.set(localPos.x, Math.max(0.09, localPos.y), localPos.z);
      }
      return;
    }

    if (act.kind === 'wipeSpill') {
      const speed = this.pointerWorld.distanceTo(this.prevPointerWorld) * 30;
      this.audio.playWipeScrub(speed);

      // Raycast onto Dad's tray area and scrub wet puddles continuously!
      const trayWorld = new THREE.Vector3();
      this.cabin.trayTables[1].board.getWorldPosition(trayWorld);
      const wipePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -trayWorld.y);
      const scrubPt = new THREE.Vector3();
      this._intersectPlane(wipePlane, scrubPt);

      // Move top cloth visually to scrub point
      const localCloth = scrubPt.clone();
      this.cartSys.towelStackGroup.worldToLocal(localCloth);
      this.cartSys.draggableTowel.position.copy(localCloth);

      this._scrubSpillAt(scrubPt, 0.16 + Math.min(0.22, speed * 0.08));
      return;
    }

    if (act.kind === 'dragBlanket' || act.kind === 'dragPillow') {
      this.verticalDragPlane.constant = -0.05;
      const wp = new THREE.Vector3();
      this._intersectPlane(this.verticalDragPlane, wp);
      act.floating.position.copy(wp);
    }
  }

  _onPointerUp(e) {
    if (e.pointerId !== this.activePointerId) return;
    this.activePointerId = null;
    this.isPointerDown = false;
    const holdDur = this.elapsed - this.pointerDownTime;

    this.audio.stopPouring();
    this.cartSys.pourStream.visible = false;

    if (!this.dragAction) return;
    const act = this.dragAction;
    this.dragAction = null;

    if (act.kind === 'dressItem') {
      // Allow single-tap OR close-drag to put on uniform (wordless.short.md: accept multiple plausible gestures!)
      if (holdDur < 0.35) {
        this._equipDressItem(act.item);
      } else {
        act.mesh.position.copy(act.mesh.userData.homePos);
      }
      return;
    }

    if (act.kind === 'pushCart') {
      // If tapped handle in rollCart stage, gently roll forward into service position!
      if (this.stage === 'rollCart' && holdDur < 0.32) {
        this.cartSys.targetZ = 0.78;
        this._completeRollCart();
      }
      return;
    }

    if (act.kind === 'pourPitcher') {
      // Return pitcher smoothly to cart stand
      act.pitcher.group.position.copy(act.pitcher.homePos);
      act.pitcher.group.rotation.set(0, 0, 0);
      return;
    }

    if (act.kind === 'dragServeItem') {
      const rec = act.record;
      const worldItem = new THREE.Vector3();
      rec.group.getWorldPosition(worldItem);

      // Check if dropped into Waste Bin!
      const binWorld = new THREE.Vector3();
      this.cartSys.wasteBinGroup.getWorldPosition(binWorld);
      if (worldItem.distanceTo(binWorld) < 0.24) {
        this._disposeItemFromCart(rec);
        return;
      }

      // Check magnetic snap onto any of the 3 Passengers' Tray Tables (or Passenger bodies)!
      let bestIdx = -1;
      let bestDist = 0.48;
      for (let i = 0; i < 3; i++) {
        const trayPos = new THREE.Vector3();
        this.cabin.trayTables[i].board.getWorldPosition(trayPos);
        const headPos = new THREE.Vector3();
        this.passengers[i].human.headPivot.getWorldPosition(headPos);

        const dTray = worldItem.distanceTo(trayPos);
        const dHead = worldItem.distanceTo(headPos);
        const d = Math.min(dTray, dHead * 0.95);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }

      if (bestIdx !== -1) {
        this._serveItemToPassenger(rec, bestIdx, worldItem);
      } else {
        rec.group.position.copy(rec.homePos);
      }
      return;
    }

    if (act.kind === 'wipeSpill') {
      this.cartSys.draggableTowel.position.set(0, 0.026, 0);
      return;
    }

    if (act.kind === 'dragBlanket') {
      const pos = act.floating.position.clone();
      this.scene.remove(act.floating);
      const pIdx = this._findNearestPassenger(pos, holdDur < 0.35 ? 9.9 : 0.65);
      if (pIdx !== -1) {
        this._giveBlanketToPassenger(pIdx, act.style);
      }
      return;
    }

    if (act.kind === 'dragPillow') {
      const pos = act.floating.position.clone();
      this.scene.remove(act.floating);
      const pIdx = this._findNearestPassenger(pos, holdDur < 0.35 ? 9.9 : 0.65);
      if (pIdx !== -1) {
        this._givePillowToPassenger(pIdx);
      }
    }
  }

  _checkCharacterTap() {
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const dPos = new THREE.Vector3();
    this.daughter.headPivot.getWorldPosition(dPos);
    if (this.raycaster.ray.distanceToPoint(dPos) < 0.22) {
      this.daughter.setExpression('delighted', 1.2);
      this.audio.playReactionHappy(0.65);
      // If already dressed, gently cycle hat tilt angle for fun!
      if (this.hatWorn) {
        this.daughter.wornHat.rotation.z = -0.14 + Math.sin(this.elapsed * 3) * 0.14;
      }
      return;
    }
    for (const p of this.passengers) {
      const hp = new THREE.Vector3();
      p.human.headPivot.getWorldPosition(hp);
      if (this.raycaster.ray.distanceToPoint(hp) < 0.22) {
        if (this.stage === 'freeplay') {
          // Tapping passengers in Free Play makes them smile/wave or toggle peaceful nap!
          p.human.setExpression('delighted', 1.4);
          this.audio.playReactionHappy(0.6);
        } else if (!p.isSleeping) {
          p.human.setExpression('smile', 1.0);
        }
        return;
      }
    }
  }

  _equipDressItem(item) {
    if (item === 'hat' && !this.hatWorn) {
      this.hatWorn = true;
      this.cartSys.dressHat.visible = false;
      this.daughter.wornHat.visible = true;
      this.daughter.setExpression('delighted', 1.5);
      this.audio.playFabricPutOn(1.1);
    } else if (item === 'scarf' && !this.scarfWorn) {
      this.scarfWorn = true;
      this.cartSys.dressScarf.visible = false;
      this.daughter.wornScarf.visible = true;
      this.daughter.setExpression('delighted', 1.5);
      this.audio.playFabricPutOn(1.25);
    }

    if (this.hatWorn && this.scarfWorn && this.stage === 'dressup') {
      this.stage = 'rollCart';
      this.audio.playCabinChime();
      this.daughter.setExpression('proud', 2.2);

      // Swap dress-up pad for the full Cabin Beverage & Culinary Service Station!
      setTimeout(() => {
        this.cartSys.dressTray.visible = false;
        this.cartSys.serviceStation.visible = true;
      }, 420);
    }
  }

  _completeRollCart() {
    if (this.stage !== 'rollCart') return;
    this.stage = 'serve1';
    this.cartSys.targetZ = 0.78;
    this.cabin.openAllTrays(true);
    this.audio.playPlasticPlace(0.9);
    this.daughter.setExpression('delighted', 1.4);

    // Reveal each passenger's pictorial thought bubble!
    this.passengers.forEach((p) => {
      p.bubbleTargetAlpha = 1.0;
    });
  }

  _disposeCupToBin(cup) {
    if (cup.group.parent) cup.group.parent.remove(cup.group);
    cup.isTippedSpillCup = false;
    this.audio.playPlasticPlace(1.4);
    this.daughter.setExpression('proud', 1.0);
  }

  _disposeItemFromCart(rec) {
    if (rec.group.parent) rec.group.parent.remove(rec.group);
    this.audio.playPlasticPlace(1.4);
    if (rec.itemCategory === 'drink') {
      this.cartSys.spawnFreshCup();
    } else {
      this.cartSys.spawnFreshMeal();
    }
  }

  _serveItemToPassenger(rec, pIdx, dropWorldPos) {
    const p = this.passengers[pIdx];
    const tray = this.cabin.trayTables[pIdx];
    tray.targetOpen = 1.0;

    // Attach item directly onto passenger's folding tray table at exact dropped X/Z spot (continuous placement!)
    const localTray = dropWorldPos.clone();
    tray.board.worldToLocal(localTray);
    const placedX = THREE.MathUtils.clamp(localTray.x, -0.13, 0.13);
    const placedZ = THREE.MathUtils.clamp(localTray.z, -0.07, 0.07);

    tray.board.add(rec.group);
    rec.group.position.set(
      placedX + (p.servedItems.length % 2 === 1 && Math.abs(placedX) < 0.04 ? 0.075 : 0),
      rec.itemCategory === 'drink' ? 0.058 : 0.022,
      placedZ
    );
    rec.group.rotation.set(0, 0, 0);
    rec.served = true;
    rec.ownerPassenger = p;
    p.servedItems.push(rec);
    this.audio.playPlasticPlace(1.05);

    // Spawn a fresh replacement cup or meal on the cart so player never runs out!
    if (rec.itemCategory === 'drink') {
      this.cartSys.spawnFreshCup();
    } else {
      rec.targetLidPeeled = 1.0;
      this.cartSys.spawnFreshMeal();
    }

    // Check if served item matches passenger's thought bubble OR triggers cute "あれ？ -> 喜ぶ" reaction!
    const matchesDesire =
      (p.desiredKind === 'meal' && rec.itemCategory === 'meal') ||
      (p.desiredKind !== 'meal' && rec.itemCategory === 'drink' && rec.dominantKind === p.desiredKind);

    if (matchesDesire || this.stage === 'freeplay') {
      p.bubbleTargetAlpha = 0.0;
      p.human.setExpression('delighted', 2.4);
      this.daughter.setExpression('delighted', 1.8);
      this.audio.playReactionHappy(1.0);
    } else {
      // Different item handed: "違う物を渡すと相手は「あれ？」の顔→喜ぶ" (Zero failure!)
      p.bubbleTargetAlpha = 0.0;
      p.human.setExpression('huh', 0.95);
      this.daughter.setExpression('oops', 0.85);
      this.audio.playReactionHuh();
      setTimeout(() => {
        p.human.setExpression('delighted', 2.4);
        this.daughter.setExpression('delighted', 1.8);
        this.audio.playReactionHappy(1.05);
      }, 900);
    }

    // Scene 2 Rescue Completion Check: If Dad had spilled and we wiped + served Dad a fresh drink!
    if (this.stage === 'spill2' && pIdx === 1 && rec.itemCategory === 'drink') {
      if (this.cartSys.getRemainingSpillWetness() < 0.18) {
        this._advanceToComfortScene3();
      }
      return;
    }

    // Scene 1 Completion Check: Once Mom, Dad, and Grandma each have at least 1 served item -> Trigger Dad's Spill!
    if (this.stage === 'serve1') {
      const allServed = this.passengers.every((pas) => pas.servedItems.length > 0);
      if (allServed) {
        this.stage = 'spillTransition';
        setTimeout(() => this._triggerDadSpillScene2(), 1550);
      }
    }
  }

  _passengerSipServedItem(cup) {
    const p = cup.ownerPassenger;
    if (!p) return;
    cup.fill = Math.max(0.06, cup.fill - 0.24);
    this.cartSys.updateCupVisuals(cup);
    p.human.setExpression('delighted', 1.5);
    this.daughter.setExpression('delighted', 1.2);
    this.audio.playReactionHappy(0.75);
  }

  _passengerTasteServedMeal(meal) {
    const p = meal.ownerPassenger;
    if (!p) return;
    meal.group.scale.multiplyScalar(0.92);
    if (meal.group.scale.x < 0.55) meal.group.scale.setScalar(1.0);
    p.human.setExpression('delighted', 1.5);
    this.daughter.setExpression('delighted', 1.2);
    this.audio.playReactionHappy(0.8);
  }

  // Scene 2: Dad accidentally bumps & spills his cup on his tray -> Daughter wipes & serves fresh drink!
  _triggerDadSpillScene2() {
    this.stage = 'spill2';
    const dad = this.passengers[1];
    const dadTray = this.cabin.trayTables[1];

    // Find a cup on Dad's tray (or create one if Dad received a meal first so he definitely spills juice!)
    let dadCup = dad.servedItems.find((it) => it.itemCategory === 'drink');
    if (!dadCup) {
      dadCup = this.cartSys.spawnFreshCup();
      dadCup.fill = 0.75;
      dadCup.mixWeights.juice = 1;
      this.cartSys.updateCupVisuals(dadCup);
      dadTray.board.add(dadCup.group);
      dadCup.group.position.set(0.08, 0.058, 0.0);
      dadCup.served = true;
      dad.servedItems.push(dadCup);
      this.cartSys.spawnFreshCup();
    }

    this.cartSys.createDadSpillOnTray(dadTray.board, dadCup);
    this.audio.playSpillOops();

    dad.human.setExpression('oops', 3.5);
    this.passengers[0].human.setExpression('huh', 1.8); // Mom looks over in surprise!
    this.daughter.setExpression('oops', 1.8);

    // Begin warm Golden Sunset transition as Scene 2 unfolds!
    this.targetTimeOfDay = 0.46;
  }

  _scrubSpillAt(worldPt, power = 0.2) {
    if (this.cartSys.spillPuddles.length === 0) return;
    const dadTray = this.cabin.trayTables[1].board;
    const localPt = worldPt.clone();
    dadTray.worldToLocal(localPt);

    let changed = false;
    for (const p of this.cartSys.spillPuddles) {
      if (p.wetness <= 0.01) continue;
      const dist = Math.hypot(localPt.x - p.mesh.position.x, localPt.z - p.mesh.position.z);
      if (dist < 0.14) {
        p.wetness = Math.max(0, p.wetness - power);
        changed = true;
        if (p.wetness <= 0.04) {
          p.wetness = 0;
          p.mesh.visible = false;
        } else {
          const s = 0.25 + p.wetness * 0.75;
          p.mesh.scale.set(p.baseRx * s, 1, p.baseRz * s);
          p.mesh.material.opacity = 0.25 + p.wetness * 0.65;
        }
      }
    }

    if (changed) {
      // Cloth absorbs a faint warm orange tint as it wipes up the juice!
      const rem = this.cartSys.getRemainingSpillWetness();
      this.cartSys.towelClothMat.color.lerpColors(new THREE.Color(0xfce3c5), new THREE.Color(0xfafcff), rem);

      if (rem < 0.12) {
        this.cartSys.clearSpillPuddles();
        // Auto-clear tipped empty cup if still lying there
        const dad = this.passengers[1];
        const tipped = dad.servedItems.find((it) => it.isTippedSpillCup);
        if (tipped) this._disposeCupToBin(tipped);

        // Dad smiles in relief and shows thought bubble for a fresh drink!
        dad.desiredKind = 'juice';
        dad.bubbleMat.map = this.mats.thoughtIcons.juice;
        dad.bubbleMat.needsUpdate = true;
        dad.bubbleTargetAlpha = 1.0;
        dad.human.setExpression('smile', 2.0);
        this.daughter.setExpression('proud', 1.6);
        this.audio.playReactionHappy(0.85);
      }
    }
  }

  _advanceToComfortScene3() {
    this.stage = 'comfort3';
    this.audio.playCabinChime();
    this.targetTimeOfDay = 0.62; // Sunset deepening toward twilight!

    // Slide open the Comfort Rack with Blankets & Pillows!
    this.cartSys.comfortDrawer.visible = true;

    // Show sleep comfort icons gently on passengers
    this.passengers.forEach((p) => {
      p.desiredKind = 'sleep';
      p.bubbleMat.map = this.mats.thoughtIcons.sleep;
      p.bubbleMat.needsUpdate = true;
      p.bubbleTargetAlpha = 1.0;
      p.human.setExpression('sleepy', 2.2);
    });
  }

  _findNearestPassenger(worldPos, maxDist = 0.65) {
    // If single-tapped on stack, pick first passenger without blanket/pillow yet!
    if (maxDist > 5.0) {
      const idx = this.passengers.findIndex((p) => !p.hasBlanket || !p.hasPillow);
      return idx !== -1 ? idx : 0;
    }
    let best = -1;
    let bestD = maxDist;
    for (let i = 0; i < 3; i++) {
      const tp = new THREE.Vector3();
      this.passengers[i].human.torsoPivot.getWorldPosition(tp);
      const d = worldPos.distanceTo(tp);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  _giveBlanketToPassenger(pIdx, styleIdx) {
    const p = this.passengers[pIdx];
    p.hasBlanket = true;
    p.blanketStyle = styleIdx;
    p.blanketMesh.material.map = this.mats.blanketTextures[styleIdx];
    p.blanketMesh.material.needsUpdate = true;
    p.blanketMesh.visible = true;
    this.audio.playFabricPutOn(0.92);
    this._updatePassengerSleepProgress(p);
  }

  _givePillowToPassenger(pIdx) {
    const p = this.passengers[pIdx];
    p.hasPillow = true;
    p.pillowMesh.visible = true;
    this.audio.playFabricPutOn(1.08);
    this._updatePassengerSleepProgress(p);
  }

  _updatePassengerSleepProgress(p) {
    // Advance sky seamlessly toward Starry Night & City Lights as passengers get cozy!
    const comfortCount = this.passengers.reduce((acc, pas) => acc + (pas.hasBlanket ? 1 : 0) + (pas.hasPillow ? 0.5 : 0), 0);
    this.targetTimeOfDay = Math.min(1.0, 0.55 + comfortCount * 0.14);

    if (p.hasBlanket) {
      p.isSleeping = true;
      p.bubbleTargetAlpha = 0.0;
      p.human.setExpression('sleep', 999);
      this.daughter.setExpression('delighted', 2.5); // Daughter watches sleeping passengers with warm にこにこ smile!
      this.audio.playCozySleepChime();
    } else {
      p.human.setExpression('delighted', 1.4);
    }

    // Check if all 3 passengers are cozily tucked in under the night city lights -> Trigger Landing & Applause!
    if (this.stage === 'comfort3' && !this.landingTriggered && this.passengers.every((pas) => pas.hasBlanket)) {
      this.landingTriggered = true;
      this.targetTimeOfDay = 1.0;
      setTimeout(() => this._triggerLandingApplauseAndFreePlay(), 2800);
    }
  }

  _triggerLandingApplauseAndFreePlay() {
    this.touchdownShake = 1.0;
    this.cabin.landingRunwayIntensity = 0.95;
    this.audio.playTouchdownAndApplause();

    // Passengers wake refreshed and applaud joyfully; Daughter claps & bows!
    this.passengers.forEach((p) => {
      p.isSleeping = false;
      p.human.setExpression('clap', 4.2);
    });
    this.daughter.setExpression('clap', 4.2);

    setTimeout(() => {
      this.stage = 'freeplay';
      this.cabin.landingRunwayIntensity = 0.25;
      this.passengers.forEach((p) => p.human.setExpression('smile'));
      this.daughter.setExpression('delighted', 2.0);
    }, 4300);
  }

  _updatePouringSimulation(dt) {
    if (!this.dragAction || this.dragAction.kind !== 'pourPitcher') return;
    const pitcher = this.dragAction.pitcher;
    const cup = this.cartSys.activeCup;
    if (!cup) return;

    // Position & tilt pitcher naturally above the active cup on the cart!
    const cupPos = cup.group.position;
    pitcher.group.position.lerp(new THREE.Vector3(cupPos.x + 0.065, cupPos.y + 0.135, cupPos.z - 0.015), Math.min(1, dt * 12));
    pitcher.group.rotation.z += (1.02 - pitcher.group.rotation.z) * Math.min(1, dt * 10);

    // Continuous fill rate: ~0.58 per second (hold duration directly determines volume!)
    const deltaFill = dt * 0.58;
    cup.fill = Math.min(1.22, cup.fill + deltaFill);
    cup.mixWeights[pitcher.kind] += deltaFill;
    this.cartSys.updateCupVisuals(cup);
    this.audio.updatePouring(cup.fill);

    // Position 3D translucent liquid stream from pitcher spout into cup!
    const cupWorld = new THREE.Vector3();
    cup.group.getWorldPosition(cupWorld);
    const spoutWorld = cupWorld.clone().add(new THREE.Vector3(0.015, 0.115, 0));
    const surfaceWorld = cupWorld.clone().add(new THREE.Vector3(0, -0.04 + Math.min(1.0, cup.fill) * 0.082, 0));

    const streamLen = Math.max(0.03, spoutWorld.y - surfaceWorld.y);
    this.cartSys.pourStream.visible = true;
    this.cartSys.pourStream.scale.set(1, streamLen, 1);
    this.cartSys.pourStream.position.set(
      (spoutWorld.x + surfaceWorld.x) * 0.5,
      surfaceWorld.y + streamLen * 0.5,
      (spoutWorld.z + surfaceWorld.z) * 0.5
    );
    this.cartSys.pourStreamMat.color.copy(cup.liquidMat.color);

    // Fun splashing overflow droplets if held past 100% full!
    if (cup.fill > 1.02 && Math.random() < dt * 18) {
      this.cartSys.emitOverflowDrop(surfaceWorld, cup.liquidMat.color);
      this.daughter.setExpression('oops', 0.45);
    }
  }

  _updateMealWarmingSimulation(dt) {
    if (!this.dragAction || this.dragAction.kind !== 'warmMeal') return;
    const meal = this.cartSys.activeMeal;
    if (!meal) return;

    meal.bakeLevel = Math.min(1.0, meal.bakeLevel + dt * 0.42);
    meal.dynMeal.draw(meal.bakeLevel);
    this.cartSys.warmerPadMat.emissiveIntensity = 1.35;

    this.dragAction.sizzleTimer -= dt;
    if (this.dragAction.sizzleTimer <= 0) {
      this.dragAction.sizzleTimer = 0.22;
      this.audio.playWarmerSizzle();
      const wp = new THREE.Vector3();
      meal.group.getWorldPosition(wp);
      this.cartSys.emitSteam(wp);
    }
  }

  _updatePlayerHandAndIdleDemo(dt) {
    // Only after Dress-Up (or during idle demo) does finger become Daughter's cabin-crew hand!
    const dressed = this.hatWorn && this.scarfWorn;

    if (!this.isPointerDown) {
      this.idleSeconds += dt;
      // Wordless rule: 0-10s do NOTHING; after 10.5s idle, show 1 gentle hand gesture once per stage!
      if (this.idleSeconds > 10.5 && this.idleDemoShownForStage !== this.stage && !this.demoAnim) {
        this.idleDemoShownForStage = this.stage;
        this.demoAnim = { t: 0, dur: 1.8 };
      }
    }

    if (this.demoAnim) {
      this.demoAnim.t += dt;
      const p = this.demoAnim.t / this.demoAnim.dur;
      if (p >= 1.0) {
        this.demoAnim = null;
        this.playerHand.visible = false;
      } else {
        this.playerHand.visible = true;
        let from = new THREE.Vector3(0.0, 0.92, 1.2);
        let to = new THREE.Vector3(0.42, 0.96, 0.98);
        if (this.stage === 'rollCart') {
          from.set(-0.02, 0.85, 1.52);
          to.set(-0.02, 0.85, 1.12);
        } else if (this.stage === 'serve1') {
          from.set(-0.12, 0.92, 0.62);
          to.set(-0.05, 0.92, 0.90);
        } else if (this.stage === 'spill2') {
          from.set(-0.52, 0.74, 0.16);
          to.set(-0.38, 0.74, 0.16);
        } else if (this.stage === 'comfort3') {
          from.set(0.0, 0.62, 0.98);
          to.set(-0.46, 0.78, 0.05);
        }
        this.playerHand.position.lerpVectors(from, to, THREE.MathUtils.smoothstep(p, 0.1, 0.9));
        this.playerHand.rotation.set(-0.25, 0.1, 0);
      }
      return;
    }

    if (dressed && this.isPointerDown) {
      this.playerHand.visible = true;
      const targetHand = this.pointerWorld.clone().add(new THREE.Vector3(0.03, 0.055, 0.09));
      this.playerHand.position.lerp(targetHand, Math.min(1, dt * 22));
      this.playerHand.rotation.set(-0.32, -0.15, this.dragAction?.kind === 'wipeSpill' ? Math.sin(this.elapsed * 18) * 0.25 : 0);
    } else {
      this.playerHand.visible = false;
    }
  }

  _tick() {
    const dt = Math.min(0.05, this.clock.getDelta());
    this.elapsed += dt;

    // Smooth Time-of-Day progression
    this.cabin.timeOfDay += (this.targetTimeOfDay - this.cabin.timeOfDay) * Math.min(1, dt * 0.65);
    this.postfx.material.uniforms.uWarmth.value = Math.sin(this.cabin.timeOfDay * Math.PI);

    if (!this.dragAction || this.dragAction.kind !== 'warmMeal') {
      this.cartSys.warmerPadMat.emissiveIntensity += (0.35 - this.cartSys.warmerPadMat.emissiveIntensity) * Math.min(1, dt * 5);
    }

    this._updatePouringSimulation(dt);
    this._updateMealWarmingSimulation(dt);
    this._updatePlayerHandAndIdleDemo(dt);

    // Update Cabin, Cart, Daughter, and Passengers
    this.cabin.update(dt, this.elapsed);
    this.cartSys.update(dt, this.elapsed);
    this.daughter.update(dt, this.elapsed);

    for (const p of this.passengers) {
      p.human.update(dt, this.elapsed);
      p.bubbleMat.opacity += (p.bubbleTargetAlpha - p.bubbleMat.opacity) * Math.min(1, dt * 6.0);
      p.bubble.position.y = 1.36 + Math.sin(this.elapsed * 2.4 + p.idx) * 0.018;
      p.bubble.visible = p.bubbleMat.opacity > 0.02;
    }

    // Subtle organic aircraft cabin flight sway + gentle cushioned touchdown thump
    if (this.touchdownShake > 0.001) {
      this.touchdownShake = Math.max(0, this.touchdownShake - dt * 1.6);
    }
    const shakeY = Math.sin(this.elapsed * 32.0) * 0.024 * this.touchdownShake;
    const cabinSwayX = Math.sin(this.elapsed * 0.65) * 0.003;
    const cabinSwayY = Math.cos(this.elapsed * 0.85) * 0.0025 + shakeY;

    this.camera.position.set(
      this.baseCamPos.x + cabinSwayX,
      this.baseCamPos.y + cabinSwayY,
      this.baseCamPos.z
    );
    this.camera.lookAt(this.baseCamLook.x, this.baseCamLook.y + shakeY * 0.5, this.baseCamLook.z);

    this.postfx.render(this.scene, this.camera);
  }
}

const app = new CabinCrewApp();
window.__cabinApp = app;
