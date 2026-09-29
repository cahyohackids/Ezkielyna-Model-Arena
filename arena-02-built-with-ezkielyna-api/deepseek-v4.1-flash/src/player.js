// player.js — PIP. This is where the game feel lives, so the constants are
// tuned deliberately and the state machine stays small and legible.
//
// Feel systems implemented:
//   • acceleration / deceleration with separate ground & air response
//   • momentum carried into the air, reduced air control (but not stiff)
//   • asymmetric gravity (fall faster than rise)
//   • variable jump height (release early = shorter arc)
//   • coyote time (~110ms)
//   • jump buffering (~130ms)
//   • apex hang (slightly reduced gravity near the top of the arc)
//   • dash with cooldown, i-frames-free but fast, refilled on landing
//   • squash & stretch, landing impact scale, blink on i-frames
//   • knockback + brief control lock on damage
//   • respawn / death sequences

import { clamp, approach, damp } from './math.js';
import { TILE, PLAYER_SIZE } from './tiles.js';

export const P = {
  // Horizontal
  MAX_RUN: 124,
  ACCEL_GROUND: 900,
  ACCEL_AIR: 640,
  DECEL_GROUND: 1250,
  DECEL_AIR: 480,
  TURN_MULT: 2.1,          // extra grip when reversing direction
  FRICTION_STOP: 22,       // below this speed with no input, snap to 0
  // Vertical
  GRAVITY: 1080,
  FALL_MULT: 1.42,         // falling gravity multiplier
  APEX_GRAV_MULT: 0.62,    // gentler near apex
  APEX_THRESHOLD: 42,      // |vy| under this counts as apex
  JUMP_VELOCITY: -322,     // ≈48 px ≈ 3.0 tiles of hold-jump height
  JUMP_CUT: 0.42,          // velocity multiplier on early release
  MAX_FALL: 400,
  // Feel timings (seconds)
  COYOTE: 0.11,
  BUFFER: 0.13,
  JUMP_REPEAT_DELAY: 0.06, // no double-fire from a held key
  // Dash
  DASH_SPEED: 330,
  DASH_TIME: 0.19,
  DASH_COOLDOWN: 0.48,
  DASH_END_SPEED: 130,
  DASH_GRACE: 0.09,        // short window after dash where you can jump-cancel
  // Health
  MAX_HP: 3,
  INVULN: 1.25,
  KNOCKBACK_X: 150,
  KNOCKBACK_Y: -170,
  CONTROL_LOCK: 0.16,
  // Physics box
  W: PLAYER_SIZE.w,
  H: PLAYER_SIZE.h,
};

export const PSTATE = {
  NORMAL: 'normal',
  DASH: 'dash',
  HURT: 'hurt',
  DEAD: 'dead',
  WIN: 'win',
};

export class Player {
  constructor(x, y) {
    this.w = P.W;
    this.h = P.H;
    this.reset(x, y);
  }

  reset(x, y) {
    this.x = x - this.w / 2;
    this.y = y - this.h;
    this.prevY = this.y;
    this.vx = 0; this.vy = 0;
    this.dir = 1;
    this.state = PSTATE.NORMAL;
    this.hp = P.MAX_HP;
    this.onGround = false;
    this.wasOnGround = false;
    this.coyote = 0;
    this.buffer = 0;
    this.jumpHeld = false;
    this.jumpCutDone = true;
    this.canJump = true;
    this.dashTime = 0;
    this.dashCd = 0;
    this.dashDir = 1;
    this.dashGrace = 0;
    this.invuln = 0;
    this.controlLock = 0;
    this.dead = false;
    this.deadT = 0;
    this.win = false;
    this.winT = 0;
    // Visual
    this.squash = 1;         // <1 = squashed, >1 = stretched
    this.squashTarget = 1;
    this.landImpact = 0;
    this.animT = 0;
    this.runTime = 0;
    this.blinkT = 0;
    this.blink = false;
    this.lastDustX = 0;
    this.stepPhase = 0;
    this.ridePlatform = null;
    this.facingLerp = 1;
    this.spawnX = x; this.spawnY = y;
    this.airTime = 0;
    this.jumpCount = 0;
    this.bounceLock = 0;
    this._fallSpeedAtLand = 0;
    this._trailT = 0;
    this.trail = [];             // dash afterimage samples {x,y,life}
  }

  // ---- Visual aliases used by the renderer ----
  // `squash` < 1 means flattened (landing), > 1 means stretched (jumping).
  get sx() { return 2 - this.squash; }
  get sy() { return this.squash; }
  get deathT() { return this.deadT; }

