import { random } from './utils.js';

export const PALETTES = {
  meadow: { sky: '#193a45', far: '#264b52', mid: '#315c60', mist: '#547b72', soil: '#223e43', rock: '#2e4d4c', edge: '#84a78d', top: '#a5ba8f', grass: '#6c997d', accent: '#e6af78', detail: '#54776a' },
  cavern: { sky: '#141f34', far: '#202e46', mid: '#2b3c55', mist: '#425b6b', soil: '#263346', rock: '#34445a', edge: '#628990', top: '#8cb6b3', grass: '#5a969b', accent: '#90c9bd', detail: '#4b6176' },
  tower: { sky: '#282632', far: '#383342', mid: '#4b414d', mist: '#725961', soil: '#343440', rock: '#49424c', edge: '#9c827c', top: '#c7a792', grass: '#8e777c', accent: '#edaa83', detail: '#6b5d64' },
};
const r = (c, color, x, y, w, h) => { c.fillStyle = color; c.fillRect(Math.round(x), Math.round(y), Math.ceil(w), Math.ceil(h)); };
const polygon = (c, color, points) => { c.fillStyle = color; c.beginPath(); c.moveTo(...points[0]); points.slice(1).forEach(p => c.lineTo(...p)); c.closePath(); c.fill(); };

export function drawPip(c, x, y, state, time = 0, facing = 1, scale = 1, squash = 0) {
  c.save(); c.translate(Math.round(x + 11 * scale), Math.round(y + 30 * scale));
  c.scale(facing * scale * (1 + squash * .32), scale * (1 - squash * .34));
  c.translate(-16, -40);
  let bob = state === 'idle' ? (Math.sin(time * 2) > .65 ? -1 : 0) : state === 'run' ? Math.round(Math.abs(Math.sin(time * 15)) * -2) : 0;
  if (state === 'victory') bob = Math.round(Math.sin(time * 5) * 2);
  c.translate(0, bob);
  const px = (color, x, y, w, h) => r(c, color, x * 2, y * 2, w * 2, h * 2);
  const ink = '#17343b', shadow = '#a8b6a1', cream = '#e7e4c7', light = '#fff1d4';
  px(ink, 5, 0, 3, 5); px(shadow, 6, 1, 1, 3); px('#d69168', 5, 0, 3, 2); px('#f5c890', 5, 0, 2, 1);
  px(ink, 2, 6, 3, 10); px('#4f7c78', 2, 7, 3, 8); px('#90b3a0', 2, 8, 1, 4); px('#bca580', 2, 14, 2, 1);
  px(ink, 5, 4, 9, 1); px(ink, 4, 5, 11, 11); px(ink, 5, 16, 9, 2);
  px(cream, 5, 5, 9, 10); px(cream, 6, 15, 7, 2); px(light, 5, 5, 8, 1); px(light, 5, 6, 1, 7); px(shadow, 13, 6, 1, 9); px(shadow, 6, 16, 7, 1);
  px('#326066', 7, 7, 8, 5); px('#153b48', 7, 7, 8, 4); px('#75b29f', 8, 7, 5, 1);
  const blink = state === 'damage' || (state === 'idle' && time % 4 > 3.85);
  px('#c4e3bb', 9, blink ? 10 : 9, 1, blink ? 1 : 2); px('#c4e3bb', 13, blink ? 10 : 9, 1, blink ? 1 : 2);
  px('#c8b48e', 7, 13, 5, 1); px('#638681', 9, 14, 2, 1); px('#e5ac78', 12, 13, 1, 1);
  if (state === 'dash') { px('#f4c78b', 0, 10, 2, 3); px('#dc8968', -2, 11, 2, 1); }
  const swing = state === 'run' ? Math.sin(time * 15) : 0;
  const footA = state === 'jump' || state === 'dash' ? -1 : swing > .2 ? -2 : 0;
  const footB = state === 'fall' ? -1 : swing < -.2 ? -2 : 0;
  px(ink, 5, 17 + footA, 3, 3); px(shadow, 5, 17 + footA, 2, 2); px('#416663', 5, 19 + footA, 4, 1);
  px(ink, 11, 17 + footB, 3, 3); px(shadow, 12, 17 + footB, 2, 2); px('#416663', 11, 19 + footB, 4, 1);
  const arm = state === 'victory' ? 6 : state === 'jump' ? 10 : 13 + Math.round(swing);
  px(ink, 14, arm, 2, 4); px(cream, 14, arm, 1, 3); px(shadow, 15, arm + 2, 1, 1);
  c.restore();
}

