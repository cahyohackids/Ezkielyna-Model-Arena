// Player (PIP): physics, movement feel, dash, health, animation state.

import { clamp, aabb, rand } from './utils.js';
import { TILE } from './levels.js';
import {
  solidAt, oneWayAt, spikeAt, bounceAt, phaseAt,
} from './levelparser.js';

export const PLAYER_W = 22;
export const PLAYER_H = 28;

export class Player {
  constructor(spawn, game) {
    this.game = game;
    this.x = spawn.x;
    this.y = spawn.y - PLAYER_H;
    this.w = PLAYER_W;
    this.h = PLAYER_H;
    this.vx = 0;
    this.vy = 0;
    this.dir = 1;
    this.impactVy = 0;

    this.onGround = false;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.jumpHeld = false;

    this.dashTime = 0;
    this.dashCooldown = 0;
    this.dashDir = 1;
    this.dashMax = 0.16;
    this.dashCooldownMax = 0.7;

    this.hp = 3;
    this.maxHp = 3;
    this.invuln = 0;
    this.knockback = { x: 0, y: 0 };

    this.dead = false;
    this.deathTimer = 0;
    this.won = false;
    this.winTimer = 0;

    this.anim = 'idle';
    this.animTime = 0;
    this.squash = 1;
    this.stretch = 1;

    this.walkCycle = 0;

    // tuning constants
    this.accel = 2400;
    this.decel = 3000;
    this.airAccel = 1800;
    this.maxRun = 275;
    this.jumpVel = -500;
    this.gravity = 1100;
    this.fallGravity = 1500;
    this.terminal = 720;
    this.coyoteMax = 0.1;
    this.jumpBufferMax = 0.12;
    this.dashSpeed = 640;
    this.bounceVel = -740;

    this.platform = null;
  }

  reset(spawn) {
    this.x = spawn.x;
    this.y = spawn.y - PLAYER_H;
    this.vx = 0; this.vy = 0;
    this.hp = 3;
    this.dead = false; this.deathTimer = 0;
    this.won = false; this.winTimer = 0;
    this.invuln = 0;
    this.dashTime = 0; this.dashCooldown = 0;
    this.platform = null;
    this.anim = 'idle';
    this.onGround = false;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.squash = 1; this.stretch = 1;
  }

  update(dt, input) {
    if (this.dead) {
      this.deathTimer += dt;
      this.vy += this.gravity * dt;
      this.y += this.vy * dt;
      this.anim = 'dead';
      return;
    }
    if (this.won) {
      this.winTimer += dt;
      this.anim = 'victory';
      return;
    }

    const lv = this.game.level;
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);

    // timers
    this.coyote = Math.max(0, this.coyote - dt);
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.squash += (1 - this.squash) * Math.min(1, dt * 12);
    this.stretch += (1 - this.stretch) * Math.min(1, dt * 12);

    // dash
    if (this.dashTime > 0) {
      this.dashTime -= dt;
      this.vx = this.dashDir * this.dashSpeed;
      this.vy = 0;
      if (this.dashTime <= 0) {
        this.dashTime = 0;
        this.vx = this.dashDir * this.maxRun * 0.8;
      }
    } else {
      const accel = this.onGround ? this.accel : this.airAccel;
      if (dir !== 0) {
        this.vx += dir * accel * dt;
        this.vx = clamp(this.vx, -this.maxRun, this.maxRun);
        this.dir = dir;
      } else {
        const dec = this.onGround ? this.decel : this.airAccel * 0.5;
        const s = Math.sign(this.vx);
        this.vx -= s * dec * dt;
        if (Math.sign(this.vx) !== s) this.vx = 0;
      }
    }

    // knockback
    this.vx += this.knockback.x;
    this.knockback.x *= Math.pow(0.0001, dt);
    this.vy += this.knockback.y;
    this.knockback.y *= Math.pow(0.0001, dt);

