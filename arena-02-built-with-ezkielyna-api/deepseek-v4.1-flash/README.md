# PIXELBOUND: LOST SIGNAL

A retro-futuristic 2D pixel platformer. You play **PIP**, a small courier robot
trying to bring a fragmented digital world back online after a system failure
known as **The Lost Signal**. Each level ends at a **signal tower** that PIP must
reach and activate.

Everything you see and hear is generated at runtime — sprites are drawn into
offscreen canvases from pixel data, and all audio is synthesized with the Web
Audio API. There are no external assets, no CDNs, no build step. Open
`index.html` and it runs.

---

## How to play

Run, jump and dash through three levels, collecting **Signal Bits**, hunting
**Data Cores**, and stomping glitchy enemies. Reach the tower at the far end of
each stage to restore its signal.

### Controls — keyboard

| Action   | Keys                          |
| -------- | ----------------------------- |
| Move     | `A` / `D` or `←` / `→`        |
| Jump     | `Space`, `W`, `↑` (hold for higher) |
| Dash     | `Shift` (also `K` / `L`)      |
| Duck / drop through one-way platforms | `S` / `↓` (while airborne) |
| Pause    | `Esc` or `P`                  |
| Restart level | `R`                       |
| Menus    | `↑ ↓` navigate, `← →` adjust, `Enter`/`Space` confirm, `Esc` back |
| Mute     | `M`                            |

### Controls — touch / mobile

On a touch device a control layer appears automatically:

- **Left / Right** pads in the bottom-left corner.
- **DASH** and **JUMP** buttons in the bottom-right corner.
- A small **pause** button in the top-right.

The pads use pointer events with capture, so multitouch works: hold a direction
and press jump or dash at the same time. The controls sit in the lower corners
and never cover the play area in the middle of the screen. Portrait or
landscape both work; the canvas letterboxes to a fixed 16:9 aspect.

Gamepads also work (D-pad / left stick to move, `A` to jump, `X`/`B`/`RB` to
dash, `Start` to pause).

---

## The feel of movement

The movement model is deliberately "juicy" rather than stiff:

- Separate ground and air acceleration, with a snappier turn-around when
  reversing direction, so direction changes feel responsive.
- Separate deceleration and friction — stops are crisp but not instant.
- **Asymmetric gravity**: falling is heavier than rising.
- **Apex hang**: gravity eases slightly near the top of a jump arc, which makes
  the peak feel floaty and controllable.
- **Variable jump height**: releasing the jump button early cuts the rise.
- **Coyote time** (~110 ms): you can still jump just after walking off a ledge.
- **Jump buffering** (~130 ms): pressing jump slightly before landing fires the
  jump on touchdown.
- **Dash**: a short horizontal burst on a cooldown, with a trail, a burst sound
  and a HUD meter. Landing does not refill it mid-air, so dashes stay a
  deliberate resource; they are never required for the first obstacles.
- **Squash & stretch**, landing dust, and a very restrained screen shake.

## Health and respawning

PIP has **3 energy cells**. Taking a hit costs one cell, knocks PIP back and
grants brief invulnerability (with a blink). Reaching zero, or falling into a
bottomless pit, triggers a short death animation and respawns PIP at the last
activated **checkpoint relay**.

Separately from health there is a **Signal Integrity** counter (displayed as
`SIG` in the HUD). This is the number of times PIP's carrier can reboot before
the run is lost. Checkpoint relays *top the integrity back up*, so a careful
player effectively never sees the loss screen. Running out shows the thematic
**SIGNAL LOST** screen with **Retry** and **Level Select**.

Collectibles you have already picked up are banked when you die, so a death
never costs you progress you earned.

---

## Collectibles

- **Signal Bits** — small glowing fragments scattered through every level
  (spinning, bobbing, with a pickup burst and a rising chime that pitches up as
  you chain pickups). The HUD tracks `BITS n / total`.
- **Data Cores** — three per level, hidden behind optional platforming, secret
  alcoves or tricky routes. Completion progress is shown on the level-complete
  screen and in level select.

