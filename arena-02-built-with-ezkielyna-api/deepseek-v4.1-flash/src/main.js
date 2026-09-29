// main.js — bootstrap, canvas scaling, mobile controls, and the fixed-step
// game loop.
//
// Scaling strategy: the canvas backing store stays at a fixed virtual
// resolution (480x270 logical units, integer-scaled for crispness) so all game
// logic is resolution-independent. CSS scales the element up, preserving the
// aspect ratio with letterboxing. That keeps sprites pixel-crisp and avoids
// any per-frame layout work.

import { Game } from './game.js';
import { Input } from './input.js';
import { Save } from './save.js';

const VW = 480, VH = 270;

function boot() {
  const canvas = document.getElementById('game');
  const wrap = document.getElementById('stage');

  // Internal render resolution: 2x the logical grid (960x540) so 2px art
  // pixels land on exact device pixels at common sizes, and 1px UI details
  // remain readable. All drawing code works in logical units and the context
  // is pre-scaled by SCALE.
  const SCALE = 2;
  canvas.width = VW * SCALE;
  canvas.height = VH * SCALE;

  const rawCtx = canvas.getContext('2d', { alpha: false });
  // Wrap the 2D context in a proxy-free scaling layer: we scale once via
  // setTransform and every draw call uses logical coordinates.
  const ctx = rawCtx;
  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  ctx.imageSmoothingEnabled = false;

  const game = new Game(canvas);
  // Game expects a context already in logical units; swap in our scaled one.
  game.ctx = ctx;
  game.renderer.ctx = ctx;
  game.lm.ctx = ctx;

  function resize() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const targetAspect = VW / VH;
    let w = vw, h = vw / targetAspect;
    if (h > vh) { h = vh; w = vh * targetAspect; }
    canvas.style.width = `${Math.floor(w * 100) / 100}px`;
    canvas.style.height = `${Math.floor(h * 100) / 100}px`;
    // Keep the transform stable — CSS handles display scaling.
    rawCtx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    rawCtx.imageSmoothingEnabled = false;
    void wrap;
  }
  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 120));

  // ── Mobile / touch controls ───────────────────────────────────────────
  const input = game.input;
  setupTouchControls(input);

  // Detect touch capability to reveal the touch UI.
  const isTouch = matchMedia('(hover: none) and (pointer: coarse)').matches
    || navigator.maxTouchPoints > 0;
  document.body.classList.toggle('has-touch', isTouch);
  if (isTouch) document.body.classList.add('touch-visible');

  // Any touch hides the "tap to play" hint overlay.
  const hint = document.getElementById('touch-hint');
  const hideHint = () => { if (hint) hint.classList.add('hidden'); };
  window.addEventListener('touchstart', hideHint, { once: true, passive: true });

  // ── Audio unlock on first gesture (browsers require one). ─────────────
  const unlock = () => { game.audio.unlock(); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);

  // ── Pause when the tab loses focus ────────────────────────────────────
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.state === 'play') {
      game.setState('pause');
    }
  });

  // ── Fixed-timestep loop with accumulator ──────────────────────────────
  const STEP = 1 / 60;
  let last = performance.now();
  let acc = 0;
  let running = true;

  function frame(now) {
    if (!running) return;
    let dt = (now - last) / 1000;
    last = now;
    // Clamp to avoid a spiral of death after a tab switch.
    if (dt > 0.25) dt = 0.25;
    acc += dt;

    // Poll input once per frame (edge detection is per-frame).
    input.beginFrame();

    let steps = 0;
    while (acc >= STEP && steps < 5) {
      game.update(STEP);
      input.endStep();
      acc -= STEP;
      steps++;
    }
    if (steps === 0) {
      // Ensure edge flags don't leak when we skip a frame.
      input.endStep();
    }

    game.render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Expose a tiny debug handle (harmless, useful for QA).
  window.__pixelbound = { game, Save };
}

// ─────────────────────────────────────────────────────────────────────────
//  Touch controls: multitouch-capable zones laid out over the canvas.
//  We bind to specific DOM elements (not the canvas) so taps never bleed into
//  gameplay, and we use pointer events for unified mouse/touch handling.
// ─────────────────────────────────────────────────────────────────────────
function setupTouchControls(input) {
  const bindHold = (el, action) => {
    if (!el) return;
    const press = (e) => {
      e.preventDefault();
      el.classList.add('pressed');
      input.setTouchAction(action, true);
      try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    };
    const release = (e) => {
      e.preventDefault();
      el.classList.remove('pressed');
      input.setTouchAction(action, false);
    };
    el.addEventListener('pointerdown', press);
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('pointerleave', (e) => {
      // With pointer capture, leave fires only when the capture is lost.
      if (e.buttons === 0) release(e);
    });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  };

  bindHold(document.getElementById('btn-left'), 'left');
  bindHold(document.getElementById('btn-right'), 'right');
  bindHold(document.getElementById('btn-jump'), 'jump');
  bindHold(document.getElementById('btn-dash'), 'dash');
  bindHold(document.getElementById('btn-pause'), 'pause');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
