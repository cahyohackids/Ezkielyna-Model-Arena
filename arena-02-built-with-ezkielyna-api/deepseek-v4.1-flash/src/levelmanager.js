// levelmanager.js — owns the live level + player + run state for a stage.
// Handles: entity interactions, checkpoint activation, collectible pickup,
// hazard damage, goal detection, death/respawn, per-run stats.

import { Level } from './level.js';
import { Player, PSTATE } from './player.js';
import { Save } from './save.js';
import { getLevelData } from './levels.js';
import { rectsOverlap } from './math.js';
import { TILE } from './tiles.js';

export const RUN_STATE = {
  PLAYING: 'playing',
  DYING: 'dying',
  COMPLETE: 'complete',
  GAMEOVER: 'gameover',
};

/** A no-op input used while the player is dying or celebrating. */
const NEUTRAL_INPUT = {
  isDown: () => false,
  justPressed: () => false,
  axisX: () => 0,
};

export class LevelManager {
  constructor(ctx, audio, particles) {
    this.ctx = ctx;
    this.audio = audio;
    this.particles = particles;
    this.level = null;
    this.player = null;
    this.state = RUN_STATE.PLAYING;
    this.runStats = null;
    this.onEvent = null;         // (name, payload) hook for the game shell
    this.deathFreeze = 0;
    this.hitFreeze = 0;
    this.respawnDelay = 0;
    this.completeTimer = 0;
    this._dashPressCd = 0;
    this._comboCount = 0;
    this._comboTimer = 0;
    /** Signal integrity: how many more times PIP can respawn this run before
     *  the carrier is lost for good. Checkpoints top it back up, so a careful
     *  player never sees SIGNAL LOST. */
    this.integrity = 5;
    this.maxIntegrity = 6;
    this.gameOver = false;
  }

  /** Start (or restart) a level from scratch. */
  start(levelId, { fresh = true } = {}) {
    const data = getLevelData(levelId);
    this.level = new Level(data);
    this.player = new Player(this.level.spawn.x, this.level.spawn.y);
    this.levelId = levelId;
    this.state = RUN_STATE.PLAYING;
    this.gameOver = false;
    this.integrity = 5;
    this.maxIntegrity = 6;
    // Checkpoints: the spawn acts as checkpoint 0.
    this.nextCheckpointId = 0;
    this._bankedBits = new Set();
    this._bankedCores = new Set();
    this.completeTimer = 0;
    this.goalState = 'idle';
    this.hitFreeze = 0;
    this.deathFreeze = 0;
    this.lastSafe = { x: this.level.spawn.x, y: this.level.spawn.y };
    if (fresh || !this.runStats) {
      this.runStats = {
        time: 0, deaths: 0, bits: 0, cores: 0,
        totalBits: this.level.totalBits(), totalCores: this.level.totalCores(),
        secrets: 0,
      };
      this._initClearedSecrets();
    } else {
      this.runStats.totalBits = this.level.totalBits();
      this.runStats.totalCores = this.level.totalCores();
    }
    this.audio.setMusic('level');
    return this;
  }

  _initClearedSecrets() {
    this.clearedSecrets = new Set();
    // (integrity is tracked separately; see constructor)
  }

  /** Context object handed to entities each frame. */
  get entityCtx() {
    if (!this._ctx) {
      this._ctx = {
        particles: this.particles,
        audio: this.audio,
        camera: this._cameraRef,
        onEnemyDefeated: (e) => this._onEnemyDefeated(e),
        onEnemyCharge: (e) => this._onEnemyCharge(e),
        onPlayerHurt: () => this._onPlayerHurt(),
        onPlayerDeath: () => this._onPlayerDeath(),
        onPlayerJump: () => {},
        onPlayerLand: (i) => this._onPlayerLand(i),
        onDash: () => {},
      };
    }
    // `player` is resolved live: Player is recreated on every level start.
    this._ctx.player = this.player;
    return this._ctx;
  }

