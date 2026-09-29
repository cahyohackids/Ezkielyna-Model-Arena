// level.js — level runtime: tilemap storage, tile collision queries, entity
// containers, and the factory that builds a live level from static data.
//
// Collision model:
//  - Tilemap is a flat Int8Array for cache-friendly lookups.
//  - Solids use axis-separated swept AABB resolution in `moveEntity`.
//  - One-way platforms: solid only when the entity is moving down and its
//    previous bottom was above the platform top.
//  - Moving platforms are AABBs, resolved after tile collision; the player
//    inherits platform delta while standing on it.

import { T, TILE, SOLID_SET } from './tiles.js';
import { GlitchHopper, StaticDrone, CorruptBug, Sentinel } from './entities.js';

export class Tilemap {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.data = new Int8Array(w * h);
  }
  get(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return T.SOLID; // out of bounds = solid wall
    return this.data[ty * this.w + tx];
  }
  set(tx, ty, v) {
    if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return;
    this.data[ty * this.w + tx] = v;
  }
  /** Raw tile ignoring out-of-bounds clamping (used for rendering). */
  peek(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return T.EMPTY;
    return this.data[ty * this.w + tx];
  }
}

export class Level {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.theme = data.theme;
    this.songMood = data.songMood ?? 0;
    this.tiles = new Tilemap(data.width, data.height);
    this.spawn = { x: data.spawn.x, y: data.spawn.y };
    this.goal = { ...data.goal };              // {x,y,w,h} trigger rect in world px
    this.decor = data.decor || [];              // static background/prop list
    this.bits = [];                             // SignalBit[]
    this.cores = [];                            // DataCore[]
    this.enemies = [];
    this.platforms = [];                        // runtime moving/falling/phase platforms
    this.checkpoints = [];
    this.hazards = [];                          // lasers and instant-kill volumes
    this.secrets = [];
    this.parallax = data.parallax || {};
    this.build(data);
  }

  build(data) {
    for (const t of data.tiles) {
      for (let y = 0; y < t.rows.length; y++) {
        const row = t.rows[y];
        for (let x = 0; x < row.length; x++) {
          const ch = row[x];
          const v = CHAR_TO_TILE[ch];
          if (v === undefined) continue;
          this.tiles.set(t.x + x, t.y + y, v);
        }
      }
    }
    for (const b of data.bits || []) this.bits.push(new SignalBit(b.x, b.y));
    for (const c of data.cores || []) this.cores.push(new DataCore(c.x, c.y));
    for (const cp of data.checkpoints || []) this.checkpoints.push(new Checkpoint(cp.x, cp.y, cp.id ?? this.checkpoints.length));
    for (const p of data.platforms || []) this.platforms.push(makePlatform(p));
    for (const e of data.enemies || []) {
      const ent = makeEnemy(e);
      if (ent) this.enemies.push(ent);
    }
    for (const hz of data.hazards || []) this.hazards.push(makeHazard(hz));
    for (const s of data.secrets || []) this.secrets.push({ ...s, found: false });

    this.resetDynamic();
  }

  /** Reset all mutable runtime state (used on respawn/restart). */
  resetDynamic() {
    for (const p of this.platforms) p.reset();
    for (const e of this.enemies) e.reset();
    for (const b of this.bits) b.collected = false;
    for (const c of this.cores) c.collected = false;
    this.phaseT = 0;
  }

  totalBits() { return this.bits.length; }
  totalCores() { return this.cores.length; }

  get pixelW() { return this.tiles.w * TILE; }
  get pixelH() { return this.tiles.h * TILE; }

  getTile(tx, ty) {
    let v = this.tiles.get(tx, ty);
    if (v === T.PHASE && !this.phaseOn(tx, ty)) return T.EMPTY;
    return v;
  }

  /** Global phase rhythm — every phase block uses the same clock with a
   *  per-block phase offset baked into its coordinate so the level reads
   *  as a designed pattern rather than noise. */
  phaseOn(tx, ty) {
    const period = 2.6;
    const t = (this.phaseT + (tx + ty) * 0.11) % period;
    return t < period * 0.62;
  }

  /** Solid check used by entity collision. */
  solidAt(tx, ty) {
    const v = this.getTile(tx, ty);
    return SOLID_SET.has(v);
  }

  update(dt, ctx) {
    this.phaseT += dt;
    for (const p of this.platforms) p.update(dt, this);
    for (const e of this.enemies) if (!e.dead) e.update(dt, this, ctx);
    for (const h of this.hazards) h.update?.(dt, this, ctx);
    // Prune dead enemies after their death animation finishes.
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.removeMe) this.enemies.splice(i, 1);
    }
  }

  // ---- Collision helpers ---------------------------------------------------

  /** Returns true if the AABB (world px) overlaps any solid tile. */
  boxHitsSolid(x, y, w, h) {
    const x0 = Math.floor(x / TILE), x1 = Math.floor((x + w - 0.001) / TILE);
    const y0 = Math.floor(y / TILE), y1 = Math.floor((y + h - 0.001) / TILE);
    for (let ty = y0; ty <= y1; ty++)
      for (let tx = x0; tx <= x1; tx++)
        if (this.solidAt(tx, ty)) return true;
    return false;
  }

  /** Returns true if the AABB overlaps a damaging tile. */
  boxHitsHazard(x, y, w, h) {
    const x0 = Math.floor(x / TILE), x1 = Math.floor((x + w - 0.001) / TILE);
    const y0 = Math.floor(y / TILE), y1 = Math.floor((y + h - 0.001) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const v = this.getTile(tx, ty);
        if (v === T.SPIKE || v === T.SPIKE_CEIL) return true;
      }
    }
    return false;
  }

  /**
   * Axis-separated movement resolution against tiles + platforms.
   * `ent` needs: x, y, w, h, vx, vy.
   * Returns collision flags and resolves position + velocity.
   */
  moveEntity(ent, dt, opts = {}) {
    const { dropThrough = false, ignorePlatforms = false } = opts;
    const res = { hitX: 0, hitY: 0, onGround: false, onPlatform: null, hitCeiling: false };

    // ---- Horizontal ----
    ent.x += ent.vx * dt;
    if (!opts.ignoreTiles) {
      const hx0 = Math.floor(ent.x / TILE), hx1 = Math.floor((ent.x + ent.w - 0.001) / TILE);
      const hy0 = Math.floor(ent.y / TILE), hy1 = Math.floor((ent.y + ent.h - 0.001) / TILE);
      for (let ty = hy0; ty <= hy1; ty++) {
        if (ent.vx > 0 && this.solidAt(hx1, ty)) {
          ent.x = hx1 * TILE - ent.w - 0.01;
          ent.vx = 0; res.hitX = 1; break;
        } else if (ent.vx < 0 && this.solidAt(hx0, ty)) {
          ent.x = (hx0 + 1) * TILE + 0.01;
          ent.vx = 0; res.hitX = -1; break;
        }
      }
    }

    // ---- Vertical ----
    ent.y += ent.vy * dt;
    if (!opts.ignoreTiles) {
      const vx0 = Math.floor(ent.x / TILE), vx1 = Math.floor((ent.x + ent.w - 0.001) / TILE);
      const vy0 = Math.floor(ent.y / TILE), vy1 = Math.floor((ent.y + ent.h - 0.001) / TILE);
      if (ent.vy > 0) {
        for (let tx = vx0; tx <= vx1; tx++) {
          if (this.solidAt(tx, vy1)) {
            ent.y = vy1 * TILE - ent.h - 0.01;
            ent.vy = 0; res.onGround = true; res.hitY = 1; break;
          }
        }
      } else if (ent.vy < 0) {
        for (let tx = vx0; tx <= vx1; tx++) {
          if (this.solidAt(tx, vy0)) {
            ent.y = (vy0 + 1) * TILE + 0.01;
            ent.vy = 0; res.hitY = -1; res.hitCeiling = true; break;
          }
        }
      }
    }

    // ---- One-way platforms (tile type) ----
    if (!opts.ignoreTiles && ent.vy >= 0 && !dropThrough) {
      const prevBottom = ent.prevY !== undefined ? ent.prevY + ent.h : ent.y + ent.h;
      const x0 = Math.floor(ent.x / TILE), x1 = Math.floor((ent.x + ent.w - 0.001) / TILE);
      const bottom = ent.y + ent.h;
      const by = Math.floor((bottom - 0.001) / TILE);
      for (let tx = x0; tx <= x1; tx++) {
        if (this.tiles.get(tx, by) === T.ONEWAY && prevBottom <= by * TILE + 2) {
          ent.y = by * TILE - ent.h - 0.01;
          ent.vy = 0; res.onGround = true; res.hitY = 1;
          break;
        }
      }
    }

    // ---- Dynamic platforms ----
    if (!ignorePlatforms) {
      for (const p of this.platforms) {
        if (!p.active || !p.solid) continue;
        const pr = p.rect();
        const er = { x: ent.x, y: ent.y, w: ent.w, h: ent.h };
        if (er.x < pr.x + pr.w && er.x + er.w > pr.x && er.y < pr.y + pr.h && er.y + er.h > pr.y) {
          // Resolve on the shallowest axis, but prefer vertical (standing on top).
          const prevBottom = ent.prevY !== undefined ? ent.prevY + ent.h : ent.y + ent.h;
          const fromAbove = ent.vy >= 0 && prevBottom <= pr.y + 4;
          if (fromAbove) {
            ent.y = pr.y - ent.h - 0.01;
            ent.vy = 0; res.onGround = true; res.onPlatform = p;
          } else if (ent.vy < 0 && ent.y + 4 >= pr.y + pr.h) {
            ent.y = pr.y + pr.h + 0.01;
            ent.vy = 0; res.hitCeiling = true;
          } else {
            // Side push
            const cx = ent.x + ent.w / 2, pcx = pr.x + pr.w / 2;
            if (cx < pcx) { ent.x = pr.x - ent.w - 0.01; }
            else { ent.x = pr.x + pr.w + 0.01; }
            res.hitX = cx < pcx ? -1 : 1;
            ent.vx = 0;
          }
        }
      }
    }

    ent.prevY = ent.y;
    return res;
  }
}

