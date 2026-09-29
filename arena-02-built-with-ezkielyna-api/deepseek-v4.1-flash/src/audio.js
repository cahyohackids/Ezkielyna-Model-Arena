// audio.js — 100% procedural audio via Web Audio API.
// No external assets: every sound is synthesized at runtime, so nothing is
// copyrighted and nothing needs to be fetched.
//
// Design:
//  - A single AudioContext created lazily on first user gesture.
//  - `sfx` bus and `music` bus both route to a master gain.
//  - SFX are one-shot oscillator/noise graphs with envelopes.
//  - Music is a slow generative arpeggio + pad driven by a lookahead scheduler,
//    so it never loops audibly and stays subtle.

import { Save } from './save.js';

const NOTE = (semi, base = 220) => base * Math.pow(2, semi / 12);

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfxBus = null;
    this.musicBus = null;
    this.ready = false;
    this.started = false;
    this._noiseBuf = null;
    this._musicTimer = null;
    this._nextNoteTime = 0;
    this._step = 0;
    this._musicMode = 'menu';   // 'menu' | 'level' | 'none'
    this._intensity = 0;        // 0..1 -> level theme tension
    this._recent = new Map();   // throttle duplicate sfx
  }

  /** Must be called from a user gesture handler. Safe to call repeatedly. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      try {
        this.ctx = new AC();
      } catch (e) { return false; }
      this.master = this.ctx.createGain();
      this.master.gain.value = 1;
      this.master.connect(this.ctx.destination);

      // Gentle limiter-ish compression to keep layered SFX from clipping.
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -10;
      comp.knee.value = 12;
      comp.ratio.value = 6;
      comp.attack.value = 0.004;
      comp.release.value = 0.18;
      comp.connect(this.master);

      this.sfxBus = this.ctx.createGain();
      this.sfxBus.connect(comp);
      this.musicBus = this.ctx.createGain();
      this.musicBus.connect(comp);

      this._noiseBuf = this._makeNoise(2.0);
      this._applyVolumes();
      this._applyPending();
      this.ready = true;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.started = true;
    return true;
  }

  _applyVolumes() {
    if (!this.ready) return;
    const s = Save.settings();
    const m = s.muted ? 0 : 1;
    this.master.gain.setTargetAtTime(m, this.ctx.currentTime, 0.02);
    this.sfxBus.gain.setTargetAtTime(s.sfx, this.ctx.currentTime, 0.02);
    this.musicBus.gain.setTargetAtTime(s.music * 0.5, this.ctx.currentTime, 0.02);
  }

  /** Called whenever settings change. */
  refresh() { this._applyVolumes(); }

  /** Explicit volume setter used by the game shell after a settings change. */
  setVolumes(music, sfx, muted) {
    if (this.ready) {
      const m = muted ? 0 : 1;
      this.master.gain.setTargetAtTime(m, this.ctx.currentTime, 0.02);
      this.sfxBus.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.02);
      this.musicBus.gain.setTargetAtTime(music * 0.5, this.ctx.currentTime, 0.02);
    }
    this._pendingVolumes = { music, sfx, muted };
  }

  /** Called from setVolumes before the context exists — applied on unlock. */
  _applyPending() {
    const p = this._pendingVolumes;
    if (!p) return;
    const m = p.muted ? 0 : 1;
    this.master.gain.setTargetAtTime(m, this.ctx.currentTime, 0.02);
    this.sfxBus.gain.setTargetAtTime(p.sfx, this.ctx.currentTime, 0.02);
    this.musicBus.gain.setTargetAtTime(p.music * 0.5, this.ctx.currentTime, 0.02);
  }

  /** Per-frame maintenance: keeps music scheduled and prunes throttles. */
  update(dt) {
    if (!this.ready) return;
    // Music relies on the lookahead scheduler, but if the tab was throttled the
    // queue can fall behind. Nudge it forward so notes resume cleanly.
    if (this._musicMode !== 'none' && this._nextNoteTime < this.ctx.currentTime - 0.5) {
      this._nextNoteTime = this.ctx.currentTime + 0.08;
    }
    this._throttleTick = (this._throttleTick || 0) + dt;
    if (this._throttleTick > 0.25) {
      this._throttleTick = 0;
      this._pruneThrottles();
    }
  }

  _pruneThrottles() {
    const now = this._now();
    for (const [k, v] of this._recent) {
      if (now - v > 1.5) this._recent.delete(k);
    }
  }

  /** Game-over cue: a descending "no carrier" sweep. */
  signalLost() {
    if (!this.ready) return;
    this._tone(NOTE(12, 196), NOTE(12, 196), 0.5, { type: 'sine', gain: 0.12 });
    this._tone(NOTE(7, 196), NOTE(7, 196), 0.5, { type: 'sine', gain: 0.10, delay: 0.22 });
    this._tone(NOTE(0, 196) * 0.5, NOTE(0, 196) * 0.5, 1.2, { type: 'triangle', gain: 0.10, delay: 0.46 });
    this._noise(1.4, { gain: 0.09, type: 'lowpass', freq: 420, decay: 0.95, delay: 0.1 });
  }

  /** Generic UI confirm wherever a dedicated cue isn't warranted. */
  uiClick() { this.uiSelect(); }

  /** Denied / locked / unavailable. */
  uiDeny() {
    if (!this.ready) return;
    this._tone(220, 160, 0.14, { type: 'square', gain: 0.10 });
    this._tone(150, 110, 0.16, { type: 'triangle', gain: 0.07, delay: 0.02 });
  }

  _makeNoise(seconds) {
    const n = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) {
      // Slightly brown-ish noise reads warmer than pure white.
      const w = Math.random() * 2 - 1;
      last = (last + 0.04 * w) / 1.04;
      d[i] = w * 0.6 + last * 3.0;
    }
    return buf;
  }

  _now() { return this.ctx.currentTime; }

  _noise(dur, { gain = 0.3, type = 'lowpass', freq = 1200, q = 1, decay = 0.9, delay = 0 } = {}) {
    const t = this._now() + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuf;
    src.playbackRate.value = 1;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur * decay);
    src.connect(f); f.connect(g); g.connect(this.sfxBus);
    src.start(t);
    src.stop(t + dur + 0.05);
    return { src, f, g };
  }

  _tone(freqA, freqB, dur, { type = 'square', gain = 0.2, attack = 0.005, delay = 0, detune = 0 } = {}) {
    const t = this._now() + delay;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.detune.value = detune;
    o.frequency.setValueAtTime(freqA, t);
    if (freqB !== freqA) o.frequency.exponentialRampToValueAtTime(Math.max(20, freqB), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.02);
    return { o, g };
  }

  _throttle(key, ms) {
    const now = performance.now();
    const last = this._recent.get(key) || 0;
    if (now - last < ms) return false;
    this._recent.set(key, now);
    return true;
  }

  // ------------------------------------------------ SFX ------------------------------------------------

  jump() {
    if (!this.ready) return;
    this._tone(360, 640, 0.14, { type: 'square', gain: 0.16 });
    this._tone(180, 320, 0.10, { type: 'triangle', gain: 0.10, delay: 0.005 });
  }

  doubleJumpish() {
    if (!this.ready) return;
    this._tone(520, 880, 0.12, { type: 'square', gain: 0.13 });
  }

  land(strength = 1) {
    if (!this.ready) return;
    if (!this._throttle('land', 60)) return;
    const g = 0.08 + 0.12 * Math.min(1, strength);
    this._noise(0.14, { gain: g, type: 'lowpass', freq: 700 + 300 * strength, decay: 0.7 });
    this._tone(150, 90, 0.08, { type: 'triangle', gain: 0.08 * strength });
  }

  step() {
    if (!this.ready) return;
    if (!this._throttle('step', 110)) return;
    this._noise(0.05, { gain: 0.05, type: 'highpass', freq: 1800, decay: 0.6 });
  }

  dash() {
    if (!this.ready) return;
    this._noise(0.28, { gain: 0.16, type: 'bandpass', freq: 900, q: 0.8, decay: 0.85 });
    this._tone(900, 260, 0.22, { type: 'sawtooth', gain: 0.09 });
    this._tone(1500, 500, 0.16, { type: 'triangle', gain: 0.05, delay: 0.01 });
  }

  coin(n = 0) {
    if (!this.ready) return;
    const base = 880 * Math.pow(1.0595, Math.min(n, 12) * 1.2);
    this._tone(base, base * 1.5, 0.10, { type: 'triangle', gain: 0.13 });
    this._tone(base * 2, base * 3, 0.09, { type: 'square', gain: 0.05, delay: 0.03 });
    this._noise(0.1, { gain: 0.05, type: 'highpass', freq: 3000, decay: 0.5 });
  }

  coreCollect() {
    if (!this.ready) return;
    const seq = [0, 4, 7, 12, 19];
    seq.forEach((s, i) => {
      this._tone(NOTE(s, 440), NOTE(s, 440), 0.26, { type: 'triangle', gain: 0.11, delay: i * 0.075 });
      this._tone(NOTE(s, 880), NOTE(s, 880), 0.18, { type: 'sine', gain: 0.05, delay: i * 0.075 + 0.01 });
    });
    this._noise(0.9, { gain: 0.05, type: 'bandpass', freq: 2600, q: 0.7, decay: 0.9 });
  }

  stomp() {
    if (!this.ready) return;
    this._tone(420, 120, 0.14, { type: 'square', gain: 0.17 });
    this._noise(0.22, { gain: 0.18, type: 'lowpass', freq: 900, decay: 0.8 });
    this._tone(1600, 2400, 0.07, { type: 'triangle', gain: 0.06, delay: 0.02 });
  }

  enemyHit() {
    if (!this.ready) return;
    this._tone(260, 70, 0.2, { type: 'sawtooth', gain: 0.14 });
    this._noise(0.24, { gain: 0.14, type: 'bandpass', freq: 500, q: 1.2, decay: 0.9 });
  }

  hurt() {
    if (!this.ready) return;
    this._tone(300, 110, 0.3, { type: 'square', gain: 0.16 });
    this._tone(150, 60, 0.34, { type: 'sawtooth', gain: 0.11, delay: 0.01 });
    this._noise(0.3, { gain: 0.12, type: 'lowpass', freq: 600, decay: 0.9 });
  }

  death() {
    if (!this.ready) return;
    const seq = [12, 7, 3, -2, -7];
    seq.forEach((s, i) => {
      this._tone(NOTE(s, 330), NOTE(s, 330) * 0.94, 0.32, { type: 'triangle', gain: 0.12, delay: i * 0.13 });
    });
    this._noise(1.1, { gain: 0.08, type: 'lowpass', freq: 500, decay: 0.95, delay: 0.05 });
  }

  checkpoint() {
    if (!this.ready) return;
    [0, 7, 12].forEach((s, i) => {
      this._tone(NOTE(s, 392), NOTE(s, 392), 0.45, { type: 'triangle', gain: 0.11, delay: i * 0.09 });
    });
    this._tone(NOTE(19, 392), NOTE(24, 392), 0.7, { type: 'sine', gain: 0.07, delay: 0.28 });
    this._noise(0.5, { gain: 0.05, type: 'bandpass', freq: 1800, q: 0.6, decay: 0.9 });
  }

  bounce() {
    if (!this.ready) return;
    this._tone(240, 880, 0.22, { type: 'sine', gain: 0.18 });
    this._tone(480, 1400, 0.16, { type: 'triangle', gain: 0.08, delay: 0.01 });
    this._noise(0.12, { gain: 0.06, type: 'highpass', freq: 1200, decay: 0.5 });
  }

  platformBreak() {
    if (!this.ready) return;
    if (!this._throttle('brk', 70)) return;
    this._noise(0.4, { gain: 0.16, type: 'lowpass', freq: 1400, decay: 0.9 });
    this._tone(220, 70, 0.3, { type: 'square', gain: 0.1 });
  }

  laserHum() {
    if (!this.ready) return;
    if (!this._throttle('laser', 240)) return;
    this._tone(700, 760, 0.2, { type: 'sawtooth', gain: 0.035 });
  }

  zap() {
    if (!this.ready) return;
    this._noise(0.22, { gain: 0.16, type: 'highpass', freq: 900, decay: 0.8 });
    this._tone(1200, 180, 0.2, { type: 'sawtooth', gain: 0.12 });
  }

  towerActive() {
    if (!this.ready) return;
    const t0 = 0;
    [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => {
      this._tone(NOTE(s, 330), NOTE(s, 330), 0.6, { type: 'triangle', gain: 0.10, delay: t0 + i * 0.1 });
      this._tone(NOTE(s + 12, 330), NOTE(s + 12, 330), 0.4, { type: 'sine', gain: 0.04, delay: t0 + i * 0.1 + 0.02 });
    });
    // rising swell
    this._tone(110, 660, 1.4, { type: 'sawtooth', gain: 0.055, delay: t0 + 0.15 });
    this._tone(165, 990, 1.4, { type: 'triangle', gain: 0.04, delay: t0 + 0.3 });
    this._noise(1.8, { gain: 0.09, type: 'bandpass', freq: 2400, q: 0.6, decay: 0.95, delay: 0.1 });
  }

  levelComplete() {
    if (!this.ready) return;
    const mel = [[0, 0], [4, 0.14], [7, 0.28], [12, 0.42], [16, 0.56], [19, 0.72], [24, 0.9]];
    mel.forEach(([s, d], i) => {
      this._tone(NOTE(s, 349), NOTE(s, 349), 0.5, { type: 'triangle', gain: 0.11, delay: d });
      if (i < mel.length - 1) this._tone(NOTE(s + 7, 349), NOTE(s + 7, 349), 0.35, { type: 'sine', gain: 0.05, delay: d + 0.02 });
    });
    this._tone(NOTE(0, 174), NOTE(0, 174), 1.6, { type: 'triangle', gain: 0.09, delay: 0.9 });
    this._tone(NOTE(7, 174), NOTE(7, 174), 1.6, { type: 'sine', gain: 0.06, delay: 0.9 });
  }

  uiMove() {
    if (!this.ready) return;
    if (!this._throttle('uimove', 55)) return;
    this._tone(680, 760, 0.05, { type: 'square', gain: 0.06 });
  }

  uiSelect() {
    if (!this.ready) return;
    this._tone(600, 1100, 0.1, { type: 'square', gain: 0.1 });
    this._tone(1200, 1800, 0.07, { type: 'triangle', gain: 0.05, delay: 0.02 });
  }

  uiBack() {
    if (!this.ready) return;
    this._tone(500, 300, 0.11, { type: 'square', gain: 0.09 });
  }

  phaseBlock() {
    if (!this.ready) return;
    if (!this._throttle('phase', 90)) return;
    this._tone(520, 900, 0.09, { type: 'triangle', gain: 0.05 });
    this._noise(0.1, { gain: 0.035, type: 'bandpass', freq: 2000, q: 1, decay: 0.6 });
  }

  /** Aliases used by menu code — a confirm is a bright select, a denial a soft
   *  descending blip. Kept as thin wrappers so the vocabulary stays small. */
  uiClick() { this.uiSelect(); }
  uiDeny() { this.uiBack(); }

  // (Music maintenance is handled by update() above — the scheduler is nudged
  //  forward when the tab has been throttled.)

  // ---------------------------------------------- MUSIC ------------------------------------------------

  /** mode: 'menu' | 'level' | 'none' | 'paused' | 'lost'. */
  setMusic(mode, mood = 0) {
    if (this._musicMode === mode && Math.abs(this._intensity - mood) < 0.001) return;
    this._intensity = mood;
    if (mode === 'none' || mode === 'lost' || mode === 'paused') {
      this._musicMode = mode;
      this._stopMusic();
      return;
    }
    this._musicMode = mode;
    if (!this.ready) return;
    this._startMusic();
  }

  /** Resume whichever track the current screen implies (after unmute). */
  refreshMusic() {
    const m = this._musicMode;
    this._musicMode = '__refresh__';
    this.setMusic(m, this._intensity);
  }
  _stopMusic() {
    if (this._musicTimer) { clearInterval(this._musicTimer); this._musicTimer = null; }
    this._activeNodes?.forEach((n) => { try { n.stop(); } catch (e) {} });
    this._activeNodes = [];
  }

  _startMusic() {
    if (!this.ready) return;
    if (this._musicTimer) return;
    this._nextNoteTime = this._now() + 0.12;
    this._step = 0;
    this._activeNodes = [];
    this._musicTimer = setInterval(() => this._scheduleMusic(), 90);
  }

  /** Scales: minor pentatonic-ish for tension, major-ish for menu warmth. */
  _scale() {
    if (this._musicMode === 'menu') return [0, 2, 4, 7, 9, 12, 14, 16];
    if (this._intensity >= 2) return [0, 3, 5, 6, 7, 10, 12, 15];   // darker, tower
    if (this._intensity >= 1) return [0, 2, 3, 7, 8, 12, 14, 15];   // caves
    return [0, 2, 4, 7, 9, 12, 14, 16];                            // meadow
  }

  _scheduleMusic() {
    if (!this.ready || this._musicMode === 'none' || this._musicMode === 'lost' || this._musicMode === 'paused') return;
    const ctx = this.ctx;
    const lookahead = 0.6;
    const bpm = this._musicMode === 'menu' ? 74 : 96 + this._intensity * 8;
    const spb = 60 / bpm;
    const sixteenth = spb / 2;

    while (this._nextNoteTime < ctx.currentTime + lookahead) {
      const t = this._nextNoteTime;
      const scale = this._scale();
      const s = this._step;
      const root = this._musicMode === 'menu' ? 174.6 : [174.6, 146.8, 130.8][Math.min(2, this._intensity)];

      // Bass pulse on beats
      if (s % 8 === 0 || s % 8 === 6) {
        this._musicVoice(NOTE(scale[0], root) / 2, t, spb * 1.4, 0.075, 'triangle');
      }
      // Pad every 16 steps
      if (s % 32 === 0) {
        this._musicVoice(NOTE(scale[0], root), t, spb * 6, 0.035, 'sine');
        this._musicVoice(NOTE(scale[4 % scale.length], root), t, spb * 6, 0.026, 'sine');
      }
      // Arpeggio motif
      const arpPattern = this._musicMode === 'menu' ? [0, 2, 4, 3, 5, 4, 2, 1] : [0, 3, 4, 2, 5, 4, 6, 3];
      if (s % 2 === 0 || (this._intensity >= 2 && s % 3 === 0)) {
        const idx = arpPattern[(s / 2 | 0) % arpPattern.length];
        const semi = scale[idx % scale.length] + (s % 16 >= 8 ? 12 : 0);
        const gain = 0.030 + this._intensity * 0.006;
        this._musicVoice(NOTE(semi, root * 2), t, sixteenth * 1.6, gain, 'triangle');
      }
      // Occasional sparkle
      if (s % 16 === 11 && this._musicMode !== 'menu') {
        this._musicVoice(NOTE(scale[6 % scale.length] + 12, root * 2), t, sixteenth * 1.2, 0.018, 'sine');
      }

      this._nextNoteTime += sixteenth;
      this._step = (this._step + 1) % 64;
    }
  }

  _musicVoice(freq, t, dur, gain, type) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    // Soften with a lowpass so pads aren't harsh.
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = type === 'triangle' ? 2600 : 1600;
    o.connect(f); f.connect(g); g.connect(this.musicBus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
}
