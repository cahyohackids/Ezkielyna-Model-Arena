// Renderer: draws everything to the canvas with parallax depth and theming.

import { TILE } from './levels.js';
import { getPlayerFrame, SPRITE_MAP } from './sprites.js';
import { PALETTE as P } from './pix.js';
import { solidAt, oneWayAt, spikeAt, bounceAt, phaseAt } from './levelparser.js';

const THEMES = {
  meadow: {
    bg: ['#0d1220', '#1b2a4a', '#2a4a7f'],
    groundTop: '#4a6a9a',
    groundFill: '#2a4a7f',
    groundDark: '#1d2a45',
    block: '#4a6a9a',
    blockLight: '#5a7fb8',
    accent: '#3fb8a8',
    grass: '#58c46a',
    hill: '#16233f',
    hill2: '#1b2a4a',
  },
  cavern: {
    bg: ['#070912', '#101828', '#1d2a45'],
    groundTop: '#5a7fb8',
    groundFill: '#1d2a45',
    groundDark: '#141b30',
    block: '#3a4a6a',
    blockLight: '#4a6a9a',
    accent: '#7fe7ff',
    grass: '#3fb8a8',
    hill: '#0f1526',
    hill2: '#141b30',
  },
  tower: {
    bg: ['#0a0a18', '#201438', '#3a1e5e'],
    groundTop: '#6a5a9a',
    groundFill: '#2a1e4a',
    groundDark: '#1d1238',
    block: '#4a3a6a',
    blockLight: '#5a4a8a',
    accent: '#ff5a6e',
    grass: '#7fe7ff',
    hill: '#160f2a',
    hill2: '#201438',
  },
};

export class Renderer {
  constructor(ctx) {
    this.ctx = ctx;
    this.time = 0;
  }

  render(game, viewW, viewH) {
    const ctx = this.ctx;
    const camX = game.camera.offsetX;
    const camY = game.camera.offsetY;
    const lv = game.level;
    const theme = THEMES[lv.theme] || THEMES.meadow;
    this.time = game.time;

    ctx.imageSmoothingEnabled = false;

    // clear
    ctx.fillStyle = theme.bg[0];
    ctx.fillRect(0, 0, viewW, viewH);

    this.drawBackground(ctx, theme, camX, camY, viewW, viewH);

    ctx.save();
    ctx.translate(-camX, -camY);

    this.drawTiles(ctx, lv, theme, camX, camY, viewW, viewH);
    this.drawPlatforms(ctx, lv, theme);
    this.drawLasers(ctx, lv);
    this.drawCollectibles(ctx, lv);
    this.drawCheckpoints(ctx, lv);
    this.drawTower(ctx, lv);
    this.drawEnemies(ctx, lv);
    this.drawPlayer(ctx, game);

    ctx.restore();

    // particles (world space; camera translate already applied)
    ctx.save();
    ctx.translate(-camX, -camY);
    game.particles.draw(ctx);
    ctx.restore();
  }

  // Animated backdrop for the main menu / title screen.
  renderMenuBackdrop(game, viewW, viewH) {
    const ctx = this.ctx;
    const t = game.time;
    ctx.imageSmoothingEnabled = false;

    const g = ctx.createLinearGradient(0, 0, 0, viewH);
    g.addColorStop(0, '#0a0e1a');
    g.addColorStop(0.6, '#121c36');
    g.addColorStop(1, '#0d1220');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, viewW, viewH);

    // distant skyline towers (parallax drift)
    ctx.fillStyle = '#1b2a4a';
    ctx.globalAlpha = 0.7;
    const drift = (t * 12) % 260;
    for (let i = 0; i < 8; i++) {
      const tx = ((i * 150 - drift) % (viewW + 200)) - 100;
      const th = 90 + (i % 3) * 55;
      ctx.fillRect(tx, viewH - th - 60, 20, th);
      ctx.fillRect(tx - 7, viewH - th - 68, 34, 9);
      ctx.fillRect(tx + 8, viewH - th - 76, 2, 8);
    }
    ctx.globalAlpha = 1;

    // mid hills
    ctx.fillStyle = '#141b30';
    ctx.beginPath();
    ctx.moveTo(0, viewH);
    for (let x = 0; x <= viewW; x += 40) {
      const h = Math.sin(x * 0.008 + t * 0.15) * 26 + 44;
      ctx.lineTo(x, viewH * 0.72 - h);
    }
    ctx.lineTo(viewW, viewH);
    ctx.closePath();
    ctx.fill();

