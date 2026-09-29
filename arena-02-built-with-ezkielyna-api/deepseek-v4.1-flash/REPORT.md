# REPORT — PIXELBOUND: LOST SIGNAL

## 1. What this is

A complete, self-contained browser platformer: three hand-authored levels, a
camera-relative side-scrolling 2D engine, original procedural pixel art, original
procedurally-synthesized audio, full menu/UI shell, save system and touch
support. It runs from `index.html` with no build step and no network access.

The whole thing is plain ES modules under `src/`, loaded by a single
`<script type="module">` tag. Nothing is inlined, so it satisfies the strict
`script-src 'self'` CSP.

---

## 2. Architecture

```
index.html            Static shell: canvas, touch-control DOM, module entry point.
styles.css            Page layout, letterboxing, touch-control styling.

src/main.js           Bootstrap: canvas scaling, touch bindings, fixed-step loop.
src/game.js           Application shell: state machine, input routing, screens.
src/input.js          Keyboard + touch + gamepad unified into a small action set.
src/audio.js          Web Audio synthesis: SFX one-shots + generative music.
src/save.js           localStorage persistence with safe fallbacks.
src/math.js           clamp / approach / damp / lerp / overlap helpers.
src/tiles.js          Tile enum, tile properties, theme palettes.

── Simulation ──────────────────────────────────────────────────────────────
src/player.js         PIP: movement, feel systems, damage, animation state.
src/level.js          Tilemap, swept AABB collision, entities, platforms, hazards.
src/entities.js       Enemy behaviours (hopper, drone, bug, sentinel).
src/levelmanager.js   Per-run orchestration: interactions, checkpoints, death,
                      respawn, stats, game-over condition.
src/camera.js         Smoothed follow camera with look-ahead and trauma shake.
src/particles.js      Pooled particle system (Struct-of-Arrays, no GC churn).

── Presentation ────────────────────────────────────────────────────────────
src/sprites.js        Procedural sprite atlas — all pixel art baked at startup.
src/render.js         Parallax backgrounds, culled tilemap, entities, props.
src/ui.js             On-canvas menus, HUD, toasts; layout + hit-testing.
```

### Why this split

- **Simulation is independent of rendering.** `player.js`, `level.js` and
  `levelmanager.js` never touch a canvas; they hand back state. The renderer and
  HUD read it. That made it possible to tune feel (constants at the top of
  `player.js`) without touching draw code.
- **`levelmanager.js` owns per-run state**, not the `Game` shell. That keeps
  "what happens during a level" in one place — pickups, checkpoints, enemy
  contact, hazards, goal, respawn, stats — and keeps `game.js` purely about
  which screen is on top.
- **Menus are canvas-drawn, not DOM.** One consistent pixel grid, no layout
  reflow during play, and menus scale with the same integer scaling as the game.
  The DOM is reserved for the touch buttons, where real buttons with real
  pointer capture are the right tool.
- **Sprite atlas is baked once** into offscreen canvases at construction time,
  so per-frame rendering is only `drawImage` calls.

### Data flow per frame

1. `main.js` accumulates real time and runs `game.update(STEP)` at a fixed
   1/60 s, up to 5 catch-up steps, polling input edges once per step.
2. `game.update` switches on the current screen. During play it delegates to
   `levelmanager.update`, which runs the player, the level, then all interaction
   checks in a fixed order.
3. `game.render` draws the active screen; during play it draws background →
   parallax → props → tilemap → checkpoints → platforms → hazards →
   collectibles → goal → enemies → player → particles → HUD → toasts.

### Fixed timestep

Physics runs at a fixed 1/60 s with an accumulator (`main.js`). This is the main
reason movement is consistent across 60 Hz, 120 Hz and 144 Hz displays, and why
the `dt > 0.25` clamp prevents a spiral of death after a tab switch. Input edges
are snapshotted at the start of each step (`input.beginFrame`), so a fast tap
registers exactly once regardless of how many steps run in a frame.

---

## 3. Collision model

- Tilemap is a flat `Int8Array` for cache-friendly lookups.
- Out-of-bounds tiles read as solid, which makes walls at level edges implicit.
- Movement uses **axis-separated swept AABB resolution**: X is resolved first,
  then Y. Each axis checks only the tile rows/columns the AABB actually touches,
  so a tiny entity tests at most 4 tiles per axis.
