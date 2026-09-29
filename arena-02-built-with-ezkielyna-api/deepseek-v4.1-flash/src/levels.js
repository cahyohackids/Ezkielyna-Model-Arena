// levels.js — static level data for all three stages.
//
// AUTHORING RULES (these are what keep every level actually completable):
//
//   Jump budget, measured from the live constants in player.js:
//     MAX_RUN         124 px/s
//     JUMP_VELOCITY  -322 px/s (with apex-gravity relief)
//       -> apex height  ≈ 48 px ≈ 3.0 tiles when the button is held
//       -> flat distance ≈ 4.5 tiles at full speed
//     bounce pad power 430 -> launch height ≈ 86 px ≈ 5.4 tiles
//
//   Therefore, for any jump the player MUST make:
//     • required step-up      ≤ 2 tiles   (3 tiles is exactly the limit, so we
//                                          never require it)
//     • required gap width    ≤ 4 tiles   (4 needs a running start)
//     • required headroom     ≥ 3 tiles   (jump arc + body height)
//   Wider gaps and taller steps only ever appear as optional dash routes or as
//   something a bounce pad / platform solves.
//
//   Builder discipline:
//     1. Lay ALL ground with floor()/block() first.
//     2. THEN carve pits and hidden rooms. Carving last guarantees no door,
//        hatch or corridor is accidentally sealed by a later fill — that bug is
//        what made an earlier revision of this file unpassable at its midpoints.
//     3. Pits are always carved out of a continuous floor run, so both rims have
//        the same walkable height and the hole is visible and readable.
//     4. Bounce pads live in `platforms` with kind BOUNCE (the runtime launches
//        the player from them), never in a decorative list.
//
//   Level data shape consumed by level.js / levelmanager.js:
//     tiles, spawn, goal, bits, cores, checkpoints, platforms, enemies,
//     hazards{type,axis:'h'|'v'}, secrets{name,x,y}, decor, theme, songMood, lore

import { PLATFORM_KINDS } from './level.js';

const T = 16;

class Builder {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.grid = [];
    for (let y = 0; y < h; y++) this.grid.push(new Array(w).fill('.'));
  }
  set(x, y, ch) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return this;
    this.grid[y][x] = ch;
    return this;
  }
  get(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return '.';
    return this.grid[y][x];
  }
  /** Solid ground from column x0..x1 (inclusive) starting at row `top`, to the bottom. */
  floor(x0, x1, top) {
    for (let x = x0; x <= x1; x++)
      for (let y = top; y < this.h; y++) this.set(x, y, '#');
    return this;
  }
  /** Solid rectangle in tile units. */
  block(x, y, w, h) {
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) this.set(x + i, y + j, '#');
    return this;
  }
  /** Carve empty space out of an existing solid area. */
  carve(x, y, w, h) {
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) this.set(x + i, y + j, '.');
    return this;
  }
  /** One-way platform strip (jump up through, land on top). */
  plat(x, y, w) {
    for (let i = 0; i < w; i++) this.set(x + i, y, '=');
    return this;
  }
  /** Upward floor spikes. */
  spikes(x, w, y) {
    for (let i = 0; i < w; i++) this.set(x + i, y, '^');
    return this;
  }
  /** Downward ceiling spikes. */
  ceilSpikes(x, w, y) {
    for (let i = 0; i < w; i++) this.set(x + i, y, 'v');
    return this;
  }
  /** Phase-rhythm blocks: solid, blink, gone — driven by one global clock. */
  phase(x, y, w) {
    for (let i = 0; i < w; i++) this.set(x + i, y, 'p');
    return this;
  }
  /** Is the tile at (x, y) solid? Used by the self-check below. */
  solidAt(x, y) { return this.get(x, y) === '#'; }
  /** Convert to the row-band format the Level class consumes. */
  toTiles() {
    const rows = this.grid.map((r) => r.join(''));
    return [{ x: 0, y: 0, rows }];
  }
}

// ───────────────────────────────────────────────────────────────────────────
//  Debug self-check: walks the authored grid left-to-right and asserts that no
//  *required* step is taller than 2 tiles and every floor rim used as a
//  take-off point has something to land on within 4 tiles. Enabled in dev
//  consoles only; it never throws in production, it just logs.
// ───────────────────────────────────────────────────────────────────────────
export function auditLevel(data) {
  const rows = data.tiles[0].rows;
  const h = rows.length;
  const solid = (x, y) => y >= 0 && y < h && (rows[y][x] === '#' || rows[y][x] === 'p');
  /** Walkable top row of the column, or -1 if it is empty all the way down. */
  const topRow = (x) => {
    for (let y = 0; y < h; y++) if (solid(x, y)) return y;
    return -1;
  };
  const problems = [];
  let prevTop = -1;
  let gap = 0;
  for (let x = 0; x < data.width; x++) {
    const top = topRow(x);
    if (top === -1) { gap++; continue; }
    if (prevTop === -1) { gap = 0; prevTop = top; continue; }
    if (gap > 4) problems.push(`gap of ${gap} tiles before column ${x}`);
    const stepUp = prevTop - top;
    if (stepUp > 2) problems.push(`step up of ${stepUp} tiles at column ${x}`);
    gap = 0;
    prevTop = top;
  }
  // Goal and spawn must sit on something solid.
  if (!solid(Math.floor(data.spawn.x / T), Math.floor(data.spawn.y / T))) {
    problems.push('spawn has no ground beneath it');
  }
  if (problems.length) {
    // eslint-disable-next-line no-console
    console.warn(`[PIXELBOUND] level ${data.id} (${data.name}) layout warnings:`);
    for (const p of problems) console.warn('  • ' + p);
  }
  return problems;
}

