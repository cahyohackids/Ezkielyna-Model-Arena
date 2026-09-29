// All sprites are drawn procedurally as pixel art: shapes are composed from
// rectangles and a few primitives at a consistent pixel scale, then scaled up
// by the canvas transform. This keeps silhouettes clean and consistent.

import { hash2 } from './mathUtils.js';

export const PAL = {
  navy: '#0b0f1c',
  navy2: '#141a2e',
  deep: '#1d2745',
  blue: '#2e3f6b',
  blueSoft: '#43568c',
  blueLite: '#5b71ad',
  teal: '#3fd2c5',
  tealDim: '#2a8f86',
  tealDark: '#1c635d',
  orange: '#f0a35e',
  orangeDeep: '#e8763a',
  cream: '#f2ead9',
  creamDim: '#b9b29f',
  danger: '#e85e6b',
  dangerDeep: '#a33240',
  purple: '#7a4a8c',
  dark: '#070a14',
};

function px(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

// ============================================================
// PIP the courier robot
// ============================================================
// PIP faces right by default; flip via ctx.scale(-1,1).
// Body is ~14x14 px with a rounded silhouette, visor, antenna, backpack.

export function drawPip(ctx, x, y, anim, frame, facing, flash) {
  // x,y = top-left of the 16x18 sprite box (in scaled space)
  const f = frame; // animation frame float
  ctx.save();
  if (facing < 0) {
    ctx.translate(x + 16, y);
    ctx.scale(-1, 1);
  } else {
    ctx.translate(x, y);
  }

  const body = flash ? '#ffffff' : PAL.cream;
  const shade = flash ? '#ffffff' : PAL.creamDim;
  const visor = flash ? '#ffffff' : PAL.teal;

  // ---- antenna (sways with motion) ----
  const sway = Math.sin(f * 0.5) * 1.2;
  px(ctx, 7, 0, 2, 4, shade);
  px(ctx, 6 + sway, -1, 3, 2, PAL.orange);

  // ---- backpack transmitter (behind body) ----
  px(ctx, 11, 5, 4, 7, PAL.blue);
  px(ctx, 12, 6, 2, 2, PAL.tealDim);
  px(ctx, 10, 6, 1, 5, PAL.blueSoft);

  // ---- legs (animation driven) ----
  let legA = 0, legB = 0;
  if (anim === 'run') {
    legA = Math.sin(f) * 2.5;
    legB = Math.sin(f + Math.PI) * 2.5;
  } else if (anim === 'idle') {
    legA = Math.sin(f * 0.5) * 0.6;
    legB = -legA;
  } else if (anim === 'jump' || anim === 'fall') {
    legA = -1.5; legB = 1.5;
  } else if (anim === 'dash') {
    legA = 2; legB = -1;
  } else if (anim === 'damage' || anim === 'dead') {
    legA = 1; legB = 1;
  }
  const legY = 14;
  px(ctx, 4, legY, 3, 3 + Math.max(0, legA), PAL.blue);
  px(ctx, 9, legY, 3, 3 + Math.max(0, legB), PAL.blue);
  // feet
  px(ctx, 3, legY + 3 + Math.max(0, legA), 5, 2, PAL.deep);
  px(ctx, 8, legY + 3 + Math.max(0, legB), 5, 2, PAL.deep);

  // ---- arms ----
  if (anim === 'dash') {
    px(ctx, 1, 7, 4, 3, PAL.blueSoft);
    px(ctx, 0, 8, 2, 2, PAL.deep);
  } else if (anim === 'jump' || anim === 'fall') {
    px(ctx, 1, 6, 4, 3, PAL.blueSoft);
    px(ctx, 0, 5, 2, 2, PAL.deep);
  } else {
    const armSway = anim === 'run' ? Math.sin(f + Math.PI) * 1.5 : 0;
    px(ctx, 1, 7 + armSway, 4, 3, PAL.blueSoft);
    px(ctx, 0, 8 + armSway, 2, 2, PAL.deep);
  }

  // ---- body (rounded box) ----
  px(ctx, 3, 4, 10, 11, body);
  px(ctx, 4, 3, 8, 1, body);
  px(ctx, 4, 15, 8, 1, body);
  px(ctx, 2, 6, 1, 7, body);
  px(ctx, 13, 6, 1, 7, body);
  // body shading
  px(ctx, 3, 12, 10, 3, shade);
  px(ctx, 12, 6, 1, 6, shade);
  // chest panel
  px(ctx, 6, 9, 4, 3, PAL.blue);
  px(ctx, 7, 10, 2, 1, PAL.tealDim);

  // ---- head/visor ----
  px(ctx, 4, 4, 9, 5, body);
  px(ctx, 5, 3, 7, 1, body);
  // visor glass
  px(ctx, 5, 5, 7, 3, PAL.deep);
  px(ctx, 6, 6, 5, 1, visor);
  // eye glow dot
  const blink = (Math.floor(f / 18) % 13 === 0) ? 0 : 1;
  if (blink) px(ctx, 9, 6, 2, 1, PAL.cream);
  // antenna base mount
  px(ctx, 7, 3, 2, 1, shade);

  ctx.restore();
}

// ============================================================
// Signal Bit (collectible)
// ============================================================
export function drawBit(ctx, x, y, t) {
  const s = Math.sin(t * 3) * 0.5 + 0.5;
  const w = 6 + s * 2;
  const h = 8 - s * 2;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = PAL.tealDim;
  ctx.fillRect(-w / 2 - 1, -h / 2, w + 2, h);
  ctx.fillStyle = PAL.teal;
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.fillStyle = PAL.cream;
  ctx.fillRect(-w / 2 + 1, -h / 2 + 1, 1, h - 2);
  ctx.restore();
}

// ============================================================
// Data Core (rare collectible)
// ============================================================
export function drawCore(ctx, x, y, t) {
  const p = (Math.sin(t * 2.2) + 1) / 2;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(t * 0.8);
  // outer diamond
  ctx.fillStyle = PAL.orangeDeep;
  ctx.beginPath();
  ctx.moveTo(0, -8); ctx.lineTo(7, 0); ctx.lineTo(0, 8); ctx.lineTo(-7, 0);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = PAL.orange;
  ctx.beginPath();
  ctx.moveTo(0, -6); ctx.lineTo(5, 0); ctx.lineTo(0, 6); ctx.lineTo(-5, 0);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = PAL.cream;
  ctx.globalAlpha = 0.5 + p * 0.5;
  ctx.fillRect(-2, -2, 3, 3);
  ctx.restore();
}

// ============================================================
// Enemies
// ============================================================
export function drawHopper(ctx, x, y, t, squash, dead) {
  // Glitch Hopper: small ground patroller, 14x14
  ctx.save();
  ctx.translate(x, y);
  if (dead) ctx.globalAlpha = 0.5;
  const hop = Math.abs(Math.sin(t * 4)) * 2;
  const sy = 1 - squash;
  ctx.scale(1 + squash * 0.5, sy);
  // legs
  px(ctx, 1, 11 - hop, 3, 3 + hop, PAL.deep);
  px(ctx, 10, 11 - hop, 3, 3 + hop, PAL.deep);
  // body
  px(ctx, 2, 4, 10, 8, PAL.dangerDeep);
  px(ctx, 3, 3, 8, 1, PAL.dangerDeep);
  px(ctx, 2, 11, 10, 1, PAL.danger);
  // glitch band
  const band = Math.floor(t * 6) % 3;
  px(ctx, 3, 6 + band, 8, 1, PAL.danger);
  // eye
  px(ctx, 9, 6, 3, 2, PAL.cream);
  px(ctx, 10, 6, 1, 1, PAL.navy);
  // spikes on top
  px(ctx, 3, 2, 1, 2, PAL.danger);
  px(ctx, 6, 1, 1, 3, PAL.danger);
  px(ctx, 9, 2, 1, 2, PAL.danger);
  ctx.restore();
}

export function drawDrone(ctx, x, y, t, dead) {
  // Static Drone: floating sentinel with a scanning eye, 14x12
  ctx.save();
  ctx.translate(x, y);
  if (dead) ctx.globalAlpha = 0.5;
  const bob = Math.sin(t * 3) * 1.5;
  ctx.translate(0, bob);
  // hull
  px(ctx, 2, 2, 10, 7, PAL.blue);
  px(ctx, 3, 1, 8, 1, PAL.blueSoft);
  px(ctx, 1, 4, 1, 3, PAL.blueSoft);
  px(ctx, 13, 4, 1, 3, PAL.blueSoft);
  px(ctx, 2, 9, 10, 1, PAL.deep);
  // eye / scanner
  const scan = (Math.sin(t * 2) + 1) / 2;
  px(ctx, 4, 4, 6, 3, PAL.deep);
  px(ctx, 5, 5, 4, 1, PAL.danger);
  px(ctx, 5 + scan * 3, 5, 1, 1, PAL.cream);
  // rotor glow
  px(ctx, 6, 0, 2, 1, PAL.teal);
  ctx.restore();
}

export function drawBug(ctx, x, y, t, facing, charging, dead) {
  // Corrupt Bug: fast low-profile charger, 16x10
  ctx.save();
  ctx.translate(x, y);
  if (dead) ctx.globalAlpha = 0.5;
  if (facing < 0) { ctx.translate(16, 0); ctx.scale(-1, 1); }
  const legs = Math.sin(t * (charging ? 18 : 9)) * 1.5;
  // legs
  px(ctx, 1, 7, 2, 2 + legs, PAL.deep);
  px(ctx, 5, 7, 2, 2 - legs, PAL.deep);
  px(ctx, 9, 7, 2, 2 + legs, PAL.deep);
  px(ctx, 13, 7, 2, 2 - legs, PAL.deep);
  // body
  const bodyCol = charging ? PAL.danger : PAL.purple;
  px(ctx, 1, 3, 14, 5, bodyCol);
  px(ctx, 2, 2, 12, 1, bodyCol);
  px(ctx, 0, 5, 1, 2, PAL.deep);
  px(ctx, 15, 5, 1, 2, PAL.deep);
  // glitch segments
  const g = Math.floor(t * 8) % 4;
  px(ctx, 3 + g * 2, 4, 2, 1, PAL.danger);
  // eye
  px(ctx, 12, 4, 3, 2, PAL.cream);
  px(ctx, 13, 4, 1, 1, PAL.navy);
  // charge spark
  if (charging) px(ctx, -2, 4, 2, 2, PAL.cream);
  ctx.restore();
}

// ============================================================
// Hazards & props
// ============================================================
export function drawSpike(ctx, x, y, w, t) {
  const n = Math.max(1, Math.floor(w / 6));
  for (let i = 0; i < n; i++) {
    const bx = x + i * 6;
    ctx.fillStyle = PAL.blueSoft;
    ctx.beginPath();
    ctx.moveTo(bx, y + 8);
    ctx.lineTo(bx + 3, y);
    ctx.lineTo(bx + 6, y + 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PAL.tealDim;
    ctx.beginPath();
    ctx.moveTo(bx + 3, y);
    ctx.lineTo(bx + 4.5, y + 8);
    ctx.lineTo(bx + 6, y + 8);
    ctx.closePath();
    ctx.fill();
  }
}

export function drawEnergyPit(ctx, x, y, w, t) {
  ctx.fillStyle = PAL.dark;
  ctx.fillRect(x, y, w, 8);
  const e = (Math.sin(t * 4) + 1) / 2;
  ctx.fillStyle = PAL.danger;
  ctx.globalAlpha = 0.55 + e * 0.4;
  ctx.fillRect(x, y + 2, w, 3);
  ctx.globalAlpha = 0.25;
  ctx.fillRect(x, y, w, 2);
  ctx.globalAlpha = 1;
  // bubbles
  for (let i = 0; i < w; i += 8) {
    const b = (t * 20 + i) % 40;
    if (b < 16) {
      ctx.fillStyle = PAL.orange;
      ctx.fillRect(x + i + 2, y - b / 2, 1, 1);
    }
  }
}

export function drawLaser(ctx, x, y, len, on, t, vertical) {
  ctx.save();
  ctx.translate(x, y);
  if (vertical) ctx.rotate(Math.PI / 2);
  // emitter nodes
  px(ctx, -3, -3, 3, 6, PAL.blueSoft);
  px(ctx, len, -3, 3, 6, PAL.blueSoft);
  px(ctx, -2, -2, 1, 4, PAL.tealDim);
  px(ctx, len + 1, -2, 1, 4, PAL.tealDim);
  if (on) {
    const f = (Math.sin(t * 30) + 1) / 2;
    ctx.fillStyle = PAL.danger;
    ctx.globalAlpha = 0.35 + f * 0.3;
    ctx.fillRect(0, -3, len, 6);
    ctx.globalAlpha = 1;
    ctx.fillStyle = PAL.cream;
    ctx.fillRect(0, -1, len, 2);
    ctx.fillStyle = PAL.danger;
    ctx.fillRect(0, 0, len, 1);
  } else {
    ctx.fillStyle = PAL.dangerDeep;
    ctx.globalAlpha = 0.5;
    ctx.fillRect(0, -1, len, 2);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

export function drawCheckpoint(ctx, x, y, active, t) {
  // terminal post, 12x20
  ctx.save();
  ctx.translate(x, y);
  px(ctx, 2, 4, 8, 16, PAL.blue);
  px(ctx, 1, 5, 1, 14, PAL.blueSoft);
  px(ctx, 10, 5, 1, 14, PAL.blueSoft);
  px(ctx, 2, 20, 8, 2, PAL.deep);
  // screen
  px(ctx, 3, 6, 6, 6, PAL.deep);
  if (active) {
    const p = (Math.sin(t * 4) + 1) / 2;
    px(ctx, 4, 7, 4, 4, PAL.teal);
    ctx.globalAlpha = 0.4 + p * 0.6;
    px(ctx, 4, 7, 4, 4, PAL.cream);
    ctx.globalAlpha = 1;
    // beacon
    px(ctx, 5, 1, 2, 3, PAL.teal);
    ctx.fillStyle = PAL.teal;
    ctx.globalAlpha = 0.3 + p * 0.5;
    ctx.fillRect(3, 0, 6, 2);
    ctx.globalAlpha = 1;
  } else {
    px(ctx, 4, 7, 4, 4, PAL.blueSoft);
    px(ctx, 5, 2, 2, 2, PAL.blueSoft);
  }
  ctx.restore();
}

export function drawTower(ctx, x, y, t, active, phase) {
  // Signal tower: 40x64 base structure with antenna
  ctx.save();
  ctx.translate(x, y);
  // base
  px(ctx, 8, 44, 24, 20, PAL.blue);
  px(ctx, 6, 46, 2, 16, PAL.blueSoft);
  px(ctx, 32, 46, 2, 16, PAL.blueSoft);
  px(ctx, 8, 62, 24, 2, PAL.deep);
  // mid segments
  px(ctx, 12, 30, 16, 14, PAL.deep);
  px(ctx, 14, 28, 12, 2, PAL.blueSoft);
  px(ctx, 12, 22, 16, 8, PAL.blue);
  px(ctx, 14, 20, 12, 2, PAL.blueSoft);
  // head
  px(ctx, 14, 10, 12, 10, PAL.blueSoft);
  px(ctx, 16, 8, 8, 2, PAL.tealDim);
  // dish
  ctx.fillStyle = PAL.tealDim;
  ctx.beginPath();
  ctx.moveTo(10, 10); ctx.lineTo(20, 0); ctx.lineTo(30, 10);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PAL.teal;
  ctx.beginPath();
  ctx.moveTo(14, 9); ctx.lineTo(20, 3); ctx.lineTo(26, 9);
  ctx.closePath();
  ctx.fill();
  // antenna
  px(ctx, 19, -6, 2, 8, PAL.creamDim);

  if (active) {
    const p = phase; // 0..1 activation animation
    const pulse = (Math.sin(t * 3) + 1) / 2;
    // glow halo
    ctx.fillStyle = PAL.teal;
    ctx.globalAlpha = (0.15 + pulse * 0.2) * (0.4 + p * 0.6);
    ctx.beginPath();
    ctx.arc(20, 6, 18 + pulse * 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    // signal rings
    for (let i = 0; i < 3; i++) {
      const r = ((t * 22 + i * 14) % 42);
      ctx.strokeStyle = PAL.teal;
      ctx.globalAlpha = Math.max(0, 1 - r / 42) * p;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(20, 6, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // lit windows
    px(ctx, 16, 14, 3, 2, PAL.teal);
    px(ctx, 21, 14, 3, 2, PAL.teal);
    px(ctx, 16, 34, 3, 2, PAL.teal);
    px(ctx, 21, 34, 3, 2, PAL.teal);
    px(ctx, 12, 52, 4, 3, PAL.teal);
    px(ctx, 24, 52, 4, 3, PAL.teal);
  } else {
    // dark windows
    px(ctx, 16, 14, 3, 2, PAL.navy2);
    px(ctx, 21, 14, 3, 2, PAL.navy2);
    px(ctx, 16, 34, 3, 2, PAL.navy2);
    px(ctx, 21, 34, 3, 2, PAL.navy2);
    // weak standby light
    const sb = (Math.sin(t * 1.5) + 1) / 2;
    ctx.fillStyle = PAL.danger;
    ctx.globalAlpha = 0.4 + sb * 0.4;
    px(ctx, 19, -8, 2, 2, PAL.danger);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

export function drawBouncePad(ctx, x, y, t, compress) {
  ctx.save();
  ctx.translate(x, y);
  const h = 6 - compress * 4;
  // base
  px(ctx, 0, 8, 16, 4, PAL.deep);
  px(ctx, 1, 7, 14, 1, PAL.blueSoft);
  // spring
  ctx.fillStyle = PAL.orangeDeep;
  ctx.fillRect(2, 8 - h, 12, h);
  // top plate
  px(ctx, 0, 2 - compress * 2, 16, 3, PAL.orange);
  px(ctx, 1, 1 - compress * 2, 14, 1, PAL.cream);
  // arrow chevrons
  const a = (Math.sin(t * 3) + 1) / 2;
  ctx.fillStyle = PAL.cream;
  ctx.globalAlpha = 0.5 + a * 0.5;
  px(ctx, 7, -2 - compress * 2, 2, 1, PAL.cream);
  px(ctx, 5, 0 - compress * 2, 2, 1, PAL.cream);
  px(ctx, 9, 0 - compress * 2, 2, 1, PAL.cream);
  ctx.globalAlpha = 1;
  ctx.restore();
}

// ============================================================
// Tiles
// ============================================================
export function drawTile(ctx, x, y, size, type, t, seed) {
  const s = size;
  if (type === 'solid') {
    ctx.fillStyle = PAL.blue;
    ctx.fillRect(x, y, s, s);
    ctx.fillStyle = PAL.blueSoft;
    ctx.fillRect(x, y, s, 2);
    ctx.fillStyle = PAL.deep;
    ctx.fillRect(x, y + s - 2, s, 2);
    // pixel detail (deterministic)
    ctx.fillStyle = PAL.deep;
    const d1 = hash2(seed, 1) > 0.5;
    if (d1) ctx.fillRect(x + 4 + (hash2(seed, 2) * 8) | 0, y + 6 + (hash2(seed, 3) * 10) | 0, 2, 2);
    ctx.fillStyle = PAL.blueSoft;
    if (hash2(seed, 4) > 0.4) ctx.fillRect(x + 2 + (hash2(seed, 5) * 10) | 0, y + 12 + (hash2(seed, 6) * 8) | 0, 2, 2);
  } else if (type === 'grass') {
    // top grass tile: soil body + teal grass top
    ctx.fillStyle = PAL.blue;
    ctx.fillRect(x, y, s, s);
    ctx.fillStyle = PAL.tealDark;
    ctx.fillRect(x, y, s, 4);
    ctx.fillStyle = PAL.teal;
    ctx.fillRect(x, y, s, 2);
    // grass blades
    for (let i = 0; i < s; i += 4) {
      const h = 1 + Math.floor(hash2(seed + i, 7) * 3);
      ctx.fillStyle = PAL.teal;
      ctx.fillRect(x + i, y - h, 1, h);
    }
    ctx.fillStyle = PAL.deep;
    ctx.fillRect(x, y + s - 2, s, 2);
  } else if (type === 'cave') {
    ctx.fillStyle = PAL.deep;
    ctx.fillRect(x, y, s, s);
    ctx.fillStyle = PAL.navy2;
    ctx.fillRect(x, y, s, 2);
    ctx.fillStyle = PAL.navy;
    ctx.fillRect(x, y + s - 2, s, 2);
    if (hash2(seed, 8) > 0.45) {
      ctx.fillStyle = PAL.tealDim;
      ctx.fillRect(x + (hash2(seed, 9) * 12) | 0, y + 4 + (hash2(seed, 10) * 8) | 0, 2, 2);
    }
  } else if (type === 'metal') {
    ctx.fillStyle = PAL.blueSoft;
    ctx.fillRect(x, y, s, s);
    ctx.fillStyle = PAL.blueLite;
    ctx.fillRect(x, y, s, 2);
    ctx.fillStyle = PAL.deep;
    ctx.fillRect(x, y + s - 3, s, 3);
    // rivets
    ctx.fillStyle = PAL.deep;
    ctx.fillRect(x + 3, y + 5, 2, 2);
    ctx.fillRect(x + s - 5, y + 5, 2, 2);
    ctx.fillRect(x + 3, y + s - 8, 2, 2);
    ctx.fillRect(x + s - 5, y + s - 8, 2, 2);
    // hazard stripe edge
    ctx.fillStyle = PAL.orange;
    ctx.fillRect(x, y + s - 1, s, 1);
  } else if (type === 'phase') {
    // phase platform: translucent digital block
    ctx.fillStyle = PAL.teal;
    ctx.globalAlpha = 0.28;
    ctx.fillRect(x, y, s, s);
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = PAL.teal;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = PAL.teal;
    ctx.fillRect(x + 2, y + 2, s - 4, 1);
    ctx.fillRect(x + 2, y + s - 3, s - 4, 1);
    ctx.globalAlpha = 1;
  } else if (type === 'falling') {
    // falling platform: cracked stone with warning corners
    ctx.fillStyle = PAL.blue;
    ctx.fillRect(x, y, s, s);
    ctx.fillStyle = PAL.orangeDeep;
    ctx.fillRect(x, y, 3, 3);
    ctx.fillRect(x + s - 3, y + s - 3, 3, 3);
    ctx.fillStyle = PAL.cream;
    ctx.fillRect(x + 1, y + 1, 1, 1);
    ctx.fillRect(x + s - 2, y + s - 2, 1, 1);
    ctx.fillStyle = PAL.deep;
    ctx.fillRect(x + 6, y + 4, 1, s - 8);
    ctx.fillRect(x + 12, y + 6, 1, s - 12);
  }
}

// Decorative background sprites (parallax layers)
export function drawBgTree(ctx, x, y, scale, seed) {
  const c1 = PAL.deep, c2 = PAL.blue;
  ctx.fillStyle = c2;
  ctx.fillRect(x, y, 2 * scale, 10 * scale);
  ctx.fillStyle = c1;
  const w = 8 * scale;
  ctx.beginPath();
  ctx.moveTo(x - w / 2 + scale, y);
  ctx.lineTo(x + scale, y - 9 * scale);
  ctx.lineTo(x + w / 2 + scale, y);
  ctx.closePath();
  ctx.fill();
}

export function drawBgTower(ctx, x, y, w, h) {
  ctx.fillStyle = PAL.navy2;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = PAL.deep;
  for (let i = 0; i < h; i += 8) {
    ctx.fillRect(x, y + i, w, 1);
  }
  // sparse lit windows
  for (let i = 4; i < h - 4; i += 10) {
    if (hash2(x, i) > 0.55) {
      ctx.fillStyle = PAL.tealDim;
      ctx.fillRect(x + w / 2 - 1, y + i, 2, 2);
    }
  }
}
