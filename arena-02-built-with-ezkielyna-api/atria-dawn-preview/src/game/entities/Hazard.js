import { Entity } from './Entity.js';
import { drawSpike, drawEnergyPit, drawLaser } from '../../core/Renderer.js';
import { TILE } from '../levels.js';

// Spike strip: static hazard on the ground (points up).
export class Spike extends Entity {
  constructor(x, y, count) {
    super(x, y, count * TILE, 8);
    // hit area slightly smaller than the visual so it feels fair
    this.hit = { x: x + 2, y: y + 2, w: count * TILE - 4, h: 6 };
  }
  update() {}
  render(ctx, cam, time) {
    drawSpike(ctx, this.x - cam.x - cam.shakeOX, this.y - cam.y - cam.shakeOY, this.w, time);
  }
}

// Energy pit: hazardous floor strip.
export class EnergyPit extends Entity {
  constructor(x, y, count) {
    super(x, y, count * TILE, 8);
    this.hit = { x: x, y: y + 1, w: count * TILE, h: 6 };
  }
  update() {}
  render(ctx, cam, time) {
    drawEnergyPit(ctx, this.x - cam.x - cam.shakeOX, this.y - cam.y - cam.shakeOY, this.w, time);
  }
}

// Laser: pulses on/off on a rhythm. Can be horizontal or vertical.
export class Laser extends Entity {
  constructor(x, y, length, period, offset, vertical) {
    super(x, y, vertical ? 8 : length, vertical ? length : 8);
    this.length = length;
    this.period = Math.max(0.5, period);
    this.offset = offset || 0;
    this.vertical = vertical;
    this.on = false;
    this.t = 0;
    // damage hit area only when on
    this.hit = { x: 0, y: 0, w: 0, h: 0 };
    this._updateHit();
  }
  _updateHit() {
    if (this.vertical) {
      this.hit = { x: this.x + 2, y: this.y, w: 4, h: this.length };
    } else {
      this.hit = { x: this.x, y: this.y + 2, w: this.length, h: 4 };
    }
  }
  update(dt) {
    this.t += dt;
    const phase = ((this.t + this.offset) % this.period) / this.period;
    this.on = phase < 0.55;
    this._updateHit();
  }
  render(ctx, cam, time) {
    drawLaser(ctx, this.x - cam.x - cam.shakeOX, this.y - cam.y - cam.shakeOY, this.length, this.on, time, this.vertical);
  }
}