// ───────────────────────────────────────────────────────────────────────────
//  LEVEL 1 — SIGNAL MEADOW
//
//  Teaches: run, jump, collect, stomp, checkpoint, moving platform, and a
//  genuine (but findable) hidden alcove. Difficulty: easy.
//
//  Ground row G = 19 in a 24-row map, so the camera shows air above the ground.
//
//  Route map (required moves only):
//     cols   0..30  flat ground, first bits, first hopper            [G]
//     gap    31..33  3-tile gap, bits arc over it
//     cols  34..53  ground, 1 hopper, bug chase                      [G]
//     step  54..60  2-tile terrace up (top G-2), bits                [G-2]
//     cols  61..70  flat terrace at G-2                              [G-2]
//     step  71..77  2-tile terrace up (top G-4)   <- 2 tiles, ok     [G-4]
//     cols  78..92  high meadow, checkpoint 1, hopper                [G-4]
//     gap   93..96  4-tile gap; horizontal platform crosses it       [G-4]
//     cols  97..112 ground, hub, hidden alcove hatch at 105-106      [G-4]
//     gap  113..116 4-tile gap with phase blocks + spikes below      [G-4]
//     cols 117..126 ground after the phase crossing                  [G-4]
//     step 127..135 2-tile terrace up (top G-6) on a bounce pad      [G-6]
//     cols 136..151 plateau, checkpoint 2, bug                       [G-6]
//     gap  152..155 4-tile gap; bounce pad launches over the spikes  [G-6]
//     cols 156..176 final run, bits lane                             [G-6]
//     cols 177..182 tower plateau, goal                              [G-6]
// ───────────────────────────────────────────────────────────────────────────
export const LEVEL_1 = (() => {
  const W = 190, H = 24;
  const b = new Builder(W, H);
  const G = 19;

  // ── ground pass ─────────────────────────────────────────────────────────
  // Both terrace rises are exactly 2 tiles, the maximum we ever require.
  b.floor(0, 53, G - (0));                                   // top row 19
  b.floor(54, 70, G - 2);                                    // top row 17
  b.floor(71, 189, G - 4);                                   // top row 15 (base)
  b.floor(127, 189, G - 6);                                  // top row 13 (plateau and final run)

  // interior detail ledges — every one is exactly 2 tiles above its local
  // floor, so it is reachable with a plain jump and never blocks the route.
  b.plat(44, G - 2, 3);         // over the opening meadow   (19 -> 17)
  b.plat(66, G - 4, 3);         // terrace 1                 (17 -> 15)
  b.plat(87, G - 6, 3);         // high meadow               (15 -> 13)
  b.plat(104, G - 6, 3);        // hub                       (15 -> 13)
  b.plat(122, G - 6, 3);        // after the phase crossing  (15 -> 13)
  b.plat(148, G - 8, 4);        // plateau                   (13 -> 11)
  b.plat(166, G - 8, 4);        // final run               (13 -> 11)
  // Tall stash above the plateau run, reached only with the bounce pad.
  b.plat(141, G - 11, 4);

  // ── hidden alcove under the hub (Data Core 1) — carved after the ground ──
  b.carve(101, G - 3, 9, 5);    // pocket interior (rows G-3..G+1)
  b.floor(101, 109, G + 1);     // pocket floor
  b.set(104, G - 5, '=');       // one-way hatch in the hub surface
  b.set(105, G - 5, '=');
  b.plat(104, G - 5, 2);

  // ── pits: carved out of fully-laid ground, so both rims share a height and
  //    the hole reads as a hole rather than as a hole-shaped abyss. ─────────
  b.carve(93, G - 4, 4, 5);     // platform crossing (rows 15..19)
  b.spikes(93, 4, G);                                   // row 19
  b.carve(113, G - 4, 4, 5);    // phase crossing
  b.spikes(113, 4, G);
  b.carve(152, G - 6, 4, 6);    // bounce-pad pit (rows 13..18)
  b.spikes(152, 4, G);                                  // row 19 — under the pad
  b.carve(178, G - 6, 5, 5);    // last hazard pit
  b.spikes(178, 5, G - 1);                              // row 18

  b.carve(31, G, 3, 5);         // the opening 3-tile gap (rows 19..23)
  b.spikes(31, 3, G + 4);

  // ── phase blocks bridging the second pit at rim height ──────────────────
  b.phase(114, G - 4, 2);

  return {
    id: 1,
    name: 'SIGNAL MEADOW',
    theme: 'meadow',
    songMood: 0,
    width: W,
    height: H,
    spawn: { x: 6 * T, y: G * T },
    goal: { x: 183 * T, y: (G - 6) * T - 5 * T, w: 40, h: 5 * T },
    tiles: b.toTiles(),

    bits: (() => {
      const out = [];
      const push = (tx, ty) => out.push({ x: tx * T + 8, y: ty * T + 8 });
      // Section 1 — opening meadow, top row 19.
      for (let x = 8; x <= 29; x += 3) push(x, G - 1);
      // Natural arc over the first gap (swinging up into the jump apex).
      push(31, G - 2); push(32, G - 3); push(33, G - 2);
      push(36, G - 1); push(40, G - 1);
      push(44, G - 3);                       // above the first ledge
      push(47, G - 1); push(50, G - 1);
      // Rising onto terrace 1 (top 17).
      push(54, G - 3); push(57, G - 3); push(62, G - 3);
      push(66, G - 5); push(69, G - 3);
      // Rising onto the high meadow (top 15), then the lane along it.
      push(72, G - 5); push(75, G - 5);
      for (let x = 79; x <= 91; x += 4) push(x, G - 5);
      push(87, G - 7); push(88, G - 7);      // on the high ledge
      // Across the chasm (the platform ride).
      push(93, G - 6); push(95, G - 6);
      // Hub ring (top 15).
      push(99, G - 5); push(103, G - 5); push(107, G - 5); push(110, G - 5);
      // Hidden alcove reward line (pocket floor is row G+1).
      push(102, G); push(105, G); push(108, G);
      // Phase crossing (rows just above the rim).
      push(113, G - 6); push(116, G - 6);
      // Onto the plateau (top 13).
      push(119, G - 7); push(123, G - 7);
      push(128, G - 7); push(131, G - 7); push(134, G - 7);
      for (let x = 137; x <= 150; x += 3) push(x, G - 7);
      push(148, G - 9);                       // on the plateau ledge
      // The secret stash over the plateau, only reachable via the pad.
      for (let x = 140; x <= 145; x++) push(x, G - 12);
      // Over the pad pit (the pad itself is at row G-1).
      push(152, G - 8); push(154, G - 8);
      // Final run (top 13).
      for (let x = 157; x <= 176; x += 3) push(x, G - 7);
      push(166, G - 9);                       // on the final ledge
      // Tower approach.
      push(178, G - 8); push(180, G - 8);
      push(184, G - 8); push(187, G - 8);
      return out;
    })(),

    cores: [
      { x: 105 * T + 8, y: (G + 1) * T - 8 },  // 1 — hidden alcove under the hub
      { x: 148 * T, y: (G - 8) * T - 8 },      // 2 — top of the plateau ledge
      { x: 87 * T, y: (G - 6) * T - 8 },       // 3 — optional ledge in the meadow
    ],

    checkpoints: [
      { x: 80 * T + 8, y: (G - 4) * T },
      { x: 139 * T + 8, y: (G - 6) * T },
    ],

    platforms: [
      // Crosses the 4-tile chasm at 93..96; the top sits flush with the rim.
      { kind: PLATFORM_KINDS.MOVE_H, x: 92 * T, y: (G - 4) * T - 6, w: 48, h: 8, speed: 26, range: 64 },
      // Vertical lift beside the plateau — an optional shortcut to the ledge.
      { kind: PLATFORM_KINDS.MOVE_V, x: 122 * T, y: (G - 6) * T, w: 40, h: 8, speed: 22, range: 64, axis: 'y' },
      // Sits in the pit before the plateau: miss the jump and it throws you
      // back out instead of killing you. A mercy pad, on purpose.
      { kind: PLATFORM_KINDS.BOUNCE, x: 153 * T, y: (G - 1) * T - 2, w: 32, h: 8, power: 430 },
      // On the plateau: launches into the tall mast stash above the run.
      { kind: PLATFORM_KINDS.BOUNCE, x: 141 * T, y: (G - 6) * T - 10, w: 24, h: 8, power: 430 },
    ],

    enemies: [
      { type: 'hopper', x: 22 * T, y: (G - 1) * T, dir: -1 },
      { type: 'bug', x: 40 * T, y: (G - 1) * T, dir: -1 },
      { type: 'hopper', x: 60 * T, y: (G - 3) * T, dir: 1 },
      { type: 'bug', x: 66 * T, y: (G - 3) * T, dir: -1 },
      { type: 'hopper', x: 84 * T, y: (G - 5) * T, dir: 1 },
      { type: 'drone', x: 99 * T, y: (G - 8) * T, range: 56, speed: 28, axis: 'x' },
      { type: 'hopper', x: 109 * T, y: (G - 5) * T, dir: -1 },
      { type: 'bug', x: 132 * T, y: (G - 7) * T, dir: -1 },
      { type: 'hopper', x: 145 * T, y: (G - 7) * T, dir: 1 },
      { type: 'bug', x: 170 * T, y: (G - 7) * T, dir: -1 },
      { type: 'hopper', x: 186 * T, y: (G - 7) * T, dir: 1 },
    ],

    hazards: [],

    secrets: [
      { name: 'HOLLOW ROOT', x: 105 * T + 8, y: (G + 1) * T - 8 },
      { name: 'MAST LIGHT', x: 87 * T, y: (G - 6) * T - 8 },
      { name: 'PLATEAU STASH', x: 141 * T, y: (G - 11) * T - 6 },
    ],

    decor: (() => {
      const d = [];
      // Local walkable top row for each authored section — decor is always
      // snapped to real ground so props never float or clip into terrain.
      const topAt = (x) => {
        if (x <= 53) return G;
        if (x <= 70) return G - 2;
        if (x <= 126) return G - 4;
        return G - 6;
      };
      for (const t of [4, 14, 26, 38, 48, 64, 74, 82, 90, 100, 111, 119, 130, 141, 149, 158, 168, 175, 185]) {
        d.push({ kind: 'tree', x: t * T, y: topAt(t) * T - 40 });
      }
      for (const t of [9, 19, 30, 43, 52, 68, 79, 96, 108, 116, 125, 136, 146, 161, 172, 183]) {
        d.push({ kind: 'bush', x: t * T, y: topAt(t) * T - 14 });
      }
      for (const t of [16, 61, 104, 143, 180]) {
        d.push({ kind: 'pylon', x: t * T, y: topAt(t) * T - 46 });
      }
      return d;
    })(),

    lore: 'SIGNAL MEADOW — three masts dark. Another courier never came back.',
  };
})();

