import * as THREE from 'three';
import { RoundedBoxGeometry } from '../vendor/RoundedBoxGeometry.js';
import {
  createCrystalGlassMaterial,
  applySubsurfaceScattering,
  createLayeredLiquidMaterial,
  createAdaptiveLiquidGeometry,
} from './materials.js';

// Fruit catalog with physical optical, color, viscosity, and flavor properties
export const FRUIT_CATALOG = [
  {
    id: 'strawberry',
    color: 0xd91936,
    sss: 0xff3b52,
    pulpBase: 0.72,
    density: 1.06,
    acidity: 0.25,
    sweetness: 0.75,
    mass: 1.0,
  },
  {
    id: 'orange',
    color: 0xf57d14,
    sss: 0xffaa2b,
    pulpBase: 0.65,
    density: 1.04,
    acidity: 0.35,
    sweetness: 0.68,
    mass: 1.05,
  },
  {
    id: 'mango',
    color: 0xf4b616,
    sss: 0xffdc4a,
    pulpBase: 0.48,
    density: 1.12, // Thick tropical nectar sinks nicely for bottom layers!
    acidity: 0.12,
    sweetness: 0.92,
    mass: 1.15,
  },
  {
    id: 'kiwi',
    color: 0x45b526,
    sss: 0x8cff4d,
    pulpBase: 0.85,
    density: 1.03,
    acidity: 0.38,
    sweetness: 0.58,
    mass: 0.95,
  },
  {
    id: 'blueberry',
    color: 0x4e259e,
    sss: 0x9b5cff,
    pulpBase: 0.55,
    density: 1.08,
    acidity: 0.22,
    sweetness: 0.70,
    mass: 0.85,
  },
  {
    id: 'lemon',
    color: 0xebdb23,
    sss: 0xfff86b,
    pulpBase: 0.42,
    density: 1.01,
    acidity: 0.95,
    sweetness: 0.12,
    mass: 0.95,
  },
];

// Shared adaptive liquid geometry (reused across all cups/carafes/blender -> super low memory & draw overhead!)
let sharedLiquidGeo = null;
function getSharedLiquidGeo() {
  if (!sharedLiquidGeo) {
    sharedLiquidGeo = createAdaptiveLiquidGeometry(36, 26, 5);
  }
  return sharedLiquidGeo;
}

