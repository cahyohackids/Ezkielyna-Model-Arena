import { Entity } from './Entity.js';
import { drawBit, drawCore, PAL } from '../../core/Renderer.js';

// Signal Bit: main collectible. Spins, floats, glows softly.
export class Bit extends Entity {
  constructor(x, y) {
    super(x - 4, y - 4, 8, 8);
    this.bob = Math.random() * Math.PI * 2;
    this.collected = false;
    this.collectT = 0;
  }

  update(dt, time) {
    if (this.collected) this.collectT += dt;
  }

  render(ctx, cam, time) {
    if (this.collected) return;
    const bob = Math.sin(time * 3 + this.bob) * 1.5;
    drawBit(ctx, this.x - cam.x - cam.shakeOX + 4, this.y - cam.y - cam.shakeOY + 4 + bob, time + this.bob);
  }
}

// Data Core: rare hidden collectible, 3 per level.
export class DataCore extends Entity {
  constructor(x, y) {
    super(x - 6, y - 6, 12, 12);
    this.bob = Math.random() * Math.PI * 2;
    this.collected = false;
  }

  update(dt, time) {
    if (this.collected) this.collectT = (this.collectT || 0) + dt;
  }

  render(ctx, cam, time) {
    if (this.collected) return;
    const bob = Math.sin(time * 2.4 + this.bob) * 2;
    // soft glow halo (restrained)
    const pulse = (Math.sin(time * 2 + this.bob) + 1) / 2;
    ctx.fillStyle = PAL.orange;
    ctx.globalAlpha = 0.12 + pulse * 0.1;
    ctx.beginPath();
    ctx.arc(this.x - cam.x - cam.shakeOX + 6, this.y - cam.y - cam.shakeOY + 6 + bob, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    drawCore(ctx, this.x - cam.x - cam.shakeOX + 6, this.y - cam.y - cam.shakeOY + 6 + bob, time + this.bob);
  }
}