  attachCamera(cam) {
    this._cameraRef = cam;
    if (this._ctx) this._ctx.camera = cam;
  }

  _playerCtx() {
    if (!this._ctx) void this.entityCtx;
    this._ctx.player = this.player;
    this._ctx.camera = this._cameraRef;
    return this._ctx;
  }

  // ─────────────────────────────────────────────────── main update

  update(dt, input) {
    const ctx = this._playerCtx();
    const p = this.player;
    const lvl = this.level;

    if (this.state === RUN_STATE.PLAYING) this.runStats.time += dt;

    // Hit-freeze: brief global pause for impact punctuation.
    if (this.hitFreeze > 0) {
      this.hitFreeze -= dt;
      this.particles.update(dt * 0.25);
      return;
    }

    // Always tick visual-only timers.
    for (const b of lvl.bits) b.update(dt);
    for (const c of lvl.cores) c.update(dt);
    for (const cp of lvl.checkpoints) cp.update(dt);

    if (this.state === RUN_STATE.COMPLETE) {
      this.completeTimer += dt;
      p.update(dt, NEUTRAL_INPUT, lvl, ctx);
      lvl.update(dt, ctx);
      this._emitGoalParticles(dt);
      return;
    }

    if (this.state === RUN_STATE.DYING) {
      this.deathFreeze -= dt;
      p.update(dt, NEUTRAL_INPUT, lvl, ctx);
      lvl.update(dt, ctx);
      this.particles.update(dt);
      if (this.deathFreeze <= 0) {
        if (this.integrity > 0) this._respawn();
        else this._signalLost();
      }
      return;
    }

    if (this.state === RUN_STATE.GAMEOVER) {
      // Freeze the world; the shell renders the SIGNAL LOST screen over it.
      this.particles.update(dt);
      return;
    }

    // ---- Normal play ----
    p.update(dt, input, lvl, ctx);
    lvl.update(dt, ctx);
    this._collectPickups();
    this._checkCheckpoints();
    this._checkEnemies(dt);
    this._checkHazards();
    this._checkPlatformTouches();
    this._checkSecrets();
    this._checkGoal();
    this._checkFallOut();
    this._updateCombo(dt);

    // Level tile damage (spikes)
    if (lvl.boxHitsHazard(p.x + 1, p.y + 1, p.w - 2, p.h - 2)) {
      this._hurtPlayer(p.cx + (p.dir > 0 ? 10 : -10));
    }
  }

  // ─────────────────────────────────────────────────── interactions

  _collectPickups() {
    const p = this.player;
    const pr = p.rect;
    for (const b of this.level.bits) {
      if (b.collected) continue;
      if (Math.abs(b.x - p.cx) < p.w / 2 + b.r && Math.abs(b.y - (p.y + p.h / 2)) < p.h / 2 + b.r) {
        b.collected = true;
        this.runStats.bits++;
        this._comboCount++;
        this._comboTimer = 1.1;
        this.particles.pickup(b.x, b.y);
        this.audio.coin(Math.min(this._comboCount, 10));
        this.onEvent?.('bit', { x: b.x, y: b.y });
      }
    }
    for (const c of this.level.cores) {
      if (c.collected) continue;
      if (Math.abs(c.x - p.cx) < p.w / 2 + c.r && Math.abs(c.y - (p.y + p.h / 2)) < p.h / 2 + c.r) {
        c.collected = true;
        this.runStats.cores++;
        this.particles.corePickup(c.x, c.y);
        this.audio.coreCollect();
        this.onEvent?.('core', { x: c.x, y: c.y });
      }
    }
  }