// Builds a thick-walled crystal glass + interior adaptive multi-layer liquid + exterior 3D condensation beads
export function createGlassCupAssembly(condensationTex, variant = 'parfait') {
  const group = new THREE.Group();

  const points = [];
  let cavityBottomY = 0.14;
  let cavityHeight = 0.92;
  let radiusScale = 1.0;

  if (variant === 'parfait') {
    cavityBottomY = 0.26;
    cavityHeight = 0.96;
    // Footed crystal hurricane/parfait glass with thick refractive stem & base!
    points.push(new THREE.Vector2(0.001, 0.0));
    points.push(new THREE.Vector2(0.28, 0.0));
    points.push(new THREE.Vector2(0.29, 0.025));
    points.push(new THREE.Vector2(0.11, 0.065));
    points.push(new THREE.Vector2(0.072, 0.13));
    points.push(new THREE.Vector2(0.088, 0.20));
    points.push(new THREE.Vector2(0.21, 0.25));
    // Outer wall upward
    for (let i = 0; i <= 24; i++) {
      const h = i / 24;
      const y = cavityBottomY + h * (cavityHeight + 0.03);
      const waist = -0.055 * Math.sin(h * Math.PI * 1.15);
      const flare = 0.245 + 0.095 * (h * h * (3 - 2 * h)) + waist + 0.045 * Math.pow(h, 2.2);
      const bottomRound = Math.min(1, h / 0.08) * 0.32 + 0.68;
      const rOuter = flare * bottomRound + 0.022;
      points.push(new THREE.Vector2(rOuter, y));
    }
    // Rounded polished glass lip!
    const topOuter = points[points.length - 1].x;
    const topY = cavityBottomY + cavityHeight + 0.035;
    points.push(new THREE.Vector2(topOuter - 0.006, topY + 0.012));
    points.push(new THREE.Vector2(topOuter - 0.018, topY + 0.008));
    // Inner wall downward
    for (let i = 24; i >= 0; i--) {
      const h = i / 24;
      const y = cavityBottomY + h * (cavityHeight + 0.025);
      const waist = -0.055 * Math.sin(h * Math.PI * 1.15);
      const flare = 0.245 + 0.095 * (h * h * (3 - 2 * h)) + waist + 0.045 * Math.pow(h, 2.2);
      const bottomRound = Math.min(1, h / 0.08) * 0.32 + 0.68;
      const rInner = Math.max(0.01, flare * bottomRound + 0.003);
      points.push(new THREE.Vector2(rInner, y));
    }
    points.push(new THREE.Vector2(0.001, cavityBottomY - 0.005));
  } else if (variant === 'carafe') {
    cavityBottomY = 0.06;
    cavityHeight = 0.56;
    radiusScale = 0.85;
    points.push(new THREE.Vector2(0.001, 0.0));
    points.push(new THREE.Vector2(0.18, 0.0));
    for (let i = 0; i <= 18; i++) {
      const h = i / 18;
      const y = cavityBottomY + h * (cavityHeight + 0.04);
      const s = h > 0.55 ? Math.min(1, (h - 0.55) / 0.3) : 0;
      const f = h > 0.85 ? Math.min(1, (h - 0.85) / 0.15) : 0;
      const belly = 0.21 + 0.055 * Math.sin(h * Math.PI * 0.95) - 0.03 * s + 0.035 * f;
      const r = belly * (0.78 + 0.22 * Math.min(1, h / 0.07)) * radiusScale + 0.018;
      points.push(new THREE.Vector2(r, y));
    }
    const lipX = points[points.length - 1].x;
    const lipY = cavityBottomY + cavityHeight + 0.045;
    points.push(new THREE.Vector2(lipX - 0.014, lipY + 0.008));
    for (let i = 18; i >= 0; i--) {
      const h = i / 18;
      const y = cavityBottomY + h * (cavityHeight + 0.035);
      const s = h > 0.55 ? Math.min(1, (h - 0.55) / 0.3) : 0;
      const f = h > 0.85 ? Math.min(1, (h - 0.85) / 0.15) : 0;
      const belly = 0.21 + 0.055 * Math.sin(h * Math.PI * 0.95) - 0.03 * s + 0.035 * f;
      const r = belly * (0.78 + 0.22 * Math.min(1, h / 0.07)) * radiusScale + 0.002;
      points.push(new THREE.Vector2(r, y));
    }
    points.push(new THREE.Vector2(0.001, cavityBottomY));
  } else {
    // 'party' crystal heavy-bottom tumbler (thick solid glass sham at bottom!)
    cavityBottomY = 0.14;
    cavityHeight = 0.58;
    radiusScale = 0.84;
    points.push(new THREE.Vector2(0.001, 0.0));
    points.push(new THREE.Vector2(0.195, 0.0));
    for (let i = 0; i <= 16; i++) {
      const h = i / 16;
      const y = cavityBottomY + h * (cavityHeight + 0.03) - (1 - h) * 0.11;
      const r = (0.21 + 0.065 * h) * (0.82 + 0.18 * Math.min(1, h / 0.06)) * radiusScale + 0.022;
      points.push(new THREE.Vector2(r, Math.max(0.02, y)));
    }
    const lipX = points[points.length - 1].x;
    const lipY = cavityBottomY + cavityHeight + 0.036;
    points.push(new THREE.Vector2(lipX - 0.015, lipY + 0.006));
    for (let i = 16; i >= 0; i--) {
      const h = i / 16;
      const y = cavityBottomY + h * (cavityHeight + 0.025);
      const r = (0.21 + 0.065 * h) * (0.82 + 0.18 * Math.min(1, h / 0.06)) * radiusScale + 0.002;
      points.push(new THREE.Vector2(r, y));
    }
    points.push(new THREE.Vector2(0.001, cavityBottomY));
  }

  const glassGeo = new THREE.LatheGeometry(points, variant === 'parfait' ? 56 : 40);
  // Subtle spout pinch on carafe rim (+X side)
  if (variant === 'carafe') {
    const pos = glassGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      if (y > cavityBottomY + cavityHeight - 0.06 && x > 0.08) {
        const spoutFactor = Math.max(0, 1 - Math.abs(z) / 0.09) * ((y - (cavityBottomY + cavityHeight - 0.06)) / 0.1);
        pos.setX(i, x + spoutFactor * 0.042);
        pos.setY(i, y + spoutFactor * 0.016);
      }
    }
    glassGeo.computeVertexNormals();
  }

  const glassMat = createCrystalGlassMaterial(condensationTex, {
    thickness: variant === 'parfait' ? 0.085 : 0.065,
    bumpScale: variant === 'parfait' ? 0.0014 : 0.0009,
  });
  const glassMesh = new THREE.Mesh(glassGeo, glassMat);
  glassMesh.renderOrder = 3;

  // Interior adaptive multi-layer liquid mesh
  const liquidMat = createLayeredLiquidMaterial(variant);
  liquidMat.uniforms.uRadiusScale.value = radiusScale;
  liquidMat.uniforms.uHeightScale.value = cavityHeight;
  const liquidMesh = new THREE.Mesh(getSharedLiquidGeo(), liquidMat);
  liquidMesh.position.y = cavityBottomY;
  liquidMesh.renderOrder = 1;

  group.add(liquidMesh);
  group.add(glassMesh);

  // Add glass handle on mini carafe so child immediately sees "grab & tilt to pour!" affordance!
  if (variant === 'carafe') {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.18, 0.54, 0),
      new THREE.Vector3(-0.31, 0.50, 0),
      new THREE.Vector3(-0.32, 0.31, 0),
      new THREE.Vector3(-0.19, 0.20, 0),
    ]);
    const handleGeo = new THREE.TubeGeometry(curve, 20, 0.022, 12, false);
    const handleMesh = new THREE.Mesh(handleGeo, glassMat);
    handleMesh.renderOrder = 3;
    group.add(handleMesh);
  }

  // Real 3D specular condensation water droplets flush on hero parfait glass exterior!
  if (variant === 'parfait') {
    const dropGeo = new THREE.SphereGeometry(0.008, 8, 6);
    dropGeo.scale(1.0, 1.25, 0.55);
    const dropCount = 42;
    const dropInst = new THREE.InstancedMesh(dropGeo, glassMat, dropCount);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < dropCount; i++) {
      const h = 0.08 + Math.random() * 0.78;
      const y = cavityBottomY + h * cavityHeight;
      const waist = -0.055 * Math.sin(h * Math.PI * 1.15);
      const flare = 0.245 + 0.095 * (h * h * (3 - 2 * h)) + waist + 0.045 * Math.pow(h, 2.2);
      const bottomRound = Math.min(1, h / 0.08) * 0.32 + 0.68;
      const r = flare * bottomRound + 0.019;
      const ang = Math.random() * Math.PI * 2;
      dummy.position.set(Math.cos(ang) * r, y, Math.sin(ang) * r);
      dummy.rotation.set(0, -ang + Math.PI * 0.5, 0);
      const s = 0.55 + Math.random() * 1.05;
      dummy.scale.set(s, s * (0.9 + Math.random() * 0.5), s);
      dummy.updateMatrix();
      dropInst.setMatrixAt(i, dummy.matrix);
    }
    dropInst.renderOrder = 4;
    group.add(dropInst);
  }

  // Colored Refractive Table Caustic Pool directly beneath crystal glass foot!
  const causticMat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(0xd91936) },
      uStrength: { value: 0.0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uStrength;
      varying vec2 vUv;
      void main() {
        vec2 p = (vUv - 0.5) * 2.0;
        float r = length(p);
        if (r > 1.0 || uStrength < 0.01) discard;
        float ang = atan(p.y, p.x);
        float causticRing = smoothstep(0.18, 0.52, r) * smoothstep(1.0, 0.48, r);
        float rays = 0.72 + 0.28 * sin(ang * 5.0 + r * 6.0);
        float glow = (causticRing * rays + smoothstep(0.65, 0.0, r) * 0.35) * uStrength;
        gl_FragColor = vec4(uColor * glow * 0.85, glow);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const causticDisc = new THREE.Mesh(new THREE.PlaneGeometry(0.82, 0.82), causticMat);
  causticDisc.rotation.x = -Math.PI * 0.5;
  causticDisc.position.set(-0.08, 0.003, 0.09); // Cast forward-left along rim light vector!
  group.add(causticDisc);

  // Generous invisible touch collider so 5yo finger grabs effortlessly
  const hitGeo = new THREE.CylinderGeometry(0.36, 0.32, cavityBottomY + cavityHeight + 0.14, 12);
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  const hitMesh = new THREE.Mesh(hitGeo, hitMat);
  hitMesh.position.y = (cavityBottomY + cavityHeight + 0.1) * 0.5;
  group.add(hitMesh);

  group.userData = {
    variant,
    glassMesh,
    liquidMesh,
    liquidMat,
    causticMat,
    hitMesh,
    cavityBottomY,
    cavityHeight,
    rimY: cavityBottomY + cavityHeight + 0.03,
    rimRadius: variant === 'parfait' ? 0.39 : 0.24,
    layers: [],
    fillLevel: 0,
    foamHeight: 0.03,
    sloshVel: new THREE.Vector2(0, 0),
    sloshPos: new THREE.Vector2(0, 0),
    toppings: [],
  };

  return group;
}

// Sculpted Glass Blender Assembly with spinning steel blades, removable rubber cap, and BIG glowing physical button
export function createBlenderAssembly(condensationTex) {
  const group = new THREE.Group();

  // Brushed dark gunmetal heavy base
  const baseMat = new THREE.MeshStandardMaterial({
    color: 0x1c1e24,
    roughness: 0.28,
    metalness: 0.78,
  });
  const basePts = [
    new THREE.Vector2(0.001, 0.0),
    new THREE.Vector2(0.36, 0.0),
    new THREE.Vector2(0.37, 0.04),
    new THREE.Vector2(0.32, 0.34),
    new THREE.Vector2(0.28, 0.39),
    new THREE.Vector2(0.26, 0.43),
    new THREE.Vector2(0.001, 0.43),
  ];
  const baseMesh = new THREE.Mesh(new THREE.LatheGeometry(basePts, 40), baseMat);
  group.add(baseMesh);

  // Chrome collar ring
  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xe8edf5,
    roughness: 0.12,
    metalness: 0.95,
  });
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.275, 0.285, 0.055, 36), chromeMat);
  collar.position.y = 0.44;
  group.add(collar);

  // BIG inviting tactile glowing pulse button on front of base! (No text, pure physical glowing button!)
  const bezel = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.115, 0.03, 28), chromeMat);
  bezel.rotation.x = Math.PI * 0.42;
  bezel.position.set(0, 0.20, 0.325);
  group.add(bezel);

  const buttonMat = new THREE.MeshPhysicalMaterial({
    color: 0xff2e4c,
    emissive: 0xaa1128,
    emissiveIntensity: 0.55,
    roughness: 0.16,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
  });
  const buttonMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.092, 0.048, 28), buttonMat);
  buttonMesh.rotation.x = Math.PI * 0.42;
  buttonMesh.position.set(0, 0.205, 0.344);
  group.add(buttonMesh);

  // Generous invisible hitbox around the button for effortless 5yo pressing
  const buttonHit = new THREE.Mesh(
    new THREE.SphereGeometry(0.19, 12, 10),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  buttonHit.position.set(0, 0.205, 0.35);
  group.add(buttonHit);

  // Detachable/tiltable Glass Blender Jar sub-group!
  const jarGroup = new THREE.Group();
  jarGroup.position.set(0, 0.46, 0);
  group.add(jarGroup);

  const jarHeight = 0.86;
  const jarPts = [new THREE.Vector2(0.001, 0.0), new THREE.Vector2(0.26, 0.0)];
  for (let i = 0; i <= 16; i++) {
    const h = i / 16;
    jarPts.push(new THREE.Vector2(0.25 + 0.085 * h + 0.022, 0.04 + h * jarHeight));
  }
  jarPts.push(new THREE.Vector2(0.345, 0.052 + jarHeight));
  for (let i = 16; i >= 0; i--) {
    const h = i / 16;
    jarPts.push(new THREE.Vector2(0.25 + 0.085 * h + 0.003, 0.04 + h * jarHeight));
  }
  jarPts.push(new THREE.Vector2(0.001, 0.04));

  const jarGlassMat = createCrystalGlassMaterial(condensationTex, {
    thickness: 0.34,
    bumpScale: 0.0012,
  });
  const jarGlass = new THREE.Mesh(new THREE.LatheGeometry(jarPts, 36), jarGlassMat);
  jarGlass.renderOrder = 3;
  jarGroup.add(jarGlass);

  // Glass handle on right side of blender jar
  const handleCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.32, 0.78, 0),
    new THREE.Vector3(0.49, 0.74, 0),
    new THREE.Vector3(0.48, 0.26, 0),
    new THREE.Vector3(0.28, 0.18, 0),
  ]);
  const jarHandle = new THREE.Mesh(new THREE.TubeGeometry(handleCurve, 18, 0.026, 12, false), jarGlassMat);
  jarHandle.renderOrder = 3;
  jarGroup.add(jarHandle);

  // Stainless steel 4-wing cutter blades inside bottom of jar
  const bladeGroup = new THREE.Group();
  bladeGroup.position.y = 0.075;
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.05, 16), chromeMat);
  bladeGroup.add(hub);
  const wingGeo = new THREE.BoxGeometry(0.28, 0.008, 0.036);
  const wing1 = new THREE.Mesh(wingGeo, chromeMat);
  wing1.rotation.z = 0.18;
  const wing2 = new THREE.Mesh(wingGeo, chromeMat);
  wing2.rotation.y = Math.PI * 0.5;
  wing2.rotation.x = -0.22;
  bladeGroup.add(wing1, wing2);
  jarGroup.add(bladeGroup);

  // Interior adaptive vortex liquid inside blender jar
  const liquidMat = createLayeredLiquidMaterial('blender');
  liquidMat.uniforms.uRadiusScale.value = 1.0;
  liquidMat.uniforms.uHeightScale.value = jarHeight - 0.04;
  const liquidMesh = new THREE.Mesh(getSharedLiquidGeo(), liquidMat);
  liquidMesh.position.y = 0.045;
  liquidMesh.renderOrder = 1;
  jarGroup.add(liquidMesh);

  // Container for dropped 3D fruit pieces tumbling inside the jar
  const fruitContainer = new THREE.Group();
  fruitContainer.position.y = 0.06;
  jarGroup.add(fruitContainer);

  // Jar hitbox (for dragging/tilting jar to pour into carafe, and drop zone detection)
  const jarHit = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.34, 1.0, 12),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  jarHit.position.y = 0.50;
  jarGroup.add(jarHit);

  group.userData = {
    jarGroup,
    jarGlass,
    bladeGroup,
    liquidMesh,
    liquidMat,
    fruitContainer,
    buttonMesh,
    buttonMat,
    buttonHit,
    jarHit,
    jarOpeningWorld: new THREE.Vector3(),
  };

  return group;
}

