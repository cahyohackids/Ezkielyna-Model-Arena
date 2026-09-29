# REPORT — PIXELBOUND: LOST SIGNAL

## What was built

A complete, polished 2D platformer in plain HTML5 Canvas + ES modules:
3 themed levels, momentum-based movement with full platformer feel (coyote
time, jump buffering, variable jump height, dash), 3 enemy types, 5 platform
types, 3 hazard types, checkpoints, secrets, particles, procedurally
synthesised audio, full menu/HUD system, touch controls, settings and a
localStorage save system. Zero external assets — every pixel and every sound
is generated in code.

## Architecture

```
index.html              page shell: canvas, HUD, touch controls, menu layer
styles.css              all styling: layout, menus, HUD, touch buttons, focus states
src/main.js             entry point; boots the Game
src/Game.js             state machine + fixed-timestep loop; wires every system together
src/core/
  Renderer.js           palette (PAL) + all sprite/tile drawing (PIP, enemies, tower…)
  InputManager.js       keyboard + touch → polled state + edge-triggered events
  AudioManager.js       Web Audio synthesis: SFX + 3 generative music themes
  Camera.js             smooth follow, look-ahead, vertical easing, shake, clamp
  ParticleSystem.js     pooled particles (burst/emit/update/render)
  SaveSystem.js         localStorage: unlocks, best times, bits/cores, settings
  mathUtils.js          clamp / lerp / smooth / hash2
  favicon.js            draws a 16×16 PIP favicon at runtime (blob URL)
src/game/
  Level.js              parses level defs → tile grid + entity instances; renders
  levels.js             hand-authored level data (tile rows + entity list)
  Physics.js            axis-separated swept AABB collision (tiles + platforms)
  Player.js             PIP: movement model, dash, damage, animations, events
  Background.js         3-layer parallax + ambient motes per theme
  entities/
    Entity.js           base AABB
    Platforms.js        Moving / Falling / Phase platform, BouncePad
    Enemy.js            GlitchHopper, StaticDrone, CorruptBug (+ shared death)
    Collectible.js      Bit, DataCore
    Hazard.js           Spike, EnergyPit, Laser
    Checkpoint.js       Checkpoint terminal, SignalTower (level goal)
src/ui/UIManager.js     all DOM UI: HUD, menus, level select, settings, stats
```

### Design decisions

- **Fixed internal resolution (480×270), CSS-scaled with `object-fit:
  contain`.** Pixels stay crisp, aspect ratio is preserved on any device, and
  the game logic never has to think about display size. The canvas is a fixed
  integer multiple of the 16px tile grid.
- **Fixed-timestep loop (1/60 s) with an accumulator** (max 5 steps, clamped
  after a tab switch). Physics is deterministic and frame-rate independent;
  rendering interpolates for free because it runs every rAF.
- **Collision: axis-separated swept AABB.** X resolved, then Y; per-axis
  motion is sub-stepped when it exceeds ~0.9 tile so tunneling is impossible,
  and ground contact snaps the body exactly to the tile top so resting bodies
  never jitter. Dynamic platforms are one-way from above (you can jump up
  through them) and carry riders via an explicit `dx/dy` transfer in `Player`.
- **Event-driven player → game coupling.** `Player.update()` returns an event
  list (`jump`, `land`, `dash`, `trail`, `dust`, `bounce`, `pit`) so the game
  layer owns all audio/particle/camera feedback. The player never touches the
  audio or particle systems directly except for its own damage/death burst.
- **Polled input + edge-triggered presses.** `InputManager` exposes a `state`
  object for held buttons and `consumeJump()/consumeDash()` for presses, which
  makes jump buffering and coyote time trivial and keeps keyboard and touch
  perfectly equivalent.
- **Procedural everything.** Sprites are drawn with `fillRect` pixel blocks
  (consistent 1px grid, limited palette), audio is oscillator + noise-buffer
  synthesis, the favicon is drawn into a canvas. Nothing can 404 except the
  browser's default `favicon.ico` request, which is suppressed with an inline
  data link and replaced by the generated one.
- **UI in DOM, gameplay on canvas.** Menus get real buttons, focus rings,
  keyboard navigation and ARIA labels for free; the canvas only renders the
  game. The HUD is a thin overlay that never blocks the action.
- **Restrained juice.** Shake amplitudes stay ≤5px and decay exponentially,
  impact freeze is 50 ms, glow is reserved for bits, cores, checkpoints, the
  tower and active lasers. A reduced-motion setting disables shake entirely.

## Verification

- `check_project`: 23 JS modules, all imports resolve, no syntax errors.
- `smoke_test` (headless Chrome, simulated player): boots to the main menu,
  starts the game on Enter, HUD updates during play (bits counter
  increments), pause menu opens and closes, no uncaught exceptions, no
  console errors, no layout problems, canvas renders from the first frame.
- Manual review of code paths the smoke test cannot reach: death → SIGNAL LOST
  → retry from checkpoint, tower activation sequence → SIGNAL RESTORED stats
  screen → next level unlock, level select rendering and locked states,
  settings persistence, falling/phase platform respawn cycles, laser on/off
  damage gating (`hz.on === false` skips damage), and the secret-zone
  discovery logic.

## Known limitations

- Levels are hand-authored as tile strings in `src/game/levels.js`; there is
  no level editor, so adding levels means editing data by hand.
- Touch controls are only shown when a small touch screen is detected; a
  touch-enabled laptop in a large window keeps them hidden.
- No gamepad support; keyboard and touch only.
- The smoke test only exercises the first ~8 seconds, so late-level balance
  (Glitch Tower difficulty) is tuned by hand rather than by automated play.
- Music is a generative arpeggio loop per theme, not a full composed score.
- `Math.random()` is used for particle/visual variety only, never for
  gameplay — except cosmetic bob phases on collectibles.

## What I would do next

1. A level editor (export to the same tile-string format) — the biggest
   content multiplier.
2. A boss encounter at the top of Glitch Tower using the existing enemy
   framework, plus a proper ending screen.
4. Gamepad support via the Gamepad API and a "hold to rebind keys" option.
5. Per-level medal ratings (any% / all-bits / all-cores / no-death) on the
   level select cards — the save schema already tracks the data.
6. A daily-seed challenge mode reusing the deterministic `hash2` helpers.