  get cx() { return this.x + this.w / 2; }
  get bottom() { return this.y + this.h; }
  get rect() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
  get cy() { return this.y + this.h / 2; }

  // ────────────────────────────────────────────────────────────── update

  update(dt, input, level, ctx) {
    this.animT += dt;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.controlLock > 0) this.controlLock -= dt;
    if (this.bounceLock > 0) this.bounceLock -= dt;
    if (this.dashCd > 0) this.dashCd -= dt;

    // Blink during invulnerability.
    if (this.invuln > 0) {
      this.blinkT += dt;
      this.blink = Math.floor(this.blinkT * 22) % 2 === 0;
    } else {
      this.blink = false;
      this.blinkT = 0;
    }

    if (this.state === PSTATE.DEAD) { this._updateDeath(dt); return; }
    if (this.state === PSTATE.WIN) { this._updateWin(dt); return; }

    this.wasOnGround = this.onGround;

    // ---- Timers ----
    if (this.onGround) {
      this.coyote = P.COYOTE;
      this.airTime = 0;
    } else {
      this.coyote = Math.max(0, this.coyote - dt);
      this.airTime += dt;
    }
    if (input.justPressed('jump')) this.buffer = P.BUFFER;
    else this.buffer = Math.max(0, this.buffer - dt);
    this.jumpHeld = input.isDown('jump');
    if (this.dashGrace > 0) this.dashGrace -= dt;
    this.resolveHurtState();

    // ---- Dash ----
    const wantDash = input.justPressed('dash');
    if (this.state === PSTATE.DASH) {
      this._updateDash(dt, level, ctx);
    } else if (wantDash && this.dashCd <= 0 && this.state !== PSTATE.HURT) {
      this._startDash(input, ctx);
    }

    // ---- Horizontal movement ----
    const moveLocked = this.state === PSTATE.HURT && this.controlLock > 0;
    let ax = moveLocked ? 0 : input.axisX();

    if (this.state !== PSTATE.DASH) {
      const grounded = this.onGround;
      const accel = grounded ? P.ACCEL_GROUND : P.ACCEL_AIR;
      const decel = grounded ? P.DECEL_GROUND : P.DECEL_AIR;

      if (ax !== 0) {
        const reversing = Math.sign(this.vx) !== 0 && Math.sign(this.vx) !== ax;
        const rate = accel * (reversing ? P.TURN_MULT : 1) * (moveLocked ? 0.25 : 1);
        this.vx = approach(this.vx, ax * P.MAX_RUN, rate * dt);
        if (this.controlLock <= 0) this.dir = ax;
      } else {
        // Friction. Snappier on ground so stops feel crisp.
        const before = this.vx;
        this.vx = approach(this.vx, 0, decel * dt * (moveLocked ? 0.4 : 1));
        if (Math.abs(this.vx) < P.FRICTION_STOP && Math.abs(before) < P.FRICTION_STOP * 2 && grounded) this.vx = 0;
      }
    }

    // ---- Jump ----
    const canCoyote = this.coyote > 0 || this.dashGrace > 0;
    if (this.buffer > 0 && canCoyote && this.state !== PSTATE.HURT) {
      this._doJump(ctx);
    }
    // Variable height: cut the arc when the button is released while rising.
    if (!this.jumpHeld && this.vy < 0 && !this.jumpCutDone) {
      this.vy *= P.JUMP_CUT;
      this.jumpCutDone = true;
      this.squashTarget = 1.06;
    }

    // ---- Gravity (with apex hang) ----
    if (this.state !== PSTATE.DASH || this.onGround) {
      let g = P.GRAVITY;
      if (this.vy > 0) g *= P.FALL_MULT;
      if (Math.abs(this.vy) < P.APEX_THRESHOLD && !this.onGround) g *= P.APEX_GRAV_MULT;
      // During an active dash we suppress gravity entirely (horizontal dash).
      if (this.state === PSTATE.DASH) g = 0;
      this.vy += g * dt;
      if (this.vy > P.MAX_FALL) this.vy = P.MAX_FALL;
    }

    // ---- Move & collide ----
    const dropThrough = input.isDown('down') && !this.onGround;
    const prevBottom = this.bottom;
    const res = level.moveEntity(this, dt, { dropThrough, ignorePlatforms: false });
    this.onGround = res.onGround;
    this.ridePlatform = res.onPlatform || null;

    // Ride moving platform (inherit its delta, applied next frame region).
    if (this.ridePlatform && this.onGround) {
      this.x += this.ridePlatform.dx;
      this.y += this.ridePlatform.dy;
      if (this.ridePlatform.kind === 'fall' && this.ridePlatform.fallState === 'idle') {
        this.ridePlatform.triggerFall();
      }
    }

