// ui.js — all on-canvas interfaces: HUD, main menu, level select, pause,
// settings, game over, level complete, and transient toasts.
//
// Why canvas and not DOM: it keeps the pixel aesthetic consistent, avoids
// layout reflows, and guarantees menus scale with the same integer pixel grid
// as the game. Keyboard navigation, focus states and hover/pointer selection
// are all implemented here.

import { Save } from './save.js';
import { formatTime, clamp, lerp, damp } from './math.js';
import { LEVELS } from './levels.js';

export const UI_FONT = '10px "Courier New", ui-monospace, monospace';

// ────────────────────────────────────────────────────────────────────────────
//  Shared drawing primitives
// ────────────────────────────────────────────────────────────────────────────

export function drawPanel(ctx, x, y, w, h, opts = {}) {
  const { fill = 'rgba(8,13,25,0.92)', border = '#2f4a7a', accent = '#3fb8a8', accentPos = 'top' } = opts;
  ctx.fillStyle = 'rgba(4,7,14,0.55)';
  ctx.fillRect(x + 2, y + 2, w, h);
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = border;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.fillStyle = accent;
  if (accentPos === 'top') ctx.fillRect(x + 1, y + 1, w - 2, 1);
  else if (accentPos === 'left') ctx.fillRect(x + 1, y + 1, 1, h - 2);
  // corner ticks
  ctx.fillStyle = border;
  ctx.fillRect(x, y, 3, 1); ctx.fillRect(x, y, 1, 3);
  ctx.fillRect(x + w - 3, y, 3, 1); ctx.fillRect(x + w - 1, y, 1, 3);
  ctx.fillRect(x, y + h - 1, 3, 1); ctx.fillRect(x, y + h - 3, 1, 3);
  ctx.fillRect(x + w - 3, y + h - 1, 3, 1); ctx.fillRect(x + w - 1, y + h - 3, 1, 3);
}

/** Rounded-ish pixel button with keyboard focus + hover states. */
export function drawButton(ctx, label, x, y, w, h, { focused, hovered, enabled = true, danger = false, sub = null } = {}) {
  const base = danger ? '#3a1b26' : '#132038';
  const border = danger ? '#a8465a' : '#2f4a7a';
  const accent = danger ? '#e2564e' : '#3fb8a8';
  const alpha = enabled ? 1 : 0.4;

  ctx.globalAlpha = alpha;
  ctx.fillStyle = base;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = border;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

  if (focused || hovered) {
    ctx.fillStyle = accent;
    ctx.globalAlpha = alpha * (focused ? 1 : 0.5);
    // animated selection bar on the left
    ctx.fillRect(x, y, 2, h);
    // subtle top sheen
    ctx.globalAlpha = alpha * 0.12;
    ctx.fillStyle = accent;
    ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
  }

  ctx.globalAlpha = alpha;
  ctx.fillStyle = enabled ? (focused || hovered ? '#f2e7cf' : '#bdb095') : '#5d6a80';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 10px "Courier New", ui-monospace, monospace';
  const ty = sub ? y + h / 2 - 4 : y + h / 2;
  ctx.fillText(label, x + w / 2, ty);
  if (sub) {
    ctx.font = '8px "Courier New", ui-monospace, monospace';
    ctx.fillStyle = 'rgba(157,245,230,0.75)';
    ctx.fillText(sub, x + w / 2, y + h / 2 + 6);
  }
  ctx.globalAlpha = 1;
}

/** Horizontal slider with grab handle. */
export function drawSlider(ctx, x, y, w, value, { focused } = {}) {
  const h = 6;
  ctx.fillStyle = '#0f1930';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#2f4a7a';
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.fillStyle = '#3fb8a8';
  ctx.fillRect(x + 1, y + 1, Math.round((w - 2) * clamp(value, 0, 1)), h - 2);
  const hx = x + Math.round((w - 2) * clamp(value, 0, 1));
  ctx.fillStyle = focused ? '#f2e7cf' : '#9df5e6';
  ctx.fillRect(hx - 1, y - 3, 3, h + 6);
  ctx.fillStyle = '#0c1424';
  ctx.fillRect(hx - 1, y - 1, 1, 2);
}

