// Level data: tile-based terrain maps + entity placement.
// Tile chars:
//   . empty          # solid block
//   ^ spikes         B bounce pad
//   P phase platform F falling platform
//   C checkpoint     T signal tower
//   S player spawn   b signal bit
//   D data core      H glitch hopper   R corrupt bug
//
// Maps are 96 wide x 24 tall. Row 23 = floor (carved into pits).
// Walk surface = y 736. Max jump height ~3.5 tiles (~112px), so a
// comfortable single-jump step is 2 tiles (64px); 3 tiles is tight.

export const TILE = 32;
const W = 96;      // map width in tiles
const H = 24;      // map height in tiles
const EMPTY = '.'.repeat(W);
const FLOOR = '#'.repeat(W);

// Build a map from a list of "placed" characters keyed by row.
function build(placed) {
  const grid = [];
  for (let y = 0; y < H; y++) grid[y] = y === H - 1 ? FLOOR.split('') : EMPTY.split('');
  for (const p of placed) {
    const { x, y, ch } = p;
    if (y >= 0 && y < H && x >= 0 && x < W) grid[y][x] = ch;
  }
  return grid.map(r => r.join(''));
}

// Helper: a horizontal run of a char.
function run(x, y, len, ch) {
  const arr = [];
  for (let i = 0; i < len; i++) arr.push({ x: x + i, y, ch });
  return arr;
}

// Carve pits (remove floor tiles) into the final map.
function carve(map, from, to) {
  const row = map[H - 1].split('');
  for (let x = from; x <= to; x++) row[x] = '.';
  map[H - 1] = row.join('');
}

// ===========================================================================
// LEVEL 1 — SIGNAL MEADOW (easy, teaches movement naturally)
// ===========================================================================
const L1 = build([
  ...run(2, 22, 1, 'S'),             // spawn
  ...run(5, 22, 4, 'b'),             // intro bits on ground
  ...run(12, 21, 3, '#'),            // low platform (hop)
  { x: 13, y: 20, ch: 'b' },
  ...run(18, 22, 3, '^'),            // first spike strip
  ...run(24, 21, 4, '#'),            // low platform
  { x: 25, y: 20, ch: 'b' },
  ...run(31, 22, 1, 'b'),
  ...run(35, 22, 2, '^'),            // spike strip
  ...run(40, 21, 3, '#'),            // platform
  { x: 41, y: 20, ch: 'b' },
  ...run(46, 22, 1, 'C'),            // checkpoint
  ...run(50, 21, 4, '#'),            // platform
  { x: 51, y: 20, ch: 'b' },
  ...run(57, 22, 2, '^'),            // spike strip
  ...run(62, 20, 4, '#'),            // higher platform (row 20)
  { x: 63, y: 19, ch: 'b' },
  ...run(69, 22, 1, 'b'),
  ...run(73, 21, 3, '#'),
  { x: 74, y: 20, ch: 'b' },
  ...run(79, 22, 2, '^'),
  ...run(84, 21, 3, '#'),
  { x: 85, y: 20, ch: 'b' },
  ...run(90, 22, 1, 'T'),            // signal tower

  // secret climb (up + left), breadcrumb bit at base
  { x: 21, y: 22, ch: 'b' },
  ...run(23, 21, 2, '#'),            // step 1 (row 21)
  ...run(20, 19, 2, '#'),            // step 2 (row 19)
  ...run(18, 17, 2, '#'),            // step 3 (row 17)
]);

// ===========================================================================
// LEVEL 2 — CIRCUIT CAVERNS (medium, falling + bounce + vertical)
// ===========================================================================
const L2 = build([
  ...run(2, 22, 1, 'S'),
  ...run(6, 22, 3, 'b'),
  ...run(12, 21, 3, '#'),            // low platform
  { x: 13, y: 20, ch: 'b' },
  ...run(18, 22, 1, 'b'),
  // pit at cols 24-33 crossed by falling platforms (entity)
  ...run(36, 22, 2, 'b'),
  ...run(41, 21, 3, '#'),            // platform after pit
  { x: 42, y: 20, ch: 'b' },
  ...run(47, 22, 1, 'C'),            // checkpoint
  ...run(50, 22, 1, 'b'),
  // bounce pad at 54 (entity) to clear spike wall at 58-60
  ...run(58, 22, 3, '^'),            // spike wall
  ...run(63, 22, 2, 'b'),
  ...run(68, 21, 3, '#'),
  { x: 69, y: 20, ch: 'b' },
  ...run(74, 22, 1, 'b'),
  ...run(78, 21, 3, '#'),
  { x: 79, y: 20, ch: 'b' },
  ...run(84, 22, 2, 'b'),
  ...run(90, 22, 1, 'T'),

  // vertical secret tower (right side, above platform area)
  ...run(70, 19, 2, '#'),            // step up from (68,21)
  ...run(72, 17, 2, '#'),
  ...run(70, 15, 2, '#'),            // high ledge
  // hidden climb (left)
  ...run(8, 21, 2, '#'),
  ...run(6, 19, 2, '#'),
  ...run(4, 17, 2, '#'),
]);
carve(L2, 24, 33);