export function drawBit(c, x, y, time, core = false) {
  const bob = Math.sin(time * 2.9 + x * .013) * 3, w = core ? 10 : Math.max(2, Math.abs(Math.cos(time * 2.7 + x * .02)) * 5);
  c.save(); c.translate(Math.round(x), Math.round(y + bob));
  c.fillStyle = core ? '#a2d2b912' : '#ffd69412'; c.fillRect(core ? -18 : -11, core ? -18 : -11, core ? 36 : 22, core ? 36 : 22);
  if (core) {
    polygon(c, '#315f61', [[0,-12],[12,0],[0,12],[-12,0]]); polygon(c, '#a4d4b8', [[0,-10],[10,0],[0,10],[-10,0]]);
    polygon(c, '#2d6766', [[0,-7],[7,0],[0,7],[-7,0]]); r(c, '#f1e9c4', -2, -3, 4, 6); r(c, '#c6e3bd', -3, -2, 6, 4);
    const a = time * .9; r(c, '#8fbfa7', Math.sin(a) * 17 - 1, Math.cos(a) * 17 - 1, 2, 2); r(c, '#8fbfa7', -Math.sin(a) * 17 - 1, -Math.cos(a) * 17 - 1, 2, 2);
  } else {
    polygon(c, '#ab775c', [[0,-8],[w+2,-2],[w+2,3],[0,9],[-w-2,3],[-w-2,-2]]);
    polygon(c, '#efbb7b', [[0,-7],[w,-2],[w,3],[0,7],[-w,2],[-w,-2]]);
    r(c, '#ffe3a9', -1, -5, Math.max(2,w-1), 6); r(c, '#d89666', -w, 1, Math.max(2,w), 3);
  }
  c.restore();
}

export function drawTerminal(c, x, y, active, time) {
  r(c, '#132e37', x - 17, y - 4, 34, 4); r(c, '#4e706b', x - 12, y - 8, 24, 5);
  r(c, '#24494e', x - 7, y - 36, 14, 28); r(c, '#698e81', x - 6, y - 36, 3, 25);
  r(c, '#102f39', x - 14, y - 43, 28, 24); r(c, '#739b87', x - 12, y - 41, 24, 20);
  r(c, '#143c45', x - 9, y - 38, 18, 12); r(c, active ? '#b5d8ad' : '#dd9b73', x - 6, y - 35, 12, 6);
  if (active) { r(c, '#376e64', x - 2, y - 36, 3, 8); r(c, '#c9e3ae', x - 1, y - 57, 2, 10); r(c, '#c9e3ae', x - 4, y - 59, 8, 3); c.globalAlpha = .35 + Math.sin(time * 2) * .2; r(c, '#bedfb0', x - 9, y - 67, 18, 2); r(c, '#bedfb0', x - 14, y - 74, 28, 2); c.globalAlpha = 1; }
  else { r(c, '#bb956e', x - 1, y - 51, 2, 8); r(c, '#f0b579', x - 2, y - 53, 4, 3); }
}

export function drawTower(c, x, floor, time, activation = 0, small = false) {
  c.save(); c.translate(Math.round(x), Math.round(floor)); if (small) c.scale(.68, .68);
  r(c, '#142d36', -38, -10, 76, 10); r(c, '#608780', -31, -16, 62, 6); r(c, '#a7b79a', -27, -19, 54, 3);
  r(c, '#1d4047', -21, -110, 42, 91); r(c, '#3e6669', -18, -110, 36, 91); r(c, '#759890', -18, -110, 6, 88); r(c, '#2b5057', 11, -110, 7, 88);
  for (let i = 0; i < 4; i++) { r(c, '#243e48', -12, -36 - i * 20, 23, 13); r(c, activation ? '#a5cfae' : '#ddab7b', -7, -33 - i * 20, 12, 4); r(c, '#577977', -3, -28 - i * 20, 9, 2); }
  r(c, '#aec4a8', -25, -119, 50, 9); r(c, '#365862', -29, -141, 58, 22); r(c, '#8bafa0', -26, -144, 52, 6);
  r(c, '#153a44', -22, -133, 44, 10); for (let i = 0; i < 6; i++) r(c, activation ? '#bbdfb7' : '#bc936d', -18 + i * 7, -131, 4, 6);
  r(c, '#698f87', -5, -180, 10, 36); r(c, '#bed0ae', -5, -180, 3, 34); r(c, '#273f4b', -22, -180, 44, 5);
  r(c, '#668985', -26, -195, 5, 20); r(c, '#a5bba0', -28, -198, 9, 6); r(c, '#668985', 21, -195, 5, 20); r(c, '#a5bba0', 19, -198, 9, 6);
  r(c, '#ca9b71', -3, -202, 6, 21); r(c, activation ? '#e6f1c8' : '#edb77e', -7, -208, 14, 10);
  if (activation) {
    c.globalAlpha = .25; r(c, '#b1e2c4', -8, -750, 16, 544); c.globalAlpha = .45; r(c, '#d5efd0', -2, -750, 4, 544); c.globalAlpha = 1;
    for (let i = 0; i < 4; i++) { const radius = ((time * 50 + i * 52) % 210); c.globalAlpha = (1 - radius / 210) * .6; c.strokeStyle = '#b2d9b9'; c.lineWidth = 2; c.beginPath(); c.arc(0, -202, radius, Math.PI * 1.14, Math.PI * 1.86); c.stroke(); }
    c.globalAlpha = 1;
  } else if (Math.sin(time * 2) > .5) r(c, '#f7cc8b', -4, -206, 8, 4);
  c.restore();
}

