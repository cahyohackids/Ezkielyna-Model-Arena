import { InputManager } from './core/InputManager.js';
import { AudioManager } from './core/AudioManager.js';
import { SaveSystem } from './core/SaveSystem.js';
import { Camera } from './core/Camera.js';
import { ParticleSystem } from './core/ParticleSystem.js';
import { UIManager } from './ui/UIManager.js';
import { Level } from './game/Level.js';
import { Player } from './game/Player.js';
import { Background } from './game/Background.js';
import { LEVELS } from './game/levels.js';
import { PAL } from './core/Renderer.js';

const VIEW_W = 480;
const VIEW_H = 270;
const FIXED_DT = 1 / 60;

// Game state machine:
//   'menu' | 'playing' | 'paused' | 'gameover' | 'complete' | 'level-select'
export class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    this.ctx.imageSmoothingEnabled = false;

    this.save = new SaveSystem();
    this.audio = new AudioManager();
    this.audio.setSettings(this.save.getSettings());
    this.input = new InputManager(this.canvas, document.getElementById('touch-controls'));
    this.ui = new UIManager(this.save);
    this.particles = new ParticleSystem(460);
    this.camera = new Camera(VIEW_W, VIEW_H);
    this.camera.reducedMotion = this.save.getSettings().reduced;

    this.state = 'menu';
    this.levelIndex = 0;
    this.level = null;
    this.player = null;
    this.background = null;

    this.bits = 0;
    this.cores = 0;
    this.coresFound = [false, false, false];
    this.deaths = 0;
    this.levelTime = 0;
    this.checkpoint = null;
    this._hintShown = new Set();
    this._completeT = 0;
    this._deathDelay = 0;
    this._towerActiveT = 0;
    this._lastUiNav = 0;

    this._bindUI();
    this._setupCanvas();
    this._detectTouch();

    this._loop = this._loop.bind(this);
    this._acc = 0;
    this._lastTime = 0;
  }

  start() {
    this.ui.showMenu('main-menu');
    requestAnimationFrame(this._loop);
  }

  // ----------------------------------------------------------
  _setupCanvas() {
    const resize = () => {
      // The canvas keeps a fixed internal resolution; CSS scales it with
      // object-fit: contain so pixels stay crisp and aspect is preserved.
      this._detectTouch();
    };
    window.addEventListener('resize', resize);
  }

  _detectTouch() {
    const hasTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    const small = Math.min(window.innerWidth, window.innerHeight) < 700;
    this._touchAvailable = hasTouch && small;
    if (this.state !== 'playing') {
      this.ui.showTouch(false);
    }
  }

  _bindUI() {
    this.ui.onAction = (action, payload) => this._handleMenuAction(action, payload);
    this.ui.onSettingsChange = (settings) => {
      this.audio.setSettings(settings);
      this.camera.reducedMotion = settings.reduced;
      if (settings.reduced) { this.camera.shakeAmp = 0; this.camera.shakeT = 0; }
    };
  }

  _handleMenuAction(action, payload) {
    this.audio.init();
    this.audio.resume();
    switch (action) {
      case 'play': {
        // start at the first unlocked-but-uncleared level, else level 1
        let idx = 0;
        for (let i = 0; i < this.save.levelCount; i++) {
          if (this.save.isUnlocked(i) && !this.save.data.levels[i].completed) { idx = i; break; }
        }
        this.startLevel(idx);
        break;
      }
      case 'levels': this.ui.showMenu('level-select'); break;
      case 'howto': this.ui.showMenu('howto-menu'); break;
      case 'settings': this.ui.showMenu('settings-menu'); break;
      case 'back-main': this.audio.uiBack(); this.ui.showMenu('main-menu'); break;
      case 'back-prev': this.audio.uiBack(); this.ui.showMenu(this.ui._prevMenu || 'main-menu'); break;
      case 'resume': this.resumeGame(); break;
      case 'restart': this.audio.uiSelect(); this.startLevel(this.levelIndex); break;
      case 'main-menu': this.goToMainMenu(); break;
      case 'retry': this.audio.uiSelect(); this.respawnAtCheckpoint(true); break;
      case 'next': {
        const next = Math.min(LEVELS.length - 1, this.levelIndex + 1);
        this.audio.uiSelect();
        this.startLevel(next);
        break;
      }
      case 'start-level': {
        const card = payload.button.closest('.level-card');
        const idx = Number(card.dataset.level);
        if (!this.save.isUnlocked(idx)) { this.audio.uiBack(); return; }
        this.audio.uiSelect();
        this.startLevel(idx);
        break;
      }
      case 'none': break;
      case 'pause': this.pauseGame(); break;
    }
  }

  goToMainMenu() {
    this.audio.uiBack();
    this.state = 'menu';
    this.ui.showHUD(false);
    this.ui.showTouch(false);
    this.audio.stopMusic();
    this.ui.showMenu('main-menu');
  }

  // ----------------------------------------------------------
  startLevel(index) {
    this.levelIndex = index;
    this.level = new Level(index);
    this.player = new Player(this.level.spawn.x, this.level.spawn.y, this.audio, this.particles, this.camera);
    this.player.collision.setLevel(this.level);
    this.background = new Background(this.level.bg);
    this.camera.setLevel(this.level.width, this.level.height);
    this.camera.snapTo(this.player.x, this.player.y);
    this.particles.clear();

    this.bits = 0;
    this.cores = 0;
    this.coresFound = [false, false, false];
    this.deaths = 0;
    this.levelTime = 0;
    this.checkpoint = null;
    this._completeT = 0;
    this._deathDelay = 0;
    this._towerActiveT = 0;
    this._hintShown.clear();

    this.state = 'playing';
    this.ui.hideMenus();
    this.ui.showHUD(true);
    this.ui.setHealth(this.player.health);
    this.ui.setBits(0, this.level.totalBits);
    this.ui.setCores(0, this.level.totalCores);
    this.ui.setDash(true, 1);
    if (this.level.hint) this.ui.showHint(this.level.hint, 3600);
    this.ui.showTouch(!!this._touchAvailable);

    this.audio.init();
    this.audio.resume();
    this.audio.startMusic(index);
  }

  pauseGame() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.ui.showMenu('pause-menu');
    this.audio.uiMove();
  }

  resumeGame() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.ui.hideMenus();
    this.ui.showTouch(!!this._touchAvailable);
    this.input.reset();
  }

  // ----------------------------------------------------------
  respawnAtCheckpoint(fromGameover) {
    if (!this.level || !this.player) return;
    const target = this.checkpoint || this.level.spawn;
    this.player.reset(target.x, target.y);
    this.state = 'playing';
    this.ui.hideMenus();
    this.ui.showHUD(true);
    this.ui.setHealth(this.player.health);
    this.ui.showTouch(!!this._touchAvailable);
    this.input.reset();
    if (fromGameover) this.deaths = Math.max(this.deaths, this.deaths); // deaths already counted
  }

  // ----------------------------------------------------------
  _loop(timestamp) {
    requestAnimationFrame(this._loop);
    if (!this._lastTime) this._lastTime = timestamp;
    let frameTime = (timestamp - this._lastTime) / 1000;
    this._lastTime = timestamp;
    if (frameTime > 0.25) frameTime = 0.25; // avoid huge steps after tab switch

    // fixed timestep accumulator: deterministic physics, smooth rendering
    this._acc += frameTime;
    let steps = 0;
    while (this._acc >= FIXED_DT && steps < 5) {
      this._fixedUpdate(FIXED_DT);
      this._acc -= FIXED_DT;
      steps++;
    }
    if (steps === 5) this._acc = 0;

    this._render();
  }

  _fixedUpdate(dt) {
    const time = performance.now() / 1000;

    // global key handling
    if (this.input.consumePause()) {
      if (this.state === 'playing') this.pauseGame();
      else if (this.state === 'paused') this.resumeGame();
    }
    if (this.input.consumeRestart() && (this.state === 'playing' || this.state === 'paused')) {
      this.startLevel(this.levelIndex);
      return;
    }

    if (this.state !== 'playing') {
      this.input.consumeJump();
      this.input.consumeDash();
      this._handleMenuKeys();
      return;
    }

    this.levelTime += dt;
    this._updatePlaying(dt, time);
  }

  _handleMenuKeys() {
    const ui = this.input.consumeUI();
    if (ui.confirm) {
      const active = document.activeElement;
      if (active && active.classList.contains('mbtn')) {
        active.click();
        this.audio.uiSelect();
      } else if (active && active.classList.contains('level-card')) {
        active.click();
      } else {
        // focus first button in current menu
        const menu = this.ui.menus[this.ui.currentMenu];
        if (menu) {
          const first = menu.querySelector('.mbtn, .level-card:not(.locked)');
          if (first) first.focus({ preventScroll: true });
        }
      }
    }
    if (ui.back && this.ui.currentMenu && this.ui.currentMenu !== 'main-menu') {
      this._handleMenuAction('back-prev', {});
    }
    if (ui.up || ui.down || ui.left || ui.right) {
      this._focusNext(ui.down || ui.right ? 1 : -1);
      this.audio.uiMove();
    }
  }

  _focusNext(dir) {
    const menu = this.ui.menus[this.ui.currentMenu];
    if (!menu) return;
    const items = Array.from(menu.querySelectorAll('.mbtn, .level-card:not(.locked)'));
    if (!items.length) return;
    const idx = items.indexOf(document.activeElement);
    const next = items[(idx + dir + items.length) % items.length];
    if (next) next.focus({ preventScroll: true });
  }

  // ----------------------------------------------------------
  _updatePlaying(dt, time) {
    const player = this.player;
    const level = this.level;

    // delayed transition to game over after death animation
    if (player.dead) {
      this._deathDelay += dt;
      player.update(dt, this.input, level, this.camera);
      level.update(dt, time, player);
      this.particles.update(dt);
      this.camera.update(dt, player.x, player.y, player.vx);
      if (this._deathDelay > 1.5) {
        this._deathDelay = 0;
        this.state = 'gameover';
        this.ui.showMenu('gameover-menu');
        this.ui.showTouch(false);
      }
      return;
    }

    // tower activation sequence
    if (player.win) {
      this._towerActiveT += dt;
      player.update(dt, this.input, level, this.camera);
      level.update(dt, time, player);
      this.particles.update(dt);
      this.camera.update(dt, level.tower.x + 20, level.tower.y + 20, 0);
      if (this._towerActiveT > 2.9) {
        this._finishLevel();
        return;
      }
      return;
    }

    const events = player.update(dt, this.input, level, this.camera);
    level.update(dt, time, player);
    this.particles.update(dt);
    this.background.update(dt);
    this.camera.update(dt, player.x, player.y, player.vx);

    // ---- handle player events ----
    for (const ev of events) this._handleEvent(ev, time);

    // ---- collectibles ----
    for (const b of level.bits) {
      if (!b.collected && b.intersects(player)) {
        b.collected = true;
        this.bits++;
        this.audio.pickup();
        this.ui.setBits(this.bits, level.totalBits);
        this.particles.burst(b.cx, b.cy, 6, {
          color: PAL.teal, speed: 55, life: 0.45, size: 2, gravity: 120, spread: Math.PI * 2,
        });
      }
    }
    for (const c of level.cores) {
      if (!c.collected && c.intersects(player)) {
        c.collected = true;
        const idx = level.cores.indexOf(c);
        if (idx >= 0 && idx < 3) this.coresFound[idx] = true;
        this.cores++;
        this.audio.core();
        this.ui.setCores(this.cores, level.totalCores);
        this.camera.shake(2, 0.2);
        this.particles.burst(c.cx, c.cy, 16, {
          color: PAL.orange, speed: 90, life: 0.8, size: 3, gravity: 60, spread: Math.PI * 2,
        });
        this.ui.showHint('DATA CORE RECOVERED', 1800);
      }
    }

    // ---- checkpoints ----
    for (const cp of level.checkpoints) {
      if (!cp.active && cp.intersects(player)) {
        if (cp.activate()) {
          this.checkpoint = { x: cp.x - 2, y: cp.y - 16 };
          player.setSpawn(this.checkpoint.x, this.checkpoint.y);
          this.audio.checkpoint();
          this.camera.shake(1.5, 0.2);
          this.particles.burst(cp.x + 6, cp.y + 4, 14, {
            color: PAL.teal, speed: 70, life: 0.7, size: 2, gravity: -40, spread: Math.PI * 2,
          });
          this.ui.showHint('CHECKPOINT ONLINE', 1600);
        }
      }
    }

    // ---- enemies ----
    for (const e of level.enemies) {
      if (e.dead || e.dying) continue;
      if (!e.intersects(player)) continue;
      // stomp: player falling and their bottom is above the enemy's midline
      const stomp = player.vy > 0 && (player.y + player.h) < (e.y + e.h * 0.65);
      if (stomp) {
        e.startDeath();
        player.vy = -230;
        player.squashX = 1.3; player.squashY = 0.7;
        player._frozen = 0.05; // impact freeze
        this.audio.stomp();
        this.camera.shake(2.5, 0.18);
        this.particles.burst(e.cx, e.cy, 10, {
          color: PAL.danger, speed: 85, life: 0.5, size: 2, gravity: 200, spread: Math.PI * 2,
        });
      } else {
        this._damagePlayer(e.cx);
      }
    }

    // ---- hazards ----
    for (const hz of level.hazards) {
      const hit = hz.hit;
      if (!hit) continue;
      if (hz.on === false) continue; // lasers only damage while emitting
      if (player.x < hit.x + hit.w && player.x + player.w > hit.x &&
          player.y < hit.y + hit.h && player.y + player.h > hit.y) {
        this._damagePlayer(hz.cx || hit.x);
      }
    }

    // ---- tower ----
    if (level.tower && !level.tower.active) {
      const tr = level.tower.triggerRect;
      if (player.x < tr.x + tr.w && player.x + player.w > tr.x &&
          player.y < tr.y + tr.h && player.y + player.h > tr.y) {
        if (level.tower.activate()) {
          player.win = true;
          player.winT = 0;
          this.audio.complete();
          this.camera.shake(4, 0.5);
          this.particles.burst(level.tower.x + 20, level.tower.y + 10, 40, {
            color: PAL.teal, speed: 140, life: 1.2, size: 3, gravity: -30, spread: Math.PI * 2,
          });
        }
      }
    }

    // ---- HUD ----
    this.ui.setHealth(player.health);
    this.ui.setDash(player.dashCd <= 0, 1 - player.dashCd / player.dashCooldown);
  }

  _handleEvent(ev, time) {
    const player = this.player;
    switch (ev.type) {
      case 'jump':
        this.audio.jump();
        this.particles.burst(player.x + player.w / 2, player.y + player.h, 5, {
          color: PAL.creamDim, speed: 40, life: 0.35, size: 2, gravity: 150, spread: Math.PI * 0.8, angle: -Math.PI / 2,
        });
        break;
      case 'land': {
        this.audio.land();
        this.particles.burst(player.x + player.w / 2, player.y + player.h, 7, {
          color: PAL.creamDim, speed: 55, life: 0.4, size: 2, gravity: 140, spread: Math.PI * 0.9, angle: -Math.PI / 2,
        });
        if (ev.impact > 260) this.camera.shake(Math.min(3, ev.impact / 220), 0.15);
        break;
      }
      case 'dash':
        this.audio.dash();
        this.camera.shake(1.2, 0.1);
        this.particles.burst(player.x + player.w / 2, player.y + player.h / 2, 10, {
          color: PAL.teal, speed: 60, life: 0.4, size: 2, gravity: 0, spread: Math.PI * 0.6, angle: player.dashDir > 0 ? Math.PI : 0,
        });
        break;
      case 'trail': {
        this.particles.emit({
          x: player.x + player.w / 2, y: player.y + player.h / 2,
          vx: -player.dashDir * 20, vy: 0,
          life: 0.22, size: 4, color: PAL.teal, gravity: 0, drag: 0.9,
        });
        break;
      }
      case 'dust':
        this.particles.emit({
          x: player.x + (player.vx > 0 ? 2 : player.w - 2), y: player.y + player.h - 1,
          vx: -player.vx * 0.12 + (Math.random() - 0.5) * 12, vy: -Math.random() * 18,
          life: 0.3, size: 2, color: PAL.creamDim, gravity: 120, drag: 0.9,
        });
        break;
      case 'bounce':
        if (ev.platform) {
          ev.platform.bounce();
          this.audio.bounce();
          this.particles.burst(player.x + player.w / 2, player.y + player.h, 10, {
            color: PAL.orange, speed: 90, life: 0.5, size: 2, gravity: 200, spread: Math.PI, angle: -Math.PI / 2,
          });
          // launch the player up
          player.vy = ev.platform.bouncePower;
          player.onGround = false;
          player.squashX = 0.7; player.squashY = 1.35;
        }
        break;
      case 'pit':
        this._killPlayer();
        break;
    }
  }

  _damagePlayer(fromX) {
    if (!this.player.takeDamage(fromX, this.audio, this.particles, this.camera)) return;
    this.ui.setHealth(this.player.health);
    if (this.player.dead) {
      this.deaths++;
      this._deathDelay = 0;
    }
  }

  _killPlayer() {
    if (this.player.dead) return;
    this.player.health = 0;
    this.player.takeDamage(this.player.x, this.audio, this.particles, this.camera);
    this.deaths++;
    this._deathDelay = 0;
    this.ui.setHealth(0);
  }

  // ----------------------------------------------------------
  _finishLevel() {
    const idx = this.levelIndex;
    const prevBest = this.save.data.levels[idx].bestTime;
    const newBest = prevBest === null || this.levelTime < prevBest;
    this.save.recordCompletion(idx, this.levelTime, this.bits, this.level.totalBits, this.cores, this.coresFound);
    if (idx + 1 < LEVELS.length) this.save.unlock(idx + 1);
    this.audio.stopMusic();

    this.state = 'complete';
    this.ui.showHUD(false);
    this.ui.showTouch(false);
    this.ui.showComplete({
      levelIndex: idx,
      time: this.levelTime,
      bits: this.bits,
      bitsTotal: this.level.totalBits,
      cores: this.cores,
      deaths: this.deaths,
      newBest,
    });
  }

  // ----------------------------------------------------------
  _render() {
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;

    if (!this.level || !this.player) {
      // menu backdrop: animated digital horizon
      this._renderMenuBackdrop();
      return;
    }

    const time = performance.now() / 1000;

    this.background.render(ctx, this.camera, this.level.width, this.level.height);
    this.level.render(ctx, this.camera, time);
    this.player.render(ctx, this.camera, time);
    this.particles.render(ctx, this.camera);

    // tower activation flash overlay
    if (this.player.win && this._towerActiveT < 1.2) {
      const f = Math.max(0, 1 - this._towerActiveT / 1.2);
      ctx.fillStyle = PAL.teal;
      ctx.globalAlpha = f * 0.28;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.globalAlpha = 1;
    }

    // death fade
    if (this.player.dead) {
      const t = Math.min(1, this.player.deathT / 1.4);
      ctx.fillStyle = PAL.dark;
      ctx.globalAlpha = t * 0.6;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.globalAlpha = 1;
    }

    // paused dim
    if (this.state === 'paused') {
      ctx.fillStyle = PAL.dark;
      ctx.globalAlpha = 0.5;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.globalAlpha = 1;
    }
  }

  _renderMenuBackdrop() {
    const ctx = this.ctx;
    const t = performance.now() / 1000;
    const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    grad.addColorStop(0, '#0d1226');
    grad.addColorStop(0.6, '#182042');
    grad.addColorStop(1, '#243a63');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    // horizon line
    ctx.fillStyle = PAL.tealDim;
    ctx.fillRect(0, VIEW_H * 0.72, VIEW_W, 1);
    // distant towers
    for (let i = 0; i < 9; i++) {
      const x = i * 56 + 14;
      const h = 40 + ((i * 37) % 60);
      ctx.fillStyle = '#1a2148';
      ctx.fillRect(x, VIEW_H * 0.72 - h, 30, h);
      ctx.fillStyle = PAL.tealDim;
      for (let w = 6; w < h - 6; w += 12) {
        if ((i * 7 + w) % 17 < 6) ctx.fillRect(x + 13, VIEW_H * 0.72 - h + w, 2, 2);
      }
    }
    // drifting motes
    for (let i = 0; i < 24; i++) {
      const x = ((i * 61 + t * (8 + (i % 3) * 4)) % (VIEW_W + 20)) - 10;
      const y = (i * 11 + Math.sin(t + i) * 6) % (VIEW_H * 0.7);
      ctx.fillStyle = PAL.teal;
      ctx.globalAlpha = 0.2 + 0.15 * Math.sin(t * 2 + i);
      ctx.fillRect(x, y, i % 5 === 0 ? 2 : 1, i % 5 === 0 ? 2 : 1);
    }
    ctx.globalAlpha = 1;
    // ground silhouette
    ctx.fillStyle = '#0b0f1c';
    ctx.fillRect(0, VIEW_H * 0.72, VIEW_W, VIEW_H * 0.28);
    ctx.fillStyle = PAL.deep;
    ctx.fillRect(0, VIEW_H * 0.72, VIEW_W, 2);
  }
}