export function drawCheckbox(ctx, x, y, on, { focused } = {}) {
  const s = 8;
  ctx.fillStyle = '#0f1930';
  ctx.fillRect(x, y, s, s);
  ctx.strokeStyle = focused ? '#f2e7cf' : '#2f4a7a';
  ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
  if (on) {
    ctx.fillStyle = '#3fb8a8';
    ctx.fillRect(x + 2, y + 2, s - 4, s - 4);
    ctx.fillStyle = '#eafff9';
    ctx.fillRect(x + 3, y + 3, 2, 2);
  }
}

// ────────────────────────────────────────────────────────────────────────────
//  Menu base: focus index, keyboard + pointer navigation.
// ────────────────────────────────────────────────────────────────────────────

export class MenuItem {
  constructor({ id, label, sub = null, type = 'button', value = 0, min = 0, max = 1, step = 0.05, disabled = false, danger = false, x, y, w, h, data = null }) {
    Object.assign(this, { id, label, sub, type, value, min, max, step, disabled, danger, x, y, w, h, data });
    this.hovered = false;
    this.hoverT = 0;
  }
}

export class Menu {
  constructor(items, { columns = 1 } = {}) {
    this.items = items;
    this.index = 0;
    this.columns = columns;
    this._ensureValid(1);
  }
  get current() { return this.items[this.index]; }
  _ensureValid(dir) {
    let i = this.index;
    let guard = 0;
    while (this.items[i]?.disabled && guard++ < this.items.length) {
      i = (i + dir + this.items.length) % this.items.length;
    }
    this.index = i;
  }
  move(dir) {
    // Simple linear navigation (columns handled by the caller layout).
    const n = this.items.length;
    let i = this.index;
    for (let k = 0; k < n; k++) {
      i = (i + dir + n) % n;
      if (!this.items[i].disabled) { this.index = i; return true; }
    }
    return false;
  }
  activate() {
    const it = this.current;
    if (!it || it.disabled) return null;
    return it;
  }
  /** Slider adjust with left/right. */
  adjust(dir) {
    const it = this.current;
    if (!it || it.disabled) return false;
    if (it.type === 'slider') {
      it.value = clamp(it.value + dir * it.step, it.min, it.max);
      return true;
    }
    if (it.type === 'checkbox') {
      it.value = it.value ? 0 : 1;
      return true;
    }
    return false;
  }
  hitTest(mx, my) {
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      it.hovered = mx >= it.x && mx <= it.x + it.w && my >= it.y && my <= it.y + it.h;
      if (it.hovered && !it.disabled) return i;
    }
    return -1;
  }
}

// ────────────────────────────────────────────────────────────────────────────
//  HUD
// ────────────────────────────────────────────────────────────────────────────

export class HUD {
  constructor() {
    this.bitDisplay = 0;      // animated counter
    this.bitFlash = 0;
    this.coreFlash = 0;
    this.hpShake = 0;
    this.lastBits = 0;
    this.lastCores = 0;
    this.lastHp = 3;
    this.dashPulse = 0;
    this.timeDisplay = 0;
  }

  update(dt, lm, player) {
    const target = lm.runStats.bits;
    const prev = this.bitDisplay;
    this.bitDisplay = damp(this.bitDisplay, target, 14, dt);
    if (Math.abs(this.bitDisplay - target) < 0.02) this.bitDisplay = target;
    if (target !== this.lastBits) { this.bitFlash = 0.28; this.lastBits = target; }
    if (lm.runStats.cores !== this.lastCores) { this.coreFlash = 0.5; this.lastCores = lm.runStats.cores; }
    if (player.hp !== this.lastHp) {
      if (player.hp < this.lastHp) this.hpShake = 0.4;
      this.lastHp = player.hp;
    }
    this.bitFlash = Math.max(0, this.bitFlash - dt);
    this.coreFlash = Math.max(0, this.coreFlash - dt);
    this.hpShake = Math.max(0, this.hpShake - dt);
    this.dashPulse = player.dashCd > 0 ? this.dashPulse : 0;
    if (prev > target) this.bitDisplay = target;
    this.timeDisplay = lm.runStats.time;
  }

