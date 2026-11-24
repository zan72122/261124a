// Hero Brushed-Aluminum & Navy Aircraft Galley Cart + PBR Interactive Props
// Strong Material Contrast: Anisotropic-look Brushed Aluminum Cart vs Clear Glossy Polycarbonate Cups/Pitchers
// vs Satin ABS Melamine Trays vs Woven Quilted Blankets & Foil Lids.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createCrewHatMesh, createCrewScarfMesh } from './characters.js';
import { createDynamicMealTexture } from './textures.js';

export class GalleyCartSystem {
  constructor(scene, mats) {
    this.scene = scene;
    this.mats = mats;

    this.cartGroup = new THREE.Group();
    // Starts forward in the aisle at z = 1.24 for Dress-Up & Roll-In; rolls to z = 0.78 for Cabin Service!
    this.cartGroup.position.set(-0.03, 0.0, 1.22);
    this.cartGroup.rotation.y = -0.14;
    this.scene.add(this.cartGroup);

    this.targetZ = 1.22;
    this.wheels = [];
    this.pitchers = [];
    this.activeCup = null;
    this.activeMeal = null;
    this.servedProps = [];
    this.spillPuddles = [];
    this.steamParticles = [];
    this.overflowDrops = [];

    this._initMaterials();
    this._buildCartBody();
    this._buildDressUpItems();
    this._buildServiceTopItems();
    this._buildComfortRack();
    this._buildPourStreamAndParticles();
  }

