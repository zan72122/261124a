import * as THREE from 'three';

// Procedural PBR Texture & Anisotropic Metal Material Factory
// Strict limits: all textures <= 1024px, crisp micro-scratches, radial & linear anisotropy, Night Workshop PMREM

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function heightToNormalTexture(heightData, w, h, strength = 2.5, repeatX = 1, repeatY = 1) {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const ym = (y - 1 + h) % h;
    const yp = (y + 1) % h;
    for (let x = 0; x < w; x++) {
      const xm = (x - 1 + w) % w;
      const xp = (x + 1) % w;
      const dx = (heightData[y * w + xp] - heightData[y * w + xm]) * strength;
      const dy = (heightData[yp * w + x] - heightData[ym * w + x]) * strength;
      let nx = -dx;
      let ny = -dy;
      let nz = 1.0;
      const inv = 1.0 / Math.hypot(nx, ny, nz);
      nx *= inv;
      ny *= inv;
      nz *= inv;
      const idx = (y * w + x) * 4;
      data[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      data[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      data[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      data[idx + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.needsUpdate = true;
  return tex;
}

// 1. Linear Brushed Silver Aluminum + Micro-Scratches (1024x1024)
function createBrushedMetalMaps() {
  const S = 1024;
  const height = new Float32Array(S * S);
  const roughData = new Uint8Array(S * S * 4);
  const colData = new Uint8Array(S * S * 4);

  // Horizontal brushed hairlines with subtle row variation
  for (let y = 0; y < S; y++) {
    const rowStreak = (Math.random() - 0.5) * 0.55 + Math.sin(y * 0.37) * 0.15;
    let streakVal = rowStreak;
    for (let x = 0; x < S; x++) {
      streakVal = streakVal * 0.94 + (Math.random() - 0.5) * 0.16;
      height[y * S + x] = 0.5 + streakVal * 0.45;
    }
  }

  // Add realistic handling micro-scratches & tiny dings
  for (let i = 0; i < 420; i++) {
    let x = Math.random() * S;
    let y = Math.random() * S;
    const ang = (Math.random() - 0.5) * 1.9;
    const len = 18 + Math.random() * 110;
    const depth = (i % 5 === 0 ? -0.32 : -0.16) * (0.5 + Math.random() * 0.7);
    const dx = Math.cos(ang);
    const dy = Math.sin(ang);
    for (let s = 0; s < len; s++) {
      const ix = ((Math.floor(x) % S) + S) % S;
      const iy = ((Math.floor(y) % S) + S) % S;
      const taper = Math.sin((s / len) * Math.PI);
      height[iy * S + ix] += depth * taper;
      // Raised bright burr alongside deep scratch
      const iy2 = (iy + 1) % S;
      height[iy2 * S + ix] -= depth * 0.42 * taper;
      x += dx;
      y += dy;
    }
  }

  for (let i = 0; i < S * S; i++) {
    const h = Math.max(0, Math.min(1, height[i]));
    height[i] = h;
    // Grooves slightly darker/rougher, ridges bright specular silver
    const rVal = Math.round(Math.max(25, Math.min(145, (1.0 - h) * 85 + 34)));
    roughData[i * 4] = rVal;
    roughData[i * 4 + 1] = rVal;
    roughData[i * 4 + 2] = rVal;
    roughData[i * 4 + 3] = 255;

    const cVal = Math.round(Math.max(198, Math.min(252, 214 + (h - 0.5) * 48)));
    colData[i * 4] = cVal;
    colData[i * 4 + 1] = Math.min(255, cVal + 2);
    colData[i * 4 + 2] = Math.min(255, cVal + 6);
    colData[i * 4 + 3] = 255;
  }

  const normalMap = heightToNormalTexture(height, S, S, 2.2, 1, 1);
  const roughnessMap = new THREE.DataTexture(roughData, S, S, THREE.RGBAFormat);
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.needsUpdate = true;

  const colorMap = new THREE.DataTexture(colData, S, S, THREE.RGBAFormat);
  colorMap.colorSpace = THREE.SRGBColorSpace;
  colorMap.wrapS = colorMap.wrapT = THREE.RepeatWrapping;
  colorMap.needsUpdate = true;

  return { normalMap, roughnessMap, colorMap };
}

// 2. Radial Lathe-Turned Metal + Radial Anisotropy Direction Map (512x512)
// Gives screw heads, washers, and circular end-caps authentic conical bow-tie reflections!
function createRadialLatheMaps() {
  const S = 512;
  const height = new Float32Array(S * S);
  const anisoData = new Uint8Array(S * S * 4);
  const roughData = new Uint8Array(S * S * 4);

  // Precompute concentric lathe ring profile
  const ringProfile = new Float32Array(S);
  let v = 0;
  for (let r = 0; r < S; r++) {
    v = v * 0.72 + (Math.random() - 0.5) * 0.45 + Math.sin(r * 0.85) * 0.18;
    ringProfile[r] = v;
  }

  const half = S * 0.5;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = x - half;
      const dy = y - half;
      const dist = Math.hypot(dx, dy);
      const rIdx = Math.min(S - 1, Math.floor((dist / half) * (S * 0.75)));
      let h = 0.5 + ringProfile[rIdx] * 0.35;

      // Subtle nick scratches on screw faces
      const ang = Math.atan2(dy, dx);
      h += Math.sin(ang * 17.0 + dist * 0.12) * 0.025;
      height[y * S + x] = h;

      // Tangent direction for radial anisotropy: (-sin(ang), cos(ang)) encoded in R,G [0..255], strength in B
      let tx = 1.0;
      let ty = 0.0;
      if (dist > 1.0) {
        tx = -dy / dist;
        ty = dx / dist;
      }
      const idx = (y * S + x) * 4;
      anisoData[idx] = Math.round((tx * 0.5 + 0.5) * 255);
      anisoData[idx + 1] = Math.round((ty * 0.5 + 0.5) * 255);
      anisoData[idx + 2] = 245;
      anisoData[idx + 3] = 255;

      const rv = Math.round(48 + (1.0 - Math.max(0, Math.min(1, h))) * 65);
      roughData[idx] = rv;
      roughData[idx + 1] = rv;
      roughData[idx + 2] = rv;
      roughData[idx + 3] = 255;
    }
  }

  // Carve a few screwdriver wear nicks near center
  for (let s = 0; s < 28; s++) {
    let x = half + (Math.random() - 0.5) * S * 0.65;
    let y = half + (Math.random() - 0.5) * S * 0.65;
    const a = Math.random() * Math.PI * 2;
    const len = 12 + Math.random() * 44;
    for (let k = 0; k < len; k++) {
      const ix = Math.max(0, Math.min(S - 1, Math.floor(x)));
      const iy = Math.max(0, Math.min(S - 1, Math.floor(y)));
      height[iy * S + ix] -= 0.22;
      x += Math.cos(a);
      y += Math.sin(a);
    }
  }

  const normalMap = heightToNormalTexture(height, S, S, 2.5, 1, 1);
  const anisotropyMap = new THREE.DataTexture(anisoData, S, S, THREE.RGBAFormat);
  anisotropyMap.needsUpdate = true;

  const roughnessMap = new THREE.DataTexture(roughData, S, S, THREE.RGBAFormat);
  roughnessMap.needsUpdate = true;

  return { normalMap, anisotropyMap, roughnessMap };
}

// 3. Helical Screw Thread & Diamond Knurl Normal Maps (512x512)
function createThreadAndKnurlMaps() {
  const S = 512;
  const threadH = new Float32Array(S * S);
  const threadCol = new Uint8Array(S * S * 4);
  const knurlH = new Float32Array(S * S);

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = x / S;
      const v = y / S;
      // Sharp V-profile helical screw thread (18 pitches)
      const phase = (v * 18.0 + u * 1.0) % 1.0;
      const tri = 1.0 - Math.abs(phase * 2.0 - 1.0);
      const th = Math.pow(tri, 0.85);
      threadH[y * S + x] = th;

      // Ambient occlusion in thread root makes silver bolts look deeply 3D!
      const ao = Math.round(115 + th * 135);
      const idx = (y * S + x) * 4;
      threadCol[idx] = ao;
      threadCol[idx + 1] = Math.min(255, ao + 3);
      threadCol[idx + 2] = Math.min(255, ao + 8);
      threadCol[idx + 3] = 255;

      // Crisp diamond knurl pattern for thumbscrew collars & tool handles
      const k1 = Math.abs(((u * 28 + v * 28) % 1 + 1) % 1 - 0.5) * 2;
      const k2 = Math.abs(((u * 28 - v * 28) % 1 + 1) % 1 - 0.5) * 2;
      knurlH[y * S + x] = Math.min(k1, k2);
    }
  }

  const threadNormal = heightToNormalTexture(threadH, S, S, 4.2, 1, 1);
  const threadColor = new THREE.DataTexture(threadCol, S, S, THREE.RGBAFormat);
  threadColor.colorSpace = THREE.SRGBColorSpace;
  threadColor.wrapS = threadColor.wrapT = THREE.RepeatWrapping;
  threadColor.needsUpdate = true;

  const knurlNormal = heightToNormalTexture(knurlH, S, S, 3.4, 2, 1);
  return { threadNormal, threadColor, knurlNormal };
}

// 4. Dark Oiled Walnut Workbench & Night Floorboards (1024x1024)
function createDarkWalnutMaps() {
  const S = 1024;
  const c = makeCanvas(S, S);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#24160e';
  ctx.fillRect(0, 0, S, S);

  const height = new Float32Array(S * S);

  // Rich organic wood grain bands + plank seams + bench scratches
  const img = ctx.getImageData(0, 0, S, S);
  const d = img.data;
  for (let y = 0; y < S; y++) {
    const plankIdx = Math.floor(y / 256);
    const plankSeam = Math.min(y % 256, 256 - (y % 256));
    const plankTint = ((plankIdx * 37) % 17) - 8;
    for (let x = 0; x < S; x++) {
      const nx = x * 0.008;
      const ny = y * 0.055 + plankIdx * 3.1;
      const warp = Math.sin(nx * 2.3 + Math.sin(ny * 0.45) * 2.2) * 3.8;
      const ring = Math.sin(ny * 2.4 + warp) * 0.5 + 0.5;
      const finePore = (Math.sin(x * 0.35 + y * 2.9) * 0.5 + 0.5) * (Math.random() * 0.35 + 0.65);
      let lum = 28 + ring * 22 - (finePore > 0.84 ? 9 : 0) + plankTint;
      let h = 0.55 + ring * 0.18 - (finePore > 0.84 ? 0.22 : 0);

      if (plankSeam < 3) {
        lum *= 0.42;
        h = 0.08;
      }
      const idx = (y * S + x) * 4;
      d[idx] = Math.max(10, Math.min(95, lum * 1.28));
      d[idx + 1] = Math.max(7, Math.min(68, lum * 0.86));
      d[idx + 2] = Math.max(5, Math.min(48, lum * 0.58));
      d[idx + 3] = 255;
      height[y * S + x] = h;
    }
  }

  // Subtle workshop dents & tool scuffs on the wooden bench
  for (let s = 0; s < 95; s++) {
    let x = Math.random() * S;
    let y = Math.random() * S;
    const a = (Math.random() - 0.5) * 0.8;
    const len = 20 + Math.random() * 90;
    for (let k = 0; k < len; k++) {
      const ix = ((Math.floor(x) % S) + S) % S;
      const iy = ((Math.floor(y) % S) + S) % S;
      const idx = (iy * S + ix) * 4;
      d[idx] = Math.min(115, d[idx] + 14);
      d[idx + 1] = Math.min(84, d[idx + 1] + 10);
      d[idx + 2] = Math.min(58, d[idx + 2] + 7);
      height[iy * S + ix] -= 0.14;
      x += Math.cos(a);
      y += Math.sin(a);
    }
  }
  ctx.putImageData(img, 0, 0);

  const colorMap = new THREE.CanvasTexture(c);
  colorMap.colorSpace = THREE.SRGBColorSpace;
  colorMap.wrapS = colorMap.wrapT = THREE.RepeatWrapping;

  const normalMap = heightToNormalTexture(height, S, S, 1.8, 1, 1);

  const roughData = new Uint8Array(S * S * 4);
  for (let i = 0; i < S * S; i++) {
    const rv = Math.round(115 + (1 - Math.max(0, Math.min(1, height[i]))) * 95);
    roughData[i * 4] = rv;
    roughData[i * 4 + 1] = rv;
    roughData[i * 4 + 2] = rv;
    roughData[i * 4 + 3] = 255;
  }
  const roughnessMap = new THREE.DataTexture(roughData, S, S, THREE.RGBAFormat);
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.needsUpdate = true;

  return { colorMap, normalMap, roughnessMap };
}

// 5. Kraft Cardboard & Woven Fabric Maps (512x512)
function createCardboardAndFabricMaps() {
  const S = 512;
  const cbC = makeCanvas(S, S);
  const ctx = cbC.getContext('2d');
  ctx.fillStyle = '#9a734c';
  ctx.fillRect(0, 0, S, S);
  const img = ctx.getImageData(0, 0, S, S);
  const d = img.data;
  const cbH = new Float32Array(S * S);
  const fabH = new Float32Array(S * S);

  for (let y = 0; y < S; y++) {
    const corr = Math.sin((y / S) * Math.PI * 64) * 0.08;
    for (let x = 0; x < S; x++) {
      const speck = (Math.random() - 0.5) * 26;
      const idx = (y * S + x) * 4;
      d[idx] = Math.max(70, Math.min(195, 152 + speck + corr * 50));
      d[idx + 1] = Math.max(50, Math.min(155, 114 + speck * 0.8 + corr * 40));
      d[idx + 2] = Math.max(32, Math.min(110, 74 + speck * 0.6 + corr * 25));
      d[idx + 3] = 255;
      cbH[y * S + x] = 0.5 + corr + (Math.random() - 0.5) * 0.18;

      // Twill fabric weave for girl's work sleeve cuff & overalls
      const wx = (x + Math.floor(y * 0.5)) % 6;
      const wy = y % 6;
      fabH[y * S + x] = (wx < 3 ? 0.68 : 0.32) * 0.6 + (wy < 3 ? 0.65 : 0.35) * 0.4;
    }
  }
  ctx.putImageData(img, 0, 0);

  // Wordless geometric robot emblem stamped in dark ink on cardboard (ZERO text!)
  ctx.strokeStyle = 'rgba(42, 28, 18, 0.42)';
  ctx.lineWidth = 6;
  ctx.strokeRect(36, 36, S - 72, S - 72);
  ctx.beginPath();
  ctx.arc(S * 0.5, S * 0.5, 68, 0, Math.PI * 2);
  ctx.stroke();

  const cardboardColor = new THREE.CanvasTexture(cbC);
  cardboardColor.colorSpace = THREE.SRGBColorSpace;
  const cardboardNormal = heightToNormalTexture(cbH, S, S, 1.5, 1, 1);
  const fabricNormal = heightToNormalTexture(fabH, S, S, 2.0, 6, 6);

  return { cardboardColor, cardboardNormal, fabricNormal };
}

// 6. Wordless 1-Board Illustrated Rule Signboard Texture (1024x512, ZERO text/numbers/UI arrows!)
export function createPictorialRuleBoardTexture() {
  const W = 1024;
  const H = 512;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');

  // Warm aged parchment/linen workshop board background with subtle grain
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#efe3cc');
  bg.addColorStop(1, '#dcc8a4');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  for (let i = 0; i < 4500; i++) {
    ctx.fillStyle = i % 2 === 0 ? 'rgba(95,70,42,0.045)' : 'rgba(255,248,232,0.06)';
    ctx.fillRect(Math.random() * W, Math.random() * H, 2 + Math.random() * 8, 2);
  }

  // Engraved brass-brown double border & 3 panel dividers (NO numbers, NO arrows, NO text!)
  ctx.strokeStyle = '#4e3924';
  ctx.lineWidth = 8;
  ctx.strokeRect(20, 20, W - 40, H - 40);
  ctx.lineWidth = 3;
  ctx.strokeRect(32, 32, W - 64, H - 64);

  // Subtle vertical brass divider lines between the 3 story panels
  [W / 3, (W * 2) / 3].forEach((x) => {
    ctx.strokeStyle = 'rgba(78,57,36,0.38)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, 54);
    ctx.lineTo(x, H - 54);
    ctx.stroke();
  });

  // Helper to paint silver shaded shape
  const silverGrad = (x0, y0, x1, y1) => {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, '#f6f9fc');
    g.addColorStop(0.45, '#b8c3ce');
    g.addColorStop(0.75, '#7f8b98');
    g.addColorStop(1, '#dce4ec');
    return g;
  };

  // --- PANEL 1 (Left): Open Box + Silver Robot Parts + Big Screw ---
  ctx.save();
  ctx.translate(W / 6, H * 0.54);
  // Open kraft box at bottom
  ctx.fillStyle = '#a87c4f';
  ctx.strokeStyle = '#3b2818';
  ctx.lineWidth = 5;
  ctx.fillRect(-78, 52, 156, 76);
  ctx.strokeRect(-78, 52, 156, 76);
  // Open flaps
  ctx.beginPath();
  ctx.moveTo(-78, 52);
  ctx.lineTo(-118, 26);
  ctx.lineTo(-78, 12);
  ctx.lineTo(-20, 52);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(78, 52);
  ctx.lineTo(118, 26);
  ctx.lineTo(78, 12);
  ctx.lineTo(20, 52);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Exploded silver robot parts rising out of box + big silver screw
  ctx.fillStyle = silverGrad(-48, -60, 48, 30);
  // Torso
  ctx.beginPath();
  ctx.roundRect(-44, -36, 88, 72, 14);
  ctx.fill();
  ctx.stroke();
  // Glowing cyan core circle
  ctx.fillStyle = '#4ad8ff';
  ctx.beginPath();
  ctx.arc(0, 0, 17, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Head hovering above
  ctx.fillStyle = silverGrad(-36, -125, 36, -65);
  ctx.beginPath();
  ctx.roundRect(-34, -118, 68, 52, 14);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffe082';
  ctx.beginPath();
  ctx.arc(-13, -92, 8, 0, Math.PI * 2);
  ctx.arc(13, -92, 8, 0, Math.PI * 2);
  ctx.fill();
  // Arms & Big chunky silver screw on right
  ctx.fillStyle = silverGrad(58, -95, 112, -35);
  ctx.beginPath();
  ctx.arc(86, -68, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Screw slot
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(70, -68);
  ctx.lineTo(102, -68);
  ctx.stroke();
  // Screw threads
  for (let t = 0; t < 3; t++) {
    ctx.fillRect(77, -42 + t * 10, 18, 7);
    ctx.strokeRect(77, -42 + t * 10, 18, 7);
  }
  ctx.restore();

  // --- PANEL 2 (Center): Red Fault Lamp Scattering Blocks + Hand Pressing Big Red Reset Button ---
  ctx.save();
  ctx.translate(W / 2, H * 0.54);
  // Red lamp glow halo
  const rg = ctx.createRadialGradient(0, -108, 6, 0, -108, 72);
  rg.addColorStop(0, 'rgba(255,60,60,0.65)');
  rg.addColorStop(1, 'rgba(255,60,60,0)');
  ctx.fillStyle = rg;
  ctx.beginPath();
  ctx.arc(0, -108, 72, 0, Math.PI * 2);
  ctx.fill();

  // Tilted dizzy silver robot
  ctx.save();
  ctx.rotate(-0.14);
  ctx.strokeStyle = '#3b2818';
  ctx.lineWidth = 5;
  ctx.fillStyle = silverGrad(-48, -50, 48, 50);
  ctx.beginPath();
  ctx.roundRect(-46, -42, 92, 86, 14);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(-34, -100, 68, 50, 12);
  ctx.fill();
  ctx.stroke();
  // Red siren dome on top
  ctx.fillStyle = '#ff3b30';
  ctx.beginPath();
  ctx.arc(0, -110, 16, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Big round red button on chest
  ctx.fillStyle = '#ff3b30';
  ctx.beginPath();
  ctx.arc(0, 2, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Scattered wooden blocks around
  const blocks = [[-98, -42, '#c88242'], [96, -52, '#d49b4b'], [-92, 68, '#8a99a8'], [98, 54, '#c88242']];
  blocks.forEach(([bx, by, col]) => {
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(bx * 0.01);
    ctx.fillStyle = col;
    ctx.strokeStyle = '#3b2818';
    ctx.lineWidth = 4;
    ctx.fillRect(-16, -16, 32, 32);
    ctx.strokeRect(-16, -16, 32, 32);
    ctx.restore();
  });

  // Child's hand silhouette reaching to press the big chest button
  ctx.fillStyle = '#f2c2a2';
  ctx.strokeStyle = '#3b2818';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.roundRect(8, 12, 22, 52, 10);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(28, 72, 28, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // --- PANEL 3 (Right): Clean Silver Basket + Joyful Dancing Robot with Music Notes ---
  ctx.save();
  ctx.translate((W * 5) / 6, H * 0.54);
  // Warm golden dance aura
  const gg = ctx.createRadialGradient(22, -25, 10, 22, -25, 110);
  gg.addColorStop(0, 'rgba(255,215,100,0.55)');
  gg.addColorStop(1, 'rgba(255,215,100,0)');
  ctx.fillStyle = gg;
  ctx.beginPath();
  ctx.arc(22, -25, 110, 0, Math.PI * 2);
  ctx.fill();

  // Brushed silver basket filled neatly with blocks on left
  ctx.fillStyle = silverGrad(-120, 25, -35, 115);
  ctx.strokeStyle = '#3b2818';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-118, 42);
  ctx.lineTo(-42, 42);
  ctx.lineTo(-52, 108);
  ctx.lineTo(-108, 108);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#c88242';
  ctx.fillRect(-102, 20, 24, 22);
  ctx.strokeRect(-102, 20, 24, 22);
  ctx.fillStyle = '#d8a648';
  ctx.fillRect(-74, 16, 24, 26);
  ctx.strokeRect(-74, 16, 24, 26);

  // Happy dancing silver robot raising arms!
  ctx.save();
  ctx.translate(32, -5);
  ctx.rotate(0.12);
  ctx.fillStyle = silverGrad(-40, -40, 40, 45);
  ctx.beginPath();
  ctx.roundRect(-38, -32, 76, 72, 14);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(-30, -84, 60, 46, 12);
  ctx.fill();
  ctx.stroke();
  // Happy raised arms
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(-38, -14);
  ctx.lineTo(-72, -58);
  ctx.moveTo(38, -14);
  ctx.lineTo(72, -62);
  ctx.stroke();
  // Glowing emerald core
  ctx.fillStyle = '#4ef2a1';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 4, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Musical eighth-note shapes (pictorial symbols, zero letters!)
  const drawNote = (nx, ny) => {
    ctx.fillStyle = '#5a3a1e';
    ctx.strokeStyle = '#5a3a1e';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.ellipse(nx, ny, 9, 7, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(nx + 7, ny);
    ctx.lineTo(nx + 7, ny - 30);
    ctx.lineTo(nx + 20, ny - 23);
    ctx.stroke();
  };
  drawNote(-28, -98);
  drawNote(92, -92);
  ctx.restore();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// 7. Bespoke Night Room + Single Overhead Pendant Light HDR-like PMREM Environment!
// Crucial for ultra-realistic silver metal anisotropy in a dark room!
export function createNightWorkshopEnvMap(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x05070d);

  // Dark room enclosure in envMap — lifted satin room bounce so silver metal reads bright liquid SILVER, not black!
  const roomGeo = new THREE.BoxGeometry(24, 16, 24);
  const roomMat = new THREE.MeshBasicMaterial({ color: 0x232b3a, side: THREE.BackSide });
  envScene.add(new THREE.Mesh(roomGeo, roomMat));

  // Warm dark walnut floor/workbench bounce from below so underside of silver metal catches warm wood tint
  const bounceFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 20),
    new THREE.MeshBasicMaterial({ color: 0x4e3522 })
  );
  bounceFloor.rotation.x = -Math.PI / 2;
  bounceFloor.position.y = -4.2;
  envScene.add(bounceFloor);

  // THE HERO SINGLE OVERHEAD PENDANT LIGHT in the reflection map!
  // Balanced HDR intensity so brushed silver shows crisp anisotropic streaks without whiteout!
  const shadeGlow = new THREE.Mesh(
    new THREE.CircleGeometry(2.6, 32),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.95, 1.25), side: THREE.DoubleSide })
  );
  shadeGlow.rotation.x = Math.PI / 2;
  shadeGlow.position.set(0.35, 6.8, 0.85);
  envScene.add(shadeGlow);

  const bulbCore = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 20, 16),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(4.2, 3.3, 2.1) })
  );
  bulbCore.position.set(0.35, 6.5, 0.85);
  envScene.add(bulbCore);

  // Broad front/camera-side soft silver reflection card so front-facing brushed robot plates gleam silver!
  const cameraSideBounce = new THREE.Mesh(
    new THREE.PlaneGeometry(14.0, 7.5),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.78, 0.82, 0.9), side: THREE.DoubleSide })
  );
  cameraSideBounce.position.set(0, 3.2, 9.5);
  cameraSideBounce.lookAt(0, 0, 0);
  envScene.add(cameraSideBounce);

  // Broad soft studio-like night room ceiling/wall strips so horizontal brushed metal plates catch rich silver gradients!
  const frontFillStrip = new THREE.Mesh(
    new THREE.PlaneGeometry(11.0, 4.2),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.62, 0.68, 0.78), side: THREE.DoubleSide })
  );
  frontFillStrip.position.set(0, 4.2, -7.5);
  frontFillStrip.lookAt(0, 0, 0);
  envScene.add(frontFillStrip);

  // Subtle secondary warm reflection strip so vertical cylindrical edges catch crisp anisotropic streaks!
  const warmSideReflect = new THREE.Mesh(
    new THREE.PlaneGeometry(2.2, 5.5),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.95, 0.68, 0.42), side: THREE.DoubleSide })
  );
  warmSideReflect.position.set(6.2, 2.4, 4.2);
  warmSideReflect.lookAt(0, 0, 0);
  envScene.add(warmSideReflect);

  // Subtle night window cool moonlit rim on far left so silver contours separate cleanly from dark background
  const moonWindow = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 4.8),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.38, 0.55, 0.92), side: THREE.DoubleSide })
  );
  moonWindow.position.set(-8.5, 2.6, -2.5);
  moonWindow.lookAt(0, 0, 0);
  envScene.add(moonWindow);

  // Subtle robot-colored accent glint in far front
  const subtleRim = new THREE.Mesh(
    new THREE.PlaneGeometry(2.5, 2.0),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.28, 0.42, 0.55), side: THREE.DoubleSide })
  );
  subtleRim.position.set(-3.2, 0.8, 7.5);
  subtleRim.lookAt(0, 0, 0);
  envScene.add(subtleRim);

  const rt = pmrem.fromScene(envScene, 0.032);
  pmrem.dispose();
  return rt.texture;
}

