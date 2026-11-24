// High-Craft Procedural PBR Textures & Dynamic Cabin HDR-like Environment Maps
// Strict Budget: Every texture <= 1024px (512px or 1024px max), ZERO text/letters/numbers!

import * as THREE from 'three';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.min(1024, w);
  c.height = Math.min(1024, h);
  return c;
}

// Convert grayscale height canvas into Tangent-Space Normal Map Texture
function heightToNormalTexture(heightCanvas, strength = 2.0, repeatX = 1, repeatY = 1) {
  const w = heightCanvas.width;
  const h = heightCanvas.height;
  const srcCtx = heightCanvas.getContext('2d');
  const src = srcCtx.getImageData(0, 0, w, h).data;

  const outCanvas = makeCanvas(w, h);
  const outCtx = outCanvas.getContext('2d');
  const outImg = outCtx.createImageData(w, h);
  const dst = outImg.data;

  const sample = (x, y) => {
    const wx = ((x % w) + w) % w;
    const wy = ((y % h) + h) % h;
    return src[(wy * w + wx) * 4] / 255;
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const l = sample(x - 1, y);
      const r = sample(x + 1, y);
      const u = sample(x, y - 1);
      const d = sample(x, y + 1);
      let nx = (l - r) * strength;
      let ny = (u - d) * strength;
      let nz = 1.0;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;
      nz /= len;
      const idx = (y * w + x) * 4;
      dst[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      dst[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      dst[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      dst[idx + 3] = 255;
    }
  }
  outCtx.putImageData(outImg, 0, 0);
  const tex = new THREE.CanvasTexture(outCanvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  return tex;
}

export function createMaterialLibrary(renderer) {
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  // 1. Directional Brushed Aluminum / Stainless Steel for Hero Galley Cart
  const metalC = makeCanvas(512, 512);
  const mCtx = metalC.getContext('2d');
  const mGrad = mCtx.createLinearGradient(0, 0, 512, 512);
  mGrad.addColorStop(0, '#d8dde6');
  mGrad.addColorStop(0.5, '#eef2f7');
  mGrad.addColorStop(1, '#cfd6e0');
  mCtx.fillStyle = mGrad;
  mCtx.fillRect(0, 0, 512, 512);

  const metalRoughC = makeCanvas(512, 512);
  const mrCtx = metalRoughC.getContext('2d');
  mrCtx.fillStyle = '#424242';
  mrCtx.fillRect(0, 0, 512, 512);

  const metalHeightC = makeCanvas(512, 512);
  const mhCtx = metalHeightC.getContext('2d');
  mhCtx.fillStyle = '#808080';
  mhCtx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 2200; i++) {
    const y = Math.random() * 512;
    const x = Math.random() * 512;
    const len = 40 + Math.random() * 240;
    const v = Math.floor(205 + Math.random() * 48);
    mCtx.strokeStyle = `rgba(${v},${v + 2},${v + 5},0.22)`;
    mCtx.lineWidth = 0.7 + Math.random() * 1.1;
    mCtx.beginPath();
    mCtx.moveTo(x, y);
    mCtx.lineTo(x + len, y + (Math.random() - 0.5) * 0.8);
    mCtx.stroke();

    const rv = Math.floor(42 + Math.random() * 46);
    mrCtx.strokeStyle = `rgba(${rv},${rv},${rv},0.35)`;
    mrCtx.beginPath();
    mrCtx.moveTo(x, y);
    mrCtx.lineTo(x + len, y);
    mrCtx.stroke();

    const hv = Math.floor(110 + Math.random() * 36);
    mhCtx.strokeStyle = `rgb(${hv},${hv},${hv})`;
    mhCtx.beginPath();
    mhCtx.moveTo(x, y);
    mhCtx.lineTo(x + len, y);
    mhCtx.stroke();
  }

  const brushedAlbedo = new THREE.CanvasTexture(metalC);
  brushedAlbedo.colorSpace = THREE.SRGBColorSpace;
  brushedAlbedo.wrapS = brushedAlbedo.wrapT = THREE.RepeatWrapping;
  brushedAlbedo.anisotropy = aniso;

  const brushedRough = new THREE.CanvasTexture(metalRoughC);
  brushedRough.wrapS = brushedRough.wrapT = THREE.RepeatWrapping;
  brushedRough.anisotropy = aniso;

  const brushedNormal = heightToNormalTexture(metalHeightC, 1.35, 2, 2);
  brushedNormal.anisotropy = aniso;

  // 2. Rich Airline Navy Wool-Blend Seat Fabric
  const navyC = makeCanvas(512, 512);
  const nCtx = navyC.getContext('2d');
  nCtx.fillStyle = '#182b4d';
  nCtx.fillRect(0, 0, 512, 512);

  const navyH = makeCanvas(256, 256);
  const nhCtx = navyH.getContext('2d');
  nhCtx.fillStyle = '#707070';
  nhCtx.fillRect(0, 0, 256, 256);

  // Subtle woven twill upholstery pattern
  for (let y = 0; y < 512; y += 4) {
    for (let x = 0; x < 512; x += 4) {
      const diag = ((x + y) / 4) % 3;
      const jitter = (Math.random() - 0.5) * 10;
      const r = Math.max(12, Math.min(55, (diag === 0 ? 28 : 20) + jitter));
      const g = Math.max(22, Math.min(78, (diag === 0 ? 48 : 37) + jitter));
      const b = Math.max(48, Math.min(118, (diag === 0 ? 86 : 70) + jitter));
      nCtx.fillStyle = `rgb(${r|0},${g|0},${b|0})`;
      nCtx.fillRect(x, y, 3, 3);
    }
  }
  for (let y = 0; y < 256; y += 2) {
    for (let x = 0; x < 256; x += 2) {
      const v = (((x + y) >> 1) % 2 === 0 ? 155 : 95) + ((Math.random() * 20) | 0);
      nhCtx.fillStyle = `rgb(${v},${v},${v})`;
      nhCtx.fillRect(x, y, 2, 1);
    }
  }
  const navyTex = new THREE.CanvasTexture(navyC);
  navyTex.colorSpace = THREE.SRGBColorSpace;
  navyTex.wrapS = navyTex.wrapT = THREE.RepeatWrapping;
  navyTex.repeat.set(3, 3);
  navyTex.anisotropy = aniso;

  const fabricNormal = heightToNormalTexture(navyH, 1.8, 6, 6);
  fabricNormal.anisotropy = aniso;

  // 3. Satin Molded Aircraft Cabin ABS Plastic Grain (for white panels & folding trays)
  const absH = makeCanvas(256, 256);
  const ahCtx = absH.getContext('2d');
  const absImg = ahCtx.createImageData(256, 256);
  for (let i = 0; i < absImg.data.length; i += 4) {
    const v = 118 + ((Math.random() * 20) | 0);
    absImg.data[i] = absImg.data[i + 1] = absImg.data[i + 2] = v;
    absImg.data[i + 3] = 255;
  }
  ahCtx.putImageData(absImg, 0, 0);
  const plasticNormal = heightToNormalTexture(absH, 0.55, 5, 5);

  // 4. Navy Carpet Aisle Texture (rich heathered wool weave, no longitudinal lines that moiré in bokeh!)
  const carpetC = makeCanvas(512, 512);
  const cCtx = carpetC.getContext('2d');
  cCtx.fillStyle = '#101b32';
  cCtx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 18000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = Math.random();
    cCtx.fillStyle = r < 0.14 ? '#253c66' : r < 0.45 ? '#182848' : '#0d172b';
    cCtx.fillRect(x, y, 3, 3);
  }
  const carpetTex = new THREE.CanvasTexture(carpetC);
  carpetTex.colorSpace = THREE.SRGBColorSpace;
  carpetTex.wrapS = carpetTex.wrapT = THREE.RepeatWrapping;
  carpetTex.repeat.set(1, 8);
  carpetTex.anisotropy = aniso;

  // 5. Daughter's Silk Cabin Crew Scarf Texture (Navy, Crisp White, Coral-Gold Trim)
  const scarfC = makeCanvas(256, 256);
  const sCtx = scarfC.getContext('2d');
  sCtx.fillStyle = '#f8f9fc';
  sCtx.fillRect(0, 0, 256, 256);
  sCtx.fillStyle = '#182c56';
  sCtx.fillRect(0, 0, 256, 52);
  sCtx.fillRect(0, 204, 256, 52);
  sCtx.fillStyle = '#e0584e';
  sCtx.fillRect(0, 52, 256, 18);
  sCtx.fillRect(0, 186, 256, 18);
  sCtx.fillStyle = '#e6b85c';
  sCtx.fillRect(0, 74, 256, 8);
  sCtx.fillRect(0, 174, 256, 8);
  // Diagonal geometric silk motif
  sCtx.strokeStyle = 'rgba(24,44,86,0.22)';
  sCtx.lineWidth = 3;
  for (let x = -256; x < 512; x += 32) {
    sCtx.beginPath();
    sCtx.moveTo(x, 82);
    sCtx.lineTo(x + 90, 172);
    sCtx.stroke();
  }
  const scarfTex = new THREE.CanvasTexture(scarfC);
  scarfTex.colorSpace = THREE.SRGBColorSpace;

  // 6. Three Quilted Blanket Weave Textures (Classic Navy, Sky Tartan, Warm Cream)
  const makeBlanketTex = (baseHex, stripeHex, accentHex) => {
    const bc = makeCanvas(256, 256);
    const bx = bc.getContext('2d');
    bx.fillStyle = baseHex;
    bx.fillRect(0, 0, 256, 256);
    bx.fillStyle = stripeHex;
    for (let i = 0; i < 256; i += 64) {
      bx.fillRect(0, i + 16, 256, 12);
      bx.fillRect(i + 16, 0, 12, 256);
    }
    bx.strokeStyle = accentHex;
    bx.lineWidth = 2;
    for (let i = -256; i < 512; i += 42) {
      bx.beginPath();
      bx.moveTo(i, 0);
      bx.lineTo(i + 256, 256);
      bx.moveTo(i + 256, 0);
      bx.lineTo(i, 256);
      bx.stroke();
    }
    const t = new THREE.CanvasTexture(bc);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  };

  const blanketTextures = [
    makeBlanketTex('#1a305c', 'rgba(255,255,255,0.12)', 'rgba(218,184,112,0.25)'),
    makeBlanketTex('#3c689c', 'rgba(255,255,255,0.22)', 'rgba(24,44,86,0.28)'),
    makeBlanketTex('#efe6d5', 'rgba(214,174,122,0.22)', 'rgba(180,145,105,0.28)')
  ];

  // 7. Single Diegetic Airline Pictorial Placard (Zero Text, Zero Arrows!)
  // Shows 3 clean cabin service illustrations side-by-side on a satin cabin acrylic card:
  // [1: Pouring pitcher into cup]  [2: Wiping spill cloth]  [3: Cozy blanket & moon]
  const placardC = makeCanvas(512, 192);
  const pCtx = placardC.getContext('2d');
  // Brushed pearl card background with navy airline border
  const pg = pCtx.createLinearGradient(0, 0, 0, 192);
  pg.addColorStop(0, '#f7f9fc');
  pg.addColorStop(1, '#e6ecf5');
  pCtx.fillStyle = pg;
  pCtx.fillRect(0, 0, 512, 192);
  pCtx.strokeStyle = '#1a2e56';
  pCtx.lineWidth = 10;
  pCtx.strokeRect(8, 8, 496, 176);

  // Dividers
  pCtx.strokeStyle = 'rgba(26,46,86,0.18)';
  pCtx.lineWidth = 3;
  pCtx.beginPath();
  pCtx.moveTo(172, 26); pCtx.lineTo(172, 166);
  pCtx.moveTo(340, 26); pCtx.lineTo(340, 166);
  pCtx.stroke();

  // Panel 1: Tilted pitcher pouring orange stream into cup
  pCtx.save();
  pCtx.translate(88, 96);
  // Pitcher
  pCtx.save();
  pCtx.translate(-22, -30);
  pCtx.rotate(0.55);
  pCtx.fillStyle = '#dce7f5';
  pCtx.strokeStyle = '#1e3560';
  pCtx.lineWidth = 3.5;
  pCtx.beginPath();
  pCtx.roundRect(-18, -22, 34, 42, 6);
  pCtx.fill(); pCtx.stroke();
  pCtx.fillStyle = '#f59223';
  pCtx.fillRect(-14, -6, 26, 22);
  pCtx.restore();
  // Stream
  pCtx.strokeStyle = '#f59223';
  pCtx.lineWidth = 6;
  pCtx.lineCap = 'round';
  pCtx.beginPath();
  pCtx.moveTo(2, -16);
  pCtx.quadraticCurveTo(14, 2, 14, 26);
  pCtx.stroke();
  // Cup
  pCtx.fillStyle = 'rgba(225,238,252,0.9)';
  pCtx.strokeStyle = '#1e3560';
  pCtx.lineWidth = 3.5;
  pCtx.beginPath();
  pCtx.moveTo(-2, 14); pCtx.lineTo(30, 14); pCtx.lineTo(26, 52); pCtx.lineTo(2, 52); pCtx.closePath();
  pCtx.fill();
  pCtx.fillStyle = '#f59223';
  pCtx.beginPath();
  pCtx.moveTo(1, 28); pCtx.lineTo(27, 28); pCtx.lineTo(25, 50); pCtx.lineTo(3, 50); pCtx.closePath();
  pCtx.fill();
  pCtx.stroke();
  pCtx.restore();

  // Panel 2: White cloth wiping orange puddle + sparkle
  pCtx.save();
  pCtx.translate(256, 96);
  // Puddle
  pCtx.fillStyle = '#f59223';
  pCtx.beginPath();
  pCtx.ellipse(-12, 24, 34, 13, 0.1, 0, Math.PI * 2);
  pCtx.fill();
  // Folded cloth
  pCtx.fillStyle = '#ffffff';
  pCtx.strokeStyle = '#1e3560';
  pCtx.lineWidth = 3.5;
  pCtx.beginPath();
  pCtx.roundRect(-8, -18, 48, 34, 7);
  pCtx.fill(); pCtx.stroke();
  // Sparkle 4-point star
  pCtx.fillStyle = '#eab842';
  const drawStar = (sx, sy, sr) => {
    pCtx.beginPath();
    pCtx.moveTo(sx, sy - sr);
    pCtx.quadraticCurveTo(sx, sy, sx + sr, sy);
    pCtx.quadraticCurveTo(sx, sy, sx, sy + sr);
    pCtx.quadraticCurveTo(sx, sy, sx - sr, sy);
    pCtx.quadraticCurveTo(sx, sy, sx, sy - sr);
    pCtx.fill();
  };
  drawStar(-36, -18, 12);
  drawStar(36, -30, 9);
  pCtx.restore();

  // Panel 3: Navy blanket + pillow + golden crescent moon
  pCtx.save();
  pCtx.translate(426, 96);
  // Crescent moon
  pCtx.fillStyle = '#f0be49';
  pCtx.beginPath();
  pCtx.arc(24, -30, 18, 0.4, Math.PI * 1.85);
  pCtx.quadraticCurveTo(14, -30, 28, -44);
  pCtx.fill();
  // Pillow
  pCtx.fillStyle = '#ffffff';
  pCtx.strokeStyle = '#1e3560';
  pCtx.lineWidth = 3.5;
  pCtx.beginPath();
  pCtx.roundRect(-36, -12, 46, 28, 10);
  pCtx.fill(); pCtx.stroke();
  // Navy blanket
  pCtx.fillStyle = '#1c3363';
  pCtx.beginPath();
  pCtx.roundRect(-24, 6, 62, 40, 8);
  pCtx.fill(); pCtx.stroke();
  pCtx.restore();

  const placardTex = new THREE.CanvasTexture(placardC);
  placardTex.colorSpace = THREE.SRGBColorSpace;
  placardTex.anisotropy = aniso;

  // 8. Passenger Thought Bubble Pictorial Icons (Zero Text!)
  const iconTypes = ['juice', 'tea', 'meal', 'berry', 'sleep'];
  const thoughtIcons = {};
  for (const kind of iconTypes) {
    const ic = makeCanvas(256, 256);
    const ix = ic.getContext('2d');
    ix.clearRect(0, 0, 256, 256);

    // Soft pearl medallion bubble
    const rg = ix.createRadialGradient(116, 102, 16, 128, 128, 114);
    rg.addColorStop(0, '#ffffff');
    rg.addColorStop(0.85, '#f2f6fc');
    rg.addColorStop(1, '#dbe4f2');
    ix.fillStyle = rg;
    ix.beginPath();
    ix.arc(128, 120, 98, 0, Math.PI * 2);
    ix.fill();
    ix.lineWidth = 7;
    ix.strokeStyle = '#1d3461';
    ix.stroke();

    // Small thought tail circles
    ix.fillStyle = '#f4f7fc';
    ix.beginPath(); ix.arc(98, 228, 13, 0, Math.PI * 2); ix.fill(); ix.stroke();
    ix.beginPath(); ix.arc(82, 246, 7, 0, Math.PI * 2); ix.fill(); ix.stroke();

    if (kind === 'juice' || kind === 'berry') {
      const col = kind === 'juice' ? '#f7941d' : '#d93b65';
      const hi = kind === 'juice' ? '#ffc46b' : '#ff8ba7';
      // Realistic clear cup filled with juice + fruit slice
      ix.fillStyle = 'rgba(220,235,250,0.85)';
      ix.strokeStyle = '#243c6a';
      ix.lineWidth = 5;
      ix.beginPath();
      ix.moveTo(86, 72); ix.lineTo(170, 72); ix.lineTo(158, 174); ix.lineTo(98, 174); ix.closePath();
      ix.fill();
      ix.fillStyle = col;
      ix.beginPath();
      ix.moveTo(91, 96); ix.lineTo(165, 96); ix.lineTo(155, 170); ix.lineTo(101, 170); ix.closePath();
      ix.fill();
      ix.fillStyle = hi;
      ix.beginPath();
      ix.ellipse(128, 96, 36, 8, 0, 0, Math.PI * 2);
      ix.fill();
      ix.stroke();
      // Ice cubes
      ix.fillStyle = 'rgba(255,255,255,0.75)';
      ix.fillRect(108, 108, 18, 18);
      ix.fillRect(132, 116, 17, 17);
      // Fruit slice on rim
      ix.fillStyle = col;
      ix.beginPath();
      ix.arc(168, 74, 20, 0, Math.PI * 2);
      ix.fill();
      ix.strokeStyle = '#fff5d6';
      ix.lineWidth = 4;
      ix.stroke();
    } else if (kind === 'tea') {
      // Warm ceramic/cabin cup with amber-green tea + gentle steam curls
      ix.fillStyle = '#ffffff';
      ix.strokeStyle = '#243c6a';
      ix.lineWidth = 5;
      // Handle
      ix.beginPath();
      ix.arc(168, 132, 20, -Math.PI * 0.5, Math.PI * 0.5);
      ix.stroke();
      // Cup body
      ix.beginPath();
      ix.roundRect(84, 96, 84, 72, [6, 6, 28, 28]);
      ix.fill(); ix.stroke();
      ix.fillStyle = '#7da64b';
      ix.beginPath();
      ix.ellipse(126, 102, 36, 10, 0, 0, Math.PI * 2);
      ix.fill();
      // Steam waves
      ix.strokeStyle = '#9db4d4';
      ix.lineWidth = 5;
      ix.lineCap = 'round';
      [108, 128, 148].forEach((sx, i) => {
        ix.beginPath();
        ix.moveTo(sx, 82);
        ix.quadraticCurveTo(sx - 8, 68, sx + 4, 54 - i * 3);
        ix.stroke();
      });
    } else if (kind === 'meal') {
      // In-flight hot casserole dish with golden omelette/gratin, broccoli & carrot
      ix.fillStyle = '#dce3ee';
      ix.strokeStyle = '#243c6a';
      ix.lineWidth = 5;
      ix.beginPath();
      ix.roundRect(66, 88, 124, 78, 22);
      ix.fill(); ix.stroke();
      // Golden gratin/omelette
      ix.fillStyle = '#f4c552';
      ix.beginPath();
      ix.roundRect(76, 98, 104, 58, 16);
      ix.fill();
      // Toasted cheese spots
      ix.fillStyle = '#cf7b29';
      ix.beginPath(); ix.ellipse(116, 124, 22, 12, 0.2, 0, Math.PI * 2); ix.fill();
      // Broccoli & carrot garnish
      ix.fillStyle = '#3f8f46';
      ix.beginPath(); ix.arc(158, 118, 13, 0, Math.PI * 2); ix.fill();
      ix.fillStyle = '#ea642b';
      ix.beginPath(); ix.arc(154, 140, 10, 0, Math.PI * 2); ix.fill();
    } else if (kind === 'sleep') {
      // Cozy pillow + navy blanket + golden moon
      ix.fillStyle = '#ffffff';
      ix.strokeStyle = '#243c6a';
      ix.lineWidth = 5;
      ix.beginPath();
      ix.roundRect(72, 92, 76, 48, 14);
      ix.fill(); ix.stroke();
      ix.fillStyle = '#1b3363';
      ix.beginPath();
      ix.roundRect(92, 118, 94, 58, 14);
      ix.fill(); ix.stroke();
      ix.fillStyle = '#f2be42';
      ix.beginPath();
      ix.arc(166, 76, 22, 0.35, Math.PI * 1.85);
      ix.quadraticCurveTo(152, 76, 170, 58);
      ix.fill();
    }

    const t = new THREE.CanvasTexture(ic);
    t.colorSpace = THREE.SRGBColorSpace;
    thoughtIcons[kind] = t;
  }

  // 9. Night City Lights Exterior Ground Texture (Golden highways & sparkling urban blocks)
  const cityC = makeCanvas(512, 512);
  const cx = cityC.getContext('2d');
  cx.fillStyle = '#050914';
  cx.fillRect(0, 0, 512, 512);
  // Glowing urban arterial highways
  cx.strokeStyle = 'rgba(255, 190, 95, 0.55)';
  cx.lineWidth = 3;
  for (let i = 0; i < 14; i++) {
    cx.beginPath();
    const y = 30 + i * 36 + (Math.random() - 0.5) * 14;
    cx.moveTo(0, y);
    cx.bezierCurveTo(170, y + (Math.random() - 0.5) * 28, 340, y + (Math.random() - 0.5) * 28, 512, y);
    cx.stroke();
  }
  for (let i = 0; i < 12; i++) {
    const x = 24 + i * 42;
    cx.strokeStyle = 'rgba(255, 175, 80, 0.35)';
    cx.lineWidth = 2;
    cx.beginPath();
    cx.moveTo(x, 0);
    cx.lineTo(x + (Math.random() - 0.5) * 40, 512);
    cx.stroke();
  }
  // Thousands of sparkling warm gold, white, and cyan city lights
  for (let i = 0; i < 2600; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = Math.random();
    if (r < 0.68) cx.fillStyle = `rgba(255, ${185 + ((Math.random() * 60) | 0)}, ${95 + ((Math.random() * 80) | 0)}, ${0.45 + Math.random() * 0.55})`;
    else if (r < 0.9) cx.fillStyle = `rgba(255, 245, 230, ${0.5 + Math.random() * 0.5})`;
    else cx.fillStyle = `rgba(130, 215, 255, ${0.4 + Math.random() * 0.5})`;
    const sz = Math.random() < 0.15 ? 2.5 : 1.4;
    cx.fillRect(x, y, sz, sz);
  }
  const cityLightsTex = new THREE.CanvasTexture(cityC);
  cityLightsTex.colorSpace = THREE.SRGBColorSpace;
  cityLightsTex.wrapS = cityLightsTex.wrapT = THREE.RepeatWrapping;
  cityLightsTex.repeat.set(3, 3);

  // 10. Pre-baked PMREM Cabin Environment Maps for Day, Sunset, and Night
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const buildCabinEnv = (mode) => {
    const ec = makeCanvas(512, 256);
    const ex = ec.getContext('2d');
    const g = ex.createLinearGradient(0, 0, 0, 256);
    if (mode === 'day') {
      g.addColorStop(0.0, '#eef3fa'); // Bright white cabin ceiling LED wash
      g.addColorStop(0.35, '#dce6f5');
      g.addColorStop(0.52, '#ffffff'); // Horizon window glare
      g.addColorStop(0.72, '#243a66'); // Navy seats bounce
      g.addColorStop(1.0, '#131f38'); // Dark navy carpet bounce
    } else if (mode === 'sunset') {
      g.addColorStop(0.0, '#f4d9c6');
      g.addColorStop(0.38, '#ff9d5c');
      g.addColorStop(0.52, '#ffd28a');
      g.addColorStop(0.75, '#2b284d');
      g.addColorStop(1.0, '#14162c');
    } else {
      g.addColorStop(0.0, '#2a3d70'); // Sapphire night mood ceiling
      g.addColorStop(0.38, '#1e2c52');
      g.addColorStop(0.52, '#5c4636'); // Warm reading light & window glow
      g.addColorStop(0.78, '#121c36');
      g.addColorStop(1.0, '#090f1f');
    }
    ex.fillStyle = g;
    ex.fillRect(0, 0, 512, 256);

    // High-contrast studio/cabin reflection horizon bands (makes brushed aluminum & chrome gleam like real metal!)
    ex.fillStyle = mode === 'night' ? 'rgba(20, 32, 62, 0.92)' : 'rgba(22, 38, 70, 0.85)';
    ex.fillRect(0, 134, 512, 26);
    ex.fillRect(0, 82, 512, 16);

    ex.fillStyle = mode === 'night' ? 'rgba(175, 210, 255, 0.95)' : 'rgba(255, 255, 255, 1.0)';
    ex.fillRect(0, 22, 512, 14);
    ex.fillRect(0, 52, 512, 10);
    ex.fillRect(0, 102, 512, 12);

    // Oval window highlights on left/right sides of equirectangular map
    const winCol = mode === 'day'
      ? 'rgba(255, 253, 246, 0.98)'
      : mode === 'sunset'
        ? 'rgba(255, 176, 92, 0.98)'
        : 'rgba(255, 198, 125, 0.65)';
    ex.fillStyle = winCol;
    for (let wx = 30; wx < 230; wx += 38) {
      ex.beginPath();
      ex.ellipse(wx, 118, 11, 22, 0, 0, Math.PI * 2);
      ex.fill();
    }
    for (let wx = 290; wx < 480; wx += 38) {
      ex.beginPath();
      ex.ellipse(wx, 118, 10, 18, 0, 0, Math.PI * 2);
      ex.fill();
    }

    const eqTex = new THREE.CanvasTexture(ec);
    eqTex.mapping = THREE.EquirectangularReflectionMapping;
    eqTex.colorSpace = THREE.SRGBColorSpace;
    const rt = pmrem.fromEquirectangular(eqTex);
    eqTex.dispose();
    return rt.texture;
  };

  const envMaps = {
    day: buildCabinEnv('day'),
    sunset: buildCabinEnv('sunset'),
    night: buildCabinEnv('night')
  };
  pmrem.dispose();

  return {
    brushedAlbedo,
    brushedRough,
    brushedNormal,
    navyTex,
    fabricNormal,
    plasticNormal,
    carpetTex,
    scarfTex,
    blanketTextures,
    placardTex,
    thoughtIcons,
    cityLightsTex,
    envMaps
  };
}

// Dynamic Meal Gratin Canvas Texture (updates continuously as warmer bakes it!)
export function createDynamicMealTexture() {
  const canvas = makeCanvas(256, 256);
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;

  const draw = (bake = 0.25) => {
    const b = Math.max(0, Math.min(1, bake));
    // Creamy rice/potato gratin base shifting from ivory -> warm gold -> rich browned crust
    const rBase = Math.round(248 - b * 24);
    const gBase = Math.round(236 - b * 62);
    const bBase = Math.round(196 - b * 112);
    ctx.fillStyle = `rgb(${rBase},${gBase},${bBase})`;
    ctx.fillRect(0, 0, 256, 256);

    // Melted cheese & golden baked patches
    const spots = [
      [88, 92, 46, 32],
      [156, 114, 50, 36],
      [112, 158, 54, 30],
      [74, 148, 34, 26],
      [168, 76, 36, 26]
    ];
    for (const [sx, sy, rx, ry] of spots) {
      const rg = ctx.createRadialGradient(sx, sy, 4, sx, sy, rx);
      const cr = Math.round(245 - b * 58);
      const cg = Math.round(212 - b * 108);
      const cb = Math.round(138 - b * 105);
      rg.addColorStop(0, `rgba(${cr},${cg},${cb},${0.35 + b * 0.58})`);
      rg.addColorStop(1, 'rgba(240,190,100,0)');
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.ellipse(sx, sy, rx, ry, 0.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Savory browned bubbles when baked longer
    if (b > 0.35) {
      ctx.fillStyle = `rgba(135, 62, 18, ${(b - 0.35) * 0.72})`;
      const crusts = [[95, 96, 14], [152, 118, 17], [118, 155, 13], [164, 84, 10]];
      for (const [cx, cy, cr] of crusts) {
        ctx.beginPath();
        ctx.ellipse(cx, cy, cr, cr * 0.7, 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    tex.needsUpdate = true;
  };

  draw(0.22);
  return { tex, draw };
}
