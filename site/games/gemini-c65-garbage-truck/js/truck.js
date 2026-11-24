import * as THREE from '../vendor/three.module.min.js';

// Hero Photorealistic Municipal Rear-Loader Garbage Truck (パッカー車)
// Built for dramatic low-angle child's-eye composition with gleaming steel hopper, hydraulic cylinders, and working packer blade!

export class GarbageTruck {
  constructor(textures) {
    this.textures = textures;
    this.group = new THREE.Group();

    // Truck oriented along -X/+X street, with its massive open rear hopper angled toward the foreground camera!
    // Local coordinates: +Z is the REAR (open hopper facing player), -Z is the FRONT (cab)
    this.leverPull = 0.0; // 0 (up) to 1 (pulled down)
    this.compactionCycle = 0.0; // 0..1 continuous hydraulic blade cycle
    this.totalCompaction = 0.0; // cumulative crushed tightness 0..1
    this.pumpCount = 0;
    this.beaconPhase = 0;
    this.beaconFlashBoost = 0;
    this.tailgateShutterClose = 0; // closes smoothly in Scene 3
    this.sideHatchOpen = 0;

    this._initMaterials();
    this._buildChassisAndWheels();
    this._buildMainCompactorBody();
    this._buildOpenRearHopper();
    this._buildHydraulicPackerMechanism();
    this._buildControlLeverAndGauge();
    this._buildFrontCabAndMirrors();
    this._buildLightsAndBeacons();

    // Place truck heroically close & scaled at a 3/4 low-angle perspective so its gleaming metal fills the upper view!
    this.group.scale.setScalar(1.20);
    this.group.position.set(-0.38, 0.0, -0.18);
    this.group.rotation.y = 0.46;
  }