function plant(c, x, y, color, size = 1, flower = false) {
  r(c, color, x, y - 10 * size, 2 * size, 10 * size); r(c, color, x - 4 * size, y - 7 * size, 4 * size, 2 * size); r(c, color, x + 2 * size, y - 13 * size, 4 * size, 2 * size);
  r(c, color, x - 6 * size, y - 9 * size, 2 * size, 4 * size); r(c, color, x + 5 * size, y - 15 * size, 2 * size, 4 * size);
  if (flower) { r(c, '#cfa177', x - 2, y - 13 * size, 6, 4); r(c, '#edd1a0', x, y - 15 * size, 2, 4); }
}

export function terrainCanvas(p, palette, seed = 1) {
  const c = document.createElement('canvas'); c.width = p.w + 16; c.height = Math.min(600, p.h) + 42;
  const ctx = c.getContext('2d'), rand = random(seed * 999 + p.w); ctx.translate(8, 30);
  const ground = p.type === 'ground', h = Math.min(600, p.h), P = palette;
  r(ctx, '#112b3555', 3, 5, p.w, h);
  r(ctx, P.soil, 0, 0, p.w, h); r(ctx, P.rock, 2, 6, p.w - 4, ground ? 31 : h - 6);
  r(ctx, P.edge, 0, 0, p.w, 6); r(ctx, P.top, 0, 0, p.w, 2);
  for (let x = 6; x < p.w - 10; x += 16) {
    if (rand() > .45) { r(ctx, P.grass, x, 6, 8, 4); r(ctx, P.edge, x + 2, 6, 4, 8 + Math.floor(rand() * 3) * 2); }
    if (rand() > .6) plant(ctx, x, 0, P.grass, 1, rand() > .8);
  }
  if (ground) {
    for (let y = 32; y < h - 10; y += 26) for (let x = 10; x < p.w - 8; x += 32) if (rand() > .35) {
      const ox = x + Math.floor(rand() * 6) * 2, oy = y + Math.floor(rand() * 6) * 2;
      r(ctx, P.rock, ox, oy, 10 + Math.floor(rand() * 6) * 2, 4); r(ctx, P.rock, ox - 2, oy + 4, 6, 6);
      if (rand() > .7) r(ctx, P.detail, ox + 2, oy, 4, 2);
    }
    for (let x = 22; x < p.w; x += 98) { r(ctx, P.soil, x, 11, 2, 20); r(ctx, P.detail, x + 3, 14, 8, 2); }
    r(ctx, '#142e3644', 0, 105, p.w, h);
  } else { r(ctx, '#19343c', 0, h - 3, p.w, 3); for (let x = 10; x < p.w - 5; x += 25) r(ctx, '#102d3655', x, 8, 10, 5); }
  return c;
}

