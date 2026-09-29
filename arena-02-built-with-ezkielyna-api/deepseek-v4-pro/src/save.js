// Save system (localStorage) + settings defaults

const SAVE_KEY = 'pixelbound_save_v1';

export const DEFAULT_SETTINGS = {
  musicVolume: 0.6,
  sfxVolume: 0.8,
  muted: false,
  screenShake: true,
  reducedMotion: false,
};

export const DEFAULT_SAVE = {
  unlockedLevels: [true, false, false],
  bestTimes: [null, null, null],
  bestBits: [0, 0, 0],
  bestCores: [0, 0, 0],
  completed: [false, false, false],
  settings: { ...DEFAULT_SETTINGS },
};

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return structuredCloneSafe(DEFAULT_SAVE);
    const data = JSON.parse(raw);
    // merge with defaults to be safe
    const merged = { ...structuredCloneSafe(DEFAULT_SAVE), ...data };
    merged.settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
    merged.unlockedLevels = merged.unlockedLevels || DEFAULT_SAVE.unlockedLevels.slice();
    merged.bestTimes = merged.bestTimes || DEFAULT_SAVE.bestTimes.slice();
    merged.bestBits = merged.bestBits || DEFAULT_SAVE.bestBits.slice();
    merged.bestCores = merged.bestCores || DEFAULT_SAVE.bestCores.slice();
    merged.completed = merged.completed || DEFAULT_SAVE.completed.slice();
    return merged;
  } catch (e) {
    return structuredCloneSafe(DEFAULT_SAVE);
  }
}

export function persistSave(save) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch (e) {
    // storage full or unavailable; ignore
  }
}

function structuredCloneSafe(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export function resetSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
  return structuredCloneSafe(DEFAULT_SAVE);
}
