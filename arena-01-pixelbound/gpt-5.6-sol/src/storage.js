const KEY = "pixelbound-lost-signal-v1";

const defaults = {
  unlocked: 1,
  levels: {},
  settings: { music: 0.35, sfx: 0.7, mute: false, shake: true, reducedMotion: false },
};

export function loadSave() {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) || "null") || {};
    return {
      ...defaults,
      ...stored,
      settings: { ...defaults.settings, ...(stored.settings || {}) },
      levels: stored.levels || {},
    };
  } catch {
    return structuredClone(defaults);
  }
}

export function writeSave(save) {
  try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* storage may be disabled */ }
}

export function recordCompletion(save, levelIndex, result) {
  const key = String(levelIndex);
  const old = save.levels[key] || {};
  save.levels[key] = {
    complete: true,
    bestTime: old.bestTime ? Math.min(old.bestTime, result.time) : result.time,
    bits: Math.max(old.bits || 0, result.bits),
    totalBits: result.totalBits,
    cores: Math.max(old.cores || 0, result.cores),
  };
  save.unlocked = Math.max(save.unlocked, Math.min(3, levelIndex + 2));
  writeSave(save);
}