// ---------------------------------------------------------------- entities

export class SignalBit {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.collected = false;
    this.t = Math.random() * 6.28;
    this.baseY = y;
    this.r = 5;
  }
  update(dt) {
    this.t += dt;
    this.y = this.baseY + Math.sin(this.t * 2.4) * 2.0;
  }
}

export class DataCore {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.collected = false;
    this.t = Math.random() * 6.28;
    this.baseY = y;
    this.r = 7;
  }
  update(dt) {
    this.t += dt;
    this.y = this.baseY + Math.sin(this.t * 1.7) * 3.0;
  }
}

export class Checkpoint {
  constructor(x, y, id) {
    this.x = x; this.y = y; this.id = id;
    this.w = 14; this.h = 22;
    this.active = false;
    this.anim = 0;
    this.triggered = false;   // prevents double-trigger
  }
  rect() { return { x: this.x - this.w / 2, y: this.y - this.h, w: this.w, h: this.h }; }
  update(dt) { this.anim += dt; }
}

// ---------------------------------------------------------------- platforms

export const PLATFORM_KINDS = {
  MOVE_H: 'moveH',
  MOVE_V: 'moveV',
  FALL: 'fall',
  BOUNCE: 'bounce',
  PHASE: 'phase',
};

function makePlatform(p) {
  return new Platform(p);
}

