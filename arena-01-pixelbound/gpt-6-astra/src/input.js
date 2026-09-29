const KEYS = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'jump', KeyW: 'jump', Space: 'jump', ShiftLeft: 'dash', ShiftRight: 'dash' };
export class InputManager {
  constructor(onAction) {
    this.held = new Set(); this.pointers = new Map(); this.pressed = new Set(); this.released = new Set();
    this.enabled = false; this.onAction = onAction;
    window.addEventListener('keydown', e => {
      if (e.target.matches?.('input,textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
      const action = KEYS[e.code];
      if (action && this.enabled) { e.preventDefault(); if (!e.repeat) this.down(action, e.code); }
      if (!e.repeat && e.code === 'Escape') { e.preventDefault(); this.onAction('pause'); }
      if (!e.repeat && e.code === 'KeyR' && this.enabled) this.onAction('restart');
      if (!e.repeat && e.code === 'KeyM') this.onAction('mute');
    });
    window.addEventListener('keyup', e => { if (KEYS[e.code]) this.up(KEYS[e.code], e.code); });
    window.addEventListener('blur', () => { this.clear(); this.onAction('blur'); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { this.clear(); this.onAction('blur'); } });
    document.querySelectorAll('[data-key]').forEach(button => {
      const key = button.dataset.key;
      button.addEventListener('pointerdown', e => {
        e.preventDefault(); if (!this.enabled) return;
        button.setPointerCapture(e.pointerId); this.pointers.set(e.pointerId, key);
        this.down(key, `touch${e.pointerId}`); button.classList.add('active');
      });
      const release = e => { const action = this.pointers.get(e.pointerId); if (action) this.up(action, `touch${e.pointerId}`); this.pointers.delete(e.pointerId); button.classList.remove('active'); };
      button.addEventListener('pointerup', release); button.addEventListener('pointercancel', release); button.addEventListener('lostpointercapture', release);
      button.addEventListener('contextmenu', e => e.preventDefault());
    });
  }
  down(key, source = key) { if (!this.isDown(key)) this.pressed.add(key); this.held.add(`${key}:${source}`); }
  up(key, source = key) { this.held.delete(`${key}:${source}`); if (!this.isDown(key)) this.released.add(key); }
  isDown(key) { for (const item of this.held) if (item.startsWith(`${key}:`)) return true; return false; }
  frame() { const f = { axis: Number(this.isDown('right')) - Number(this.isDown('left')), jumpHeld: this.isDown('jump'), jumpPressed: this.pressed.has('jump'), jumpReleased: this.released.has('jump'), dashPressed: this.pressed.has('dash') }; this.pressed.clear(); this.released.clear(); return f; }
  clear() { this.held.clear(); this.pointers.clear(); this.pressed.clear(); this.released.clear(); document.querySelectorAll('.touch-controls .active').forEach(el => el.classList.remove('active')); }
}
