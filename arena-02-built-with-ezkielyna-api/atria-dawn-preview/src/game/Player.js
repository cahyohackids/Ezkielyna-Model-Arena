import { drawPip, PAL } from '../core/Renderer.js';
import { CollisionManager } from './Physics.js';
import { TILE } from './levels.js';

// PIP — the courier robot.
//
// Movement model: acceleration-based horizontal motion with a high max speed,
// a slightly higher cap while dashing, and strong but not instant ground
// friction. Air control is present but weaker than ground control so jumps
// still carry momentum. Gravity is ~30% stronger while falling than rising,
// and terminal velocity caps fast falls.
//
// Quality of life: coyote time (~110ms), jump buffer (~130ms), variable jump
// height (early release cuts the rise), dash with trail + cooldown, knockback
// + iframes on damage, squash & stretch on jump/land.

const W = 12;
const H = 16;

export class Player {
  constructor(x, y, audio, particles, camera) {
    this.x = x;
    this.y = y;
    this.w = W;
    this.h = H;
    this.vx = 0;
    this.vy = 0;
    this.facing = 1;
    this.onGround = false;
    this.collision = new CollisionManager(null);

    // tuning constants (pixels, seconds)
    this.maxRun = 118;
    this.groundAccel = 1500;
    this.groundFriction = 1400;
    this.airAccel = 950;
    this.airFriction = 260;
    this.jumpVel = -300;
    this.jumpHoldBoost = -118; // extra velocity while holding at apex
    this.jumpCutMult = 0.42;   // velocity multiplier on early release
    this.gravityUp = 900;
    this.gravityDown = 1280;
    this.terminalVel = 380;
    this.coyoteTime = 0.11;
    this.jumpBuffer = 0.13;
    this.dashSpeed = 330;
    this.dashTime = 0.16;
    this.dashCooldown = 0.62;
    this.maxHealth = 3;

    // runtime state
    this.health = this.maxHealth;
    this.coyote = 0;
    this.buffer = 0;
    this.dashT = 0;
    this.dashCd = 0;
    this.dashing = false;
    this.dashDir = 1;
    this.iframeT = 0;
    this.dead = false;
    this.deathT = 0;
    this.win = false;
    this.winT = 0;
    this.anim = 'idle';
    this.animFrame = 0;
    this.squashX = 1;
    this.squashY = 1;
    this.platform = null; // platform we're riding
    this._wasGrounded = false;
    this._trailTimer = 0;
    this._runDustT = 0;
    this._jumpHeld = false;
    this._frozen = 0; // impact freeze timer
    this.spawnPoint = { x, y };
  }

  reset(x, y) {
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.facing = 1;
    this.onGround = false;
    this.coyote = 0; this.buffer = 0;
    this.dashT = 0; this.dashCd = 0; this.dashing = false;
    this.iframeT = 0; this.dead = false; this.deathT = 0;
    this.win = false; this.winT = 0;
    this.health = this.maxHealth;
    this.anim = 'idle'; this.animFrame = 0;
    this.squashX = 1; this.squashY = 1;
    this.platform = null;
    this._wasGrounded = false;
    this._frozen = 0;
  }

  setSpawn(x, y) { this.spawnPoint = { x, y }; }