  _checkCheckpoints() {
    const p = this.player;
    const pr = p.rect;
    for (const cp of this.level.checkpoints) {
      if (cp.triggered) continue;
      const cr = cp.rect();
      if (rectsOverlap(pr, cr)) {
        cp.triggered = true;
        cp.active = true;
        // Light up every earlier checkpoint too (they're now behind you).
        for (const other of this.level.checkpoints) {
          if (other.id <= cp.id) other.active = true;
        }
        this.lastSafe = { x: cp.x, y: cp.y };
        this.nextCheckpointId = Math.max(this.nextCheckpointId, cp.id);
        this.particles.checkpointBurst(cp.x, cp.y - 12);
        this.integrity = Math.min(this.maxIntegrity, this.integrity + 2);
        this.audio.checkpoint();
        this.onEvent?.('checkpoint', { id: cp.id });
      }
    }
  }

  _checkEnemies(dt) {
    const p = this.player;
    if (p.state === PSTATE.DEAD || p.state === PSTATE.WIN) return;
    const pr = p.rect;
    for (const e of this.level.enemies) {
      if (e.dead) continue;
      const hr = e.hurtbox();
      if (!hr) continue;
      if (!rectsOverlap(pr, hr)) continue;

      // Determine if this is a stomp: player falling and feet above centre.
      const playerBottom = p.y + p.h;
      const enemyMid = e.y + e.h * 0.45;
      const falling = p.vy > 40;
      const fromAbove = playerBottom <= enemyMid + 6;

      if (falling && fromAbove && e.stompable) {
        e.stomp(this._playerCtx());
        p.stompBounce(this._playerCtx());
        this.hitFreeze = 0.055;
        this._cameraRef?.shake(3.2);
        this.audio.stomp();
        this.onEvent?.('stomp', { x: e.x, y: e.y });
      } else if (p.state === PSTATE.DASH && !e.stompable) {
        // Dash through armoured enemies without taking damage (skill reward).
        continue;
      } else {
        this._hurtPlayer(e.x + e.w / 2);
      }
    }
    void dt;
  }

  _checkHazards() {
    const p = this.player;
    const pr = p.rect;
    for (const hz of this.level.hazards) {
      if (hz.lethal === false) continue;
      if (rectsOverlap(pr, hz.rect())) {
        this._hurtPlayer(hz.x + hz.w / 2);
      }
    }
  }

  _checkPlatformTouches() {
    // Bounce pads give an upward launch when the player lands on top.
    const p = this.player;
    for (const pf of this.level.platforms) {
      if (!pf.active) continue;
      const r = pf.rect();
      const onTop = p.bottom >= r.y - 2 && p.bottom <= r.y + 6;
      const overlapX = p.x + p.w > r.x + 1 && p.x < r.x + r.w - 1;
      if (pf.kind === 'bounce' && overlapX && onTop && p.vy >= -10) {
        p.bounce(pf.speed, this._playerCtx());
        pf.animT = 0;
      }
    }
  }

  _checkSecrets() {
    const p = this.player;
    for (const s of this.level.secrets) {
      if (s.found) continue;
      const dx = p.cx - s.x, dy = p.y + p.h / 2 - s.y;
      if (dx * dx + dy * dy < 28 * 28) {
        s.found = true;
        this.clearedSecrets.add(s.name);
        this.runStats.secrets++;
        this.onEvent?.('secret', { name: s.name, x: s.x, y: s.y });
      }
    }
  }

  _checkGoal() {
    const p = this.player;
    const g = this.level.goal;
    const gr = { x: g.x, y: g.y, w: g.w, h: g.h };
    if (p.state === PSTATE.WIN) return;
    if (rectsOverlap(p.rect, gr)) {
      p.state = PSTATE.WIN;
      p.win = true;
      p.winT = 0;
      this.state = RUN_STATE.COMPLETE;
      this.completeTimer = 0;
      this.goalState = 'active';
      this.audio.towerActive();
      this._cameraRef?.shake(4);
      this.onEvent?.('goal', {});
    }
  }

  _checkFallOut() {
    const p = this.player;
    if (p.y > this.level.tiles.h * TILE + 40) {
      if (p.state !== PSTATE.DEAD) {
        p.kill(this._playerCtx());
      }
    }
  }

