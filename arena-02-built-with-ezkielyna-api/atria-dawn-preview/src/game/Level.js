// Level model: parses level definitions into a runtime structure with a
// spatial tile grid for collision and typed entity instances.

import { LEVELS, TILE } from './levels.js';
import { MovingPlatform, FallingPlatform, PhasePlatform, BouncePad } from './entities/Platforms.js';
import { Checkpoint, SignalTower } from './entities/Checkpoint.js';
import { Bit, DataCore } from './entities/Collectible.js';
import { GlitchHopper, StaticDrone, CorruptBug } from './entities/Enemy.js';
import { Spike, EnergyPit, Laser } from './entities/Hazard.js';
import { drawTile } from '../core/Renderer.js';

export class Level {
  constructor(index) {
    this.index = index;
    const def = LEVELS[index];
    this.def = def;
    this.name = def.name;
    this.width = def.width * TILE;
    this.height = def.height * TILE;
    this.cols = def.width;
    this.rows = def.rows.length;
    this.spawn = { x: def.spawn.x, y: def.spawn.y };
    this.bg = def.bg;
    this.hint = def.hint || '';

    // --- tile grid: 0 = empty, else tile type id ---
    this.tiles = [];
    this.tileTypes = ['empty', 'solid', 'grass', 'cave', 'metal', 'phase', 'falling'];
    this._buildTiles();

    // --- entities ---
    this.platforms = [];
    this.checkpoints = [];
    this.bits = [];
    this.cores = [];
    this.enemies = [];
    this.hazards = [];
    this.tower = null;
    this.secrets = [];
    this._spawnEntities(def.entities);

    this.totalBits = this.bits.length;
    this.totalCores = this.cores.length;
  }

  _buildTiles() {
    const { rows, width } = this.def;
    this.tiles = new Array(this.rows);
    for (let r = 0; r < this.rows; r++) {
      const line = rows[r] || '';
      const arr = new Array(width).fill(0);
      for (let c = 0; c < width; c++) {
        const ch = line[c];
        if (ch === 'x') arr[c] = 1;
        else if (ch === 'g') arr[c] = 2;
        else if (ch === 'c') arr[c] = 3;
        if (ch === 'm') arr[c] = 4;
      }
      this.tiles[r] = arr;
    }
  }

  _spawnEntities(list) {
    list.forEach((e) => {
      const [type, tx, ty, a, b, c] = e;
      const x = tx * TILE;
      const y = ty * TILE;
      switch (type) {
        case 'c': case 'm': case 'x': case 'g':
          this.tiles[ty][tx] = type === 'x' ? 1 : (type === 'g' ? 2 : (type === 'c' ? 3 : 4));
          break;
        case 'M':
          this.platforms.push(new MovingPlatform(x, y, a || 4, 0, b || 0));
          break;
        case 'V':
          this.platforms.push(new MovingPlatform(x, y, 0, a || 4, b || 0));
          break;
        case 'f':
          this.platforms.push(new FallingPlatform(x, y));
          break;
        case 'p':
          this.platforms.push(new PhasePlatform(x, y, a, b, c));
          break;
        case 'B':
          this.platforms.push(new BouncePad(x, y));
          break;
        case '#':
          this.checkpoints.push(new Checkpoint(x, y));
          break;
        case 'T':
          this.tower = new SignalTower(x, y);
          break;
        case 'o':
          this.bits.push(new Bit(x + 8, y + 8));
          break;
        case '*':
          this.cores.push(new DataCore(x + 8, y + 8));
          break;
        case 'h':
          this.enemies.push(new GlitchHopper(x, y));
          break;
        case 'd':
          this.enemies.push(new StaticDrone(x, y, a || 4, b || 0, c || 3));
          break;
        case 'b':
          this.enemies.push(new CorruptBug(x, y));
          break;
        case 's':
          this.hazards.push(new Spike(x, y, a || 1));
          break;
        case 'E':
          this.hazards.push(new EnergyPit(x, y, a || 1));
          break;
        case 'L':
          this.hazards.push(new Laser(x, y, (a || 4) * TILE, b || 1.2, c || 0, false));
          break;
        case 'I':
          this.hazards.push(new Laser(x, y, (a || 4) * TILE, b || 1.2, c || 0, true));
          break;
        case 'secret':
          this.secrets.push({ x, y, w: (a || 5) * TILE, h: (b || 3) * TILE, found: false });
          break;
      }
    });
    if (!this.tower) {
      // safety fallback tower at level end
      this.tower = new SignalTower((this.cols - 8) * TILE, (this.rows - 8) * TILE);
    }
  }

  // ---------- tile collision API ----------
  tileAt(tx, ty) {
    if (tx < 0 || tx >= this.cols || ty < 0 || ty >= this.rows) return 0;
    return this.tiles[ty][tx];
  }

  isSolidTile(tx, ty) {
    const t = this.tileAt(tx, ty);
    return t === 1 || t === 2 || t === 3 || t === 4;
  }

  // Solid rectangle test for AABB collision against static tiles.
  // Returns array of overlapping solid tile rects.
  solidRectsAt(x, y, w, h) {
    const out = [];
    const x0 = Math.floor(x / TILE);
    const x1 = Math.floor((x + w - 1) / TILE);
    const y0 = Math.floor(y / TILE);
    const y1 = Math.floor((y + h - 1) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (this.isSolidTile(tx, ty)) out.push({ x: tx * TILE, y: ty * TILE, w: TILE, h: TILE });
      }
    }
    return out;
  }

  // One-way / special platform solids are handled by the platform entities.
  forEachPlatform(fn) { this.platforms.forEach(fn); }

  update(dt, time, player) {
    this.platforms.forEach((p) => p.update(dt, time, player));
    this.checkpoints.forEach((c) => c.update(dt, time));
    this.bits.forEach((b) => b.update(dt, time));
    this.cores.forEach((c) => c.update(dt, time));
    this.enemies.forEach((e) => e.update(dt, time, this, player));
    this.hazards.forEach((h) => h.update(dt, time));
    if (this.tower) this.tower.update(dt, time);
    // secret discovery
    for (const s of this.secrets) {
      if (!s.found && player.x + player.w > s.x && player.x < s.x + s.w &&
          player.y + player.h > s.y && player.y < s.y + s.h) {
        s.found = true;
      }
    }
  }

  render(ctx, cam, time) {
    // tiles
    const x0 = Math.max(0, Math.floor(cam.x / TILE));
    const x1 = Math.min(this.cols - 1, Math.floor((cam.x + cam.viewW) / TILE));
    const y0 = Math.max(0, Math.floor(cam.y / TILE));
    const y1 = Math.min(this.rows - 1, Math.floor((cam.y + cam.viewH) / TILE));
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const t = this.tiles[ty][tx];
        if (!t) continue;
        const type = this.tileTypes[t];
        drawTile(ctx, tx * TILE - cam.x - cam.shakeOX, ty * TILE - cam.y - cam.shakeOY, TILE, type, time, tx * 31 + ty * 17);
      }
    }
    // platforms
    this.platforms.forEach((p) => p.render(ctx, cam, time));
    // checkpoints
    this.checkpoints.forEach((c) => c.render(ctx, cam, time));
    // hazards
    this.hazards.forEach((h) => h.render(ctx, cam, time));
    // collectibles
    this.bits.forEach((b) => b.render(ctx, cam, time));
    this.cores.forEach((c) => c.render(ctx, cam, time));
    // enemies
    this.enemies.forEach((e) => e.render(ctx, cam, time));
    // tower
    if (this.tower) this.tower.render(ctx, cam, time);
  }
}
