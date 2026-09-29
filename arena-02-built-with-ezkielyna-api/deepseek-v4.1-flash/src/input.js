// input.js — unifies keyboard, touch and gamepad input into a small action set.
//
// Gameplay actions: left, right, up, down, jump, dash, pause, restart
// Menu actions:     menuUp, menuDown, menuLeft, menuRight, menuConfirm, menuBack
//
// Edge queries (justPressed / justReleased) are snapshotted once per
// simulation step by `beginFrame()`, so a fast tap always registers exactly
// once no matter how many steps run in a frame.

const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'jump', KeyW: 'jump', Space: 'jump', KeyJ: 'jump',
  ArrowDown: 'down', KeyS: 'down',
  ShiftLeft: 'dash', ShiftRight: 'dash', KeyK: 'dash', KeyL: 'dash',
  Escape: 'pause', KeyP: 'pause',
  KeyR: 'restart',
  Enter: 'confirm', NumpadEnter: 'confirm',
  Backspace: 'back',
  KeyM: 'mute',
};

// Keys whose default browser behaviour (scrolling, focus moves) we suppress.
const PREVENT = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab', 'Backspace',
]);

/** Map a raw gameplay action onto the corresponding menu action.
 *  Bidirectional: gameplay → menu AND menu → gameplay, so callers may query
 *  either vocabulary (e.g. menuDown('menuConfirm') resolves to 'confirm'/'jump'). */
const MENU_ALIAS = {
  left: 'menuLeft', right: 'menuRight', up: 'menuUp', down: 'menuDown',
  jump: 'menuConfirm', confirm: 'menuConfirm', dash: 'menuConfirm',
  pause: 'menuPause', back: 'menuBack', restart: 'menuBack',
  // reverse direction
  menuLeft: 'left', menuRight: 'right', menuUp: 'up', menuDown: 'down',
  menuConfirm: 'confirm', menuPause: 'pause', menuBack: 'back',
};

export class Input {
  constructor() {
    this.down = new Set();        // held actions
    this.pressed = new Set();     // edges for the current step
    this.released = new Set();    // edges for the current step
    this._queueDown = new Set();
    this._queueUp = new Set();
    this.rawDown = new Set();     // raw key codes held
    this.anyInputAt = 0;
    this.touchActive = false;
    this._touchCount = 0;         // how many touch buttons are held
    this._touchVirtual = new Set();

    this._installKeyboard();
    this._installVisibility();
  }

  // ───────────────────────────────────────────── keyboard

  _installKeyboard() {
    window.addEventListener('keydown', (e) => {
      if (PREVENT.has(e.code) || PREVENT.has(e.key)) e.preventDefault();
      this.rawDown.add(e.code);
      this.anyInputAt = performance.now();
      const action = KEYMAP[e.code];
      if (!action) return;
      if (e.repeat) { this.down.add(action); return; }
      if (!this.down.has(action)) this._queueDown.add(action);
      this.down.add(action);
    }, { passive: false });

    window.addEventListener('keyup', (e) => {
      this.rawDown.delete(e.code);
      const action = KEYMAP[e.code];
      if (!action) return;
      // Another raw key may still map to the same action.
      const stillHeld = Object.keys(KEYMAP).some((c) => KEYMAP[c] === action && this.rawDown.has(c));
      if (!stillHeld && !this._touchHolds(action)) {
        this.down.delete(action);
        this._queueUp.add(action);
      }
    });

    window.addEventListener('blur', () => {
      for (const a of this.down) this._queueUp.add(a);
      this.down.clear();
      this.rawDown.clear();
      this.clearTouchVisuals();
    });
  }