// ───────────────────────────────────────────────────────────────────────────
//  LEVEL 2 — CIRCUIT CAVERNS
//
//  Teaches: falling platforms, bounce pads, vertical traversal, drones, and an
//  enclosed hidden room. Difficulty: medium.
//
//  Geology note: unlike the meadow (which is open sky over flat ground), the
//  caverns are built by filling the map with solid rock and then CARVING the
//  tunnels out of it. That is the only way to get true underground rooms — a
//  room has to be enclosed by rock above it, and "floor + carve" can never
//  produce a ceiling. It also means every wall the player sees is real rock,
//  so the cave reads as terrain rather than as floating platforms.
//
//  The three chambers descend: entry gallery (row 12), wide cavern (row 22),
//  bottom gallery (row 32). Each drop is split into 2-row steps so nothing in
//  the route exceeds the jump budget.
//
//  Route map:
//     cols   0..30   entry gallery (corridor)                    [row 12]
//     step  31..40   stair down one step                          [row 14]
//     step  41..50   stair down to the cavern floor               [row 22]
//     cols  51..104  wide cavern, energy pit, falling plates      [row 22]
//     room  56..70   ANODE CHAMBER above the shelf (Core 1)       [row 17]
//     shaft 105..120 bounce pad up to the shaft ledge             [row 18]
//     plunge         off the shaft ledge down to the gallery      [row 32]
//     cols 121..168  bottom gallery, laser gates                  [row 32]
//     cols 169..193  tower plateau, two 2-row steps up            [row 30]
// ───────────────────────────────────────────────────────────────────────────
export const LEVEL_2 = (() => {
  const W = 194, H = 42;
  const b = new Builder(W, H);
  const C1 = 12;   // chamber 1 floor
  const C2 = 22;   // chamber 2 floor
  const C3 = 32;   // chamber 3 floor

  // ── fill, then carve ────────────────────────────────────────────────────
  b.block(0, 0, W, H);                          // solid rock everywhere

  // Chamber 1 — corridor with 6 rows of headroom over the floor at row 12.
  b.carve(0, C1 - 6, 31, 6);
  // Cascading descent: every step down is a 4-row drop, which costs nothing
  // (falling is free) and reads as a staircase into the dark.
  b.carve(31, C1 - 2, 10, 4);                   // floor row 14
  b.carve(41, C2 - 10, 10, 6);                  // floor row 18
  b.carve(51, C2 - 6, 54, 6);                   // the wide cavern, floor row 22

  // ANODE ALCOVE (Core 1) — a dead-end side branch that leaves the cavern
  // floor heading back the way you came. It is 30 tiles long, so it is only
  // found by exploring rather than by following the light.
  b.carve(22, C2 - 6, 30, 6);                   // corridor, floor row 22
  b.carve(22, C2 - 9, 8, 3);                    // taller chamber at the far end
  b.carve(24, C2 - 7, 4, 1);                    // overhang detail
  b.block(24, C2 - 7, 2, 1);                    // (re-seat the detail as rock)

  // Cavern bench, 2 rows up, along the left half of the cavern.
  b.carve(56, C2 - 8, 14, 6);                   // cols 56..69, floor row 20

  // Shaft staircase out of the cavern. Two 2-row benches; the bounce pad on
  // the cavern floor is the fast way up, the benches the safe way.
  b.carve(105, C2 - 6, 16, 6);                  // shaft volume, floor row 22
  b.carve(107, C2 - 8, 14, 6);                  // bench A, floor row 20
  b.carve(110, C2 - 10, 11, 8);                 // bench B, floor row 18

  // Bottom gallery — deep, long, and dark. Reached by walking off bench B.
  b.carve(121, C3 - 7, 48, 7);                  // cols 121..168, floor row 32
  b.carve(138, C3 - 11, 15, 9);                 // gallery shelf, floor row 30

  // Final plateau: two 2-row steps up out of the gallery, with headroom.
  b.carve(169, C3 - 8, 25, 6);                  // headroom rows 24..29
  b.carve(169, C3 - 1, 25, 1);                  // step: floor row 31
  b.carve(172, C3 - 2, 22, 1);                  // step: floor row 30

  // ── pits (carved last, out of the chamber floors) ───────────────────────
  b.carve(86, C2, 6, 4);                        // energy pit in the cavern
  b.spikes(86, 6, C2 + 3);
  b.carve(160, C3, 6, 5);                       // deep pit before the final climb
  b.spikes(160, 6, C3 + 4);

  // ── optional interior platforms ─────────────────────────────────────────
  b.plat(20, C1 - 3, 4);
  b.plat(96, C2 - 2, 3);                        // step up out of the cavern
  b.plat(101, C2 - 4, 3);                       // second step — Core 2 route
  b.plat(126, C3 - 5, 3);
  b.plat(176, C3 - 6, 3);

  return {
    id: 2,
    name: 'CIRCUIT CAVERNS',
    theme: 'cave',
    songMood: 1,
    width: W,
    height: H,
    spawn: { x: 5 * T, y: C1 * T },
    goal: { x: 186 * T, y: (C3 - 2) * T - 5 * T, w: 40, h: 5 * T },
    tiles: b.toTiles(),

    bits: (() => {
      const out = [];
      const push = (tx, ty) => out.push({ x: tx * T + 8, y: ty * T + 8 });
      // Entry gallery.
      for (let x = 6; x <= 18; x += 3) push(x, C1 - 1);
      push(21, C1 - 4); push(23, C1 - 4);          // on the one-way ledge
      for (let x = 25; x <= 29; x += 2) push(x, C1 - 1);
      // Descent.
      push(32, C1 + 1); push(35, C1 + 1); push(38, C1 + 1);
      push(43, C2 - 2); push(46, C2 - 1); push(49, C2 - 1);
      // Cavern floor and the bench at row 20.
      for (let x = 52; x <= 55; x += 2) push(x, C2 - 1);
      push(57, C2 - 3); push(60, C2 - 3); push(63, C2 - 3);
      push(66, C2 - 3); push(69, C2 - 3);
      // Anode alcove, back down the side branch.
      push(28, C2 - 1); push(26, C2 - 1); push(24, C2 - 2);
      // Over the energy pit, following the falling plates.
      push(85, C2 - 2); push(87, C2 - 3); push(89, C2 - 4); push(91, C2 - 3); push(93, C2 - 2);
      // Climb plates past the pit (Core 2 route).
      push(96, C2 - 3); push(101, C2 - 5); push(104, C2 - 5);
      // Shaft benches, then the gallery.
      push(106, C2 - 1); push(109, C2 - 4); push(113, C2 - 3); push(118, C2 - 3);
      for (let x = 123; x <= 136; x += 3) push(x, C3 - 1);
      push(127, C3 - 6);
      // Gallery shelf.
      push(139, C3 - 3); push(143, C3 - 3); push(147, C3 - 3); push(151, C3 - 3);
      push(158, C3 - 2);
      // Over the deep pit, following the lift.
      push(160, C3 - 2); push(162, C3 - 3); push(164, C3 - 3); push(166, C3 - 2);
      // Final plateau.
      for (let x = 171; x <= 185; x += 3) push(x, C3 - 3);
      push(176, C3 - 7);
      return out;
    })(),

    cores: [
      { x: 25 * T + 8, y: (C2 - 1) * T },      // 1 — ANODE ALCOVE
      { x: 101 * T + 8, y: (C2 - 5) * T },     // 2 — high plates past the pit
      { x: 176 * T, y: (C3 - 7) * T },         // 3 — above the tower plateau
    ],

    checkpoints: [
      { x: 52 * T + 8, y: C2 * T },
      { x: 123 * T + 8, y: C3 * T },
      { x: 172 * T + 8, y: (C3 - 2) * T },
    ],

    platforms: [
      // Falling plates over the energy pit — the intended crossing.
      { kind: PLATFORM_KINDS.FALL, x: 84 * T, y: (C2 - 1) * T, w: 40, h: 8, delay: 0.55 },
      { kind: PLATFORM_KINDS.FALL, x: 88 * T, y: (C2 - 1) * T, w: 40, h: 8, delay: 0.75 },
      // Bounce pad on the cavern floor at the mouth of the shaft: one hop and
      // it throws you up onto bench A/B, skipping two jumps. Clean headroom.
      { kind: PLATFORM_KINDS.BOUNCE, x: 104 * T, y: C2 * T - 10, w: 24, h: 8, power: 420 },
      { kind: PLATFORM_KINDS.MOVE_V, x: 118 * T, y: (C2 - 4) * T, w: 40, h: 8, speed: 22, range: 32, axis: 'y' },
      { kind: PLATFORM_KINDS.MOVE_H, x: 141 * T, y: (C3 - 3) * T, w: 48, h: 8, speed: 26, range: 56 },
      // Crosses the deep pit at 160..165 and rises to the plateau.
      { kind: PLATFORM_KINDS.MOVE_V, x: 164 * T, y: (C3 - 2) * T, w: 40, h: 8, speed: 22, range: 32, axis: 'y' },
      { kind: PLATFORM_KINDS.BOUNCE, x: 169 * T, y: (C3 - 2) * T - 10, w: 24, h: 8, power: 430 },
    ],

    enemies: [
      { type: 'hopper', x: 14 * T, y: (C1 - 1) * T, dir: -1 },
      { type: 'bug', x: 26 * T, y: (C1 - 1) * T, dir: -1 },
      { type: 'drone', x: 34 * T, y: (C1 + 1) * T, range: 48, speed: 26, axis: 'x' },
      { type: 'hopper', x: 45 * T, y: (C2 - 1) * T, dir: 1 },
      { type: 'bug', x: 54 * T, y: (C2 - 1) * T, dir: -1 },
      { type: 'drone', x: 64 * T, y: (C2 - 4) * T, range: 56, speed: 30, axis: 'x' },
      { type: 'hopper', x: 82 * T, y: (C2 - 1) * T, dir: 1 },
      { type: 'bug', x: 100 * T, y: (C2 - 1) * T, dir: -1 },
      { type: 'hopper', x: 96 * T, y: (C2 - 6) * T, dir: -1 },
      { type: 'drone', x: 130 * T, y: (C3 - 6) * T, range: 48, speed: 32, axis: 'y' },
      { type: 'bug', x: 142 * T, y: (C3 - 3) * T, dir: 1 },
      { type: 'hopper', x: 156 * T, y: (C3 - 1) * T, dir: -1 },
      { type: 'sentinel', x: 180 * T, y: (C3 - 4) * T, range: 48, speed: 24, axis: 'x' },
    ],

    hazards: [
      { type: 'laser', x: 24 * T, y: (C1 - 6) * T, w: 3 * T, h: 2, speed: 20, axis: 'v', range: 64 },
      { type: 'laser', x: 92 * T, y: (C2 - 6) * T, w: 3 * T, h: 2, speed: 24, axis: 'h', range: 40 },
      { type: 'laser', x: 146 * T, y: (C3 - 8) * T, w: 3 * T, h: 2, speed: 22, axis: 'v', range: 80 },
    ],

    secrets: [
      { name: 'ANODE ALCOVE', x: 25 * T + 8, y: (C2 - 1) * T },
      { name: 'SURVEY PLATES', x: 101 * T + 8, y: (C2 - 5) * T },
      { name: 'SKYHOLE', x: 176 * T, y: (C3 - 7) * T },
    ],

    decor: (() => {
      const d = [];
      // Local walkable top per column, so crystals always grow out of real
      // rock and stalactites hang from real ceilings.
      const topAt = (x) => {
        if (x <= 30) return C1;
        if (x <= 40) return C1 + 2;
        if (x <= 50) return C2;
        if (x >= 169) return C3 - 2;
        return C2;
      };
      for (const t of [4, 12, 19, 27, 36, 47, 55, 62, 74, 81, 90, 103, 110, 116, 125, 133, 141, 150, 157, 165, 180, 188]) {
        d.push({ kind: 'crystal', x: t * T, y: topAt(t) * T - 12 });
      }
      for (const t of [9, 22, 33, 44, 58, 70, 84, 98, 107, 121, 137, 152, 168, 178, 186]) {
        d.push({ kind: 'stalactite', x: t * T, y: (topAt(t) - 6) * T });
      }
      return d;
    })(),

    lore: 'CIRCUIT CAVERNS — the old grid still hums. Follow the cables down.',
  };
})();

