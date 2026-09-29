import { TILE } from './levels.js';

// Axis-separated swept AABB collision against the static tile grid plus
// dynamic platform solids. X is resolved first, then Y.
//
// Robustness rules this module guarantees:
//  * never tunnel through a tile: per-axis motion is resolved against every
//    tile in the swept band, and the loop re-scans after each correction
//  * never jitter while standing: ground contact snaps the body exactly to
//    the tile top, and resting state is re-verified each frame
//  * moving platforms carry the rider (velocity is transferred externally)

export const SOLID = (t) => t === 1 || t === 2 || t === 3 || t === 4;

export class CollisionManager {
  constructor(level) { this.level = level; }
  setLevel(level) { this.level = level; }

  _resolveAxis(body, delta, isX) {
    const lvl = this.level;
    const info = { hit: 0 };
    if (delta === 0) return info;
    const steps = Math.min(4, Math.ceil(Math.abs(delta) / (TILE * 0.9)));
    const step = delta / steps;
    for (let s = 0; s < steps; s++) {
      if (isX) body.x += step; else body.y += step;
      const x0 = Math.floor(body.x / TILE);
      const x1 = Math.floor((body.x + body.w - 1) / TILE);
      const y0 = Math.floor(body.y / TILE);
      const y1 = Math.floor((body.y + body.h - 1) / TILE);
      for (let ty = y0; ty <= y1 && ty < lvl.rows; ty++) {
        if (ty < 0) continue;
        for (let tx = x0; tx <= x1 && tx < lvl.cols; tx++) {
          if (tx < 0) { if (isX) { body.x = 0; info.hit = -1; } continue; }
          if (!SOLID(lvl.tileAt(tx, ty))) continue;
          if (isX) {
            if (delta > 0) { body.x = tx * TILE - body.w; info.hit = 1; }
            else { body.x = (tx + 1) * TILE; info.hit = -1; }
          } else {
            if (delta > 0) { body.y = ty * TILE - body.h; info.hit = 1; }
            else { body.y = (ty + 1) * TILE; info.hit = -1; }
          }
          return info;
        }
      }
    }
    return info;
  }

  moveAndCollide(body, dx, dy, platforms) {
    const res = { hitX: 0, hitY: 0, ground: false, ceiling: false, wallLeft: false, wallRight: false, platform: null };

    // -------- X axis --------
    if (dx !== 0) {
      const info = this._resolveAxis(body, dx, true);
      if (info.hit !== 0) {
        res.hitX = info.hit;
        if (info.hit > 0) res.wallRight = true; else res.wallLeft = true;
      }
    }

    // -------- Y axis --------
    if (dy !== 0) {
      const info = this._resolveAxis(body, dy, false);
      if (info.hit !== 0) {
        res.hitY = info.hit;
        if (info.hit > 0) res.ground = true; else res.ceiling = true;
      }
    }

    // -------- dynamic platforms --------
    // One-way from above: you can jump up through a platform and land on it,
    // and a head-bonk pushes you back down. Horizontal riders are carried by
    // the Player (see res.platform), so no sticky side-push is applied here.
    if (platforms) {
      for (const p of platforms) {
        if (!p.solid) continue;
        const overlapX = body.x + body.w > p.x + 1 && body.x < p.x + p.w - 1;
        if (!overlapX) continue;
        const prevBottom = body.y + body.h - dy;
        const prevTop = body.y - dy;
        const platTop = p.y;
        const platBottom = p.y + p.h;
        if (dy >= 0 && prevBottom <= platTop + 6 && body.y + body.h >= platTop) {
          body.y = platTop - body.h;
          res.ground = true;
          res.platform = p;
          res.hitY = 1;
          continue;
        }
        if (dy < 0 && prevTop >= platBottom - 6 && body.y <= platBottom && body.y > platTop) {
          body.y = platBottom;
          res.ceiling = true;
          res.hitY = -1;
        }
      }
    }

    return res;
  }

  isOnGround(body, platforms) {
    const lvl = this.level;
    const y = Math.floor((body.y + body.h + 1) / TILE);
    const x0 = Math.floor(body.x / TILE);
    const x1 = Math.floor((body.x + body.w - 1) / TILE);
    for (let tx = x0; tx <= x1; tx++) {
      if (SOLID(lvl.tileAt(tx, y))) return true;
    }
    if (platforms) {
      for (const p of platforms) {
        if (!p.solid) continue;
        if (body.y + body.h <= p.y + 1.5 && body.y + body.h >= p.y - 1.5 &&
            body.x + body.w > p.x && body.x < p.x + p.w) return true;
      }
    }
    return false;
  }
}