export class Platform {
  constructor(p) {
    this.kind = p.kind;
    this.baseX = p.x; this.baseY = p.y;
    this.w = p.w; this.h = p.h ?? 8;
    this.x = p.x; this.y = p.y;
    this.dx = 0; this.dy = 0;
    this.speed = p.speed ?? 40;
    this.range = p.range ?? 64;
    this.axis = p.axis ?? 'x';
    this.t = p.phase ?? 0;
    this.solid = true;
    this.active = true;
    this.fallState = 'idle';   // idle | shaking | falling | gone
    this.fallTimer = 0;
    this.vy = 0;
    this.triggerRider = false;
    // Bounce pads are solid & non-moving.
    if (this.kind === PLATFORM_KINDS.BOUNCE) this.speed = p.power ?? 300;
    if (this.kind === PLATFORM_KINDS.PHASE) this.period = p.period ?? 3.2;
    if (this.kind === PLATFORM_KINDS.FALL) this.delay = p.delay ?? 0.55;
    this.animT = 0;
  }

  reset() {
    this.x = this.baseX; this.y = this.baseY;
    this.dx = 0; this.dy = 0; this.t = 0; this.animT = 0;
    this.solid = true; this.active = true;
    this.fallState = 'idle'; this.fallTimer = 0; this.vy = 0;
  }

