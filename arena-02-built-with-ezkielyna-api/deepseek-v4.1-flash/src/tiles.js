// tiles.js — tile constants and helpers shared by level data and the runtime.

export const T = {
  EMPTY: 0,
  SOLID: 1,        // solid ground / wall (theme-dressed)
  ONEWAY: 2,       // jump-through from below, stand on top
  SPIKE: 3,        // damage hazard floor-mounted
  SPIKE_CEIL: 4,   // damage hazard ceiling-mounted
  PHASE: 5,        // solid only during "on" phase of a global rhythm
  PHASE_OFF: 6,    // (runtime only — never stored)
  GOAL: 7,         // tower activation column (non-solid trigger)
  LADDER: 8,       // climbable (used sparingly in caves)
};

export const TILE = 16;      // world units per tile
export const SOLID_SET = new Set([T.SOLID]);
export const PLAYER_SIZE = { w: 10, h: 13 };

export function isSolid(t) { return t === T.SOLID || t === T.PHASE; }
export function isHurt(t) { return t === T.SPIKE || t === T.SPIKE_CEIL; }

/** Theme palettes for background / fog / accent. */
export const THEMES = {
  meadow: {
    name: 'SIGNAL MEADOW',
    skyTop: '#1b2f52',
    skyMid: '#2b5570',
    skyLow: '#4d7c7a',
    far: '#213b5c',
    mid: '#1a3049',
    near: '#152a41',
    ground: '#26405e',
    groundEdge: '#3a5c80',
    fog: 'rgba(60,110,130,0.10)',
    particleColor: [180, 230, 210],
    particleRate: 5,
    rain: false,
    vignette: 0.28,
    musicMood: 0,
  },
  cave: {
    name: 'CIRCUIT CAVERNS',
    skyTop: '#070d18',
    skyMid: '#0b1526',
    skyLow: '#122036',
    far: '#101c30',
    mid: '#0d1727',
    near: '#0a1320',
    ground: '#243b52',
    groundEdge: '#33526f',
    fog: 'rgba(30,60,90,0.16)',
    particleColor: [120, 200, 210],
    particleRate: 7,
    rain: false,
    vignette: 0.45,
    musicMood: 1,
  },
  tower: {
    name: 'GLITCH TOWER',
    skyTop: '#100a20',
    skyMid: '#1c1030',
    skyLow: '#2a1440',
    far: '#1a1030',
    mid: '#150c28',
    near: '#100820',
    ground: '#3a2a5c',
    groundEdge: '#6b4a9a',
    fog: 'rgba(90,50,140,0.14)',
    particleColor: [200, 150, 240],
    particleRate: 9,
    rain: true,
    vignette: 0.5,
    musicMood: 2,
  },
};

/** Convert world pixel coords to tile coords. */
export const tileAt = (level, px, py) => {
  const tx = Math.floor(px / TILE);
  const ty = Math.floor(py / TILE);
  return level.getTile(tx, ty);
};