  _initMaterials() {
    const { steel, paintNormal, hazard } = this.textures;

    steel.map.repeat.set(1.5, 1.5);
    steel.roughnessMap.repeat.set(1.5, 1.5);
    steel.normalMap.repeat.set(1.5, 1.5);

    paintNormal.repeat.set(2, 2);
    hazard.repeat.set(1, 3.5);

    // Hero Municipal Metallic Cerulean-Blue Clearcoat Paint
    this.bodyPaintMat = new THREE.MeshPhysicalMaterial({
      color: 0x155782,
      metalness: 0.56,
      roughness: 0.20,
      clearcoat: 0.95,
      clearcoatRoughness: 0.09,
      normalMap: paintNormal,
      normalScale: new THREE.Vector2(0.32, 0.32),
      envMapIntensity: 1.75,
    });

    // Clean Crisp White-Silver Trim Band Paint
    this.whiteTrimMat = new THREE.MeshPhysicalMaterial({
      color: 0xe6edf5,
      metalness: 0.28,
      roughness: 0.22,
      clearcoat: 0.88,
      clearcoatRoughness: 0.12,
      envMapIntensity: 1.45,
    });

    // Hero Bare Brushed & Scratched Stainless Hopper Steel
    this.hopperSteelMat = new THREE.MeshStandardMaterial({
      color: 0xd0d9e2,
      map: steel.map,
      roughnessMap: steel.roughnessMap,
      normalMap: steel.normalMap,
      normalScale: new THREE.Vector2(0.28, 0.28),
      metalness: 0.94,
      roughness: 0.24,
      envMapIntensity: 1.95,
    });

    // Darker Galvanized Structural Steel (Packer Blade & Rails)
    this.bladeSteelMat = new THREE.MeshStandardMaterial({
      color: 0xa4b0bd,
      map: steel.map,
      roughnessMap: steel.roughnessMap,
      normalMap: steel.normalMap,
      normalScale: new THREE.Vector2(0.25, 0.25),
      metalness: 0.95,
      roughness: 0.28,
      envMapIntensity: 1.85,
    });

    // Mirror Chrome (Hydraulic Pistons & Mirror Arms)
    this.chromeMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      metalness: 0.99,
      roughness: 0.05,
      envMapIntensity: 2.1,
    });

    // Dark Heavy Chassis Iron
    this.chassisMat = new THREE.MeshStandardMaterial({
      color: 0x1f242c,
      metalness: 0.65,
      roughness: 0.48,
    });

    // Heavy Tire Rubber
    this.tireMat = new THREE.MeshStandardMaterial({
      color: 0x181a1e,
      roughness: 0.82,
      metalness: 0.06,
      normalMap: this.textures.asphalt.normalMap,
      normalScale: new THREE.Vector2(0.6, 0.6),
    });

    // Yellow-Black Hazard Chevron Bolsters
    this.hazardMat = new THREE.MeshStandardMaterial({
      map: hazard,
      metalness: 0.35,
      roughness: 0.32,
    });

    // Safety Yellow Hydraulic Cylinders & Lever Arm
    this.safetyYellowMat = new THREE.MeshPhysicalMaterial({
      color: 0xf59e0b,
      metalness: 0.38,
      roughness: 0.24,
      clearcoat: 0.7,
    });
  }

  _buildChassisAndWheels() {
    // Heavy I-beam frame rails tucked cleanly inside the rear bumper (never poking out past hopper!)
    [-0.48, 0.48].forEach((x) => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.19, 3.85), this.chassisMat);
      rail.position.set(x, 0.52, -1.95);
      rail.castShadow = true;
      this.group.add(rail);
    });

    // Chrome Tailgate Locking Turnbuckles & Rear Fender Arch Guards for industrial realism!
    [-1.02, 1.02].forEach((sx) => {
      const turnbuckle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.022, 0.022, 0.36, 10),
        this.chromeMat
      );
      turnbuckle.position.set(sx, 0.88, 0.02);
      turnbuckle.rotation.x = 0.35;
      this.group.add(turnbuckle);

      const fenderArch = new THREE.Mesh(
        new THREE.TorusGeometry(0.51, 0.045, 8, 22, Math.PI),
        this.chassisMat
      );
      fenderArch.rotation.y = Math.PI / 2;
      fenderArch.position.set(sx * 0.90, 0.48, -0.68);
      this.group.add(fenderArch);
    });

    // Fuel tank & air brake cylinders on right/left chassis waist (visible from low angle!)
    const airTank = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.72, 16), this.chassisMat);
    airTank.rotation.x = Math.PI / 2;
    airTank.position.set(0.76, 0.56, -1.55);
    airTank.castShadow = true;
    this.group.add(airTank);

    const stainlessTank = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.38, 0.85),
      this.hopperSteelMat
    );
    stainlessTank.position.set(-0.78, 0.56, -1.6);
    stainlessTank.castShadow = true;
    this.group.add(stainlessTank);

    // Dual Rear Axle Wheels & Front Steer Wheels
    const buildWheel = (isDual) => {
      const wg = new THREE.Group();
      const offsets = isDual ? [-0.13, 0.13] : [0];
      offsets.forEach((ox) => {
        const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.24, 28), this.tireMat);
        tire.rotation.z = Math.PI / 2;
        tire.position.x = ox;
        tire.castShadow = true;
        tire.receiveShadow = true;
        wg.add(tire);

        // Tread shoulder bevel rings
        [-0.105, 0.105].forEach((tx) => {
          const shoulder = new THREE.Mesh(
            new THREE.TorusGeometry(0.435, 0.028, 8, 28),
            this.tireMat
          );
          shoulder.rotation.y = Math.PI / 2;
          shoulder.position.x = ox + tx;
          wg.add(shoulder);
        });
      });

      // Steel wheel rim & 6 lug nuts
      const rim = new THREE.Mesh(
        new THREE.CylinderGeometry(0.26, 0.26, isDual ? 0.52 : 0.26, 20),
        this.hopperSteelMat
      );
      rim.rotation.z = Math.PI / 2;
      wg.add(rim);

      const hub = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.13, isDual ? 0.56 : 0.3, 14),
        this.chassisMat
      );
      hub.rotation.z = Math.PI / 2;
      wg.add(hub);

      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const lug = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, isDual ? 0.55 : 0.29, 8), this.chromeMat);
        lug.rotation.z = Math.PI / 2;
        lug.position.set(0, Math.cos(a) * 0.18, Math.sin(a) * 0.18);
        wg.add(lug);
      }
      return wg;
    };

    const wheelCoords = [
      { x: -0.82, z: -0.68, dual: true },
      { x: 0.82, z: -0.68, dual: true },
      { x: -0.86, z: -3.25, dual: false },
      { x: 0.86, z: -3.25, dual: false },
    ];
    wheelCoords.forEach(({ x, z, dual }) => {
      const w = buildWheel(dual);
      w.position.set(x, 0.46, z);
      this.group.add(w);
    });

    // Rubber mudflaps behind rear wheels
    [-0.82, 0.82].forEach((x) => {
      const flap = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.42, 0.02), this.tireMat);
      flap.position.set(x, 0.36, -0.14);
      flap.castShadow = true;
      this.group.add(flap);
    });
  }

  _buildMainCompactorBody() {
    // Sculpted Curved-Roof Municipal Compactor Body (extruded cross-section for realistic automotive curvature!)
    const shape = new THREE.Shape();
    const hw = 1.04;
    shape.moveTo(-hw + 0.08, 0);
    shape.lineTo(hw - 0.08, 0);
    shape.quadraticCurveTo(hw, 0, hw, 0.12);
    shape.lineTo(hw, 1.32);
    shape.quadraticCurveTo(hw, 1.66, hw - 0.26, 1.72);
    shape.quadraticCurveTo(0, 1.79, -hw + 0.26, 1.72);
    shape.quadraticCurveTo(-hw, 1.66, -hw, 1.32);
    shape.lineTo(-hw, 0.12);
    shape.quadraticCurveTo(-hw, 0, -hw + 0.08, 0);

    const extrudeSettings = {
      steps: 1,
      depth: 2.55,
      bevelEnabled: true,
      bevelThickness: 0.04,
      bevelSize: 0.03,
      bevelSegments: 3,
    };
    const bodyGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    const mainBody = new THREE.Mesh(bodyGeo, this.bodyPaintMat);
    mainBody.position.set(0, 0.72, -2.55);
    mainBody.castShadow = true;
    mainBody.receiveShadow = true;
    this.group.add(mainBody);

    // Clean White-Silver Horizontal Side Accent Stripe + Structural Steel Ribs
    [-1, 1].forEach((side) => {
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(0.025, 0.26, 2.52),
        this.whiteTrimMat
      );
      stripe.position.set(side * 1.065, 1.48, -1.28);
      this.group.add(stripe);

      // Brushed stainless steel lower side skirt rail
      const skirt = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.14, 2.56),
        this.hopperSteelMat
      );
      skirt.position.set(side * 1.06, 0.79, -1.28);
      skirt.castShadow = true;
      this.group.add(skirt);

      // Vertical structural reinforcement ribs along truck side
      for (let r = 0; r < 4; r++) {
        const rib = new THREE.Mesh(
          new THREE.BoxGeometry(0.035, 1.48, 0.07),
          this.bodyPaintMat
        );
        rib.position.set(side * 1.055, 1.5, -0.35 - r * 0.65);
        rib.castShadow = true;
        this.group.add(rib);
      }
    });

    // Side Recycling Output Hatch on Right Side (opens in Scene 3 to dispense flower planters!)
    this.sideHatchGroup = new THREE.Group();
    const hatchDoor = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.48, 0.56),
      this.hopperSteelMat
    );
    hatchDoor.position.set(0, -0.24, 0);
    this.sideHatchGroup.add(hatchDoor);
    this.sideHatchGroup.position.set(1.07, 1.38, -1.15);
    this.group.add(this.sideHatchGroup);
  }

  _buildOpenRearHopper() {
    // Massive Rear Tailgate & Open Stainless-Steel Hopper Trough (+Z facing player!)
    this.hopperGroup = new THREE.Group();
    this.hopperGroup.position.set(0, 0, 0);
    this.group.add(this.hopperGroup);

    // Left & Right Thick Sculpted Tailgate Side Cheeks
    [-1, 1].forEach((side) => {
      const cheekShape = new THREE.Shape();
      cheekShape.moveTo(0, 0.52);
      cheekShape.lineTo(0.86, 0.56); // juts out at loading sill
      cheekShape.lineTo(0.92, 1.02);
      cheekShape.lineTo(0.68, 1.85);
      cheekShape.quadraticCurveTo(0.52, 2.42, 0.0, 2.46);
      cheekShape.closePath();

      const cheekGeo = new THREE.ExtrudeGeometry(cheekShape, {
        depth: 0.14,
        bevelEnabled: true,
        bevelThickness: 0.02,
        bevelSize: 0.02,
        bevelSegments: 2,
      });
      const cheek = new THREE.Mesh(cheekGeo, this.bodyPaintMat);
      cheek.rotation.y = Math.PI / 2;
      cheek.position.set(side * 0.98 - 0.07, 0, 0);
      cheek.castShadow = true;
      cheek.receiveShadow = true;
      this.hopperGroup.add(cheek);

      // Stainless Steel Inner Hopper Cheek Liner (heavy wear plates!)
      const liner = new THREE.Mesh(
        new THREE.BoxGeometry(0.03, 1.65, 0.78),
        this.hopperSteelMat
      );
      liner.position.set(side * 0.89, 1.42, 0.39);
      liner.receiveShadow = true;
      this.hopperGroup.add(liner);

      // Yellow-Black Hazard Chevron Safety Bolsters flanking the hopper mouth!
      const bolster = new THREE.Mesh(
        new THREE.BoxGeometry(0.13, 1.18, 0.09),
        this.hazardMat
      );
      bolster.position.set(side * 0.97, 1.34, 0.84);
      bolster.rotation.x = 0.18;
      bolster.castShadow = true;
      this.hopperGroup.add(bolster);

      // Tubular Chrome Grab Handle for sanitation workers on both rear pillars!
      const grab = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.018, 0.62, 10),
        this.chromeMat
      );
      grab.position.set(side * 1.09, 1.35, 0.68);
      grab.rotation.x = 0.18;
      this.hopperGroup.add(grab);
    });

    // Deep Curved Brushed Stainless-Steel Hopper Basin / Trough (where trash bags & recyclables land!)
    const troughCurve = new THREE.Shape();
    troughCurve.moveTo(0, 1.35);
    troughCurve.lineTo(0.18, 0.64);
    troughCurve.quadraticCurveTo(0.45, 0.48, 0.82, 0.62);
    troughCurve.lineTo(0.90, 0.84); // rolled stainless loading sill lip at child height!
    troughCurve.lineTo(0.95, 0.81);
    troughCurve.lineTo(0.85, 0.54);
    troughCurve.quadraticCurveTo(0.45, 0.38, 0.08, 0.56);
    troughCurve.lineTo(-0.08, 1.35);
    troughCurve.closePath();

    const troughGeo = new THREE.ExtrudeGeometry(troughCurve, {
      depth: 1.78,
      bevelEnabled: false,
      curveSegments: 16,
    });
    const troughMesh = new THREE.Mesh(troughGeo, this.hopperSteelMat);
    troughMesh.rotation.y = Math.PI / 2;
    troughMesh.position.set(-0.89, 0, 0);
    troughMesh.castShadow = true;
    troughMesh.receiveShadow = true;
    this.hopperGroup.add(troughMesh);

    // Rolled Polished Stainless Loading Sill Bar across the front of the hopper mouth
    const sillBar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.045, 1.94, 18),
      this.chromeMat
    );
    sillBar.rotation.z = Math.PI / 2;
    sillBar.position.set(0, 0.84, 0.91);
    sillBar.castShadow = true;
    this.hopperGroup.add(sillBar);

    // Black Rubber Sill Cushion Strip
    const rubberLip = new THREE.Mesh(
      new THREE.BoxGeometry(1.86, 0.055, 0.07),
      this.tireMat
    );
    rubberLip.position.set(0, 0.79, 0.93);
    this.hopperGroup.add(rubberLip);

    // Upper Tailgate Header Canopy & Rear Step Bumper
    const header = new THREE.Mesh(
      new THREE.BoxGeometry(2.12, 0.34, 0.62),
      this.bodyPaintMat
    );
    header.position.set(0, 2.34, 0.24);
    header.castShadow = true;
    this.hopperGroup.add(header);

    // Clean Ribbed Metallic Roll-Down Tailgate Shutter (lowers cleanly to chrome sill in Scene 3!)
    this.shutterMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.78, 1.42, 0.04),
      this.hopperSteelMat
    );
    this.shutterMesh.position.set(0, 2.22, 0.78);
    this.shutterMesh.scale.y = 0.04;
    this.hopperGroup.add(this.shutterMesh);

    // Heavy Rear Underrun Step & License Plate Frame (zero text — geometric emerald leaf emblem!)
    const rearStep = new THREE.Mesh(
      new THREE.BoxGeometry(1.96, 0.08, 0.24),
      this.bladeSteelMat
    );
    rearStep.position.set(0, 0.42, 0.68);
    rearStep.castShadow = true;
    rearStep.receiveShadow = true;
    this.hopperGroup.add(rearStep);

    // Invisible Hopper Drop Zone Collider for easy tossing in Scene 2
    this.hopperDropCollider = new THREE.Mesh(
      new THREE.BoxGeometry(1.75, 1.15, 1.05),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    this.hopperDropCollider.position.set(0, 1.12, 0.52);
    this.hopperDropCollider.userData = { interactType: 'hopperZone' };
    this.hopperGroup.add(this.hopperDropCollider);
  }

  _buildHydraulicPackerMechanism() {
    // Moving Upper Slide Plate + Lower Pivoting Steel Packer Sweep Blade + Twin Hydraulic Cylinders!
    this.slideCarriage = new THREE.Group();
    this.slideCarriage.position.set(0, 1.78, 0.28);
    this.hopperGroup.add(this.slideCarriage);

    // Heavy Ribbed Steel Slide Plate
    const slidePlate = new THREE.Mesh(
      new THREE.BoxGeometry(1.72, 0.88, 0.09),
      this.bladeSteelMat
    );
    slidePlate.castShadow = true;
    slidePlate.receiveShadow = true;
    this.slideCarriage.add(slidePlate);

    for (let i = -2; i <= 2; i++) {
      const stiffener = new THREE.Mesh(
        new THREE.BoxGeometry(0.07, 0.84, 0.14),
        this.hopperSteelMat
      );
      stiffener.position.set(i * 0.34, 0, 0.03);
      this.slideCarriage.add(stiffener);
    }

    // Lower Pivoting Steel Sweep Blade (パッカープレート) that scoops down & crushes trash!
    this.sweepBladePivot = new THREE.Group();
    this.sweepBladePivot.position.set(0, -0.40, 0.03);
    this.slideCarriage.add(this.sweepBladePivot);

    const bladeMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.70, 0.62, 0.075),
      this.hopperSteelMat
    );
    bladeMesh.position.set(0, -0.29, 0.04);
    bladeMesh.castShadow = true;
    bladeMesh.receiveShadow = true;
    this.sweepBladePivot.add(bladeMesh);

    // Hardened Curved Crusher Lip at tip of sweep blade
    const bladeLip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.045, 1.70, 14),
      this.chromeMat
    );
    bladeLip.rotation.z = Math.PI / 2;
    bladeLip.position.set(0, -0.59, 0.06);
    this.sweepBladePivot.add(bladeLip);

    // Twin Heavy Hydraulic Cylinders with gleaming telescoping chrome piston rods!
    this.hydraulicRods = [];
    [-0.72, 0.72].forEach((cx) => {
      const cylBarrel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.068, 0.068, 0.74, 16),
        this.safetyYellowMat
      );
      cylBarrel.position.set(cx, 2.02, 0.44);
      cylBarrel.rotation.x = 0.42;
      cylBarrel.castShadow = true;
      this.hopperGroup.add(cylBarrel);

      const rod = new THREE.Mesh(
        new THREE.CylinderGeometry(0.038, 0.038, 0.78, 16),
        this.chromeMat
      );
      rod.position.set(cx, 1.72, 0.31);
      rod.rotation.x = 0.42;
      this.hopperGroup.add(rod);
      this.hydraulicRods.push(rod);

      // Curved black rubber hydraulic pressure hose
      const hoseCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(cx * 1.08, 2.25, 0.32),
        new THREE.Vector3(cx * 1.16, 2.05, 0.56),
        new THREE.Vector3(cx * 1.05, 1.85, 0.44),
      ]);
      const hose = new THREE.Mesh(
        new THREE.TubeGeometry(hoseCurve, 14, 0.018, 8, false),
        this.tireMat
      );
      this.hopperGroup.add(hose);
    });
  }

  _buildControlLeverAndGauge() {
    // Prominent Chunky Hydraulic Control Station on the Right Cheek of the Tailgate!
    this.controlBox = new THREE.Group();
    this.controlBox.position.set(1.08, 1.24, 0.58);
    this.hopperGroup.add(this.controlBox);

    // Brushed Steel Housing Box
    const housing = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.46, 0.32),
      this.hopperSteelMat
    );
    housing.castShadow = true;
    this.controlBox.add(housing);

    // Wordless Analog Hydraulic Pressure Gauge (green -> gold -> crimson arc, rotating brass needle!)
    const gaugeTex = createWordlessGaugeTexture();
    const gaugeRim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.11, 0.04, 20),
      this.chromeMat
    );
    gaugeRim.rotation.z = Math.PI / 2;
    gaugeRim.position.set(0.09, 0.32, 0.0);
    this.controlBox.add(gaugeRim);

    const gaugeFace = new THREE.Mesh(
      new THREE.CircleGeometry(0.095, 20),
      new THREE.MeshBasicMaterial({ map: gaugeTex })
    );
    gaugeFace.rotation.y = Math.PI / 2;
    gaugeFace.position.set(0.112, 0.32, 0.0);
    this.controlBox.add(gaugeFace);

    this.gaugeNeedle = new THREE.Group();
    const needleBar = new THREE.Mesh(
      new THREE.BoxGeometry(0.008, 0.075, 0.012),
      new THREE.MeshBasicMaterial({ color: 0xdc2626 })
    );
    needleBar.position.y = 0.03;
    this.gaugeNeedle.add(needleBar);
    this.gaugeNeedle.position.set(0.116, 0.32, 0.0);
    this.gaugeNeedle.rotation.x = 2.1; // start at left end of arc
    this.controlBox.add(this.gaugeNeedle);

    // Heavy Pivoting Hydraulic Lever Arm with Big Glossy Red/Yellow Grip Ball!
    this.leverPivot = new THREE.Group();
    this.leverPivot.position.set(0.08, 0.04, 0.02);
    this.controlBox.add(this.leverPivot);

    const leverShaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.026, 0.42, 14),
      this.chromeMat
    );
    leverShaft.position.set(0.06, 0.18, 0.08);
    leverShaft.rotation.z = -0.25;
    leverShaft.rotation.x = 0.38;
    leverShaft.castShadow = true;
    this.leverPivot.add(leverShaft);

    this.leverKnob = new THREE.Mesh(
      new THREE.SphereGeometry(0.072, 20, 16),
      new THREE.MeshPhysicalMaterial({
        color: 0xe11d48,
        roughness: 0.16,
        metalness: 0.15,
        clearcoat: 1.0,
      })
    );
    this.leverKnob.position.set(0.11, 0.36, 0.16);
    this.leverKnob.castShadow = true;
    this.leverPivot.add(this.leverKnob);

    // Yellow collar below knob
    const collar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.038, 0.032, 0.06, 14),
      this.safetyYellowMat
    );
    collar.position.set(0.095, 0.30, 0.13);
    collar.rotation.x = 0.38;
    collar.rotation.z = -0.25;
    this.leverPivot.add(collar);

    // Extra-generous hit sphere so a 5-year-old's finger grabs the lever effortlessly!
    this.leverHit = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 10, 10),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    this.leverHit.position.set(0.11, 0.32, 0.15);
    this.leverHit.userData = { interactType: 'lever' };
    this.leverPivot.add(this.leverHit);

    this.setCompactionVisuals(0, 0);
  }

  _buildFrontCabAndMirrors() {
    // Japanese Cab-Over-Engine Truck Cab at front (-Z) visible in dramatic 3/4 perspective
    const cabGroup = new THREE.Group();
    cabGroup.position.set(0, 0.68, -3.38);
    this.group.add(cabGroup);

    const cabBox = new THREE.Mesh(
      new THREE.BoxGeometry(1.96, 1.62, 1.38),
      this.bodyPaintMat
    );
    cabBox.position.y = 0.82;
    cabBox.castShadow = true;
    cabBox.receiveShadow = true;
    cabBox.userData = { interactType: 'truckHorn' };
    cabGroup.add(cabBox);

    // Tinted Glass Side Windows & Windshield reflecting dawn sky
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x1e293b,
      metalness: 0.15,
      roughness: 0.06,
      clearcoat: 1.0,
      envMapIntensity: 2.0,
    });
    [-0.99, 0.99].forEach((sx) => {
      const sideWin = new THREE.Mesh(new THREE.PlaneGeometry(0.88, 0.62), glassMat);
      sideWin.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2;
      sideWin.position.set(sx, 1.16, -0.08);
      cabGroup.add(sideWin);

      // Tubular Chrome Side Mirror Arms + Convex Mirror Housings!
      const arm = new THREE.Mesh(
        new THREE.CylinderGeometry(0.014, 0.014, 0.42, 8),
        this.chromeMat
      );
      arm.rotation.z = Math.PI / 2;
      arm.position.set(sx * 1.14, 1.38, -0.45);
      cabGroup.add(arm);

      const mirrorHousing = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.32, 0.18),
        this.chassisMat
      );
      mirrorHousing.position.set(sx * 1.31, 1.26, -0.45);
      cabGroup.add(mirrorHousing);

      const mirrorFace = new THREE.Mesh(
        new THREE.PlaneGeometry(0.15, 0.28),
        this.chromeMat
      );
      mirrorFace.rotation.y = sx > 0 ? Math.PI / 2 - Math.PI / 2 : 0; // facing rearward (+Z)!
      mirrorFace.position.set(sx * 1.31, 1.26, -0.355);
      cabGroup.add(mirrorFace);
    });
  }

  _buildLightsAndBeacons() {
    // Twin Amber Rotating Safety Beacons on top of Rear Header (cast warm golden glint!)
    this.beaconMats = [];
    [-0.78, 0.78].forEach((bx) => {
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.075, 0.085, 0.05, 14),
        this.chromeMat
      );
      base.position.set(bx, 2.53, 0.28);
      this.hopperGroup.add(base);

      const domeMat = new THREE.MeshPhysicalMaterial({
        color: 0xf59e0b,
        emissive: 0xd97706,
        emissiveIntensity: 0.9,
        roughness: 0.1,
        transmission: 0.45,
        clearcoat: 1.0,
      });
      const dome = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.068, 0.12, 16), domeMat);
      dome.position.set(bx, 2.61, 0.28);
      dome.userData = { interactType: 'truckHorn' };
      this.hopperGroup.add(dome);
      this.beaconMats.push(domeMat);
    });

    // LED Work Floodlight illuminating the stainless hopper interior!
    const workLamp = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.08, 0.06),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xfff3d6,
        emissiveIntensity: 1.8,
      })
    );
    workLamp.position.set(0, 2.18, 0.56);
    workLamp.rotation.x = 0.45;
    this.hopperGroup.add(workLamp);

    this.hopperLight = new THREE.PointLight(0xffe8c2, 1.35, 3.2);
    this.hopperLight.position.set(0, 1.85, 0.72);
    this.hopperGroup.add(this.hopperLight);

    // Realistic Industrial Recessed Round Tail-Lamp Clusters inside Smoked Chrome Housings!
    [-0.78, 0.78].forEach((lx) => {
      const housing = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.14, 0.06), this.chassisMat);
      housing.position.set(lx, 0.54, 0.66);
      this.hopperGroup.add(housing);

      const trimRing1 = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.065, 16), this.chromeMat);
      trimRing1.rotation.x = Math.PI / 2;
      trimRing1.position.set(lx - 0.09, 0.54, 0.665);
      this.hopperGroup.add(trimRing1);

      const tailRed = new THREE.Mesh(
        new THREE.CylinderGeometry(0.042, 0.042, 0.07, 16),
        new THREE.MeshPhysicalMaterial({
          color: 0xb91c1c,
          emissive: 0x7f1d1d,
          emissiveIntensity: 0.85,
          roughness: 0.12,
          clearcoat: 1.0,
        })
      );
      tailRed.rotation.x = Math.PI / 2;
      tailRed.position.set(lx - 0.09, 0.54, 0.668);
      this.hopperGroup.add(tailRed);

      const trimRing2 = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.065, 16), this.chromeMat);
      trimRing2.rotation.x = Math.PI / 2;
      trimRing2.position.set(lx + 0.02, 0.54, 0.665);
      this.hopperGroup.add(trimRing2);

      const turnAmber = new THREE.Mesh(
        new THREE.CylinderGeometry(0.042, 0.042, 0.07, 16),
        new THREE.MeshPhysicalMaterial({
          color: 0xd97706,
          emissive: 0x92400e,
          emissiveIntensity: 0.55,
          roughness: 0.12,
          clearcoat: 1.0,
        })
      );
      turnAmber.rotation.x = Math.PI / 2;
      turnAmber.position.set(lx + 0.02, 0.54, 0.668);
      this.hopperGroup.add(turnAmber);

      const backupLamp = new THREE.Mesh(
        new THREE.CylinderGeometry(0.032, 0.032, 0.07, 14),
        new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.4, roughness: 0.15 })
      );
      backupLamp.rotation.x = Math.PI / 2;
      backupLamp.position.set(lx + 0.12, 0.54, 0.668);
      this.hopperGroup.add(backupLamp);
    });
  }

  // Get world coordinates of the Hopper Trough center for tossing items
  getHopperWorldCenter(out = new THREE.Vector3()) {
    return out.set(0, 0.88, 0.58).applyMatrix4(this.group.matrixWorld);
  }

  getLeverKnobWorldPos(out = new THREE.Vector3()) {
    this.leverKnob.updateWorldMatrix(true, false);
    return this.leverKnob.getWorldPosition(out);
  }

  // Update physical hydraulic mechanism from lever pull (0..1) and compaction cycle (0..1)
  setCompactionVisuals(leverPull, cycleProgress) {
    this.leverPull = leverPull;
    this.compactionCycle = cycleProgress;

    // Lever pivots downward toward the player (+X/+Z rotation) smoothly
    this.leverPivot.rotation.x = leverPull * 0.92;

    // Analog pressure gauge needle sweeps from green to gold/red with hydraulic pressure!
    const gaugeAngle = 2.1 - Math.min(1.0, this.totalCompaction * 0.72 + leverPull * 0.35) * 3.8;
    this.gaugeNeedle.rotation.x = gaugeAngle;

    // Hydraulic Slide Carriage descends along diagonal track & Sweep Blade scoops forward and down!
    // cycleProgress 0 -> 0.55: descends & sweeps down into trough; 0.55 -> 1.0: crushes up along belly!
    const downAmt = Math.sin(cycleProgress * Math.PI);
    const scoopPhase = cycleProgress < 0.65
      ? cycleProgress / 0.65
      : 1.0 - (cycleProgress - 0.65) / 0.35 * 0.35;

    this.slideCarriage.position.y = 1.78 - downAmt * 0.56;
    this.slideCarriage.position.z = 0.28 + downAmt * 0.24;

    // Sweep blade rotates outward (+0.65 rad) then curls tightly inward (-0.95 rad) to crush trash!
    const bladeAng = cycleProgress < 0.35
      ? (cycleProgress / 0.35) * 0.52
      : 0.52 - ((cycleProgress - 0.35) / 0.65) * 1.48;
    this.sweepBladePivot.rotation.x = bladeAng * scoopPhase;

    // Telescoping chrome hydraulic rods extend synchronously
    this.hydraulicRods.forEach((rod) => {
      rod.position.y = 1.72 - downAmt * 0.29;
      rod.position.z = 0.31 + downAmt * 0.13;
    });
  }

  flashBeacons() {
    this.beaconFlashBoost = 1.0;
  }

  update(dt, sceneIndex) {
    this.beaconPhase += dt * (this.beaconFlashBoost > 0.05 ? 14.0 : 5.2);
    if (this.beaconFlashBoost > 0) {
      this.beaconFlashBoost = Math.max(0, this.beaconFlashBoost - dt * 0.9);
    }
    this.beaconMats.forEach((m, idx) => {
      const pulse = 0.5 + 0.5 * Math.sin(this.beaconPhase + idx * Math.PI);
      m.emissiveIntensity = 0.45 + pulse * (1.4 + this.beaconFlashBoost * 2.2);
    });

    // Subtle diesel idle micro-vibration on truck body in Scenes 1 & 2
    const vibe = sceneIndex < 3 ? Math.sin(this.beaconPhase * 6.5) * 0.0014 : 0;
    this.hopperGroup.position.y = vibe;

    // Scene 3: cleanly lower rear shutter & open side recycling hatch
    const targetShutter = sceneIndex === 3 ? 1.0 : 0.05;
    this.shutterMesh.scale.y += (targetShutter - this.shutterMesh.scale.y) * Math.min(1, dt * 3.0);
    this.shutterMesh.position.y = 2.24 - (this.shutterMesh.scale.y * 1.35) * 0.48;

    const targetHatch = sceneIndex === 3 ? -1.15 : 0.0;
    this.sideHatchGroup.rotation.z += (targetHatch - this.sideHatchGroup.rotation.z) * Math.min(1, dt * 3.5);
  }
}

function createWordlessGaugeTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.arc(64, 64, 62, 0, Math.PI * 2);
  ctx.fill();

  // Colored pressure zones (Zero numbers/letters!)
  const zones = [
    { a0: Math.PI * 0.75, a1: Math.PI * 1.35, col: '#22c55e' },
    { a0: Math.PI * 1.35, a1: Math.PI * 1.85, col: '#f59e0b' },
    { a0: Math.PI * 1.85, a1: Math.PI * 2.25, col: '#ef4444' },
  ];
  zones.forEach(({ a0, a1, col }) => {
    ctx.strokeStyle = col;
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(64, 64, 44, a0, a1);
    ctx.stroke();
  });

  // Radial tick marks
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 2.5;
  for (let i = 0; i <= 8; i++) {
    const a = Math.PI * 0.75 + (i / 8) * Math.PI * 1.5;
    ctx.beginPath();
    ctx.moveTo(64 + Math.cos(a) * 34, 64 + Math.sin(a) * 34);
    ctx.lineTo(64 + Math.cos(a) * 52, 64 + Math.sin(a) * 52);
    ctx.stroke();
  }

  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.arc(64, 64, 8, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