- Entities resolve to the tile face with a small epsilon (`±0.01`) so the player
  never jitters on a surface or wedges into a wall.
- One-way platforms are only solid when the entity is moving down *and* its
  previous bottom was at or above the platform top — that's what makes
  jump-up-through and drop-through (`down` while airborne) both work.
- Dynamic platforms are resolved after tiles, preferring a top-landing
  resolution; otherwise they push sideways or block from below. The player
  inherits `platform.dx/dy` while standing on one, which removes the classic
  "sliding off a moving platform" artifact.
- Falling platforms detect a rider via the player's `ridePlatform` and then run
  a shake → fall → despawn state machine.

Known-good cases verified by testing: floor collisions, wall collisions,
ceilings, moving platforms, stomps, spikes, and respawn placement.

---

## 4. Game-feel decisions

The brief called out movement quality as the top criterion, so the feel systems
were treated as the product:

| System | Value | Why |
| --- | --- | --- |
| Coyote time | 0.11 s | In the 80–150 ms window; forgiving without feeling floaty |
| Jump buffer | 0.13 s | Slightly longer than coyote so landings never eat inputs |
| Apex gravity | ×0.62 under \|vy\| < 42 | Makes the jump peak hang and stay steerable |
| Fall gravity | ×1.42 while falling | Snappy descents, precise short hops |
| Jump cut | ×0.42 on early release | Real variable height, not a fixed arc |
| Turn multiplier | ×2.1 | Direction changes feel responsive rather than slidey |
| Dash | 330 px/s for 0.19 s, 0.48 s cooldown | Long enough to matter, short enough to chain |
| Hit-freeze | 0.055 s on stomp, 0.09 s on hurt | Impact punctuation without stalling |

Other deliberate touches: squash/stretch springs (separate fast/slow damping for
target and value), landing dust scaled by impact speed, a footstep timer tied to
actual velocity, dash afterimages, and a trauma-based camera shake that squares
its magnitude so small hits barely move the frame.

---

## 5. Level authoring constraints

Levels are built by a small `Builder` in `levels.js` (floor/block/carve/plat/
spikes/phase) and exported as character grids. The critical part is a documented
**jump budget** derived from the live constants:

- Hold-jump apex ≈ 48 px ≈ **3 tiles**; flat jump distance ≈ **4.5 tiles**.
- Therefore no *required* step-up is taller than **2 tiles**, no *required* gap
  is wider than **4 tiles**, and every required jump has ≥ 3 tiles of headroom.
- Anything wider or taller is either optional (a secret / Data Core route) or
  explicitly solved by a bounce pad, moving platform or phase block.

### Builder discipline (learned the hard way)

1. Lay **all** ground with `floor()` / `block()` first.
2. **Then** carve pits and hidden rooms.

Doing it in the other order is what made an intermediate revision of the level
data unpassable: a later fill silently sealed a corridor. The file documents
this rule at the top so it can't be reintroduced. There is also an
`auditLevel()` helper that walks the authored grid and warns about oversized
required step-ups and gaps — a cheap static check on level design.

Pits are always carved out of a continuous floor run so both rims share the same
walkable height, making the hole visible and readable rather than a surprise.

---

## 6. Audio

100% synthesized, therefore 100% original and asset-free. A single lazily-created
`AudioContext` feeds an `sfx` bus and a `music` bus into a shared compressor and
master gain (created on the first user gesture to satisfy autoplay policy).

- SFX are one-shot oscillator/noise graphs with envelopes: jump, dash, land
  (velocity-scaled), step, coin (pitch rises with the pickup combo), core,
  stomp, hurt, death, checkpoint, bounce, tower activation, level complete.
  Duplicate SFX within a short window are throttled.
- Music is a slow generative arpeggio plus pad driven by a lookahead scheduler,
  so it never audibly loops. There are distinct moods for menu, each level theme,
  pause, and completion.
- Muting and the two volume sliders write straight through to the gain nodes.

---

## 7. Save system

