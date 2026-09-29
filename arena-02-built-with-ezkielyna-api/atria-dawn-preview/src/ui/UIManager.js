// All DOM UI: HUD, menus, settings, level select, pause, game over, level
// complete. The game logic calls into this; UI events are reported back via
// the onAction callback.

import { LEVELS } from '../game/levels.js';

export class UIManager {
  constructor(save) {
    this.save = save;
    this.onAction = null; // (action, payload) => void
    this._cache();
    this._bind();
    this._prevMenu = 'main-menu';
  }

  _cache() {
    const $ = (id) => document.getElementById(id);
    this.hud = $('hud');
    this.hint = $('hint');
    this.bitsCount = $('bits-count');
    this.coresCount = $('cores-count');
    this.healthCells = Array.from($('hud-health').querySelectorAll('.cell'));
    this.dashFill = $('dash-fill');
    this.menuLayer = $('menu-layer');
    this.menus = {
      'main-menu': $('main-menu'),
      'level-select': $('level-select'),
      'howto-menu': $('howto-menu'),
      'settings-menu': $('settings-menu'),
      'pause-menu': $('pause-menu'),
      'gameover-menu': $('gameover-menu'),
      'complete-menu': $('complete-menu'),
    };
    this.levelCards = $('level-cards');
    this.completeStats = $('complete-stats');
    this.touchControls = $('touch-controls');
  }

