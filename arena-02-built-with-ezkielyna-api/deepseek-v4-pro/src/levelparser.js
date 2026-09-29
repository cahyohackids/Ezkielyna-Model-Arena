// Level parser: converts string maps + entity lists into a playable level object.

import { TILE } from './levels.js';

export function parseLevel(levelDef) {
  const rows = levelDef.map.split('\n').map(r => r.trim()).filter(r => r.length > 0);
  const height = rows.length;
  let width = 0;
  for (const r of rows) width = Math.max(width, r.length);

  const solids = new Set();
  const oneWay = new Set();
  const spikes = new Set();
  const bounces = new Set();
  const phases = new Set();
  const fallings = new Set();
  const checkpoints = [];
  const tower = { x: 0, y: 0, active: false, progress: 0 };
  const bits = [];
  const cores = [];
  const enemies = [];
  const fallingPlatforms = [];
  const phasePlatforms = [];
  const spawn = { x: 3 * TILE, y: 0 };

  const idx = (x, y) => y * width + x;
  const solidAtSimple = (tx, ty) => {
    if (tx < 0 || ty < 0 || tx >= width || ty >= height) return false;
    return solids.has(ty * width + tx);
  };

  for (let y = 0; y < height; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      const wx = x * TILE;
      const wy = y * TILE;
      switch (ch) {
        case '#': solids.add(idx(x, y)); break;
        case '=': oneWay.add(idx(x, y)); break;
        case '^': spikes.add(idx(x, y)); break;
        case 'B': bounces.add(idx(x, y)); break;
        case 'P': phasePlatforms.push({ x: wx, y: wy, w: TILE, h: 14, active: true }); break;
        case 'F': fallingPlatforms.push({ x: wx, y: wy, w: TILE, h: 14, active: true, shaking: 0, falling: false, vy: 0, dead: false, baseY: wy }); break;
        case 'C': checkpoints.push({ x: wx, y: wy, activated: false }); break;
        case 'T': tower.x = wx; tower.y = wy; break;
        case 'S': spawn.x = wx; spawn.y = wy; break;
        case 'b': bits.push({ x: wx + TILE / 2, y: wy + TILE / 2, collected: false }); break;
        case 'D': cores.push({ x: wx + TILE / 2, y: wy + TILE / 2, collected: false }); break;
        case 'H': enemies.push(makeEnemy('hopper', wx, wy)); break;
        case 'R': enemies.push(makeEnemy('bug', wx, wy)); break;
      }
    }
  }

  // Snap ground markers so they sit exactly on the floor surface below.
  const snapToGround = (px, py) => {
    const tx = Math.floor(px / TILE);
    const ty = Math.floor(py / TILE);
    if (solidAtSimple(tx, ty + 1)) return (ty + 1) * TILE;
    return py;
  };
  spawn.y = snapToGround(spawn.x + TILE / 2, spawn.y);
  tower.y = snapToGround(tower.x + TILE / 2, tower.y);
  for (const cp of checkpoints) cp.y = snapToGround(cp.x + TILE / 2, cp.y) - TILE;
  for (const e of enemies) {
    e.y = snapToGround(e.x + e.w / 2, e.y) - e.h;
    e.baseY = e.y;
  }

  // Extra collectibles defined outside the map
  for (const b of levelDef.bits || []) {
    bits.push({ x: b.x * TILE + TILE / 2, y: b.y * TILE + TILE / 2, collected: false });
  }
  for (const c of levelDef.cores || []) {
    cores.push({ x: c.x * TILE + TILE / 2, y: c.y * TILE + TILE / 2, collected: false });
  }

  // Entity-list enemies
  for (const e of levelDef.enemies || []) {
    const kind = e.type === 'hopper' ? 'hopper' : 'bug';
    const en = makeEnemy(kind, e.x * TILE, e.y * TILE);
    en.patrol = e.patrol ?? 3;
    const below = snapToGround(en.x + en.w / 2, en.y);
    en.y = below - en.h;
    en.baseY = en.y;
    enemies.push(en);
  }
  const drones = [];
  for (const d of levelDef.drones || []) {
    drones.push({
      x: d.x * TILE, y: d.y * TILE,
      baseX: d.x * TILE, baseY: d.y * TILE,
      axis: d.axis, range: d.range * TILE, speed: d.speed,
      t: Math.random() * Math.PI * 2,
      active: true, dead: false, deathTimer: 0,
    });
  }

  // lasers
  const lasers = [];
  for (const l of levelDef.lasers || []) {
    lasers.push({
      x: l.x * TILE, y: l.y * TILE,
      len: l.len * TILE, dir: l.dir, period: l.period,
      t: Math.random() * l.period,
      active: false,
    });
  }

  // moving platforms
  const movingPlatforms = [];
  for (const mp of levelDef.platforms || []) {
    movingPlatforms.push({
      x: mp.x * TILE, y: mp.y * TILE,
      baseX: mp.x * TILE, baseY: mp.y * TILE,
      w: mp.w * TILE, h: 14,
      type: mp.type, range: mp.range * TILE, speed: mp.speed,
      t: 0, dir: 1, dx: 0, dy: 0,
    });
  }

  // falling platforms (entity form)
  for (const f of levelDef.fallings || []) {
    fallingPlatforms.push({
      x: f.x * TILE, y: f.y * TILE, w: f.w * TILE, h: 14,
      active: true, shaking: 0, falling: false, vy: 0, dead: false,
      baseY: f.y * TILE,
    });
  }

  // bounce pads (entity form)
  for (const b of levelDef.bounces || []) {
    bounces.add(Math.floor(b.y) * width + Math.floor(b.x));
  }

  // phase platforms (entity form)
  for (const p of levelDef.phases || []) {
    phasePlatforms.push({
      x: p.x * TILE, y: p.y * TILE, w: p.w * TILE, h: 14, active: true,
    });
  }

  return {
    def: levelDef,
    theme: levelDef.theme,
    width: width * TILE,
    height: height * TILE,
    tileW: width,
    tileH: height,
    solids, oneWay, spikes, bounces, phases, fallings,
    checkpoints, tower, bits, cores, enemies, drones,
    lasers, movingPlatforms, fallingPlatforms, phasePlatforms, spawn,
    bitTotal: bits.length,
    coreTotal: cores.length,
    rows,
  };
}

function makeEnemy(type, x, y) {
  return {
    type,
    x, y,
    baseX: x, baseY: y,
    w: 26, h: 22,
    vx: 0, vy: 0,
    dir: -1,
    patrol: 3,
    dead: false,
    deathTimer: 0,
    chargeTimer: 0,
    charging: false,
    onGround: false,
    t: Math.random() * 10,
  };
}

export function tileIndexAt(level, x, y) {
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  return { tx, ty, idx: ty * level.tileW + tx };
}

export function solidAt(level, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= level.tileW || ty >= level.tileH) return false;
  return level.solids.has(ty * level.tileW + tx);
}
export function oneWayAt(level, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= level.tileW || ty >= level.tileH) return false;
  return level.oneWay.has(ty * level.tileW + tx);
}
export function spikeAt(level, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= level.tileW || ty >= level.tileH) return false;
  return level.spikes.has(ty * level.tileW + tx);
}
export function bounceAt(level, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= level.tileW || ty >= level.tileH) return false;
  return level.bounces.has(ty * level.tileW + tx);
}
export function phaseAt(level, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= level.tileW || ty >= level.tileH) return false;
  return level.phases.has(ty * level.tileW + tx);
}