    // jump input
    if (input.jumpPressed()) {
      this.jumpBuffer = this.jumpBufferMax;
    }
    if (input.jumpHeld) {
      this.jumpHeld = true;
    } else {
      this.jumpHeld = false;
      if (this.vy < -this.jumpVel * 0.32) {
        this.vy = -this.jumpVel * 0.32; // variable jump height cut
      }
    }

    if (this.jumpBuffer > 0 && this.coyote > 0 && this.dashTime <= 0) {
      this.doJump();
    }

    // dash trigger
    if (input.dashPressed() && this.dashCooldown <= 0 && this.dashTime <= 0) {
      this.doDash();
    }

    // gravity
    if (this.dashTime <= 0) {
      const g = this.vy > 0 ? this.fallGravity : this.gravity;
      this.vy += g * dt;
      this.vy = Math.min(this.vy, this.terminal);
    }

    // integrate + collide
    this.moveX(dt);
    this.moveY(dt);

    // carry on moving platform
    if (this.platform) {
      this.x += this.platform.dx || 0;
      this.y += this.platform.dy || 0;
      this.platform = null;
    }

    // hazards
    this.checkHazards();

    // bounce pads
    this.checkBounce();

    // animation
    this.updateAnim(dt, dir);

    // running dust
    if (this.onGround && Math.abs(this.vx) > 120 && Math.random() < dt * 20) {
      this.game.particles.dust(this.x + this.w / 2, this.y + this.h, this.dir);
    }

