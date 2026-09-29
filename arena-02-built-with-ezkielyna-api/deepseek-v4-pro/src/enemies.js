// Enemies: Glitch Hopper, Corrupt Bug, Static Drone.
// Simple behaviors, readable silhouettes, hit reactions + death.

import { aabb, clamp } from './utils.js';
import { TILE } from './levels.js';
import { solidAt, oneWayAt } from './levelparser.js';

export function updateEnemies(game, dt) {
  const lv = game.level;
  const player = game.player;
  for (const e of lv.enemies) {
    if (e.dead) {
      e.deathTimer -= dt;
      e.vy += 600 * dt;
      e.y += e.vy * dt;
      continue;
    }
    e.t += dt;

    if (e.type === 'hopper') {
      updateHopper(game, e, dt);
    } else if (e.type === 'bug') {
      updateBug(game, e, dt);
    }
    e.x = clamp(e.x, 0, lv.width - e.w);
  }

  // drones
  for (const d of lv.drones) {
    if (d.dead) { d.deathTimer -= dt; continue; }
    d.t += dt;
    if (d.axis === 'v') {
      d.y = d.baseY + Math.sin(d.t * (d.speed / d.range)) * d.range;
    } else {
      d.x = d.baseX + Math.sin(d.t * (d.speed / d.range)) * d.range;
    }
  }
}

function updateHopper(game, e, dt) {
  e.vx = e.dir * 80;
  e.x += e.vx * dt;
  const dist = e.x - e.baseX;
  if (Math.abs(dist) > e.patrol * TILE) {
    e.dir = -e.dir;
    e.x = e.baseX + e.dir * e.patrol * TILE;
  }
  // simple gravity/ground
  e.vy += 900 * dt;
  e.y += e.vy * dt;
  const feet = e.y + e.h;
  const ty = Math.floor(feet / TILE);
  const tx = Math.floor((e.x + e.w / 2) / TILE);
  if (solidAt(game.level, tx, ty) || oneWayAt(game.level, tx, ty)) {
    e.y = ty * TILE - e.h;
    e.vy = 0;
  }
  // periodic hop
  if (Math.random() < dt * 1.5 && e.vy === 0) {
    e.vy = -260;
  }
}

function updateBug(game, e, dt) {
  const player = game.player;
  const dx = player.x - e.x;
  const dist = Math.abs(dx);
  const aggro = dist < 5 * TILE;

  if (e.charging) {
    e.chargeTimer -= dt;
    e.vx = e.dir * 300;
    if (e.chargeTimer <= 0) {
      e.charging = false;
      e.vx = 0;
    }
  } else if (aggro) {
    // telegraph then charge
    if (e.chargeTimer > 0) {
      e.chargeTimer -= dt;
      e.vx = 0;
      if (e.chargeTimer <= 0) {
        e.charging = true;
        e.chargeTimer = 0.6;
        e.dir = dx > 0 ? 1 : -1;
      }
    } else {
      // patrol slowly toward player
      e.dir = dx > 0 ? 1 : -1;
      e.vx = e.dir * 70;
      if (dist < 3 * TILE) {
        e.chargeTimer = 0.4; // wind up
        e.vx = 0;
      }
    }
  } else {
    // patrol back and forth
    e.vx = e.dir * 60;
    e.chargeTimer = 0;
    const p = e.x - e.baseX;
    if (Math.abs(p) > e.patrol * TILE) {
      e.dir = -e.dir;
    }
  }

  e.x += e.vx * dt;
  e.vy += 900 * dt;
  e.y += e.vy * dt;
  const feet = e.y + e.h;
  const ty = Math.floor(feet / TILE);
  const tx = Math.floor((e.x + e.w / 2) / TILE);
  if (solidAt(game.level, tx, ty) || oneWayAt(game.level, tx, ty)) {
    e.y = ty * TILE - e.h;
    e.vy = 0;
  }
}

export function stompEnemy(game, e) {
  e.dead = true;
  e.deathTimer = 0.5;
  e.vy = -200;
  game.audio.stomp();
  game.particles.burst(e.x + e.w / 2, e.y + e.h / 2, 12, {
    color: e.type === 'bug' ? '#ff8c42' : '#7fe7ff', speedMin: 60, speedMax: 180, lifeMax: 0.5, gravity: 400,
  });
  game.freeze(0.05);
  game.camera.shake(3, 0.15);
}

export function droneDie(game, d) {
  d.dead = true;
  d.deathTimer = 0.5;
  game.audio.enemyDie();
  game.particles.burst(d.x + 12, d.y + 12, 12, {
    color: '#ff5a6e', speedMin: 60, speedMax: 180, lifeMax: 0.5, gravity: 300,
  });
}

export function enemyHitsPlayer(e, player) {
  return !e.dead && aabb(player.x, player.y, player.w, player.h, e.x, e.y, e.w, e.h);
}
