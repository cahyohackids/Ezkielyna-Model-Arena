// ParticleSystem: lightweight pooled particles for feedback.

import { rand, clamp } from './utils.js';

export class ParticleSystem {
  constructor(max = 400) {
    this.max = max;
    this.reducedMotion = false;
    this.pool = [];
    for (let i = 0; i < max; i++) {
      this.pool.push({
        x: 0, y: 0, vx: 0, vy: 0,
        life: 0, maxLife: 0, size: 2, color: '#fff',
        gravity: 0, drag: 0.98, active: false, type: 'square',
        grow: 0, alpha: 1,
      });
    }
    this.idx = 0;
  }

  spawn(opts) {
    const p = this.pool[this.idx];
    this.idx = (this.idx + 1) % this.max;
    p.active = true;
    p.x = opts.x; p.y = opts.y;
    p.vx = opts.vx ?? 0; p.vy = opts.vy ?? 0;
    p.maxLife = opts.life ?? 0.5;
    p.life = p.maxLife;
    p.size = opts.size ?? 2;
    p.color = opts.color ?? '#fff';
    p.gravity = opts.gravity ?? 0;
    p.drag = opts.drag ?? 0.98;
    p.type = opts.type ?? 'square';
    p.grow = opts.grow ?? 0;
    p.alpha = opts.alpha ?? 1;
    return p;
  }

  burst(x, y, n, opts = {}) {
    if (this.reducedMotion) n = Math.max(1, Math.floor(n * 0.35));
    for (let i = 0; i < n; i++) {
      const speed = rand(opts.speedMin ?? 20, opts.speedMax ?? 120);
      const ang = rand(0, Math.PI * 2);
      this.spawn({
        x: x + rand(-4, 4), y: y + rand(-4, 4),
        vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed - (opts.upBias ?? 0),
        life: rand(0.25, opts.lifeMax ?? 0.6),
        size: rand(1.5, opts.sizeMax ?? 3),
        color: opts.color ?? '#7fe7ff',
        gravity: opts.gravity ?? 300,
        drag: opts.drag ?? 0.96,
        type: opts.type ?? 'square',
      });
    }
  }

  dust(x, y, dir) {
    if (this.reducedMotion && Math.random() < 0.6) return;
    this.spawn({
      x, y: y - 2,
      vx: -dir * rand(10, 40), vy: rand(-30, -5),
      life: rand(0.2, 0.4), size: rand(1.5, 3),
      color: '#8ba0c4', gravity: 120, drag: 0.94,
    });
  }

  update(dt) {
    for (const p of this.pool) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      p.vy += p.gravity * dt;
      p.vx *= p.drag;
      p.vy *= p.drag;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.grow) p.size += p.grow * dt;
    }
  }

  draw(ctx) {
    for (const p of this.pool) {
      if (!p.active) continue;
      const a = clamp(p.life / p.maxLife, 0, 1);
      ctx.globalAlpha = a * p.alpha;
      ctx.fillStyle = p.color;
      const s = p.size;
      const px = p.x;
      const py = p.y;
      if (p.type === 'circle') {
        ctx.beginPath();
        ctx.arc(px, py, s / 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'spark') {
        ctx.fillRect(px, py, s, s * 0.5);
      } else {
        ctx.fillRect(px - s / 2, py - s / 2, s, s);
      }
    }
    ctx.globalAlpha = 1;
  }

  clear() {
    for (const p of this.pool) p.active = false;
  }
}
