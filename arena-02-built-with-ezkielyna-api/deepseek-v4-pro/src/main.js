// main.js — game bootstrap and orchestration.

import { InputManager } from './input.js';
import { AudioManager } from './audio.js';
import { Camera } from './camera.js';
import { ParticleSystem } from './particles.js';
import { Renderer } from './renderer.js';
import { Player } from './player.js';
import { UIManager } from './ui.js';
import { LEVELS, TILE } from './levels.js';
import { parseLevel, solidAt, spikeAt, bounceAt, phaseAt } from './levelparser.js';
import { updateEnemies, stompEnemy, droneDie, enemyHitsPlayer } from './enemies.js';
import { loadSave, persistSave, DEFAULT_SETTINGS } from './save.js';
import { clamp, aabb, formatTime, rand } from './utils.js';

const GAME_W = 960;
const GAME_H = 540;

class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.input = new InputManager();
    this.save = loadSave();
    this.audio = new AudioManager(this.save.settings);
    this.camera = new Camera(GAME_W, GAME_H);
    this.particles = new ParticleSystem(500);
    this.particles.reducedMotion = this.save.settings.reducedMotion;
    this.camera.reducedMotion = this.save.settings.reducedMotion;
    this.camera.setScreenShake(this.save.settings.screenShake);
    this.ui = new UIManager(this);
    this.renderer = new Renderer(this.ctx, 1);

    this.state = 'menu';
    this.currentLevel = 0;
    this.level = null;
    this.player = null;
    this.levelTime = 0;
    this.deaths = 0;
    this.time = 0;
    this.freezeTimer = 0;
    this.phaseActive = true;
    this.phaseTimer = 0;
    this.towerProgress = 0;
    this.cpTime = 0;
    this.winDelay = undefined;

    this._last = 0;
    this._raf = 0;
    this._accum = 0;

    this.setupCanvas();
    this.setupInput();
    this.bindHUDButtons();
    this.bindGlobalMenuKeys();
    this.resize();
    window.addEventListener('resize', () => this.resize());

    this.showMainMenu();
    this.loop(performance.now());
  }

  setupCanvas() {
    this.canvas.width = GAME_W;
    this.canvas.height = GAME_H;
  }

  setupInput() {
    this.input.bind();
    // touch buttons
    this.input.bindTouchButton(document.getElementById('t-left'), 'left', true);
    this.input.bindTouchButton(document.getElementById('t-right'), 'right', true);
    this.input.bindTouchButton(document.getElementById('t-jump'), 'jump', false);
    this.input.bindTouchButton(document.getElementById('t-dash'), 'dash', false);
  }

  bindGlobalMenuKeys() {
    window.addEventListener('keydown', (e) => {
      if (e.code !== 'Enter' && e.code !== 'Space') return;
      if (this.state === 'playing') return;
      const panel = document.querySelector('.menu-panel');
      if (!panel) return;
      if (e.code === 'Space') e.preventDefault();
      const el = document.activeElement;
      if (el && panel.contains(el) && el.tagName === 'BUTTON') { el.click(); return; }
      const first = panel.querySelector('.menu-btn, .level-card, .toggle');
      if (first) first.click();
    });
  }

  bindHUDButtons() {
    document.getElementById('btn-pause').addEventListener('click', () => {
      if (this.state === 'playing') this.pause();
    });
  }

  resize() {
    const root = document.getElementById('game-root');
    const w = window.innerWidth;
    const h = window.innerHeight;
    const scale = Math.min(w / GAME_W, h / GAME_H);
    this.canvas.style.width = (GAME_W * scale) + 'px';
    this.canvas.style.height = (GAME_H * scale) + 'px';
    // HUD/menus scale with canvas container
    const hudEl = document.getElementById('hud');
    const menuRoot = document.getElementById('menu-root');
    const touch = document.getElementById('touch-controls');
    for (const el of [hudEl, menuRoot, touch]) {
      el.style.width = (GAME_W * scale) + 'px';
      el.style.height = (GAME_H * scale) + 'px';
      el.style.left = '50%';
      el.style.top = '50%';
      el.style.transform = 'translate(-50%, -50%)';
    }
  }

  // ---------- State transitions ----------
  showMainMenu() {
    this.state = 'menu';
    this.ui.hideHUD();
    this.audio.stopMusic();
    const panel = this.ui.menu();
    const title = document.createElement('div');
    title.className = 'game-title';
    title.textContent = 'PIXELBOUND';
    const sub = document.createElement('div');
    sub.className = 'game-subtitle';
    sub.textContent = 'Lost Signal';
    panel.appendChild(title);
    panel.appendChild(sub);
    panel.appendChild(this.ui.btn('PLAY', () => this.startLevel(this.firstUnlocked())));
    panel.appendChild(this.ui.btn('LEVEL SELECT', () => this.showLevelSelect()));
    panel.appendChild(this.ui.btn('HOW TO PLAY', () => this.showHowTo()));
    panel.appendChild(this.ui.btn('SETTINGS', () => this.showSettings(() => this.showMainMenu())));
  }

  firstUnlocked() {
    for (let i = 0; i < this.save.unlockedLevels.length; i++) {
      if (this.save.unlockedLevels[i]) return i;
    }
    return 0;
  }

  showLevelSelect() {
    this.state = 'menu';
    this.ui.hideHUD();
    const panel = this.ui.menu('', 'SELECT LEVEL');
    const grid = document.createElement('div');
    grid.className = 'level-grid';
    for (let i = 0; i < LEVELS.length; i++) {
      const lv = LEVELS[i];
      const unlocked = this.save.unlockedLevels[i];
      const card = document.createElement('button');
      card.className = 'level-card' + (unlocked ? '' : ' locked');
      card.tabIndex = unlocked ? 0 : -1;
      const name = document.createElement('div');
      name.className = 'lc-name';
      name.textContent = `${i + 1}. ${lv.name}`;
      const meta = document.createElement('div');
      meta.className = 'lc-meta';
      if (unlocked) {
        const bits = this.save.bestBits[i];
        const cores = this.save.bestCores[i];
        meta.textContent = this.save.completed[i]
          ? `Bits ${bits} · Cores ${cores}/3 · Best ${this.save.bestTimes[i] !== null ? formatTime(this.save.bestTimes[i]) : '--'}`
          : `Bits ${bits} · Cores ${cores}/3`;
      } else {
        meta.textContent = 'Locked — complete the previous level';
      }
      const status = document.createElement('div');
      status.className = 'lc-status';
      status.textContent = this.save.completed[i] ? 'CLEARED' : (unlocked ? 'READY' : 'LOCKED');      card.appendChild(name);
      card.appendChild(meta);
      card.appendChild(status);
      if (unlocked) {
        card.addEventListener('click', () => { this.audio.uiClick(); this.startLevel(i); });
      }
      grid.appendChild(card);
    }
    panel.appendChild(grid);
    panel.appendChild(this.ui.btn('BACK', () => this.showMainMenu()));
  }

  showHowTo() {
    const panel = this.ui.menu('', 'HOW TO PLAY');
    const list = document.createElement('div');
    list.className = 'howto-list';
    list.innerHTML = `
      <div><span class="key">A</span>/<span class="key">D</span> or <span class="key">←</span>/<span class="key">→</span> Move</div>
      <div><span class="key">SPACE</span>/<span class="key">W</span>/<span class="key">↑</span> Jump (hold for higher)</div>
      <div><span class="key">SHIFT</span> Dash</div>
      <div><span class="key">R</span> Restart · <span class="key">ESC</span> Pause</div>
      <div>Collect <b>Signal Bits</b> and hidden <b>Data Cores</b>.</div>
      <div>Stomp enemies by landing on them. Avoid spikes and lasers.</div>
      <div>Reach the <b>Signal Tower</b> to restore the signal!</div>
    `;
    panel.appendChild(list);
    panel.appendChild(this.ui.btn('BACK', () => this.showMainMenu()));
  }

  showSettings(back = () => this.showMainMenu()) {
    const s = this.save.settings;
    const panel = this.ui.menu('', 'SETTINGS');

    const makeSlider = (label, val, min, max, step, cb) => {
      const row = document.createElement('div');
      row.className = 'setting-row';
      const l = document.createElement('label');
      l.textContent = label;
      const inp = document.createElement('input');
      inp.type = 'range';
      inp.className = 'slider';
      inp.min = min; inp.max = max; inp.step = step;
      inp.value = val;
      inp.addEventListener('input', () => cb(parseFloat(inp.value)));
      row.appendChild(l);
      row.appendChild(inp);
      return row;
    };

    const makeToggle = (label, val, cb) => {
      const row = document.createElement('div');
      row.className = 'setting-row';
      const l = document.createElement('label');
      l.textContent = label;
      const t = document.createElement('button');
      t.className = 'toggle' + (val ? ' on' : '');
      t.setAttribute('role', 'switch');
      t.setAttribute('aria-checked', val ? 'true' : 'false');
      t.addEventListener('click', () => {
        const nv = !t.classList.contains('on');
        t.classList.toggle('on', nv);
        t.setAttribute('aria-checked', nv ? 'true' : 'false');
        cb(nv);
      });
      row.appendChild(l);
      row.appendChild(t);
      return row;
    };

    panel.appendChild(makeSlider('MUSIC', s.musicVolume, 0, 1, 0.05, (v) => {
      s.musicVolume = v; this.audio.setMusicVolume(v); this.persist();
    }));
    panel.appendChild(makeSlider('SFX', s.sfxVolume, 0, 1, 0.05, (v) => {
      s.sfxVolume = v; this.audio.setSfxVolume(v); this.persist();
    }));
    panel.appendChild(makeToggle('MUTE', s.muted, (v) => {
      s.muted = v; this.audio.setMuted(v); this.persist();
    }));
    panel.appendChild(makeToggle('SCREEN SHAKE', s.screenShake, (v) => {
      s.screenShake = v; this.camera.setScreenShake(v); this.persist();
    }));
    panel.appendChild(makeToggle('REDUCED MOTION', s.reducedMotion, (v) => {
      s.reducedMotion = v; this.particles.reducedMotion = v; this.camera.reducedMotion = v; this.persist();
    }));
    panel.appendChild(this.ui.btn('BACK', back));
  }

  persist() {
    persistSave(this.save);
  }

  // ---------- Level loading ----------
  startLevel(idx) {
    this.currentLevel = idx;
    this.deaths = 0;
    this.levelTime = 0;
    this.cpTime = 0;
    this.winDelay = undefined;
    this.phaseActive = true;
    this.phaseTimer = 0;
    this.towerProgress = 0;
    this.level = parseLevel(LEVELS[idx]);
    this.player = new Player(this.level.spawn, this);
    this.camera.x = clamp(this.player.x - GAME_W / 2, 0, this.level.width - GAME_W);
    this.camera.y = clamp(this.player.y - GAME_H / 2, 0, this.level.height - GAME_H);
    this.particles.clear();
    this.state = 'playing';
    this.ui.showHUD();
    this.ui.clearMenu();
    this.audio.resume();
    this.audio.startMusic();
    this.ui.updateHUD();
  }

  restartLevel() {
    const cp = this.level.checkpoints.find(c => c.activated);
    const spawn = cp ? { x: cp.x + TILE / 2 - 11, y: cp.y } : this.level.spawn;
    this.player.reset(spawn);
    this.resetLevelObjects();
    this.levelTime = this.cpTime ?? 0;
    this.phaseActive = true;
    this.phaseTimer = 0;
    this.particles.clear();
    this.state = 'playing';
    this.ui.showHUD();
    this.ui.clearMenu();
    this.audio.resume();
    this.audio.startMusic();
  }

  resetLevelObjects() {
    const lv = this.level;
    for (const fp of lv.fallingPlatforms) {
      fp.y = fp.baseY;
      fp.vy = 0;
      fp.shaking = 0;
      fp.falling = false;
      fp.dead = false;
    }
    for (const mp of lv.movingPlatforms) {
      mp.x = mp.baseX;
      mp.y = mp.baseY;
      mp.t = 0;
    }
    for (const e of lv.enemies) {
      if (e.dead) { e.dead = false; e.deathTimer = 0; e.x = e.baseX; e.y = e.baseY; e.vx = 0; e.vy = 0; }
    }
    for (const d of lv.drones) {
      if (d.dead) { d.dead = false; d.deathTimer = 0; d.x = d.baseX; d.y = d.baseY; }
    }
  }

  // ---------- Death / completion ----------
  onPlayerDeath() {
    this.deaths++;
    this.camera.shake(6, 0.3);
  }

  finishDeath() {
    // restart from checkpoint
    const cp = this.level.checkpoints.find(c => c.activated);
    const spawn = cp ? { x: cp.x + TILE / 2 - 11, y: cp.y } : this.level.spawn;
    this.player.reset(spawn);
    this.resetLevelObjects();
    this.levelTime = this.cpTime ?? 0;
    this.phaseActive = true;
    this.phaseTimer = 0;
    this.particles.clear();
  }

  gameOver() {
    // "SIGNAL LOST"
    this.state = 'gameover';
    this.audio.stopMusic();
    const panel = this.ui.menu('', 'SIGNAL LOST');
    const sub = document.createElement('div');
    sub.className = 'menu-sub';
    sub.textContent = 'The connection broke. Try again, courier.';
    panel.appendChild(sub);
    panel.appendChild(this.ui.btn('RETRY', () => this.restartLevel()));
    panel.appendChild(this.ui.btn('LEVEL SELECT', () => this.showLevelSelect()));
  }

  levelComplete() {
    this.state = 'complete';
    this.audio.stopMusic();
    this.audio.towerActivate();
    // save progress
    const bits = this.level.bits.filter(b => b.collected).length;
    const cores = this.level.cores.filter(c => c.collected).length;
    const idx = this.currentLevel;
    if (this.save.bestBits[idx] < bits) this.save.bestBits[idx] = bits;
    if (this.save.bestCores[idx] < cores) this.save.bestCores[idx] = cores;
    if (this.save.bestTimes[idx] === null || this.levelTime < this.save.bestTimes[idx]) {
      this.save.bestTimes[idx] = this.levelTime;
    }
    this.save.completed[idx] = true;
    if (idx + 1 < LEVELS.length) this.save.unlockedLevels[idx + 1] = true;
    this.persist();

    const panel = this.ui.menu('', 'SIGNAL RESTORED');
    const stats = document.createElement('div');
    stats.className = 'complete-stats';
    stats.innerHTML = `
      <div class="stat"><div class="sv">${formatTime(this.levelTime)}</div><div class="sl">TIME</div></div>
      <div class="stat"><div class="sv">${bits} / ${this.level.bitTotal}</div><div class="sl">SIGNAL BITS</div></div>
      <div class="stat"><div class="sv">${cores} / 3</div><div class="sl">DATA CORES</div></div>
      <div class="stat"><div class="sv">${this.deaths}</div><div class="sl">DEATHS</div></div>
    `;
    panel.appendChild(stats);
    if (idx + 1 < LEVELS.length) {
      panel.appendChild(this.ui.btn('NEXT LEVEL', () => this.startLevel(idx + 1), 'primary'));
    }
    panel.appendChild(this.ui.btn('REPLAY', () => this.startLevel(idx)));
    panel.appendChild(this.ui.btn('LEVEL SELECT', () => this.showLevelSelect()));
  }

  // ---------- Pause ----------
  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.audio.stopMusic();
    const panel = this.ui.menu('', 'PAUSED');
    panel.appendChild(this.ui.btn('RESUME', () => this.resume()));
    panel.appendChild(this.ui.btn('RESTART LEVEL', () => this.restartLevel()));
    panel.appendChild(this.ui.btn('SETTINGS', () => this.showSettings(() => this.pause())));
    panel.appendChild(this.ui.btn('MAIN MENU', () => this.showMainMenu()));
  }
  resume() {
    this.state = 'playing';
    this.ui.clearMenu();
    this.ui.showHUD();
    this.audio.resume();
    this.audio.startMusic();
  }

  // ---------- Main loop ----------
  loop(now) {
    this._raf = requestAnimationFrame((t) => this.loop(t));
    let dt = (now - this._last) / 1000;
    this._last = now;
    if (dt > 0.05) dt = 0.05;
    if (dt <= 0) return;

    this.time += dt;

    if (this.state === 'playing') {
      this.update(dt);
    }

    this.render();
    this.input.endFrame();
  }

  update(dt) {
    // pause / restart hotkeys
    if (this.input.pausePressed()) {
      this.pause();
      this.input.endFrame();
      return;
    }
    if (this.input.restartPressed()) {
      this.restartLevel();
      this.input.endFrame();
      return;
    }

    // freeze (impact pause)
    if (this.freezeTimer > 0) {
      this.freezeTimer -= dt;
      this.input.endFrame();
      return;
    }

    const p = this.player;
    const lv = this.level;
    this.levelTime += dt;

    // level platform/timer updates
    this.updateLevel(dt);

    // player
    p.update(dt, this.input);

    // collectibles
    this.checkCollectibles();

    // enemies
    updateEnemies(this, dt);
    this.checkEnemyCollisions();

    // checkpoints
    this.checkCheckpoints();

    // tower
    this.checkTower(dt);

    // death handled
    if (p.dead && p.deathTimer > 0.9) {
      this.finishDeath();
      this.gameOver();
      return;
    }

    // win
    if (p.won && this.towerProgress >= 1) {
      if (this.winDelay === undefined) this.winDelay = 1.2;
      this.winDelay -= dt;
      if (this.winDelay <= 0) {
        this.winDelay = undefined;
        this.levelComplete();
        return;
      }
    }

    // camera
    this.camera.update(dt, p.x + p.w / 2, p.y + p.h / 2, p.dir, lv.width, lv.height);

    // particles
    this.particles.update(dt);

    // UI
    this.ui.updateHUD();
  }

  updateLevel(dt) {
    const lv = this.level;
    // moving platforms
    for (const mp of lv.movingPlatforms) {
      const prevX = mp.x, prevY = mp.y;
      if (mp.type === 'horizontal') {
        mp.x = mp.baseX + Math.sin(mp.t) * mp.range;
        mp.t += (mp.speed / mp.range) * dt * 0.3;
      } else {
        mp.y = mp.baseY + Math.sin(mp.t) * mp.range;
        mp.t += (mp.speed / mp.range) * dt * 0.3;
      }
      mp.dx = mp.x - prevX;
      mp.dy = mp.y - prevY;
    }

    // falling platforms
    for (const fp of lv.fallingPlatforms) {
      if (fp.dead) continue;
      if (fp.falling) {
        fp.vy += 1500 * dt;
        fp.y += fp.vy * dt;
        if (fp.y > lv.height + 200) fp.dead = true;
      } else if (fp.shaking > 0) {
        fp.shaking -= dt;
        if (fp.shaking <= 0) {
          fp.falling = true;
          fp.vy = 0;
        }
      }
      if (!fp.falling && fp.y < fp.baseY) {
        fp.y = Math.min(fp.baseY, fp.y + 30 * dt);
      }
    }

    // phase platforms rhythm
    this.phaseTimer += dt;
    const cycle = 2.4;
    this.phaseActive = (this.phaseTimer % cycle) < (cycle * 0.6);
    for (const pp of lv.phasePlatforms) {
      pp.active = this.phaseActive;
    }

    // lasers
    for (const l of lv.lasers) {
      l.t += dt;
      l.active = (l.t % l.period) < l.period * 0.5;
    }
  }

  checkCollectibles() {
    const p = this.player;
    const lv = this.level;
    const pcx = p.x + p.w / 2, pcy = p.y + p.h / 2;
    for (const b of lv.bits) {
      if (b.collected) continue;
      const dx = pcx - b.x, dy = pcy - b.y;
      if (dx * dx + dy * dy < 22 * 22) {
        b.collected = true;
        this.audio.collect();
        this.particles.burst(b.x, b.y, 8, {
          color: '#7fe7ff', speedMin: 40, speedMax: 120, lifeMax: 0.45, gravity: 200, type: 'spark',
        });
        this.ui.updateHUD();
      }
    }
    for (const c of lv.cores) {
      if (c.collected) continue;
      const dx = pcx - c.x, dy = pcy - c.y;
      if (dx * dx + dy * dy < 26 * 26) {
        c.collected = true;
        this.audio.core();
        this.particles.burst(c.x, c.y, 16, {
          color: '#ff8c42', speedMin: 50, speedMax: 160, lifeMax: 0.6, gravity: 200,
        });
        this.camera.shake(3, 0.2);
        this.ui.updateHUD();
      }
    }
  }

  checkEnemyCollisions() {
    const p = this.player;
    const lv = this.level;
    if (p.dead || p.won) return;

    for (const e of lv.enemies) {
      if (e.dead) continue;
      if (!enemyHitsPlayer(e, p)) continue;
      // stomp check: player falling and above enemy
      if (p.vy > 0 && (p.y + p.h) < (e.y + e.h / 2)) {
        stompEnemy(this, e);
        p.vy = -340; // bounce
        p.vx *= 0.5;
      } else {
        p.hurt({ x: (p.x + p.w / 2 < e.x + e.w / 2 ? -1 : 1) * 180, y: -180 });
        this.ui.updateHUD();
      }
    }
    // drones
    for (const d of lv.drones) {
      if (d.dead) continue;
      if (aabb(p.x, p.y, p.w, p.h, d.x, d.y, 24, 24)) {
        droneDie(this, d);
        p.hurt({ x: (p.x < d.x ? -1 : 1) * 180, y: -180 });
        this.ui.updateHUD();
      }
    }
    // lasers
    for (const l of lv.lasers) {
      if (!l.active) continue;
      if (l.dir === 'h') {
        if (aabb(p.x, p.y, p.w, p.h, l.x, l.y + 8, l.len, 16)) {
          p.hurt({ x: 0, y: -180 });
          this.audio.laser();
          this.ui.updateHUD();
        }
      } else {
        if (aabb(p.x, p.y, p.w, p.h, l.x - 2, l.y, 4, l.len)) {
          p.hurt({ x: 0, y: -180 });
          this.audio.laser();
          this.ui.updateHUD();
        }
      }
    }
  }

  checkCheckpoints() {
    const p = this.player;
    const lv = this.level;
    for (const cp of lv.checkpoints) {
      if (cp.activated) continue;
      if (aabb(p.x, p.y, p.w, p.h, cp.x, cp.y, TILE, TILE)) {
        cp.activated = true;
        this.cpTime = this.levelTime;
        this.audio.checkpoint();
        this.particles.burst(cp.x + 16, cp.y + 2, 14, {
          color: '#7fe7ff', speedMin: 40, speedMax: 140, lifeMax: 0.6, gravity: 100,
        });
      }
    }
  }

  checkTower(dt) {
    const p = this.player;
    const lv = this.level;
    const t = lv.tower;
    if (t.active) {
      if (t.progress < 1) {
        t.progress += dt; // ~1 second activation
        if (t.progress > 1) t.progress = 1;
      }
      this.towerProgress = t.progress;
      return;
    }
    if (aabb(p.x, p.y, p.w, p.h, t.x - 10, t.y - 60, TILE + 20, TILE + 60)) {
      t.active = true;
      t.progress = 0;
      p.won = true;
      this.audio.towerActivate();
      this.camera.shake(4, 0.4);
    }
  }

  freeze(t) {
    this.freezeTimer = Math.max(this.freezeTimer, t);
  }

  render() {
    const viewW = GAME_W;
    const viewH = GAME_H;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (this.state === 'menu' || this.state === 'gameover' || this.state === 'complete' || this.state === 'paused') {
      // draw a dimmed game behind menus if a level exists
      if (this.level && this.state !== 'menu') {
        this.renderer.render(this, viewW, viewH);
        this.ctx.fillStyle = 'rgba(10,14,26,0.6)';
        this.ctx.fillRect(0, 0, viewW, viewH);
      } else {
        this.renderer.renderMenuBackdrop(this, viewW, viewH);
      }
      return;
    }
    if (this.level) {
      this.renderer.render(this, viewW, viewH);
    }
  }
}

// Boot
const game = new Game();
window.__game = game;