export function drawEnemy(c, e, time) {
  if (!e.alive && e.death <= 0) return;
  c.save(); c.translate(Math.round(e.x + e.w / 2), Math.round(e.y + e.h));
  if (!e.alive) { c.globalAlpha = e.death / .32; c.scale(1.4, .35); }
  c.scale(e.direction, 1); c.translate(-13, -24);
  const px = (color, x, y, w, h) => r(c, color, x * 2, y * 2, w * 2, h * 2);
  if (e.type === 'drone') {
    px('#18303d', 0, 4, 14, 5); px('#9b8f9d', 2, 2, 10, 7); px('#c4bac0', 3, 2, 8, 2); px('#3e3c53', 4, 4, 8, 3); px('#ef9d8e', 7, 4, 3, 2);
    px('#96849a', 3, 9, 2, 2); px('#96849a', 10, 9, 2, 2); px('#ecb09d', 6, 9, 3, 1); px('#655c77', 6, 0, 2, 2);
    px('#b4b1b8', -2, Math.sin(time * 22) > 0 ? 3 : 5, 5, 1); px('#b4b1b8', 11, Math.sin(time * 22) > 0 ? 5 : 3, 5, 1);
  } else if (e.type === 'bug') {
    px('#263140', 1, 5, 11, 6); px(e.charging ? '#dd8e76' : '#af8176', 2, 4, 9, 6); px('#d7a58c', 3, 4, 7, 2); px('#553f4c', 7, 6, 5, 3); px('#f2cf9e', 9, 6, 2, 1);
    for (let i = 0; i < 3; i++) { px('#8d7f84', 2 + i * 4, 10, 2, Math.sin(time * 20 + i * 2) > 0 ? 2 : 1); }
    px('#d7a58c', 12, 5, 1, 3); px('#ab756d', 0, 3, 1, 5); if (e.cycle % 2.9 > 1.7 && !e.charging) px('#f2c397', 6, -3, 1, 3);
  } else {
    const bob = Math.sin(time * 8 + e.id) > .4 ? -1 : 0; c.translate(0, bob * 2);
    px('#203d43', 1, 3, 11, 8); px('#bd856b', 2, 3, 9, 7); px('#e6ac81', 3, 2, 7, 2); px('#dba278', 2, 4, 3, 4); px('#724f50', 3, 8, 8, 2);
    px('#233b43', 6, 5, 6, 3); px('#e8c895', 7, 5, 1, 2); px('#e8c895', 10, 5, 1, 2);
    px('#57716b', 2, 10, 3, 2); px('#57716b', 8, 10, 3, 2); px('#a98c75', 3, 0, 1, 2); px('#a98c75', 9, 0, 1, 2);
  }
  c.restore();
}

function buildBackground(theme, layer) {
  const canvas = document.createElement('canvas'); canvas.width = 1920; canvas.height = 680;
  const c = canvas.getContext('2d'), P = PALETTES[theme], rand = random(456 + layer * 421 + (theme === 'tower' ? 250 : theme === 'cavern' ? 500 : 0));
  if (layer === 0) {
    if (theme === 'meadow') {
      for (let n = 0; n < 10; n++) { const x = n * 213, y = 210 + rand() * 100; polygon(c, P.far, [[x-100,540],[x-100,y+110],[x-50,y+110],[x-50,y+75],[x,y+75],[x,y+28],[x+45,y+28],[x+45,y],[x+100,y],[x+100,y+35],[x+160,y+35],[x+160,y+95],[x+240,y+95],[x+240,540]]); }
    } else if (theme === 'cavern') {
      for (let i = 0; i < 25; i++) { const x = i * 80, length = 70 + rand() * 220; polygon(c, P.far, [[x,0],[x+70,0],[x+70,length*.5],[x+50,length*.5],[x+50,length],[x+34,length],[x+34,length*.72],[x+20,length*.72],[x+20,length*.3],[x,length*.3]]); }
      for (let i = 0; i < 20; i++) r(c, P.far, i * 100, 440 - rand() * 160, 68, 340);
    } else {
      for (let i = 0; i < 20; i++) { const x = i * 105, y = 150 + rand() * 200; r(c, P.far, x, y, 60, 550); r(c, P.far, x + 17, y - 70, 25, 70); r(c, P.far, x + 28, y - 120, 3, 50); for (let yy = y + 30; yy < 500; yy += 27) r(c, P.mid, x + 8, yy, 6, 3); }
    }
  } else {
    for (let i = 0; i < 12; i++) {
      const x = i * 177 + rand() * 40, y = 295 + rand() * 155, w = 35 + rand() * 70;
      r(c, P.mid, x, y, w, 390); r(c, P.mid, x + 6, y - 10, w - 12, 10); r(c, P.mist + '40', x + 6, y + 2, 5, 190);
      if (theme === 'meadow') { r(c, P.mist, x - 10, y + 50, w + 20, 4); r(c, P.mid, x + w - 8, y - 80, 4, 70); for (let j = 0; j < 4; j++) plant(c, x + j * 20, y, P.mist, 1.5); }
      if (theme === 'cavern') { r(c, '#538186', x + 8, y + 9, 3, 15); r(c, '#4a687b', x + 4, y + 13, 11, 4); }
      if (theme === 'tower') { r(c, '#9c776d55', x + 8, y + 15, 3, 3); r(c, '#9c776d55', x + 8, y + 34, 3, 3); }
      r(c, P.sky, x + 15, y + 45, Math.max(8, w - 30), 32);
    }
    c.strokeStyle = P.mid; c.lineWidth = 3;
    for (let i = 0; i < 7; i++) { c.beginPath(); c.moveTo(i * 280, 360); c.quadraticCurveTo(i * 280 + 170, 460, i * 280 + 320, 285); c.stroke(); }
  }
  return canvas;
}

