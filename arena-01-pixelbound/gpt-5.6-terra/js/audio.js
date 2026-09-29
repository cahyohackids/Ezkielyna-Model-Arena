export class AudioManager {
  constructor(settings) { this.settings = settings; this.ctx = null; this.musicTimer = null; this.step = 0; }
  wake() { if (this.settings.mute) return; if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); if (this.ctx.state === 'suspended') this.ctx.resume(); if (!this.musicTimer) this.startMusic(); }
  tone(freq, duration=.08, type='square', gain=.06, slide=0) {
    if (this.settings.mute || !this.ctx) return;
    const c=this.ctx, t=c.currentTime, o=c.createOscillator(), g=c.createGain();
    o.type=type; o.frequency.setValueAtTime(freq,t); if(slide) o.frequency.exponentialRampToValueAtTime(Math.max(30,freq+slide),t+duration);
    g.gain.setValueAtTime(.001,t); g.gain.exponentialRampToValueAtTime(gain*(this.settings.sfx/100),t+.008); g.gain.exponentialRampToValueAtTime(.001,t+duration);
    o.connect(g).connect(c.destination); o.start(t);o.stop(t+duration+.02);
  }
  noise(duration=.08, gain=.04) { if(this.settings.mute||!this.ctx)return; const c=this.ctx,b=c.createBuffer(1,c.sampleRate*duration,c.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*(1-i/d.length);const s=c.createBufferSource(),g=c.createGain();g.gain.value=gain*(this.settings.sfx/100);s.buffer=b;s.connect(g).connect(c.destination);s.start(); }
  effect(name) { const e={jump:()=>{this.tone(350,.07,'square',.05,190);this.tone(620,.08,'triangle',.035,80)},dash:()=>{this.tone(170,.12,'sawtooth',.05,600)},bit:()=>{this.tone(760,.06,'square',.04,230)},core:()=>{this.tone(330,.12,'triangle',.06,600);setTimeout(()=>this.tone(660,.14,'sine',.05,340),65)},hurt:()=>{this.tone(180,.2,'sawtooth',.07,-80);this.noise(.07,.035)},stomp:()=>{this.tone(140,.09,'square',.06,100);this.noise(.04,.03)},check:()=>{this.tone(440,.08,'triangle',.05,140);setTimeout(()=>this.tone(660,.12,'triangle',.05,180),80)},tower:()=>{[330,440,660,880].forEach((f,i)=>setTimeout(()=>this.tone(f,.25,'sine',.05,80),i*95))},land:()=>this.noise(.025,.018)};e[name]?.(); }
  startMusic(){ if(!this.ctx)return; const notes=[220,0,262,0,330,294,262,0,196,0,247,0,294,262,247,0]; this.musicTimer=setInterval(()=>{if(this.settings.mute||!this.ctx)return;const n=notes[this.step++%notes.length];if(n){const c=this.ctx,t=c.currentTime,o=c.createOscillator(),g=c.createGain();o.type='triangle';o.frequency.value=n;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.018*(this.settings.music/100),t+.03);g.gain.exponentialRampToValueAtTime(.0001,t+.28);o.connect(g).connect(c.destination);o.start(t);o.stop(t+.3)}},310); }
}