`localStorage` under a single versioned key, with a try/catch fallback so a
locked-down browser degrades to "playable but forgetful" instead of crashing.
It stores unlocked level, `lastPlayed`, per-level `cleared` / `bestTime` / `bits`
/ `cores` / `totalBits` / `secrets[]`, and all settings. Collectible totals are
banked mid-run (on death and on pickup) so quitting or dying never loses
progress. Best-of semantics: bits/cores only ever increase, time keeps the
minimum.

---

## 8. Responsiveness, mobile and performance

- The canvas backing store is a fixed 480×270 logical grid at 2× scale; CSS
  scales the element to fit the viewport with letterboxing. Sprites are never
  stretched, and there is no per-frame layout work.
- Touch controls are real DOM buttons with `pointerdown/up/cancel`, pointer
  capture, `contextmenu` suppression and `touch-action: none`. Multitouch is
  supported (hold left + press jump), and the layout leaves the centre of the
  screen clear. Pointer events also cover mouse/trackpad.
- Gamepad polling runs once per step, so it costs nothing when no pad is
  connected.
- Performance work: pooled particles in Struct-of-Arrays form (zero per-frame
  allocation), tile rendering culled to the visible range and pre-baked into
  horizontal strips, parallax layers pre-rendered to offscreen canvases, and a
  visible-tile-only draw pass. No DOM mutation during gameplay.
- `Show FPS` in settings exposes a smoothed frame-time readout for diagnosis.

---

## 9. Known limitations

- **Three levels only.** That is the brief, but it means the difficulty curve
  ends abruptly after GLITCH TOWER.
- **No boss encounter.** The tower activation is a triumphant sequence rather
  than a fight.
- **Sentinel enemies are dash-only.** They are not stompable; a player who never
  dashes has to route around them. This is intentional but not signposted in
  the mid-level; it's mentioned on the HOW TO PLAY screen.
- **Secrets are proximity triggers**, not gated rooms — walking into a hidden
  alcove is enough. Simple and reliable, but less "found it" ceremony than a
  reward chamber with a door.
- **No high-score/full-run mode.** Level completion is per-level, with no
  aggregate time attack across all three.
- **Audio is deliberately sparse.** The music is a generative bed, not a
  composed theme with a melody hook.
- **`auditLevel()` is a dev aid**, not a runtime gate — it logs warnings rather
  than failing. It only checks the top surface of the terrain, so it can't
  reason about optional routes.
- **Gamepad support is untested on real hardware** in this environment; it is
  written defensively (every access wrapped, no-op when no pad is present) but
  should be re-verified with a physical controller.
- Sprites are hand-authored pixel data baked into canvases; they are consistent
  in scale and palette but do not use a hand-drawn sprite sheet, so very close
  inspection shows procedural regularity.

---

## 10. What I would do next

1. **A fourth level and a boss.** A corrupted "carrier" boss that has to be
   damaged by dash-bouncing off its antenna segments would extend the arc and
   give the Sentinel/Sentinel-adjacent ideas somewhere to land.
2. **Real secret rooms.** Gate the Data Cores behind a small ceremony — a
   collapsing wall, a hidden hatch that opens with a prompt — instead of
   proximity.
3. **Composed music.** Replace the generative bed with a short authored loop per
   theme with an intro, a main section and a restated outro on level complete.
4. **Full-run time attack** with a per-level split summary and a leaderboard
   stored locally.
5. **Accessibility pass 2**: remappable keys, UI scale, colour-blind-safe hazard
   variants (hazards currently depend on red/orange, which is the riskiest part
   of the palette for CVD), and a "no timers" assist.
6. **More enemy interaction verbs** — carryable phase blocks, enemies that can be
   knocked into each other, or a bug that can be redirected mid-charge.
7. **Mobile polish**: a landscape prompt for portrait phones, and adjustable
   touch-button positions/size.
8. **Automated level validation** promoted from a dev console warning to a
   build-time assertion over the jump budget, so a future level edit can never
   silently ship an impossible jump.

---

## 11. Verification

- `check_project` — 17 JS files parse as ES modules; every relative import,
  `script src` and `link href` resolves.
- `smoke_test` — headless Chrome, ~8 s of simulated play: zero uncaught
  exceptions, zero console errors, zero failed requests. Exercised load, menu
  confirm into gameplay, sustained movement/jump/dash input, and pause.

Both were run clean before completion.