// Photorealistic sculpted 3D fruit pieces with Subsurface Scattering!
export function createFruitPieceMesh(fruitId, fruitTextures, forGarnish = false) {
  const group = new THREE.Group();
  const info = FRUIT_CATALOG.find((f) => f.id === fruitId) || FRUIT_CATALOG[0];

  if (fruitId === 'strawberry') {
    // Sculpted heart-conical strawberry half/whole with vascular cut face or dimpled ruby exterior + leafy green calyx
    const pts = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      const y = (t - 0.45) * 0.24;
      // Plump shoulder near top (t~0.75), tapered tip at bottom (t=0)
      const r = Math.sin(Math.pow(t, 0.62) * Math.PI) * 0.118 * (0.85 + 0.32 * t);
      pts.push(new THREE.Vector2(Math.max(0.001, r), y));
    }
    const geo = new THREE.LatheGeometry(pts, 24, 0, forGarnish ? Math.PI * 2 : Math.PI * 1.15);
    const mat = applySubsurfaceScattering(
      new THREE.MeshPhysicalMaterial({
        map: fruitTextures.strawberrySkin,
        bumpMap: fruitTextures.strawberryBump,
        bumpScale: 0.005,
        roughness: 0.16,
        clearcoat: 0.85,
        clearcoatRoughness: 0.08,
      }),
      info.sss,
      0.95,
      2.0
    );
    const berry = new THREE.Mesh(geo, mat);
    group.add(berry);

    if (!forGarnish) {
      // Wet freshly sliced flat cross-section face!
      const cutShape = new THREE.Shape();
      cutShape.moveTo(0, -0.108);
      cutShape.bezierCurveTo(0.115, -0.05, 0.135, 0.08, 0, 0.132);
      cutShape.bezierCurveTo(-0.135, 0.08, -0.115, -0.05, 0, -0.108);
      const cutGeo = new THREE.ShapeGeometry(cutShape, 18);
      // Normalize UVs [0..1]
      const pos = cutGeo.attributes.position;
      const uvs = cutGeo.attributes.uv;
      for (let i = 0; i < pos.count; i++) {
        uvs.setXY(i, pos.getX(i) / 0.26 + 0.5, pos.getY(i) / 0.25 + 0.46);
      }
      const cutMat = applySubsurfaceScattering(
        new THREE.MeshPhysicalMaterial({
          map: fruitTextures.strawberryCut,
          roughness: 0.09,
          clearcoat: 1.0,
          clearcoatRoughness: 0.03,
          side: THREE.DoubleSide,
        }),
        0xff4455,
        1.05,
        1.8
      );
      const cutFace = new THREE.Mesh(cutGeo, cutMat);
      cutFace.rotation.y = Math.PI * 0.075;
      group.add(cutFace);
    }

    // Fresh green calyx leaves at crown
    const leafMat = applySubsurfaceScattering(
      new THREE.MeshStandardMaterial({ color: 0x358c24, roughness: 0.38, side: THREE.DoubleSide }),
      0x7dff4d,
      0.55,
      2.2
    );
    for (let k = 0; k < 5; k++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.034, 0.085, 5), leafMat);
      leaf.scale.set(1.0, 1.0, 0.22);
      const a = (k / 5) * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 0.03, 0.128, Math.sin(a) * 0.03);
      leaf.rotation.z = -Math.cos(a) * 1.15;
      leaf.rotation.x = Math.sin(a) * 1.15;
      group.add(leaf);
    }
  } else if (fruitId === 'orange' || fruitId === 'lemon') {
    const wheelTex = fruitId === 'orange' ? fruitTextures.orangeWheel : fruitTextures.lemonWheel;
    const rindHex = fruitId === 'orange' ? 0xee6b0b : 0xe8d018;
    const radius = forGarnish ? 0.135 : 0.13;
    const thick = forGarnish ? 0.026 : 0.042;
    const thetaLen = forGarnish ? Math.PI * 2 : Math.PI;

    const rindMat = applySubsurfaceScattering(
      new THREE.MeshPhysicalMaterial({
        color: rindHex,
        roughness: 0.28,
        clearcoat: 0.55,
        bumpScale: 0.003,
      }),
      info.sss,
      0.7,
      2.2
    );
    const faceMat = applySubsurfaceScattering(
      new THREE.MeshPhysicalMaterial({
        map: wheelTex,
        roughness: 0.08,
        clearcoat: 1.0,
        clearcoatRoughness: 0.03,
      }),
      info.sss,
      1.15,
      1.8
    );

    const cylGeo = new THREE.CylinderGeometry(radius, radius, thick, 28, 1, false, 0, thetaLen);
    const slice = new THREE.Mesh(cylGeo, [rindMat, faceMat, faceMat]);
    slice.rotation.x = Math.PI * 0.5;
    group.add(slice);
  } else if (fruitId === 'kiwi') {
    const radius = forGarnish ? 0.125 : 0.125;
    const rindMat = new THREE.MeshStandardMaterial({ color: 0x6b4e2b, roughness: 0.85 });
    const faceMat = applySubsurfaceScattering(
      new THREE.MeshPhysicalMaterial({
        map: fruitTextures.kiwiCut,
        roughness: 0.09,
        clearcoat: 1.0,
        clearcoatRoughness: 0.03,
      }),
      info.sss,
      1.15,
      1.9
    );
    const cylGeo = new THREE.CylinderGeometry(radius, radius, 0.034, 28);
    const kiwi = new THREE.Mesh(cylGeo, [rindMat, faceMat, faceMat]);
    kiwi.rotation.x = Math.PI * 0.35;
    group.add(kiwi);
  } else if (fruitId === 'mango') {
    // Glistening golden tropical mango/pineapple bevelled juicy cube
    const geo = new RoundedBoxGeometry(0.17, 0.14, 0.16, 4, 0.032);
    const mat = applySubsurfaceScattering(
      new THREE.MeshPhysicalMaterial({
        map: fruitTextures.mangoTex,
        roughness: 0.11,
        clearcoat: 0.95,
        clearcoatRoughness: 0.04,
      }),
      info.sss,
      1.05,
      1.9
    );
    group.add(new THREE.Mesh(geo, mat));
  } else if (fruitId === 'blueberry') {
    // Cluster of 3 plump blueberries with frosty wax bloom & crown calyx!
    const berryMat = applySubsurfaceScattering(
      new THREE.MeshPhysicalMaterial({
        color: 0x2a1c5c,
        roughness: 0.38,
        sheen: 0.85,
        sheenColor: new THREE.Color(0x7c98ff),
        sheenRoughness: 0.45,
        clearcoat: 0.25,
      }),
      info.sss,
      0.75,
      2.2
    );
    const offsets = [
      [0, 0.02, 0, 0.068],
      [-0.062, -0.02, 0.035, 0.058],
      [0.058, -0.022, -0.028, 0.062],
    ];
    offsets.forEach(([ox, oy, oz, r]) => {
      const b = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), berryMat);
      b.scale.set(1.05, 0.90, 1.05);
      b.position.set(ox, oy, oz);
      group.add(b);
    });
  }

  // Generous invisible touch sphere for 1-finger child pickup
  const hit = new THREE.Mesh(
    new THREE.SphereGeometry(0.21, 10, 8),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  group.add(hit);
  group.userData = { fruitId, info, hitMesh: hit };
  return group;
}

