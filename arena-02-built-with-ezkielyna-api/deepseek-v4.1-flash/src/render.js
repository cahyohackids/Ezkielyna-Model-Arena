// render.js — world rendering: parallax backgrounds, tilemap, props, entities.
//
// Performance:
//  • Tiles are drawn only for the visible tile range (culled).
//  • Each tile theme column is pre-baked into horizontal strips at build time
//    so a whole row of terrain is a handful of drawImage calls, not hundreds.
//  • Parallax layers are pre-rendered to offscreen canvases once.

import { TILE, T, THEMES } from './tiles.js';
import { PLATFORM_KINDS } from './level.js';
import { drawSprite, drawSpriteCentered } from './sprites.js';

export class Renderer {
  constructor(ctx, atlas) {
    this.ctx = ctx;
    this.atlas = atlas;
    this.viewW = ctx.canvas.width;
    this.viewH = ctx.canvas.height;
    this.bg = null;         // built per level
    this.reducedMotion = false;
  }

  /** Pre-render the parallax background for a theme to offscreen canvases. */
  buildBackground(themeKey, levelW, levelH) {
    const th = THEMES[themeKey];
    const vw = this.viewW, vh = this.viewH;

    // Sky gradient rendered once (canvas height only).
    const sky = mkCanvas(vw, vh);
    const sc = sky.getContext('2d');
    const g = sc.createLinearGradient(0, 0, 0, vh);
    g.addColorStop(0, th.skyTop);
    g.addColorStop(0.55, th.skyMid);
    g.addColorStop(1, th.skyLow);
    sc.fillStyle = g;
    sc.fillRect(0, 0, vw, vh);

    // Deterministic starfield / motes for depth.
    const rng = mulberry(themeKey === 'cave' ? 1337 : themeKey === 'tower' ? 909 : 42);
    if (themeKey === 'cave') {
      // faint circuit traces
      sc.strokeStyle = 'rgba(70,140,160,0.10)';
      sc.lineWidth = 1;
      for (let i = 0; i < 26; i++) {
        let x = Math.floor(rng() * vw), y = Math.floor(rng() * vh);
        sc.beginPath(); sc.moveTo(x, y);
        for (let s = 0; s < 3; s++) {
          if (rng() < 0.5) x += (rng() < 0.5 ? -1 : 1) * (8 + Math.floor(rng() * 40));
          else y += (rng() < 0.5 ? -1 : 1) * (8 + Math.floor(rng() * 30));
          sc.lineTo(x, y);
        }
        sc.stroke();
      }
    } else if (themeKey === 'tower') {
      sc.fillStyle = 'rgba(190,120,240,0.08)';
      for (let i = 0; i < 60; i++) {
        const x = Math.floor(rng() * vw), y = Math.floor(rng() * vh);
        sc.fillRect(x, y, 1 + (rng() < 0.2 ? 1 : 0), 1);
      }
    } else {
      sc.fillStyle = 'rgba(230,240,255,0.16)';
      for (let i = 0; i < 34; i++) {
        const x = Math.floor(rng() * vw), y = Math.floor(rng() * vh * 0.7);
        sc.fillRect(x, y, 1, 1);
      }
    }

    // Far skyline / silhouette layer, tiled horizontally.
    const far = this._skylineLayer(th.far, 0.12, 12, rng, themeKey);
    const mid = this._skylineLayer(th.mid, 0.26, 7, rng, themeKey);
    const near = this._skylineLayer(th.near, 0.45, 5, rng, themeKey);

    this.bg = { sky, far, mid, near, theme: themeKey, levelW, levelH };
  }