export class Renderer {
  constructor(canvas, settings) {
    this.canvas = canvas; this.c = canvas.getContext('2d', { alpha: false }); this.c.imageSmoothingEnabled = false;
    this.settings = settings; this.backgrounds = {}; this.terrain = new Map();
    for (const theme of ['meadow','cavern','tower']) this.backgrounds[theme] = [buildBackground(theme, 0), buildBackground(theme, 1)];
    this.menuGround = [
      { x: 412, y: 418, w: 275, h: 220, type: 'ground' }, { x: 739, y: 468, w: 250, h: 190, type: 'ground' },
      { x: 742, y: 334, w: 154, h: 30, type: 'static' }, { x: 550, y: 282, w: 86, h: 18, type: 'static' },
    ];
    this.menuGround.forEach((p, i) => p.art = terrainCanvas(p, PALETTES.meadow, i + 9));
  }
  setLevel(level) { this.terrain.clear(); for (const p of level.platforms) if (p.type === 'ground' || p.type === 'static') this.terrain.set(p.id, terrainCanvas(p, PALETTES[level.theme], p.id + level.index * 500)); }
  sky(theme, camera, time, menu = false) {
    const c = this.c, P = PALETTES[theme]; r(c, P.sky, 0, 0, 960, 540);
    const rand = random(789);
    for (let i = 0; i < 55; i++) { const x = ((rand() * 1150 - camera.x * .06) % 1050 + 1050) % 1050, y = rand() * 370; c.globalAlpha = .15 + rand() * .22; r(c, '#d2d8b7', x, y, i % 8 === 0 ? 2 : 1, i % 8 === 0 ? 2 : 1); }
    c.globalAlpha = 1;
    if (theme !== 'cavern') {
      const sx = menu ? 745 : 790 - camera.x * .035, sy = menu ? 142 : 124 - camera.y * .06;
      const color = theme === 'meadow' ? '#dbad81' : '#bf8b80';
      for (let yy = -56; yy < 56; yy += 4) { const half = Math.floor(Math.sqrt(56 * 56 - yy * yy) / 4) * 4; r(c, color, sx - half, sy + yy, half * 2, 4); }
      r(c, P.sky, sx - 56, sy + 14, 112, 4); r(c, P.sky, sx - 50, sy + 32, 100, 4); r(c, P.sky, sx - 40, sy + 46, 80, 4);
      for (let i = 0; i < 6; i++) { const x = (i * 226 + 100 - camera.x * .08 + time * (this.settings.reduced ? 0 : 1.2)) % 1200 - 80; r(c, P.mist + '22', x, 85 + i * 29, 170 - i * 11, 4); r(c, P.mist + '15', x + 28, 91 + i * 29, 92, 3); }
    }
    this.backgrounds[theme].forEach((bg, i) => { const offset = ((camera.x * (i ? .28 : .13)) % 1920 + 1920) % 1920; const y = -camera.y * (i ? .3 : .15); c.drawImage(bg, Math.round(-offset), Math.round(y)); c.drawImage(bg, Math.round(1920 - offset), Math.round(y)); });
    r(c, P.mist + '15', 0, 375 - camera.y * .3, 960, 85); r(c, P.sky + '33', 0, 445, 960, 95);
    for (let i = 0; i < 18; i++) { const t = this.settings.reduced ? 0 : time; const x = (i * 137 + Math.sin(t * .13 + i) * 25 - camera.x * .42 + 10000) % 1080; const y = 190 + ((i * 47) % 295) + Math.sin(t * .4 + i) * 9; c.globalAlpha = .17 + Math.sin(t + i) * .1; r(c, P.accent, x, y, 2, 2); }
    c.globalAlpha = 1;
  }
  menu(time) {
    const c = this.c; this.sky('meadow', {x: 360, y: 0}, time, true);
    // Broken skyway and an ivy-covered relay give the title scene its own silhouette.
    r(c, '#436762', 678, 279, 24, 217); r(c, '#688b75', 678, 279, 4, 207); r(c, '#2b4f54', 680, 302, 22, 7);
    r(c, '#537b6b', 703, 259, 78, 9); r(c, '#8ba285', 703, 257, 78, 3); r(c, '#31565a', 766, 265, 16, 189);
    for (let i = 0; i < 7; i++) { r(c, '#6f967b', 697 + i * 10, 260, 2, 12 + i % 3 * 7); }
    for (const p of this.menuGround) c.drawImage(p.art, p.x - 8, p.y - 30);
    drawTower(c, 827, 333, time, 0, true);
    // An old route marker, flowers and a cable anchor frame PIP's departure.
    r(c, '#24434a', 484, 380, 6, 37); r(c, '#779c84', 477, 374, 28, 17); r(c, '#b6c1a1', 479, 376, 24, 12); r(c, '#3b605c', 483, 380, 14, 3); r(c, '#3b605c', 494, 378, 3, 7);
    plant(c, 548, 418, '#88a37f', 2); plant(c, 573, 418, '#aac18e', 1.4, true); plant(c, 662, 418, '#6f977a', 2.2);
    r(c, '#122c3844', 603, 416, 63, 5); drawPip(c, 616, 352, 'idle', time, 1, 2.2);
    drawBit(c, 716, 359, time); drawBit(c, 745, 377, time + .7); drawBit(c, 772, 385, time + 1.3);
    c.globalAlpha = .45; r(c, '#142d35', 375, 518, 600, 22); c.globalAlpha = 1;
    // A few foreground leaves extend past the frame, without hiding the jump route.
    plant(c, 924, 548, '#16343c', 6); plant(c, 397, 540, '#17363d', 4);
  }
  drawPlatform(p, time, theme) {
    const c = this.c, P = PALETTES[theme];
    if (p.type === 'ground' || p.type === 'static') { c.drawImage(this.terrain.get(p.id), Math.round(p.x - 8), Math.round(p.y - 30)); return; }
    const x = Math.round(p.x), y = Math.round(p.y);
    if (p.type === 'phase') {
      c.globalAlpha = p.active ? (p.cycle > .62 ? .5 + Math.sin(time * 24) * .3 : 1) : .17;
      r(c, '#3e696c', x, y, p.w, 16); r(c, '#add0b4', x, y, p.w, 3); r(c, '#7da99d', x, y + 13, p.w, 3);
      for (let i = 8; i < p.w - 8; i += 15) { r(c, '#95beab', x + i, y + 6, 7, 3); }
      c.globalAlpha = 1;
      // Clock ticks stay visible even while the collision surface is absent.
      for (let i = 0; i < 5; i++) r(c, i / 5 < (1 - (p.cycle || 0)) ? '#b8c8ac' : '#345654', x + p.w / 2 - 14 + i * 6, p.baseY + 23, 4, 2);
    } else if (p.type === 'bounce') {
      r(c, '#254750', x, y, p.w, 16); for (let i = 0; i < 4; i++) r(c, '#a78f76', x + 5 + i * 10, y + 5, 5, 7);
      r(c, '#e4b786', x - 3, y - 4, p.w + 6, 6); r(c, '#f4d09c', x + 1, y - 4, p.w - 2, 2);
      polygon(c, '#f2ce91', [[x+18,y-13],[x+23,y-18],[x+28,y-13],[x+25,y-13],[x+23,y-15],[x+21,y-13]]);
    } else {
      const shake = p.type === 'falling' && p.timer > 0 && p.timer < .6 && !this.settings.reduced ? Math.sin(time * 80) * 2 : 0;
      r(c, '#152f3b', x + shake, y + 3, p.w, 15); r(c, p.type === 'falling' ? '#a1816f' : '#4f7a7a', x + shake, y, p.w, 13);
      r(c, p.type === 'falling' ? '#e1b187' : '#b1c5a5', x + shake, y, p.w, 3);
      for (let i = 6; i < p.w - 8; i += 14) r(c, '#2b474e', x + i + shake, y + 6, 8, 4);
      if (p.type === 'falling') { r(c, '#38434b', x + 32, y, 3, 8); r(c, '#38434b', x + 35, y + 7, 5, 2); }
      if (p.type === 'moving') { r(c, '#95c3ac', x + p.w / 2 - 6, y + 16, 12, 3); c.globalAlpha = .18; r(c, '#acd2b5', x + p.w / 2 - 3, y + 20, 6, 7); c.globalAlpha = 1; }
    }
  }
  game(game) {
    const c = this.c, { level, camera, player, time, particles } = game;
    this.sky(level.theme, camera, time);
    c.save();
    const shake = this.settings.shake && !this.settings.reduced ? camera.shake : 0;
    c.translate(-Math.round(camera.x) + Math.round((Math.random() - .5) * shake), -Math.round(camera.y) + Math.round((Math.random() - .5) * shake));
    // Low, animated static marks gaps as dangerous before the player reaches one.
    for (let x = Math.floor(camera.x / 32) * 32; x < camera.x + 990; x += 32) { r(c, '#ac797766', x, 590 + Math.sin(x + time * 2) * 3, 20, 3); r(c, '#e4a28c77', x + 8, 605, 3, 7); }
    for (const s of level.secrets) {
      if (s.x + s.w < camera.x || s.x > camera.x + 960) continue;
      r(c, '#0c233166', s.x + 6, s.y + 4, s.w - 12, s.h - 5);
      r(c, '#62887544', s.x, s.y, s.w, 4); r(c, '#62887544', s.x, s.y, 4, s.h);
      for (let i = 0; i < 5; i++) { r(c, '#83a68a66', s.x + 7 + i * 29, s.y + 4, 2, 15 + i % 3 * 8); }
      c.globalAlpha = s.revealed ? .65 : .22;
      c.fillStyle = '#b5c4a4'; c.font = '8px monospace'; c.fillText('⌁  ARCHIVE', s.x + 13, s.y + 21); c.globalAlpha = 1;
      if (!s.revealed) { const pulse = Math.sin(time * 2) * .2 + .4; c.globalAlpha = pulse; r(c, '#d8b780', s.x - 8, s.y + s.h - 18, 3, 3); r(c, '#d8b780', s.x - 14, s.y + s.h - 24, 2, 2); c.globalAlpha = 1; }
    }
    for (const p of level.platforms) if (p.x + p.w > camera.x - 20 && p.x < camera.x + 980) this.drawPlatform(p, time, level.theme);
    for (const sign of level.signs) {
      if (sign.x < camera.x - 170 || sign.x > camera.x + 960) continue;
      const w = sign.text.length * 4.5 + 16;
      r(c, '#25474b', sign.x + w / 2 - 2, sign.y - 31, 4, 29); r(c, '#436a64', sign.x, sign.y - 50, w, 21); r(c, '#829b81', sign.x, sign.y - 50, w, 2);
      c.font = '8px monospace'; c.fillStyle = '#d1d6b7'; c.fillText(sign.text, Math.round(sign.x + 8), sign.y - 36);
    }
    for (const h of level.hazards) {
      if (h.x < camera.x - 80 || h.x > camera.x + 980) continue;
      if (h.type === 'spikes') {
        for (let x = h.x; x < h.x + h.w; x += 12) { polygon(c, '#b77770', [[x,h.y+12],[x+5,h.y],[x+7,h.y],[x+12,h.y+12]]); polygon(c, '#ecc0a1', [[x+3,h.y+8],[x+5,h.y],[x+7,h.y],[x+7,h.y+8]]); }
        r(c, '#785655', h.x, h.y + 10, h.w, 3);
      } else {
        const x = h.x + (h.offset || 0);
        r(c, '#423d4c', h.x - 21, h.y - 9, 53, 5); r(c, '#ad9a94', x - 5, h.y - 7, 20, 7); r(c, '#ad9a94', x - 5, h.y + h.h, 20, 7);
        if (h.active) { r(c, '#e59b8530', x - 5, h.y, 20, h.h); r(c, '#d48e81', x + 2, h.y, 6, h.h); r(c, '#ffe1b4', x + 4, h.y, 2, h.h); }
        else { for (let y = h.y; y < h.y + h.h; y += 8) r(c, h.warning ? '#e8ad8f' : '#90707866', x + 4, y, 2, 3); }
      }
    }
    for (const b of level.bits) if (!b.collected && b.x > camera.x - 20 && b.x < camera.x + 980) drawBit(c, b.x, b.y, this.settings.reduced ? 0 : time);
    for (const b of level.cores) if (!b.collected && b.x > camera.x - 30 && b.x < camera.x + 990) drawBit(c, b.x, b.y, this.settings.reduced ? 0 : time, true);
    for (const cp of level.checkpoints) drawTerminal(c, cp.x, cp.y, cp.active, time);
    drawTower(c, level.tower.x, level.tower.y + 30, time, game.state === 'celebrating' || game.state === 'complete');
    for (const e of level.enemies) if (e.x > camera.x - 35 && e.x < camera.x + 990) drawEnemy(c, e, time);
    if (player.dash && !this.settings.reduced) for (let i = 1; i < 5; i++) { c.globalAlpha = .18 - i * .03; drawPip(c, player.x - player.facing * i * 17, player.y, 'dash', time, player.facing); }
    c.globalAlpha = 1;
    if (!player.dead && !(player.invulnerable > 0 && Math.floor(time * 15) % 2)) drawPip(c, player.x, player.y, game.state === 'celebrating' || game.state === 'complete' ? 'victory' : player.state, player.state === 'run' ? player.run / 8 : time, player.facing, 1, this.settings.reduced ? 0 : player.squash);
    particles.draw(c);
    if (game.state === 'celebrating' && !this.settings.reduced) {
      const radius = game.celebration * 320; c.globalAlpha = Math.max(0, 1 - game.celebration / 2.6) * .4; c.strokeStyle = '#c8e3b9'; c.lineWidth = 3; c.beginPath(); c.arc(level.tower.x, level.tower.y - 176, radius, 0, Math.PI * 2); c.stroke(); c.globalAlpha = 1;
    }
    c.restore();
    if (game.intro > 0) { c.globalAlpha = Math.min(1, game.intro, (3.5 - game.intro) * 2); c.fillStyle = '#dce2c6'; c.font = '11px monospace'; c.textAlign = 'center'; c.fillText(level.description.toUpperCase(), 480, 123); c.textAlign = 'left'; c.globalAlpha = 1; }
  }
  thumbnail(canvas, theme, index) {
    const c = canvas.getContext('2d'); c.imageSmoothingEnabled = false;
    const P = PALETTES[theme]; r(c, P.sky, 0, 0, 240, 120);
    c.drawImage(this.backgrounds[theme][0], 180 + index * 140, 150, 600, 340, 0, 0, 240, 120);
    c.drawImage(this.backgrounds[theme][1], 300, 270, 500, 250, 0, 20, 240, 100);
    if (theme !== 'cavern') { r(c, P.accent, 161, 17, 24, 32); r(c, P.accent, 157, 21, 32, 24); }
    const p = { w: 111, h: 50, type: 'ground' }; c.drawImage(terrainCanvas(p, P, index + 40), 130, 58);
    c.save(); c.translate(194, 90); c.scale(.27,.27); drawTower(c, 0, 0, 0, 0); c.restore();
    const p2 = { w: 105, h: 35, type: 'ground' }; c.drawImage(terrainCanvas(p2, P, index + 42), -8, 71);
    drawPip(c, 66, 80, 'idle', 0, 1, .65);
    drawBit(c, 113, 82, 0); drawBit(c, 130, 66, .4);
  }
}

const GLYPHS = {
  P:['11110','11011','11011','11110','11000','11000','11000'], I:['11111','00110','00110','00110','00110','00110','11111'], X:['11011','11011','01110','00100','01110','11011','11011'], E:['11111','11000','11000','11110','11000','11000','11111'], L:['11000','11000','11000','11000','11000','11000','11111'], B:['11110','11011','11011','11110','11011','11011','11110'], O:['01110','11011','11011','11011','11011','11011','01110'], U:['11011','11011','11011','11011','11011','11011','01110'], N:['11001','11101','11101','11011','11011','11011','11001'], D:['11110','11011','11011','11011','11011','11011','11110'],
};
export function titleSVG() {
  let path = '';
  [...'PIXELBOUND'].forEach((letter, index) => GLYPHS[letter].forEach((row, y) => [...row].forEach((v, x) => { if (v === '1') path += `M${index * 6 + x},${y}h1v1h-1z`; })));
  return `<svg class="pixel-title" viewBox="0 0 59 7" role="img" aria-label="PIXELBOUND" shape-rendering="crispEdges"><path fill="#f0ead5" d="${path}"/></svg>`;
}