// Glossy dark-ruby stemmed cherry, striped bendy straw, ice cube, honey pot, and syrup bottle for Scene 2 & 3!
export function createToppingMesh(type, fruitTextures, condensationTex) {
  const group = new THREE.Group();

  if (type === 'cherry') {
    // Plump heart-dimpled glossy Bing cherry + curved green stem!
    const pts = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      const a = t * Math.PI;
      const r = Math.sin(a) * 0.082 * (1.0 + 0.12 * Math.sin(a * 2.0));
      const y = -Math.cos(a) * 0.076 - (t > 0.82 ? Math.pow((t - 0.82) / 0.18, 2) * 0.022 : 0);
      pts.push(new THREE.Vector2(Math.max(0.001, r), y));
    }
    const cherryMat = applySubsurfaceScattering(
      new THREE.MeshPhysicalMaterial({
        color: 0x8f061b,
        roughness: 0.05,
        clearcoat: 1.0,
        clearcoatRoughness: 0.02,
        specularIntensity: 1.0,
      }),
      0xff1f3d,
      0.95,
      2.0
    );
    const cherry = new THREE.Mesh(new THREE.LatheGeometry(pts, 24), cherryMat);
    group.add(cherry);

    const stemCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.055, 0),
      new THREE.Vector3(0.018, 0.15, 0.01),
      new THREE.Vector3(0.065, 0.24, 0.02),
    ]);
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x4d9c2a, roughness: 0.42 });
    const stem = new THREE.Mesh(new THREE.TubeGeometry(stemCurve, 12, 0.0065, 6, false), stemMat);
    group.add(stem);
  } else if (type.startsWith('straw_')) {
    // Striped or crystal bendy cocktail straw!
    const colorMap = {
      straw_red: '#ff3b5c',
      straw_gold: '#ffb024',
      straw_mint: '#2cd498',
    };
    const stripeHex = colorMap[type] || '#ff3b5c';
    const c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fffaf5';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = stripeHex;
    for (let i = -128; i < 256; i += 28) {
      ctx.beginPath();
      ctx.moveTo(i, 0); ctx.lineTo(i + 14, 0);
      ctx.lineTo(i + 14 + 64, 128); ctx.lineTo(i + 64, 128);
      ctx.closePath();
      ctx.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 5);

    const strawCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.04, -0.48, 0),
      new THREE.Vector3(0.0, 0.22, 0),
      new THREE.Vector3(0.03, 0.30, 0),
      new THREE.Vector3(0.18, 0.36, 0.02),
    ]);
    const strawMat = new THREE.MeshPhysicalMaterial({
      map: tex,
      roughness: 0.24,
      clearcoat: 0.65,
      side: THREE.DoubleSide,
    });
    const tube = new THREE.Mesh(new THREE.TubeGeometry(strawCurve, 28, 0.022, 14, false), strawMat);
    group.add(tube);
  } else if (type === 'ice') {
    const iceGeo = new RoundedBoxGeometry(0.13, 0.12, 0.13, 4, 0.026);
    const iceMat = createCrystalGlassMaterial(condensationTex, {
      transmission: 0.92,
      ior: 1.31,
      thickness: 0.22,
      roughness: 0.08,
      attenuationColor: 0xe8f6ff,
    });
    const ice = new THREE.Mesh(iceGeo, iceMat);
    ice.renderOrder = 3;
    group.add(ice);
  } else if (type === 'rim_strawberry') {
    return createFruitPieceMesh('strawberry', fruitTextures, true);
  } else if (type === 'rim_orange') {
    return createFruitPieceMesh('orange', fruitTextures, true);
  } else if (type === 'rim_kiwi') {
    return createFruitPieceMesh('kiwi', fruitTextures, true);
  }

  const hit = new THREE.Mesh(
    new THREE.SphereGeometry(type.startsWith('straw_') ? 0.26 : 0.19, 10, 8),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  if (type.startsWith('straw_')) hit.position.y = 0.05;
  group.add(hit);
  group.userData = { toppingType: type, hitMesh: hit };
  return group;
}

