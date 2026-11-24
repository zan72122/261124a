import * as THREE from '../vendor/three.module.min.js';

// Photorealistic Glossy Translucent PVC Vinyl Floats + Soft-Body Deformation + Air Pumps

function prepareDeformable(mesh, mode = 'ring') {
  const geo = mesh.geometry;
  geo.computeVertexNormals();
  const pos = geo.attributes.position;
  const norm = geo.attributes.normal;
  mesh.userData.basePos = new Float32Array(pos.array);
  mesh.userData.baseNorm = new Float32Array(norm.array);
  mesh.userData.deformMode = mode;
}

export const sharedVinylUniforms = {
  uTime: { value: 0 },
  uPoolMode: { value: 0 }
};

export function createVinylMaterial(params, vinylNormalMap) {
  const mat = new THREE.MeshPhysicalMaterial({
    color: params.color,
    map: params.map || null,
    roughness: params.roughness ?? 0.014,
    metalness: 0.0,
    transmission: params.transmission ?? 0.78,
    thickness: params.thickness ?? 0.68,
    ior: 1.52,
    reflectivity: 1.0,
    specularIntensity: 1.6,
    specularColor: new THREE.Color(0xffffff),
    clearcoat: 1.0,
    clearcoatRoughness: 0.005,
    iridescence: params.iridescence ?? 0.12,
    iridescenceIOR: 1.38,
    attenuationColor: new THREE.Color(params.attenuationColor || params.color),
    attenuationDistance: params.attenuationDistance ?? 0.36,
    envMapIntensity: params.envMapIntensity ?? 2.45,
    normalMap: vinylNormalMap,
    normalScale: new THREE.Vector2(0.70, 0.70),
    transparent: true,
    opacity: params.opacity ?? 0.99,
    side: THREE.FrontSide
  });

  // Inject real-time sunlit PVC internal rim-glow + upward dancing pool water caustics in Stage 3!
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uVinylTime = sharedVinylUniforms.uTime;
    shader.uniforms.uPoolMode = sharedVinylUniforms.uPoolMode;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vVinylWorldPos;\nvarying vec3 vVinylWorldNorm;`)
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>\nvVinylWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvVinylWorldNorm = normalize(mat3(modelMatrix) * objectNormal);`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float uVinylTime;\nuniform float uPoolMode;\nvarying vec3 vVinylWorldPos;\nvarying vec3 vVinylWorldNorm;`)
      .replace('#include <dithering_fragment>', `
        vec3 vV = normalize(cameraPosition - vVinylWorldPos);
        vec3 vN = normalize(vVinylWorldNorm);
        // Translucent PVC edge light-piping (bright sunlit vinyl rim sheen!)
        float pvcRim = pow(1.0 - abs(dot(vN, vV)), 3.2);
        gl_FragColor.rgb += gl_FragColor.rgb * pvcRim * 0.28 + vec3(1.0, 0.98, 0.92) * pow(pvcRim, 2.2) * 0.18;
        // Reflected dancing turquoise-white water caustics on lower half of floats when in the pool!
        if (uPoolMode > 0.5) {
          float underMask = clamp(-vN.y * 0.65 + 0.45, 0.0, 1.0);
          float cw1 = sin(vVinylWorldPos.x * 9.5 + uVinylTime * 3.4) * cos(vVinylWorldPos.z * 9.2 - uVinylTime * 2.9);
          float cw2 = sin((vVinylWorldPos.x + vVinylWorldPos.z) * 13.0 - uVinylTime * 4.1);
          float caust = pow(max(0.0, cw1 * 0.6 + cw2 * 0.4), 3.0);
          gl_FragColor.rgb += vec3(0.45, 0.95, 1.0) * caust * underMask * 0.55;
        }
        #include <dithering_fragment>
      `);
  };

  return mat;
}

export class VinylFloat {
  constructor(type, vinylNormalMap, donutTex) {
    this.type = type; // 'octopus' | 'swan' | 'donut'
    this.group = new THREE.Group();
    this.group.name = `float_${type}`;

    // Simulation state
    this.pressure = 0.08; // 0.0 = flat deflated, 0.85 = plump ideal, >1.08 = over-inflated relief!
    this.giantScale = 1.0; // Used in Scene 2 when Dad over-inflates Octopus to giant room-filling size
    this.wobbleTime = 0;
    this.wobbleAmp = 0;
    this.pokeLocal = new THREE.Vector3(0, 99, 0);
    this.pokeStrength = 0;
    this.targetPokeStrength = 0;
    this.valveOpen = false;
    this.releasingAir = 0; // timer for over-inflation relief hiss

    // Pool physics state (Scene 3)
    this.poolPos = new THREE.Vector2(0, 0);
    this.poolVel = new THREE.Vector2(0, 0);
    this.bobOffset = 0;
    this.bobVel = 0;
    this.tiltX = 0;
    this.tiltZ = 0;
    this.tiltVelX = 0;
    this.tiltVelZ = 0;
    this.spinAngle = 0;
    this.spinVel = 0;
    this.rider = null; // family character riding this float
    this.stickers = [];
    this.pumpOrderIndex = -1;
    this.pumpStrokeCount = 0;

    this.deformMeshes = [];
    this.materials = [];
    this.confettiItems = [];
    this.tentacles = [];
    this.neckGroup = null;

    this._build(vinylNormalMap, donutTex);
    this.updateDeformation(0.016, 0);
  }

  _build(vinylNormalMap, donutTex) {
    const outerR = 0.78;
    const tubeR = 0.31;

    if (this.type === 'octopus') {
      const mainMat = createVinylMaterial({
        color: 0xff5442,
        attenuationColor: 0xff2a1a,
        attenuationDistance: 0.72,
        transmission: 0.70,
        thickness: 0.62
      }, vinylNormalMap);
      this.materials.push(mainMat);

      // Main Torus Ring (oriented horizontally in XZ plane)
      const torusGeo = new THREE.TorusGeometry(outerR, tubeR, 36, 72);
      torusGeo.rotateX(Math.PI / 2);
      const torusMesh = new THREE.Mesh(torusGeo, mainMat);
      torusMesh.castShadow = true;
      torusMesh.receiveShadow = true;
      prepareDeformable(torusMesh, 'ring');
      this.group.add(torusMesh);
      this.deformMeshes.push(torusMesh);
      this.mainMesh = torusMesh;

      // Heat-welded pinched outer & inner PVC seam flanges
      this._addWeldedSeams(outerR, tubeR, 0xff7a6b, vinylNormalMap);

      // Cute plump glossy vinyl Octopus Crown Head perched on back-side of ring
      // Realistic flush screen-printed PVC Octopus head texture (so mirror sun highlights streak across the eyes cleanly, not toy 3D eyeballs!)
      const octoHeadCanvas = document.createElement('canvas');
      octoHeadCanvas.width = 512;
      octoHeadCanvas.height = 256;
      const oCtx = octoHeadCanvas.getContext('2d');
      oCtx.fillStyle = '#ff503c';
      oCtx.fillRect(0, 0, 512, 256);
      // Subtle translucent spot pattern on crown
      oCtx.fillStyle = 'rgba(255,145,115,0.35)';
      [[110, 70, 22], [400, 75, 20], [256, 52, 26], [60, 130, 18], [450, 130, 18]].forEach(([cx, cy, cr]) => {
        oCtx.beginPath(); oCtx.arc(cx, cy, cr, 0, Math.PI * 2); oCtx.fill();
      });
      // Clean commercial inflatable screen-printed friendly eyes & smile at front +Z UV (in Three.js SphereGeometry, u = 0.25 -> sin(pi/2) = +1 -> +Z!)
      const fcX = 128; // u = 0.25 (+Z front of SphereGeometry!)
      const fcY = 132;
      [-36, 36].forEach((ox) => {
        oCtx.fillStyle = 'rgba(150,20,10,0.25)';
        oCtx.beginPath(); oCtx.ellipse(fcX + ox, fcY + 2, 20, 24, 0, 0, Math.PI * 2); oCtx.fill();
        oCtx.fillStyle = '#ffffff';
        oCtx.beginPath(); oCtx.ellipse(fcX + ox, fcY, 19, 23, 0, 0, Math.PI * 2); oCtx.fill();
        oCtx.fillStyle = '#241614';
        oCtx.beginPath(); oCtx.ellipse(fcX + ox * 0.90, fcY + 1, 11, 14, 0, 0, Math.PI * 2); oCtx.fill();
        oCtx.fillStyle = '#ffffff';
        oCtx.beginPath(); oCtx.arc(fcX + ox * 0.90 + 4, fcY - 5, 4.5, 0, Math.PI * 2); oCtx.fill();
      });
      oCtx.strokeStyle = '#ffffff';
      oCtx.lineWidth = 5.5;
      oCtx.lineCap = 'round';
      oCtx.beginPath();
      oCtx.arc(fcX, fcY + 14, 16, 0.15 * Math.PI, 0.85 * Math.PI);
      oCtx.stroke();

      const octoHeadTex = new THREE.CanvasTexture(octoHeadCanvas);
      octoHeadTex.colorSpace = THREE.SRGBColorSpace;

      const headMat = createVinylMaterial({
        color: 0xffffff,
        map: octoHeadTex,
        attenuationColor: 0xff2b18,
        transmission: 0.70,
        thickness: 0.58
      }, vinylNormalMap);
      this.materials.push(headMat);

      const headGroup = new THREE.Group();
      headGroup.position.set(0, 0.28, -outerR * 0.86);
      this.headGroup = headGroup;

      const domeGeo = new THREE.SphereGeometry(0.41, 36, 28);
      domeGeo.scale(1.08, 0.94, 0.98);
      const dome = new THREE.Mesh(domeGeo, headMat);
      dome.castShadow = true;
      headGroup.add(dome);
      this.group.add(headGroup);

      // 8 Plump Translucent Curled Vinyl Tentacles around outer rim!
      const tentacleMat = createVinylMaterial({
        color: 0xff6b57,
        attenuationColor: 0xff3b28,
        transmission: 0.74,
        thickness: 0.42
      }, vinylNormalMap);
      this.materials.push(tentacleMat);

      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2 + Math.PI * 0.125;
        const tPivot = new THREE.Group();
        tPivot.position.set(Math.cos(ang) * (outerR + tubeR * 0.62), 0.0, Math.sin(ang) * (outerR + tubeR * 0.62));
        tPivot.rotation.y = -ang;

        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0.16, -0.04, 0.04),
          new THREE.Vector3(0.32, 0.03, 0.10),
          new THREE.Vector3(0.44, 0.16, 0.04),
          new THREE.Vector3(0.38, 0.24, -0.05)
        ]);
        const tGeo = new THREE.TubeGeometry(curve, 20, 0.095, 16, false);
        // Taper radius nicely along tentacle length
        const tPos = tGeo.attributes.position;
        const tmpP = new THREE.Vector3();
        const cPt = new THREE.Vector3();
        for (let vi = 0; vi < tPos.count; vi++) {
          const u = Math.min(1, Math.floor(vi / 17) / 20);
          curve.getPointAt(u, cPt);
          tmpP.fromBufferAttribute(tPos, vi);
          const taper = 1.0 - u * 0.62;
          tmpP.sub(cPt).multiplyScalar(taper).add(cPt);
          tPos.setXYZ(vi, tmpP.x, tmpP.y, tmpP.z);
        }
        tGeo.computeVertexNormals();

        const tMesh = new THREE.Mesh(tGeo, tentacleMat);
        tMesh.castShadow = true;
        const tipCap = new THREE.Mesh(new THREE.SphereGeometry(0.036, 12, 10), tentacleMat);
        curve.getPointAt(1, tipCap.position);
        tPivot.add(tMesh, tipCap);

        this.group.add(tPivot);
        this.tentacles.push({ pivot: tPivot, phase: i * 0.85, baseAng: ang });
      }
    } else if (this.type === 'swan') {
      const swanMat = createVinylMaterial({
        color: 0xfbfdff,
        attenuationColor: 0xdff2ff,
        attenuationDistance: 1.1,
        transmission: 0.50,
        thickness: 0.52,
        envMapIntensity: 1.9
      }, vinylNormalMap);
      this.materials.push(swanMat);

      const torusGeo = new THREE.TorusGeometry(outerR, tubeR, 36, 72);
      torusGeo.rotateX(Math.PI / 2);
      const torusMesh = new THREE.Mesh(torusGeo, swanMat);
      torusMesh.castShadow = true;
      torusMesh.receiveShadow = true;
      prepareDeformable(torusMesh, 'ring');
      this.group.add(torusMesh);
      this.deformMeshes.push(torusMesh);
      this.mainMesh = torusMesh;

      this._addWeldedSeams(outerR, tubeR, 0xffffff, vinylNormalMap);

      // Sculpted layered translucent vinyl wing bolsters on left & right + tail feathers
      [-1, 1].forEach((side) => {
        const wingCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(side * (outerR * 0.72), 0.22, -0.35),
          new THREE.Vector3(side * (outerR * 1.02), 0.34, 0.02),
          new THREE.Vector3(side * (outerR * 0.84), 0.42, 0.46)
        ]);
        const wingGeo = new THREE.TubeGeometry(wingCurve, 18, 0.145, 16, false);
        wingGeo.scale(0.85, 1.15, 1.0);
        const wingMesh = new THREE.Mesh(wingGeo, swanMat);
        wingMesh.castShadow = true;
        prepareDeformable(wingMesh, 'wing');
        this.group.add(wingMesh);
        this.deformMeshes.push(wingMesh);
      });

      // Tail bolster at +Z
      const tailGeo = new THREE.ConeGeometry(0.24, 0.42, 20);
      tailGeo.rotateX(0.65);
      const tailMesh = new THREE.Mesh(tailGeo, swanMat);
      tailMesh.position.set(0, 0.30, outerR * 0.94);
      prepareDeformable(tailMesh, 'wing');
      this.group.add(tailMesh);
      this.deformMeshes.push(tailMesh);

      // Graceful S-curved Swan Neck & Golden Translucent Vinyl Beak at -Z
      const neckGroup = new THREE.Group();
      neckGroup.position.set(0, 0.18, -outerR * 0.92);
      this.neckGroup = neckGroup;

      const neckCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.0, 0.0),
        new THREE.Vector3(0, 0.34, -0.18),
        new THREE.Vector3(0, 0.72, -0.05),
        new THREE.Vector3(0, 0.96, -0.14),
        new THREE.Vector3(0, 0.92, -0.30)
      ]);
      const neckGeo = new THREE.TubeGeometry(neckCurve, 26, 0.125, 18, false);
      const nPos = neckGeo.attributes.position;
      const tmpN = new THREE.Vector3();
      const cN = new THREE.Vector3();
      for (let vi = 0; vi < nPos.count; vi++) {
        const u = Math.min(1, Math.floor(vi / 19) / 26);
        neckCurve.getPointAt(u, cN);
        tmpN.fromBufferAttribute(nPos, vi);
        const rScale = u < 0.75 ? 1.0 - u * 0.25 : 0.82 + Math.sin((u - 0.75) * 12) * 0.16;
        tmpN.sub(cN).multiplyScalar(rScale).add(cN);
        nPos.setXYZ(vi, tmpN.x, tmpN.y, tmpN.z);
      }
      neckGeo.computeVertexNormals();
      const neckMesh = new THREE.Mesh(neckGeo, swanMat);
      neckMesh.castShadow = true;
      neckGroup.add(neckMesh);

      const headSphere = new THREE.Mesh(new THREE.SphereGeometry(0.145, 22, 18), swanMat);
      headSphere.position.set(0, 0.91, -0.28);
      neckGroup.add(headSphere);

      const beakMat = createVinylMaterial({
        color: 0xffa62b,
        attenuationColor: 0xff7700,
        transmission: 0.74,
        thickness: 0.35
      }, vinylNormalMap);
      this.materials.push(beakMat);

      const beakGeo = new THREE.ConeGeometry(0.075, 0.22, 18);
      beakGeo.rotateX(-Math.PI * 0.56);
      const beak = new THREE.Mesh(beakGeo, beakMat);
      beak.position.set(0, 0.87, -0.44);
      neckGroup.add(beak);

      // Friendly sleeping/smiling curved eyelashes on swan head
      const eyeMat = new THREE.MeshPhysicalMaterial({ color: 0x222222, roughness: 0.05, clearcoat: 1.0 });
      [-1, 1].forEach((side) => {
        const eyeArc = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.008, 8, 16, Math.PI), eyeMat);
        eyeArc.rotation.y = side * Math.PI * 0.48;
        eyeArc.position.set(side * 0.125, 0.93, -0.29);
        neckGroup.add(eyeArc);
      });

      this.group.add(neckGroup);

      // Internal shimmering gold confetti specks inside the translucent swan tube!
      const goldFlakeMat = new THREE.MeshStandardMaterial({
        color: 0xffdf6b,
        metalness: 0.85,
        roughness: 0.15,
        side: THREE.DoubleSide
      });
      const flakeGeo = new THREE.CircleGeometry(0.032, 6);
      for (let i = 0; i < 28; i++) {
        const a = (i / 28) * Math.PI * 2;
        const f = new THREE.Mesh(flakeGeo, goldFlakeMat);
        const rr = outerR + (Math.random() - 0.5) * 0.28;
        f.position.set(Math.cos(a) * rr, (Math.random() - 0.5) * 0.18, Math.sin(a) * rr);
        f.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
        this.group.add(f);
        this.confettiItems.push({ mesh: f, baseY: f.position.y, phase: i * 1.3 });
      }
    } else {
      // 'donut': Translucent golden-amber + glossy strawberry glaze vinyl + colorful 3D internal confetti beads!
      const donutMat = createVinylMaterial({
        color: 0xffffff,
        map: donutTex,
        attenuationColor: 0xff5a8a,
        attenuationDistance: 0.80,
        transmission: 0.62,
        thickness: 0.58
      }, vinylNormalMap);
      this.materials.push(donutMat);

      const torusGeo = new THREE.TorusGeometry(outerR * 0.96, tubeR * 1.04, 36, 72);
      torusGeo.rotateX(Math.PI / 2);
      const torusMesh = new THREE.Mesh(torusGeo, donutMat);
      torusMesh.castShadow = true;
      torusMesh.receiveShadow = true;
      prepareDeformable(torusMesh, 'ring');
      this.group.add(torusMesh);
      this.deformMeshes.push(torusMesh);
      this.mainMesh = torusMesh;

      this._addWeldedSeams(outerR * 0.96, tubeR * 1.04, 0xff8ab5, vinylNormalMap);

      // Internal colorful glossy beads inside the translucent donut chamber!
      const beadColors = [0xffe066, 0x4dabf7, 0x69db7c, 0xff8787, 0xffffff];
      const beadGeo = new THREE.CapsuleGeometry(0.022, 0.048, 6, 10);
      for (let i = 0; i < 34; i++) {
        const bMat = new THREE.MeshPhysicalMaterial({
          color: beadColors[i % beadColors.length],
          roughness: 0.08,
          clearcoat: 1.0
        });
        const bead = new THREE.Mesh(beadGeo, bMat);
        const a = (i / 34) * Math.PI * 2 + Math.random() * 0.12;
        const rr = outerR * 0.96 + (Math.random() - 0.5) * 0.30;
        bead.position.set(Math.cos(a) * rr, -0.06 + Math.random() * 0.14, Math.sin(a) * rr);
        bead.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
        this.group.add(bead);
        this.confettiItems.push({ mesh: bead, baseY: bead.position.y, phase: i * 0.9 });
      }
    }

    // Clear glossy PVC Air Valve with hinged stopper cap (at front-right of float so child sees & reaches it easily!)
    this._buildClearAirValve(outerR, tubeR);
  }

  _addWeldedSeams(outerR, tubeR, seamColor, vinylNormalMap) {
    const seamMat = createVinylMaterial({
      color: seamColor,
      transmission: 0.82,
      thickness: 0.08,
      roughness: 0.06
    }, vinylNormalMap);
    this.materials.push(seamMat);

    // Thin outer & inner pinched PVC flange rings
    const outerFlangeGeo = new THREE.RingGeometry(outerR + tubeR - 0.005, outerR + tubeR + 0.026, 72);
    outerFlangeGeo.rotateX(-Math.PI / 2);
    const outerFlange = new THREE.Mesh(outerFlangeGeo, seamMat);
    outerFlange.material.side = THREE.DoubleSide;

    const innerFlangeGeo = new THREE.RingGeometry(Math.max(0.1, outerR - tubeR - 0.024), outerR - tubeR + 0.005, 64);
    innerFlangeGeo.rotateX(-Math.PI / 2);
    const innerFlange = new THREE.Mesh(innerFlangeGeo, seamMat);
    innerFlange.material.side = THREE.DoubleSide;

    this.seamGroup = new THREE.Group();
    this.seamGroup.add(outerFlange, innerFlange);
    this.group.add(this.seamGroup);
  }

  _buildClearAirValve(outerR, tubeR) {
    const clearValveMat = new THREE.MeshPhysicalMaterial({
      color: 0xeef8ff,
      roughness: 0.05,
      transmission: 0.85,
      thickness: 0.15,
      ior: 1.5,
      clearcoat: 1.0
    });

    this.valveGroup = new THREE.Group();
    const vAng = Math.PI * 0.28; // front-right side facing camera
    this.valveAngle = vAng;
    this.valveBaseRadius = outerR + tubeR * 0.58;

    // Welded circular base patch
    const patch = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.075, 0.012, 20), clearValveMat);
    // Nozzle stem
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.034, 0.065, 18), clearValveMat);
    stem.position.y = 0.035;

    // Hinged cap plug
    this.valveCapPivot = new THREE.Group();
    this.valveCapPivot.position.set(0.034, 0.066, 0);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.036, 0.018, 18), clearValveMat);
    cap.position.set(-0.034, 0.008, 0);
    const tab = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.008, 0.022), clearValveMat);
    tab.position.set(-0.062, 0.008, 0);
    this.valveCapPivot.add(cap, tab);

    this.valveGroup.add(patch, stem, this.valveCapPivot);
    this.valveGroup.position.set(
      Math.cos(vAng) * this.valveBaseRadius,
      0.16,
      Math.sin(vAng) * this.valveBaseRadius
    );
    this.valveGroup.rotation.z = -0.45 * Math.cos(vAng);
    this.valveGroup.rotation.x = 0.45 * Math.sin(vAng);
    this.group.add(this.valveGroup);
  }

  getValveWorldPosition(target = new THREE.Vector3()) {
    this.group.updateMatrixWorld(true);
    return this.valveGroup.getWorldPosition(target);
  }

  triggerPoke(worldPoint, strength = 1.0) {
    this.group.updateMatrixWorld(true);
    this.pokeLocal.copy(worldPoint);
    this.group.worldToLocal(this.pokeLocal);
    this.targetPokeStrength = Math.min(1.3, strength);
    this.pokeStrength = Math.max(this.pokeStrength, strength * 0.85);
    this.wobbleAmp = Math.min(1.0, this.wobbleAmp + 0.35 * strength);
  }

  releasePoke() {
    this.targetPokeStrength = 0;
  }

  addSticker(stickerColor, worldPoint) {
    if (this.stickers.length >= 8) return;
    const localPt = this.group.worldToLocal(worldPoint.clone());
    const decalMat = new THREE.MeshPhysicalMaterial({
      color: stickerColor,
      roughness: 0.06,
      clearcoat: 1.0,
      polygonOffset: true,
      polygonOffsetFactor: -2
    });
    // Cute 5-point puffy vinyl star/flower decal
    const starShape = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 0.085 : 0.042;
      const a = (i / 10) * Math.PI * 2;
      if (i === 0) starShape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else starShape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    starShape.closePath();
    const geo = new THREE.ExtrudeGeometry(starShape, {
      depth: 0.008,
      bevelEnabled: true,
      bevelThickness: 0.005,
      bevelSize: 0.005,
      bevelSegments: 3
    });
    const sticker = new THREE.Mesh(geo, decalMat);
    sticker.position.copy(localPt);
    sticker.lookAt(localPt.clone().multiplyScalar(2).add(new THREE.Vector3(0, 1.2, 0)));
    this.group.add(sticker);
    this.stickers.push(sticker);
  }

  // Real-time soft-body vertex deformation driven by air pressure, poke indentation, and elastic wobble
  updateDeformation(dt, elapsed) {
    const p = Math.max(0.0, Math.min(1.25, this.pressure));
    // Nonlinear fullness curve: 0 -> flat sheet (0.13 height), 0.85 -> plump round (1.0), 1.1 -> taut stretched (1.12)
    const inflateY = 0.13 + Math.pow(Math.min(1.15, p), 0.72) * 0.90;
    const inflateXZ = 1.06 - Math.min(1.0, p) * 0.06 + Math.max(0, p - 0.92) * 0.22;
    const crumpleAmt = Math.max(0, 1.0 - p * 1.28);

    // Smooth crease normal map as vinyl stretches taut!
    const wrinkleStrength = THREE.MathUtils.lerp(0.05, 1.18, Math.pow(crumpleAmt, 1.2));
    for (const mat of this.materials) {
      if (mat.normalScale) {
        mat.normalScale.set(wrinkleStrength, wrinkleStrength);
      }
      // Slightly brighter glossy sheen when stretched drum-tight
      mat.roughness = THREE.MathUtils.lerp(0.025, 0.085, crumpleAmt);
    }

    // Damped spring wobble & poke relaxation
    this.wobbleTime += dt * (11.0 + p * 9.0);
    this.wobbleAmp *= Math.pow(0.06, dt);
    this.pokeStrength += (this.targetPokeStrength - this.pokeStrength) * Math.min(1, dt * 14);

    // Valve cap open/close angle
    const targetCapAngle = (this.valveOpen || this.releasingAir > 0) ? -2.1 : 0.0;
    this.valveCapPivot.rotation.z += (targetCapAngle - this.valveCapPivot.rotation.z) * Math.min(1, dt * 14);

    // Deform vertex buffers
    for (const mesh of this.deformMeshes) {
      const pos = mesh.geometry.attributes.position;
      const base = mesh.userData.basePos;
      const bNorm = mesh.userData.baseNorm;
      const count = pos.count;

      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        let bx = base[i3];
        let by = base[i3 + 1];
        let bz = base[i3 + 2];
        const nx = bNorm[i3];
        const ny = bNorm[i3 + 1];
        const nz = bNorm[i3 + 2];

        const ang = Math.atan2(bz, bx);
        const rad = Math.sqrt(bx * bx + bz * bz);

        // Deflated PVC fold waves
        const foldY = crumpleAmt * (Math.sin(ang * 5.0 + 0.8) * 0.042 + Math.cos(ang * 3.0 - 0.4) * 0.032);
        const foldR = crumpleAmt * (Math.sin(ang * 4.0 + 1.5) * 0.055 + Math.cos(ang * 7.0) * 0.024);

        let x = bx * inflateXZ + Math.cos(ang) * foldR;
        let y = by * inflateY + foldY;
        let z = bz * inflateXZ + Math.sin(ang) * foldR;

        // Elastic volume-conserving wobble
        if (this.wobbleAmp > 0.002) {
          const w = Math.sin(this.wobbleTime + ang * 2.0 + rad * 4.0) * this.wobbleAmp * 0.048;
          x += nx * w;
          y -= ny * w * 1.25;
          z += nz * w;
        }

        // Local finger press indentation + surrounding air bulge!
        if (this.pokeStrength > 0.005) {
          const dx = x - this.pokeLocal.x;
          const dy = y - this.pokeLocal.y;
          const dz = z - this.pokeLocal.z;
          const d2 = dx * dx + dy * dy + dz * dz;
          const indent = Math.exp(-d2 / 0.085) * this.pokeStrength * 0.16;
          const rimBulge = Math.exp(-Math.pow((Math.sqrt(d2) - 0.36) / 0.16, 2.0)) * this.pokeStrength * 0.042;
          const delta = rimBulge - indent;
          x += nx * delta;
          y += ny * delta;
          z += nz * delta;
        }

        // Prevent sinking below floor plane in local space (tube bottom sits at ~ -0.31 * inflateY)
        pos.setXYZ(i, x, y, z);
      }
      pos.needsUpdate = true;
      mesh.geometry.computeVertexNormals();
    }

    // Update welded seam height & scale
    if (this.seamGroup) {
      this.seamGroup.scale.set(inflateXZ, 1, inflateXZ);
      this.seamGroup.position.y = Math.sin(this.wobbleTime) * this.wobbleAmp * 0.015;
    }

    // Update valve position on surface
    this.valveGroup.position.set(
      Math.cos(this.valveAngle) * this.valveBaseRadius * inflateXZ,
      0.17 * inflateY,
      Math.sin(this.valveAngle) * this.valveBaseRadius * inflateXZ
    );

    // Sub-part organic animations
    if (this.type === 'octopus') {
      if (this.headGroup) {
        this.headGroup.position.y = 0.06 + inflateY * 0.25;
        const hScale = 0.55 + Math.min(1.15, p) * 0.48;
        this.headGroup.scale.set(
          hScale * (1 + Math.sin(this.wobbleTime * 1.2) * this.wobbleAmp * 0.08),
          0.32 + inflateY * 0.70,
          hScale
        );
        // Slump head slightly forward when deflated
        this.headGroup.rotation.x = crumpleAmt * 0.55;
      }
      for (const t of this.tentacles) {
        t.pivot.position.set(
          Math.cos(t.baseAng) * (0.78 + 0.31 * 0.62) * inflateXZ,
          -0.05 * (1 - inflateY),
          Math.sin(t.baseAng) * (0.78 + 0.31 * 0.62) * inflateXZ
        );
        const plump = 0.48 + Math.min(1.15, p) * 0.55;
        t.pivot.scale.set(plump, 0.25 + inflateY * 0.78, plump);
        // Uncurl upward with pressure + gentle lively wiggle
        t.pivot.rotation.z = -crumpleAmt * 0.52 + Math.sin(elapsed * 2.2 + t.phase) * (0.04 + p * 0.05) + Math.sin(this.wobbleTime + t.phase) * this.wobbleAmp * 0.18;
      }
    } else if (this.type === 'swan' && this.neckGroup) {
      // Swan neck rises dramatically from slumped deflated pose to proud graceful S-curve!
      this.neckGroup.position.y = 0.04 + inflateY * 0.16;
      const neckStand = Math.min(1.0, Math.pow(p / 0.78, 0.85));
      this.neckGroup.rotation.x = (1.0 - neckStand) * 1.18 + Math.sin(this.wobbleTime) * this.wobbleAmp * 0.14;
      this.neckGroup.rotation.z = (1.0 - neckStand) * 0.35 + Math.cos(elapsed * 1.6) * 0.025;
      const nScale = 0.55 + neckStand * 0.45;
      this.neckGroup.scale.set(nScale, 0.42 + neckStand * 0.58, nScale);
    }

    // Internal confetti/beads float & jiggle inside translucent chamber!
    for (const c of this.confettiItems) {
      c.mesh.position.y = c.baseY * inflateY + Math.sin(elapsed * 2.5 + c.phase) * 0.02 * p + Math.sin(this.wobbleTime * 1.4 + c.phase) * this.wobbleAmp * 0.06;
      c.mesh.rotation.x += dt * (0.4 + this.wobbleAmp * 4.0);
      c.mesh.rotation.y += dt * (0.6 + this.wobbleAmp * 3.0);
    }

    // Giant scale multiplier (for Scene 2 colossal Octopus!)
    this.group.scale.setScalar(this.giantScale);
  }

  getBottomHalfHeight() {
    const p = Math.max(0.0, Math.min(1.25, this.pressure));
    const inflateY = 0.13 + Math.pow(Math.min(1.15, p), 0.72) * 0.90;
    return 0.31 * inflateY * this.giantScale;
  }
}

// Tactile 3D Air Pumps: Yellow Foot Bellows Pump & Blue Hand Cylinder Pump + Flexible Ribbed Hose
export class AirPump {
  constructor(pumpType = 'bellows') {
    this.pumpType = pumpType; // 'bellows' | 'cylinder' | 'turbo'
    this.group = new THREE.Group();
    this.compression = 0; // 0 = up, 1 = pressed down
    this.connectedFloat = null;
    this.nozzleWorldPos = new THREE.Vector3();

    this._build();
  }

  _build() {
    if (this.pumpType === 'bellows') {
      // Iconic Yellow & Blue Accordion Foot/Hand Bellows Pump!
      const yellowPlastic = new THREE.MeshPhysicalMaterial({
        color: 0xffcc18,
        roughness: 0.22,
        clearcoat: 0.65,
        clearcoatRoughness: 0.15
      });
      const blueVinyl = new THREE.MeshPhysicalMaterial({
        color: 0x1c7ed6,
        roughness: 0.35,
        clearcoat: 0.3
      });

      const bottomPlate = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.25, 0.03, 28), yellowPlastic);
      bottomPlate.scale.set(1.25, 1, 0.92);
      bottomPlate.position.y = 0.015;
      bottomPlate.castShadow = true;
      bottomPlate.receiveShadow = true;
      this.group.add(bottomPlate);

      // Accordion bellows rings
      this.bellowsMesh = new THREE.Group();
      for (let i = 0; i < 4; i++) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.185 - i * 0.008, 0.034, 14, 28), blueVinyl);
        ring.rotation.x = Math.PI / 2;
        ring.scale.set(1.22, 0.9, 1.0);
        ring.position.y = 0.055 + i * 0.048;
        ring.castShadow = true;
        this.bellowsMesh.add(ring);
      }
      this.group.add(this.bellowsMesh);

      this.topPlate = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.032, 28), yellowPlastic);
      this.topPlate.scale.set(1.25, 1, 0.92);
      this.topPlate.position.y = 0.26;
      this.topPlate.rotation.z = 0.18;
      this.topPlate.castShadow = true;
      // Grip ridges on top plate
      for (let r = -2; r <= 2; r++) {
        const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.012, 0.28), blueVinyl);
        ridge.position.set(r * 0.065, 0.02, 0);
        this.topPlate.add(ridge);
      }
      this.group.add(this.topPlate);

      this.hoseOriginLocal = new THREE.Vector3(0.28, 0.06, 0);
    } else if (this.pumpType === 'cylinder') {
      // Tall High-Flow Blue Double-Action Hand Cylinder Pump with Ergonomic T-Handle!
      const bodyMat = new THREE.MeshPhysicalMaterial({
        color: 0x228be6,
        roughness: 0.18,
        clearcoat: 0.75
      });
      const darkMat = new THREE.MeshPhysicalMaterial({
        color: 0x212529,
        roughness: 0.32,
        clearcoat: 0.3
      });
      const rodMat = new THREE.MeshStandardMaterial({
        color: 0xdee2e6,
        metalness: 0.85,
        roughness: 0.18
      });

      const base = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.032, 0.18), darkMat);
      base.position.y = 0.016;
      base.castShadow = true;
      const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.082, 0.56, 24), bodyMat);
      cylinder.position.y = 0.30;
      cylinder.castShadow = true;
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.092, 0.092, 0.045, 24), darkMat);
      cap.position.y = 0.58;

      this.plungerGroup = new THREE.Group();
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.48, 16), rodMat);
      rod.position.y = 0.62;
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.34, 16), darkMat);
      handle.rotation.z = Math.PI / 2;
      handle.position.y = 0.86;
      handle.castShadow = true;
      this.plungerGroup.add(rod, handle);

      this.group.add(base, cylinder, cap, this.plungerGroup);
      this.hoseOriginLocal = new THREE.Vector3(-0.09, 0.10, 0.05);
    } else {
      // Dad's Red/Orange Electric Turbo Blower (Scene 2 mishap prop!)
      const blowerMat = new THREE.MeshPhysicalMaterial({
        color: 0xf76707,
        roughness: 0.2,
        clearcoat: 0.7
      });
      const grillMat = new THREE.MeshStandardMaterial({ color: 0x2b2d42, roughness: 0.4, metalness: 0.5 });
      const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.20, 0.22, 24), blowerMat);
      housing.rotation.x = Math.PI / 2;
      housing.position.y = 0.22;
      housing.castShadow = true;
      const snoot = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.22, 18), grillMat);
      snoot.rotation.z = Math.PI / 2;
      snoot.position.set(-0.22, 0.30, 0);
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.022, 10, 18, Math.PI), grillMat);
      handle.position.set(0.02, 0.41, 0);
      this.group.add(housing, snoot, handle);
      this.hoseOriginLocal = new THREE.Vector3(-0.32, 0.30, 0);
    }

    // Flexible Corrugated Hose + Snap-On Nozzle Tip
    this.hoseMat = new THREE.MeshPhysicalMaterial({
      color: this.pumpType === 'bellows' ? 0x1971c2 : 0x343a40,
      roughness: 0.38,
      clearcoat: 0.25
    });
    const initCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.1, 0),
      new THREE.Vector3(0.2, 0.05, 0.1),
      new THREE.Vector3(0.4, 0.04, 0.2),
      new THREE.Vector3(0.55, 0.08, 0.25)
    ]);
    this.hoseMesh = new THREE.Mesh(new THREE.TubeGeometry(initCurve, 22, 0.024, 10, false), this.hoseMat);
    this.hoseMesh.castShadow = true;

    // Bright Nozzle Tip (easy to grab & drag onto any float!)
    const nozzleMat = new THREE.MeshPhysicalMaterial({
      color: this.pumpType === 'bellows' ? 0xffd43b : 0x4dabf7,
      roughness: 0.15,
      clearcoat: 0.85
    });
    this.nozzleMesh = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.11, 16), nozzleMat);
    this.nozzleMesh.castShadow = true;

    this.hoseWorldGroup = new THREE.Group();
    this.hoseWorldGroup.add(this.hoseMesh, this.nozzleMesh);
  }

  updateVisuals(customNozzlePos = null) {
    // Update pump body compression
    const c = Math.max(0, Math.min(1, this.compression));
    if (this.pumpType === 'bellows') {
      this.bellowsMesh.scale.y = 1.0 - c * 0.58;
      this.bellowsMesh.position.y = c * -0.01;
      this.topPlate.position.y = 0.26 - c * 0.145;
      this.topPlate.rotation.z = 0.18 * (1.0 - c * 0.85);
    } else if (this.pumpType === 'cylinder' && this.plungerGroup) {
      this.plungerGroup.position.y = -c * 0.34;
    }

    // Update flexible hose curve in world space
    this.group.updateMatrixWorld(true);
    const startW = this.hoseOriginLocal.clone().applyMatrix4(this.group.matrixWorld);

    const endW = new THREE.Vector3();
    if (customNozzlePos) {
      endW.copy(customNozzlePos);
    } else if (this.connectedFloat) {
      this.connectedFloat.getValveWorldPosition(endW);
      endW.y += 0.055;
    } else {
      endW.copy(startW).add(new THREE.Vector3(this.pumpType === 'bellows' ? 0.35 : -0.35, -0.02, 0.28));
      endW.y = Math.max(0.05, endW.y);
    }
    this.nozzleWorldPos.copy(endW);

    const mid1 = startW.clone().lerp(endW, 0.33);
    mid1.y = Math.max(0.035, Math.min(startW.y, endW.y) - 0.06);
    mid1.z += 0.12;
    const mid2 = startW.clone().lerp(endW, 0.68);
    mid2.y = Math.max(0.04, endW.y + 0.09);

    const curve = new THREE.CatmullRomCurve3([startW, mid1, mid2, endW]);
    this.hoseMesh.geometry.dispose();
    this.hoseMesh.geometry = new THREE.TubeGeometry(curve, 20, 0.023, 10, false);

    this.nozzleMesh.position.copy(endW);
    if (this.connectedFloat) {
      this.nozzleMesh.rotation.set(Math.PI, 0, 0);
    } else {
      const tangent = curve.getTangent(1.0);
      this.nozzleMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
    }
  }
}
