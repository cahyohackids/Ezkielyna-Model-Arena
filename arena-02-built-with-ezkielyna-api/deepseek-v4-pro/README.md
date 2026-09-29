# PIXELBOUND: Lost Signal

A small but polished 2D side-scrolling platformer built entirely with vanilla
HTML5 Canvas + JavaScript (no frameworks, no external assets).

You play as **PIP**, a courier robot trying to restore communication towers
across a fragmented digital world after a mysterious system failure called
*The Lost Signal*.

---

## How to Play

Reach the **Signal Tower** at the end of each level and activate it to restore
the signal. Collect glowing **Signal Bits** and hunt for 3 hidden **Data Cores**
per level. Stomp enemies by landing on them. Avoid spikes, lasers, drones, and
energy pits.

### Controls (Desktop)

| Action        | Keys                              |
|---------------|-----------------------------------|
| Move left     | `A` / `←`                         |
| Move right    | `D` / `→`                         |
| Jump          | `Space` / `W` / `↑` (hold = higher) |
| Dash          | `Shift`                           |
| Restart level | `R`                               |
| Pause         | `Esc`                             |

### Controls (Touch)

On touch devices, on-screen buttons appear:
- **Left / Right** directional pads (bottom-left)
- **JUMP** and **DASH** action buttons (bottom-right)

Multitouch is supported, so you can move and jump at the same time.

---

## Features

- Responsive platforming: acceleration, deceleration, momentum, air control,
  terminal velocity, variable jump height, coyote time, and jump buffering.
- A short horizontal **dash** with a visual trail and cooldown indicator.
- 3 energy cells of health with brief invulnerability, knockback, and blink.
- Three distinct levels:
  1. **Signal Meadow** — bright, easy, teaches the basics.
  2. **Circuit Caverns** — dark caves with falling platforms, bounce pads,
     drones, and vertical traversal.
  3. **Glitch Tower** — unstable tower with lasers, phase platforms, and
     dash-focused platforming.
- Enemies: Glitch Hopper, Corrupt Bug, Static Drone.
- Hazards: spikes, energy pits, falling platforms, moving lasers,
  disappearing phase blocks.
- Platforms: static, moving, falling, bounce pads, phase.
- Checkpoint terminals that save your respawn point.
- Hidden paths and secret areas with Data Cores.
- Smooth camera with look-ahead and gentle vertical follow.
- Parallax backgrounds, ambient particles, squash/stretch, screen shake,
  impact freeze, and synthesized audio (jump, dash, collect, stomp, hurt,
  checkpoint, tower activation, plus subtle ambient music).
- Full menu system: main menu, level select, how-to-play, settings, pause,
  level-complete, and "Signal Lost" game-over screens.
- Save system (localStorage) for unlocked levels, best times, and collectibles.
- Settings: music/SFX volume, mute, screen shake, reduced motion.
- Accessibility: keyboard-navigable menus, visible focus states, reduced
  motion option, and sufficient UI contrast.

---

## Settings

Open **SETTINGS** from the main menu or pause menu to adjust:

- **Music volume** and **SFX volume** sliders
- **Mute** toggle
- **Screen shake** toggle
- **Reduced motion** toggle (cuts particles and shake intensity)

All settings persist across sessions.

---

## Tip

Data Cores are optional but require exploration. Look for subtle platform
breadcrumbs leading upward or off the main path — every level has at least one
hidden route.
