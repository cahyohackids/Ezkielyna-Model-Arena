// Unified keyboard + touch input. Exposes a polled state object so the game
// loop can read buttons without caring about the source. Edge events (jump
// press, dash press) are tracked with a "pressed this frame" flag consumed by
// the player each tick.

export class InputManager {
  constructor(canvas, touchRoot) {
    this.canvas = canvas;
    this.state = {
      left: false,
      right: false,
      jump: false,
      dash: false,
    };
    // edge-triggered, consumed once per tick by player
    this.pressed = { jump: false, dash: false };
    // for UI: any confirm key pressed this frame
    this.uiConfirm = false;
    this.uiBack = false;
    this.uiUp = false;
    this.uiDown = false;
    this.uiLeft = false;
    this.uiRight = false;
    this.paused = false; // esc toggle request
    this.restart = false;

    this._keys = new Set();
    this._touchActive = new Set();
    this._enabled = true;

    this._bindKeyboard();
    this._bindTouch(touchRoot);
  }

  setEnabled(v) { this._enabled = v; }

  _mapKey(code) {
    switch (code) {
      case 'ArrowLeft': case 'KeyA': return 'left';
      case 'ArrowRight': case 'KeyD': return 'right';
      case 'ArrowUp': case 'KeyW': case 'Space': return 'jump';
      case 'ShiftLeft': case 'ShiftRight': case 'KeyJ': return 'dash';
      default: return null;
    }
  }

  _bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) {
        // still suppress scrolling for space/arrows
        if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
        return;
      }
      const m = this._mapKey(e.code);
      if (m) {
        if (!this.state[m]) {
          if (m === 'jump') this.pressed.jump = true;
          if (m === 'dash') this.pressed.dash = true;
        }
        this.state[m] = true;
        this._keys.add(m);
        e.preventDefault();
        return;
      }
      switch (e.code) {
        case 'Escape': this.paused = true; break;
        case 'KeyR': this.restart = true; break;
        case 'Enter': this.uiConfirm = true; break;
        case 'Backspace': this.uiBack = true; break;
        case 'ArrowUp': this.uiUp = true; e.preventDefault(); break;
        case 'ArrowDown': this.uiDown = true; e.preventDefault(); break;
        case 'ArrowLeft': this.uiLeft = true; e.preventDefault(); break;
        case 'ArrowRight': this.uiRight = true; e.preventDefault(); break;
      }
    });

    window.addEventListener('keyup', (e) => {
      const m = this._mapKey(e.code);
      if (m) {
        this.state[m] = false;
        this._keys.delete(m);
        e.preventDefault();
      }
    });

    // reset everything if the window loses focus (alt-tab while holding keys)
    window.addEventListener('blur', () => this.reset());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.reset();
    });
  }

  _bindTouch(root) {
    if (!root) return;
    const buttons = Array.from(root.querySelectorAll('.tbtn'));
    const setAction = (action, on) => {
      if (on) {
        if (!this.state[action]) {
          if (action === 'jump') this.pressed.jump = true;
          if (action === 'dash') this.pressed.dash = true;
        }
        this.state[action] = true;
        this._touchActive.add(action);
      } else {
        this.state[action] = false;
        this._touchActive.delete(action);
      }
    };

    buttons.forEach((btn) => {
      const action = btn.dataset.action;
      const start = (e) => {
        e.preventDefault();
        btn.classList.add('active');
        setAction(action, true);
      };
      const end = (e) => {
        e.preventDefault();
        btn.classList.remove('active');
        setAction(action, false);
      };
      btn.addEventListener('touchstart', start, { passive: false });
      btn.addEventListener('touchend', end, { passive: false });
      btn.addEventListener('touchcancel', end, { passive: false });
      // mouse fallback for touch-enabled laptops used with pointer
      btn.addEventListener('mousedown', start);
      btn.addEventListener('mouseup', end);
      btn.addEventListener('mouseleave', (e) => { if (btn.classList.contains('active')) end(e); });
    });
  }

  // Called by the game when a new pointer source might need enabling.
  showTouch(show) {
    if (!this._touchRoot) return;
    this._touchRoot.classList.toggle('hidden', !show);
  }

  // Consume edge events: returns true if jump was pressed since last consume.
  consumeJump() {
    const v = this.pressed.jump;
    this.pressed.jump = false;
    return v;
  }
  consumeDash() {
    const v = this.pressed.dash;
    this.pressed.dash = false;
    return v;
  }
  consumePause() { const v = this.paused; this.paused = false; return v; }
  consumeRestart() { const v = this.restart; this.restart = false; return v; }
  consumeUI() {
    const v = { confirm: this.uiConfirm, back: this.uiBack, up: this.uiUp, down: this.uiDown, left: this.uiLeft, right: this.uiRight };
    this.uiConfirm = this.uiBack = this.uiUp = this.uiDown = this.uiLeft = this.uiRight = false;
    return v;
  }

  reset() {
    this.state.left = this.state.right = this.state.jump = this.state.dash = false;
    this.pressed.jump = this.pressed.dash = false;
    this._keys.clear();
    this._touchActive.clear();
  }
}