## Enemies

- **Glitch Hopper** — patrolling ground enemy that turns at ledges and walls.
  Stompable.
- **Static Drone** — floats along a fixed horizontal or vertical path. Timing
  puzzle rather than a stomp target.
- **Corrupt Bug** — fast ground enemy that periodically telegraphs and then
  charges.
- **Sentinel** — armoured patroller (later levels). Dashing *through* it is a
  reward for skilled play.

## Hazards and platforms

Hazards: spikes (floor and ceiling), laser beams that sweep and blink off, and
bottomless energy pits. All are visually readable before you can reach them —
lasers warn-up before firing.

Platform mechanics: static terrain, one-way platforms, horizontal and vertical
**moving platforms**, **falling platforms** that shake before dropping,
**bounce pads** that launch you upward, and **phase blocks** that blink in and
out on a shared rythm clock.

---

## Levels

1. **SIGNAL MEADOW** — bright digital grassland. Teaches running, jumping,
   collecting, stomping and the first moving platform. Easy.
2. **CIRCUIT CAVERNS** — dark underground technology caves. Introduces falling
   platforms, bounce pads, vertical traversal, drones and hidden rooms. Medium.
3. **GLITCH TOWER** — the unstable, corrupted source of the signal. Lasers,
   phase platforms, faster enemies, demanding jumps and dash-focused traversal.
   Ends with a full tower activation sequence. Medium-hard.

Every level contains at least one **secret area** (with a subtle environmental
clue) and three Data Cores. Levels unlock as you clear them, and progress is
saved locally.

---

## Menus and UI

- **Main menu** — PLAY (continues your last level), LEVEL SELECT, HOW TO PLAY,
  SETTINGS.
- **Level select** — three cards showing lock state, best time, bits and cores.
- **Pause** — Resume, Restart Level, Settings, Main Menu. Music switches to a
  calmer "held" theme while paused.
- **Settings** — Music volume, SFX volume, Mute All, Screen Shake, Reduced
  Motion, Show FPS. Every option takes effect immediately and is persisted.
- **Level complete** — `SIGNAL RESTORED`, with time, bits, cores, secrets and
  deaths, plus a letter rank based on your completion. Buttons: Next Level,
  Replay, Level Select.
- **Game over** — `SIGNAL LOST` with Retry and Level Select.

The HUD shows health cells, the Signal Integrity meter, the Signal Bit counter,
Data Cores, a dash-cooldown indicator and the run timer. It stays in the corners
and out of the way of gameplay.

Keyboard navigation with a visible focus bar is implemented on every menu, and
pointer hover/click works too.

---

## Saving

Progress is stored in `localStorage` (key `pixelbound.lostsgnal.v1`):
unlocked levels, per-level best time, collected bits and cores, discovered
secrets, last played level, and settings. No account, no network. If storage is
unavailable the game still runs, it simply forgets between sessions.

---

## Accessibility

- Full keyboard menu navigation with visible focus states.
- **Reduced Motion** option: disables screen shake, dash afterimages/particles
  and the invulnerability blink, and softens particle counts.
- **Screen Shake** toggle, independent of reduced motion.
- **Mute All** plus separate music and SFX volume sliders.
- High-contrast UI (light cream on deep navy) designed to stay readable; no
  text is baked into low-contrast artwork.
- `Show FPS` for diagnosing performance.

---

## Technical notes

- Pure HTML + CSS + ES modules. No framework, no bundler, no build step, no
  network requests.
- Fixed simulation step (1/60 s) with an accumulator, decoupled from rendering,
  so physics behaves identically on any refresh rate.
- The canvas renders at a fixed 480×270 logical resolution (scaled 2× in the
  backing store) and is CSS-scaled with letterboxing, so sprites stay
  pixel-crisp and never stretch.
- All art is generated procedurally into offscreen canvases at startup.
- All sound is synthesized: one-shots with oscillator/noise graphs plus a
  generative, softly-evolving music bed driven by a lookahead scheduler.

Open `index.html` directly or serve the folder as static files. That's it.