    // ---- Landing ----
    if (this.onGround && !this.wasOnGround) {
      const impact = clamp(this._fallSpeedAtLand / 400, 0, 1);
      void prevBottom;
      if (impact > 0.22) {
        this._onLand(impact, ctx);
      } else {
        this.landImpact = impact;
      }
      this.squashTarget = 1 - 0.30 * impact;
      this.squash = this.squashTarget * 0.9;
      this.airTime = 0;
    }
    if (!this.onGround) this._fallSpeedAtLand = Math.max(0, this.vy);
    else this._fallSpeedAtLand = 0;

    // ---- Footstep dust while running ----
    if (this.onGround && Math.abs(this.vx) > 40) {
      this.stepPhase += Math.abs(this.vx) * dt * 0.09;
      if (this.stepPhase >= 1) {
        this.stepPhase = 0;
        ctx.particles.runDust(this.cx - Math.sign(this.vx) * 3, this.bottom, Math.sign(this.vx));
        ctx.audio.step();
      }
    } else if (this.onGround && Math.abs(this.vx) <= 40) {
      this.stepPhase = 0.85;
    }

    // ---- Squash/stretch spring ----
    this.squashTarget = damp(this.squashTarget, 1, 13, dt);
    this.squash = damp(this.squash, this.squashTarget, 19, dt);
    if (this.landImpact > 0) this.landImpact = Math.max(0, this.landImpact - dt * 3.4);

