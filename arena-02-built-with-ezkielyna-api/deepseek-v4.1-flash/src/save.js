// save.js — localStorage persistence with safe fallbacks.
// Stores: unlocked levels, per-level bests (time/bits/cores/deaths/cleared),
// and player settings. Never throws if storage is unavailable.

const KEY = 'pixelbound.lostsgnal.v1';

const DEFAULT_SETTINGS = {
  music: 0.55,
  sfx: 0.8,
  muted: false,
  screenShake: true,
  reducedMotion: false,
  showFps: false,
};

function defaultData() {
  return {
    settings: { ...DEFAULT_SETTINGS },
    levels: {
      // id -> { cleared, time/bestTime, bits, cores, deaths, totalBits, secrets }
      1: { cleared: false, time: 0, bestTime: 0, bits: 0, cores: 0, deaths: 0, totalBits: 0, secrets: [] },
      2: { cleared: false, time: 0, bestTime: 0, bits: 0, cores: 0, deaths: 0, totalBits: 0, secrets: [] },
      3: { cleared: false, time: 0, bestTime: 0, bits: 0, cores: 0, deaths: 0, totalBits: 0, secrets: [] },
    },
    unlocked: 1,
    lastPlayed: 1,
  };
}

let cache = null;
let storageOk = true;

function read() {
  if (cache) return cache;
  const base = defaultData();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      cache = {
        settings: { ...base.settings, ...(parsed.settings || {}) },
        levels: { ...base.levels, ...(parsed.levels || {}) },
        unlocked: typeof parsed.unlocked === 'number' ? parsed.unlocked : 1,
        lastPlayed: typeof parsed.lastPlayed === 'number' ? parsed.lastPlayed : 1,
      };
    } else {
      cache = base;
    }
  } catch (e) {
    storageOk = false;
    cache = base;
  }
  return cache;
}

function write() {
  if (!cache) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch (e) {
    storageOk = false;
  }
}

export const Save = {
  get storageAvailable() { return storageOk; },

  settings() { return read().settings; },

  setSetting(k, v) {
    const s = read().settings;
    if (s[k] === v) return;
    s[k] = v;
    write();
  },

  /** Replace the whole settings block (used by the settings screen). */
  setSettings(obj) {
    const s = read().settings;
    let changed = false;
    for (const k of Object.keys(obj)) {
      if (s[k] !== obj[k]) { s[k] = obj[k]; changed = true; }
    }
    if (changed) write();
  },

  /** Explicit flush (settings screen calls this on exit). */
  save() { write(); },

  level(id) {
    const d = read();
    if (!d.levels[id]) {
      d.levels[id] = { cleared: false, time: 0, bestTime: 0, bits: 0, cores: 0, deaths: 0, totalBits: 0, secrets: [] };
    }
    const L = d.levels[id];
    if (!L.secrets) L.secrets = [];
    if (L.bestTime === undefined) L.bestTime = L.time || 0;
    return L;
  },

  isUnlocked(id) { return read().unlocked >= id; },

  maxUnlocked() { return read().unlocked; },

  get lastPlayed() { return read().lastPlayed; },
  setLastPlayed(id) { read().lastPlayed = id; write(); },

  /** Bank collectible progress mid-run so a death doesn't lose it. */
  updateTotals(id, bits, cores, totalBits) {
    const L = this.level(id);
    L.bits = Math.max(L.bits || 0, bits || 0);
    L.cores = Math.max(L.cores || 0, cores || 0);
    L.totalBits = totalBits || L.totalBits || 0;
    write();
  },

  /** Record a completed run. Keeps best-of values for collectibles/time. */
  completeLevel(id, { time, bits, cores, deaths, totalBits }) {
    const L = this.level(id);
    L.bits = Math.max(L.bits || 0, bits);
    L.cores = Math.max(L.cores || 0, cores);
    L.totalBits = totalBits;
    const prevBest = L.bestTime || 0;
    if (prevBest === 0 || (time > 0 && time < prevBest)) {
      L.bestTime = time;
      L.time = time;
      L.deaths = deaths;
    }
    L.cleared = true;
    const d = read();
    d.unlocked = Math.max(d.unlocked, Math.min(3, id + 1));
    write();
  },

  /** Unlock the next level (called on completion; also refreshes lastPlayed). */
  unlockNext(id) {
    const d = read();
    d.unlocked = Math.max(d.unlocked, Math.min(3, id + 1));
    d.lastPlayed = Math.min(3, id + 1);
    write();
  },

  /** Record a discovered secret area (deduplicated, stored per level). */
  addSecret(id, name) {
    const L = this.level(id);
    if (!L.secrets) L.secrets = [];
    if (!L.secrets.includes(name)) {
      L.secrets.push(name);
      write();
    }
  },

  /** Total secrets discovered across all levels. */
  secretCount() {
    const d = read();
    let n = 0;
    for (const k of Object.keys(d.levels)) n += (d.levels[k].secrets || []).length;
    return n;
  },

  resetAll() {
    cache = defaultData();
    write();
  },
};

export { DEFAULT_SETTINGS };