    // dash trail particles
    if (this.dashTime > 0 && Math.random() < dt * 60) {
      this.game.particles.spawn({
        x: this.x + this.w / 2, y: this.y + this.h / 2,
        vx: -this.dir * 30, vy: rand(-20, 20),
        life: 0.3, size: 3, color: '#7fe7ff', gravity: 0, drag: 0.9, type: 'square',
      });
    }
  }

  doJump() {
    this.vy = this.jumpVel;
    this.onGround = false;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.squash = 0.7;
    this.stretch = 1.35;
    this.platform = null;
    this.game.particles.burst(this.x + this.w / 2, this.y + this.h, 5, {
      color: '#8ba0c4', speedMin: 30, speedMax: 80, upBias: 60, lifeMax: 0.4, gravity: 300,
    });
    this.game.audio.jump();
  }

  doDash() {
    this.dashDir = this.dir;
    this.dashTime = this.dashMax;
    this.dashCooldown = this.dashCooldownMax;
    this.vy = 0;
    this.stretch = 1.5;
    this.squash = 0.6;
    this.game.audio.dash();
  }

  moveX(dt) {
    this.x += this.vx * dt;
    const lv = this.game.level;

    if (this.vx > 0) {
      const edge = this.x + this.w;
      const ty1 = Math.floor(this.y / TILE);
      const ty2 = Math.floor((this.y + this.h - 1) / TILE);
      const tx = Math.floor(edge / TILE);
      for (let ty = ty1; ty <= ty2; ty++) {
        if (solidAt(lv, tx, ty)) {
          this.x = tx * TILE - this.w - 0.01;
          this.vx = 0;
          break;
        }
      }
    } else if (this.vx < 0) {
      const tx = Math.floor(this.x / TILE);
      const ty1 = Math.floor(this.y / TILE);
      const ty2 = Math.floor((this.y + this.h - 1) / TILE);
      for (let ty = ty1; ty <= ty2; ty++) {
        if (solidAt(lv, tx, ty)) {
          this.x = (tx + 1) * TILE + 0.01;
          this.vx = 0;
          break;
        }
      }
    }

    this.x = clamp(this.x, 0, lv.width - this.w);
  }

  moveY(dt) {
    this.y += this.vy * dt;
    const lv = this.game.level;
    const wasGrounded = this.onGround;
    this.impactVy = this.vy;
    this.onGround = false;

    if (this.vy > 0) {
      const feet = this.y + this.h;
      const tx1 = Math.floor((this.x + 2) / TILE);
      const tx2 = Math.floor((this.x + this.w - 2) / TILE);
      const ty = Math.floor(feet / TILE);
      let landed = false;

      for (let tx = tx1; tx <= tx2; tx++) {
        if (solidAt(lv, tx, ty)) {
          this.y = ty * TILE - this.h;
          this.vy = 0;
          landed = true;
          break;
        }
      }
      if (!landed) {
        for (let tx = tx1; tx <= tx2; tx++) {
          if (oneWayAt(lv, tx, ty)) {
            const prevFeet = feet - this.vy * dt;
            if (prevFeet <= ty * TILE + 1) {
              this.y = ty * TILE - this.h;
              this.vy = 0;
              landed = true;
              break;
            }
          }
        }
      }
      if (!landed) {
        for (let tx = tx1; tx <= tx2; tx++) {
          if (phaseAt(lv, tx, ty) && this.game.phaseActive) {
            const prevFeet = feet - this.vy * dt;
            if (prevFeet <= ty * TILE + 1) {
              this.y = ty * TILE - this.h;
              this.vy = 0;
              landed = true;
              break;
            }
          }
        }
      }
      if (!landed && this.landOnMovingPlatform()) landed = true;
      if (!landed && this.landOnFallingPlatform()) landed = true;

      if (landed) {
        this.onGround = true;
        if (!wasGrounded) this.onLand();
      }
    } else if (this.vy < 0) {
      const tx1 = Math.floor((this.x + 2) / TILE);
      const tx2 = Math.floor((this.x + this.w - 2) / TILE);
      const ty = Math.floor(this.y / TILE);
      for (let tx = tx1; tx <= tx2; tx++) {
        if (solidAt(lv, tx, ty)) {
          this.y = (ty + 1) * TILE + 0.01;
          this.vy = 0;
          break;
        }
      }
    }

    if (!this.onGround && this.vy >= 0 && this.checkGrounded()) {
      this.onGround = true;
    }
    if (this.onGround) {
      this.coyote = this.coyoteMax;
    }
  }

  checkGrounded() {
    const lv = this.game.level;
    const feet = this.y + this.h;
    const tx1 = Math.floor((this.x + 2) / TILE);
    const tx2 = Math.floor((this.x + this.w - 2) / TILE);
    const ty = Math.floor(feet / TILE);
    for (let tx = tx1; tx <= tx2; tx++) {
      if (solidAt(lv, tx, ty) && Math.abs(feet - ty * TILE) < 4) return true;
      if (oneWayAt(lv, tx, ty) && Math.abs(feet - ty * TILE) < 4) return true;
    }
    return false;
  }

  landOnMovingPlatform() {
    const lv = this.game.level;
    for (const mp of lv.movingPlatforms) {
      if (this.vy >= 0 && aabb(this.x, this.y, this.w, this.h, mp.x, mp.y, mp.w, mp.h)) {
        const prevFeet = (this.y + this.h) - this.vy * 0.016;
        if (prevFeet <= mp.y + 4) {
          this.y = mp.y - this.h;
          this.vy = 0;
          this.platform = mp;
          return true;
        }
      }
    }
    // phase platforms (when active)
    if (this.game.phaseActive) {
      for (const pp of lv.phasePlatforms) {
        if (this.vy >= 0 && aabb(this.x, this.y, this.w, this.h, pp.x, pp.y, pp.w, pp.h)) {
          const prevFeet = (this.y + this.h) - this.vy * 0.016;
          if (prevFeet <= pp.y + 4) {
            this.y = pp.y - this.h;
            this.vy = 0;
            return true;
          }
        }
      }
    }
    return false;
  }

  landOnFallingPlatform() {
    const lv = this.game.level;
    for (const fp of lv.fallingPlatforms) {
      if (!fp.falling && this.vy >= 0 && aabb(this.x, this.y, this.w, this.h, fp.x, fp.y, fp.w, 14)) {
        const prevFeet = (this.y + this.h) - this.vy * 0.016;
        if (prevFeet <= fp.y + 4) {
          this.y = fp.y - this.h;
          this.vy = 0;
          if (fp.shaking === 0) {
            fp.shaking = 0.4; // trigger shake, then fall
          }
          return true;
        }
      }
    }
    return false;
  }

  landOnPhasePlatform() {
    const lv = this.game.level;
    if (!this.game.phaseActive) return false;
    for (const pp of lv.phasePlatforms) {
      if (this.vy >= 0 && aabb(this.x, this.y, this.w, this.h, pp.x, pp.y, pp.w, pp.h)) {
        const prevFeet = (this.y + this.h) - this.vy * 0.016;
        if (prevFeet <= pp.y + 4) {
          this.y = pp.y - this.h;
          this.vy = 0;
          return true;
        }
      }
    }
    return false;
  }

  onLand() {
    const impact = this.impactVy ?? 0;
    this.squash = 0.72;
    this.stretch = 1.28;
    this.game.particles.burst(this.x + this.w / 2, this.y + this.h, 6, {
      color: '#8ba0c4', speedMin: 40, speedMax: 100, lifeMax: 0.35, gravity: 400, type: 'spark',
    });
    if (impact > 250) this.game.audio.land();
  }

  checkHazards() {
    const lv = this.game.level;
    const cx = this.x + this.w / 2;
    const cy = this.y + this.h / 2;

    // spike contact (feet into spike tile)
    const tx = Math.floor(cx / TILE);
    const ty = Math.floor((this.y + this.h - 4) / TILE);
    if (spikeAt(lv, tx, ty)) {
      this.hurt({ x: 0, y: -220 });
      return;
    }

    // fall out of world
    if (this.y > lv.height + TILE * 2) {
      this.die(true);
    }
  }

  checkBounce() {
    const lv = this.game.level;
    if (this.vy < 0) return;
    const cx = this.x + this.w / 2;
    // check the tile just above the feet (where bounce pads sit on the floor)
    const ty = Math.floor((this.y + this.h - 2) / TILE);
    const tx = Math.floor(cx / TILE);
    if (bounceAt(lv, tx, ty)) {
      this.vy = this.bounceVel;
      this.onGround = false;
      this.squash = 0.6;
      this.stretch = 1.5;
      this.game.audio.bounce();
      this.game.particles.burst(cx, this.y + this.h, 10, {
        color: '#ff8c42', speedMin: 60, speedMax: 160, upBias: 100, lifeMax: 0.5, gravity: 300,
      });
      this.game.camera.shake(3, 0.15);
    }
  }

  hurt(knock = { x: 0, y: -150 }) {
    if (this.invuln > 0 || this.dead || this.won) return;
    this.hp--;
    this.invuln = 1.4;
    this.knockback = knock;
    this.vy = Math.min(this.vy, knock.y);
    this.vx = knock.x;
    this.game.audio.hurt();
    this.game.particles.burst(this.x + this.w / 2, this.y + this.h / 2, 10, {
      color: '#ff5a6e', speedMin: 60, speedMax: 160, lifeMax: 0.5, gravity: 300,
    });
    this.game.camera.shake(5, 0.25);
    if (this.hp <= 0) {
      this.die();
    }
  }

  die(fell = false) {
    if (this.dead) return;
    this.dead = true;
    this.deathTimer = 0;
    this.game.audio.death();
    if (!fell) {
      this.vy = -300;
      this.vx = 0;
    }
    this.game.onPlayerDeath();
  }

  updateAnim(dt, dir) {
    this.animTime += dt;
    if (this.dashTime > 0) {
      this.anim = 'dash';
    } else if (!this.onGround) {
      this.anim = this.vy < 0 ? 'jump' : 'fall';
    } else if (Math.abs(this.vx) > 30) {
      this.anim = 'run';
      this.walkCycle += dt * Math.abs(this.vx) * 0.045;
    } else {
      this.anim = 'idle';
    }
  }
}