  _skylineLayer(color, factor, segMin, rng, themeKey) {
    // One wide strip that repeats horizontally for seamless scrolling.
    const stripW = 480;
    const h = this.viewH;
    const c = mkCanvas(stripW, h);
    const cx = c.getContext('2d');
    cx.fillStyle = color;

    let x = 0;
    while (x < stripW) {
      const w = 16 + Math.floor(rng() * 44);
      let bh;
      if (themeKey === 'meadow') bh = 26 + Math.floor(rng() * 52);
      else if (themeKey === 'cave') bh = 40 + Math.floor(rng() * 90);
      else bh = 50 + Math.floor(rng() * 110);
      const y = h - bh;
      cx.fillRect(x, y, w, bh);
      // Windows/details
      if (themeKey !== 'cave') {
        cx.fillStyle = themeKey === 'tower' ? 'rgba(190,130,240,0.20)' : 'rgba(140,200,190,0.14)';
        for (let wy = y + 5; wy < h - 6; wy += 8) {
          for (let wx = x + 4; wx < x + w - 5; wx += 7) {
            if (rng() < 0.42) cx.fillRect(wx, wy, 2, 3);
          }
        }
        cx.fillStyle = color;
      } else {
        // Crystals poking out of cave silhouettes
        cx.fillStyle = 'rgba(120, 200, 210, 0.10)';
        for (let k = 0; k < 3; k++) {
          const px = x + 4 + Math.floor(rng() * Math.max(1, w - 8));
          cx.fillRect(px, y - 3, 2, 4);
        }
        cx.fillStyle = color;
      }
      x += w + 2 + Math.floor(rng() * 10);
    }
    void factor;
    return c;
  }

  /** Draw the parallax background scrolled to the camera. */
  drawBackground(cam) {
    if (!this.bg) return;
    const { sky, far, mid, near } = this.bg;
    const ctx = this.ctx;
    // Sky is fixed (no parallax) — cheap and keeps the horizon stable.
    ctx.drawImage(sky, 0, 0, this.viewW, this.viewH);

    const drawStrip = (strip, factor, yOffset) => {
      const sx = Math.floor(-cam.renderX * factor) % strip.width;
      const startX = sx > 0 ? sx - strip.width : sx;
      const yy = Math.floor(yOffset - cam.renderY * factor * 0.35);
      for (let x = startX; x < this.viewW; x += strip.width) {
        ctx.drawImage(strip, x, yy);
      }
    };

    drawStrip(far, 0.10, 0);
    drawStrip(mid, 0.22, this.viewH * 0.02);
    drawStrip(near, 0.38, this.viewH * 0.05);
  }

  // ─────────────────────────────────────────────────── Tiles

