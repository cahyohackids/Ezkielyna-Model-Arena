import { Entity } from './Entity.js';
import { drawCheckpoint, drawTower, PAL } from '../../core/Renderer.js';

// Checkpoint terminal: activates when the player touches it, updates the
// respawn point and plays a small light-up animation.
export class Checkpoint extends Entity {
  constructor(x, y) {
    // 12x22 sprite; place so the base sits on the ground tile row
    super(x + 2, y, 12, 22);
    this.active = false;
    this.activateT = 0;
  }

  activate() {
    if (this.active) return false;
    this.active = true;
    this.activateT = 0;
    return true;
  }

  update(dt) { this.activateT += dt; }

  render(ctx, cam, time) {
    drawCheckpoint(ctx, this.x - cam.x - cam.shakeOX, this.y - cam.y - cam.shakeOY, this.active, time);
  }
}

// Signal tower: the level goal. Activating it triggers a phased animation and
// completes the level.
export class SignalTower extends Entity {
  constructor(x, y) {
    // 40x64 sprite; collision/trigger is the lower base
    super(x, y, 40, 64);
    this.active = false;
    this.activatePhase = 0; // 0..1 animation progress
    this.activateT = 0;
    this.done = false;
  }

  activate() {
    if (this.active) return false;
    this.active = true;
    this.activateT = 0;
    return true;
  }

  get triggerRect() {
    return { x: this.x + 8, y: this.y + 30, w: 24, h: 34 };
  }

  update(dt) {
    if (this.active && !this.done) {
      this.activateT += dt;
      this.activatePhase = Math.min(1, this.activateT / 2.2);
      if (this.activateT >= 2.6) this.done = true;
    }
  }

  render(ctx, cam, time) {
    drawTower(ctx, this.x - cam.x - cam.shakeOX, this.y - cam.y - cam.shakeOY, time, this.active, this.activatePhase);
  }
}
