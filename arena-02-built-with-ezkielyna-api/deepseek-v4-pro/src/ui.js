// UIManager: DOM menus, HUD updates, touch control wiring.

import { formatTime } from './utils.js';

export class UIManager {
  constructor(game) {
    this.game = game;
    this.menuRoot = document.getElementById('menu-root');
    this.hud = document.getElementById('hud');
    this.touchControls = document.getElementById('touch-controls');
    this.isTouch = window.matchMedia('(pointer: coarse)').matches;
  }

  showHUD() {
    this.hud.classList.remove('hidden');
    if (this.isTouch) this.touchControls.classList.remove('hidden');
  }
  hideHUD() {
    this.hud.classList.add('hidden');
    this.touchControls.classList.add('hidden');
  }

  clearMenu() {
    this.menuRoot.innerHTML = '';
  }

  // ---------- HUD updates ----------
  updateHUD() {
    const p = this.game.player;
    const lv = this.game.level;
    const health = document.getElementById('hud-health');
    const bits = document.getElementById('hud-bits');
    const bitsTotal = document.getElementById('hud-bits-total');
    const cores = document.getElementById('hud-cores');
    const dashFill = document.getElementById('dash-cooldown-fill');
    const dashEl = document.getElementById('dash-cooldown');
    const time = document.getElementById('hud-time');

    health.innerHTML = '';
    for (let i = 0; i < p.maxHp; i++) {
      const cell = document.createElement('div');
      cell.className = 'cell' + (i < p.hp ? ' on' : '');
      health.appendChild(cell);
    }
    const collected = lv.bits.filter(b => b.collected).length;
    bits.textContent = collected;
    bitsTotal.textContent = lv.bitTotal;
    cores.textContent = `${lv.cores.filter(c => c.collected).length}`;

    const ready = p.dashCooldown <= 0;
    const frac = 1 - p.dashCooldown / p.dashCooldownMax;
    dashFill.style.transform = `scaleX(${frac})`;
    dashEl.classList.toggle('dash-ready', ready);

    time.textContent = formatTime(this.game.levelTime);
  }

  // ---------- Menus ----------
  menu(inner, title = '') {
    this.clearMenu();
    const wrap = document.createElement('div');
    wrap.className = 'menu';
    const panel = document.createElement('div');
    panel.className = 'menu-panel';
    panel.setAttribute('role', 'dialog');
    if (title) {
      const h = document.createElement('div');
      h.className = 'menu-title';
      h.textContent = title;
      panel.appendChild(h);
    }
    if (inner == null) {
      // no inner content yet; caller appends its own
    } else if (typeof inner === 'string') {
      panel.innerHTML = inner;
    } else {
      panel.appendChild(inner);
    }
    wrap.appendChild(panel);
    this.menuRoot.appendChild(wrap);
    panel.addEventListener('keydown', this._navKeydown);
    // Callers append their buttons right after menu() returns, so defer
    // focus collection by a microtask.
    queueMicrotask(() => this._finalizeFocus(panel));
    return panel;
  }

  _finalizeFocus(panel) {
    if (!panel.isConnected) return;
    const focusables = Array.from(panel.querySelectorAll('.menu-btn, .level-card, .toggle, button'))
      .filter(el => el.tabIndex !== -1 && !el.disabled);
    panel.__focusables = focusables;
    if (focusables.length) focusables[0].focus();
  }

  _navKeydown = (e) => {
    const panel = e.currentTarget;
    const list = panel.__focusables || [];
    if (!list.length) return;
    const idx = list.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      list[(idx + 1 + list.length) % list.length].focus();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      list[(idx - 1 + list.length) % list.length].focus();
    } else if (e.key === 'Enter' || e.key === ' ') {
      const el = document.activeElement;
      if (el && list.includes(el)) {
        e.preventDefault();
        el.click();
      }
    }
  };

  btn(label, onClick, cls = '') {
    const b = document.createElement('button');
    b.className = 'menu-btn ' + cls;
    b.textContent = label;
    b.addEventListener('click', () => {
      this.game.audio.uiClick();
      onClick();
    });
    b.addEventListener('mouseenter', () => this.game.audio.uiHover());
    return b;
  }
}
