// Parallax background layers. Each theme has 3 distant layers + ambient
// floating particles. Everything is procedural and deterministic per level.

import { PAL, drawBgTree, drawBgTower } from '../core/Renderer.js';
import { hash2 } from '../core/mathUtils.js';

export class Background {
  constructor(theme) {
    this.theme = theme;
    this.t = 0;
    this._build();
  }

  _build() {
    const r = (i) => hash2(i * 977, this.theme.length * 13);
    this.stars = [];
    for (let i = 0; i < 70; i++) {
      this.stars.push({ x: r(i) * 2, y: r(i + 500) * 2, s: r(i + 900) > 0.8 ? 2 : 1, layer: r(i + 300) > 0.5 ? 0 : 1 });
    }
    // far skyline silhouettes
    this.skyline = [];
    for (let i = 0; i < 26; i++) {
      this.skyline.push({
        x: i * 60 + r(i + 21) * 24,
        w: 24 + r(i + 42) * 30,
        h: 40 + r(i + 63) * 90,
        layer: i % 2,
      });
    }
    // midground trees / structures
    this.mid = [];
    for (let i = 0; i < 40; i++) {
      this.mid.push({
        x: i * 46 + r(i + 101) * 30,
        y: 0,
        scale: 1 + r(i + 202) * 1.6,
        kind: r(i + 303) > 0.35 ? 'tree' : 'tower',
        layer: i % 2,
      });
    }
    // ambient drifting motes
    this.motes = [];
    for (let i = 0; i < 36; i++) {
      this.motes.push({
        x: r(i + 4000),
        y: r(i + 5000),
        vx: (r(i + 6000) - 0.5) * 8,
        vy: (r(i + 7000) - 0.5) * 5,
        s: r(i + 8000) > 0.7 ? 2 : 1,
      });
    }
  }

  update(dt) {
    this.t += dt;
    for (const m of this.motes) {
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      if (m.x < 0) m.x += 1;
      if (m.x > 1) m.x -= 1;
      if (m.y < 0) m.y += 1;
      if (m.y > 1) m.y -= 1;
    }
  }

  render(ctx, cam, levelW, levelH) {
    const W = cam.viewW;
    const H = cam.viewH;
    const theme = this.theme;

    // ---- sky gradient (baked per frame is cheap enough at this size) ----
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    if (theme === 'meadow') {
      grad.addColorStop(0, '#101833');
      grad.addColorStop(0.55, '#1b2450');
      grad.addColorStop(1, '#243a63');
    } else if (theme === 'cave') {
      grad.addColorStop(0, '#0a0d1a');
      grad.addColorStop(0.6, '#0d1226');
      grad.addColorStop(1, '#111a33');
    } else {
      grad.addColorStop(0, '#140a1c');
      grad.addColorStop(0.5, '#1a1030');
      grad.addColorStop(1, '#241638');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // ---- stars / data motes (far) ----
    for (const s of this.stars) {
      const par = s.layer === 0 ? 0.08 : 0.16;
      const x = (s.x * levelW * 0.5 - cam.x * par) % (W + 40);
      const y = s.y * H * 0.6 - cam.y * par * 0.5;
      if (y < -4 || y > H * 0.75) continue;
      ctx.fillStyle = theme === 'glitch' ? PAL.danger : PAL.teal;
      ctx.globalAlpha = 0.35 + 0.25 * Math.sin(this.t * 2 + s.x * 40);
      ctx.fillRect((x + W + 40) % (W + 40) - 20, y, s.s, s.s);
    }
    ctx.globalAlpha = 1;

    // ---- distant skyline ----
    for (const b of this.skyline) {
      const par = b.layer === 0 ? 0.22 : 0.34;
      const baseY = H * 0.62;
      const x = b.x - cam.x * par;
      const wrapped = ((x % (W + 120)) + (W + 120)) % (W + 120) - 60;
      const y = baseY - b.h - cam.y * par * 0.3;
      ctx.fillStyle = theme === 'meadow' ? '#1a2148' : (theme === 'cave' ? '#131a30' : '#221334');
      ctx.fillRect(wrapped, y, b.w, b.h + 60);
      // a few lit windows
      ctx.fillStyle = PAL.tealDim;
      ctx.globalAlpha = 0.5;
      for (let i = 6; i < b.h - 6; i += 14) {
        if (hash2(b.x, i) > 0.6) ctx.fillRect(wrapped + b.w / 2 - 1, y + i, 2, 2);
      }
      ctx.globalAlpha = 1;
    }

    // ---- midground ----
    for (const m of this.mid) {
      const par = m.layer === 0 ? 0.5 : 0.68;
      const span = W + 160;
      const x = m.x * 46 - cam.x * par;
      const wrapped = ((x % span) + span) % span - 80;
      const groundY = H * 0.72 - cam.y * par * 0.5;
      if (m.kind === 'tree') {
        drawBgTree(ctx, wrapped, groundY - 10 * m.scale, m.scale, m.x);
      } else {
        ctx.fillStyle = theme === 'cave' ? '#182042' : '#1d2745';
        ctx.fillRect(wrapped, groundY - 26 * m.scale, 10 * m.scale, 26 * m.scale);
        ctx.fillStyle = PAL.tealDim;
        ctx.globalAlpha = 0.4;
        ctx.fillRect(wrapped + 3 * m.scale, groundY - 20 * m.scale, 2, 2);
        ctx.globalAlpha = 1;
      }
    }

    // ---- ambient motes (foreground-ish, slow) ----
    for (const m of this.motes) {
      const x = m.x * W - cam.x * 0.85;
      const y = m.y * H - cam.y * 0.85;
      const wrapped = ((x % (W + 20)) + (W + 20)) % (W + 20) - 10;
      ctx.fillStyle = theme === 'glitch' ? PAL.orange : PAL.teal;
      ctx.globalAlpha = 0.25;
      ctx.fillRect(wrapped, ((y % (H + 20)) + (H + 20)) % (H + 20) - 10, m.s, m.s);
    }
    ctx.globalAlpha = 1;

    // ---- theme vignette ----
    if (theme === 'cave') {
      const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.85);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(4,6,12,0.55)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);
    }
  }
}