// Sweet Rescue Containers for Scene 2 (Golden Honey Jar + Dipper, Ruby Berry Syrup, Vanilla Cream Carafe)
export function createSweetenerProp(kind, condensationTex) {
  const group = new THREE.Group();
  const glassMat = createCrystalGlassMaterial(condensationTex, { thickness: 0.26 });

  if (kind === 'honey') {
    // Curvy glass honey pot filled with glowing amber honey + wooden honey dipper sticking out!
    const jar = new THREE.Mesh(new THREE.SphereGeometry(0.18, 28, 20), glassMat);
    jar.scale.set(1.0, 0.92, 1.0);
    jar.position.y = 0.17;
    jar.renderOrder = 3;

    const honeyMat = applySubsurfaceScattering(
      new THREE.MeshPhysicalMaterial({
        color: 0xe8920c,
        roughness: 0.06,
        clearcoat: 1.0,
      }),
      0xffcf33,
      1.25,
      1.7
    );
    const honeyFill = new THREE.Mesh(new THREE.SphereGeometry(0.162, 24, 16), honeyMat);
    honeyFill.scale.set(1.0, 0.82, 1.0);
    honeyFill.position.y = 0.155;
    group.add(honeyFill, jar);

    // Grooved wooden honey dipper wand
    const woodMat = new THREE.MeshStandardMaterial({ color: 0xc98b4b, roughness: 0.45 });
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.38, 12), woodMat);
    stick.position.set(0.04, 0.30, 0);
    stick.rotation.z = -0.22;
    group.add(stick);
    for (let r = 0; r < 4; r++) {
      const disc = new THREE.Mesh(new THREE.TorusGeometry(0.032 - Math.abs(r - 1.5) * 0.005, 0.009, 8, 16), honeyMat);
      disc.rotation.x = Math.PI * 0.5;
      disc.position.set(0.01 + r * 0.005, 0.16 + r * 0.022, 0);
      group.add(disc);
    }
    group.userData = { sweetKind: 'honey', color: 0xffb61e, viscosity: 0.85 };
  } else if (kind === 'syrup') {
    // Crystal ruby berry syrup bottle
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.15, 0.36, 26), glassMat);
    body.position.y = 0.18;
    body.renderOrder = 3;
    const syrupMat = applySubsurfaceScattering(
      new THREE.MeshPhysicalMaterial({ color: 0xd91648, roughness: 0.06, clearcoat: 1.0 }),
      0xff4778,
      1.15,
      1.8
    );
    const fill = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.136, 0.28, 24), syrupMat);
    fill.position.y = 0.15;
    group.add(fill, body);
    group.userData = { sweetKind: 'syrup', color: 0xff2b63, viscosity: 0.55 };
  } else {
    // Silky sweet vanilla-peach cream pitcher
    const carafe = createGlassCupAssembly(condensationTex, 'carafe');
    carafe.scale.setScalar(0.72);
    const lMat = carafe.userData.liquidMat;
    lMat.uniforms.uFillLevel.value = 0.72;
    lMat.uniforms.uLayerCount.value = 1;
    lMat.uniforms.uLayerColors.value[0].setHex(0xfff1d0);
    lMat.uniforms.uFoamHeight.value = 0.08;
    group.add(carafe);
    group.userData = { sweetKind: 'cream', color: 0xfff2cf, viscosity: 0.45 };
  }

  const hit = new THREE.Mesh(
    new THREE.SphereGeometry(0.25, 10, 8),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hit.position.y = 0.22;
  group.add(hit);
  group.userData.hitMesh = hit;
  return group;
}

