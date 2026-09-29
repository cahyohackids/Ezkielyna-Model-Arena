// Camera: smooth follow with look-ahead, boundaries, and shake.

import { lerp, clamp } from './utils.js';

export class Camera {
  constructor(viewW, viewH) {
    this.viewW = viewW;
    this.viewH = viewH;
    this.x = 0;
    this.y = 0;
    this.lookAhead = 0;
    this.shakeTime = 0;
    this.shakeDur = 0;
    this.shakeMag = 0;
    this.enabled = true;
    this.reducedMotion = false;
  }

  shake(mag, dur) {
    if (!this.enabled) return;
    if (this.reducedMotion) mag *= 0.4;
    if (mag >= this.shakeMag) {
      this.shakeMag = mag;
      this.shakeDur = dur;
      this.shakeTime = dur;
    }
  }

  setScreenShake(on) {
    this.enabled = on;
    if (!on) { this.shakeTime = 0; this.shakeMag = 0; }
  }

  update(dt, targetX, targetY, dir, levelWidth, levelHeight) {
    // look-ahead in movement direction
    const lookTarget = dir * 60;
    this.lookAhead = lerp(this.lookAhead, lookTarget, Math.min(1, dt * 6));

    const cx = targetX + this.lookAhead - this.viewW / 2;
    const cy = targetY - this.viewH / 2;

    // vertical follow (gentle) to keep player readable during jumps
    const verticalFollow = lerp(this.y, cy, Math.min(1, dt * 4));
    this.x = lerp(this.x, cx, Math.min(1, dt * 5));
    this.y = verticalFollow;

    // clamp to level bounds
    this.x = clamp(this.x, 0, Math.max(0, levelWidth - this.viewW));
    this.y = clamp(this.y, 0, Math.max(0, levelHeight - this.viewH));

    // shake decay
    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
    } else {
      this.shakeMag = 0;
    }
  }

  get offsetX() {
    if (this.shakeTime <= 0) return this.x;
    const t = this.shakeTime / this.shakeDur;
    const m = this.shakeMag * t;
    return this.x + (Math.random() * 2 - 1) * m;
  }
  get offsetY() {
    if (this.shakeTime <= 0) return this.y;
    const t = this.shakeTime / this.shakeDur;
    const m = this.shakeMag * t;
    return this.y + (Math.random() * 2 - 1) * m;
  }
}
