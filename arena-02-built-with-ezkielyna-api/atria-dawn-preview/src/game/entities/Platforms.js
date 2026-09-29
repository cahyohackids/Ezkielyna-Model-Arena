import { Entity } from './Entity.js';
import { drawTile, drawBouncePad } from '../../core/Renderer.js';
import { TILE } from '../levels.js';

// Moving platform: travels along a horizontal or vertical axis between its
// spawn point and (spawn + travel * TILE). Carries the player.
export class MovingPlatform extends Entity {
  constructor(x, y, travelX, travelY, period) {
    super(x, y, TILE * 2, TILE * 0.75);
    this.startX = x;
    this.startY = y;
    this.travelX = travelX * TILE;
    this.travelY = travelY * TILE;
    this.period = Math.max(0.6, period || 3);
    this.t = 0;
    this.prevX = x;
    this.prevY = y;
    this.dx = 0;
    this.dy = 0;
    this.solid = true;
  }

  update(dt) {
    this.prevX = this.x;
    this.prevY = this.y;
    this.t += dt;
    // triangle wave with smoothstep easing for ease-in/out motion
    const phase = (this.t % this.period) / this.period;
    const wave = phase < 0.5 ? phase * 2 : 2 - phase * 2;
    const eased = wave * wave * (3 - 2 * wave);
    this.x = this.startX + this.travelX * eased;
    this.y = this.startY + this.travelY * eased;
    this.dx = this.x - this.prevX;
    this.dy = this.y - this.prevY;
  }

  render(ctx, cam, time) {
    drawTile(ctx, this.x - cam.x - cam.shakeOX, this.y - cam.y - cam.shakeOY, this.w, 'metal', time, 7);
    const on = Math.sin(time * 4) > 0;
    ctx.fillStyle = on ? '#3fd2c5' : '#1c635d';
    ctx.fillRect(this.x - cam.x - cam.shakeOX + 2, this.y - cam.y - cam.shakeOY + 2, 2, 2);
    ctx.fillRect(this.x - cam.x - cam.shakeOX + this.w - 4, this.y - cam.y - cam.shakeOY + 2, 2, 2);
  }
}

// Falling platform: shakes briefly when stepped on, then drops and respawns.
export class FallingPlatform extends Entity {
  constructor(x, y) {
    super(x, y, TILE, TILE);
    this.state = 'idle'; // idle | shake | fall | respawn
    this.timer = 0;
    this.shakeDur = 0.55;
    this.fallTime = 0;
    this.respawnTime = 2.2;
    this.startX = x;
    this.startY = y;
    this.solid = true;
  }

  trigger() {
    if (this.state === 'idle') {
      this.state = 'shake';
      this.timer = 0;
    }
  }

  update(dt) {
    this.timer += dt;
    if (this.state === 'shake') {
      if (this.timer >= this.shakeDur) { this.state = 'fall'; this.timer = 0; }
    } else if (this.state === 'fall') {
      this.fallTime += dt;
      this.y += (60 + this.fallTime * 260) * dt;
      if (this.y > this.startY + 240 || this.fallTime > 2.5) {
        this.state = 'respawn';
        this.timer = 0;
        this.solid = false;
      }
    } else if (this.state === 'respawn') {
      if (this.timer >= this.respawnTime) {
        this.state = 'idle';
        this.solid = true;
        this.x = this.startX;
        this.y = this.startY;
        this.fallTime = 0;
      }
    }
  }

  render(ctx, cam, time) {
    if (this.state === 'respawn') return;
    let ox = 0;
    if (this.state === 'shake') ox = Math.sin(this.timer * 60) * 1.5;
    const alpha = this.state === 'fall' ? Math.max(0.2, 1 - this.fallTime / 2.5) : 1;
    ctx.globalAlpha = alpha;
    drawTile(ctx, this.x - cam.x - cam.shakeOX + ox, this.y - cam.y - cam.shakeOY, TILE, 'falling', time, 3);
    ctx.globalAlpha = 1;
  }
}

// Phase platform: appears/disappears on a predictable rhythm.
export class PhasePlatform extends Entity {
  constructor(x, y, period, offset, onFrac) {
    super(x, y, TILE, TILE * 0.75);
    this.period = Math.max(0.8, period || 2.4);
    this.offset = offset || 0;
    this.onFrac = onFrac == null ? 0.5 : onFrac;
    this.solid = false;
    this.phase = 0;
  }

  update(dt) {
    this.t += dt;
    const t = (this.t + this.offset) % this.period / this.period;
    this.phase = t;
    this.solid = t < this.onFrac;
  }

  render(ctx, cam, time) {
    const t = (this.t + this.offset) % this.period / this.period;
    const on = t < this.onFrac;
    const fade = on
      ? (t < 0.1 ? t / 0.1 : 1)
      : (t < this.onFrac + 0.12 ? 1 - (t - this.onFrac) / 0.12 : 0);
    if (fade <= 0.01) {
      // ghost outline so the player can still read the rhythm
      ctx.globalAlpha = 0.15;
      drawTile(ctx, this.x - cam.x - cam.shakeOX, this.y - cam.y - cam.shakeOY, this.w, 'phase', time, 5);
      ctx.globalAlpha = 1;
      return;
    }
    ctx.globalAlpha = fade;
    drawTile(ctx, this.x - cam.x - cam.shakeOX, this.y - cam.y - cam.shakeOY, this.w, 'phase', time, 5);
    ctx.globalAlpha = 1;
  }
}

// Bounce pad: launches the player upward when landed on.
export class BouncePad extends Entity {
  constructor(x, y) {
    super(x, y, TILE, 12);
    this.compress = 0;
    this.bouncePower = -560;
    this.solid = true;
  }

  bounce() { this.compress = 1; }

  update(dt) { this.compress = Math.max(0, this.compress - dt * 5); }

  render(ctx, cam, time) {
    drawBouncePad(ctx, this.x - cam.x - cam.shakeOX, this.y - cam.y - cam.shakeOY, time, this.compress);
  }
}