  drawTiles(level, cam, phaseT) {
    const ctx = this.ctx;
    const at = this.atlas;
    const theme = level.theme;
    const topSprite = at.tileTop[theme];
    const fillSprite = at.tileFill[theme];
    const tw = TILE;

    const x0 = Math.max(0, Math.floor(cam.renderX / tw) - 1);
    const x1 = Math.min(level.tiles.w - 1, Math.floor((cam.renderX + this.viewW) / tw) + 1);
    const y0 = Math.max(0, Math.floor(cam.renderY / tw) - 1);
    const y1 = Math.min(level.tiles.h - 1, Math.floor((cam.renderY + this.viewH) / tw) + 1);

    // Pass 1: solid terrain (top tiles get the grass/edge sprite).
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const raw = level.tiles.get(tx, ty);
        if (raw === T.EMPTY || raw === T.GOAL || raw === T.LADDER) continue;
        const sx = tx * tw - cam.renderX;
        const sy = ty * tw - cam.renderY;

        if (raw === T.SOLID) {
          const above = level.tiles.get(tx, ty - 1);
          const useTop = above !== T.SOLID;
          ctx.drawImage(useTop ? topSprite : fillSprite, sx, sy);
        } else if (raw === T.ONEWAY) {
          this._drawOneWay(sx, sy, theme);
        } else if (raw === T.SPIKE) {
          ctx.drawImage(at.spikes, sx, sy + tw - at.spikes.height);
        } else if (raw === T.SPIKE_CEIL) {
          ctx.save();
          ctx.translate(sx, sy + at.spikes.height);
          ctx.scale(1, -1);
          ctx.drawImage(at.spikes, 0, 0);
          ctx.restore();
        } else if (raw === T.PHASE) {
          const p = level.phaseRhythm ? level.phaseRhythm(tx, ty) : null;
          const t = p ?? phaseT;
          this._drawPhaseTile(sx, sy, t, at, tx, ty);
        }
      }
    }
  }

  _drawOneWay(sx, sy, theme) {
    const ctx = this.ctx;
    const col = theme === 'meadow' ? '#3a5c80' : theme === 'cave' ? '#33526f' : '#6b4a9a';
    const col2 = theme === 'meadow' ? '#69b374' : theme === 'cave' ? '#7fc9d6' : '#b06fd0';
    ctx.fillStyle = '#0c1424';
    ctx.fillRect(sx, sy + 2, 16, 8);
    ctx.fillStyle = col;
    ctx.fillRect(sx, sy + 3, 16, 6);
    ctx.fillStyle = col2;
    ctx.fillRect(sx, sy + 3, 16, 2);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    for (let i = 2; i < 16; i += 4) ctx.fillRect(sx + i, sy + 6, 2, 3);
  }

  _drawPhaseTile(sx, sy, t, at, tx, ty) {
    const ctx = this.ctx;
    const period = 2.6;
    let cyc = (t + (tx + ty) * 0.11) % period;
    if (cyc < 0) cyc += period;
    const frac = cyc / period;
    if (frac < 0.62) {
      ctx.drawImage(at.phaseBlock[0], sx, sy);
    } else if (frac < 0.72) {
      // dissolving
      const k = Math.floor((frac - 0.62) / 0.1 * 2);
      ctx.globalAlpha = 0.85;
      ctx.drawImage(at.phaseBlock[Math.min(2, k)], sx, sy);
      ctx.globalAlpha = 1;
    } else if (frac < 0.9) {
      ctx.globalAlpha = 0.16;
      ctx.drawImage(at.phaseBlock[2], sx, sy);
      ctx.globalAlpha = 1;
    } else {
      // Re-appearing: draw faint outline as a telegraph.
      ctx.globalAlpha = 0.35;
      ctx.drawImage(at.phaseBlock[2], sx, sy);
      ctx.globalAlpha = 1;
    }
  }

  // ─────────────────────────────────────────────────── Objects

  drawCheckpoints(level, cam) {
    const at = this.atlas;
    for (const cp of level.checkpoints) {
      const img = cp.active
        ? at.checkpointOn[Math.floor(cp.anim * 6) % 2]
        : at.checkpointOff[Math.floor(cp.anim * 2.4) % 2];
      const sx = Math.round(cp.x - at.s * 6 - cam.renderX);
      const sy = Math.round(cp.y - img.height - cam.renderY + at.s * 0);
      this.ctx.drawImage(img, sx, sy);
      // Pole down into the ground
      this.ctx.fillStyle = '#1b2b45';
      this.ctx.fillRect(cp.x - at.s * 1 + at.s / 2 - cam.renderX, cp.y - 2 - cam.renderY, at.s * 2, 4);
      if (cp.active) {
        const pulse = 0.5 + 0.5 * Math.sin(cp.anim * 3.4);
        const ctx = this.ctx;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.10 + pulse * 0.10;
        ctx.fillStyle = '#63d3c2';
        ctx.beginPath();
        ctx.arc(cp.x - cam.renderX, cp.y - 12 - cam.renderY, 22 + pulse * 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  drawCollectibles(level, cam, time) {
    const at = this.atlas;
    const ctx = this.ctx;
    for (const b of level.bits) {
      if (b.collected) continue;
      if (b.x < cam.renderX - 30 || b.x > cam.renderX + this.viewW + 30) continue;
      if (b.y < cam.renderY - 30 || b.y > cam.renderY + this.viewH + 30) continue;
      const f = Math.floor((time * 9 + b.t)) % 4;
      const img = at.bit[f];
      const px = Math.round(b.x - cam.renderX);
      const py = Math.round(b.y - cam.renderY);
      // soft glow behind
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.16 + 0.07 * Math.sin(time * 4 + b.t);
      ctx.fillStyle = '#6fe0c8';
      ctx.beginPath();
      ctx.arc(px, py, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.drawImage(img, px - img.width / 2, py - img.height / 2);
    }

    for (const c of level.cores) {
      if (c.collected) continue;
      if (c.x < cam.renderX - 40 || c.x > cam.renderX + this.viewW + 40) continue;
      if (c.y < cam.renderY - 40 || c.y > cam.renderY + this.viewH + 40) continue;
      const f = Math.floor(time * 7 + c.t) % 4;
      const img = at.core[f];
      const px = Math.round(c.x - cam.renderX);
      const py = Math.round(c.y - cam.renderY);
      const pulse = 0.5 + 0.5 * Math.sin(time * 3 + c.t);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.14 + pulse * 0.12;
      ctx.fillStyle = '#ffb45e';
      ctx.beginPath();
      ctx.arc(px, py, 16 + pulse * 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      // Rotating data ring
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(time * 1.5 + c.t);
      ctx.strokeStyle = 'rgba(120,232,208,0.5)';
      ctx.lineWidth = 1;
      ctx.strokeRect(-11, -11, 22, 22);
      ctx.restore();
      ctx.drawImage(img, px - img.width / 2, py - img.height / 2);
    }
  }

  drawPlatforms(level, cam) {
    const at = this.atlas;
    const ctx = this.ctx;
    for (const p of level.platforms) {
      if (!p.active) continue;
      const sx = Math.round(p.x - cam.renderX);
      const sy = Math.round(p.y - cam.renderY);
      if (sx > this.viewW + 40 || sx + p.w < -40) continue;
      if (sy > this.viewH + 40 || sy + p.h < -60) continue;

      switch (p.kind) {
        case PLATFORM_KINDS.BOUNCE:
          ctx.drawImage(at.bouncePad[Math.floor(p.animT * 4) % 2], sx, sy - 8 + 8);
          break;
        case PLATFORM_KINDS.PHASE: {
          const cyc = (p.t % p.period) / p.period;
          this._drawPhasePlatform(sx, sy, p, cyc);
          break;
        }
        case PLATFORM_KINDS.FALL: {
          this._drawFallPlatform(sx, sy, p);
          break;
        }
        default: {
          this._drawMetalPlatform(sx, sy, p);
        }
      }
    }
  }

  _drawMetalPlatform(sx, sy, p) {
    const ctx = this.ctx;
    const w = p.w, h = p.h;
    ctx.fillStyle = '#0c1424';
    ctx.fillRect(sx - 1, sy - 1, w + 2, h + 2);
    ctx.fillStyle = '#2f4a7a';
    ctx.fillRect(sx, sy, w, h);
    ctx.fillStyle = '#4a6ea8';
    ctx.fillRect(sx, sy, w, 2);
    ctx.fillStyle = '#1b2b45';
    for (let i = 3; i < w - 3; i += 6) ctx.fillRect(sx + i, sy + h - 3, 3, 2);
    // Amber direction studs show it moves
    ctx.fillStyle = '#f08a35';
    ctx.fillRect(sx + 2, sy + 3, 2, 2);
    ctx.fillRect(sx + w - 4, sy + 3, 2, 2);
  }

  _drawFallPlatform(sx, sy, p) {
    const ctx = this.ctx;
    const w = p.w, h = p.h;
    const shaking = p.fallState === 'shaking';
    const jitter = shaking ? Math.round(Math.sin(p.animT * 60) * 1.2) : 0;
    ctx.save();
    ctx.translate(jitter, 0);
    ctx.fillStyle = '#0c1424';
    ctx.fillRect(sx - 1, sy - 1, w + 2, h + 2);
    ctx.fillStyle = shaking ? '#8b6f52' : '#5d6a80';
    ctx.fillRect(sx, sy, w, h);
    ctx.fillStyle = shaking ? '#b08c68' : '#8894a8';
    ctx.fillRect(sx, sy, w, 2);
    // Crack pattern grows while shaking
    ctx.fillStyle = '#0c1424';
    const cracks = shaking ? 4 : 2;
    for (let i = 0; i < cracks; i++) {
      ctx.fillRect(sx + 2 + i * (w / cracks), sy + 2, 1, h - 4);
    }
    ctx.restore();
  }

  _drawPhasePlatform(sx, sy, p, cyc) {
    const ctx = this.ctx;
    const w = p.w, h = p.h;
    const on = cyc < 0.66;
    const dissolving = cyc >= 0.66 && cyc < 0.78;
    const reappearing = cyc >= 0.9;
    if (!on && !dissolving && !reappearing) {
      // empty — draw only a faint target outline
      ctx.globalAlpha = 0.10;
      ctx.strokeStyle = '#63d3c2';
      ctx.strokeRect(sx + 0.5, sy + 0.5, w - 1, h - 1);
      ctx.globalAlpha = 1;
      return;
    }
    let alpha = 1;
    if (dissolving) alpha = 1 - (cyc - 0.66) / 0.12 * 0.85;
    if (reappearing) alpha = 0.25 + (cyc - 0.9) / 0.1 * 0.75;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#0c1424';
    ctx.fillRect(sx - 1, sy - 1, w + 2, h + 2);
    ctx.fillStyle = '#3fb8a8';
    ctx.fillRect(sx, sy, w, h);
    ctx.fillStyle = '#9df5e6';
    ctx.fillRect(sx, sy, w, 2);
    ctx.fillStyle = 'rgba(10,30,40,0.55)';
    for (let i = 3; i < w - 3; i += 5) ctx.fillRect(sx + i, sy + 3, 2, h - 6);
    ctx.globalAlpha = 1;
  }

  drawHazards(level, cam) {
    const ctx = this.ctx;
    for (const hz of level.hazards) {
      const sx = Math.round(hz.x - cam.renderX);
      const sy = Math.round(hz.y - cam.renderY);
      if (sx > this.viewW + 40 || sx + hz.w < -40) continue;
      if (hz.type === 'laser') {
        const on = hz.lethal;
        ctx.save();
        // emitter
        ctx.fillStyle = '#0c1424';
        ctx.fillRect(sx - 3, sy - 3, hz.w + 6, hz.h + 6);
        ctx.fillStyle = on ? '#e2564e' : '#5d6a80';
        ctx.fillRect(sx - 2, sy + hz.h / 2 - 3, hz.w + 4, 4);
        ctx.fillStyle = on ? '#0c1424' : '#8894a8';
        ctx.fillRect(sx - 2, sy + hz.h / 2 - 3, hz.w + 4, 2);
        if (on) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 0.55 + 0.25 * Math.sin(hz.t * 22);
          ctx.fillStyle = '#ff6b5e';
          ctx.fillRect(sx, sy, hz.w, hz.h);
          ctx.globalAlpha = 1;
          ctx.fillStyle = '#ffeede';
          ctx.fillRect(sx, sy + hz.h / 2 - 1, hz.w, 2);
          ctx.globalCompositeOperation = 'source-over';
        } else {
          ctx.globalAlpha = 0.28 * (hz.blink ?? 1);
          ctx.fillStyle = '#e2564e';
          ctx.fillRect(sx, sy + hz.h / 2 - 1, hz.w, 2);
          ctx.globalAlpha = 1;
        }
        ctx.restore();
      } else if (hz.type === 'pit') {
        // energy pit: animated instakill volume
        ctx.save();
        const p = 0.5 + 0.5 * Math.sin(hz.t * 2.6);
        ctx.globalAlpha = 0.5 + p * 0.3;
        ctx.fillStyle = '#3fb8a8';
        ctx.fillRect(sx, sy + 2 + p * 2, hz.w, hz.h - 4 - p * 2);
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = '#9df5e6';
        for (let i = 0; i < hz.w; i += 8) {
          const off = Math.sin((hz.t * 3 + i) * 0.7) * 2;
          ctx.fillRect(sx + i, sy + 2 + off, 4, 2);
        }
        ctx.restore();
      }
    }
  }

  drawProps(level, cam, props) {
    const ctx = this.ctx;
    for (const p of props) {
      const img = this.atlas.props[p.kind];
      if (!img) continue;
      const sx = Math.round(p.x - cam.renderX);
      const sy = Math.round(p.y - cam.renderY);
      if (sx > this.viewW + 60 || sx + img.width < -60) continue;
      if (sy > this.viewH + 60 || sy + img.height < -80) continue;
      const flip = p.flip ? -1 : 1;
      if (flip === -1) {
        ctx.save();
        ctx.translate(sx + img.width, sy);
        ctx.scale(-1, 1);
        ctx.drawImage(img, 0, 0);
        ctx.restore();
      } else {
        ctx.drawImage(img, sx, sy);
      }
    }
  }

  drawGoal(level, cam, time, goalState) {
    const at = this.atlas;
    const ctx = this.ctx;
    const g = level.goal;
    const sx = Math.round(g.x - cam.renderX);
    const sy = Math.round(g.y - cam.renderY);

    // Tower base sprite at the bottom of the goal rect
    const base = at.props.towerBase;
    ctx.drawImage(base, sx + (g.w - base.width) / 2, sy + g.h - base.height);

    // Mast
    const mastX = sx + g.w / 2;
    const mastTopY = sy - 60;
    ctx.fillStyle = '#1b2b45';
    ctx.fillRect(mastX - 3, mastTopY, 6, g.h + 60);
    ctx.fillStyle = '#2c4462';
    ctx.fillRect(mastX - 3, mastTopY, 2, g.h + 60);
    // Cross braces
    ctx.fillStyle = '#0c1424';
    for (let y = mastTopY + 8; y < sy + g.h; y += 12) {
      ctx.fillRect(mastX - 7, y, 14, 2);
    }

    // Beacon head
    const head = at.towerTop[Math.floor(time * (goalState === 'active' ? 8 : 4)) % 3];
    ctx.drawImage(head, sx + g.w / 2 - head.width / 2, mastTopY - head.height + 4);

    if (goalState === 'active') {
      // Beam column
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const pulse = 0.5 + 0.5 * Math.sin(time * 4);
      const grad = ctx.createLinearGradient(0, mastTopY - 40, 0, sy + g.h);
      grad.addColorStop(0, `rgba(255,226,170,${0.5 + pulse * 0.2})`);
      grad.addColorStop(1, 'rgba(120,232,208,0.05)');
      ctx.fillStyle = grad;
      ctx.fillRect(sx + g.w / 2 - 14, mastTopY - 40, 28, g.h + 60);
      // Expanding rings
      const ringT = (time * 0.9) % 1;
      ctx.globalAlpha = (1 - ringT) * 0.6;
      ctx.strokeStyle = '#9df5e6';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx + g.w / 2, mastTopY, 8 + ringT * 90, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    } else {
      // Idle: dim warm beacon so the player can see where to go
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const pulse = 0.5 + 0.5 * Math.sin(time * 2.2);
      ctx.globalAlpha = 0.12 + pulse * 0.10;
      ctx.fillStyle = '#f79a45';
      ctx.beginPath();
      ctx.arc(sx + g.w / 2, mastTopY + 4, 16 + pulse * 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  drawSecretMarkers(level, cam) {
    // Visible only when close: a subtle etched glyph near a secret entrance.
    for (const s of level.secrets) {
      if (s.found) continue;
      const d = Math.abs(s.x - (cam.renderX + this.viewW / 2));
      if (d > 200) continue;
      const a = Math.max(0, 1 - d / 200) * 0.35;
      const ctx = this.ctx;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = '#63d3c2';
      const px = Math.round(s.x - cam.renderX);
      const py = Math.round(s.y - cam.renderY);
      // small diamond glyph
      ctx.fillRect(px, py - 2, 1, 5);
      ctx.fillRect(px - 2, py, 5, 1);
      ctx.fillRect(px - 1, py - 1, 3, 3);
      ctx.restore();
    }
  }
}

// ── helpers ──
function mkCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.floor(w));
  c.height = Math.max(1, Math.floor(h));
  return c;
}
function mulberry(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export { drawSprite, drawSpriteCentered };
