# PIXELBOUND: LOST SIGNAL

A small, finished 2D side-scrolling platformer built with plain HTML5 Canvas
and modern JavaScript (ES modules). No frameworks, no external assets — every
sprite, tile, sound and song is generated in code.

You play **PIP**, a courier robot, restoring signal towers across a fragmented
digital world.

---

## How to play

Run right, collect **Signal Bits**, find the hidden **Data Cores**, stomp or
avoid the enemies, touch the **checkpoint terminal**, and reach the glowing
**signal tower** at the end of the level to restore it.

### Controls (desktop)

| Action | Keys |
|---|---|
| Move left / right | `A` / `D`, or `←` / `→` |
| Jump (hold for higher) | `Space`, `W`, or `↑` |
| Dash | `Shift` (or `J`) |
| Restart level | `R` |
| Pause | `Esc` (or `P` via the HUD button) |
| Navigate menus | `←` `→` `↑` `↓`, `Enter` to confirm, `Backspace` to go back |

### Touch controls

On phones and small tablets in landscape, four large touch buttons appear at
the bottom corners of the screen: **◀ ▶** on the left, **▲ (jump)** and
**≫ (dash)** on the right. They support multi-touch, so you can run, jump and
dash at the same time. They never overlap the HUD or the centre of the screen.

### Movement feel

- Acceleration + deceleration with momentum; weaker air control so jumps keep
  your speed.
- **Coyote time** — you can still jump for ~110 ms after leaving a ledge.
- **Jump buffering** — a jump pressed up to 130 ms before landing fires on
  contact.
- **Variable jump height** — tap for a short hop, hold for the full arc.
- **Faster fall gravity** than rise gravity, capped by a terminal velocity.
- **Dash** with a trail, a 0.62 s cooldown (shown in the HUD) and a subtle
  camera kick.
- Squash & stretch on jump/land, dust particles, landing camera shake.

### Health

3 energy cells (top-left of the HUD). Taking damage costs one cell, with
knockback, 1.3 s of blinking invulnerability and a sound cue. Losing all three
triggers the **SIGNAL LOST** screen — retry from your last checkpoint.

---

## Features

**3 levels, each with a distinct theme and mechanics**

1. **SIGNAL MEADOW** — bright digital grassland. Teaches running, jumping,
   bits, the first enemy, a checkpoint and a moving platform. Easy.
2. **CIRCUIT CAVERNS** — dark vertical caves. Falling platforms, bounce pads,
   a vertical moving-platform ride, drones and a hidden room. Medium.
3. **GLITCH TOWER** — unstable corrupted tower. Rhythmic lasers, phase blocks,
   energy pits, charging bugs and dash-focused traversal, ending in the tower
   activation sequence. Medium-hard.

**Enemies** (all original, all stompable from above, dangerous from the side)

- **Glitch Hopper** — patrols a small range.
- **Static Drone** — floats along a fixed eased path.
- **Corrupt Bug** — patrols, telegraphs with a shake, then charges fast.

**Platform types** — static terrain, horizontal/vertical moving platforms,
falling platforms (shake then drop, then respawn), bounce pads, and phase
platforms that appear/disappear on a readable rhythm (a ghost outline shows
where they will be).

**Hazards** — spikes, energy pits and pulsing lasers (horizontal and vertical),
each drawn so the danger is obvious before you touch it.

**Secrets** — every level has a hidden Data Core room or alcove with a subtle
visual clue, plus a "secret discovered" zone. 3 Data Cores per level.

**Checkpoints** — touch a terminal to light it up, update your respawn point
and get a particle + sound reward.

**UI** — main menu, level select (with per-level bits/cores/best time and
locked states), how-to-play, settings, pause, game over and a level-complete
screen showing time, bits, cores, deaths and new-best-time records.

**Settings (persisted)** — music volume, SFX volume, mute all, screen shake
toggle, and a reduced-motion option that kills shake and smooth camera tweens.

**Save system** — localStorage keeps unlocked levels, best times, collected
bits/cores and your settings. Degrades gracefully to in-memory storage when
localStorage is unavailable.

**Audio** — all sound effects and the three generative background tracks are
synthesised at runtime with the Web Audio API (no files, no copyrighted
audio). Each level has its own scale, tempo and mood.

**Performance & responsiveness** — fixed-timestep game loop with an accumulator,
a 480×270 internal resolution scaled with `object-fit: contain` (crisp pixels,
correct aspect on any screen), camera-clamped tile rendering, and a pooled
particle system.

---

## Running it

Open `index.html` in any modern browser. No build step, no server required
(though a static server works too). Works on desktop, laptop, tablet and
mobile landscape.

Tip: press `Enter` on the main menu to start immediately at your next
uncleared level.
