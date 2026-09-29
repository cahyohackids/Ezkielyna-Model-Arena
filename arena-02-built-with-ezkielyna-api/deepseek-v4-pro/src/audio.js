// AudioManager: procedural sound + subtle music via Web Audio API.
// No external assets; everything synthesized.

export class AudioManager {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.musicTimer = null;
    this.step = 0;
    this.playing = false;
  }

  ensure() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.settings.muted ? 0 : 1;
    this.masterGain.connect(this.ctx.destination);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this.settings.musicVolume;
    this.musicGain.connect(this.masterGain);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.settings.sfxVolume;
    this.sfxGain.connect(this.masterGain);
  }

  resume() {
    this.ensure();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(m) {
    this.settings.muted = m;
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.02);
    }
  }
  setMusicVolume(v) {
    this.settings.musicVolume = v;
    if (this.musicGain) this.musicGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
  }
  setSfxVolume(v) {
    this.settings.sfxVolume = v;
    if (this.sfxGain) this.sfxGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
  }

  // ---------- SFX ----------
  _env(gainNode, t, peak, attack, decay) {
    gainNode.gain.setValueAtTime(0.0001, t);
    gainNode.gain.linearRampToValueAtTime(peak, t + attack);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  _osc(type, freq, dur, vol, dest, freqEnd, attack = 0.005) {
    this.ensure();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t + dur);
    this._env(g, t, vol, attack, dur);
    osc.connect(g);
    g.connect(dest || this.sfxGain);
    osc.start(t);
    osc.stop(t + dur + attack + 0.05);
  }

  _noise(dur, vol, filterFreq, filterType = 'lowpass') {
    this.ensure();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    this._env(g, t, vol, 0.005, dur);
    src.connect(f); f.connect(g); g.connect(this.sfxGain);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  jump() { this._osc('square', 320, 0.16, 0.25, null, 620); }
  jumpHigh() { this._osc('square', 340, 0.2, 0.28, null, 720); }
  dash() { this._noise(0.16, 0.3, 1800, 'bandpass'); this._osc('sawtooth', 180, 0.14, 0.12, null, 420); }
  land() { this._noise(0.08, 0.18, 500); }
  collect() {
    this._osc('sine', 880, 0.08, 0.22);
    setTimeout(() => this._osc('sine', 1320, 0.1, 0.18), 40);
  }
  core() {
    this._osc('sine', 660, 0.1, 0.25);
    setTimeout(() => this._osc('sine', 990, 0.1, 0.22), 60);
    setTimeout(() => this._osc('sine', 1480, 0.14, 0.22), 120);
  }
  stomp() { this._noise(0.12, 0.35, 700); this._osc('square', 200, 0.12, 0.2, null, 90); }
  enemyDie() { this._noise(0.18, 0.28, 1200, 'bandpass'); this._osc('sawtooth', 400, 0.16, 0.14, null, 80); }
  hurt() { this._osc('sawtooth', 220, 0.2, 0.3, null, 70); this._noise(0.12, 0.25, 900); }
  checkpoint() {
    this._osc('sine', 523, 0.12, 0.2);
    setTimeout(() => this._osc('sine', 659, 0.12, 0.2), 90);
    setTimeout(() => this._osc('sine', 784, 0.2, 0.22), 180);
  }
  bounce() { this._osc('square', 280, 0.18, 0.22, null, 780); }
  phase() { this._osc('sine', 500, 0.1, 0.1, null, 300); }
  towerActivate() {
    const notes = [392, 523, 659, 784, 1046];
    notes.forEach((f, i) => setTimeout(() => this._osc('sine', f, 0.28, 0.22), i * 90));
    this._noise(0.4, 0.15, 2500, 'highpass');
  }
  death() {
    this._osc('sawtooth', 300, 0.5, 0.25, null, 50);
    this._noise(0.4, 0.2, 600);
  }
  laser() { this._osc('sawtooth', 1200, 0.08, 0.1, null, 200); }
  uiClick() { this._osc('square', 700, 0.05, 0.15); }
  uiHover() { this._osc('sine', 500, 0.04, 0.08); }

  // ---------- Music ----------
  // Subtle ambient arpeggio loop, very low in mix.
  startMusic() {
    this.ensure();
    if (!this.ctx || this.playing) return;
    this.playing = true;
    this.step = 0;
    const scale = [220, 277.18, 329.63, 415.30, 440, 554.37];
    const bass = [110, 110, 130.81, 98];
    const loop = () => {
      if (!this.playing) return;
      const t = this.ctx.currentTime;
      const spb = 60 / 96; // 96 bpm, eighth notes
      // bass every 4 steps
      if (this.step % 4 === 0) {
        const b = bass[(this.step / 4) % bass.length];
        this._musicNote('triangle', b, spb * 4, 0.5, t);
      }
      // arp
      if (this.step % 2 === 0) {
        const idx = (this.step / 2 + Math.floor(this.step / 8)) % scale.length;
        const f = scale[idx] * 2;
        this._musicNote('sine', f, spb * 2, 0.22, t);
      }
      this.step++;
      const next = spb * 2 * 1000;
      this.musicTimer = setTimeout(loop, next);
    };
    loop();
  }

  _musicNote(type, freq, dur, vol, t) {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(this.musicGain);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  stopMusic() {
    this.playing = false;
    if (this.musicTimer) { clearTimeout(this.musicTimer); this.musicTimer = null; }
  }
}