// ───────────────────────────────────────────────────────────────────────────
//  LEVEL 3 — GLITCH TOWER
//
//  Teaches: lasers, phase blocks, faster enemies, dash-led traversal.
//  Difficulty: medium-hard. The tower rises in 2-row stages, so every climb is
//  a comfortable 2-tile step except where a moving platform or phase block is
//  the intended route.
//
//  Route map:
//     cols   0..20  stage 0                                           [row 26]
//     gap   21..22  2-tile gap
//     cols  23..44  stage 1 (2 rows up)  + moving platform detour     [row 24]
//     gap   45..46  2-tile gap
//     cols  47..70  stage 2 (2 rows up)  + falling platform detour    [row 22]
//     gap   71..72  2-tile gap
//     cols  73..96  stage 3 (2 rows up)                               [row 20]
//     gap   97..98  2-tile gap
//     cols  99..122 stage 4 (2 rows up)  + dash gap at the phase pit  [row 18]
//     cols 123..148 stage 4b (same height, phase platforms)           [row 18]
//     gap  149..150 2-tile gap
//     cols 151..189 stage 5 (3 rows up — reached by moving platform)  [row 15]
// ───────────────────────────────────────────────────────────────────────────
export const LEVEL_3 = (() => {
  const W = 190, H = 34;
  const b = new Builder(W, H);
  const S0 = 26, S1 = 24, S2 = 22, S3 = 20, S4 = 18, S5 = 15;

  // ── ground pass ─────────────────────────────────────────────────────────
  b.floor(0, 20, S0);           // stage 0
  b.floor(23, 44, S1);          // stage 1
  b.floor(47, 70, S2);          // stage 2
  b.floor(73, 96, S3);          // stage 3
  b.floor(99, 122, S4);         // stage 4
  b.floor(123, 148, S4);        // stage 4b — reached over phase blocks
  // The crown is reached in two gentle steps, so no single climb is taller
  // than the jump budget even if the lift is missed.
  b.floor(151, 158, S4 - 1);    // step 1: one row up (row 17)
  b.floor(159, 189, S5);        // step 2: two rows up (row 15)

  // interior ledges: always 2 rows above their stage floor, off the main line
  b.floor(28, 34, S1 - 2);
  b.floor(52, 58, S2 - 2);
  b.floor(78, 84, S3 - 2);
  b.floor(104, 110, S4 - 2);
  b.floor(128, 134, S4 - 2);
  b.plat(38, S1 - 4, 3);
  b.plat(62, S2 - 4, 3);
  b.plat(88, S3 - 4, 3);
  b.plat(114, S4 - 4, 3);
  b.plat(140, S4 - 4, 3);
  b.plat(166, S5 - 3, 3);
  // One-way ledge over the last chasm — reachable only from the crown pad,
  // and it holds the third Data Core.
  b.plat(160, S5 - 3, 4);
  b.plat(178, S5 - 3, 3);

  // ── pits (carved last; both rims keep their height) ─────────────────────
  b.carve(8, S0, 4, 4);
  b.spikes(8, 4, S0 + 3);
  b.carve(30, S1, 4, 4);
  b.spikes(30, 4, S1 + 3);
  b.carve(54, S2, 4, 4);
  b.spikes(54, 4, S2 + 3);
  b.carve(80, S3, 4, 4);
  b.spikes(80, 4, S3 + 3);
  b.carve(106, S4, 4, 4);
  b.spikes(106, 4, S4 + 3);
  b.carve(130, S4, 4, 5);
  b.spikes(130, 4, S4 + 4);
  b.carve(160, S5, 6, 5);       // the last chasm
  b.spikes(160, 6, S5 + 4);

  // ── phase blocks: the route across the stage-4b gap ─────────────────────
  b.phase(120, S4 + 1, 2);
  b.phase(126, S4 + 1, 2);

  return {
    id: 3,
    name: 'GLITCH TOWER',
    theme: 'tower',
    songMood: 2,
    width: W,
    height: H,
    spawn: { x: 4 * T, y: S0 * T },
    goal: { x: 183 * T, y: S5 * T - 5 * T, w: 40, h: 5 * T },
    tiles: b.toTiles(),

    bits: (() => {
      const out = [];
      const push = (tx, ty) => out.push({ x: tx * T + 8, y: ty * T + 8 });
      // Stage 0 + its dip.
      for (let x = 3; x <= 7; x++) push(x, S0 - 1);
      push(8, S0 - 3); push(10, S0 - 4); push(12, S0 - 3);
      for (let x = 14; x <= 19; x += 2) push(x, S0 - 1);
      // Stage 1.
      for (let x = 24; x <= 29; x += 2) push(x, S1 - 1);
      push(30, S1 - 3); push(32, S1 - 4); push(34, S1 - 3);
      push(36, S1 - 1); push(39, S1 - 5); push(42, S1 - 1);
      // Stage 2.
      for (let x = 48; x <= 53; x += 2) push(x, S2 - 1);
      push(54, S2 - 3); push(56, S2 - 4); push(58, S2 - 3);
      push(60, S2 - 1); push(63, S2 - 5); push(66, S2 - 1); push(69, S2 - 1);
      // Stage 3.
      for (let x = 74; x <= 79; x += 2) push(x, S3 - 1);
      push(80, S3 - 3); push(82, S3 - 4); push(84, S3 - 3);
      push(86, S3 - 1); push(89, S3 - 5); push(92, S3 - 1); push(95, S3 - 1);
      // Stage 4.
      for (let x = 100; x <= 105; x += 2) push(x, S4 - 1);
      push(106, S4 - 3); push(108, S4 - 4); push(110, S4 - 3);
      push(112, S4 - 1); push(115, S4 - 3); push(118, S4 - 1);
      push(106, S4 - 3); push(108, S4 - 3);      // on the stage-4 ledge
      // Phase crossing.
      push(120, S4 - 2); push(123, S4 - 1); push(126, S4 - 2);
      push(129, S4 - 1); push(130, S4 - 4); push(132, S4 - 4);
      push(135, S4 - 1); push(138, S4 - 1); push(141, S4 - 5);
      push(144, S4 - 1); push(147, S4 - 1);
      // Crown.
      push(152, S5 - 2); push(155, S5 - 3); push(158, S5 - 2);
      push(160, S5 - 2); push(163, S5 - 2); push(166, S5 - 2); push(169, S5 - 2);
      push(161, S5 - 4); push(162, S5 - 4);      // on the chasm ledge
      push(166, S5 - 4);                        // on the crown ledge
      for (let x = 172; x <= 182; x += 2) push(x, S5 - 3);
      push(178, S5 - 4);
      push(184, S5 - 2); push(186, S5 - 2);
      return out;
    })(),

    cores: [
      { x: 34 * T, y: (S1 - 4) * T },          // 1 — high ledge over stage 1
      { x: 108 * T, y: (S4 - 4) * T },         // 2 — on the stage-4 high ledge
      { x: 161 * T, y: (S5 - 4) * T },         // 3 — chasm ledge, crown pad only
    ],

    checkpoints: [
      { x: 48 * T + 8, y: S2 * T },
      { x: 100 * T + 8, y: S4 * T },
      { x: 152 * T + 8, y: S5 * T },
    ],

    platforms: [
      // Climbs from the stage-0 rim over the 2-tile gap onto stage 1.
      { kind: PLATFORM_KINDS.MOVE_H, x: 20 * T, y: S1 * T - 8, w: 40, h: 8, speed: 30, range: 40 },
      { kind: PLATFORM_KINDS.MOVE_V, x: 45 * T, y: (S2 - 2) * T, w: 40, h: 8, speed: 26, range: 64, axis: 'y' },
      { kind: PLATFORM_KINDS.FALL, x: 71 * T, y: (S3 - 1) * T, w: 40, h: 8, delay: 0.6 },
      // Hovers two tiles over the stage-3 rim and carries you across the gap
      // at 97..98 onto stage 4.
      { kind: PLATFORM_KINDS.MOVE_H, x: 97 * T, y: (S3 - 2) * T, w: 40, h: 8, speed: 34, range: 32 },
      // The crown lift: boards flush with the stage-4 rim, rises to stage 5.
      { kind: PLATFORM_KINDS.MOVE_V, x: 149 * T, y: (S4 - 3) * T, w: 40, h: 8, speed: 24, range: 48, axis: 'y' },
      { kind: PLATFORM_KINDS.BOUNCE, x: 135 * T, y: S4 * T - 10, w: 24, h: 8, power: 430 },
      // On the crown approach, before the last chasm.
      { kind: PLATFORM_KINDS.BOUNCE, x: 156 * T, y: (S4 - 1) * T - 10, w: 24, h: 8, power: 430 },
    ],

    enemies: [
      { type: 'bug', x: 14 * T, y: (S0 - 1) * T, dir: -1, speed: 52, chargeSpeed: 190 },
      { type: 'hopper', x: 26 * T, y: (S1 - 1) * T, dir: 1, speed: 44 },
      { type: 'drone', x: 31 * T, y: (S1 - 7) * T, range: 40, speed: 34, axis: 'x' },
      { type: 'bug', x: 40 * T, y: (S1 - 1) * T, dir: -1, speed: 52, chargeSpeed: 190 },
      { type: 'hopper', x: 50 * T, y: (S2 - 1) * T, dir: 1, speed: 44 },
      { type: 'drone', x: 60 * T, y: (S2 - 6) * T, range: 48, speed: 36, axis: 'y' },
      { type: 'bug', x: 68 * T, y: (S2 - 1) * T, dir: -1, speed: 52, chargeSpeed: 190 },
      { type: 'hopper', x: 76 * T, y: (S3 - 1) * T, dir: 1, speed: 44 },
      { type: 'sentinel', x: 86 * T, y: (S3 - 3) * T, range: 40, speed: 28, axis: 'x' },
      { type: 'bug', x: 94 * T, y: (S3 - 1) * T, dir: -1, speed: 52, chargeSpeed: 190 },
      { type: 'hopper', x: 102 * T, y: (S4 - 1) * T, dir: 1, speed: 44 },
      { type: 'drone', x: 112 * T, y: (S4 - 6) * T, range: 48, speed: 38, axis: 'y' },
      { type: 'bug', x: 126 * T, y: (S4 - 1) * T, dir: -1, speed: 52, chargeSpeed: 190 },
      { type: 'sentinel', x: 138 * T, y: (S4 - 3) * T, range: 40, speed: 28, axis: 'x' },
      { type: 'bug', x: 174 * T, y: (S5 - 1) * T, dir: -1, speed: 52, chargeSpeed: 190 },
      { type: 'drone', x: 180 * T, y: (S5 - 6) * T, range: 32, speed: 40, axis: 'x' },
    ],

    hazards: [
      { type: 'laser', x: 16 * T, y: (S0 - 8) * T, w: 3 * T, h: 2, speed: 26, axis: 'h', range: 40 },
      { type: 'laser', x: 24 * T, y: (S1 - 8) * T, w: 3 * T, h: 2, speed: 30, axis: 'v', range: 80 },
      { type: 'laser', x: 48 * T, y: (S2 - 7) * T, w: 3 * T, h: 2, speed: 26, axis: 'h', range: 48 },
      { type: 'laser', x: 74 * T, y: (S3 - 7) * T, w: 3 * T, h: 2, speed: 32, axis: 'v', range: 64 },
      { type: 'laser', x: 100 * T, y: (S4 - 7) * T, w: 3 * T, h: 2, speed: 30, axis: 'h', range: 48 },
      { type: 'laser', x: 124 * T, y: (S4 - 7) * T, w: 3 * T, h: 2, speed: 34, axis: 'v', range: 72 },
      { type: 'laser', x: 152 * T, y: (S5 - 7) * T, w: 3 * T, h: 2, speed: 32, axis: 'h', range: 48 },
      { type: 'laser', x: 170 * T, y: (S5 - 7) * T, w: 3 * T, h: 2, speed: 36, axis: 'v', range: 64 },
    ],

    secrets: [
      { name: 'ODD COLUMN', x: 34 * T, y: (S1 - 4) * T },
      { name: 'BLIND SPOT', x: 108 * T, y: (S4 - 4) * T },
      { name: 'CROWN EDGE', x: 161 * T, y: (S5 - 4) * T },
    ],

    decor: (() => {
      const d = [];
      for (const x of [4, 11, 18, 25, 33, 40, 49, 57, 65, 74, 82, 90, 100, 108, 117, 126, 134, 143, 152, 160, 168, 176, 184]) {
        d.push({ kind: 'crystal', x: x * T, y: (S0 - 2) * T });
        d.push({ kind: 'crystal', x: x * T + 6, y: (S2 - 2) * T });
        d.push({ kind: 'crystal', x: x * T - 5, y: (S4 - 2) * T });
        d.push({ kind: 'stalactite', x: x * T + 3, y: 0 });
      }
      return d;
    })(),

    lore: 'GLITCH TOWER — the source. Brace for interference.',
  };
})();

export const LEVELS = [LEVEL_1, LEVEL_2, LEVEL_3];

const BY_ID = new Map(LEVELS.map((l) => [l.id, l]));

/** Fetch a level's static data by id (1-based). Clamps to the valid range. */
export function getLevelData(id) {
  const lid = id < 1 ? 1 : id > LEVELS.length ? LEVELS.length : Math.round(id);
  return BY_ID.get(lid) || LEVELS[0];
}