    // near ridge
    ctx.fillStyle = '#1d2a45';
    ctx.beginPath();
    ctx.moveTo(0, viewH);
    for (let x = 0; x <= viewW; x += 40) {
      const h = Math.sin(x * 0.013 + t * 0.22 + 1) * 18 + 24;
      ctx.lineTo(x, viewH * 0.8 - h);
    }
    ctx.lineTo(viewW, viewH);
    ctx.closePath();
    ctx.fill();

    // ground strip
    ctx.fillStyle = '#0d1220';
    ctx.fillRect(0, viewH * 0.82, viewW, viewH * 0.18);

    // floating signal bits (ambient)
    for (let i = 0; i < 14; i++) {
      const bx = (i * 173 + drift * 1.4) % viewW;
      const by = (i * 97 % (viewH - 60)) + 20 + Math.sin(t * 2 + i) * 8;
      ctx.fillStyle = '#7fe7ff';
      ctx.globalAlpha = 0.25 + 0.2 * Math.sin(t * 3 + i);
      ctx.fillRect(bx, by, 3, 3);
      ctx.globalAlpha = 0.12;
      ctx.beginPath();
      ctx.arc(bx + 1.5, by + 1.5, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // vignette
    const v = ctx.createRadialGradient(viewW / 2, viewH / 2, viewH * 0.3, viewW / 2, viewH / 2, viewH * 0.8);
    v.addColorStop(0, 'rgba(10,14,26,0)');
    v.addColorStop(1, 'rgba(10,14,26,0.65)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, viewW, viewH);
  }

  drawBackground(ctx, theme, camX, camY, viewW, viewH) {
    this.drawSkylineLayer(ctx, theme, camX, camY, 0.15, viewW, viewH, 1);
    this.drawSkylineLayer(ctx, theme, camX, camY, 0.35, viewW, viewH, 2);
    this.drawSkylineLayer(ctx, theme, camX, camY, 0.55, viewW, viewH, 3);
  }

  drawSkylineLayer(ctx, theme, camX, camY, factor, viewW, viewH, layer) {
    const offsetX = camX * factor;
    const baseY = viewH * 0.6 + layer * 30;
    const color = layer === 1 ? theme.hill : layer === 2 ? theme.hill2 : theme.groundDark;
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(0, viewH);
    const step = 40;
    for (let x = -step; x < viewW + step; x += step) {
      const wx = x + offsetX;
      const h = Math.sin(wx * 0.01 + layer * 2) * 30 + Math.sin(wx * 0.023 + layer) * 20 + 40;
      ctx.lineTo(x, baseY - h);
    }
    ctx.lineTo(viewW, viewH);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    // distant "tower" silhouettes for flavor
    if (layer === 1) {
      ctx.fillStyle = theme.hill2;
      ctx.globalAlpha = 0.6;
      for (let i = 0; i < 6; i++) {
        const tx = (i * 240 - offsetX * 0.7) % (viewW + 200) - 100;
        const tw = 18;
        const th = 80 + (i % 3) * 40;
        ctx.fillRect(tx, baseY - th - 40, tw, th);
        ctx.fillRect(tx - 6, baseY - th - 50, tw + 12, 8);
      }
      ctx.globalAlpha = 1;
    }
  }

  drawTiles(ctx, lv, theme, camX, camY, viewW, viewH) {
    const tx0 = Math.floor(camX / TILE) - 1;
    const tx1 = Math.ceil((camX + viewW) / TILE) + 1;
    const ty0 = Math.floor(camY / TILE) - 1;
    const ty1 = Math.ceil((camY + viewH) / TILE) + 1;

    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        if (tx < 0 || ty < 0 || tx >= lv.tileW || ty >= lv.tileH) continue;
        const x = tx * TILE;
        const y = ty * TILE;
        const solid = solidAt(lv, tx, ty);
        const ow = oneWayAt(lv, tx, ty);

        if (solid) {
          this.drawGroundTile(ctx, x, y, theme, tx, ty, lv);
        } else if (ow) {
          this.drawOneWay(ctx, x, y, theme);
        }
        if (spikeAt(lv, tx, ty)) this.drawSpikes(ctx, x, y, theme);
        if (bounceAt(lv, tx, ty)) this.drawBounce(ctx, x, y, theme);
      }
    }
  }