    // ---- Animation timing ----
    if (this.onGround && Math.abs(this.vx) > 6) {
      this.runTime += dt * clamp(Math.abs(this.vx) / P.MAX_RUN, 0.35, 1.35);
    } else if (this.onGround) {
      this.runTime = 0;
    }
    this.facingLerp = damp(this.facingLerp, this.dir, 22, dt);
  }

  _doJump(ctx) {
    this.vy = P.JUMP_VELOCITY;
    this.buffer = 0;
    this.coyote = 0;
    this.dashGrace = 0;
    this.onGround = false;
    this.jumpCutDone = false;
    this.squashTarget = 1.18;
    this.squash = 1.16;
    this.jumpCount++;
    ctx.particles.jumpPuff(this.cx, this.bottom);
    ctx.audio.jump();
    ctx.onPlayerJump?.();
  }

  _startDash(input, ctx) {
    this.state = PSTATE.DASH;
    this.dashTime = P.DASH_TIME;
    this.dashCd = P.DASH_COOLDOWN;
    this.dashDir = this.dir;
    // Keep a little vertical momentum so dashes off ledges feel intentional.
    this.vy = clamp(this.vy * 0.25, -60, 60);
    this.vx = this.dashDir * P.DASH_SPEED;
    this.squashTarget = 0.86;
    ctx.particles.dashBurst(this.cx - this.dashDir * 5, this.cy, this.dashDir);
    ctx.audio.dash();
    ctx.onDash?.();
    void input;
  }

  _updateDash(dt, level, ctx) {
    this.dashTime -= dt;
    // Slight decay so the dash lands rather than stopping dead.
    const t = clamp(1 - this.dashTime / P.DASH_TIME, 0, 1);
    this.vx = this.dashDir * P.DASH_SPEED * (1 - 0.22 * t);
    this.vy = 0;

    // Trail
    this._trailT = (this._trailT || 0) + dt;
    if (this._trailT > 0.022) {
      this._trailT = 0;
      ctx.particles.dashTrail(this.cx, this.cy, this.w * 0.5, this.h * 0.4, this.dashDir);
    }

    const res = level.moveEntity(this, dt, { ignorePlatforms: false });
    this.onGround = res.onGround;
    if (res.hitX !== 0) this.dashTime = Math.min(this.dashTime, 0.04);

    if (this.dashTime <= 0) {
      this.state = PSTATE.NORMAL;
      this.vx = this.dashDir * P.DASH_END_SPEED;
      this.dashGrace = P.DASH_GRACE;
      this.squashTarget = 1.1;
      ctx.particles.dashBurst(this.cx + this.dashDir * 4, this.cy, -this.dashDir);
    }
  }

  _onLand(impact, ctx) {
    this.landImpact = impact;
    ctx.particles.landDust(this.cx, this.bottom, impact);
    ctx.audio.land(impact);
    ctx.camera.shake(impact * 2.6);
    ctx.onPlayerLand?.(impact);
  }

  _updateDeath(dt) {
    this.deadT += dt;
    this.vy += 900 * dt;
    this.y += this.vy * dt;
    this.x += this.vx * dt;
    this.vx *= 0.98;
    this.squash = 1;
  }

  _updateWin(dt) {
    this.winT += dt;
    this.vx = approach(this.vx, 0, 400 * dt);
    this.state = PSTATE.WIN;
  }

  // ────────────────────────────────────────────────────────────── damage

  damage(fromX, ctx) {
    if (this.invuln > 0 || this.dead || this.state === PSTATE.DEAD || this.state === PSTATE.WIN) return false;
    this.hp -= 1;
    const dir = Math.sign(this.cx - fromX) || (this.dir > 0 ? -1 : 1);
    if (this.hp <= 0) {
      this.kill(ctx);
      return true;
    }
    this.state = PSTATE.HURT;
    this.controlLock = P.CONTROL_LOCK;
    this.invuln = P.INVULN;
    this.vx = dir * P.KNOCKBACK_X;
    this.vy = P.KNOCKBACK_Y;
    this.squashTarget = 1.22;
    ctx.particles.hurtBurst(this.cx, this.cy);
    ctx.audio.hurt();
    ctx.camera.shake(5.5);
    ctx.onPlayerHurt?.();
    // Return to normal quickly; normal state handles gravity next frame.
    this._hurtRecover = true;
    return true;
  }

  kill(ctx) {
    if (this.dead) return;
    this.dead = true;
    this.hp = 0;
    this.state = PSTATE.DEAD;
    this.deadT = 0;
    this.vy = -190;
    this.vx = 0;
    ctx.particles.deathBurst(this.cx, this.cy);
    ctx.audio.death();
    ctx.camera.shake(7);
    ctx.onPlayerDeath?.();
  }

  /** Called by the level after `damage` while in HURT state. */
  resolveHurtState() {
    if (this.state === PSTATE.HURT && this.controlLock <= 0) {
      this.state = PSTATE.NORMAL;
    }
  }

  bounce(power, ctx) {
    this.vy = -power;
    this.state = PSTATE.NORMAL;
    this.jumpCutDone = true;
    this.bounceLock = 0.1;
    this.onGround = false;
    this.squashTarget = 1.25;
    this.squash = 1.2;
    ctx.particles.bounceBurst(this.cx, this.bottom);
    ctx.audio.bounce();
  }

  stompBounce(ctx) {
    // Bounce off an enemy. Slightly lower than a fresh jump, plus full reset
    // of jump resources so chaining stomps feels good.
    const held = this.jumpHeld;
    this.vy = held ? P.JUMP_VELOCITY * 1.02 : P.JUMP_VELOCITY * 0.82;
    this.jumpCutDone = true;
    this.coyote = 0;
    this.dashGrace = 0;
    this.buffer = 0;
    this.squashTarget = 1.24;
    this.squash = 1.2;
    this.onGround = false;
    void ctx;
  }

  // ────────────────────────────────────────────────────────────── animation

  /** Returns {frames, index, flip, scaleX, scaleY, ox, oy} for the renderer. */
  resolveFrame() {
    const runFrames = 6;
    let set = 'idle';
    let idx = 0;

    if (this.state === PSTATE.DEAD) {
      set = 'death';
      idx = clamp(Math.floor(this.deadT / 0.085), 0, 3);
    } else if (this.state === PSTATE.WIN) {
      set = 'victory';
      idx = Math.floor(this.winT * 5) % 2;
    } else if (this.state === PSTATE.HURT || (this.invuln > 0 && this.invuln > P.INVULN - 0.2)) {
      set = 'hurt';
      idx = 0;
    } else if (this.state === PSTATE.DASH) {
      set = 'dash';
      idx = 0;
    } else if (!this.onGround) {
      if (this.vy < -20) { set = 'jump'; idx = 0; }
      else { set = 'fall'; idx = 0; }
    } else if (Math.abs(this.vx) > 6) {
      set = 'run';
      // Frame timing scales with speed for a proper run cycle.
      const speedNorm = clamp(Math.abs(this.vx) / P.MAX_RUN, 0.3, 1.3);
      idx = Math.floor(this.runTime * 11 * speedNorm) % runFrames;
    } else {
      set = 'idle';
      idx = Math.floor(this.animT * 3.2) % 3;
    }

    const stretchY = clamp(this.squash, 0.7, 1.35);
    const stretchX = clamp(2 - this.squash, 0.72, 1.3);

    return { set, idx, dir: this.dir, scaleX: stretchX, scaleY: stretchY };
  }
}

export { TILE };
