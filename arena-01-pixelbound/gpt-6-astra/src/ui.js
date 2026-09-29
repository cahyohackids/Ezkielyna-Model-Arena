import { LEVELS } from './levels.js';
import { titleSVG } from './art.js';
import { formatTime, pad } from './utils.js';
const button = (label, action, primary = false, extra = '') => `<button class="btn${primary ? ' primary' : ''}" data-action="${action}" ${extra}>${label}<span class="arrow" aria-hidden="true">${primary ? '→' : '↗'}</span></button>`;
const close = '<button class="icon-button close-btn" data-action="back" aria-label="Go back">×</button>';

export class UIManager {
  constructor(game) {
    this.game = game; this.root = document.getElementById('screens'); this.current = ''; this.back = 'menu'; this.cache = {};
    this.root.addEventListener('click', e => { const target = e.target.closest('[data-action]'); if (target && !target.disabled) { game.audio.unlock(); game.audio.play('ui'); this.action(target.dataset.action); } });
    this.root.addEventListener('input', e => {
      const key = e.target.dataset.setting; if (!key) return;
      game.store.data.settings[key] = e.target.type === 'checkbox' ? e.target.checked : Number(e.target.value);
      const out = e.target.closest('.range-wrap')?.querySelector('output'); if (out) out.textContent = e.target.value + '%';
      this.applySettings(); game.store.save();
    });
    this.root.addEventListener('change', e => { if (e.target.dataset.setting === 'sfx') game.audio.play('bit'); });
    document.addEventListener('keydown', e => this.keyboard(e));
    document.getElementById('pause-btn').onclick = () => game.pause();
    document.getElementById('home').onclick = e => { e.preventDefault(); game.menu(); };
    document.getElementById('sound-btn').onclick = () => { game.audio.unlock(); this.action('mute'); };
    document.getElementById('fullscreen-btn').onclick = async () => {
      try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.querySelector('.app').requestFullscreen(); } catch { this.toast('Fullscreen is unavailable in this browser.'); }
    };
    document.addEventListener('fullscreenchange', () => { const b = document.getElementById('fullscreen-btn'); b.setAttribute('aria-label', document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen'); b.title = document.fullscreenElement ? 'Exit fullscreen' : 'Fullscreen'; });
    this.applySettings();
  }
  applySettings() {
    const s = this.game.store.data.settings; this.game.audio.apply(); document.body.classList.toggle('reduced', s.reduced);
    const b = document.getElementById('sound-btn'); b.textContent = s.mute ? '♪̸' : '♫'; b.setAttribute('aria-label', s.mute ? 'Unmute audio' : 'Mute audio'); b.setAttribute('aria-pressed', String(s.mute)); b.title = s.mute ? 'Unmute (M)' : 'Mute (M)';
  }
  keyboard(e) {
    if (!this.current || e.metaKey || e.ctrlKey || e.altKey) return;
    const controls = [...this.root.querySelectorAll('button:not(:disabled),input')];
    if (!controls.length) return;
    const i = controls.indexOf(document.activeElement);
    if (e.code === 'Tab') {
      if (e.shiftKey && i <= 0) { e.preventDefault(); controls.at(-1).focus(); }
      if (!e.shiftKey && (i === -1 || i === controls.length - 1)) { e.preventDefault(); controls[0].focus(); }
    }
    if (e.target.matches?.('input')) return;
    if (['ArrowDown','ArrowUp','ArrowRight','ArrowLeft'].includes(e.code)) { e.preventDefault(); const d = ['ArrowDown','ArrowRight'].includes(e.code) ? 1 : -1; controls[(i + d + controls.length) % controls.length].focus(); }
  }
  panel(content, wide = false) { return `<div class="overlay"><section class="panel${wide ? ' wide' : ''}" aria-label="${this.current}" role="dialog" aria-modal="true">${content}</section></div>`; }
  show(name, focus = true) {
    this.current = name;
    const game = this.game, data = game.store.data;
    if (!name) { this.root.innerHTML = ''; return; }
    if (name === 'menu') {
      this.root.innerHTML = `<section class="menu" aria-label="Main menu"><div class="eyebrow">A little robot. A lost connection.</div>${titleSVG()}<h1 class="subtitle">LOST SIGNAL</h1><p class="menu-copy">The world went quiet.<br>One small courier still has a message to deliver.</p><div class="menu-actions">${button(data.unlocked > 1 ? 'Play · continue journey' : 'Play', 'play', true)}${button('Level select', 'levels')}${button('How to play', 'help')}<button class="text-btn" data-action="settings">⚙ &nbsp; SETTINGS</button></div><div class="menu-bottom"><span class="mini-cells"><i></i><i></i><i></i></span> THREE WORLDS. ONE SIGNAL.</div><div class="scene-label"><b><span>01</span> &nbsp; SIGNAL MEADOW</b>YOUR JOURNEY STARTS HERE</div></section>`;
    }
    if (name === 'levels') {
      this.root.innerHTML = this.panel(`<div class="panel-head"><div><div class="eyebrow">The relay network</div><h1>Choose your frequency.</h1><p class="description">Three quiet worlds. Three signals waiting to be found.</p></div>${close}</div><div class="level-grid">${LEVELS.map((l, i) => {
        const unlocked = i < data.unlocked, record = data.records[i];
        return `<button class="level-card" data-action="level-${i}" ${unlocked ? '' : 'disabled'} aria-label="${l.name}${unlocked ? '' : ', locked. Complete the previous sector first.'}"><canvas width="240" height="120" data-thumb="${i}" aria-hidden="true"></canvas><div class="level-info"><div class="sector"><span>SECTOR ${pad(i + 1)}</span><span>${record.completed ? 'ONLINE' : unlocked ? 'OPEN' : 'LOCKED'}</span></div><h2>${l.name}</h2><p>${l.subtitle}</p><div class="level-progress"><span>◇ ${pad(record.bits || 0)}/50</span><span>◈ ${record.cores?.length || 0}/3</span></div></div></button>`;
      }).join('')}</div><div class="legend"><span>Restore a tower to unlock the next sector.</span><span>PROGRESS SAVED LOCALLY</span></div>` , true);
      this.root.querySelectorAll('[data-thumb]').forEach(c => { const i = Number(c.dataset.thumb); game.renderer.thumbnail(c, LEVELS[i].theme, i); });
    }
    if (name === 'help') {
      this.root.innerHTML = this.panel(`<div class="panel-head"><div><div class="eyebrow">Courier field guide</div><h1>Small steps. Big signal.</h1></div>${close}</div><p class="description">Reach the relay tower at the end of each sector.<br>Take the scenic route. There are secrets in the static.</p><div class="control-grid"><div class="control-item"><span>Move</span><span><kbd>A</kbd> <kbd>D</kbd> / <kbd>←</kbd> <kbd>→</kbd></span></div><div class="control-item"><span>Jump</span><span><kbd>SPACE</kbd> / <kbd>W</kbd> / <kbd>↑</kbd></span></div><div class="control-item"><span>Dash</span><kbd>SHIFT</kbd></div><div class="control-item"><span>Pause / restart</span><span><kbd>ESC</kbd> / <kbd>R</kbd></span></div></div><div class="tip"><span>↟</span>Hold jump to go higher. Tap for a little hop. Land on ground enemies, or dash through any enemy.</div><div class="tip"><span>◈</span>Follow the small amber lights for hidden Data Cores. Terminals refill your energy and save your position.</div><div class="tip"><span>↔</span>On touchscreens, use both hands: direction on the left, jump and dash on the right.</div><div class="actions">${button('Got it', 'back', true)}</div>`);
    }
    if (name === 'settings') {
      const s = data.settings;
      this.root.innerHTML = this.panel(`<div class="panel-head"><div><div class="eyebrow">Fine tune your frequency</div><h1>Settings</h1></div>${close}</div><p class="description">Make yourself at home. Changes are saved automatically.</p>${['music', 'sfx'].map(k => `<div class="setting"><label for="${k}-volume">${k === 'music' ? 'Music volume' : 'Sound effects'}<small>${k === 'music' ? 'An original, quiet electronic score' : 'Footsteps in the digital world'}</small></label><div class="range-wrap"><input id="${k}-volume" data-setting="${k}" type="range" min="0" max="100" value="${s[k]}"><output>${s[k]}%</output></div></div>`).join('')}${[['mute','Mute all audio','You can also press M'],['shake','Screen shake','Subtle feedback on impacts'],['reduced','Reduced motion','Less camera, particle and UI movement']].map(([k,label,detail]) => `<div class="setting"><label for="setting-${k}">${label}<small>${detail}</small></label><input class="toggle" type="checkbox" id="setting-${k}" data-setting="${k}" ${s[k] ? 'checked' : ''}></div>`).join('')}<div class="actions">${button('Done', 'back', true)}</div>`);
    }
    if (name === 'pause') {
      this.root.innerHTML = this.panel(`<div class="eyebrow">Transmission on hold</div><h1>Take a little breather.</h1><p class="description">${game.level.name} · Your courier will wait right here.</p><div class="stack">${button('Resume', 'resume', true)}${button('Restart level', 'restart')}${button('Settings', 'settings')}${button('Main menu', 'menu')}</div>`);
    }
    if (name === 'death') {
      this.root.innerHTML = this.panel(`<div class="eyebrow">Connection interrupted</div><h1>SIGNAL LOST</h1><p class="description">Even the best couriers miss a step.<br><span id="retry-countdown">Reconnecting at your last terminal…</span></p><div class="actions">${button('Retry', 'retry', true)}${button('Level select', 'levels')}</div>`);
    }
    if (name === 'complete') {
      const result = game.result, last = game.level.index === 2;
      this.root.innerHTML = this.panel(`<div class="completion-graphic" aria-hidden="true"><i></i><i></i><i></i></div><div class="eyebrow">${last ? 'All sectors online · delivery complete' : `Sector ${pad(game.level.index + 1)} is back online`}</div><h1>SIGNAL RESTORED</h1><p class="description">${last ? 'Across the quiet world, a thousand little lights answer.<br>Message received, PIP. Welcome home.' : `${game.level.name} has a voice again.<br>There is someone listening on the next frequency.`}</p><div class="stats"><div class="stat"><small>TIME ${game.newBest ? '· PERSONAL BEST' : ''}</small><b>${formatTime(result.time)}</b></div><div class="stat"><small>SIGNAL BITS</small><b>${pad(result.bits)} <span>/ 50</span></b></div><div class="stat"><small>DATA CORES</small><b>${result.cores.length} <span>/ 3</span></b></div><div class="stat"><small>DEATHS</small><b>${pad(result.deaths)}</b></div></div><div class="actions">${button(last ? 'Journey home' : 'Next level', last ? 'menu' : 'next', true)}${button('Replay', 'restart')}${button('Level select', 'levels')}</div>`);
    }
    if (focus) requestAnimationFrame(() => this.root.querySelector('button:not(:disabled)')?.focus({ preventScroll: true }));
  }
  action(action) {
    const g = this.game;
    if (action === 'play') return g.start(g.store.data.unlocked - 1);
    if (action.startsWith('level-')) { const i = Number(action.slice(6)); if (i < g.store.data.unlocked) g.start(i); return; }
    if (action === 'resume') return g.resume();
    if (action === 'restart') return g.start(g.level.index);
    if (action === 'retry') return g.respawn();
    if (action === 'menu') return g.menu();
    if (action === 'next') return g.start(Math.min(2, g.level.index + 1));
    if (action === 'mute') { g.store.data.settings.mute = !g.store.data.settings.mute; this.applySettings(); g.store.save(); if (this.current === 'settings') this.show('settings'); return; }
    if (action === 'settings' || action === 'help') { this.back = this.current || 'pause'; this.show(action); return; }
    if (action === 'levels') { g.state = 'menu'; g.input.enabled = false; g.input.clear(); this.setPlaying(false); this.back = 'menu'; this.show('levels'); return; }
    if (action === 'back') { this.show(this.back); return; }
  }
  escape() { if (!this.current) this.game.pause(); else if (this.current === 'pause') this.game.resume(); else if (['settings','help','levels'].includes(this.current)) this.show(this.back); }
  setPlaying(value) {
    document.getElementById('stage').classList.toggle('playing', value);
    document.getElementById('hud').classList.toggle('hidden', !value); document.getElementById('level-caption').classList.toggle('hidden', !value);
  }
  level(level) {
    document.getElementById('sector-label').textContent = '/ ' + pad(level.index + 1);
    document.getElementById('level-number').textContent = 'SECTOR ' + pad(level.index + 1);
    document.getElementById('level-name').textContent = level.name;
    document.getElementById('bits-total').textContent = '/ ' + level.bits.length;
    this.cache = {}; this.update();
  }
  update() {
    const g = this.game; if (!g.player) return;
    const health = g.player.health, bits = g.level.bits.filter(b => b.collected).length, cores = g.level.cores.filter(b => b.collected).length;
    if (health !== this.cache.health) { const el = document.getElementById('health'); el.innerHTML = [0,1,2].map(i => `<i class="${i >= health ? 'empty' : ''}"></i>`).join(''); el.setAttribute('aria-label', `${health} energy cells`); this.cache.health = health; }
    if (bits !== this.cache.bits) { document.getElementById('bits-count').textContent = pad(bits); this.cache.bits = bits; }
    if (cores !== this.cache.cores) { document.getElementById('cores-count').textContent = cores; this.cache.cores = cores; }
    const fill = Math.round((1 - g.player.cooldown / .78) * 30) / 30;
    if (fill !== this.cache.fill) { document.getElementById('dash-fill').style.transform = `scaleX(${fill})`; this.cache.fill = fill; }
    if (g.state === 'dead') { const el = document.getElementById('retry-countdown'); const seconds = Math.max(1, Math.ceil(3.8 - g.deathTime)); if (el && seconds !== this.cache.countdown) { el.textContent = `Reconnecting at your last terminal in ${seconds}…`; this.cache.countdown = seconds; } }
  }
  toast(text) { const el = document.getElementById('toast'); el.textContent = text; el.classList.add('visible'); clearTimeout(this.toastTimeout); this.toastTimeout = setTimeout(() => el.classList.remove('visible'), 3000); }
  clearToast() { clearTimeout(this.toastTimeout); document.getElementById('toast').classList.remove('visible'); }
}