  drawGroundTile(ctx, x, y, theme, tx, ty, lv) {
    const below = solidAt(lv, tx, ty + 1);
    ctx.fillStyle = theme.groundFill;
    ctx.fillRect(x, y, TILE, TILE);
    // inner texture
    ctx.fillStyle = theme.groundDark;
    if ((tx * 7 + ty * 13) % 5 === 0) {
      ctx.fillRect(x + 6, y + 6, 6, 6);
    }
    if ((tx * 3 + ty * 5) % 7 === 0) {
      ctx.fillRect(x + 20, y + 16, 4, 4);
    }
    // top surface highlight
    if (!below) {
      ctx.fillStyle = theme.groundTop;
      ctx.fillRect(x, y, TILE, 4);
      // grass/edge accent
      ctx.fillStyle = theme.grass;
      ctx.fillRect(x, y, TILE, 3);
      ctx.fillRect(x + 4, y + 3, 6, 2);
      ctx.fillRect(x + 16, y + 3, 5, 2);
      ctx.fillRect(x + 26, y + 3, 4, 2);
    }
    // subtle border
    ctx.fillStyle = 'rgba(10,14,26,0.35)';
    ctx.fillRect(x, y + TILE - 1, TILE, 1);
    ctx.fillRect(x + TILE - 1, y, 1, TILE);
  }

  drawOneWay(ctx, x, y, theme) {
    ctx.fillStyle = theme.block;
    ctx.fillRect(x, y + 6, TILE, 8);
    ctx.fillStyle = theme.blockLight;
    ctx.fillRect(x, y + 6, TILE, 3);
    ctx.fillStyle = theme.accent;
    ctx.fillRect(x + 2, y + 9, TILE - 4, 2);
  }

  drawSpikes(ctx, x, y, theme) {
    ctx.fillStyle = theme.accent;
    const n = 4;
    const w = TILE / n;
    for (let i = 0; i < n; i++) {
      ctx.beginPath();
      ctx.moveTo(x + i * w, y + TILE);
      ctx.lineTo(x + i * w + w / 2, y + TILE - 14);
      ctx.lineTo(x + i * w + w, y + TILE);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,90,110,0.5)';
    for (let i = 0; i < n; i++) {
      ctx.fillRect(x + i * w + w / 2 - 1, y + TILE - 8, 2, 8);
    }
  }

  drawBounce(ctx, x, y, theme) {
    ctx.fillStyle = theme.block;
    ctx.fillRect(x + 2, y + TILE - 8, TILE - 4, 8);
    ctx.fillStyle = '#ff8c42';
    const pulse = 0.5 + Math.sin(this.time * 6) * 0.2;
    ctx.fillRect(x + 4, y + TILE - 6, TILE - 8, 6 * pulse);
    ctx.fillStyle = '#7fe7ff';
    ctx.fillRect(x + 8, y + TILE - 14, 4, 6);
    ctx.fillRect(x + TILE - 12, y + TILE - 14, 4, 6);
  }

  drawPlatforms(ctx, lv, theme) {
    // moving platforms
    for (const mp of lv.movingPlatforms) {
      this.drawPlatformSlab(ctx, mp.x, mp.y, mp.w, theme, '#3fb8a8');
    }
    // falling platforms
    for (const fp of lv.fallingPlatforms) {
      if (!fp.dead) {
        const shake = fp.shaking > 0 ? Math.sin(this.time * 40) * 3 : 0;
        this.drawPlatformSlab(ctx, fp.x + shake, fp.y, fp.w, theme, '#ff8c42');
      }
    }
    // phase platforms
    for (const pp of lv.phasePlatforms) {
      if (pp.active) {
        const alpha = 0.6 + Math.sin(this.time * 10) * 0.3;
        ctx.globalAlpha = Math.max(0.25, alpha);
        this.drawPlatformSlab(ctx, pp.x, pp.y, pp.w, theme, '#7fe7ff');
        ctx.globalAlpha = 1;
      } else if (this.time % 1 < 0.3) {
        // faint ghost outline when inactive
        ctx.globalAlpha = 0.15;
        this.drawPlatformSlab(ctx, pp.x, pp.y, pp.w, theme, '#7fe7ff');
        ctx.globalAlpha = 1;
      }
    }
  }

