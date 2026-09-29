// InputManager: unified keyboard + touch input with edge detection.

export class InputManager {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set(); // edges (just pressed this frame)
    this.released = new Set(); // edges (just released this frame)
    this.touchState = { left: false, right: false, jump: false, dash: false };
    this.touchPressed = { jump: false, dash: false };
    this._listeners = [];
    this._bound = false;
  }

  bind() {
    if (this._bound) return;
    this._bound = true;
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
  }

  _onKeyDown = (e) => {
    if (e.repeat) return;
    // prevent page scroll for game keys
    const c = this._code(e);
    if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'].includes(c) || c === 'Space') {
      e.preventDefault();
    }
    this.keys.add(c);
    this.pressed.add(c);
  };

  _onKeyUp = (e) => {
    const c = this._code(e);
    this.keys.delete(c);
    this.released.add(c);
  };

  _onBlur = () => {
    this.keys.clear();
    this.touchState = { left: false, right: false, jump: false, dash: false };
  };

  _code(e) {
    return e.code; // physical key code
  }

  get left() {
    return this.keys.has('ArrowLeft') || this.keys.has('KeyA') || this.touchState.left;
  }
  get right() {
    return this.keys.has('ArrowRight') || this.keys.has('KeyD') || this.touchState.right;
  }
  get jumpHeld() {
    return this.keys.has('Space') || this.keys.has('KeyW') || this.keys.has('ArrowUp') || this.touchState.jump;
  }
  get dashHeld() {
    return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.touchState.dash;
  }
  jumpPressed() {
    return this.pressed.has('Space') || this.pressed.has('KeyW') || this.pressed.has('ArrowUp') || this.touchPressed.jump;
  }
  dashPressed() {
    return this.pressed.has('ShiftLeft') || this.pressed.has('ShiftRight') || this.touchPressed.dash;
  }
  restartPressed() {
    return this.pressed.has('KeyR');
  }
  pausePressed() {
    return this.pressed.has('Escape');
  }
  confirmPressed() {
    return this.pressed.has('Enter') || this.pressed.has('Space');
  }

  // Clear edge sets at end of frame
  endFrame() {
    this.pressed.clear();
    this.released.clear();
    this.touchPressed.jump = false;
    this.touchPressed.dash = false;
  }

  // Touch binding helpers (called by UI wiring)
  bindTouchButton(el, action, isAxis = false) {
    const start = (e) => {
      e.preventDefault();
      if (isAxis) {
        this.touchState[action] = true;
      } else {
        this.touchState[action] = true;
        this.touchPressed[action] = true;
      }
      el.classList.add('pressed');
    };
    const end = (e) => {
      e.preventDefault();
      if (isAxis) {
        this.touchState[action] = false;
      } else {
        this.touchState[action] = false;
      }
      el.classList.remove('pressed');
    };
    el.addEventListener('touchstart', start, { passive: false });
    el.addEventListener('touchend', end, { passive: false });
    el.addEventListener('touchcancel', end, { passive: false });
    el.addEventListener('mousedown', start);
    el.addEventListener('mouseup', end);
    el.addEventListener('mouseleave', end);
    this._listeners.push({ el, start, end });
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    this._listeners.forEach(({ el, start, end }) => {
      el.removeEventListener('touchstart', start);
      el.removeEventListener('touchend', end);
      el.removeEventListener('touchcancel', end);
      el.removeEventListener('mousedown', start);
      el.removeEventListener('mouseup', end);
      el.removeEventListener('mouseleave', end);
    });
    this._listeners = [];
    this._bound = false;
  }
}
