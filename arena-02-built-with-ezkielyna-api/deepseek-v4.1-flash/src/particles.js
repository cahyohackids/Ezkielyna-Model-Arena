// particles.js — fixed-size pooled particle system.
// Types are drawn as small pixel-quads/shapes with additive or normal blending.
// Pooled to avoid per-frame allocation and GC hitches.

const MAX = 520;

// Particle kinds and how they're drawn.
export const P = {
  DUST: 0,      // soft square puff, fades
  SPARK: 1,     // tiny bright line/square
  CHIP: 2,      // tumbling debris square (rotates)
  RING: 3,      // expanding hollow ring outline
  GLOW: 4,      // soft round glow dot, additive
  TRAIL: 5,     // dash afterimage rectangle
  STAR: 6,      // 4-point twinkle
};

export class ParticleSystem {
  constructor() {
    this.count = 0;
    // Structure-of-arrays style for cache friendliness & simplicity.
    this.x = new Float32Array(MAX);
    this.y = new Float32Array(MAX);
    this.vx = new Float32Array(MAX);
    this.vy = new Float32Array(MAX);
    this.life = new Float32Array(MAX);
    this.maxLife = new Float32Array(MAX);
    this.size = new Float32Array(MAX);
    this.grow = new Float32Array(MAX);
    this.grav = new Float32Array(MAX);
    this.drag = new Float32Array(MAX);
    this.rot = new Float32Array(MAX);
    this.vrot = new Float32Array(MAX);
    this.r = new Uint8Array(MAX);
    this.g = new Uint8Array(MAX);
    this.b = new Uint8Array(MAX);
    this.kind = new Uint8Array(MAX);
    this.additive = new Uint8Array(MAX);
    this.active = new Uint8Array(MAX);
    this._free = [];
    for (let i = MAX - 1; i >= 0; i--) this._free.push(i);
    // Toggled by the settings screen: simplifies rings/glows into flat dots.
    this.reducedMotion = false;
    this.ambient = [];
  }

  clear() {
    for (let i = 0; i < MAX; i++) { this.active[i] = 0; }
    this.count = 0;
    this._free.length = 0;
    for (let i = MAX - 1; i >= 0; i--) this._free.push(i);
    this.ambient.length = 0;
  }

  _alloc() {
    if (this._free.length === 0) {
      // Recycle the oldest-ish: just steal index 0 rotation to keep visuals alive.
      let oldest = 0, worst = Infinity;
      for (let i = 0; i < MAX; i++) {
        const rem = this.life[i];
        if (rem < worst) { worst = rem; oldest = i; }
      }
      this.active[oldest] = 0;
      return oldest;
    }
    const i = this._free.pop();
    this.active[i] = 1;
    this.count++;
    return i;
  }

  spawn(opts) {
    const i = this._alloc();
    this.x[i] = opts.x; this.y[i] = opts.y;
    this.vx[i] = opts.vx || 0; this.vy[i] = opts.vy || 0;
    const l = opts.life ?? 0.5;
    this.life[i] = l; this.maxLife[i] = l;
    this.size[i] = opts.size ?? 2;
    this.grow[i] = opts.grow ?? 0;
    this.grav[i] = opts.grav ?? 0;
    this.drag[i] = opts.drag ?? 2.5;
    this.rot[i] = opts.rot ?? 0;
    this.vrot[i] = opts.vrot ?? 0;
    const c = opts.color || [255, 255, 255];
    this.r[i] = c[0]; this.g[i] = c[1]; this.b[i] = c[2];
    this.kind[i] = opts.kind ?? P.DUST;
    this.additive[i] = opts.additive ? 1 : 0;
    return i;
  }

  // ---------- Named burst helpers (game-feel recipes) ----------

  runDust(x, y, dir) {
    this.spawn({
      x: x + (Math.random() - 0.5) * 3, y: y - 1,
      vx: -dir * (8 + Math.random() * 16) + (Math.random() - 0.5) * 8,
      vy: -(6 + Math.random() * 16),
      life: 0.28 + Math.random() * 0.2, size: 1 + Math.random() * 1.6,
      grav: 24, drag: 4, color: [148, 168, 190], kind: P.DUST,
    });
  }