  drawPlatformSlab(ctx, x, y, w, theme, accent) {
    ctx.fillStyle = theme.block;
    ctx.fillRect(x, y, w, 14);
    ctx.fillStyle = theme.blockLight;
    ctx.fillRect(x, y, w, 4);
    ctx.fillStyle = accent;
    ctx.fillRect(x + 3, y + 7, w - 6, 3);
    // edge glows
    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.5;
    ctx.fillRect(x, y + 14 - 2, 4, 2);
    ctx.fillRect(x + w - 4, y + 14 - 2, 4, 2);
    ctx.globalAlpha = 1;
  }

  drawLasers(ctx, lv) {
    for (const l of lv.lasers) {
      if (!l.active) continue;
      ctx.fillStyle = '#ff5a6e';
      ctx.globalAlpha = 0.85;
      if (l.dir === 'h') {
        ctx.fillRect(l.x, l.y + 8, l.len, 16);
      } else {
        ctx.fillRect(l.x - 2, l.y, 4, l.len);
      }
      // bright core
      ctx.fillStyle = '#ffd9d9';
      if (l.dir === 'h') {
        ctx.fillRect(l.x, l.y + 14, l.len, 4);
      } else {
        ctx.fillRect(l.x - 1, l.y, 2, l.len);
      }
      ctx.globalAlpha = 1;
      // emitter node
      ctx.fillStyle = '#ff5a6e';
      ctx.fillRect(l.x - 4, (l.dir === 'h' ? l.y + 4 : l.y - 4), 8, 8);
      ctx.fillStyle = '#fff';
      ctx.fillRect(l.x - 1, (l.dir === 'h' ? l.y + 7 : l.y - 1), 2, 2);
    }
  }

