export class AudioManager {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.timer = null;
    this.step = 0;
    this.theme = 0;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.musicGain.connect(this.master);
      this.sfxGain.connect(this.master);
      this.master.connect(this.ctx.destination);
      this.applySettings();
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
  }

  applySettings() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.settings.mute ? 0 : 0.8, now, 0.02);
    this.musicGain.gain.setTargetAtTime(this.settings.music * 0.32, now, 0.02);
    this.sfxGain.gain.setTargetAtTime(this.settings.sfx * 0.48, now, 0.02);
  }

  tone(freq, duration = 0.08, type = "square", volume = 0.15, slide = 0, delay = 0) {
    if (!this.ctx || this.settings.mute) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + duration);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(volume, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain); gain.connect(this.sfxGain);
    osc.start(t); osc.stop(t + duration + 0.02);
  }

  noise(duration = 0.08, volume = 0.08, delay = 0) {
    if (!this.ctx || this.settings.mute) return;
    const sampleCount = Math.max(1, this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, sampleCount, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / sampleCount);
    const src = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    filter.type = "highpass"; filter.frequency.value = 500;
    gain.gain.value = volume;
    src.buffer = buffer; src.connect(filter); filter.connect(gain); gain.connect(this.sfxGain);
    src.start(this.ctx.currentTime + delay);
  }

  play(name) {
    this.unlock();
    const sound = {
      jump: () => { this.tone(230, .11, "square", .13, 130); this.tone(470, .05, "triangle", .05, 80, .035); },
      dash: () => { this.noise(.11, .12); this.tone(150, .12, "sawtooth", .1, 360); },
      bit: () => { this.tone(620, .07, "square", .1, 180); this.tone(930, .08, "triangle", .06, 60, .04); },
      core: () => [0, .09, .18].forEach((d, i) => this.tone([440, 660, 880][i], .18, "triangle", .12, 80, d)),
      stomp: () => { this.tone(150, .09, "square", .13, -70); this.noise(.06, .08); },
      hurt: () => { this.tone(220, .2, "sawtooth", .13, -150); this.noise(.12, .1); },
      bounce: () => { this.tone(180, .18, "square", .12, 600); },
      checkpoint: () => [0, .08, .16, .24].forEach((d, i) => this.tone([330, 440, 555, 660][i], .13, "triangle", .1, 30, d)),
      death: () => [0, .12, .24].forEach((d, i) => this.tone([310, 230, 130][i], .22, "square", .1, -40, d)),
      complete: () => [0, .1, .2, .32, .46].forEach((d, i) => this.tone([330, 440, 555, 660, 880][i], .35, "triangle", .12, 50, d)),
      click: () => this.tone(360, .04, "square", .06, 50),
    }[name];
    sound?.();
  }

  startMusic(theme = 0) {
    this.unlock(); this.stopMusic(); this.theme = theme; this.step = 0;
    const patterns = [
      [0, 7, 12, 7, 3, 10, 12, 15],
      [0, 3, 7, 10, -2, 3, 5, 10],
      [0, 12, 7, 15, 3, 10, 6, 12],
    ];
    const roots = [110, 82.41, 98];
    const tick = () => {
      if (!this.ctx || this.settings.mute) return;
      const p = patterns[this.theme] || patterns[0];
      const note = roots[this.theme] * Math.pow(2, p[this.step % p.length] / 12);
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
      osc.type = this.theme === 1 ? "triangle" : "square";
      osc.frequency.value = note;
      gain.gain.setValueAtTime(.055, t); gain.gain.exponentialRampToValueAtTime(.001, t + .38);
      osc.connect(gain); gain.connect(this.musicGain); osc.start(t); osc.stop(t + .4);
      if (this.step % 4 === 0) {
        const bass = this.ctx.createOscillator(), bg = this.ctx.createGain();
        bass.type = "sine"; bass.frequency.value = note / 2;
        bg.gain.setValueAtTime(.08, t); bg.gain.exponentialRampToValueAtTime(.001, t + .7);
        bass.connect(bg); bg.connect(this.musicGain); bass.start(t); bass.stop(t + .72);
      }
      this.step++;
    };
    tick(); this.timer = setInterval(tick, this.settings.reducedMotion ? 480 : 420);
  }

  stopMusic() { if (this.timer) clearInterval(this.timer); this.timer = null; }
}
