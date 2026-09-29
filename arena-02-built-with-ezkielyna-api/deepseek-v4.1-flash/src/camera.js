// camera.js — smooth side-scrolling camera.
//
// Behaviour:
//  • Follows the player with a soft horizontal anchor that anticipates the
//    direction of travel (the view leans the way you're heading).
//  • Vertical follow is lazier and biased so the player sits below centre
//    when falling, giving more look-ahead when jumping.
//  • Dead-zone box prevents micro-jitter from tiny velocity changes.
//  • Clamped to level bounds; if the level is smaller than the view the
//    camera centres it.
//  • Shake is applied as an offset (decaying, trauma-based) and is disabled
//    by the reduced-motion / screen-shake settings.

import { clamp, damp } from './math.js';

export class Camera {
  constructor(viewW, viewH) {
    this.vw = viewW;
    this.vh = viewH;
    this.x = 0; this.y = 0;
    this.targetX = 0; this.targetY = 0;
    this.bounds = { w: 0, h: 0 };
    this.trauma = 0;
    this.shakeX = 0; this.shakeY = 0;
    this.shakeEnabled = true;
    this.followX = 8.5;    // damping rates
    this.followY = 6.0;
    this.lookAhead = 46;
    this.lookUpWhenRising = 34;
    this._t = 0;
  }

  setBounds(worldW, worldH) {
    this.bounds.w = worldW;
    this.bounds.h = worldH;
  }

  /**
   * Snap instantly to a world point. Extra args are accepted (and used to set
   * the level bounds) so callers can pass (px, py, worldW, worldH) in one go.
   */
  snapTo(px, py, worldW, worldH) {
    if (typeof worldW === 'number' && typeof worldH === 'number') {
      this.setBounds(worldW, worldH);
    }
    this.targetX = this._desiredX(px, 0, false);
    this.targetY = this._desiredY(py, 0, false);
    this.x = clamp(this.targetX, 0, Math.max(0, this.bounds.w - this.vw));
    this.y = clamp(this.targetY, 0, Math.max(0, this.bounds.h - this.vh));
    this.shakeX = 0; this.shakeY = 0;
    this.trauma = 0;
  }

  /**
   * Follow a player-like object. Accepts (player, worldW, worldH, dt) — the
   * level bounds are refreshed each call so a resize/level swap needs no extra
   * bookkeeping.
   */
  follow(player, worldW, worldH, dt) {
    if (typeof worldW === 'number' && typeof worldH === 'number') {
      this.setBounds(worldW, worldH);
    }
    this.update(typeof dt === 'number' ? dt : 1 / 60, player);
  }

  /** Decay screen shake. Safe to call every render frame. */
  updateShake(dt) {
    if (this.shakeEnabled === false) { this.shakeX = 0; this.shakeY = 0; this.trauma = 0; return; }
    if (this.trauma > 0) {
      this._t += dt;
      this.trauma = Math.max(0, this.trauma - dt * 2.6);
      const s = this.trauma * this.trauma;
      const t = this._t * 46;
      this.shakeX = Math.sin(t * 1.7) * s * 7;
      this.shakeY = Math.cos(t * 2.3) * s * 5;
    } else {
      this.shakeX = 0; this.shakeY = 0;
    }
  }

  _desiredX(px, vx, anticipate = true) {
    const base = px - this.vw / 2;
    if (!anticipate) return base;
    // Anticipate based on smoothed velocity.
    const lead = clamp(vx / 120, -1, 1) * this.lookAhead;
    return base + lead;
  }

  _desiredY(py, vy, anticipate = true) {
    // Bias the player slightly below centre so there's more headroom above.
    const anchor = this.vh * 0.58;
    let d = py - anchor;
    if (anticipate) {
      // When rising, reveal more above; when falling fast, reveal more below.
      d += clamp(-vy / 400, -1, 1) * this.lookUpWhenRising;
    }
    return d;
  }

  update(dt, player) {
    this._t += dt;
    const px = player.cx;
    const py = player.cy;
    const vx = player.vx;
    const vy = player.vy;

    const wantX = this._desiredX(px, vx, true);
    const wantY = this._desiredY(py, vy, true);

    // Dead zone: only chase when outside a small box, else drift.
    const dzx = 6;
    const dx = wantX - this.x;
    if (Math.abs(dx) > dzx) this.targetX = wantX - Math.sign(dx) * dzx;
    else this.targetX = this.x + dx * 0.2;

    // Vertical dead zone is bigger so small hops don't move the camera.
    const dzy = 14;
    const dy = wantY - this.y;
    if (Math.abs(dy) > dzy) this.targetY = wantY - Math.sign(dy) * dzy;
    else this.targetY = this.y + dy * 0.12;

    this.x = damp(this.x, this.targetX, this.followX, dt);
    this.y = damp(this.y, this.targetY, this.followY, dt);

    this.x = clamp(this.x, 0, Math.max(0, this.bounds.w - this.vw));
    this.y = clamp(this.y, 0, Math.max(0, this.bounds.h - this.vh));
  }

  shake(amount) {
    if (!this.shakeEnabled) return;
    this.trauma = Math.min(1, this.trauma + amount / 12);
  }

  /** Final render offset in world units (rounded for pixel-perfect output). */
  get renderX() { return Math.round(this.x + this.shakeX); }
  get renderY() { return Math.round(this.y + this.shakeY); }
}
