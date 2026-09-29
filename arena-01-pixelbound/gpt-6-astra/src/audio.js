export class AudioManager {
  constructor(settings) { this.settings = settings; this.ctx = null; this.nextNote = 0; this.note = 0; this.sector = 0; this.active = false; }
  unlock() {
    try {
      if (!this.ctx) { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); this.music = this.ctx.createGain(); this.sfx = this.ctx.createGain(); this.music.connect(this.ctx.destination); this.sfx.connect(this.ctx.destination); this.apply(); }
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    } catch {}
  }
  apply() { if (!this.ctx) return; const t = this.ctx.currentTime; this.music.gain.setTargetAtTime(this.settings.mute ? 0 : this.settings.music / 100 * .24, t, .05); this.sfx.gain.setTargetAtTime(this.settings.mute ? 0 : this.settings.sfx / 100 * .34, t, .03); }
  tone(freq, duration, type = 'triangle', volume = .3, delay = 0, to = null, channel = 'sfx') {
    if (!this.ctx || this.settings.mute) return;
    const time = this.ctx.currentTime + delay, osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, time);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, time + duration);
    gain.gain.setValueAtTime(.0001, time); gain.gain.exponentialRampToValueAtTime(Math.max(.0002, volume), time + .012); gain.gain.exponentialRampToValueAtTime(.0001, time + duration);
    osc.connect(gain); gain.connect(this[channel]); osc.start(time); osc.stop(time + duration + .02);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }
  play(name) {
    if (name === 'jump') this.tone(230, .13, 'triangle', .3, 0, 490);
    if (name === 'dash') { this.tone(170, .18, 'sawtooth', .12, 0, 60); this.tone(620, .12, 'sine', .2, 0, 160); }
    if (name === 'bit') { this.tone(880, .1, 'sine', .4); this.tone(1320, .13, 'triangle', .22, .045); }
    if (name === 'core') [440, 660, 880, 1320].forEach((n, i) => this.tone(n, .32, 'sine', .45, i * .07));
    if (name === 'stomp') { this.tone(190, .13, 'square', .18, 0, 65); this.tone(570, .1, 'triangle', .23, .04); }
    if (name === 'hurt') this.tone(210, .28, 'sawtooth', .18, 0, 70);
    if (name === 'death') [250, 185, 125, 70].forEach((n, i) => this.tone(n, .24, 'triangle', .3, i * .11));
    if (name === 'checkpoint') [330, 440, 660].forEach((n, i) => this.tone(n, .45, 'sine', .45, i * .1));
    if (name === 'complete') [330, 440, 554, 660, 880, 1108].forEach((n, i) => this.tone(n, .65, 'triangle', .25, i * .12));
    if (name === 'bounce') this.tone(130, .25, 'triangle', .3, 0, 720);
    if (name === 'ui') this.tone(660, .055, 'sine', .17);
  }
  update(active, sector = 0) {
    this.active = active; this.sector = sector;
    if (!this.ctx || this.ctx.state !== 'running' || !active || this.settings.mute) { this.nextNote = 0; return; }
    const t = this.ctx.currentTime;
    if (this.nextNote < t) this.nextNote = t + .03;
    if (this.nextNote < t + .12) {
      const notes = [[57, 64, 69, 64, 60, 67, 72, 67, 53, 60, 65, 60, 55, 62, 67, 62], [50, 57, 62, 65, 53, 60, 65, 69, 48, 55, 60, 64, 52, 59, 64, 67], [52, 59, 64, 67, 55, 62, 67, 71, 50, 57, 62, 66, 47, 54, 59, 62]][sector];
      const index = this.note++ % notes.length, frequency = 440 * 2 ** ((notes[index] - 69) / 12), delay = this.nextNote - t;
      this.tone(frequency, .85, 'sine', .23, delay, null, 'music');
      if (index % 4 === 0) this.tone(frequency / 2, 1.6, 'triangle', .12, delay, null, 'music');
      this.nextNote += sector === 2 ? .29 : .36;
    }
  }
}
