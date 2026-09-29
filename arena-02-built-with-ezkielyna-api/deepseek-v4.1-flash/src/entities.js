// entities.js — enemy behaviours. Kept deliberately simple and readable:
// each enemy has a small, learnable movement rule and a clear silhouette.
//
// Common contract:
//   update(dt, level, ctx)   — physics + behaviour
//   stomp()                  — called when player lands on top
//   hurtbox()                — AABB for player interaction (null while dying)
//   onGround / dead / removeMe flags

import { TILE } from './tiles.js';

const GRAV = 660;

class EnemyBase {
  constructor(o) {
    this.x = o.x; this.y = o.y;
    this.w = o.w; this.h = o.h;
    this.vx = 0; this.vy = 0;
    this.dir = o.dir ?? -1;
    this.dead = false;
    this.removeMe = false;
    this.deathT = 0;
    this.hurtT = 0;          // hit reaction flash timer
    this.onGround = false;
    this.prevY = this.y;
    this.animT = Math.random() * 10;
    this.flash = 0;
    this.isEnemy = true;
    this.stompable = true;
    this.damage = 1;
    this.homeX = o.x;
    this.homeY = o.y;
  }
  /** Reset to spawn state (on player death / level restart). */
  reset() {
    this.x = this.homeX; this.y = this.homeY;
    this.vx = 0; this.vy = 0;
    this.dead = false; this.removeMe = false; this.deathT = 0;
    this.flash = 0; this.animT = 0;
    this.prevY = this.y;
    if (this._extraReset) this._extraReset();
  }
  hurtbox() {
    if (this.dead || this.removeMe) return null;
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }
  stomp(ctx) {
    if (this.dead) return;
    this.dead = true;
    this.stompable = false;
    this.deathT = 0;
    this.vy = -90;
    this.vx *= 0.3;
    ctx.onEnemyDefeated?.(this);
  }
  _applyGravity(dt, level, opts = {}) {
    this.vy += GRAV * dt;
    if (this.vy > 420) this.vy = 420;
    const r = level.moveEntity(this, dt, opts);
    this.onGround = r.onGround;
    return r;
  }
  _deathUpdate(dt) {
    this.deathT += dt;
    this.y += this.vy * dt;
    this.vy += 800 * dt;
    this.x += this.vx * dt;
    if (this.deathT > 0.5) this.removeMe = true;
  }
  _flashUpdate(dt) { this.animT += dt; if (this.flash > 0) this.flash -= dt; }
}

// ─────────────────────────────────────────────────────────────────────────
//  Glitch Hopper — moves back and forth, turns at ledges and walls, hops.
//  Defeated by stomping. Slight "glitch" teleport jitter only in level 3+.
// ─────────────────────────────────────────────────────────────────────────
export class GlitchHopper extends EnemyBase {
  constructor(o) {
    super({ w: 12, h: 10, ...o });
    this.speed = o.speed ?? 34;
    this.hopPower = o.hopPower ?? 250;
    this.hopTimer = o.hopDelay ?? 1.1;
    this.hops = false;
    this.jitter = o.jitter ?? 0;
    this.wobble = Math.random() * 6.28;
  }