  rect() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }

  update(dt, level) {
    const px = this.x, py = this.y;
    this.animT += dt;

    switch (this.kind) {
      case PLATFORM_KINDS.MOVE_H:
      case PLATFORM_KINDS.MOVE_V: {
        this.t += (this.speed / this.range) * dt;
        const s = (Math.sin(this.t) + 1) / 2;   // 0..1
        if (this.axis === 'x') { this.x = this.baseX + s * this.range; this.y = this.baseY; }
        else { this.y = this.baseY + s * this.range; this.x = this.baseX; }
        break;
      }
      case PLATFORM_KINDS.PHASE: {
        this.t += dt;
        const cycle = (this.t % this.period) / this.period;
        const wasOn = this.solid;
        this.solid = cycle < 0.66;
        this.visible = this.solid || cycle > 0.72;
        this.alpha = this.solid ? 1 : Math.max(0.12, 1 - (cycle - 0.66) / 0.2);
        if (wasOn !== this.solid) this.justToggled = true;
        break;
      }
      case PLATFORM_KINDS.FALL: {
        if (this.fallState === 'idle') {
          // Detect rider: handled by player via triggerFall()
        } else if (this.fallState === 'shaking') {
          this.fallTimer -= dt;
          this.x = this.baseX + Math.sin(this.fallTimer * 90) * 1.4;
          if (this.fallTimer <= 0) {
            this.fallState = 'falling';
            this.vy = 0;
            level.onPlatformBreak?.(this);
          }
        } else if (this.fallState === 'falling') {
          this.vy += 620 * dt;
          this.y += this.vy * dt;
          if (this.vy > 500) { // despawn below view
            this.fallState = 'gone';
            this.solid = false;
            this.active = false;
          }
        }
        break;
      }
      case PLATFORM_KINDS.BOUNCE: {
        // subtle idle squish animation only
        break;
      }
    }

    this.dx = this.x - px;
    this.dy = this.y - py;
  }

  triggerFall() {
    if (this.kind !== PLATFORM_KINDS.FALL) return;
    if (this.fallState !== 'idle') return;
    this.fallState = 'shaking';
    this.fallTimer = this.delay;
  }

  /** For phase platforms: returns 0..1 progress used by the renderer. */
  phaseProgress() {
    if (this.kind !== PLATFORM_KINDS.PHASE) return 1;
    return ((this.t % this.period) / this.period);
  }
}

// ---------------------------------------------------------------- hazards

function makeHazard(h) {
  return new Hazard(h);
}

export class Hazard {
  constructor(h) {
    this.type = h.type;              // 'laser' | 'pit' | 'crusher'
    this.x = h.x; this.y = h.y;
    this.w = h.w; this.h = h.h;
    this.axis = h.axis || 'h';       // laser travel axis
    this.range = h.range ?? 48;
    this.speed = h.speed ?? 40;
    this.period = h.period ?? 2.0;
    this.t = h.phase ?? 0;
    this.baseX = h.x; this.baseY = h.y;
    this.lethal = true;
    this.onTime = h.onTime ?? 1;     // fraction of cycle the beam is on
    this.blink = 1;
  }
  update(dt) {
    this.t += dt;
    if (this.type === 'laser') {
      const s = (Math.sin(this.t * this.speed / Math.max(1, this.range)) + 1) / 2;
      if (this.axis === 'h') { this.x = this.baseX + s * this.range; this.y = this.baseY; }
      else { this.y = this.baseY + s * this.range; this.x = this.baseX; }
      const cyc = (this.t % this.period) / this.period;
      const warn = cyc > this.onTime;
      this.lethal = !warn;
      this.warn = warn;
      this.blink = warn ? (0.5 + 0.5 * Math.sin(this.t * 30)) : 1;
    }
  }
  rect() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
}

// ---------------------------------------------------------------- enemies

function makeEnemy(e) {
  switch (e.type) {
    case 'hopper': return new GlitchHopper(e);
    case 'drone': return new StaticDrone(e);
    case 'bug': return new CorruptBug(e);
    case 'sentinel': return new Sentinel(e);
    default: return null;
  }
}

// Character -> tile mapping for level data.
export const CHAR_TO_TILE = {
  '#': T.SOLID,
  '=': T.ONEWAY,
  '^': T.SPIKE,
  'v': T.SPIKE_CEIL,
  'p': T.PHASE,
  'G': T.GOAL,
  'L': T.LADDER,
};
