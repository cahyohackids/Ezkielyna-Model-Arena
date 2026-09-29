// Persistent save data via localStorage. Gracefully degrades to in-memory
// storage when localStorage is unavailable (private mode, file://, etc).

const KEY = 'pixelbound.save.v1';
const LEVEL_COUNT = 3;

function defaultSave() {
  return {
    version: 1,
    // highest unlocked level index (0-based). Level 0 always unlocked.
    unlocked: 0,
    levels: Array.from({ length: LEVEL_COUNT }, () => ({
      completed: false,
      bestTime: null,   // seconds, fastest completion
      bits: 0,          // best Signal Bits collected
      bitsTotal: 0,
      cores: 0,         // Data Cores collected (persistent once found)
      coresFound: [false, false, false],
    })),
    settings: {
      music: 0.45,
      sfx: 0.70,
      muted: false,
      shake: true,
      reduced: false,
    },
  };
}

export class SaveSystem {
  constructor() {
    this.data = defaultSave();
    this._storageOK = true;
    this.load();
  }

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.version === 1 && Array.isArray(parsed.levels)) {
          this.data = parsed;
          // heal missing fields
          const def = defaultSave();
          for (let i = 0; i < LEVEL_COUNT; i++) {
            const d = def.levels[i];
            const s = this.data.levels[i] || {};
            this.data.levels[i] = Object.assign(d, s);
            if (!Array.isArray(s.coresFound)) s.coresFound = [false, false, false];
          }
          this.data.settings = Object.assign(def.settings, parsed.settings || {});
          this.data.unlocked = Math.max(0, Math.min(LEVEL_COUNT - 1, this.data.unlocked | 0));
        }
      }
    } catch (e) {
      this._storageOK = false;
    }
  }

  save() {
    if (!this._storageOK) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch (e) {
      this._storageOK = false;
    }
  }

  get levelCount() { return LEVEL_COUNT; }

  isUnlocked(index) { return index >= 0 && index <= this.data.unlocked; }

  unlock(index) {
    if (index > this.data.unlocked) {
      this.data.unlocked = Math.min(LEVEL_COUNT - 1, index);
      this.save();
    }
  }

  recordCompletion(index, time, bits, bitsTotal, cores, coresFound) {
    const l = this.data.levels[index];
    l.completed = true;
    if (l.bestTime === null || time < l.bestTime) l.bestTime = time;
    if (bits > l.bits) l.bits = bits;
    l.bitsTotal = bitsTotal;
    if (coresFound) {
      coresFound.forEach((f, i) => { if (f) l.coresFound[i] = true; });
      l.cores = l.coresFound.filter(Boolean).length;
    } else {
      l.cores = Math.max(l.cores, cores);
    }
    this.save();
  }

  getSettings() { return this.data.settings; }

  updateSettings(patch) {
    Object.assign(this.data.settings, patch);
    this.save();
  }
}
