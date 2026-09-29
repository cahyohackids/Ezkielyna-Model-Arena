import assert from "node:assert/strict";

globalThis.window = { addEventListener() {}, AudioContext: null, webkitAudioContext: null };
globalThis.ResizeObserver = class { observe() {} };
globalThis.requestAnimationFrame = () => 1;
globalThis.cancelAnimationFrame = () => {};

const gradient = { addColorStop() {} };
const context = new Proxy({ createLinearGradient: () => gradient }, {
  get(target, prop) { return prop in target ? target[prop] : () => {}; },
  set(target, prop, value) { target[prop] = value; return true; },
});
const canvas = { parentElement:{}, getContext: () => context };
const audio = { startMusic() {}, stopMusic() {}, play() {}, settings:{}, applySettings() {} };
const events = [];

const { Game } = await import("../src/game.js");
const { LEVELS } = await import("../src/levels.js");
const game = new Game(canvas, audio, { reducedMotion:false, shake:true }, (type,payload) => events.push([type,payload]));

for (let index = 0; index < LEVELS.length; index++) {
  game.startLevel(index);
  for (let n = 0; n < 120; n++) game.update(1 / 120);
  assert.equal(game.player.grounded, true, `${LEVELS[index].name}: player lands safely`);

  const initialX = game.player.x;
  game.keys.right = true;
  for (let n = 0; n < 45; n++) game.update(1 / 120);
  game.keys.right = false;
  assert.ok(game.player.x > initialX + 15, `${LEVELS[index].name}: horizontal movement works`);

  game.pressed.jump = true;
  game.update(1 / 120);
  assert.ok(game.player.vy < -400, `${LEVELS[index].name}: jump launches player`);

  game.player.dashCooldown = 0;
  game.pressed.dash = true;
  game.update(1 / 120);
  assert.ok(game.player.dashTime > 0 && Math.abs(game.player.vx) > 500, `${LEVELS[index].name}: dash activates`);

  const bit = game.level.bits.find(item => !item.collected);
  const bitsBefore = game.bits;
  game.player.x = bit.x - game.player.w / 2;
  game.player.y = bit.y - game.player.h / 2;
  game.updateCollectibles();
  assert.ok(bit.collected && game.bits > bitsBefore, `${LEVELS[index].name}: collectible counter updates`);

  const checkpoint = game.level.checkpoint[0];
  game.player.x = checkpoint.x;
  game.player.y = checkpoint.y;
  game.updateCheckpoint();
  assert.equal(checkpoint.active, true, `${LEVELS[index].name}: checkpoint activates`);

  const enemy = game.level.enemies[0];
  game.player.invul = 0;
  game.player.x = enemy.x;
  game.player.y = enemy.y;
  game.player.vy = 0;
  game.updateEnemies(1 / 120);
  assert.equal(game.player.health, 2, `${LEVELS[index].name}: enemy contact removes energy`);

  const hazard = game.level.hazards.find(item => item.type === "spikes");
  game.player.invul = 0;
  game.player.x = hazard.x;
  game.player.y = hazard.y;
  game.updateHazards();
  game.player.invul = 0;
  game.updateHazards();
  assert.equal(game.player.dead, true, `${LEVELS[index].name}: depleted health triggers death state`);

  game.spawnPlayer(true);

  game.player.x = game.level.tower.x;
  game.player.y = game.level.tower.y + 40;
  game.updateTower();
  assert.equal(game.complete, true, `${LEVELS[index].name}: tower completes level`);
  assert.equal(game.level.cores.length, 3, `${LEVELS[index].name}: has three Data Cores`);
  game.stop();
}

console.log(`Smoke-tested ${LEVELS.length} levels: movement, jump, dash, pickups, checkpoints, and completion are functional.`);
