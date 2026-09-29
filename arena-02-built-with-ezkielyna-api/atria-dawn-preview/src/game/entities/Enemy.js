import { Entity } from './Entity.js';
import { drawHopper, drawDrone, drawBug, PAL } from '../../core/Renderer.js';
import { TILE } from '../levels.js';

// Shared death state used by all enemies: squash, fade, then remove.
class EnemyBase extends Entity {
  constructor(x, y, w, h) {
    super(x, y, w, h);
    this.facing = 1;
    this.dying = false;
    this.dyingT = 0;
    this.squash = 0;
    this.t = 0;
  }
  startDeath() {
    if (this.dying) return;
    this.dying = true;
    this.dyingT = 0;
    this.squash = 1;
  }
  baseUpdate(dt) {
    this.t += dt;
    if (this.dying) {
      this.dyingT += dt;
      this.squash = Math.max(0, 1 - this.dyingT / 0.28);
      if (this.dyingT > 0.45) this.dead = true;
    }
  }
}

// Glitch Hopper: patrols a small range on the ground. Dies when stomped.
export class GlitchHopper extends EnemyBase {
  constructor(x, y) {
    super(x, y, 14, 14);
    this.homeX = x;
    this.range = 3 * TILE;
    this.speed = 26;
    this.vx = this.speed;
  }
  update(dt, time, level, player) {
    this.baseUpdate(dt);
    if (this.dying) return;
    this.x += this.vx * dt;
    if (this.x > this.homeX + this.range) { this.x = this.homeX + this.range; this.vx = -this.speed; }
    if (this.x < this.homeX) { this.x = this.homeX; this.vx = this.speed; }
    this.facing = this.vx > 0 ? 1 : -1;
    // hop animation
    this.hopT = (this.hopT || 0) + dt;
  }
  render(ctx, cam, time) {
    if (this.dead) return;
    drawHopper(ctx, this.x - cam.x - cam.shakeOX, this.y - cam.y - cam.shakeOY, time, this.squash, this.dying);
  }
}

// Static Drone: floats along a fixed path, up/down or side to side.
// Harmful to touch; must be avoided or stomped.
export class StaticDrone extends EnemyBase {
  constructor(x, y, rangeX, rangeY, period) {
    super(x, y, 14, 12);
    this.startX = x;
    this.startY = y;
    this.rangeX = (rangeX || 0) * TILE;
    this.rangeY = (rangeY || 0) * TILE;
    this.period = Math.max(0.8, period || 3);
  }
  update(dt, time) {
    this.baseUpdate(dt);
    if (this.dying) return;
    const phase = (this.t % this.period) / this.period;
    // triangle wave 0..1..0 with smoothstep easing
    const wave = phase < 0.5 ? phase * 2 : 2 - phase * 2;
    const eased = wave * wave * (3 - 2 * wave);
    this.x = this.startX + this.rangeX * eased;
    this.y = this.startY + this.rangeY * eased;
  }
  render(ctx, cam, time) {
    if (this.dead) return;
    drawDrone(ctx, this.x - cam.x - cam.shakeOX, this.y - cam.y - cam.shakeOY, time, this.dying);
  }
}

// Corrupt Bug: fast ground charger. Pauses, then dashes in the player's
// direction, then recovers.
export class CorruptBug extends EnemyBase {
  constructor(x, y) {
    super(x, y, 16, 10);
    this.state = 'patrol'; // patrol | telegraph | charge | tired
    this.stateT = 0;
    this.dir = -1;
    this.patrolSpeed = 20;
    this.chargeSpeed = 150;
    this.homeX = x;
    this.range = 4 * TILE;
  }
  update(dt, time, level, player) {
    this.baseUpdate(dt);
    if (this.dying) return;
    this.stateT += dt;
    // face the player when close
    const dx = player.cx - this.cx;
    if (Math.abs(dx) < 7 * TILE && Math.abs(player.cy - this.cy) < 4 * TILE) {
      this.dir = dx > 0 ? 1 : -1;
    }
    switch (this.state) {
      case 'patrol': {
        this.x += this.dir * this.patrolSpeed * dt;
        if (this.x < this.homeX - this.range) { this.x = this.homeX - this.range; this.dir = 1; }
        if (this.x > this.homeX + this.range) { this.x = this.homeX + this.range; this.dir = -1; }
        if (this.stateT > 1.6 && Math.abs(dx) < 6 * TILE) {
          this.state = 'telegraph';
          this.stateT = 0;
        }
        break;
      }
      case 'telegraph': {
        // wind-up: shake in place
        this.x += Math.sin(this.stateT * 40) * 0.6;
        if (this.stateT > 0.45) { this.state = 'charge'; this.stateT = 0; }
        break;
      }
      case 'charge': {
        this.x += this.dir * this.chargeSpeed * dt;
        if (this.stateT > 0.55 || this.x < this.homeX - this.range - TILE || this.x > this.homeX + this.range + TILE) {
          this.state = 'tired';
          this.stateT = 0;
        }
        break;
      }
      case 'tired': {
        if (this.stateT > 0.9) { this.state = 'patrol'; this.stateT = 0; }
        break;
      }
    }
    this.facing = this.dir;
  }
  get charging() { return this.state === 'charge'; }
  render(ctx, cam, time) {
    if (this.dead) return;
    drawBug(ctx, this.x - cam.x - cam.shakeOX, this.y - cam.y - cam.shakeOY, time, this.facing, this.charging, this.dying);
  }
}