// Master Material Library
export function createMaterialLibrary(renderer) {
  const envMap = createNightWorkshopEnvMap(renderer);
  const brushed = createBrushedMetalMaps();
  const radial = createRadialLatheMaps();
  const threads = createThreadAndKnurlMaps();
  const walnut = createDarkWalnutMaps();
  const craft = createCardboardAndFabricMaps();

  // Hero Silver Metal #1: Linear Brushed Machined Aluminum (Anisotropic!)
  const silverBrushed = new THREE.MeshPhysicalMaterial({
    color: 0xd8e1ec,
    map: brushed.colorMap,
    normalMap: brushed.normalMap,
    normalScale: new THREE.Vector2(0.68, 0.68),
    roughnessMap: brushed.roughnessMap,
    metalness: 1.0,
    roughness: 0.27,
    anisotropy: 0.92,
    anisotropyRotation: 0.0,
    envMapIntensity: 1.12,
  });

  // Hero Silver Metal #2: Vertical/Cross-Turned Stainless Steel (Rotated Anisotropy)
  const silverTurned = new THREE.MeshPhysicalMaterial({
    color: 0xcdd6e2,
    map: brushed.colorMap,
    normalMap: brushed.normalMap,
    normalScale: new THREE.Vector2(0.72, 0.72),
    roughnessMap: brushed.roughnessMap,
    metalness: 1.0,
    roughness: 0.3,
    anisotropy: 0.94,
    anisotropyRotation: Math.PI * 0.5,
    envMapIntensity: 1.08,
  });

  // Hero Silver Metal #3: High-Polish Chrome Bevels & Bearings
  const silverChrome = new THREE.MeshPhysicalMaterial({
    color: 0xebf1f8,
    normalMap: brushed.normalMap,
    normalScale: new THREE.Vector2(0.18, 0.18),
    metalness: 1.0,
    roughness: 0.11,
    anisotropy: 0.6,
    clearcoat: 0.2,
    clearcoatRoughness: 0.1,
    envMapIntensity: 1.18,
  });

  // Hero Screw Head Material: Radial Conical Anisotropy!
  const screwHeadMetal = new THREE.MeshPhysicalMaterial({
    color: 0xd6dfe9,
    normalMap: radial.normalMap,
    normalScale: new THREE.Vector2(0.75, 0.75),
    roughnessMap: radial.roughnessMap,
    anisotropyMap: radial.anisotropyMap,
    metalness: 1.0,
    roughness: 0.26,
    anisotropy: 0.96,
    envMapIntensity: 1.16,
  });

  // Helical Screw Thread Shaft Material
  const screwThreadMetal = new THREE.MeshPhysicalMaterial({
    color: 0xcfd8e4,
    map: threads.threadColor,
    normalMap: threads.threadNormal,
    normalScale: new THREE.Vector2(1.25, 1.25),
    metalness: 1.0,
    roughness: 0.31,
    anisotropy: 0.75,
    envMapIntensity: 1.08,
  });

  // Diamond-Knurled Steel Grip Material
  const knurledSteel = new THREE.MeshPhysicalMaterial({
    color: 0xbec8d4,
    normalMap: threads.knurlNormal,
    normalScale: new THREE.Vector2(1.05, 1.05),
    metalness: 1.0,
    roughness: 0.38,
    anisotropy: 0.65,
    envMapIntensity: 1.05,
  });

  // Darker Gunmetal Steel for recessed cavities, slots, and joints (creates contrast!)
  const darkSteel = new THREE.MeshPhysicalMaterial({
    color: 0x3f4752,
    normalMap: brushed.normalMap,
    normalScale: new THREE.Vector2(0.55, 0.55),
    metalness: 0.94,
    roughness: 0.46,
    anisotropy: 0.55,
    envMapIntensity: 0.92,
  });

  // Brushed Warm Brass & Copper Accents (mirror frame, gears, electrical contacts)
  const brushedBrass = new THREE.MeshPhysicalMaterial({
    color: 0xd4a85a,
    normalMap: radial.normalMap,
    normalScale: new THREE.Vector2(0.45, 0.45),
    roughnessMap: brushed.roughnessMap,
    anisotropyMap: radial.anisotropyMap,
    metalness: 1.0,
    roughness: 0.29,
    anisotropy: 0.82,
    envMapIntensity: 1.05,
  });

  const warmCopper = new THREE.MeshPhysicalMaterial({
    color: 0xc97650,
    normalMap: brushed.normalMap,
    normalScale: new THREE.Vector2(0.45, 0.45),
    metalness: 1.0,
    roughness: 0.28,
    anisotropy: 0.8,
    envMapIntensity: 1.05,
  });

  // Optical Glass Lens Cover
  const lensGlass = new THREE.MeshPhysicalMaterial({
    color: 0xdff6ff,
    metalness: 0.05,
    roughness: 0.05,
    transmission: 0.72,
    ior: 1.52,
    thickness: 0.18,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    envMapIntensity: 1.8,
    transparent: true,
    opacity: 0.88,
  });

  // Dark Oiled Walnut Workbench & Floor
  const benchWood = new THREE.MeshStandardMaterial({
    map: walnut.colorMap,
    normalMap: walnut.normalMap,
    normalScale: new THREE.Vector2(0.65, 0.65),
    roughnessMap: walnut.roughnessMap,
    roughness: 0.62,
    metalness: 0.04,
    envMapIntensity: 0.65,
  });

  const floorWood = benchWood.clone();
  floorWood.map = walnut.colorMap.clone();
  floorWood.map.repeat.set(3, 3);
  floorWood.map.needsUpdate = true;
  floorWood.normalMap = walnut.normalMap.clone();
  floorWood.normalMap.repeat.set(3, 3);
  floorWood.normalMap.needsUpdate = true;

  // Natural Beechwood & Maple for realistic wooden blocks (NO plastic look!)
  const beechWood = new THREE.MeshStandardMaterial({
    color: 0xd4a46e,
    normalMap: walnut.normalMap,
    normalScale: new THREE.Vector2(0.35, 0.35),
    roughness: 0.52,
    metalness: 0.02,
  });

  const cherryWood = new THREE.MeshStandardMaterial({
    color: 0x9c5538,
    normalMap: walnut.normalMap,
    normalScale: new THREE.Vector2(0.35, 0.35),
    roughness: 0.48,
    metalness: 0.02,
  });

  // Kraft Cardboard Box
  const cardboard = new THREE.MeshStandardMaterial({
    map: craft.cardboardColor,
    normalMap: craft.cardboardNormal,
    normalScale: new THREE.Vector2(0.6, 0.6),
    roughness: 0.86,
    metalness: 0.0,
  });

  const paperTape = new THREE.MeshStandardMaterial({
    color: 0xc9a675,
    normalMap: craft.cardboardNormal,
    normalScale: new THREE.Vector2(0.25, 0.25),
    roughness: 0.68,
    metalness: 0.0,
  });

  // Realistic Warm Child Skin (Subtle peach-rose subsurface sheen, soft roughness, non-plastic!)
  const childSkin = new THREE.MeshPhysicalMaterial({
    color: 0xedb89a,
    roughness: 0.54,
    metalness: 0.0,
    sheen: 0.38,
    sheenRoughness: 0.65,
    sheenColor: new THREE.Color(0xff9d82),
    clearcoat: 0.08,
    clearcoatRoughness: 0.55,
    envMapIntensity: 0.42,
  });

  const fingernailMat = new THREE.MeshPhysicalMaterial({
    color: 0xf5cfc2,
    roughness: 0.26,
    metalness: 0.0,
    clearcoat: 0.65,
    clearcoatRoughness: 0.2,
    envMapIntensity: 0.65,
  });

  const dadSkin = new THREE.MeshPhysicalMaterial({
    color: 0xdfa484,
    roughness: 0.58,
    metalness: 0.0,
    sheen: 0.3,
    sheenRoughness: 0.7,
    sheenColor: new THREE.Color(0xe8896d),
    envMapIntensity: 0.38,
  });

  // Hair with soft natural matte-satin texture (no metallic bowl-cut band!)
  const darkBrownHair = new THREE.MeshPhysicalMaterial({
    color: 0x241710,
    normalMap: brushed.normalMap,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughness: 0.68,
    metalness: 0.0,
    sheen: 0.25,
    sheenRoughness: 0.75,
    sheenColor: new THREE.Color(0x523522),
    envMapIntensity: 0.16,
  });

  // 3 Fabric Outfits (Denim Mechanic, Olive Canvas Inventor, Crimson/Navy Knit-Trim Craft Coat)
  const outfitFabrics = [
    new THREE.MeshStandardMaterial({
      color: 0x2b466b,
      normalMap: craft.fabricNormal,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughness: 0.84,
      metalness: 0.02,
    }),
    new THREE.MeshStandardMaterial({
      color: 0x4b5c3b,
      normalMap: craft.fabricNormal,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughness: 0.86,
      metalness: 0.02,
    }),
    new THREE.MeshStandardMaterial({
      color: 0x7c2d36,
      normalMap: craft.fabricNormal,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughness: 0.8,
      metalness: 0.02,
    }),
  ];

  const outfitCuffs = [
    new THREE.MeshStandardMaterial({
      color: 0x9c6b3b, // Warm saddle leather strap/cuff
      normalMap: craft.cardboardNormal,
      normalScale: new THREE.Vector2(0.35, 0.35),
      roughness: 0.55,
      metalness: 0.04,
    }),
    new THREE.MeshStandardMaterial({
      color: 0xc29862, // Khaki canvas trim
      normalMap: craft.fabricNormal,
      roughness: 0.82,
    }),
    new THREE.MeshStandardMaterial({
      color: 0xd8cdb8, // Warm cream knit cuff
      normalMap: craft.fabricNormal,
      normalScale: new THREE.Vector2(1.1, 1.1),
      roughness: 0.88,
    }),
  ];

  return {
    envMap,
    brushed,
    radial,
    threads,
    silverBrushed,
    silverTurned,
    silverChrome,
    screwHeadMetal,
    screwThreadMetal,
    knurledSteel,
    darkSteel,
    brushedBrass,
    warmCopper,
    lensGlass,
    benchWood,
    floorWood,
    beechWood,
    cherryWood,
    cardboard,
    paperTape,
    childSkin,
    fingernailMat,
    dadSkin,
    darkBrownHair,
    outfitFabrics,
    outfitCuffs,
  };
}

// Helper to clone a customizable anisotropic silver material per robot part so polishLevel continuously alters roughness & reflection!
export function makeCustomPartMetal(mats, variant = 0) {
  const base = variant === 0 ? mats.silverBrushed : variant === 1 ? mats.silverTurned : mats.silverChrome;
  const m = base.clone();
  m.roughness = variant === 2 ? 0.14 : 0.27;
  m.anisotropy = 0.9;
  return m;
}
