# PIXELBOUND: Lost Signal — Technical Report

## Architecture

The game is built with plain ES modules and no build step, served as static
files. All rendering is HTML5 Canvas (crisp, pixelated, integer-scaled), and
all UI/menus are DOM overlays. Audio, sprites, and particles are generated
procedurally in code — there are no external assets.

```
index.html          — shell: canvas, HUD, menu root, touch controls
styles.css          — all styling (HUD, menus, touch layout)
src/
  main.js           — Game class: bootstrap, state machine, loop, level orchestration
  player.js         — PIP physics, movement feel, dash, health, animation state
  input.js          — unified keyboard + touch input with edge detection
  camera.js         — smooth follow, look-ahead, bounds, screen shake
  levelparser.js    — converts string maps + entity lists into playable levels
  levels.js         — level data (tile maps, enemies, collectibles, platforms)
  enemies.js        — Glitch Hopper / Corrupt Bug / Drone behaviors
  renderer.js       — all canvas drawing (tiles, entities, parallax, player)
  sprites.js        — pixel-art sprite grids (PIP + entities)
  pix.js            — sprite factory + palette
  particles.js      — pooled particle system
  audio.js          — Web Audio synth SFX + ambient music
  ui.js             — DOM menu/HUD management + focus handling
  save.js           — localStorage persistence
  utils.js          — math/helpers (clamp, lerp, aabb, formatTime)
```

### State Machine

`Game.state` drives everything: `menu`, `playing`, `paused`, `gameover`,
`complete`. The main `loop()` runs a fixed-logic `update(dt)` only while
`playing`, and always calls `render()`, which either draws the live level or a
menu backdrop (with a dimmed level behind pause/complete screens).

### Physics & Feel

Movement uses explicit integration with tile-based AABB collision resolved
per-axis (X then Y) to prevent tunneling and wall-sticking. Key feel features:

- **Coyote time** (100 ms) and **jump buffering** (120 ms).
- **Variable jump height** — releasing jump early clamps upward velocity.
- **Fall gravity** (1500) is stronger than rise gravity (1100) for snappier
  falls; terminal velocity is capped.
- **Dash** (640 px/s for 160 ms) with a 700 ms cooldown, trail particles, and
  a HUD cooldown bar.
- **Squash/stretch**, landing dust, jump/land particles, impact freeze on
  stomps, and restrained camera shake.

### Level Format

Levels are defined as compact string maps (`. = empty`, `# = solid`, `^ =
spikes`, `B = bounce`, `C = checkpoint`, `T = tower`, `S = spawn`, `b = bit`,
etc.) plus structured entity lists (enemies, drones, lasers, moving/falling/
phase platforms, extra bits/cores). `parseLevel` turns these into typed sets
and entity arrays, snapping ground-based entities to the floor surface below.

## Key Decisions

- **No framework** — vanilla Canvas keeps the footprint tiny, avoids bundling,
  and gives full control over performance and pixel fidelity.
- **Procedural art & audio** — satisfies the no-external-assets constraint and
  keeps everything original and coherent (single palette, consistent 4x pixel
  scale).
- **DOM for UI, Canvas for gameplay** — menus/HUD get crisp text, accessibility
  and focus states for free; the canvas is reserved for the game world.
- **Fixed 960×540 logical resolution** — integer-preserving scale to fit any
  viewport, preserving pixel-art sharpness without stretching sprites.

## Known Limitations

- **Audio requires a user gesture** — the Web Audio context is created lazily
  on the first interaction (standard browser policy).
- **No persistent mid-level collectibles** — collectibles reset on death/exit,
  matching classic platformer conventions; only completion stats persist.
- **Moving/falling platform carrying** is approximated with a per-frame delta
  rather than a full swept constraint solver; it is stable at 60 fps but could
  drift under large frame spikes (mitigated by the 50 ms dt clamp).
- **Vertical camera** is intentionally gentle; extreme vertical level geometry
  would need room-based or look-ahead-y camera logic (not required by the
  current three levels).
- **Reduced motion** reduces particles and shake but does not fully remove
  background animation (it is slow and low-contrast).

## What I Would Do Next

- Add a 4th "boss" encounter before the final tower for a stronger climax.
- Time-trial ghost or par-time medals to deepen replayability.
- More enemy variety (e.g., a shield drone that must be dashed through).
- Room-based vertical camera and larger vertical set-pieces.
- A small level editor (the string-map format already lends itself to this).
- Haptics on supported mobile devices for additional feedback.
- Web Audio music sequencer per-level theming (currently one shared loop).