  _bind() {
    // All buttons use data-menu-action; binding is delegated so dynamically
    // added level cards work too.
    this.menuLayer.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-menu-action]');
      if (!btn) return;
      const action = btn.dataset.menuAction;
      if (action === 'settings') this._prevMenu = this._currentMenu || 'main-menu';
      if (this.onAction) this.onAction(action, { button: btn });
    });

    // settings inputs
    const s = this.save.getSettings();
    const music = document.getElementById('set-music');
    const sfx = document.getElementById('set-sfx');
    const mute = document.getElementById('set-mute');
    const shake = document.getElementById('set-shake');
    const reduced = document.getElementById('set-reduced');
    music.value = Math.round(s.music * 100);
    sfx.value = Math.round(s.sfx * 100);
    mute.checked = s.muted;
    shake.checked = s.shake;
    reduced.checked = s.reduced;

    const update = () => {
      this.save.updateSettings({
        music: music.value / 100,
        sfx: sfx.value / 100,
        muted: mute.checked,
        shake: shake.checked,
        reduced: reduced.checked,
      });
      if (this.onSettingsChange) this.onSettingsChange(this.save.getSettings());
    };
    [music, sfx].forEach((el) => el.addEventListener('input', update));
    [mute, shake, reduced].forEach((el) => el.addEventListener('change', update));

    // HUD pause button
    document.getElementById('hud-pause').addEventListener('click', () => {
      if (this.onAction) this.onAction('pause', {});
    });
  }

  // ----------------------------------------------------------
  showMenu(id) {
    this._currentMenu = id;
    Object.entries(this.menus).forEach(([k, el]) => el.classList.toggle('hidden', k !== id));
    this.menuLayer.classList.remove('hidden');
    // focus first button for keyboard navigation
    const target = this.menus[id];
    if (target) {
      const first = target.querySelector('.mbtn, .level-card:not(.locked)');
      if (first) first.focus({ preventScroll: true });
    }
    if (id === 'level-select') this.renderLevelSelect();
  }

  hideMenus() {
    this.menuLayer.classList.add('hidden');
    Object.values(this.menus).forEach((el) => el.classList.add('hidden'));
    this._currentMenu = null;
  }

  get currentMenu() { return this._currentMenu; }

  showHUD(show) {
    this.hud.classList.toggle('hidden', !show);
  }

  showTouch(show) {
    this.touchControls.classList.toggle('hidden', !show);
  }

  isTouchVisible() {
    return !this.touchControls.classList.contains('hidden');
  }

  // ----------------------------------------------------------
  setHealth(n) {
    this.healthCells.forEach((cell, i) => cell.classList.toggle('empty', i >= n));
  }

  setBits(cur, total) {
    this.bitsCount.textContent = `${cur} / ${total}`;
  }

  setCores(cur, total) {
    this.coresCount.textContent = `${cur} / ${total}`;
  }

  setDash(ready, fraction) {
    this.dashFill.style.width = `${Math.round(fraction * 100)}%`;
    this.dashFill.classList.toggle('ready', ready);
  }

  showHint(text, duration = 3200) {
    this.hint.textContent = text;
    this.hint.classList.add('show');
    clearTimeout(this._hintTimer);
    this._hintTimer = setTimeout(() => this.hint.classList.remove('show'), duration);
  }

  hideHint() {
    this.hint.classList.remove('show');
    clearTimeout(this._hintTimer);
  }

  // ----------------------------------------------------------
  renderLevelSelect() {
    const settings = this.save.getSettings();
    this.levelCards.innerHTML = '';
    LEVELS.forEach((lvl, i) => {
      const data = this.save.data.levels[i];
      const unlocked = this.save.isUnlocked(i);
      const card = document.createElement('button');
      card.className = 'level-card' + (unlocked ? '' : ' locked');
      card.dataset.menuAction = unlocked ? 'start-level' : 'none';
      card.dataset.level = String(i);
      card.setAttribute('tabindex', unlocked ? '0' : '-1');
      if (!unlocked) card.setAttribute('aria-disabled', 'true');

      const time = data.bestTime === null ? '--:--' : formatTime(data.bestTime);
      card.innerHTML = `
        <canvas class="level-thumb" width="46" height="46" data-thumb="${i}"></canvas>
        <div class="level-info">
          <div class="level-name">${i + 1}. ${lvl.name}</div>
          <div class="level-meta">BITS ${data.bits}/${lvlBitsTotal(i)} &nbsp; CORES ${data.cores}/3 &nbsp; BEST ${time}</div>
        </div>
        <div class="level-lock">${unlocked ? (data.completed ? 'CLEARED' : 'READY') : 'LOCKED'}</div>
      `;
      this.levelCards.appendChild(card);
    });
    // draw thumbnails
    requestAnimationFrame(() => {
      document.querySelectorAll('[data-thumb]').forEach((cv) => {
        drawThumb(cv, Number(cv.dataset.thumb));
      });
    });
  }

  showComplete(stats) {
    this.completeStats.innerHTML = `
      <div class="stat-line"><span>TIME</span><b>${formatTime(stats.time)}</b></div>
      <div class="stat-line"><span>SIGNAL BITS</span><b class="${stats.bits === stats.bitsTotal ? 'perfect' : ''}">${stats.bits} / ${stats.bitsTotal}</b></div>
      <div class="stat-line"><span>DATA CORES</span><b class="${stats.cores === 3 ? 'perfect' : ''}">${stats.cores} / 3</b></div>
      <div class="stat-line"><span>DEATHS</span><b>${stats.deaths}</b></div>
      ${stats.newBest ? '<div class="stat-line"><span>NEW BEST TIME</span><b class="perfect">RECORD</b></div>' : ''}
    `;
    const nextBtn = this.menus['complete-menu'].querySelector('[data-menu-action="next"]');
    if (nextBtn) {
      nextBtn.style.display = stats.levelIndex < LEVELS.length - 1 ? '' : 'none';
    }
    this.showMenu('complete-menu');
  }
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.floor((seconds * 100) % 100);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

// bit totals per level are computed from the level definitions
function lvlBitsTotal(i) {
  const def = LEVELS[i];
  return def.entities.filter((e) => e[0] === 'o').length;
}

function drawThumb(canvas, levelIndex) {
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const themes = [
    ['#243a63', '#3fd2c5'],
    ['#111a33', '#3fd2c5'],
    ['#241638', '#e8763a'],
  ];
  const [bg, accent] = themes[levelIndex] || themes[0];
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 46, 46);
  // simple silhouette scene
  ctx.fillStyle = '#1d2745';
  ctx.fillRect(0, 34, 46, 12);
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.8;
  ctx.fillRect(6, 26, 8, 8);
  ctx.fillRect(18, 20, 10, 14);
  ctx.fillRect(32, 28, 8, 6);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#f2ead9';
  ctx.fillRect(8, 28, 3, 3);
  ctx.fillStyle = accent;
  ctx.fillRect(20, 8, 2, 8);
  ctx.beginPath();
  ctx.moveTo(17, 10); ctx.lineTo(21, 2); ctx.lineTo(25, 10);
  ctx.closePath();
  ctx.fill();
}
