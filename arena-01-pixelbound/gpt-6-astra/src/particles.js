export class ParticleSystem {
  constructor() { this.items = []; }
  burst(x, y, color, count = 12, speed = 110, gravity = 260) {
    for (let i = 0; i < count && this.items.length < 230; i++) {
      const a = Math.random() * Math.PI * 2, power = speed * (.25 + Math.random() * .75);
      const life = .3 + Math.random() * .4;
      this.items.push({ x, y, vx: Math.cos(a) * power, vy: Math.sin(a) * power - speed * .25, life, max: life, color, size: Math.random() > .7 ? 3 : 2, gravity });
    }
  }
  update(dt) { for (let i = this.items.length - 1; i >= 0; i--) { const p = this.items[i]; p.life -= dt; if (p.life <= 0) { this.items.splice(i, 1); continue; } p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.gravity * dt; } }
  draw(ctx) { for (const p of this.items) { ctx.globalAlpha = Math.min(1, p.life / p.max * 2); ctx.fillStyle = p.color; ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size); } ctx.globalAlpha = 1; }
  clear() { this.items.length = 0; }
}