  _initMaterials() {
    const m = this.mats;

    // Hero Brushed Aluminum (high metalness, crisp specular contrast vs matte plastic!)
    this.brushedMetalMat = new THREE.MeshPhysicalMaterial({
      map: m.brushedAlbedo,
      roughnessMap: m.brushedRough,
      normalMap: m.brushedNormal,
      normalScale: new THREE.Vector2(0.55, 0.55),
      color: 0xf4f8ff,
      metalness: 0.94,
      roughness: 0.19,
      clearcoat: 0.18,
      clearcoatRoughness: 0.22
    });

    // Mirror-polished chrome for push handle & corner extrusions
    this.chromeMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.98,
      roughness: 0.06
    });

    // Anodized Deep Airline Navy cart door/side insert
    this.cartNavyMat = new THREE.MeshPhysicalMaterial({
      color: 0x132548,
      normalMap: m.plasticNormal,
      normalScale: new THREE.Vector2(0.2, 0.2),
      roughness: 0.32,
      metalness: 0.22,
      clearcoat: 0.55,
      clearcoatRoughness: 0.20
    });

    // Heavy-duty dark grey elastomer corner bumpers & non-slip top mat
    this.bumperMat = new THREE.MeshStandardMaterial({
      color: 0x1c222d,
      normalMap: m.plasticNormal,
      normalScale: new THREE.Vector2(0.45, 0.45),
      roughness: 0.78,
      metalness: 0.04
    });

    // Crystal-Clear Injection-Molded Polycarbonate Plastic (ultra-clean rim shine without milky haze!)
    this.clearPlasticMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.04,
      metalness: 0.0,
      transparent: true,
      opacity: 0.17,
      clearcoat: 1.0,
      clearcoatRoughness: 0.02,
      reflectivity: 1.0,
      side: THREE.FrontSide,
      depthWrite: false
    });

    // Satin White Melamine / ABS Dish Plastic
    this.dishPlasticMat = new THREE.MeshPhysicalMaterial({
      color: 0xf8f9fc,
      normalMap: m.plasticNormal,
      normalScale: new THREE.Vector2(0.15, 0.15),
      roughness: 0.25,
      metalness: 0.0,
      clearcoat: 0.65,
      clearcoatRoughness: 0.18
    });
  }

  _buildCartBody() {
    // Main Aluminum Galley Trolley Cabinet (width 0.42m, height 0.72m, depth 0.66m)
    const body = new THREE.Mesh(
      new RoundedBoxGeometry(0.42, 0.64, 0.66, 4, 0.022),
      this.brushedMetalMat
    );
    body.position.y = 0.40;
    body.castShadow = true;
    body.receiveShadow = true;
    this.cartGroup.add(body);

    // Deep Navy Airline Side & Front Door Panels recessed into aluminum frame
    [-0.212, 0.212].forEach((sx) => {
      const sidePanel = new THREE.Mesh(
        new RoundedBoxGeometry(0.012, 0.52, 0.56, 2, 0.004),
        this.cartNavyMat
      );
      sidePanel.position.set(sx, 0.40, 0);
      this.cartGroup.add(sidePanel);

      // Sleek silver horizontal accent trim strip on navy panel
      const trim = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.018, 0.54), this.chromeMat);
      trim.position.set(sx, 0.54, 0);
      this.cartGroup.add(trim);
    });

    // Rear door panel facing camera (+Z) with sculpted navy upper & lower doors, stainless divider, and rotary slam-latch!
    const upperRearDoor = new THREE.Mesh(
      new RoundedBoxGeometry(0.34, 0.22, 0.014, 2, 0.005),
      this.cartNavyMat
    );
    upperRearDoor.position.set(0, 0.56, 0.33);
    this.cartGroup.add(upperRearDoor);

    const rearDoor = new THREE.Mesh(
      new RoundedBoxGeometry(0.34, 0.26, 0.014, 2, 0.005),
      this.cartNavyMat
    );
    rearDoor.position.set(0, 0.25, 0.33);
    this.cartGroup.add(rearDoor);

    // Chrome vertical edge extrusions on cart corners (catches crisp vertical specular highlights!)
    [-0.206, 0.206].forEach((cx) => {
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.62, 12), this.chromeMat);
      rail.position.set(cx, 0.41, 0.326);
      this.cartGroup.add(rail);
    });

    const latchPlate = new THREE.Mesh(
      new RoundedBoxGeometry(0.11, 0.065, 0.024, 2, 0.006),
      this.chromeMat
    );
    latchPlate.position.set(0, 0.42, 0.338);
    this.cartGroup.add(latchPlate);

    // Molded Rubber Corner Bumpers (bottom & top corners)
    [-0.205, 0.205].forEach((bx) => {
      [-0.325, 0.325].forEach((bz) => {
        const bBot = new THREE.Mesh(new RoundedBoxGeometry(0.048, 0.055, 0.048, 2, 0.012), this.bumperMat);
        bBot.position.set(bx, 0.095, bz);
        this.cartGroup.add(bBot);
      });
    });

    // Raised Brushed-Aluminum Top Rim Gallery + Non-Slip Preparation Mat
    const topRim = new THREE.Mesh(
      new RoundedBoxGeometry(0.44, 0.042, 0.68, 4, 0.012),
      this.brushedMetalMat
    );
    topRim.position.y = 0.73;
    topRim.castShadow = true;
    topRim.receiveShadow = true;
    this.cartGroup.add(topRim);

    const topMat = new THREE.Mesh(
      new RoundedBoxGeometry(0.39, 0.012, 0.62, 3, 0.005),
      new THREE.MeshStandardMaterial({
        color: 0x222c3c,
        normalMap: this.mats.plasticNormal,
        normalScale: new THREE.Vector2(0.5, 0.5),
        roughness: 0.72,
        metalness: 0.05
      })
    );
    topMat.position.y = 0.752;
    topMat.receiveShadow = true;
    this.cartGroup.add(topMat);
    this.cartTopY = 0.758;

    // Chrome tubular gallery rails around cart top edge
    [-0.205, 0.205].forEach((rx) => {
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.62, 10), this.chromeMat);
      rail.rotation.x = Math.PI / 2;
      rail.position.set(rx, 0.782, 0);
      this.cartGroup.add(rail);
    });

    // Gleaming Push-Handle Bar on +Z (Camera/Crew side) — Large easy-to-grab target!
    this.handleGroup = new THREE.Group();
    this.handleGroup.position.set(0, 0.80, 0.375);
    this.cartGroup.add(this.handleGroup);

    const handleBar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.016, 0.38, 16),
      this.chromeMat
    );
    handleBar.rotation.z = Math.PI / 2;
    handleBar.castShadow = true;
    this.handleGroup.add(handleBar);

    [-0.17, 0.17].forEach((hx) => {
      const bracket = new THREE.Mesh(
        new RoundedBoxGeometry(0.024, 0.045, 0.085, 2, 0.008),
        this.brushedMetalMat
      );
      bracket.position.set(hx, -0.025, -0.038);
      this.handleGroup.add(bracket);
    });

    // Invisible generous touch hit-box for pushing/pulling cart handle
    const handleHit = new THREE.Mesh(
      new THREE.BoxGeometry(0.48, 0.18, 0.20),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    handleHit.userData.interactiveType = 'cartHandle';
    this.handleGroup.add(handleHit);

    // Side Clip-On Cabin Waste Chute Bin ("ゴミ箱に入れる→消える")
    this.wasteBinGroup = new THREE.Group();
    this.wasteBinGroup.position.set(-0.245, 0.56, 0.16);
    this.cartGroup.add(this.wasteBinGroup);

    const binOuter = new THREE.Mesh(
      new RoundedBoxGeometry(0.095, 0.20, 0.18, 3, 0.015),
      this.brushedMetalMat
    );
    this.wasteBinGroup.add(binOuter);

    const binHole = new THREE.Mesh(
      new THREE.PlaneGeometry(0.072, 0.145),
      new THREE.MeshBasicMaterial({ color: 0x0a0e17 })
    );
    binHole.rotation.x = -Math.PI / 2;
    binHole.position.y = 0.101;
    this.wasteBinGroup.add(binHole);

    const binHit = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.26, 0.24),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    binHit.userData.interactiveType = 'wasteBin';
    this.wasteBinGroup.add(binHit);

    // 4 Dual-Wheel Swivel Casters + Red/Green Brake Pedals
    const wheelGeo = new THREE.CylinderGeometry(0.038, 0.038, 0.028, 16);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1b2029, roughness: 0.72 });
    const hubGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.031, 12);
    [-0.16, 0.16].forEach((wx) => {
      [-0.26, 0.26].forEach((wz) => {
        const wGroup = new THREE.Group();
        wGroup.position.set(wx, 0.038, wz);
        const w = new THREE.Mesh(wheelGeo, wheelMat);
        w.rotation.z = Math.PI / 2;
        wGroup.add(w);
        const hub = new THREE.Mesh(hubGeo, this.chromeMat);
        hub.rotation.z = Math.PI / 2;
        wGroup.add(hub);
        this.wheels.push(wGroup);
        this.cartGroup.add(wGroup);
      });
    });

    // Red & Green foot brake pedals at rear base
    const redPedal = new THREE.Mesh(
      new RoundedBoxGeometry(0.055, 0.014, 0.045, 2, 0.004),
      new THREE.MeshStandardMaterial({ color: 0xc93838, roughness: 0.4 })
    );
    redPedal.position.set(-0.08, 0.065, 0.34);
    this.cartGroup.add(redPedal);

    const greenPedal = new THREE.Mesh(
      new RoundedBoxGeometry(0.055, 0.014, 0.045, 2, 0.004),
      new THREE.MeshStandardMaterial({ color: 0x359c5c, roughness: 0.4 })
    );
    greenPedal.position.set(0.08, 0.065, 0.34);
    this.cartGroup.add(greenPedal);
  }

  _buildDressUpItems() {
    // Velvet-lined presentation tray on top of cart holding Daughter's Hat & Silk Scarf at game start!
    this.dressTray = new THREE.Group();
    this.dressTray.position.set(0, this.cartTopY + 0.008, 0.02);
    this.cartGroup.add(this.dressTray);

    const pad = new THREE.Mesh(
      new RoundedBoxGeometry(0.36, 0.022, 0.46, 3, 0.01),
      this.dishPlasticMat
    );
    pad.receiveShadow = true;
    this.dressTray.add(pad);

    // 1. Wearable Navy Garrison Hat
    this.dressHat = createCrewHatMesh(this.mats);
    this.dressHat.scale.setScalar(1.08);
    this.dressHat.position.set(-0.02, 0.065, -0.09);
    this.dressHat.rotation.y = 0.25;
    this.dressHat.userData.homePos = this.dressHat.position.clone();
    const hatHit = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 10, 10),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hatHit.userData.interactiveType = 'dressHat';
    this.dressHat.add(hatHit);
    this.dressTray.add(this.dressHat);

    // 2. Wearable Silk Cabin Scarf
    this.dressScarf = createCrewScarfMesh(this.mats);
    this.dressScarf.scale.setScalar(1.35);
    this.dressScarf.position.set(0.01, 0.042, 0.12);
    this.dressScarf.rotation.x = 0.22;
    this.dressScarf.userData.homePos = this.dressScarf.position.clone();
    const scarfHit = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 10, 10),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    scarfHit.userData.interactiveType = 'dressScarf';
    this.dressScarf.add(scarfHit);
    this.dressTray.add(this.dressScarf);
  }

  _buildServiceTopItems() {
    // Service Top Station (hidden during 3-second Dress-Up, pops smoothly onto cart once uniform is worn!)
    this.serviceStation = new THREE.Group();
    this.serviceStation.position.set(0, this.cartTopY, 0);
    this.serviceStation.visible = false;
    this.cartGroup.add(this.serviceStation);

    // 3 Beverage Pitchers at back/left row of cart top:
    // [0] Orange Juice Clear Carafe, [1] Brushed Steel Warm Green Tea Pot, [2] Clear Ruby Berry-Apple Carafe
    const pitcherSpecs = [
      { kind: 'juice', x: -0.115, z: -0.20, liquidHex: 0xff7700, emissiveHex: 0x662400, clear: true, hot: false },
      { kind: 'tea', x: 0.0, z: -0.21, liquidHex: 0x5c8f22, emissiveHex: 0x1c2e08, clear: false, hot: true },
      { kind: 'berry', x: 0.115, z: -0.20, liquidHex: 0xd41c4e, emissiveHex: 0x52081c, clear: true, hot: false }
    ];

    pitcherSpecs.forEach((spec) => {
      const pg = new THREE.Group();
      pg.position.set(spec.x, 0.085, spec.z);

      if (spec.clear) {
        // Clear glossy polycarbonate carafe + vibrant jewel-toned translucent juice inside + lid + handle
        const outer = new THREE.Mesh(
          new THREE.CylinderGeometry(0.044, 0.050, 0.165, 20, 1, true),
          this.clearPlasticMat
        );
        outer.renderOrder = 2;
        pg.add(outer);

        const rimRing = new THREE.Mesh(
          new THREE.TorusGeometry(0.044, 0.0022, 8, 20),
          new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, transparent: true, opacity: 0.55, clearcoat: 1.0 })
        );
        rimRing.rotation.x = Math.PI / 2;
        rimRing.position.y = 0.072;
        pg.add(rimRing);

        const liquidMat = new THREE.MeshPhysicalMaterial({
          color: spec.liquidHex,
          emissive: new THREE.Color(spec.emissiveHex),
          emissiveIntensity: 0.42,
          roughness: 0.05,
          transparent: true,
          opacity: 0.94,
          clearcoat: 1.0,
          clearcoatRoughness: 0.02
        });
        const liq = new THREE.Mesh(new THREE.CylinderGeometry(0.041, 0.046, 0.125, 18), liquidMat);
        liq.position.y = -0.015;
        pg.add(liq);

        // Floating ice cubes inside clear juice pitcher!
        const iceMat = new THREE.MeshPhysicalMaterial({
          color: 0xffffff,
          roughness: 0.08,
          transparent: true,
          opacity: 0.72,
          clearcoat: 1.0
        });
        for (let ic = 0; ic < 3; ic++) {
          const cube = new THREE.Mesh(new RoundedBoxGeometry(0.018, 0.018, 0.018, 2, 0.004), iceMat);
          cube.position.set((ic - 1) * 0.014, 0.038, (ic % 2 === 0 ? 0.01 : -0.01));
          cube.rotation.set(ic * 0.4, ic * 0.7, 0.2);
          pg.add(cube);
        }

        const lid = new THREE.Mesh(
          new THREE.CylinderGeometry(0.046, 0.046, 0.016, 18),
          this.cartNavyMat
        );
        lid.position.y = 0.084;
        pg.add(lid);
      } else {
        // Brushed Stainless-Steel Insulated Tea Carafe with olive color-band & pouring spout!
        const steelBody = new THREE.Mesh(
          new THREE.CylinderGeometry(0.042, 0.052, 0.17, 22),
          this.brushedMetalMat
        );
        steelBody.castShadow = true;
        pg.add(steelBody);

        const band = new THREE.Mesh(
          new THREE.CylinderGeometry(0.044, 0.045, 0.022, 22),
          new THREE.MeshStandardMaterial({ color: 0x6f993e, roughness: 0.35 })
        );
        band.position.y = 0.045;
        pg.add(band);

        const spout = new THREE.Mesh(
          new THREE.ConeGeometry(0.016, 0.042, 12),
          this.chromeMat
        );
        spout.position.set(0, 0.072, -0.042);
        spout.rotation.x = -0.65;
        pg.add(spout);
      }

      // Ergonomic side handle
      const handle = new THREE.Mesh(
        new THREE.TorusGeometry(0.036, 0.007, 8, 16, Math.PI),
        this.bumperMat
      );
      handle.rotation.y = Math.PI / 2;
      handle.rotation.z = -Math.PI / 2;
      handle.position.set(0, 0.01, 0.046);
      pg.add(handle);

      const hit = new THREE.Mesh(
        new THREE.CylinderGeometry(0.068, 0.068, 0.22, 10),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      const pitcherObj = {
        kind: spec.kind,
        liquidColor: new THREE.Color(spec.liquidHex),
        hot: spec.hot,
        group: pg,
        homePos: pg.position.clone()
      };
      hit.userData.interactiveType = 'pitcher';
      hit.userData.pitcher = pitcherObj;
      pg.add(hit);

      this.pitchers.push(pitcherObj);
      this.serviceStation.add(pg);
    });

    // Ice Cube Bowl & Fruit Garnish Bowl on right side of cart!
    this.iceBowlGroup = new THREE.Group();
    this.iceBowlGroup.position.set(-0.125, 0.028, -0.02);
    const bowlMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.048, 0.036, 0.045, 18),
      this.brushedMetalMat
    );
    this.iceBowlGroup.add(bowlMesh);
    const iceMat = new THREE.MeshPhysicalMaterial({ color: 0xeef8ff, roughness: 0.06, transparent: true, opacity: 0.78, clearcoat: 1.0 });
    for (let i = 0; i < 5; i++) {
      const ic = new THREE.Mesh(new RoundedBoxGeometry(0.02, 0.02, 0.02, 2, 0.004), iceMat);
      ic.position.set(Math.cos(i * 1.3) * 0.018, 0.022 + (i % 2) * 0.008, Math.sin(i * 1.3) * 0.018);
      ic.rotation.set(i * 0.5, i * 0.8, 0.2);
      this.iceBowlGroup.add(ic);
    }
    const iceHit = new THREE.Mesh(new THREE.SphereGeometry(0.068, 8, 8), new THREE.MeshBasicMaterial({ visible: false }));
    iceHit.userData.interactiveType = 'iceBowl';
    this.iceBowlGroup.add(iceHit);
    this.serviceStation.add(this.iceBowlGroup);

    // Fruit / Strawberry Garnish Dish
    this.garnishGroup = new THREE.Group();
    this.garnishGroup.position.set(0.125, 0.026, -0.02);
    const gBowl = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.036, 0.038, 18), this.dishPlasticMat);
    this.garnishGroup.add(gBowl);
    const berryMat = new THREE.MeshPhysicalMaterial({ color: 0xd92b48, roughness: 0.22, clearcoat: 0.8 });
    const sliceMat = new THREE.MeshStandardMaterial({ color: 0xf79622, roughness: 0.35 });
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.024, 10), berryMat);
      b.rotation.x = Math.PI;
      b.position.set(-0.015 + i * 0.015, 0.024, -0.008);
      this.garnishGroup.add(b);
      const sl = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.005, 12), sliceMat);
      sl.position.set(-0.012 + i * 0.014, 0.022, 0.014);
      sl.rotation.x = 0.4;
      this.garnishGroup.add(sl);
    }
    const garnishHit = new THREE.Mesh(new THREE.SphereGeometry(0.068, 8, 8), new THREE.MeshBasicMaterial({ visible: false }));
    garnishHit.userData.interactiveType = 'garnishDish';
    this.garnishGroup.add(garnishHit);
    this.serviceStation.add(this.garnishGroup);

    // Glowing Amber Warmer Pad for Hot Meal Dish (hold to bake gratin continuously!)
    this.warmerPadMat = new THREE.MeshStandardMaterial({
      color: 0x3b2622,
      emissive: new THREE.Color(0xff6a1a),
      emissiveIntensity: 0.35,
      roughness: 0.4,
      metalness: 0.4
    });
    const warmerPad = new THREE.Mesh(
      new RoundedBoxGeometry(0.175, 0.014, 0.135, 3, 0.006),
      this.warmerPadMat
    );
    warmerPad.position.set(0.085, 0.008, 0.155);
    warmerPad.userData.interactiveType = 'warmerPad';
    this.serviceStation.add(warmerPad);

    // Warmer heat toggle/hold button next to pad
    this.warmerBtnMat = new THREE.MeshStandardMaterial({
      color: 0xff7b29,
      emissive: new THREE.Color(0xff5500),
      emissiveIntensity: 0.6,
      roughness: 0.25
    });
    const warmerBtn = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.024, 0.018, 16), this.warmerBtnMat);
    warmerBtn.position.set(0.168, 0.016, 0.245);
    const warmerHit = new THREE.Mesh(new THREE.SphereGeometry(0.052, 8, 8), new THREE.MeshBasicMaterial({ visible: false }));
    warmerHit.userData.interactiveType = 'warmerPad';
    warmerBtn.add(warmerHit);
    this.serviceStation.add(warmerBtn);

    // Clean White Cabin Cloth Towel Stack (pops forward prominently when Dad spills juice in Scene 2, also usable anytime!)
    this.towelStackGroup = new THREE.Group();
    this.towelStackGroup.position.set(-0.135, 0.024, 0.235);
    this.towelClothMat = new THREE.MeshPhysicalMaterial({
      color: 0xfafcff,
      normalMap: this.mats.fabricNormal,
      normalScale: new THREE.Vector2(0.45, 0.45),
      roughness: 0.85,
      sheen: 0.4
    });
    for (let i = 0; i < 3; i++) {
      const tMesh = new THREE.Mesh(
        new RoundedBoxGeometry(0.095, 0.014, 0.085, 3, 0.005),
        i === 2 ? this.towelClothMat : this.towelClothMat.clone()
      );
      tMesh.position.y = i * 0.013;
      tMesh.rotation.y = (i - 1) * 0.05;
      this.towelStackGroup.add(tMesh);
      if (i === 2) this.draggableTowel = tMesh;
    }
    const towelHit = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 8), new THREE.MeshBasicMaterial({ visible: false }));
    towelHit.userData.interactiveType = 'wipeCloth';
    this.towelStackGroup.add(towelHit);
    this.serviceStation.add(this.towelStackGroup);

    // Spawn initial Active Clear Cup & Active Hot Meal Dish on the preparation mat!
    this.spawnFreshCup();
    this.spawnFreshMeal();
  }

  spawnFreshCup() {
    const cupGroup = new THREE.Group();
    cupGroup.position.set(-0.045, 0.052, 0.125);

    // Glossy Clear Plastic Airline Tumbler Cup
    const cupShell = new THREE.Mesh(
      new THREE.CylinderGeometry(0.038, 0.029, 0.095, 22, 1, true),
      this.clearPlasticMat
    );
    cupShell.castShadow = true;
    cupGroup.add(cupShell);

    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(0.038, 0.0022, 8, 22),
      new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.08, transparent: true, opacity: 0.65, clearcoat: 1.0 })
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.0475;
    cupGroup.add(rim);

    const bottomDisc = new THREE.Mesh(
      new THREE.CircleGeometry(0.029, 20),
      this.clearPlasticMat
    );
    bottomDisc.rotation.x = -Math.PI / 2;
    bottomDisc.position.y = -0.047;
    cupGroup.add(bottomDisc);

    // Rising Dynamic 3D Liquid Volume inside Cup!
    const liquidMat = new THREE.MeshPhysicalMaterial({
      color: 0xff7700,
      emissive: new THREE.Color(0x5c2200),
      emissiveIntensity: 0.38,
      roughness: 0.04,
      metalness: 0.0,
      transparent: true,
      opacity: 0.95,
      clearcoat: 1.0,
      clearcoatRoughness: 0.02
    });
    cupShell.renderOrder = 2;
    const liquidMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0355, 0.0275, 0.086, 20),
      liquidMat
    );
    liquidMesh.visible = false;
    cupGroup.add(liquidMesh);

    // Glossy Meniscus Highlight Ring on top of liquid
    const meniscus = new THREE.Mesh(
      new THREE.RingGeometry(0.022, 0.034, 20),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.42, side: THREE.DoubleSide })
    );
    meniscus.rotation.x = -Math.PI / 2;
    meniscus.visible = false;
    cupGroup.add(meniscus);

    // Ice cubes & garnish slots inside cup
    const iceContainer = new THREE.Group();
    cupGroup.add(iceContainer);

    const garnishSlot = new THREE.Group();
    garnishSlot.position.set(0.035, 0.048, 0);
    cupGroup.add(garnishSlot);

    const hit = new THREE.Mesh(
      new THREE.CylinderGeometry(0.062, 0.055, 0.13, 10),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    const cupRecord = {
      itemCategory: 'drink',
      dominantKind: 'juice',
      mixWeights: { juice: 0, tea: 0, berry: 0 },
      fill: 0.0, // Continuous 0.0 .. 1.20!
      iceCount: 0,
      garnish: null, // null | 'orange' | 'berry'
      isHot: false,
      group: cupGroup,
      liquidMesh,
      liquidMat,
      meniscus,
      iceContainer,
      garnishSlot,
      homePos: cupGroup.position.clone(),
      served: false
    };
    hit.userData.interactiveType = 'cup';
    hit.userData.cup = cupRecord;
    cupGroup.add(hit);

    this.activeCup = cupRecord;
    this.serviceStation.add(cupGroup);
    return cupRecord;
  }

  updateCupVisuals(cup) {
    if (cup.fill <= 0.01) {
      cup.liquidMesh.visible = false;
      cup.meniscus.visible = false;
      return;
    }
    cup.liquidMesh.visible = true;
    cup.meniscus.visible = true;
    const clamped = Math.min(1.02, cup.fill);
    cup.liquidMesh.scale.set(0.84 + clamped * 0.16, clamped, 0.84 + clamped * 0.16);
    cup.liquidMesh.position.y = -0.046 + (0.086 * clamped) * 0.5;
    cup.meniscus.position.y = -0.046 + 0.086 * clamped + 0.001;
    const rScale = 0.80 + clamped * 0.22;
    cup.meniscus.scale.set(rScale, rScale, 1);
    cup.iceContainer.position.y = Math.max(-0.025, -0.040 + 0.078 * clamped);

    // Continuous RGB drink color blending!
    const tot = cup.mixWeights.juice + cup.mixWeights.tea + cup.mixWeights.berry;
    if (tot > 0.001) {
      const cJ = new THREE.Color(0xff7700);
      const cT = new THREE.Color(0x5c8f22);
      const cB = new THREE.Color(0xd41c4e);
      const mixed = new THREE.Color(0, 0, 0);
      mixed.r = (cJ.r * cup.mixWeights.juice + cT.r * cup.mixWeights.tea + cB.r * cup.mixWeights.berry) / tot;
      mixed.g = (cJ.g * cup.mixWeights.juice + cT.g * cup.mixWeights.tea + cB.g * cup.mixWeights.berry) / tot;
      mixed.b = (cJ.b * cup.mixWeights.juice + cT.b * cup.mixWeights.tea + cB.b * cup.mixWeights.berry) / tot;
      cup.liquidMat.color.copy(mixed);
      cup.liquidMat.emissive.copy(mixed).multiplyScalar(0.32);

      // Track dominant drink kind for passenger thought-bubble comparison
      if (cup.mixWeights.tea >= cup.mixWeights.juice && cup.mixWeights.tea >= cup.mixWeights.berry) {
        cup.dominantKind = 'tea';
      } else if (cup.mixWeights.berry > cup.mixWeights.juice) {
        cup.dominantKind = 'berry';
      } else {
        cup.dominantKind = 'juice';
      }
      cup.isHot = cup.dominantKind === 'tea' && cup.iceCount === 0;
    }
  }

  addIceToCup(cup) {
    if (!cup || cup.iceCount >= 5) return;
    cup.iceCount++;
    const iceMat = new THREE.MeshPhysicalMaterial({
      color: 0xf2fbff,
      roughness: 0.06,
      transparent: true,
      opacity: 0.78,
      clearcoat: 1.0
    });
    const ic = new THREE.Mesh(new RoundedBoxGeometry(0.015, 0.015, 0.015, 2, 0.003), iceMat);
    const angle = cup.iceCount * 2.1;
    ic.position.set(Math.cos(angle) * 0.012, (cup.iceCount % 2) * 0.005, Math.sin(angle) * 0.012);
    ic.rotation.set(angle, angle * 0.6, 0.3);
    cup.iceContainer.add(ic);
    cup.isHot = false;
  }

  addGarnishToCup(cup) {
    if (!cup) return;
    while (cup.garnishSlot.children.length) {
      cup.garnishSlot.remove(cup.garnishSlot.children[0]);
    }
    if (cup.garnish === 'orange') {
      cup.garnish = 'berry';
      const berry = new THREE.Mesh(
        new THREE.ConeGeometry(0.013, 0.022, 10),
        new THREE.MeshPhysicalMaterial({ color: 0xd92b48, roughness: 0.2, clearcoat: 0.85 })
      );
      berry.rotation.x = Math.PI * 0.85;
      cup.garnishSlot.add(berry);
    } else {
      cup.garnish = 'orange';
      const slice = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.018, 0.005, 14),
        new THREE.MeshStandardMaterial({ color: 0xf79622, roughness: 0.32 })
      );
      slice.rotation.z = Math.PI / 2 - 0.3;
      cup.garnishSlot.add(slice);
    }
  }

  spawnFreshMeal() {
    const mealGroup = new THREE.Group();
    mealGroup.position.set(0.085, 0.028, 0.155);

    // Airline Casserole Tray Base + White Porcelain/Melamine Dish + Mini Strawberry Cake Side!
    const miniTray = new THREE.Mesh(
      new RoundedBoxGeometry(0.165, 0.012, 0.125, 3, 0.006),
      this.cartNavyMat
    );
    miniTray.castShadow = true;
    mealGroup.add(miniTray);

    const dishRim = new THREE.Mesh(
      new RoundedBoxGeometry(0.108, 0.028, 0.092, 4, 0.012),
      this.dishPlasticMat
    );
    dishRim.position.set(-0.02, 0.016, 0);
    mealGroup.add(dishRim);

    const dynMeal = createDynamicMealTexture();
    const foodTop = new THREE.Mesh(
      new THREE.PlaneGeometry(0.092, 0.076),
      new THREE.MeshStandardMaterial({
        map: dynMeal.tex,
        roughness: 0.36
      })
    );
    foodTop.rotation.x = -Math.PI / 2;
    foodTop.position.set(-0.02, 0.0305, 0);
    mealGroup.add(foodTop);

    // 3D Broccoli florets & glazed carrot rounds on the gratin!
    const brocMat = new THREE.MeshStandardMaterial({ color: 0x3a8c42, roughness: 0.65 });
    [-0.048, -0.036].forEach((bx, bi) => {
      const br = new THREE.Mesh(new THREE.SphereGeometry(0.010, 8, 8), brocMat);
      br.position.set(bx, 0.034, -0.018 + bi * 0.016);
      mealGroup.add(br);
    });
    const carrot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.009, 0.009, 0.006, 10),
      new THREE.MeshStandardMaterial({ color: 0xea6428, roughness: 0.35 })
    );
    carrot.position.set(0.012, 0.033, -0.018);
    mealGroup.add(carrot);

    // Cute Mini Strawberry Shortcake Dessert Cup on right side of airline meal tray!
    const cakeBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.019, 0.024, 14),
      new THREE.MeshStandardMaterial({ color: 0xfff8eb, roughness: 0.65 })
    );
    cakeBase.position.set(0.052, 0.018, 0.01);
    mealGroup.add(cakeBase);

    const cream = new THREE.Mesh(
      new THREE.SphereGeometry(0.021, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 })
    );
    cream.position.set(0.052, 0.028, 0.01);
    mealGroup.add(cream);

    const strawberry = new THREE.Mesh(
      new THREE.ConeGeometry(0.010, 0.018, 10),
      new THREE.MeshPhysicalMaterial({ color: 0xd92644, roughness: 0.2, clearcoat: 0.85 })
    );
    strawberry.position.set(0.052, 0.042, 0.01);
    mealGroup.add(strawberry);

    // Brushed Aluminum Peelable Foil Lid covering the hot dish!
    const foilPivot = new THREE.Group();
    foilPivot.position.set(-0.072, 0.032, 0);
    const foilLid = new THREE.Mesh(
      new RoundedBoxGeometry(0.106, 0.003, 0.090, 2, 0.001),
      new THREE.MeshStandardMaterial({
        map: this.mats.brushedAlbedo,
        metalness: 0.94,
        roughness: 0.22
      })
    );
    foilLid.position.set(0.052, 0, 0);
    foilPivot.add(foilLid);
    mealGroup.add(foilPivot);

    const hit = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.08, 0.14),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    const mealRecord = {
      itemCategory: 'meal',
      dominantKind: 'meal',
      bakeLevel: 0.22, // Continuous 0.0 .. 1.0!
      lidPeeled: 0.0, // 0 = closed, 1 = peeled open
      targetLidPeeled: 0.0,
      dynMeal,
      foilPivot,
      group: mealGroup,
      homePos: mealGroup.position.clone(),
      served: false
    };
    hit.userData.interactiveType = 'mealDish';
    hit.userData.meal = mealRecord;
    mealGroup.add(hit);

    this.activeMeal = mealRecord;
    this.serviceStation.add(mealGroup);
    return mealRecord;
  }

  _buildComfortRack() {
    // Slide-out Lower/Front Comfort Drawer holding Quilted Blankets (3 styles) & Plump Pillows!
    this.comfortDrawer = new THREE.Group();
    this.comfortDrawer.position.set(0, 0.50, 0.24);
    this.comfortDrawer.visible = false;
    this.cartGroup.add(this.comfortDrawer);

    const shelfTray = new THREE.Mesh(
      new RoundedBoxGeometry(0.38, 0.025, 0.28, 3, 0.008),
      this.brushedMetalMat
    );
    this.comfortDrawer.add(shelfTray);

    // 3 Folded Blanket Stacks (0: Classic Navy, 1: Sky Tartan, 2: Warm Cream)
    this.blanketStacks = [];
    [-0.11, 0.0, 0.11].forEach((bx, styleIdx) => {
      const bMesh = new THREE.Mesh(
        new RoundedBoxGeometry(0.098, 0.055, 0.125, 4, 0.018),
        new THREE.MeshPhysicalMaterial({
          map: this.mats.blanketTextures[styleIdx],
          normalMap: this.mats.fabricNormal,
          normalScale: new THREE.Vector2(0.55, 0.55),
          roughness: 0.86,
          sheen: 0.5
        })
      );
      bMesh.position.set(bx, 0.042, 0.055);
      bMesh.castShadow = true;

      const hit = new THREE.Mesh(
        new THREE.BoxGeometry(0.115, 0.10, 0.15),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hit.userData.interactiveType = 'blanketStack';
      hit.userData.blanketStyle = styleIdx;
      bMesh.add(hit);

      this.blanketStacks.push(bMesh);
      this.comfortDrawer.add(bMesh);
    });

    // Plump White Cabin Pillows beside/above blankets
    this.pillowStack = new THREE.Mesh(
      new RoundedBoxGeometry(0.24, 0.075, 0.11, 4, 0.032),
      new THREE.MeshPhysicalMaterial({
        color: 0xfbfcfe,
        normalMap: this.mats.fabricNormal,
        normalScale: new THREE.Vector2(0.35, 0.35),
        roughness: 0.80,
        sheen: 0.4
      })
    );
    this.pillowStack.position.set(0, 0.055, -0.068);
    const pHit = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.12, 0.14),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    pHit.userData.interactiveType = 'pillowStack';
    this.pillowStack.add(pHit);
    this.comfortDrawer.add(this.pillowStack);
  }

  _buildPourStreamAndParticles() {
    // Translucent 3D Liquid Pour Stream Cylinder
    this.pourStreamMat = new THREE.MeshPhysicalMaterial({
      color: 0xf5921d,
      roughness: 0.05,
      transparent: true,
      opacity: 0.86,
      clearcoat: 1.0
    });
    this.pourStream = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0055, 0.0085, 1.0, 12),
      this.pourStreamMat
    );
    this.pourStream.visible = false;
    this.scene.add(this.pourStream);

    // Gentle rising steam puffs (for hot tea & baked gratin!)
    const steamGeo = new THREE.SphereGeometry(0.016, 8, 8);
    for (let i = 0; i < 12; i++) {
      const sm = new THREE.Mesh(
        steamGeo,
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.0, depthWrite: false })
      );
      sm.visible = false;
      this.scene.add(sm);
      this.steamParticles.push({ mesh: sm, life: 0, maxLife: 1.2, velY: 0.14 });
    }

    // Overflow liquid droplets when cup is filled past 100%!
    const dropGeo = new THREE.SphereGeometry(0.008, 8, 8);
    for (let i = 0; i < 14; i++) {
      const dm = new THREE.Mesh(
        dropGeo,
        new THREE.MeshPhysicalMaterial({ color: 0xf5921d, roughness: 0.05, clearcoat: 1.0 })
      );
      dm.visible = false;
      this.scene.add(dm);
      this.overflowDrops.push({ mesh: dm, active: false, vel: new THREE.Vector3() });
    }
  }

  emitSteam(worldPos) {
    const p = this.steamParticles.find((s) => s.life <= 0);
    if (!p) return;
    p.life = p.maxLife;
    p.mesh.visible = true;
    p.mesh.position.copy(worldPos).add(new THREE.Vector3((Math.random() - 0.5) * 0.04, 0.02, (Math.random() - 0.5) * 0.04));
    p.mesh.scale.setScalar(0.5);
  }

  emitOverflowDrop(worldPos, color) {
    const d = this.overflowDrops.find((o) => !o.active);
    if (!d) return;
    d.active = true;
    d.mesh.visible = true;
    d.mesh.material.color.copy(color);
    d.mesh.position.copy(worldPos);
    const ang = Math.random() * Math.PI * 2;
    d.vel.set(Math.cos(ang) * 0.25, 0.35 + Math.random() * 0.2, Math.sin(ang) * 0.25);
  }

  // Create glossy orange juice spill puddles on Dad's white tray table in Scene 2!
  createDadSpillOnTray(dadTrayGroup, existingCupRecord) {
    this.clearSpillPuddles();

    // Tip Dad's cup sideways onto his tray!
    if (existingCupRecord && existingCupRecord.group) {
      existingCupRecord.fill = 0.08;
      this.updateCupVisuals(existingCupRecord);
      existingCupRecord.group.rotation.z = Math.PI * 0.46;
      existingCupRecord.group.position.y = 0.034;
      existingCupRecord.isTippedSpillCup = true;
    }

    const puddleOffsets = [
      { x: -0.08, z: 0.02, rx: 0.068, rz: 0.052 },
      { x: 0.01, z: -0.02, rx: 0.075, rz: 0.058 },
      { x: 0.08, z: 0.04, rx: 0.058, rz: 0.048 },
      { x: -0.03, z: 0.065, rx: 0.052, rz: 0.042 },
      { x: -0.12, z: -0.04, rx: 0.044, rz: 0.038 },
      { x: 0.05, z: -0.065, rx: 0.046, rz: 0.036 }
    ];

    puddleOffsets.forEach((po) => {
      const pMat = new THREE.MeshPhysicalMaterial({
        color: 0xf5921d,
        roughness: 0.03, // Ultra-glossy wet juice specular shine!
        metalness: 0.0,
        transparent: true,
        opacity: 0.88,
        clearcoat: 1.0,
        clearcoatRoughness: 0.02
      });
      const pMesh = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.004, 18), pMat);
      pMesh.scale.set(po.rx, 1, po.rz);
      pMesh.position.set(po.x, 0.014, po.z);
      pMesh.userData.interactiveType = 'spillPuddle';
      dadTrayGroup.add(pMesh);

      this.spillPuddles.push({
        mesh: pMesh,
        baseRx: po.rx,
        baseRz: po.rz,
        wetness: 1.0 // Continuously scrubbed down from 1.0 -> 0.0!
      });
    });

    // Nudge clean cloth stack up slightly as natural physical invitation
    this.towelStackGroup.scale.setScalar(1.22);
  }

  clearSpillPuddles() {
    for (const p of this.spillPuddles) {
      if (p.mesh.parent) p.mesh.parent.remove(p.mesh);
    }
    this.spillPuddles = [];
  }

  getRemainingSpillWetness() {
    if (this.spillPuddles.length === 0) return 0;
    let sum = 0;
    for (const p of this.spillPuddles) sum += p.wetness;
    return sum / this.spillPuddles.length;
  }

  update(dt, elapsed) {
    // Smooth cart rolling along aisle Z with wheel spin!
    const prevZ = this.cartGroup.position.z;
    this.cartGroup.position.z += (this.targetZ - this.cartGroup.position.z) * Math.min(1, dt * 7.5);
    const dz = this.cartGroup.position.z - prevZ;
    if (Math.abs(dz) > 0.0001) {
      for (const w of this.wheels) {
        w.rotation.x += dz / 0.038;
      }
    }

    // Smooth meal foil lid peel
    if (this.activeMeal) {
      const m = this.activeMeal;
      m.lidPeeled += (m.targetLidPeeled - m.lidPeeled) * Math.min(1, dt * 9.0);
      m.foilPivot.rotation.z = m.lidPeeled * 2.15;
      if (m.bakeLevel > 0.45 && Math.random() < dt * 3.5) {
        const wp = new THREE.Vector3();
        m.group.getWorldPosition(wp);
        this.emitSteam(wp);
      }
    }

    // Gentle steam from hot tea thermos & served hot cups/meals
    if (this.serviceStation.visible && Math.random() < dt * 2.2) {
      const teaPitcher = this.pitchers[1];
      if (teaPitcher) {
        const wp = new THREE.Vector3();
        teaPitcher.group.getWorldPosition(wp);
        wp.y += 0.09;
        this.emitSteam(wp);
      }
    }

    for (const sp of this.steamParticles) {
      if (sp.life > 0) {
        sp.life -= dt;
        if (sp.life <= 0) {
          sp.mesh.visible = false;
        } else {
          const progress = 1.0 - sp.life / sp.maxLife;
          sp.mesh.position.y += sp.velY * dt;
          sp.mesh.scale.setScalar(0.55 + progress * 1.45);
          sp.mesh.material.opacity = Math.sin(progress * Math.PI) * 0.26;
        }
      }
    }

    for (const od of this.overflowDrops) {
      if (od.active) {
        od.vel.y -= 3.2 * dt;
        od.mesh.position.addScaledVector(od.vel, dt);
        if (od.mesh.position.y < 0.75) {
          od.active = false;
          od.mesh.visible = false;
        }
      }
    }
  }
}