  draw(ctx, vw, vh, lm, player, atlas) {
    const s = atlas.s;
    // ---- Top-left: health cells ----
    const px = 8, py = 8;
    const shakeX = this.hpShake > 0 ? Math.round(Math.sin(this.hpShake * 60) * 2 * this.hpShake * 2.5) : 0;
    ctx.save();
    ctx.translate(shakeX, 0);
    // panel-less: draw cells directly with a dark backing for readability
    ctx.fillStyle = 'rgba(7,11,22,0.55)';
    ctx.fillRect(px - 3, py - 3, 22 * 3 + 6, 14);
    for (let i = 0; i < 3; i++) {
      this._cell(ctx, px + i * 22, py, i < player.hp, i === player.hp - 1);
    }
    ctx.restore();

    // ---- Top-left (second row): signal bits ----
    const by = py + 20;
    ctx.fillStyle = 'rgba(7,11,22,0.55)';
    ctx.fillRect(px - 3, by - 2, 108, 13);
    // bit icon
    const bitImg = atlas.bit[0];
    ctx.drawImage(bitImg, px - 1, by, 8 * s, 8 * s);
    ctx.font = '9px "Courier New", ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#0c1424';
    ctx.fillRect(px + 12, by + 1, 60, 6);
    const barW = 60;
    const frac = lm.runStats.totalBits ? clamp(this.bitDisplay / lm.runStats.totalBits, 0, 1) : 0;
    ctx.fillStyle = '#2f4a7a';
    ctx.fillRect(px + 12, by + 1, barW, 6);
    ctx.fillStyle = this.bitFlash > 0 ? '#ffffff' : '#3fb8a8';
    ctx.fillRect(px + 12, by + 1, Math.round(barW * frac), 6);
    const cnt = `${Math.round(this.bitDisplay)}/${lm.runStats.totalBits}`;
    ctx.fillStyle = this.bitFlash > 0 ? '#f2e7cf' : '#bdb095';
    ctx.fillText(cnt, px + 12, by + 11 + 2);

    // ---- Top-left (third row): data cores ----
    const cy = by + 17;
    ctx.fillStyle = 'rgba(7,11,22,0.55)';
    ctx.fillRect(px - 3, cy - 2, 50, 13);
    const coreImg = atlas.core[0];
    ctx.drawImage(coreImg, px - 1, cy - 1, coreImg.width * 0.8, coreImg.height * 0.8);
    ctx.fillStyle = this.coreFlash > 0 ? '#ffffff' : '#f79a45';
    ctx.fillText(`${lm.runStats.cores}/${lm.runStats.totalCores}`, px + 12, cy + 5);

    // ---- Bottom-left: dash cooldown ----
    const dx = 8, dy = vh - 16;
    const dashReady = player.dashCd <= 0;
    ctx.fillStyle = 'rgba(7,11,22,0.55)';
    ctx.fillRect(dx - 3, dy - 3, 62, 15);
    // label
    ctx.font = '7px "Courier New", ui-monospace, monospace';
    ctx.fillStyle = dashReady ? '#f79a45' : '#5d6a80';
    ctx.fillText('DASH', dx, dy + 4);
    // meter
    const mw = 34;
    const mx = dx + 20, my = dy + 1;
    ctx.fillStyle = '#0c1424';
    ctx.fillRect(mx, my, mw, 6);
    const ready = clamp(1 - player.dashCd / 0.48, 0, 1);
    ctx.fillStyle = dashReady ? '#f79a45' : '#5d6a80';
    ctx.fillRect(mx, my, Math.round(mw * ready), 6);
    if (dashReady) {
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 180);
      ctx.globalAlpha = 0.35 + pulse * 0.35;
      ctx.fillStyle = '#ffe6c0';
      ctx.fillRect(mx, my, mw, 2);
      ctx.globalAlpha = 1;
    }

    // ---- Bottom-left: signal integrity pips (spare respawns) ----
    const iy = dy - 16;
    ctx.fillStyle = 'rgba(7,11,22,0.55)';
    ctx.fillRect(dx - 3, iy - 3, 62, 13);
    ctx.font = '7px "Courier New", ui-monospace, monospace';
    ctx.fillStyle = lm.integrity <= 1 ? '#e2564e' : '#bdb095';
    ctx.fillText('SIG', dx, iy + 4);
    const n = lm.maxIntegrity;
    const pipW = 5, pipGap = 2;
    for (let i = 0; i < n; i++) {
      const on = i < lm.integrity;
      const x = dx + 20 + i * (pipW + pipGap);
      const lowPulse = on && lm.integrity <= 1 ? 0.45 + 0.55 * Math.abs(Math.sin(performance.now() / 240)) : 1;
      ctx.fillStyle = on ? `rgba(226,86,78,${lowPulse})` : 'rgba(47,74,122,0.5)';
      ctx.fillRect(x, iy + 1, pipW, 6);
      if (on) {
        ctx.fillStyle = 'rgba(255,200,180,0.75)';
        ctx.fillRect(x, iy + 1, pipW, 2);
      }
    }