// Tactile woven linen Apron softly draped on the counter for Opening Dress-Up (no stiff handle blocking faces!)
export function createApronProp(styleId, fabricTex, trimHex) {
  const group = new THREE.Group();

  const fabricMat = new THREE.MeshStandardMaterial({
    map: fabricTex,
    roughness: 0.86,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });

  // Softly folded & draped cafe linen apron lying naturally on the dark walnut bar
  const apronGeo = new RoundedBoxGeometry(0.42, 0.042, 0.48, 8, 0.016);
  const pos = apronGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    // Taper narrower toward top bib (-Z), wider pleated skirt toward front (+Z)
    const t = (z + 0.24) / 0.48;
    const nx = x * (0.72 + 0.34 * t);
    const wave = Math.sin(nx * 28.0) * 0.008 * t;
    pos.setXYZ(i, nx, y + wave, z);
  }
  apronGeo.computeVertexNormals();
  const body = new THREE.Mesh(apronGeo, fabricMat);
  body.position.y = 0.024;
  group.add(body);

  // Stitched front pocket with subtle fabric weave
  const trimMat = new THREE.MeshStandardMaterial({ color: trimHex, roughness: 0.82 });
  const pocket = new THREE.Mesh(new RoundedBoxGeometry(0.18, 0.018, 0.13, 3, 0.006), trimMat);
  pocket.position.set(0, 0.046, 0.06);
  group.add(pocket);

  // Delicate thin neck ribbon resting flat on counter behind the bib
  const ribbonCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.11, 0.025, -0.22),
    new THREE.Vector3(-0.13, 0.016, -0.34),
    new THREE.Vector3(0.0, 0.014, -0.38),
    new THREE.Vector3(0.13, 0.016, -0.34),
    new THREE.Vector3(0.11, 0.025, -0.22),
  ]);
  const neckStrap = new THREE.Mesh(new THREE.TubeGeometry(ribbonCurve, 16, 0.008, 6, false), trimMat);
  group.add(neckStrap);

  const brassMat = new THREE.MeshStandardMaterial({ color: 0xe0b254, roughness: 0.28, metalness: 0.85 });
  [-0.105, 0.105].forEach((bx) => {
    const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.01, 12), brassMat);
    btn.position.set(bx, 0.046, -0.19);
    group.add(btn);
  });

  const hit = new THREE.Mesh(
    new THREE.BoxGeometry(0.52, 0.28, 0.62),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hit.position.y = 0.08;
  group.add(hit);

  group.userData = { styleId, fabricTex, trimHex, hitMesh: hit };
  return group;
}

// Single Wooden-Framed Pictorial Sign Board (絵の看板1枚 — zero text!)
export function createPictorialSignBoard(signTex) {
  const group = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x3b2416, roughness: 0.52 });

  const frame = new THREE.Mesh(new RoundedBoxGeometry(0.68, 0.52, 0.036, 3, 0.012), woodMat);
  frame.position.y = 0.28;
  frame.rotation.x = -0.14;
  group.add(frame);

  const boardMat = new THREE.MeshStandardMaterial({
    map: signTex,
    roughness: 0.48,
  });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.61, 0.45), boardMat);
  face.position.set(0, 0.28, 0.02);
  face.rotation.x = -0.14;
  group.add(face);

  // Rear easel stand leg
  const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.46, 0.025), woodMat);
  leg.position.set(0, 0.22, -0.10);
  leg.rotation.x = 0.34;
  group.add(leg);

  const hit = new THREE.Mesh(
    new THREE.BoxGeometry(0.72, 0.58, 0.25),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hit.position.y = 0.28;
  group.add(hit);
  group.userData = { hitMesh: hit, rockVel: 0, rockAngle: 0 };
  return group;
}
