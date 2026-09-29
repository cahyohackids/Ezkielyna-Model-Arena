// Lightweight pooled particle system. Particles are plain objects in a
// fixed-capacity array; no allocation happens per frame after warmup.

export class ParticleSystem {
  constructor(capacity = 420) {
    this.capacity = capacity;
    this.particles = new Array(capacity);
    for (let i = 0; i < capacity; i++) {
      this.particles[i] = { active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 2, color: '#fff', gravity: 0, drag: 1, shape: 0, rot: 0, vrot: 0 };
    }
    this.cursor = 0;
  }

  _spawn() {
    // round-robin with a search fallback so bursts don't overwrite each other
    for (let i = 0; i < this.capacity; i++) {
      const idx = (this.cursor + i) % this.capacity;
      if (!this.particles[idx].active) {
        this.cursor = (idx + 1) % this.capacity;
        return this.particles[idx];
      }
    }
    this.cursor = (this.cursor + 1) % this.capacity;
    return this.particles[this.cursor];
  }

  emit(opts) {
    const p = this._spawn();
    p.active = true;
    p.x = opts.x; p.y = opts.y;
    p.vx = opts.vx || 0; p.vy = opts.vy || 0;
    p.life = p.max = opts.life || 0.5;
    p.size = opts.size || 2;
    p.color = opts.color || '#f2ead9';
    p.gravity = opts.gravity != null ? opts.gravity : 220;
    p.drag = opts.drag != null ? opts.drag : 0.92;
    p.shape = opts.shape || 0; // 0 square, 1 circle
    p.rot = opts.rot || 0;
    p.vrot = opts.vrot || 0;
    return p;
  }

  burst(x, y, count, opts) {
    const spread = opts.spread || Math.PI * 2;
    const base = opts.angle != null ? opts.angle : 0;
    const speed = opts.speed || 60;
    const speedVar = opts.speedVar != null ? opts.speedVar : speed * 0.5;
    for (let i = 0; i < count; i++) {
      const a = base + (Math.random() - 0.5) * spread;
      const s = speed + (Math.random() * 2 - 1) * speedVar;
      this.emit(Object.assign({}, opts, {
        x: x + (Math.random() - 0.5) * (opts.jitter || 0),
        y: y + (Math.random() - 0.5) * (opts.jitter || 0),
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
      }));
    }
  }

  update(dt) {
    const list = this.particles;
    for (let i = 0; i < this.capacity; i++) {
      const p = list[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      p.vy += p.gravity * dt;
      p.vx *= Math.pow(p.drag, dt * 60);
      p.vy *= Math.pow(p.drag, dt * 60);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vrot * dt;
    }
  }

  render(ctx, cam) {
    const list = this.particles;
    for (let i = 0; i < this.capacity; i++) {
      const p = list[i];
      if (!p.active) continue;
      const sx = Math.round(p.x - cam.x - cam.shakeOX);
      const sy = Math.round(p.y - cam.y - cam.shakeOY);
      if (sx < -8 || sy < -8 || sx > cam.viewW + 8 || sy > cam.viewH + 8) continue;
      const t = p.life / p.max;
      ctx.globalAlpha = t < 0.35 ? t / 0.35 : 1;
      ctx.fillStyle = p.color;
      const s = p.size * (0.6 + 0.4 * t);
      if (p.shape === 1) {
        ctx.beginPath();
        ctx.arc(sx + s / 2, sy + s / 2, s / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(sx, sy, s, s);
      }
    }
    ctx.globalAlpha = 1;
  }

  clear() {
    for (let i = 0; i < this.capacity; i++) this.particles[i].active = false;
  }
}