  // ----------------------------------------------------------
  // Main update. Returns events for the game to react to.
  // ----------------------------------------------------------
  update(dt, input, level, cam) {
    const events = [];

    if (this._frozen > 0) {
      this._frozen -= dt;
      // during impact freeze we still animate the squash but skip physics
      this._updateSquash(dt);
      return events;
    }

    if (this.dead) {
      this.deathT += dt;
      this.vy = Math.min(this.vy + this.gravityDown * dt, this.terminalVel);
      this.y += this.vy * dt;
      this.anim = 'dead';
      this.animFrame += dt * 8;
      return events;
    }

    if (this.win) {
      this.winT += dt;
      this.vx *= Math.pow(0.001, dt);
      this.anim = 'victory';
      this.animFrame += dt * 6;
      this._applyPhysics(dt, level, null);
      return events;
    }

    // ---------- timers ----------
    this.dashCd = Math.max(0, this.dashCd - dt);
    this.iframeT = Math.max(0, this.iframeT - dt);
    if (this.onGround) this.coyote = this.coyoteTime;
    else this.coyote = Math.max(0, this.coyote - dt);
    if (this.buffer > 0) this.buffer = Math.max(0, this.buffer - dt);

    // ---------- input ----------
    const moveDir = (input.state.left ? -1 : 0) + (input.state.right ? 1 : 0);
    if (moveDir !== 0) this.facing = moveDir;

    if (input.consumeJump()) this.buffer = this.jumpBuffer;
    const jumpPressed = this.buffer > 0;
    this._jumpHeld = input.state.jump;

    // dash
    if (input.consumeDash() && this.dashCd <= 0 && !this.dashing) {
      this.dashing = true;
      this.dashT = this.dashTime;
      this.dashCd = this.dashCooldown;
      this.dashDir = moveDir !== 0 ? moveDir : this.facing;
      this.vy = Math.min(this.vy, 40);
      events.push({ type: 'dash' });
    }

    // ---------- horizontal motion ----------
    if (this.dashing) {
      this.dashT -= dt;
      this.vx = this.dashDir * this.dashSpeed;
      if (this.dashT <= 0) {
        this.dashing = false;
        this.vx = this.dashDir * this.maxRun * 0.85;
      }
    } else {
      const accel = this.onGround ? this.groundAccel : this.airAccel;
      const fric = this.onGround ? this.groundFriction : this.airFriction;
      if (moveDir !== 0) {
        this.vx += moveDir * accel * dt;
        const cap = this.maxRun;
        if (this.vx > cap) this.vx = Math.max(cap, this.vx - fric * dt);
        if (this.vx < -cap) this.vx = Math.min(-cap, this.vx + fric * dt);
      } else {
        if (this.vx > 0) this.vx = Math.max(0, this.vx - fric * dt);
        if (this.vx < 0) this.vx = Math.min(0, this.vx + fric * dt);
      }
    }

    // ---------- jump ----------
    if (jumpPressed && (this.coyote > 0 || this.onGround)) {
      this.vy = this.jumpVel;
      this.coyote = 0;
      this.buffer = 0;
      this.onGround = false;
      this.squashX = 0.7; this.squashY = 1.35;
      events.push({ type: 'jump' });
    } else if (jumpPressed && !this.onGround && this.coyote <= 0) {
      // buffered jump that didn't fire: leave the buffer running so it can
      // trigger on landing within its window
    }

    // variable jump height: releasing early cuts upward velocity
    if (!this._jumpHeld && this.vy < 0 && !this.dashing) {
      this.vy *= Math.pow(this.jumpCutMult, dt * 60);
    }

    // ---------- gravity ----------
    const grav = this.vy < 0 ? this.gravityUp : this.gravityDown;
    if (!this.dashing) this.vy = Math.min(this.vy + grav * dt, this.terminalVel);

    // ---------- integrate ----------
    const wasGrounded = this.onGround;
    const res = this._applyPhysics(dt, level, moveDir);
    this.onGround = res.ground;
    if (res.platform) this.platform = res.platform;
    else if (this.onGround) this.platform = null;
    else if (this.platform && (this.y + this.h < this.platform.y - 1 || this.x + this.w <= this.platform.x || this.x >= this.platform.x + this.platform.w)) this.platform = null;

    // carry: move with the platform we're standing on
    if (this.platform && this.onGround) {
      this.x += this.platform.dx || 0;
      this.y += this.platform.dy || 0;
    }

    // landing
    if (!wasGrounded && this.onGround) {
      const impact = Math.abs(this.vyBeforeLand || 0);
      this.squashX = 1 + Math.min(0.5, impact / 900);
      this.squashY = 1 - Math.min(0.35, impact / 1100);
      events.push({ type: 'land', impact });
      if (res.platform && res.platform.bounce) {
        events.push({ type: 'bounce', platform: res.platform });
      }
      if (res.platform && res.platform.trigger) res.platform.trigger();
    }
    this.vyBeforeLand = this.vy;

    // falling off the world
    if (this.y > level.height + 40) {
      events.push({ type: 'pit' });
    }

    // ---------- animation ----------
    this._updateAnim(dt, moveDir);
    this._updateSquash(dt);

    // dash trail
    if (this.dashing) {
      this._trailTimer -= dt;
      if (this._trailTimer <= 0) {
        this._trailTimer = 0.02;
        events.push({ type: 'trail' });
      }
    }
    // running dust
    if (this.onGround && Math.abs(this.vx) > 40 && !this.dashing) {
      this._runDustT -= dt;
      if (this._runDustT <= 0) {
        this._runDustT = 0.07;
        events.push({ type: 'dust' });
      }
    }

    return events;
  }

