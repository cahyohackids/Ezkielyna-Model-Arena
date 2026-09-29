// game.js — the application shell: state machine, fixed canvas scaling,
// input routing, screen rendering, and the main loop.
//
// States: BOOT → MENU → LEVELSELECT / HOWTO / SETTINGS / PLAY → PAUSE /
//         GAMEOVER / COMPLETE

import { Input } from './input.js';
import { AudioManager } from './audio.js';
import { SpriteAtlas } from './sprites.js';
import { ParticleSystem } from './particles.js';
import { Camera } from './camera.js';
import { Renderer } from './render.js';
import { LevelManager, RUN_STATE } from './levelmanager.js';
import { Player, PSTATE } from './player.js';
import { Save } from './save.js';
import { LEVELS, getLevelData } from './levels.js';
import {
  HUD, Toasts, Menu, VW, VH,
  layoutMainMenu, layoutLevelSelect, layoutPause, layoutSettings,
  layoutGameOver, layoutLevelComplete,
  drawPanel, drawButton, drawSlider, drawCheckbox,
} from './ui.js';
import { clamp, damp, formatTime } from './math.js';

export const STATE = {
  BOOT: 'boot',
  MENU: 'menu',
  LEVELSELECT: 'levelselect',
  HOWTO: 'howto',
  SETTINGS: 'settings',
  PLAY: 'play',
  PAUSE: 'pause',
  GAMEOVER: 'gameover',
  COMPLETE: 'complete',
};

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.ctx.imageSmoothingEnabled = false;

    this.atlas = new SpriteAtlas(2);
    this.audio = new AudioManager();
    this.input = new Input();
    this.particles = new ParticleSystem();
    this.camera = new Camera(VW, VH);
    this.renderer = new Renderer(this.ctx, this.atlas);
    this.hud = new HUD();
    this.toasts = new Toasts();
    this.lm = new LevelManager(this.ctx, this.audio, this.particles);
    this.lm.attachCamera(this.camera);
    this.lm.onEvent = (name, payload) => this._onGameEvent(name, payload);

    this.state = STATE.MENU;
    this.menu = layoutMainMenu();
    this.prevState = STATE.MENU;
    this.transition = 0;
    this.transitionTo = null;

    this.settingsReturn = STATE.MENU;
    this.time = 0;
    this.frameTimes = [];
    this.fps = 60;

    this._pointer = { x: -999, y: -999, down: false, clicked: false };
    this._bindPointer();

    this.applySettings();
    this.audio.setMusic('menu');
    void Player;
    void RUN_STATE;
  }

  // ─────────────────────────────────────────────────────────── settings

  applySettings() {
    const s = Save.settings();
    this.audio.setVolumes(s.music, s.sfx, s.muted);
    if (typeof this.audio.refreshMusic === 'function' && this.audio.ready) this.audio.refreshMusic();
    this.camera.shakeEnabled = s.screenShake;
    this.renderer.reducedMotion = s.reducedMotion;
    this.particles.reducedMotion = s.reducedMotion;
  }

  // ─────────────────────────────────────────────────────────── pointer↔canvas

  _bindPointer() {
    const c = this.canvas;
    const toVirtual = (e) => {
      const r = c.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * VW;
      const y = ((e.clientY - r.top) / r.height) * VH;
      return { x, y };
    };
    c.addEventListener('pointermove', (e) => {
      const p = toVirtual(e);
      this._pointer.x = p.x;
      this._pointer.y = p.y;
    });
    c.addEventListener('pointerdown', (e) => {
      const p = toVirtual(e);
      this._pointer.x = p.x; this._pointer.y = p.y;
      this._pointer.down = true;
      this._pointer.clicked = true;
      c.setPointerCapture?.(e.pointerId);
    });
    c.addEventListener('pointerup', () => { this._pointer.down = false; });
    c.addEventListener('pointercancel', () => { this._pointer.down = false; });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // ─────────────────────────────────────────────────────────── state changes

  setState(next) {
    if (this.state === next) return;
    // Cleanup for the state we're leaving.
    if (this.state === STATE.PLAY) this.input.clearTouchVisuals();
    this.state = next;
    this.transition = 0;
    document.body.classList.toggle('playing', next === STATE.PLAY || next === STATE.PAUSE);
    switch (next) {
      case STATE.MENU:
        this.menu = layoutMainMenu();
        this.audio.setMusic('menu');
        break;
      case STATE.LEVELSELECT:
        this.menu = layoutLevelSelect();
        this.audio.setMusic('menu');
        break;
      case STATE.HOWTO:
        break;
      case STATE.SETTINGS:
        this.menu = layoutSettings();
        break;
      case STATE.PAUSE:
        this.menu = layoutPause();
        this.audio.setMusic('paused');
        break;
      case STATE.GAMEOVER:
        this.menu = layoutGameOver(true);
        this.audio.setMusic('lost');
        break;
      case STATE.COMPLETE:
        this.menu = layoutLevelComplete(this.lm.levelId < 3);
        break;
      default: break;
    }
  }

  startLevel(id) {
    const lid = clamp(Math.round(id) || 1, 1, 3);
    Save.setLastPlayed(lid);
    this.lm.start(lid, { fresh: true });
    this.renderer.buildBackground(getLevelData(lid).theme, this.lm.level.pixelW, this.lm.level.pixelH);
    this.camera.setBounds(this.lm.level.pixelW, this.lm.level.pixelH);
    this.camera.snapTo(this.lm.player.cx, this.lm.player.cy);
    this.hud = new HUD();
    this.toasts = new Toasts();
    this._completeDelay = 0;
    this._deadRun = false;
    const data = getLevelData(lid);
    this.toasts.push(data.name, { color: '#f2e7cf', life: 2.4 });
    this.audio.setMusic('level', data.songMood);
    this.setState(STATE.PLAY);
    this.audio.uiClick();
  }

  retryLevel() {
    const id = this.lm.levelId;
    this.lm.start(id, { fresh: true });
    this.renderer.buildBackground(getLevelData(id).theme, this.lm.level.pixelW, this.lm.level.pixelH);
    this.camera.setBounds(this.lm.level.pixelW, this.lm.level.pixelH);
    this.camera.snapTo(this.lm.player.cx, this.lm.player.cy);
    this.hud = new HUD();
    this.toasts = new Toasts();
    this._completeDelay = 0;
    this._deadRun = false;
    this.audio.setMusic('level', getLevelData(id).songMood);
    this.setState(STATE.PLAY);
  }

  // ─────────────────────────────────────────────────────────── events

  _onGameEvent(name, payload) {
    switch (name) {
      case 'checkpoint':
        this.toasts.push('CHECKPOINT ONLINE', { color: '#63d3c2' });
        break;
      case 'secret':
        this.toasts.push(`SECRET FOUND — ${payload.name}`, { color: '#f79a45', life: 2.6 });
        Save.addSecret(this.lm.levelId, payload.name);
        break;
      case 'core':
        this.toasts.push('DATA CORE RECOVERED', { color: '#f79a45' });
        break;
      case 'death':
        this.audio.signalLost();
        break;
      case 'gameover':
        this._completeDelay = 0;
        this.setState(STATE.GAMEOVER);
        break;
      case 'goal':
        this.audio.levelComplete();
        this._completeDelay = 1.9;
        break;
      default: break;
    }
  }

  // ─────────────────────────────────────────────────────────── update

  update(dt) {
    this.time += dt;
    this.transition = Math.min(1, this.transition + dt * 4);

    // FPS smoothing
    this.frameTimes.push(dt);
    if (this.frameTimes.length > 30) this.frameTimes.shift();
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.fps = avg > 0 ? 1 / avg : 60;

    const clicked = this._pointer.clicked;
    this._pointer.clicked = false;

    switch (this.state) {
      case STATE.MENU: this._updateMenu(dt, 'menu', clicked); break;
      case STATE.LEVELSELECT: this._updateLevelSelect(dt, clicked); break;
      case STATE.HOWTO: this._updateHowTo(dt, clicked); break;
      case STATE.SETTINGS: this._updateSettings(dt, clicked); break;
      case STATE.PLAY: this._updatePlay(dt); break;
      case STATE.PAUSE: this._updatePause(dt, clicked); break;
      case STATE.GAMEOVER: this._updateGameOver(dt, clicked); break;
      case STATE.COMPLETE: this._updateComplete(dt, clicked); break;
      default: break;
    }
    this.toasts.update(dt);
    this.audio.update(dt);
  }

  _menuNav(dt, clicked) {
    const m = this.menu;
    if (this.input.menuDown('menuUp') || this.input.justPressed('up')) { if (m.move(-1)) this.audio.uiMove(); }
    if (this.input.menuDown('menuDown') || this.input.justPressed('down')) { if (m.move(1)) this.audio.uiMove(); }
    if (this.input.menuDown('menuLeft') || this.input.justPressed('left')) { if (m.adjust(-1)) this.audio.uiMove(); }
    if (this.input.menuDown('menuRight') || this.input.justPressed('right')) { if (m.adjust(1)) this.audio.uiMove(); }

    // Pointer hover
    const hit = m.hitTest(this._pointer.x, this._pointer.y);
    if (hit >= 0 && hit !== m.index && !this.input.anyKeyActivity()) {
      m.index = hit;
    }
    if (hit >= 0 && clicked) {
      m.index = hit;
      return { activate: true, item: m.current };
    }
    if (this.input.menuDown('menuConfirm')) {
      this.audio.uiClick();
      return { activate: true, item: m.current };
    }
    void dt;
    return { activate: false };
  }

  _updateMenu(dt, click) {
    const r = this._menuNav(dt, click);
    if (r.activate && r.item) {
      switch (r.item.id) {
        case 'play':
          this.startLevel(Save.lastPlayed || 1);
          break;
        case 'levels':
          this.setState(STATE.LEVELSELECT);
          break;
        case 'how':
          this.setState(STATE.HOWTO);
          break;
        case 'settings':
          this.settingsReturn = STATE.MENU;
          this.setState(STATE.SETTINGS);
          break;
        default: break;
      }
    }
  }

  _updateLevelSelect(dt, clicked) {
    const r = this._menuNav(dt, clicked);
    if (r.activate && r.item) {
      if (r.item.id === 'back') { this.setState(STATE.MENU); return; }
      if (r.item.type === 'card' && !r.item.disabled) {
        this.startLevel(r.item.data);
      } else if (r.item.disabled) {
        this.audio.uiDeny();
      }
    }
  }

  _updateHowTo(dt, clicked) {
    void dt;
    if (this.input.justPressed('menuConfirm') || this.input.justPressed('menuBack') || clicked) {
      this.audio.uiClick();
      this.setState(STATE.MENU);
    }
  }

  _updateSettings(dt, clicked) {
    const m = this.menu;
    const r = this._menuNav(dt, clicked);
    const changed = this.input.justPressed('menuLeft') || this.input.justPressed('menuRight');
    void changed;
    if (r.activate && r.item) {
      if (r.item.id === 'back') {
        this.applySettings();
        Save.save();
        this.setState(this.settingsReturn);
        return;
      }
      if (r.item.type === 'checkbox') {
        r.item.value = r.item.value ? 0 : 1;
        this.audio.uiClick();
      }
    }
    if (this.input.justPressed('menuBack')) {
      this.applySettings(); Save.save();
      this.setState(this.settingsReturn);
      return;
    }
    this._pushSettingsLive();
  }

  _pushSettingsLive() {
    const m = this.menu;
    const get = (id) => m.items.find((i) => i.id === id);
    const s = {
      music: get('music').value,
      sfx: get('sfx').value,
      muted: !!get('muted').value,
      screenShake: !!get('screenShake').value,
      reducedMotion: !!get('reducedMotion').value,
      showFps: !!get('showFps').value,
    };
    Save.setSettings(s);
    this.applySettings();
  }

  _updatePlay(dt) {
    const lm = this.lm;
    const input = this.input;

    if (input.justPressed('pause')) {
      this.audio.uiClick();
      this.setState(STATE.PAUSE);
      return;
    }
    if (input.justPressed('restart')) {
      this.audio.uiClick();
      this.retryLevel();
      return;
    }

    lm.update(dt, input);
    this.camera.follow(lm.player, lm.level.pixelW, lm.level.pixelH, dt);
    this.hud.update(dt, lm, lm.player);
    this.particles.update(dt);

    if (lm.state === RUN_STATE.COMPLETE) {
      this._completeDelay -= dt;
      if (this._completeDelay <= 0) {
        this._finishLevel();
      }
    }
  }

  _finishLevel() {
    const lm = this.lm;
    const s = lm.runStats;
    Save.completeLevel(lm.levelId, {
      time: s.time, bits: s.bits, cores: s.cores, deaths: s.deaths, totalBits: s.totalBits,
    });
    Save.updateTotals(lm.levelId, s.bits, s.cores, s.totalBits);
    Save.unlockNext(lm.levelId);
    this.lastRun = { ...s };
    this._completeStart = this.time;
    this.setState(STATE.COMPLETE);
    this.audio.setMusic('complete');
  }

  _updatePause(dt, clicked) {
    if (this.input.justPressed('pause') || this.input.justPressed('menuBack')) {
      this.audio.uiClick();
      this.setState(STATE.PLAY);
      this.audio.setMusic('level', getLevelData(this.lm.levelId).songMood);
      return;
    }
    const r = this._menuNav(dt, clicked);
    if (r.activate && r.item) {
      switch (r.item.id) {
        case 'resume':
          this.setState(STATE.PLAY);
          this.audio.setMusic('level', getLevelData(this.lm.levelId).songMood);
          break;
        case 'restart':
          this.retryLevel();
          break;
        case 'settings':
          this.settingsReturn = STATE.PAUSE;
          this.setState(STATE.SETTINGS);
          break;
        case 'menu':
          this.setState(STATE.MENU);
          break;
        default: break;
      }
    }
  }

  _updateGameOver(dt, clicked) {
    const r = this._menuNav(dt, clicked);
    if (r.activate && r.item) {
      if (r.item.id === 'retry') this.retryLevel();
      else if (r.item.id === 'levels') this.setState(STATE.LEVELSELECT);
    }
  }

  _updateComplete(dt, clicked) {
    const r = this._menuNav(dt, clicked);
    if (r.activate && r.item) {
      switch (r.item.id) {
        case 'next': this.startLevel(Math.min(3, this.lm.levelId + 1)); break;
        case 'replay': this.startLevel(this.lm.levelId); break;
        case 'levels': this.setState(STATE.LEVELSELECT); break;
        default: break;
      }
    }
  }

  // ─────────────────────────────────────────────────────────── render

  render() {
    const ctx = this.ctx;
    ctx.save();
    switch (this.state) {
      case STATE.MENU: this._renderMenu(); break;
      case STATE.LEVELSELECT: this._renderLevelSelect(); break;
      case STATE.HOWTO: this._renderHowTo(); break;
      case STATE.SETTINGS: this._renderSettings(); break;
      case STATE.PLAY: this._renderPlay(ctx); break;
      case STATE.PAUSE: this._renderPlay(ctx); this._renderPause(); break;
      case STATE.GAMEOVER: this._renderPlay(ctx); this._renderGameOver(); break;
      case STATE.COMPLETE: this._renderPlay(ctx); this._renderComplete(); break;
      default: break;
    }
    ctx.restore();
  }

  _renderPlay(ctx) {
    const lm = this.lm;
    const cam = this.camera;
    cam.updateShake(1 / 60);

    ctx.fillStyle = '#05070e';
    ctx.fillRect(0, 0, VW, VH);

    this.renderer.drawBackground(cam);
    this.renderer.drawProps(lm.level, cam, lm.level.decor);
    this.renderer.drawTiles(lm.level, cam, lm.level.phaseT);
    this.renderer.drawCheckpoints(lm.level, cam);
    this.renderer.drawPlatforms(lm.level, cam);
    this.renderer.drawHazards(lm.level, cam);
    this.renderer.drawCollectibles(lm.level, cam, this.time);
    this.renderer.drawGoal(lm.level, cam, this.time, lm.state === RUN_STATE.COMPLETE ? 'active' : 'idle');
    this.renderer.drawSecretMarkers(lm.level, cam);

    // Enemies
    for (const e of lm.level.enemies) this._drawEnemy(e, cam);

    // Player
    this._drawPlayer(lm.player, cam);

    // Particles are drawn in world space; the system takes the camera for culling.
    this.particles.draw(ctx, cam);

    // HUD
    this.hud.draw(ctx, VW, VH, lm, lm.player, this.atlas);
    this.toasts.draw(ctx, VW, VH);

    if (Save.settings().showFps) {
      ctx.font = '8px "Courier New", ui-monospace, monospace';
      ctx.fillStyle = '#9df5e6';
      ctx.fillText(`${Math.round(this.fps)} FPS`, VW - 10 - 48, VH - 8);
    }
  }

  _drawPlayer(p, cam) {
    const at = this.atlas;
    const ctx = this.ctx;
    let img = null;
    const facingLeft = p.dir < 0;
    const f = (arr) => arr[facingLeft ? 'F' : ''];

    switch (p.state) {
      case PSTATE.DEAD: {
        const frames = p.win ? at.pipVictory : at.pipDeath;
        const idx = clamp(Math.floor(p.deathT * 7), 0, frames.length - 1);
        img = frames[idx];
        break;
      }
      case PSTATE.WIN: {
        const idx = Math.floor(this.time * 6) % at.pipVictory.length;
        img = at.pipVictory[idx];
        break;
      }
      case PSTATE.DASH:
        img = facingLeft ? at.pipDashF : at.pipDash;
        break;
      case PSTATE.HURT:
        img = facingLeft ? at.pipHurtF : at.pipHurt;
        break;
      default: {
        const airborne = p.onGround === false || p.state === PSTATE.JUMP || p.state === PSTATE.FALL;
        if (!p.onGround) {
          if (p.vy < -20) img = facingLeft ? at.pipJumpF : at.pipJump;
          else img = facingLeft ? at.pipFallF : at.pipFall;
        } else if (Math.abs(p.vx) > 8) {
          const idx = Math.floor(p.animT * 12) % at.pipRun.length;
          img = at.pipRun[idx];
          if (facingLeft) img = at.pipRunF[idx];
        } else {
          const idx = Math.floor(this.time * 3) % at.pipIdle.length;
          img = facingLeft ? at.pipIdleF[idx] : at.pipIdle[idx];
        }
        void airborne;
        break;
      }
    }
    void f;

    // Blink while invulnerable (respecting reduced-motion: slow fade instead).
    let alpha = 1;
    if (p.invuln > 0) {
      if (this.renderer.reducedMotion) alpha = 1;
      else alpha = (Math.floor(this.time * 18) % 2) === 0 ? 0.35 : 1;
    }

    // Dash afterimages
    if (p.state === PSTATE.DASH) {
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.globalCompositeOperation = 'lighter';
      for (const t of p.trail) {
        const a = clamp(1 - t.life / 0.2, 0, 1) * 0.4;
        ctx.globalAlpha = a;
        ctx.fillStyle = '#4fe0cb';
        ctx.fillRect(Math.round(t.x - 5 - cam.renderX), Math.round(t.y - 6 - cam.renderY), 10, 12);
      }
      ctx.restore();
    }

    // Squash/stretch about the feet.
    const sx = p.sx, sy = p.sy;
    const drawW = img.width * sx;
    const drawH = img.height * sy;
    const px = Math.round(p.cx - drawW / 2 - cam.renderX);
    const py = Math.round(p.bottom - drawH - cam.renderY);

    ctx.save();
    ctx.globalAlpha = alpha;
    // Soft shadow blob on the ground beneath when grounded/near ground
    if (p.onGround) {
      ctx.fillStyle = 'rgba(4,7,14,0.30)';
      ctx.beginPath();
      ctx.ellipse(p.cx - cam.renderX, p.bottom - cam.renderY + 1, 7 * sx, 2.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.drawImage(img, px, py, Math.ceil(drawW), Math.ceil(drawH));
    ctx.restore();
  }

  _drawEnemy(e, cam) {
    const at = this.atlas;
    const ctx = this.ctx;
    const sx = Math.round(e.x + e.w / 2 - cam.renderX);
    const sy = Math.round(e.y + e.h - cam.renderY);
    const flip = e.dir > 0;

    if (e.dead) {
      if (e.deathAnim === 'squash') {
        const k = clamp(e.deathT / 0.45, 0, 1);
        ctx.save();
        ctx.globalAlpha = 1 - k * 0.4;
        const img = e._lastImg || at.hopper[0];
        const w = img.width * (1 + k * 0.5);
        const h = img.height * (1 - k * 0.85);
        ctx.drawImage(img, sx - w / 2, sy - h, Math.max(1, w), Math.max(1, h));
        ctx.restore();
      }
      return;
    }

    let img = null;
    if (e.kind === 'hopper') {
      const idx = Math.floor(e.animT * 8) % at.hopper.length;
      img = flip ? at.hopperF[idx] : at.hopper[idx];
    } else if (e.kind === 'drone') {
      const idx = Math.floor(e.animT * 7) % at.drone.length;
      img = flip ? at.droneF[idx] : at.drone[idx];
    } else if (e.kind === 'bug') {
      const idx = Math.floor(e.animT * (e.state === 'charge' ? 16 : 9)) % at.bug.length;
      img = flip ? at.bugF[idx] : at.bug[idx];
    } else if (e.kind === 'sentinel') {
      img = at.sentinel;
    }
    if (!img) return;
    e._lastImg = img;

    // Warning flash before a bug charges
    if (e.kind === 'bug' && e.state === 'wind') {
      ctx.save();
      ctx.globalAlpha = 0.35 + 0.35 * Math.sin(this.time * 40);
      ctx.fillStyle = '#f07a72';
      ctx.beginPath();
      ctx.arc(sx, sy - e.h / 2, e.h * 0.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.drawImage(img, sx - img.width / 2, sy - img.height);

    // Drone hover glow
    if (e.kind === 'drone') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.10 + 0.05 * Math.sin(this.time * 6 + e.x);
      ctx.fillStyle = '#f5c542';
      ctx.beginPath();
      ctx.arc(sx, sy - e.h / 2, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // ─────────────────────────────────────────────────────────── menu screens

  _renderMenu() {
    const ctx = this.ctx;
    this._drawMenuBackdrop();
    const t = this.time;

    // Logo
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const bounce = Math.sin(t * 1.4) * 1.5;
    ctx.font = 'bold 34px "Courier New", ui-monospace, monospace';
    ctx.fillStyle = 'rgba(4,7,14,0.85)';
    ctx.fillText('PIXELBOUND', VW / 2 + 2, 44 + bounce + 2);
    ctx.fillStyle = '#f2e7cf';
    ctx.fillText('PIXELBOUND', VW / 2, 44 + bounce);
    ctx.fillStyle = '#4fe0cb';
    ctx.font = 'bold 34px "Courier New", ui-monospace, monospace';
    ctx.globalAlpha = 0.5;
    ctx.fillText('PIXELBOUND', VW / 2, 44 + bounce);
    ctx.globalAlpha = 1;

    ctx.font = '13px "Courier New", ui-monospace, monospace';
    ctx.fillStyle = '#f79a45';
    ctx.fillText('L O S T   S I G N A L', VW / 2, 70 + bounce * 0.6);

    // Static sweep line under the title
    const sw = 150;
    const sx = VW / 2 - sw / 2;
    const sweep = ((t * 0.7) % 1) * sw;
    ctx.fillStyle = '#2f4a7a';
    ctx.fillRect(sx, 82, sw, 1);
    ctx.fillStyle = '#4fe0cb';
    ctx.fillRect(sx + sweep - 12, 81, 12, 3);

    // Subtitle flavour
    ctx.font = '7px "Courier New", ui-monospace, monospace';
    ctx.fillStyle = 'rgba(189,176,149,0.7)';
    ctx.fillText('Courier unit PIP — restore the towers. Rebuild the signal.', VW / 2, 96);

    // Pip mascot doodle to the right of the menu
    const pip = this.atlas.pipIdle[Math.floor(t * 3) % this.atlas.pipIdle.length];
    const px = VW / 2 + 118;
    const py = 120 + Math.sin(t * 2) * 3;
    ctx.drawImage(pip, px, py);
    ctx.font = '6px "Courier New", ui-monospace, monospace';
    ctx.fillStyle = 'rgba(157,245,230,0.6)';
    ctx.fillText('PIP', px + pip.width / 2, py + pip.height + 8);

    // Buttons
    for (let i = 0; i < this.menu.items.length; i++) {
      const it = this.menu.items[i];
      const focused = i === this.menu.index;
      drawButton(ctx, it.label, it.x, it.y, it.w, it.h, {
        focused, hovered: it.hovered, sub: it.id === 'play' ? null : it.sub,
      });
      if (it.id === 'play') {
        ctx.font = '7px "Courier New", ui-monospace, monospace';
        ctx.fillStyle = 'rgba(157,245,230,0.7)';
        ctx.fillText(Save.isUnlocked(Save.lastPlayed) ? `CONTINUE — LEVEL ${Save.lastPlayed}` : 'START',
          it.x + it.w / 2, it.y + it.h + 8);
      }
    }

    // Progress summary
    const totalBits = LEVELS.reduce((a, l) => a + l.bits.length, 0);
    const got = LEVELS.reduce((a, l) => a + (Save.level(l.id).bits || 0), 0);
    const cores = LEVELS.reduce((a, l) => a + (Save.level(l.id).cores || 0), 0);
    ctx.font = '7px "Courier New", ui-monospace, monospace';
    ctx.fillStyle = 'rgba(189,176,149,0.75)';
    ctx.fillText(`SIGNAL BITS ${got}/${totalBits}     DATA CORES ${cores}/9`, VW / 2, VH - 26);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  _drawMenuBackdrop() {
    const ctx = this.ctx;
    const t = this.time;
    const g = ctx.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, '#0a1020');
    g.addColorStop(0.6, '#0d1830');
    g.addColorStop(1, '#070b16');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VW, VH);

    // Drifting grid horizon (perspective-ish rows)
    ctx.strokeStyle = 'rgba(47,74,122,0.30)';
    ctx.lineWidth = 1;
    const horizon = VH * 0.52;
    for (let i = 0; i < 12; i++) {
      const p = i / 12;
      const y = horizon + Math.pow(p, 1.9) * (VH - horizon) - (t * 12 % (VH - horizon) / 12) * 0;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(VW, y);
      ctx.stroke();
    }
    // Vertical grid lines converging to a vanishing point
    const vpx = VW / 2;
    for (let i = -14; i <= 14; i++) {
      const x = vpx + i * 46;
      ctx.beginPath();
      ctx.moveTo(vpx + i * 8, horizon);
      ctx.lineTo(x, VH);
      ctx.stroke();
    }

    // A few slow-rising ambient motes
    ctx.fillStyle = 'rgba(120,232,208,0.35)';
    for (let i = 0; i < 30; i++) {
      const seed = i * 97.13;
      const x = (seed * 13.7) % VW;
      const speed = 6 + (i % 5) * 3;
      const y = VH - ((seed * 3.1 + t * speed) % (VH + 40));
      const a = 0.1 + 0.4 * (1 - y / VH);
      ctx.globalAlpha = a;
      ctx.fillRect(Math.floor(x), Math.floor(y), 1 + (i % 2), 1 + (i % 2));
    }
    ctx.globalAlpha = 1;

    // Title glow disc behind the logo
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const rg = ctx.createRadialGradient(VW / 2, 48, 4, VW / 2, 48, 150);
    rg.addColorStop(0, 'rgba(79,224,203,0.10)');
    rg.addColorStop(1, 'rgba(79,224,203,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, VW, 160);
    ctx.restore();
  }

  _renderLevelSelect() {
    const ctx = this.ctx;
    this._drawMenuBackdrop();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 16px "Courier New", ui-monospace, monospace';
    ctx.fillStyle = '#f2e7cf';
    ctx.fillText('SELECT SIGNAL', VW / 2, 44);
    ctx.font = '7px "Courier New", ui-monospace, monospace';
    ctx.fillStyle = 'rgba(189,176,149,0.7)';
    ctx.fillText('Reconnect the network, one tower at a time.', VW / 2, 60);

    for (let i = 0; i < this.menu.items.length; i++) {
      const it = this.menu.items[i];
      if (it.type !== 'card') {
        drawButton(ctx, it.label, it.x, it.y, it.w, it.h, {
          focused: i === this.menu.index, hovered: it.hovered,
        });
        continue;
      }
      this._drawLevelCard(it, i === this.menu.index, this.time);
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  _drawLevelCard(item, focused, t) {
    const ctx = this.ctx;
    const data = getLevelData(item.data);
    const rec = Save.level(data.id);
    const unlocked = !item.disabled;

    drawPanel(ctx, item.x, item.y, item.w, item.h, {
      fill: unlocked ? 'rgba(10,17,34,0.95)' : 'rgba(7,11,22,0.92)',
      border: focused && unlocked ? '#4fe0cb' : '#2f4a7a',
      accent: unlocked ? (rec.completed ? '#4fe0cb' : '#f79a45') : '#2f4a7a',
    });

    // Miniature theme preview strip
    const px = item.x + 6, py = item.y + 6, pw = item.w - 12, ph = 34;
    ctx.save();
    ctx.beginPath();
    ctx.rect(px, py, pw, ph);
    ctx.clip();
    const themeKey = data.theme;
    const skyCol = themeKey === 'meadow' ? '#1d3a5c' : themeKey === 'cave' ? '#0d1a26' : '#1a1030';
    const groundCol = themeKey === 'meadow' ? '#3f7a52' : themeKey === 'cave' ? '#243b52' : '#7a3f8f';
    const groundCol2 = themeKey === 'meadow' ? '#26405e' : themeKey === 'cave' ? '#141d33' : '#2a1440';
    ctx.fillStyle = skyCol;
    ctx.fillRect(px, py, pw, ph);
    if (!unlocked) {
      ctx.fillStyle = 'rgba(4,7,14,0.75)';
      ctx.fillRect(px, py, pw, ph);
    }
    // Parallax blobs
    ctx.fillStyle = themeKey === 'tower' ? '#2a1440' : '#16203a';
    for (let i = 0; i < 6; i++) {
      const bx = px + ((i * 27 + 8) % pw);
      const bh = 8 + ((i * 7) % 14);
      ctx.fillRect(bx, py + ph - bh - 8, 10, bh);
    }
    // Ground
    ctx.fillStyle = groundCol2;
    ctx.fillRect(px, py + ph - 10, pw, 10);
    ctx.fillStyle = groundCol;
    ctx.fillRect(px, py + ph - 10, pw, 2);
    // A little pip
    if (unlocked) {
      const pip = this.atlas.pipRun[Math.floor(t * 8 + data.id) % this.atlas.pipRun.length];
      ctx.drawImage(pip, px + 6 + ((t * 14) % (pw - 24)), py + ph - 10 - pip.height + 2);
    }
    // Floating bits
    ctx.fillStyle = '#4fe0cb';
    for (let i = 0; i < 5; i++) {
      const bx = px + 14 + i * 14;
      const by = py + 10 + Math.sin(t * 2 + i * 0.9) * 3;
      ctx.fillRect(bx, by, 2, 2);
    }
    if (!unlocked) {
      // padlock glyph
      ctx.fillStyle = '#5d6a80';
      const lx = px + pw / 2 - 5, ly = py + ph / 2 - 6;
      ctx.fillRect(lx, ly + 4, 10, 8);
      ctx.fillRect(lx + 2, ly, 6, 5);
      ctx.fillStyle = skyCol;
      ctx.fillRect(lx + 3, ly + 1, 4, 3);
      ctx.fillStyle = '#5d6a80';
      ctx.fillRect(lx + 4, ly + 6, 2, 4);
    }
    ctx.restore();

    // Title
    ctx.textAlign = 'center';
    ctx.font = 'bold 8px "Courier New", ui-monospace, monospace';
    ctx.fillStyle = unlocked ? '#f2e7cf' : '#5d6a80';
    ctx.fillText(`${data.id}. ${data.name}`, item.x + item.w / 2, item.y + 52);

    // Stats
    ctx.font = '7px "Courier New", ui-monospace, monospace';
    const totalBits = data.bits.length;
    const totalCores = data.cores.length;
    if (unlocked) {
      ctx.fillStyle = '#bdb095';
      ctx.fillText(`BITS ${rec.bits || 0}/${totalBits}`, item.x + item.w / 2, item.y + 66);
      ctx.fillStyle = rec.cores >= totalCores ? '#4fe0cb' : '#f79a45';
      ctx.fillText(`CORES ${rec.cores || 0}/${totalCores}`, item.x + item.w / 2, item.y + 77);
      ctx.fillStyle = rec.completed ? '#4fe0cb' : 'rgba(189,176,149,0.6)';
      ctx.fillText(rec.completed ? `BEST ${formatTime(rec.time)}` : 'NOT CLEARED', item.x + item.w / 2, item.y + 88);
    } else {
      ctx.fillStyle = '#5d6a80';
      ctx.fillText('LOCKED', item.x + item.w / 2, item.y + 74);
      ctx.fillText('Clear previous level', item.x + item.w / 2, item.y + 85);
    }
    ctx.textAlign = 'left';
  }

  _renderHowTo() {
    const ctx = this.ctx;
    this._drawMenuBackdrop();
    drawPanel(ctx, 44, 34, VW - 88, VH - 76, { accent: '#4fe0cb' });

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 14px "Courier New", ui-monospace, monospace';
    ctx.fillStyle = '#f2e7cf';
    ctx.fillText('HOW TO PLAY', VW / 2, 50);

    const rows = [
      ['MOVE', 'A / D  or  ← →', 'Touch: LEFT / RIGHT pad'],
      ['JUMP', 'SPACE / W / ↑', 'Hold for a higher jump'],
      ['DASH', 'SHIFT', 'Short burst — also a cooldown meter'],
      ['PAUSE', 'ESC', 'Restart level with R'],
    ];
    let y = 74;
    ctx.font = '7px "Courier New", ui-monospace, monospace';
    for (const [k, v, extra] of rows) {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#f79a45';
      ctx.fillText(k, 66, y);
      ctx.fillStyle = '#f2e7cf';
      ctx.fillText(v, 118, y);
      ctx.fillStyle = 'rgba(189,176,149,0.65)';
      ctx.fillText(extra, 250, y);
      y += 15;
    }

    // Tips
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(79,224,203,0.9)';
    ctx.font = 'bold 8px "Courier New", ui-monospace, monospace';
    ctx.fillText('FIELD NOTES', 66, y + 8);
    ctx.font = '7px "Courier New", ui-monospace, monospace';
    const tips = [
      '• Land on top of Glitch Hoppers to squash them.',
      '• Drones are not stompable — time your dash instead.',
      '• Fall gravity is heavier: short taps give precise hops.',
      '• Coyote time & jump buffering are on — jumps feel forgiving.',
      '• The SIG meter is spare respawns; relay checkpoints refill it.',
      '• Every level hides Data Cores and at least one secret area.',
    ];
    let ty = y + 22;
    ctx.fillStyle = '#bdb095';
    for (const tip of tips) {
      ctx.fillText(tip, 66, ty);
      ty += 12;
    }

    ctx.textAlign = 'center';
    ctx.font = '7px "Courier New", ui-monospace, monospace';
    ctx.fillStyle = 'rgba(189,176,149,0.7)';
    ctx.fillText('Press ENTER / SPACE or click to return', VW / 2, VH - 32);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  _renderSettings() {
    const ctx = this.ctx;
    if (this.settingsReturn === STATE.PAUSE) {
      this._renderPlay(ctx);
      ctx.fillStyle = 'rgba(5,7,14,0.72)';
      ctx.fillRect(0, 0, VW, VH);
    } else {
      this._drawMenuBackdrop();
    }
    drawPanel(ctx, 118, 50, VW - 236, VH - 100, { accent: '#4fe0cb' });
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 13px "Courier New", ui-monospace, monospace';
    ctx.fillStyle = '#f2e7cf';
    ctx.fillText('SETTINGS', VW / 2, 64);

    for (let i = 0; i < this.menu.items.length; i++) {
      const it = this.menu.items[i];
      const focused = i === this.menu.index;
      if (it.id === 'back') {
        drawButton(ctx, it.label, it.x, it.y, it.w, it.h, { focused, hovered: it.hovered });
        continue;
      }
      // Label
      ctx.textAlign = 'left';
      ctx.font = '7px "Courier New", ui-monospace, monospace';
      ctx.fillStyle = focused ? '#f2e7cf' : '#bdb095';
      ctx.fillText(it.label, it.x, it.y + 7);
      if (focused) {
        ctx.fillStyle = '#4fe0cb';
        ctx.fillRect(it.x - 6, it.y + 5, 3, 3);
      }

      if (it.type === 'slider') {
        drawSlider(ctx, it.x + 96, it.y + 4, 74, it.value, { focused });
        ctx.textAlign = 'left';
        ctx.fillStyle = '#9df5e6';
        ctx.fillText(`${Math.round(it.value * 100)}`, it.x + 176, it.y + 7);
      } else if (it.type === 'checkbox') {
        drawCheckbox(ctx, it.x + 96 + 34, it.y + 2, !!it.value, { focused });
        ctx.fillStyle = it.value ? '#9df5e6' : '#5d6a80';
        ctx.fillText(it.value ? 'ON' : 'OFF', it.x + 140, it.y + 7);
      }
    }

    ctx.textAlign = 'center';
    ctx.font = '7px "Courier New", ui-monospace, monospace';
    ctx.fillStyle = 'rgba(189,176,149,0.65)';
    ctx.fillText('← → adjust   ·   ENTER toggles   ·   ESC back', VW / 2, VH - 58);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  _renderPause() {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(5,7,14,0.66)';
    ctx.fillRect(0, 0, VW, VH);
    drawPanel(ctx, VW / 2 - 90, 66, 180, 168, { accent: '#f79a45' });
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 14px "Courier New", ui-monospace, monospace';
    ctx.fillStyle = '#f2e7cf';
    ctx.fillText('SIGNAL HELD', VW / 2, 84);
    ctx.font = '7px "Courier New", ui-monospace, monospace';
    ctx.fillStyle = 'rgba(189,176,149,0.7)';
    ctx.fillText(`LEVEL ${this.lm.levelId} · ${formatTime(this.lm.runStats.time)}`, VW / 2, 96);
    ctx.fillStyle = '#9df5e6';
    ctx.fillText(`BITS ${this.lm.runStats.bits}/${this.lm.runStats.totalBits}   CORES ${this.lm.runStats.cores}/${this.lm.runStats.totalCores}`, VW / 2, 107);
    ctx.fillStyle = '#e2564e';
    ctx.fillText(`SIGNAL INTEGRITY ${this.lm.integrity}/${this.lm.maxIntegrity}   DEATHS ${this.lm.runStats.deaths}`, VW / 2, 117);

    for (let i = 0; i < this.menu.items.length; i++) {
      const it = this.menu.items[i];
      drawButton(ctx, it.label, it.x, it.y, it.w, it.h, {
        focused: i === this.menu.index, hovered: it.hovered, danger: it.danger,
      });
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  _renderGameOver() {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(5,7,14,0.82)';
    ctx.fillRect(0, 0, VW, VH);
    // Broken static lines
    const t = this.time;
    ctx.fillStyle = 'rgba(226,86,78,0.08)';
    for (let i = 0; i < 20; i++) {
      const y = (i * 29 + Math.floor(t * 60)) % VH;
      const w = 40 + ((i * 53) % 300);
      ctx.fillRect((i * 71) % VW - 100, y, w, 1 + (i % 3 === 0 ? 1 : 0));
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const shake = Math.sin(t * 30) * (Math.sin(t * 4) > 0.9 ? 1.5 : 0);
    ctx.font = 'bold 26px "Courier New", ui-monospace, monospace';
    ctx.fillStyle = 'rgba(226,86,78,0.35)';
    ctx.fillText('SIGNAL LOST', VW / 2 + shake + 1, 82 + 1);
    ctx.fillStyle = '#e2564e';
    ctx.fillText('SIGNAL LOST', VW / 2 + shake, 82);

    ctx.font = '7px "Courier New", ui-monospace, monospace';
    ctx.fillStyle = 'rgba(189,176,149,0.8)';
    ctx.fillText('PIP is offline. The tower waits.', VW / 2, 100);
    ctx.fillStyle = '#9df5e6';
    ctx.fillText(`BITS ${this.lm.runStats.bits}/${this.lm.runStats.totalBits}   CORES ${this.lm.runStats.cores}/${this.lm.runStats.totalCores}`, VW / 2, 113);

    drawPanel(ctx, 60, 126, VW - 120, 12, { accent: '#e2564e', border: '#5a2530' });
    ctx.font = '7px "Courier New", ui-monospace, monospace';
    ctx.fillStyle = 'rgba(226,86,78,0.9)';
    ctx.fillText('SIGNAL INTEGRITY LOST — reach a checkpoint relay to keep the carrier alive.', VW / 2, 132);

    for (let i = 0; i < this.menu.items.length; i++) {
      const it = this.menu.items[i];
      drawButton(ctx, it.label, it.x, it.y, it.w, it.h, {
        focused: i === this.menu.index, hovered: it.hovered,
      });
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  _renderComplete() {
    const ctx = this.ctx;
    const t = this.time - (this._completeStart || this.time);
    ctx.fillStyle = `rgba(5,7,14,${0.55 + Math.min(0.3, t * 0.4)})`;
    ctx.fillRect(0, 0, VW, VH);

    const s = this.lm.runStats;
    const w = 250, h = 160;
    const x = VW / 2 - w / 2, y = 36;
    const slide = clamp(t * 3, 0, 1);
    drawPanel(ctx, x, y + (1 - slide) * 20, w, h, { accent: '#4fe0cb' });

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 15px "Courier New", ui-monospace, monospace';
    ctx.fillStyle = '#9df5e6';
    ctx.fillText('SIGNAL RESTORED', VW / 2, y + 18 + (1 - slide) * 20);

    ctx.font = '7px "Courier New", ui-monospace, monospace';
    ctx.fillStyle = 'rgba(189,176,149,0.8)';
    const lv = getLevelData(this.lm.levelId);
    ctx.fillText(`LEVEL ${lv.id} — ${lv.name}`, VW / 2, y + 32 + (1 - slide) * 20);

    const rec = Save.level(this.lm.levelId);
    const statRows = [
      ['TIME', formatTime(s.time), rec.time ? `BEST ${formatTime(rec.time)}` : ''],
      ['SIGNAL BITS', `${s.bits} / ${s.totalBits}`, s.bits >= s.totalBits ? 'COMPLETE' : `${s.totalBits - s.bits} MISSED`],
      ['DATA CORES', `${s.cores} / ${s.totalCores}`, s.cores >= s.totalCores ? 'COMPLETE' : 'SEARCH HARDER'],
      ['SECRETS', `${s.secrets}`, ''],
      ['DEATHS', `${s.deaths}`, s.deaths === 0 ? 'FLAWLESS' : ''],
    ];
    let ry = y + 52 + (1 - slide) * 20;
    for (const [k, v, note] of statRows) {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#bdb095';
      ctx.fillText(k, x + 18, ry);
      ctx.fillStyle = '#f2e7cf';
      ctx.fillText(v, x + 104, ry);
      ctx.fillStyle = 'rgba(79,224,203,0.85)';
      ctx.fillText(note, x + 162, ry);
      ry += 14;
    }

    // Grade stamp based on completion
    const grade = this._grade(s);
    ctx.textAlign = 'center';
    ctx.font = 'bold 20px "Courier New", ui-monospace, monospace';
    ctx.fillStyle = grade.color;
    ctx.fillText(grade.letter, x + w - 30, y + 44 + (1 - slide) * 20);
    ctx.font = '6px "Courier New", ui-monospace, monospace';
    ctx.fillStyle = 'rgba(189,176,149,0.7)';
    ctx.fillText('RANK', x + w - 30, y + 58 + (1 - slide) * 20);

    for (let i = 0; i < this.menu.items.length; i++) {
      const it = this.menu.items[i];
      drawButton(ctx, it.label, it.x, it.y, it.w, it.h, {
        focused: i === this.menu.index, hovered: it.hovered,
      });
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  _grade(s) {
    const bitFrac = s.totalBits ? s.bits / s.totalBits : 1;
    const coreFrac = s.totalCores ? s.cores / s.totalCores : 1;
    const deathPenalty = clamp(s.deaths / 6, 0, 1);
    const score = bitFrac * 0.45 + coreFrac * 0.35 + (1 - deathPenalty) * 0.20;
    if (score >= 0.95) return { letter: 'S', color: '#9df5e6' };
    if (score >= 0.8) return { letter: 'A', color: '#4fe0cb' };
    if (score >= 0.62) return { letter: 'B', color: '#f79a45' };
    if (score >= 0.45) return { letter: 'C', color: '#bdb095' };
    return { letter: 'D', color: '#e2564e' };
  }
}
