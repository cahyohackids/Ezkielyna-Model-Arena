export const WIDTH = 960, HEIGHT = 540;
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const approach = (n, target, amount) => n < target ? Math.min(n + amount, target) : Math.max(n - amount, target);
export const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
export function random(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export const formatTime = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}.${Math.floor((t % 1) * 10)}`;
export const pad = n => String(n).padStart(2, '0');

const DEFAULTS = { music: 35, sfx: 65, mute: false, shake: true, reduced: false };
export class SaveStore {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
    this.data = { unlocked: 1, records: [{}, {}, {}], settings: { ...DEFAULTS, reduced: globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false } };
    try {
      const raw = JSON.parse(storage.getItem('pixelbound.lost-signal.v1'));
      if (raw && typeof raw === 'object') {
        this.data.unlocked = clamp(Math.floor(Number(raw.unlocked) || 1), 1, 3);
        this.data.records = [0, 1, 2].map(i => {
          const r = raw.records?.[i] || {};
          return { completed: r.completed === true, bits: clamp(Number(r.bits) || 0, 0, 50), cores: Array.isArray(r.cores) ? [...new Set(r.cores.filter(v => Number.isInteger(v) && v >= 0 && v < 3))] : [], best: Number.isFinite(r.best) && r.best > 0 ? r.best : null };
        });
        for (const key of ['music', 'sfx']) if (Number.isFinite(raw.settings?.[key])) this.data.settings[key] = clamp(raw.settings[key], 0, 100);
        for (const key of ['mute', 'shake', 'reduced']) if (typeof raw.settings?.[key] === 'boolean') this.data.settings[key] = raw.settings[key];
      }
    } catch { /* A blocked or damaged save never prevents play. */ }
  }
  save() { try { this.storage.setItem('pixelbound.lost-signal.v1', JSON.stringify(this.data)); } catch {} }
  complete(index, run) {
    const r = this.data.records[index];
    const best = !r.best || run.time < r.best;
    r.completed = true; r.bits = Math.max(r.bits || 0, run.bits);
    r.cores = [...new Set([...(r.cores || []), ...run.cores])];
    r.best = Math.min(r.best || Infinity, run.time);
    this.data.unlocked = Math.max(this.data.unlocked, Math.min(3, index + 2));
    this.save(); return best;
  }
}