  _applyPhysics(dt, level, moveDir) {
    this.collision.setLevel(level);
    const platforms = level.platforms;
    const dx = this.vx * dt;
    const dy = this.vy * dt;
    const res = this.collision.moveAndCollide(this, dx, dy, platforms);
    if (res.hitX !== 0 && this.dashing) {
      this.dashing = false;
      this.vx = this.dashDir * 40;
    }
    if (res.hitY === 1 && !res.platform) this.vy = 0;
    if (res.hitY === -1) this.vy = Math.max(0, this.vy);
    return res;
  }

  _updateAnim(dt, moveDir) {
    if (this.dashing) { this.anim = 'dash'; this.animFrame += dt * 20; return; }
    if (!this.onGround) {
      this.anim = this.vy < 0 ? 'jump' : 'fall';
      this.animFrame += dt * 10;
      return;
    }
    if (Math.abs(this.vx) > 24) {
      this.anim = 'run';
      this.animFrame += dt * (6 + Math.abs(this.vx) / 18);
      return;
    }
    this.anim = 'idle';
    this.animFrame += dt * 3;
  }

  _updateSquash(dt) {
    const k = Math.min(1, dt * 12);
    this.squashX += (1 - this.squashX) * k;
    this.squashY += (1 - this.squashY) * k;
  }

  // ----------------------------------------------------------
  // Damage / death
  // ----------------------------------------------------------
  takeDamage(fromX, audio, particles, cam) {
    if (this.iframeT > 0 || this.dead || this.win) return false;
    this.health--;
    this.iframeT = 1.3;
    const dir = this.cx < fromX ? -1 : 1;
    this.vx = dir * 190;
    this.vy = -190;
    this.dashing = false;
    this.squashX = 1.3; this.squashY = 0.75;
    if (this.health <= 0) {
      this.dead = true;
      this.deathT = 0;
      this.vy = -240;
      this.vx = dir * 90;
      audio.death();
      cam.shake(5, 0.4);
      if (particles) {
        particles.burst(this.cx, this.cy, 18, {
          color: PAL.danger, speed: 110, life: 0.7, size: 3, gravity: 300, spread: Math.PI * 2,
        });
      }
    } else {
      audio.damage();
      cam.shake(3.5, 0.25);
      if (particles) {
        particles.burst(this.cx, this.cy, 10, {
          color: PAL.cream, speed: 80, life: 0.5, size: 2, gravity: 200, spread: Math.PI * 2,
        });
      }
    }
    return true;
  }

  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }

  // ----------------------------------------------------------
  // Render
  // ----------------------------------------------------------
  render(ctx, cam, time) {
    if (this.dead && this.deathT > 1.4) return;
    const sx = this.x - cam.x - cam.shakeOX;
    const sy = this.y - cam.y - cam.shakeOY;

    // blink during iframes
    if (this.iframeT > 0 && !this.dead) {
      const blink = Math.floor(this.iframeT * 20) % 2 === 0;
      if (blink) return;
    }

    ctx.save();
    ctx.translate(sx + this.w / 2, sy + this.h);
    ctx.scale(this.squashX, this.squashY);
    ctx.translate(-8, -18);
    // death animation: spin and fade
    if (this.dead) {
      ctx.translate(8, 18);
      ctx.rotate(this.deathT * 5);
      ctx.translate(-8, -18);
      ctx.globalAlpha = Math.max(0, 1 - this.deathT / 1.4);
    }
    const flash = this.iframeT > 0 && Math.floor(this.iframeT * 20) % 2 === 1;
    drawPip(ctx, 0, 0, this.anim, this.animFrame, this.facing, flash);
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}