    // ---- Top-right: timer ----
    ctx.textAlign = 'right';
    ctx.font = '9px "Courier New", ui-monospace, monospace';
    ctx.fillStyle = 'rgba(7,11,22,0.55)';
    ctx.fillRect(vw - 60, py - 3, 54, 13);
    ctx.fillStyle = '#bdb095';
    ctx.fillText(formatTime(this.timeDisplay), vw - 10, py + 3);

    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
  }

  _cell(ctx, x, y, filled, newest) {
    const w = 18, h = 11;
    ctx.fillStyle = '#0c1424';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = filled ? '#3fb8a8' : '#2f4a7a';
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    if (filled) {
      const pulse = newest ? 0.7 + 0.3 * Math.sin(performance.now() / 260) : 1;
      ctx.fillStyle = `rgba(63,184,168,${pulse})`;
      ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
      ctx.fillStyle = 'rgba(200,255,245,0.85)';
      ctx.fillRect(x + 2, y + 2, w - 4, 2);
      // cell notch detail
      ctx.fillStyle = '#0c1424';
      ctx.fillRect(x + 2, y + 5, 3, 1);
      ctx.fillRect(x + w - 6, y + 5, 4, 1);
    } else {
      ctx.fillStyle = 'rgba(47,74,122,0.35)';
      ctx.fillRect(x + 3, y + 4, w - 6, h - 8);
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────
//  Toast messages (checkpoint reached, secret found, etc.)
// ────────────────────────────────────────────────────────────────────────────

export class Toasts {
  constructor() { this.items = []; }
  push(text, { color = '#9df5e6', life = 2.0, icon = null } = {}) {
    this.items.push({ text, color, life, maxLife: life, icon });
    if (this.items.length > 4) this.items.shift();
  }
  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      this.items[i].life -= dt;
      if (this.items[i].life <= 0) this.items.splice(i, 1);
    }
  }
  draw(ctx, vw, vh) {
    ctx.font = '8px "Courier New", ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let y = vh * 0.22;
    for (const it of this.items) {
      const t = it.life / it.maxLife;
      const a = t > 0.8 ? (1 - t) / 0.2 : Math.min(1, t / 0.35);
      const slide = t > 0.85 ? (t - 0.85) / 0.15 * 10 : 0;
      ctx.globalAlpha = a;
      const w = ctx.measureText(it.text).width + 16;
      ctx.fillStyle = 'rgba(7,11,22,0.8)';
      ctx.fillRect(vw / 2 - w / 2, y - 7 - slide, w, 14);
      ctx.fillStyle = it.color;
      ctx.fillRect(vw / 2 - w / 2, y - 7 - slide, 2, 14);
      ctx.fillStyle = it.color;
      ctx.fillText(it.text, vw / 2, y - slide);
      ctx.globalAlpha = 1;
      y += 18;
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }
}

// ────────────────────────────────────────────────────────────────────────────
//  Screen layouts
// ────────────────────────────────────────────────────────────────────────────

const VW = 480, VH = 270;

export function layoutMainMenu() {
  const cx = VW / 2;
  const bw = 152, bh = 17, gap = 5;
  const startY = 128;
  const items = [
    new MenuItem({ id: 'play', label: 'PLAY', sub: `LEVEL ${Save.lastPlayed}`, x: cx - bw / 2, y: startY, w: bw, h: bh }),
    new MenuItem({ id: 'levels', label: 'LEVEL SELECT', x: cx - bw / 2, y: startY + (bh + gap), w: bw, h: bh }),
    new MenuItem({ id: 'how', label: 'HOW TO PLAY', x: cx - bw / 2, y: startY + (bh + gap) * 2, w: bw, h: bh }),
    new MenuItem({ id: 'settings', label: 'SETTINGS', x: cx - bw / 2, y: startY + (bh + gap) * 3, w: bw, h: bh }),
  ];
  return new Menu(items);
}

export function layoutLevelSelect() {
  const items = [];
  const cw = 104, ch = 96, gap = 12;
  const totalW = cw * 3 + gap * 2;
  const startX = (VW - totalW) / 2;
  const y = 100;
  for (let i = 0; i < 3; i++) {
    const data = LEVELS[i];
    const unlocked = Save.isUnlocked(data.id);
    items.push(new MenuItem({
      id: `lvl${data.id}`, label: data.name, type: 'card',
      x: startX + i * (cw + gap), y, w: cw, h: ch,
      disabled: !unlocked, data: data.id,
    }));
  }
  items.push(new MenuItem({ id: 'back', label: 'BACK', x: VW / 2 - 40, y: y + ch + 18, w: 80, h: 16 }));
  return new Menu(items);
}

export function layoutPause() {
  const cx = VW / 2, bw = 140, bh = 16, gap = 5, startY = 100;
  const items = [
    new MenuItem({ id: 'resume', label: 'RESUME', x: cx - bw / 2, y: startY, w: bw, h: bh }),
    new MenuItem({ id: 'restart', label: 'RESTART LEVEL', x: cx - bw / 2, y: startY + (bh + gap), w: bw, h: bh }),
    new MenuItem({ id: 'settings', label: 'SETTINGS', x: cx - bw / 2, y: startY + (bh + gap) * 2, w: bw, h: bh }),
    new MenuItem({ id: 'menu', label: 'MAIN MENU', x: cx - bw / 2, y: startY + (bh + gap) * 3, w: bw, h: bh, danger: true }),
  ];
  return new Menu(items);
}

export function layoutSettings() {
  const cx = VW / 2, bw = 190, bh = 14, gap = 3, startY = 74;
  const s = Save.settings();
  const mk = (id, label, type, value, extra = {}) =>
    new MenuItem({ id, label, type, value, x: cx - bw / 2, y: 0, w: bw, h: bh, ...extra });
  const items = [
    mk('music', 'MUSIC VOLUME', 'slider', s.music, { min: 0, max: 1, step: 0.05 }),
    mk('sfx', 'SFX VOLUME', 'slider', s.sfx, { min: 0, max: 1, step: 0.05 }),
    mk('muted', 'MUTE ALL', 'checkbox', s.muted ? 1 : 0),
    mk('screenShake', 'SCREEN SHAKE', 'checkbox', s.screenShake ? 1 : 0),
    mk('reducedMotion', 'REDUCED MOTION', 'checkbox', s.reducedMotion ? 1 : 0),
    mk('showFps', 'SHOW FPS', 'checkbox', s.showFps ? 1 : 0),
  ];
  let y = startY;
  for (const it of items) { it.y = y; y += bh + gap; }
  items.push(new MenuItem({ id: 'back', label: 'BACK', x: cx - 40, y: y + 10, w: 80, h: 16 }));
  return new Menu(items);
}

export function layoutGameOver(canRetry) {
  const cx = VW / 2, bw = 140, bh = 16, startY = 158;
  const items = [
    new MenuItem({ id: 'retry', label: 'RETRY', x: cx - bw / 2, y: startY, w: bw, h: bh }),
    new MenuItem({ id: 'levels', label: 'LEVEL SELECT', x: cx - bw / 2, y: startY + bh + 6, w: bw, h: bh }),
  ];
  void canRetry;
  return new Menu(items);
}

export function layoutLevelComplete(hasNext) {
  const cx = VW / 2, bh = 15, startY = 178;
  const items = [];
  const specs = [];
  if (hasNext) specs.push({ id: 'next', label: 'NEXT LEVEL' });
  specs.push({ id: 'replay', label: 'REPLAY' }, { id: 'levels', label: 'LEVEL SELECT' });
  const n = specs.length;
  const bw = n === 3 ? 124 : 132;
  const gap = 8;
  const total = n * bw + (n - 1) * gap;
  let x = Math.round(cx - total / 2);
  for (const s of specs) {
    items.push(new MenuItem({ id: s.id, label: s.label, x, y: startY, w: bw, h: bh }));
    x += bw + gap;
  }
  return new Menu(items);
}

export { VW, VH };