  _installVisibility() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        for (const a of this.down) this._queueUp.add(a);
        this.down.clear();
        this.rawDown.clear();
        this.clearTouchVisuals();
      }
    });
  }

  // ───────────────────────────────────────────── touch

  /** Set by the touch-control DOM layer (main.js). */
  setTouchAction(action, on) {
    if (on) {
      if (!this.down.has(action)) this._queueDown.add(action);
      this.down.add(action);
      this._touchVirtual.add(action);
      this.touchActive = true;
      this.anyInputAt = performance.now();
    } else {
      this._touchVirtual.delete(action);
      // Only release if no keyboard key still holds it.
      const heldByKb = Object.keys(KEYMAP).some((c) => KEYMAP[c] === action && this.rawDown.has(c));
      if (!heldByKb) {
        this.down.delete(action);
        this._queueUp.add(action);
      }
    }
    this._touchCount = this._touchVirtual.size;
  }

  _touchHolds(action) { return this._touchVirtual?.has(action); }

  clearTouchVisuals() {
    if (this._touchVirtual) {
      for (const a of this._touchVirtual) {
        this.down.delete(a);
        this._queueUp.add(a);
      }
      this._touchVirtual.clear();
    }
    this._touchCount = 0;
  }

  // ───────────────────────────────────────────── per-step API

  /** Commit queued edges. Call once before each simulation step. */
  beginFrame() {
    this.pressed = this._queueDown;
    this.released = this._queueUp;
    this._queueDown = new Set();
    this._queueUp = new Set();
    this._pollGamepad();
  }

  /** No-op hook kept for loop symmetry / future per-step cleanup. */
  endStep() { /* edges are consumed by beginFrame */ }

  isDown(action) { return this.down.has(action); }
  justPressed(action) { return this.pressed.has(action); }
  justReleased(action) { return this.released.has(action); }

  /** True if any menu-navigation action fired this step. */
  anyKeyActivity() { return this.pressed.size > 0; }

  /** Signed horizontal axis. */
  axisX() {
    let x = 0;
    if (this.down.has('left')) x -= 1;
    if (this.down.has('right')) x += 1;
    return x;
  }

  axisY() {
    let y = 0;
    if (this.down.has('up')) y -= 1;
    if (this.down.has('down')) y += 1;
    return y;
  }

  // Extra synonyms: a confirm can be triggered by any of the "accept" keys, and
  // a back-out by either pause or back, so menus feel native on every device.
  _accepted(action) {
    if (action === 'menuConfirm') return ['confirm', 'jump'];
    if (action === 'menuBack') return ['back', 'pause'];
    if (action === 'menuPause') return ['pause'];
    return [];
  }

  // Menu helpers: translate gameplay actions into their menu equivalents and
  // OR them in, so every input device navigates menus identically.
  menuDown(action) {
    if (this.justPressed(action)) return true;
    const a = MENU_ALIAS[action];
    if (a && this.justPressed(a)) return true;
    for (const s of this._accepted(action)) if (this.justPressed(s)) return true;
    return false;
  }
  menuHeld(action) {
    if (this.isDown(action)) return true;
    const a = MENU_ALIAS[action];
    if (a && this.isDown(a)) return true;
    for (const s of this._accepted(action)) if (this.isDown(s)) return true;
    return false;
  }

  // ───────────────────────────────────────────── gamepad

  _pollGamepad() {
    if (!navigator.getGamepads) return;
    let gp = null;
    try {
      const pads = navigator.getGamepads();
      for (const p of pads) { if (p && p.connected) { gp = p; break; } }
    } catch { return; }
    if (!gp) {
      if (this._hadPad) { this._hadPad = false; }
      return;
    }
    this._hadPad = true;

    const dz = 0.35;
    const ax = gp.axes[0] ?? 0;
    const ay = gp.axes[1] ?? 0;
    const btn = (i) => !!gp.buttons[i]?.pressed;

    this._padSet('left', ax < -dz || btn(14));
    this._padSet('right', ax > dz || btn(15));
    this._padSet('down', ay > dz || btn(13));
    this._padSet('jump', ay < -dz || btn(12) || btn(0));
    this._padSet('dash', btn(2) || btn(5) || btn(4) || btn(7));
    this._padSet('pause', btn(9) || btn(8));
    this._padSet('confirm', btn(0));
    this._padSet('back', btn(1));
  }

  _padSet(action, on) {
    const heldByKb = Object.keys(KEYMAP).some((c) => KEYMAP[c] === action && this.rawDown.has(c));
    const heldByTouch = this._touchHolds(action);
    if (on) {
      if (!this.down.has(action)) this._queueDown.add(action);
      this.down.add(action);
      this.anyInputAt = performance.now();
    } else if (this.down.has(action) && !heldByKb && !heldByTouch) {
      this.down.delete(action);
      this._queueUp.add(action);
    }
  }
}