  jumpPuff(x, y) {
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI;
      this.spawn({
        x, y,
        vx: Math.cos(a) * (14 + Math.random() * 22) * (Math.random() < 0.5 ? -1 : 1),
        vy: -Math.random() * 14,
        life: 0.26 + Math.random() * 0.16, size: 1.5 + Math.random() * 1.8,
        grav: 18, drag: 5, color: [176, 196, 214], kind: P.DUST,
      });
    }
  }

  landDust(x, y, strength) {
    const n = 5 + Math.floor(strength * 7);
    for (let i = 0; i < n; i++) {
      const side = Math.random() < 0.5 ? -1 : 1;
      this.spawn({
        x: x + side * (2 + Math.random() * 5), y: y - 1,
        vx: side * (22 + Math.random() * 46) * (0.5 + strength * 0.6),
        vy: -(4 + Math.random() * 20),
        life: 0.24 + Math.random() * 0.26, size: 1.4 + Math.random() * 2,
        grav: 44, drag: 4.2, color: [186, 204, 220], kind: P.DUST,
      });
    }
    this.spawn({
      x, y: y - 1, vx: 0, vy: 0, life: 0.22, size: 5, grow: 34, drag: 6,
      color: [200, 216, 232], kind: P.RING,
    });
  }

  dashTrail(x, y, w, h, dir) {
    this.spawn({
      x, y, vx: -dir * 12, vy: 0.6,
      life: 0.22, size: 3, grow: 0,
      color: [247, 154, 69], kind: P.TRAIL, drag: 3,
      rot: w, vrot: h,
    });
    for (let i = 0; i < 3; i++) {
      this.spawn({
        x: x + (Math.random() - 0.5) * 8, y: y + (Math.random() - 0.5) * 10,
        vx: -dir * (30 + Math.random() * 60), vy: (Math.random() - 0.5) * 18,
        life: 0.14 + Math.random() * 0.16, size: 1 + Math.random() * 1.5,
        drag: 9, color: [247, 154, 69], kind: P.SPARK, additive: true,
      });
    }
  }

  dashBurst(x, y, dir) {
    for (let i = 0; i < 10; i++) {
      const a = (Math.random() - 0.5) * 1.1;
      this.spawn({
        x: x - dir * 4, y: y + (Math.random() - 0.5) * 12,
        vx: -dir * (60 + Math.random() * 90) * Math.cos(a),
        vy: Math.sin(a) * 40,
        life: 0.2 + Math.random() * 0.22, size: 1.5 + Math.random() * 2,
        drag: 6, color: [255, 214, 150], kind: P.SPARK, additive: true,
      });
    }
    this.spawn({
      x: x - dir * 3, y, vx: 0, vy: 0, life: 0.2, size: 4, grow: 46, drag: 8,
      color: [247, 154, 69], kind: P.RING, additive: true,
    });
  }

  pickup(x, y) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.random() * 0.4;
      const sp = 22 + Math.random() * 34;
      this.spawn({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 10,
        life: 0.28 + Math.random() * 0.2, size: 1.4 + Math.random() * 1.6,
        drag: 5.5, grav: 22, color: i % 2 ? [255, 226, 170] : [120, 232, 208],
        kind: P.STAR, additive: true,
      });
    }
    this.spawn({ x, y, vx: 0, vy: -3, life: 0.26, size: 3, grow: 40, drag: 7, color: [150, 240, 220], kind: P.RING, additive: true });
  }

  corePickup(x, y) {
    for (let i = 0; i < 22; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 30 + Math.random() * 90;
      this.spawn({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 18,
        life: 0.5 + Math.random() * 0.5, size: 1.5 + Math.random() * 2.4,
        drag: 2.4, grav: 26,
        color: i % 3 === 0 ? [255, 236, 190] : i % 3 === 1 ? [255, 168, 84] : [120, 232, 208],
        kind: i % 4 === 0 ? P.STAR : P.SPARK, additive: true,
      });
    }
    this.spawn({ x, y, vx: 0, vy: 0, life: 0.5, size: 6, grow: 80, drag: 5, color: [255, 200, 130], kind: P.RING, additive: true });
    this.spawn({ x, y, vx: 0, vy: 0, life: 0.7, size: 10, grow: 44, drag: 4, color: [120, 232, 208], kind: P.RING, additive: true });
  }

  enemyPop(x, y, color) {
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 26 + Math.random() * 80;
      this.spawn({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 24,
        life: 0.34 + Math.random() * 0.36, size: 1.6 + Math.random() * 2.4,
        grav: 150, drag: 2.2, vrot: (Math.random() - 0.5) * 14,
        color, kind: i % 3 === 0 ? P.CHIP : P.SPARK,
      });
    }
    this.spawn({ x, y, vx: 0, vy: 0, life: 0.26, size: 5, grow: 54, drag: 7, color, kind: P.RING });
  }

  hurtBurst(x, y) {
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 30 + Math.random() * 70;
      this.spawn({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 20,
        life: 0.3 + Math.random() * 0.3, size: 1.5 + Math.random() * 2,
        grav: 120, drag: 3, color: i % 2 ? [240, 96, 96] : [255, 190, 120],
        kind: P.SPARK,
      });
    }
  }

  deathBurst(x, y) {
    for (let i = 0; i < 30; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 20 + Math.random() * 110;
      this.spawn({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40,
        life: 0.7 + Math.random() * 0.9, size: 1.5 + Math.random() * 2.6,
        grav: 90, drag: 1.6, vrot: (Math.random() - 0.5) * 18,
        color: i % 3 === 0 ? [255, 226, 190] : i % 3 === 1 ? [63, 184, 168] : [232, 121, 47],
        kind: i % 4 === 0 ? P.STAR : P.CHIP, additive: i % 4 === 0,
      });
    }
    this.spawn({ x, y, vx: 0, vy: 0, life: 0.6, size: 8, grow: 120, drag: 4, color: [120, 232, 208], kind: P.RING, additive: true });
  }

  checkpointBurst(x, y) {
    for (let i = 0; i < 20; i++) {
      const a = Math.random() * Math.PI - Math.PI;
      this.spawn({
        x: x + (Math.random() - 0.5) * 10, y,
        vx: Math.cos(a) * 20 + (Math.random() - 0.5) * 20,
        vy: -(30 + Math.random() * 90),
        life: 0.5 + Math.random() * 0.6, size: 1.4 + Math.random() * 2,
        grav: 60, drag: 1.4, color: i % 2 ? [120, 232, 208] : [255, 226, 170],
        kind: i % 3 === 0 ? P.STAR : P.SPARK, additive: true,
      });
    }
    this.spawn({ x, y: y - 6, vx: 0, vy: 0, life: 0.5, size: 6, grow: 70, drag: 6, color: [120, 232, 208], kind: P.RING, additive: true });
  }

  bounceBurst(x, y) {
    for (let i = 0; i < 12; i++) {
      this.spawn({
        x: x + (Math.random() - 0.5) * 18, y: y - 2,
        vx: (Math.random() - 0.5) * 70,
        vy: -(70 + Math.random() * 120),
        life: 0.3 + Math.random() * 0.3, size: 1.4 + Math.random() * 2,
        grav: 200, drag: 1.2, color: [120, 232, 208], kind: P.SPARK, additive: true,
      });
    }
    this.spawn({ x, y: y - 4, vx: 0, vy: 0, life: 0.24, size: 5, grow: 50, drag: 7, color: [255, 226, 170], kind: P.RING, additive: true });
  }

  towerBeam(x, y, t) {
    // Emitted continuously while the tower charges.
    const a = Math.random() * Math.PI * 2;
    this.spawn({
      x: x + Math.cos(a) * (6 + Math.random() * 30),
      y: y + Math.sin(a) * (6 + Math.random() * 30) - 20,
      vx: Math.cos(a) * 10, vy: -60 - Math.random() * 140,
      life: 0.5 + Math.random() * 0.6, size: 1.2 + Math.random() * 2.2,
      drag: 0.8, color: Math.random() < 0.6 ? [255, 226, 170] : [120, 232, 208],
      kind: P.SPARK, additive: true,
    });
  }

  ambientMote(x, y, color, speed = 8) {
    this.spawn({
      x, y,
      vx: (Math.random() - 0.5) * speed * 1.5,
      vy: -speed * (0.4 + Math.random() * 0.9),
      life: 2.2 + Math.random() * 2.4, size: 0.9 + Math.random() * 1.2,
      drag: 0.15, color, kind: P.GLOW, additive: true,
    });
  }

  rainDrop(x, y) {
    this.spawn({
      x, y, vx: -14, vy: 150 + Math.random() * 90,
      life: 0.75, size: 2, drag: 0.1, color: [110, 145, 190], kind: P.SPARK,
    });
  }

  update(dt) {
    for (let i = 0; i < MAX; i++) {
      if (!this.active[i]) continue;
      let l = this.life[i] - dt;
      if (l <= 0) {
        this.active[i] = 0;
        this.count--;
        this._free.push(i);
        continue;
      }
      this.life[i] = l;
      const d = Math.exp(-this.drag[i] * dt);
      this.vx[i] *= d;
      this.vy[i] = this.vy[i] * d + this.grav[i] * dt;
      this.x[i] += this.vx[i] * dt;
      this.y[i] += this.vy[i] * dt;
      this.rot[i] += this.vrot[i] * dt;
      if (this.grow[i]) this.size[i] += this.grow[i] * dt;
    }
  }

  /** Draw all active particles. `cam` provides the world->screen offset. */
  draw(ctx, cam) {
    const camX = Math.round(cam.renderX);
    const camY = Math.round(cam.renderY);
    const reducedMotion = this.reducedMotion;
    ctx.save();
    for (let i = 0; i < MAX; i++) {
      if (!this.active[i]) continue;
      const tLife = this.life[i] / this.maxLife[i];
      const alpha = Math.min(1, tLife * 1.6);
      const kind = this.kind[i];
      const px = Math.round(this.x[i] - camX);
      const py = Math.round(this.y[i] - camY);
      const col = `rgba(${this.r[i]},${this.g[i]},${this.b[i]},${alpha.toFixed(3)})`;

      if (this.additive[i]) ctx.globalCompositeOperation = 'lighter';
      else ctx.globalCompositeOperation = 'source-over';

      if (reducedMotion && (kind === P.GLOW || kind === P.RING)) {
        // Simplify: draw as a dot
        ctx.fillStyle = col;
        ctx.fillRect(px, py, 2, 2);
        continue;
      }

      switch (kind) {
        case P.DUST: {
          const s = Math.max(1, Math.round(this.size[i]));
          ctx.fillStyle = col;
          ctx.fillRect(px, py, s, s);
          break;
        }
        case P.SPARK: {
          const s = Math.max(1, Math.round(this.size[i]));
          ctx.fillStyle = col;
          if (s <= 1) ctx.fillRect(px, py, 1, 1);
          else {
            ctx.fillRect(px, py, s, s);
            ctx.fillRect(px - 1, py, 1, s);
            ctx.fillRect(px + s, py, 1, s);
            ctx.fillRect(px, py - 1, s, 1);
            ctx.fillRect(px, py + s, s, 1);
          }
          break;
        }
        case P.CHIP: {
          const s = Math.max(1, Math.round(this.size[i]));
          ctx.save();
          ctx.translate(px + s / 2, py + s / 2);
          ctx.rotate(this.rot[i]);
          ctx.fillStyle = col;
          ctx.fillRect(-s / 2, -s / 2, s, s);
          ctx.restore();
          break;
        }
        case P.RING: {
          const s = Math.max(2, Math.round(this.size[i]));
          ctx.strokeStyle = col;
          ctx.lineWidth = Math.max(1, 2 * tLife);
          ctx.strokeRect(px - s, py - s, s * 2, s * 2);
          break;
        }
        case P.GLOW: {
          const s = Math.max(1, Math.round(this.size[i]));
          ctx.fillStyle = col;
          ctx.fillRect(px, py, s, s);
          ctx.globalAlpha = alpha * 0.35;
          ctx.fillRect(px - s, py, s * 3, s);
          ctx.fillRect(px, py - s, s, s * 3);
          ctx.globalAlpha = 1;
          break;
        }
        case P.TRAIL: {
          // rot = half-width, vrot = half-height (reused fields)
          const hw = this.rot[i], hh = this.vrot[i];
          ctx.fillStyle = `rgba(${this.r[i]},${this.g[i]},${this.b[i]},${(alpha * 0.5).toFixed(3)})`;
          ctx.fillRect(px - hw, py - hh, hw * 2, hh * 2);
          break;
        }
        case P.STAR: {
          const s = Math.max(1, Math.round(this.size[i]));
          ctx.fillStyle = col;
          ctx.fillRect(px - s, py, s * 3, s);
          ctx.fillRect(px, py - s, s, s * 3);
          break;
        }
      }
    }
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }
}
