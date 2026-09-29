// Small math helpers used across physics, camera and rendering.

export const clamp = (v, min, max) => (v < min ? min : (v > max ? max : v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const sign = (v) => (v > 0 ? 1 : (v < 0 ? -1 : 0));
export const abs = Math.abs;

// Frame-rate independent exponential smoothing factor.
// dt in seconds; higher speed => snappier follow.
export const smooth = (dt, speed) => 1 - Math.exp(-speed * dt);

export function aabb(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function randRange(min, max) {
  return min + Math.random() * (max - min);
}

// Deterministic-ish pseudo random from integer seed (used for level decor).
export function hash2(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >> 13)) * 1274126177 | 0;
  h = h ^ (h >> 16);
  return (h >>> 0) / 4294967295;
}