// ===========================================================================
// LEVEL 3 — GLITCH TOWER (medium-hard, lasers + phase + dash)
// ===========================================================================
const L3 = build([
  ...run(2, 22, 1, 'S'),
  ...run(6, 22, 3, 'b'),
  ...run(12, 21, 3, '#'),
  { x: 13, y: 20, ch: 'b' },
  ...run(18, 22, 1, 'b'),
  // wide pit (28-43) crossed by phase platforms (entity)
  ...run(46, 22, 1, 'b'),
  ...run(50, 22, 2, 'b'),
  ...run(54, 21, 3, '#'),
  { x: 55, y: 20, ch: 'b' },
  ...run(58, 22, 1, 'b'),
  // dash pit (60-65, 6 wide)
  ...run(66, 22, 1, 'C'),            // checkpoint
  ...run(70, 22, 2, 'b'),
  ...run(76, 21, 3, '#'),
  { x: 77, y: 20, ch: 'b' },
  ...run(82, 22, 2, 'b'),
  ...run(88, 22, 1, 'b'),
  ...run(90, 22, 1, 'T'),

  // high dash/secret platform (up from (54,21))
  ...run(52, 19, 2, '#'),
  ...run(50, 17, 2, '#'),
  // secret climb (left, above spawn)
  ...run(8, 21, 2, '#'),
  ...run(6, 19, 2, '#'),
  ...run(4, 17, 2, '#'),
]);
carve(L3, 28, 43);
carve(L3, 60, 65);

function def(id, name, theme, map, sky, extra = {}) {
  return { id, name, theme, map: map.join('\n'), sky, ...extra };
}

export const LEVELS = [
  def(0, 'SIGNAL MEADOW', 'meadow', L1, ['#0d1220', '#1b2a4a', '#2a4a7f'], {
    enemies: [
      { x: 15, y: 22, type: 'hopper', patrol: 2 },
      { x: 42, y: 22, type: 'hopper', patrol: 2 },
      { x: 53, y: 22, type: 'bug', patrol: 3 },
      { x: 76, y: 22, type: 'hopper', patrol: 2 },
    ],
    drones: [],
    lasers: [],
    platforms: [
      { x: 32, y: 21, type: 'horizontal', range: 2, speed: 50, w: 3 },
    ],
    bits: [
      { x: 23, y: 19 },
      { x: 41, y: 18 },
    ],
    cores: [
      { x: 18, y: 16 },   // top of secret climb
      { x: 63, y: 18 },   // above high platform (62,20)
      { x: 85, y: 18 },   // above platform (84,21)
    ],
  }),
  def(1, 'CIRCUIT CAVERNS', 'cavern', L2, ['#070912', '#101828', '#1d2a45'], {
    enemies: [
      { x: 14, y: 22, type: 'bug', patrol: 3 },
      { x: 38, y: 22, type: 'hopper', patrol: 2 },
      { x: 76, y: 22, type: 'bug', patrol: 3 },
    ],
    drones: [
      { x: 44, y: 11, range: 3, axis: 'v', speed: 70 },
      { x: 72, y: 9, range: 3, axis: 'h', speed: 65 },
    ],
    lasers: [],
    platforms: [
      { x: 45, y: 19, type: 'vertical', range: 2, speed: 45, w: 3 },
    ],
    fallings: [
      { x: 24, y: 21, w: 2 },
      { x: 28, y: 21, w: 2 },
      { x: 32, y: 21, w: 2 },
    ],
    bounces: [
      { x: 54, y: 22 },
    ],
    cores: [
      { x: 4, y: 16 },    // top of left hidden climb
      { x: 70, y: 14 },   // top of vertical secret tower
      { x: 13, y: 19 },   // above low platform (12,21)
    ],
  }),
  def(2, 'GLITCH TOWER', 'tower', L3, ['#0a0a18', '#201438', '#3a1e5e'], {
    enemies: [
      { x: 14, y: 22, type: 'bug', patrol: 3 },
      { x: 50, y: 22, type: 'hopper', patrol: 2 },
      { x: 55, y: 22, type: 'hopper', patrol: 2 },
      { x: 76, y: 22, type: 'bug', patrol: 3 },
    ],
    drones: [
      { x: 35, y: 18, range: 2, axis: 'v', speed: 70 },
      { x: 72, y: 19, range: 2, axis: 'h', speed: 70 },
    ],
    lasers: [
      { x: 74, y: 22, len: 3, dir: 'h', period: 2.2 },
      { x: 86, y: 20, len: 4, dir: 'v', period: 2.0 },
    ],
    platforms: [],
    phases: [
      { x: 30, y: 21, w: 2 },
      { x: 35, y: 21, w: 2 },
      { x: 40, y: 21, w: 2 },
    ],
    cores: [
      { x: 4, y: 16 },    // top of left secret climb
      { x: 50, y: 16 },   // top of dash/secret platform
      { x: 55, y: 19 },   // above platform (54,21)
    ],
  }),
];

export function getLevel(id) {
  return LEVELS[id] || LEVELS[0];
}