  drawCollectibles(ctx, lv) {
    for (const b of lv.bits) {
      if (b.collected) continue;
      const bob = Math.sin(this.time * 4 + b.x * 0.01) * 3;
      const sp = SPRITE_MAP.bit;
      const sx = b.x - sp.width / 2;
      const sy = b.y - sp.height / 2 + bob;
      ctx.drawImage(sp, sx, sy);
      // glow
      ctx.fillStyle = 'rgba(127,231,255,0.25)';
      ctx.beginPath();
      ctx.arc(b.x, b.y + bob, 12, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const c of lv.cores) {
      if (c.collected) continue;
      const bob = Math.sin(this.time * 3 + c.x * 0.01) * 4;
      const sp = SPRITE_MAP.core;
      const sx = c.x - sp.width / 2;
      const sy = c.y - sp.height / 2 + bob;
      ctx.drawImage(sp, sx, sy);
      ctx.fillStyle = 'rgba(255,140,66,0.3)';
      ctx.beginPath();
      ctx.arc(c.x, c.y + bob, 16, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawCheckpoints(ctx, lv) {
    for (const cp of lv.checkpoints) {
      const active = cp.activated;
      const x = cp.x, y = cp.y;
      // pole
      ctx.fillStyle = '#4a6a9a';
      ctx.fillRect(x + 10, y + 4, 4, 24);
      // terminal body
      ctx.fillStyle = active ? '#3fb8a8' : '#2a4a7f';
      ctx.fillRect(x + 2, y + 28, 20, 16);
      ctx.fillStyle = active ? '#7fe7ff' : '#5a7fb8';
      ctx.fillRect(x + 4, y + 30, 16, 3);
      // light
      const pulse = active ? 0.7 + Math.sin(this.time * 5) * 0.3 : 0.3;
      ctx.fillStyle = `rgba(127,231,255,${active ? pulse : 0.2})`;
      ctx.beginPath();
      ctx.arc(x + 12, y + 2, active ? 6 : 4, 0, Math.PI * 2);
      ctx.fill();
      if (active) {
        ctx.fillStyle = '#7fe7ff';
        ctx.beginPath();
        ctx.arc(x + 12, y + 2, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  drawTower(ctx, lv) {
    const t = lv.tower;
    const active = t.active;
    const x = t.x, y = t.y;
    const prog = t.progress ?? 0;
    // base
    ctx.fillStyle = '#2a4a7f';
    ctx.fillRect(x + 2, y + 12, 28, 20);
    ctx.fillStyle = '#4a6a9a';
    ctx.fillRect(x + 2, y + 12, 28, 4);
    // tower shaft
    ctx.fillStyle = '#1d2a45';
    ctx.fillRect(x + 8, y - 40, 16, 52);
    ctx.fillStyle = '#2a4a7f';
    ctx.fillRect(x + 8, y - 40, 16, 3);
    // antenna
    ctx.fillStyle = '#5a7fb8';
    ctx.fillRect(x + 15, y - 56, 2, 16);
    // signal rings
    if (active) {
      const ringR = 10 + prog * 40;
      ctx.strokeStyle = `rgba(127,231,255,${1 - prog})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x + 16, y - 48, ringR, 0, Math.PI * 2);
      ctx.stroke();
      // top glow
      const g = 0.5 + Math.sin(this.time * 8) * 0.4;
      ctx.fillStyle = `rgba(127,231,255,${g})`;
      ctx.beginPath();
      ctx.arc(x + 16, y - 56, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(x + 16, y - 56, 3, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // idle faint beacon
      ctx.fillStyle = 'rgba(127,231,255,0.25)';
      ctx.beginPath();
      ctx.arc(x + 16, y - 56, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawEnemies(ctx, lv) {
    for (const e of lv.enemies) {
      if (e.dead && e.deathTimer <= 0) continue;
      const anim = e.type === 'hopper' ? SPRITE_MAP.hopper : SPRITE_MAP.bug;
      const frame = anim[Math.floor(e.t * 8) % anim.length];
      if (e.dead) {
        ctx.globalAlpha = Math.max(0, e.deathTimer / 0.5);
        ctx.save();
        ctx.translate(e.x + e.w / 2, e.y + e.h / 2);
        ctx.rotate(e.deathTimer * 10);
        ctx.drawImage(frame, -frame.width / 2, -frame.height / 2);
        ctx.restore();
        ctx.globalAlpha = 1;
        continue;
      }
      // telegraph flash for bug charging
      if (e.type === 'bug' && e.charging) {
        ctx.globalAlpha = 0.6 + Math.sin(this.time * 20) * 0.4;
      }
      if (e.type === 'bug' && e.chargeTimer > 0 && !e.charging) {
        ctx.fillStyle = 'rgba(255,140,66,0.4)';
        ctx.beginPath();
        ctx.arc(e.x + e.w / 2, e.y + e.h / 2, 16, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.drawImage(frame, e.x + (e.w - frame.width) / 2, e.y + e.h - frame.height);
      ctx.globalAlpha = 1;
    }
    // drones
    for (const d of lv.drones) {
      if (d.dead && d.deathTimer <= 0) continue;
      const frame = SPRITE_MAP.drone[0];
      if (d.dead) {
        ctx.globalAlpha = Math.max(0, d.deathTimer / 0.5);
        ctx.drawImage(frame, d.x, d.y + d.deathTimer * 200);
        ctx.globalAlpha = 1;
        continue;
      }
      const bob = Math.sin(d.t * 4) * 3;
      ctx.drawImage(frame, d.x, d.y + bob);
      ctx.fillStyle = 'rgba(127,231,255,0.2)';
      ctx.beginPath();
      ctx.arc(d.x + 12, d.y + 12 + bob, 14, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawPlayer(ctx, game) {
    const p = game.player;
    if (p.dead && p.deathTimer > 0.8) return;
    if (p.won) {
      const frame = getPlayerFrame('victory', p.winTimer, 0);
      ctx.drawImage(frame, p.x - 2, p.y - 4);
      return;
    }
    // blink during invulnerability
    if (p.invuln > 0 && Math.floor(p.invuln * 12) % 2 === 0) return;

    const frame = getPlayerFrame(p.anim, p.animTime, p.walkCycle);
    // apply squash/stretch
    const cx = p.x + p.w / 2;
    const cy = p.y + p.h;
    const sx = p.stretch;
    const sy = p.squash;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(p.dir * sx, sy);
    ctx.translate(-frame.width / 2, -frame.height);
    ctx.drawImage(frame, 0, 0);
    ctx.restore();

    // dash trail
    if (p.dashTime > 0) {
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = '#7fe7ff';
      for (let i = 1; i <= 3; i++) {
        ctx.fillRect(p.x - p.dir * i * 10, p.y + 6, 8, 12);
      }
      ctx.globalAlpha = 1;
    }
  }
}
