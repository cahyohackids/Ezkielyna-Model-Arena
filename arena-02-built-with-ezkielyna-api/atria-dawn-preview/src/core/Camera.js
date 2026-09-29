import { clamp, lerp, smooth } from './mathUtils.js';

// Smooth side-scrolling camera with directional anticipation, vertical
// smoothing during falls/jumps, and hard clamping to level bounds.
export class Camera {
  constructor(width, height) {
    this.x = 0;
    this.y = 0;
    this.viewW = width;
    this.viewH = height;
    this.levelW = width;
    this.levelH = height;
    this.shakeT = 0;
    this.shakeAmp = 0;
    this.shakeOX = 0;
    this.shakeOY = 0;
    this.reducedMotion = false;
    this._lookAhead = 0;
    this._targetY = 0;
  }

  setLevel(w, h) {
    this.levelW = w;
    this.levelH = h;
  }

  snapTo(x, y) {
    this.x = clamp(x - this.viewW / 2, 0, Math.max(0, this.levelW - this.viewW));
    this.y = clamp(y - this.viewH / 2, 0, Math.max(0, this.levelH - this.viewH));
    this._lookAhead = 0;
    this._targetY = this.y;
  }

  shake(amp, duration) {
    if (this.reducedMotion) return;
    this.shakeAmp = Math.max(this.shakeAmp, amp);
    this.shakeT = Math.max(this.shakeT, duration);
  }

  update(dt, targetX, targetY, vx) {
    // Anticipation: look ahead in the direction of horizontal motion.
    const desiredLook = clamp(vx * 0.22, -this.viewW * 0.14, this.viewW * 0.14);
    this._lookAhead = lerp(this._lookAhead, desiredLook, smooth(dt, 6));

    let cx = targetX + this._lookAhead - this.viewW / 2;
    cx = clamp(cx, 0, Math.max(0, this.levelW - this.viewW));

    // Vertical: keep player slightly below center; track big falls faster.
    const fallBoost = clamp(targetY - (this.y + this.viewH * 0.55), -40, 120);
    let cy = targetY + this.viewH * 0.08 - this.viewH / 2 + fallBoost * 0.35;
    cy = clamp(cy, 0, Math.max(0, this.levelH - this.viewH));

    const s = smooth(dt, 7.5);
    this.x += (cx - this.x) * s;
    this.y += (cy - this.y) * smooth(dt, 5.5);

    // Shake decay (exponential, framerate independent).
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const amp = this.shakeAmp * Math.max(0, this.shakeT) / 0.3;
      this.shakeOX = (Math.random() * 2 - 1) * amp;
      this.shakeOY = (Math.random() * 2 - 1) * amp;
      if (this.shakeT <= 0) { this.shakeAmp = 0; this.shakeOX = 0; this.shakeOY = 0; }
    }
  }

  get ox() { return this.x + this.shakeOX; }
  get oy() { return this.y + this.shakeOY; }

  // Convert world coords to screen coords for this frame.
  sx(wx) { return wx - this.x - this.shakeOX; }
  sy(wy) { return wy - this.y - this.shakeOY; }
}
