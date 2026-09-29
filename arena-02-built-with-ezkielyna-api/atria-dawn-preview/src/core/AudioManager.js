// Procedural sound synthesis with the Web Audio API. All SFX are generated
// from oscillators / noise buffers at runtime; the background music is a
// small generative arpeggio loop. No external audio files are used.

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.settings = { music: 0.45, sfx: 0.7, muted: false };
    this._noiseBuffer = null;
    this._musicTimer = null;
    this._musicStep = 0;
    this._musicPlaying = false;
    this._theme = 0;
  }

  // Audio must be created after a user gesture; call this on first input.
  init() {
    if (this.ctx) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 1;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.musicGain.connect(this.master);
      this.sfxGain.connect(this.master);
      this._applyVolumes();
      this._makeNoise();
    } catch (e) {
      this.ctx = null;
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  _makeNoise() {
    const len = this.ctx.sampleRate * 0.5;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this._noiseBuffer = buf;
  }

  _applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const m = this.settings.muted ? 0 : this.settings.music;
    const s = this.settings.muted ? 0 : this.settings.sfx;
    this.musicGain.gain.setTargetAtTime(m * 0.5, t, 0.05);
    this.sfxGain.gain.setTargetAtTime(s, t, 0.05);
  }

  setSettings(settings) {
    this.settings = Object.assign(this.settings, settings);
    this._applyVolumes();
  }

  // ---------- low-level helpers ----------
  _tone(freq, dur, type = 'square', vol = 0.3, slideTo = null, when = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  _noise(dur, vol = 0.3, filterFreq = 1200, filterType = 'lowpass', when = 0) {
    if (!this.ctx || !this._noiseBuffer) return;
    const t = this.ctx.currentTime + when;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(filterFreq, t);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfxGain);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  // ---------- SFX ----------
  jump() {
    this._tone(330, 0.13, 'square', 0.22, 560);
    this._tone(660, 0.09, 'triangle', 0.12, 880, 0.02);
  }

  land() {
    this._noise(0.07, 0.16, 500, 'lowpass');
    this._tone(150, 0.06, 'square', 0.1, 90);
  }

  dash() {
    this._noise(0.16, 0.2, 2400, 'bandpass');
    this._tone(520, 0.14, 'sawtooth', 0.14, 180);
  }

  pickup() {
    this._tone(880, 0.07, 'square', 0.16, 1320);
    this._tone(1320, 0.1, 'triangle', 0.14, 1760, 0.05);
  }

  core() {
    this._tone(660, 0.08, 'square', 0.18, 990);
    this._tone(990, 0.09, 'square', 0.16, 1480, 0.07);
    this._tone(1480, 0.16, 'triangle', 0.14, 1980, 0.15);
  }

  stomp() {
    this._noise(0.1, 0.22, 900, 'lowpass');
    this._tone(220, 0.1, 'square', 0.18, 520);
  }

  enemyDie() {
    this._tone(440, 0.16, 'sawtooth', 0.16, 110);
    this._noise(0.14, 0.14, 1400, 'bandpass', 0.02);
  }

  damage() {
    this._tone(200, 0.22, 'sawtooth', 0.24, 70);
    this._noise(0.18, 0.18, 700, 'lowpass');
  }

  death() {
    this._tone(330, 0.5, 'sawtooth', 0.22, 60);
    this._tone(220, 0.6, 'square', 0.14, 50, 0.08);
  }

  checkpoint() {
    this._tone(520, 0.1, 'square', 0.16, 780);
    this._tone(780, 0.1, 'square', 0.16, 1040, 0.08);
    this._tone(1040, 0.2, 'triangle', 0.14, 1560, 0.16);
  }

  bounce() {
    this._tone(280, 0.12, 'square', 0.18, 720);
    this._tone(560, 0.1, 'triangle', 0.12, 900, 0.04);
  }

  laser() {
    this._tone(1200, 0.08, 'sawtooth', 0.08, 500);
  }

  complete() {
    const seq = [523, 659, 784, 1047];
    seq.forEach((f, i) => this._tone(f, 0.18, 'square', 0.18, f * 1.5, i * 0.1));
    this._tone(1568, 0.4, 'triangle', 0.16, 2093, 0.45);
  }

  uiMove() { this._tone(520, 0.04, 'square', 0.08, 660); }
  uiSelect() { this._tone(660, 0.07, 'square', 0.12, 990); }
  uiBack() { this._tone(440, 0.06, 'square', 0.1, 330); }

  // ---------- generative music ----------
  // Each level theme = different scale + tempo. A small pattern engine
  // arpeggiates through chords with a soft synth voice + occasional bass.
  startMusic(themeIndex) {
    if (!this.ctx) return;
    this._theme = themeIndex;
    if (this._musicPlaying) return;
    this._musicPlaying = true;
    this._musicStep = 0;
    const tempo = [112, 96, 128][themeIndex] || 112;
    this._interval = 60000 / tempo / 2; // eighth notes
    this._tickMusic();
  }

  stopMusic() {
    this._musicPlaying = false;
    if (this._musicTimer) { clearTimeout(this._musicTimer); this._musicTimer = null; }
  }

  _tickMusic() {
    if (!this._musicPlaying || !this.ctx) return;
    const themes = [
      // Signal Meadow: bright lydian-ish, C major
      { root: 261.63, scale: [0, 2, 4, 7, 9], chords: [[0, 4, 7], [2, 5, 9], [4, 7, 11], [-1, 2, 7]] },
      // Circuit Caverns: minor, slower, D minor
      { root: 146.83, scale: [0, 2, 3, 7, 8], chords: [[0, 3, 7], [2, 5, 8], [3, 7, 10], [-2, 0, 5]] },
      // Glitch Tower: phrygian-ish, tense, E
      { root: 164.81, scale: [0, 1, 3, 5, 7, 8], chords: [[0, 3, 7], [1, 5, 8], [3, 7, 10], [5, 8, 0]] },
    ];
    const th = themes[this._theme] || themes[0];
    const step = this._musicStep++;
    const chord = th.chords[Math.floor(step / 8) % th.chords.length];
    const t = this.ctx.currentTime;

    if (step % 2 === 0) {
      // soft pad chord
      chord.forEach((semi, i) => {
        const f = th.root * Math.pow(2, semi / 12) * 2;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = i === 0 ? 'triangle' : 'sine';
        osc.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.05, t + 0.12);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
        osc.connect(g);
        g.connect(this.musicGain);
        osc.start(t);
        osc.stop(t + 1.0);
      });
      // bass note on beat 1 of every bar
      if (step % 8 === 0) {
        const f = th.root * Math.pow(2, chord[0] / 12) * 0.5;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.09, t + 0.05);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
        osc.connect(g);
        g.connect(this.musicGain);
        osc.start(t);
        osc.stop(t + 0.8);
      }
    }
    // arpeggio voice every step
    const note = th.scale[(step * 3) % th.scale.length] + chord[0];
    const f = th.root * Math.pow(2, note / 12) * 2;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.022, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    osc.connect(g);
    g.connect(this.musicGain);
    osc.start(t);
    osc.stop(t + 0.22);

    this._musicTimer = setTimeout(() => this._tickMusic(), this._interval);
  }
}