  update(dt, level, ctx) {
    if (this.dead) { this._deathUpdate(dt); return; }
    this._flashUpdate(dt);

    // Apply inherited platform motion if riding one (simple: just position).
    this.vx = this.dir * this.speed;

    // Turn at wall.
    const aheadX = this.dir > 0 ? this.x + this.w + 2 : this.x - 2;
    if (level.boxHitsSolid(aheadX, this.y + this.h - 6, 1, 4)) {
      this.dir *= -1;
      this.vx = this.dir * this.speed;
    }

    const r = this._applyGravity(dt, level);
    // Turn at ledge (only when grounded).
    if (r.onGround) {
      const probeX = this.dir > 0 ? this.x + this.w + 2 : this.x - 2;
      const probeY = this.y + this.h + 2;
      if (!level.boxHitsSolid(probeX, probeY, 1, 3)) {
        this.dir *= -1;
        this.vx = this.dir * this.speed;
      }
    } else if (r.hitCeiling) {
      this.dir *= -1;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────
//  Static Drone — floats along a horizontal or vertical path. Not stompable
//  from above in the usual sense; instead the player must avoid it. Landing
//  on it *does* disable it, but only from a clean top-down angle, rewarding
//  precision. Indestructible otherwise.
// ─────────────────────────────────────────────────────────────────────────
export class StaticDrone extends EnemyBase {
  constructor(o) {
    super({ w: 14, h: 11, ...o });
    this.axis = o.axis ?? 'x';
    this.range = o.range ?? 64;
    this.speed = o.speed ?? 26;
    this.t = o.phase ?? 0;
    this.baseX = this.x;
    this.baseY = this.y;
    this.stompable = true;
  }

  _extraReset() { this.t = 0; }

  update(dt, level, ctx) {
    if (this.dead) { this._deathUpdate(dt); return; }
    this._flashUpdate(dt);

    this.t += (this.speed / Math.max(8, this.range)) * dt;
    const s = Math.sin(this.t);
    if (this.axis === 'x') { this.x = this.baseX + (s * 0.5 + 0.5) * this.range; this.y = this.baseY; }
    else { this.y = this.baseY + (s * 0.5 + 0.5) * this.range; this.x = this.baseX; }
    this.dir = Math.cos(this.t) >= 0 ? 1 : -1;
    void level; void ctx;
  }
}

// ─────────────────────────────────────────────────────────────────────────
//  Corrupt Bug — patrols, then telegraphs and charges fast in a straight
//  line. Ground enemy, stompable, but risky while charging.
// ─────────────────────────────────────────────────────────────────────────
export class CorruptBug extends EnemyBase {
  constructor(o) {
    super({ w: 12, h: 9, ...o });
    this.speed = o.speed ?? 40;
    this.chargeSpeed = o.chargeSpeed ?? 150;
    this.state = 'patrol';     // patrol | tell | charge | recover
    this.stateT = 0;
    this.cooldown = o.chargeDelay ?? 1.8;
    this.patrolDir = this.dir;
    this.homeDir = this.dir;
    // Charge trigger: when the player is roughly in front and level with it.
  }

  _extraReset() {
    this.state = 'patrol'; this.stateT = 0; this.cooldown = 1.8;
    this.patrolDir = this.homeDir;
  }

  update(dt, level, ctx) {
    if (this.dead) { this._deathUpdate(dt); return; }
    this._flashUpdate(dt);
    this.stateT += dt;

    const player = ctx.player;
    switch (this.state) {
      case 'patrol': {
        this.vx = this.patrolDir * this.speed;
        const aheadX = this.patrolDir > 0 ? this.x + this.w + 2 : this.x - 2;
        if (level.boxHitsSolid(aheadX, this.y + this.h - 5, 1, 4)) this.patrolDir *= -1;
        const r = this._applyGravity(dt, level);
        if (r.onGround) {
          const probeX = this.patrolDir > 0 ? this.x + this.w + 2 : this.x - 2;
          if (!level.boxHitsSolid(probeX, this.y + this.h + 2, 1, 3)) {
            this.patrolDir *= -1;
          }
        }
        this.dir = this.patrolDir;
        // Look for player in front, roughly same height, and within range.
        if (player && !player.dead) {
          const dx = player.x + player.w / 2 - (this.x + this.w / 2);
          const dy = Math.abs(player.y + player.h / 2 - (this.y + this.h / 2));
          const facing = Math.sign(dx) === this.patrolDir;
          if (facing && dy < 26 && Math.abs(dx) < 92 && this.cooldown <= 0) {
            this.state = 'tell';
            this.stateT = 0;
          }
        }
        break;
      }
      case 'tell': {
        this.vx *= 0.7;
        this._applyGravity(dt, level);
        if (this.stateT > 0.42) {
          this.state = 'charge';
          this.stateT = 0;
          this.dir = this.patrolDir;
          ctx.onEnemyCharge?.(this);
        }
        break;
      }
      case 'charge': {
        this.vx = this.dir * this.chargeSpeed;
        const r = this._applyGravity(dt, level);
        if (r.hitX !== 0) {
          this.state = 'recover'; this.stateT = 0; this.cooldown = 0.5;
        } else if (this.stateT > 1.0 || !r.onGround) {
          if (this.stateT > 0.35) { this.state = 'recover'; this.stateT = 0; }
        }
        break;
      }
      case 'recover': {
        this.vx *= 0.75;
        this._applyGravity(dt, level);
        if (this.stateT > 0.42) {
          this.state = 'patrol';
          this.patrolDir = this.dir;
          this.cooldown = 1.6;
        }
        break;
      }
    }
    if (this.cooldown > 0) this.cooldown -= dt;
  }

  stomp(ctx) {
    super.stomp(ctx);
    // Charging bugs deflect the stomp less — same result, but stronger pop.
    this.vy = -110;
  }
}

// ─────────────────────────────────────────────────────────────────────────
//  Sentinel — an armoured, non-stompable blocker that patrols a small loop.
//  Added as a mid-level-3 threat to keep routes varied without new AI.
// ─────────────────────────────────────────────────────────────────────────
export class Sentinel extends EnemyBase {
  constructor(o) {
    super({ w: 12, h: 12, ...o });
    this.stompable = false;
    this.speed = o.speed ?? 22;
    this.axis = o.axis ?? 'x';
    this.range = o.range ?? 48;
    this.baseX = o.x; this.baseY = o.y;
    this.t = o.phase ?? 0;
    this.hover = true;
  }
  _extraReset() { this.t = 0; }
  update(dt) {
    if (this.dead) { this._deathUpdate(dt); return; }
    this._flashUpdate(dt);
    this.t += (this.speed / Math.max(8, this.range)) * dt;
    const s = (Math.sin(this.t) + 1) / 2;
    if (this.axis === 'x') { this.x = this.baseX + s * this.range; this.y = this.baseY; }
    else { this.y = this.baseY + s * this.range; this.x = this.baseX; }
  }
  stomp() { /* not stompable — bounce off with no effect */ }
}

export { TILE };