  _emitGoalParticles(dt) {
    this._goalParticleT = (this._goalParticleT || 0) + dt;
    if (this._goalParticleT > 0.03) {
      this._goalParticleT = 0;
      const g = this.level.goal;
      this.particles.towerBeam(g.x + g.w / 2, g.y - 20, this.completeTimer);
    }
    this.particles.update(dt);
  }

  _updateCombo(dt) {
    if (this._comboTimer > 0) {
      this._comboTimer -= dt;
      if (this._comboTimer <= 0) this._comboCount = 0;
    }
  }

  _onEnemyDefeated(e) {
    const colors = e.constructor.name === 'StaticDrone' ? [245, 197, 66]
      : e.constructor.name === 'CorruptBug' ? [192, 66, 79]
        : [167, 111, 214];
    this.particles.enemyPop(e.x + e.w / 2, e.y + e.h / 2, colors);
    this._cameraRef?.shake(2.4);
    this.onEvent?.('enemyDefeated', { x: e.x, y: e.y });
  }

  _onEnemyCharge(e) {
    this.audio.enemyHit();
    this.particles.spawn({
      x: e.x + e.w / 2, y: e.y, vx: 0, vy: -20, life: 0.3, size: 3, grow: 26,
      color: [240, 122, 114], kind: 3, drag: 8,
    });
  }

  _onPlayerLand(impact) {
    void impact;
  }

  _onPlayerHurt() {
    this.hitFreeze = 0.05;
  }

  _onPlayerDeath() {
    this.state = RUN_STATE.DYING;
    this.deathFreeze = 1.15;
    this.runStats.deaths++;
    this.integrity = Math.max(0, this.integrity - 1);
    this._cameraRef?.shake(7);
    Save.updateTotals(this.levelId, this.runStats.bits, this.runStats.cores, this.runStats.totalBits);
    this.onEvent?.('death', {});
  }

  _hurtPlayer(fromX) {
    const p = this.player;
    if (p.invuln > 0 || p.dead) return;
    const died = p.damage(fromX, this._playerCtx());
    if (!died) {
      this.hitFreeze = 0.09;
    }
  }

  _respawn() {
    const p = this.player;
    const lvl = this.level;
    // Bank which bits/cores were already picked up, then reset the world so
    // enemies return to their posts. Collectibles stay taken (classic-friendly:
    // a death never costs you progress you already earned).
    if (!this._bankedBits) { this._bankedBits = new Set(); this._bankedCores = new Set(); }
    for (const b of lvl.bits) if (b.collected) this._bankedBits.add(b);
    for (const c of lvl.cores) if (c.collected) this._bankedCores.add(c);

    lvl.resetDynamic();

    for (const b of lvl.bits) if (this._bankedBits.has(b)) b.collected = true;
    for (const c of lvl.cores) if (this._bankedCores.has(c)) c.collected = true;
    for (const cp of lvl.checkpoints) if (cp.id <= this.nextCheckpointId) { cp.active = true; cp.triggered = true; }

    p.reset(this.lastSafe.x, this.lastSafe.y);
    this.state = RUN_STATE.PLAYING;
    this.onEvent?.('respawn', {});
  }

  /** Integrity exhausted: the carrier drops and the run is over. */
  _signalLost() {
    if (this.gameOver) return;
    this.gameOver = true;
    this.state = RUN_STATE.GAMEOVER;
    this._cameraRef?.shake(9);
    this.onEvent?.('gameover', {});
  }

  /** Force a respawn (used by the R key). */
  forceRespawn() {
    if (this.state === RUN_STATE.DYING) {
      this.deathFreeze = 0;
      if (this.integrity > 0) this._respawn();
      else this._signalLost();
    } else if (this.state === RUN_STATE.PLAYING) {
      this.player.kill(this._playerCtx());
    }
  }

  /** Hard restart: rebuild the level entirely. */
  hardRestart() {
    const id = this.levelId;
    this.start(id, { fresh: true });
  }

  get finished() { return this.state === RUN_STATE.COMPLETE; }
}
