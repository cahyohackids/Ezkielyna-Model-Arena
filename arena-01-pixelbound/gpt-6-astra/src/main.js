import { SaveStore } from './utils.js';
import { buildLevel, updatePlatforms, updateEnemies } from './levels.js';
import { Player, Camera } from './physics.js';
import { InputManager } from './input.js';
import { AudioManager } from './audio.js';
import { ParticleSystem } from './particles.js';
import { Renderer } from './art.js';
import { UIManager } from './ui.js';

export class Game {
  constructor() {
    const isolatedQA = new URLSearchParams(location.search).has('qa');
    let testSave = null;
    this.store = new SaveStore(isolatedQA ? { getItem: () => testSave, setItem: (_key, value) => { testSave = value; } } : undefined); this.settings = this.store.data.settings;
    this.audio = new AudioManager(this.settings); this.renderer = new Renderer(document.getElementById('game'), this.settings);
    this.camera = new Camera(); this.particles = new ParticleSystem(); this.state = 'menu';
    this.time = 0; this.menuTime = 0; this.elapsed = 0; this.deaths = 0; this.accumulator = 0; this.lastFrame = 0; this.freeze = 0;
    this.input = new InputManager(action => {
      if (action === 'pause') this.ui.escape();
      if (action === 'restart' && this.state === 'playing') this.start(this.level.index);
      if (action === 'mute') this.ui.action('mute');
      if (action === 'blur' && this.state === 'playing') this.pause();
    });
    this.ui = new UIManager(this); this.ui.show('menu', false);
    this.loop = this.loop.bind(this); requestAnimationFrame(this.loop);
  }
  start(index) {
    this.level = buildLevel(index); this.renderer.setLevel(this.level); this.player = new Player(this.level.spawn);
    this.checkpoint = { ...this.level.spawn }; this.time = 0; this.elapsed = 0; this.deaths = 0; this.intro = 3.5; this.freeze = 0; this.deathTime = 0;
    this.camera.reset(this.player, this.level); this.particles.clear(); this.input.clear(); this.input.enabled = true;
    this.state = 'playing'; this.accumulator = 0; this.ui.show(''); this.ui.setPlaying(true); this.ui.level(this.level); this.ui.clearToast();
    this.audio.unlock(); document.getElementById('game').focus({ preventScroll: true });
  }
  menu() { this.state = 'menu'; this.input.enabled = false; this.input.clear(); this.ui.setPlaying(false); this.ui.clearToast(); this.ui.show('menu'); }
  pause() { if (this.state !== 'playing') return; this.state = 'paused'; this.input.enabled = false; this.input.clear(); this.ui.show('pause'); }
  resume() { if (this.state !== 'paused') return; this.state = 'playing'; this.input.clear(); this.input.enabled = true; this.ui.show(''); document.getElementById('game').focus({ preventScroll: true }); }
  respawn() {
    if (!this.level) return;
    this.player.reset(this.checkpoint); this.player.health = 3; this.player.invulnerable = 1.5;
    this.camera.reset(this.player, this.level); this.particles.clear(); this.state = 'playing'; this.deathTime = 0; this.freeze = 0;
    this.input.clear(); this.input.enabled = true; this.ui.show(''); this.ui.update(); document.getElementById('game').focus({ preventScroll: true });
  }
  event(event) {
    const count = this.settings.reduced ? .25 : 1;
    if (event.type === 'land') { this.particles.burst(event.x, event.y, '#9bb29b', 7 * count, 58, 90); if (event.strength > 500 && this.settings.shake) this.camera.shake = 1.5; }
    if (event.type === 'jump' || event.type === 'bounce') { this.audio.play(event.type); this.particles.burst(event.x, event.y, '#bfc5a0', 7 * count, 75, 100); }
    if (event.type === 'dash') { this.audio.play('dash'); this.particles.burst(event.x, event.y, '#b4cfb3', 8 * count, 100, 20); }
    if (event.type === 'bit' || event.type === 'core') { this.audio.play(event.type); this.particles.burst(event.x, event.y, event.type === 'core' ? '#b6dfc3' : '#efc58f', (event.type === 'core' ? 22 : 9) * count, 130, 150); if (event.type === 'core') this.ui.toast(`DATA CORE RECOVERED  ·  ${this.level.cores.filter(c => c.collected).length} / 3`); }
    if (event.type === 'stomp') { this.audio.play('stomp'); this.particles.burst(event.x, event.y, '#d9a082', 16 * count, 145); this.freeze = this.settings.reduced ? 0 : .035; this.camera.shake = 2; }
    if (event.type === 'hurt') { this.audio.play('hurt'); this.particles.burst(event.x, event.y, '#dc9d85', 13 * count, 140); this.camera.shake = 4; }
    if (event.type === 'checkpoint') { this.checkpoint = event.checkpoint; this.audio.play('checkpoint'); this.particles.burst(event.x, event.y - 40, '#abd7b4', 25 * count, 125, -20); this.ui.toast('UPLINK SAVED  ·  Energy restored'); }
    if (event.type === 'secret') this.ui.toast(`HIDDEN FREQUENCY  ·  ${event.text}`);
    if (event.type === 'death' && this.state === 'playing') {
      this.state = 'dying'; this.deathTime = 0; this.deaths++; this.input.enabled = false; this.input.clear(); this.audio.play('death'); this.camera.shake = 5;
      this.particles.burst(event.x, event.y, '#ddd8b8', 32 * count, 180); this.particles.burst(event.x, event.y, '#8db5a3', 15 * count, 220);
    }
    if (event.type === 'complete' && this.state === 'playing') {
      this.state = 'celebrating'; this.celebration = 0; this.player.vx = 0; this.player.vy = 0; this.player.facing = 1;
      this.input.enabled = false; this.input.clear(); this.ui.clearToast(); this.audio.play('complete');
      this.result = { time: this.elapsed, bits: this.level.bits.filter(b => b.collected).length, cores: this.level.cores.filter(b => b.collected).map(b => b.id), deaths: this.deaths };
      this.newBest = this.store.complete(this.level.index, this.result);
      this.particles.burst(this.level.tower.x, this.level.tower.y - 175, '#c9e5bc', 65 * count, 190, 25);
    }
  }
  fixedStep(dt) {
    if (this.state === 'playing') {
      if (this.freeze > 0) { this.freeze -= dt; return; }
      this.time += dt; this.elapsed += dt; this.intro = Math.max(0, this.intro - dt);
      updatePlatforms(this.level, dt, this.time, this.player.standing); updateEnemies(this.level, dt, this.time);
      const events = this.player.step(dt, this.input.frame(), this.level); events.forEach(e => this.event(e));
      this.camera.update(dt, this.player, this.level, this.settings.reduced);
      if (this.player.state === 'run' && !this.settings.reduced && Math.floor(this.time * 15) !== Math.floor((this.time - dt) * 15)) this.particles.burst(this.player.x + 11, this.player.y + 29, '#779889', 1, 27, -15);
    } else if (this.state === 'dying' || this.state === 'dead') {
      this.deathTime += dt;
      if (this.deathTime > .65 && this.state === 'dying') { this.state = 'dead'; this.ui.show('death'); }
      if (this.deathTime > 3.8) this.respawn();
      this.camera.shake = Math.max(0, this.camera.shake - dt * 15);
    } else if (this.state === 'celebrating') {
      this.time += dt; this.celebration += dt; this.camera.update(dt, this.player, this.level, this.settings.reduced);
      if (this.celebration < 2 && Math.floor(this.celebration * 10) !== Math.floor((this.celebration - dt) * 10)) this.particles.burst(this.level.tower.x, this.level.tower.y - 175, '#cbe4ba', this.settings.reduced ? 1 : 7, 190, 25);
      if (this.celebration > 2.8) { this.state = 'complete'; this.ui.show('complete'); }
    }
    if (this.state !== 'paused' && this.state !== 'menu' && this.state !== 'complete') this.particles.update(dt);
  }
  loop(stamp) {
    const dt = Math.min(.05, (stamp - (this.lastFrame || stamp)) / 1000); this.lastFrame = stamp; this.menuTime += dt;
    if (!this.testing) {
      this.accumulator += dt;
      while (this.accumulator >= 1 / 120) { this.fixedStep(1 / 120); this.accumulator -= 1 / 120; }
    }
    this.audio.update(this.state === 'playing' || this.state === 'menu' || this.state === 'celebrating', this.state === 'menu' ? 0 : this.level?.index || 0);
    if (this.state === 'menu') this.renderer.menu(this.settings.reduced ? 0 : this.menuTime); else this.renderer.game(this);
    if (this.state !== 'menu') this.ui.update();
    requestAnimationFrame(this.loop);
  }
}

const game = new Game();
// A stable entry point for local inspection and the isolated regression runner.
Object.defineProperty(window, 'pixelbound', { value: game, writable: false });
if (new URLSearchParams(location.search).has('qa')) import('../tests/browser-qa.js').then(({ installQA }) => installQA(game));
