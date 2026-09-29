// Level definitions. Each level is hand-authored as a list of entity
// placements over a tile grid. Coordinates are in pixels; tile size 16.
//
// Tile codes in rows:  x solid, g grass-top, c cave, m metal
// Entity codes (in `entities`): [type, tileX, tileY, a, b, c]
//   o signal bit      * data core (rare, 3 per level)
//   h glitch hopper   d static drone (a=rangeX, b=rangeY, c=period)
//   b corrupt bug
//   s spikes(a=count) E energy pit(a=count)
//   L laser horiz (a=lenTiles,b=period,c=offset)  I laser vertical
//   M moving platf (a=travelX,b=travelY,c=period)  V vertical mover
//   f falling platf   p phase platf (a=period,b=offset,c=onFrac)
//   B bounce pad      # checkpoint   T signal tower
//   secret [x,y,wTiles,hTiles] discovery zone

export const TILE = 16;

// ---------------- Level 1: SIGNAL MEADOW ----------------
// Teaching level: run, jump, bits, hopper, checkpoint, moving platform.
const L1 = {
  name: 'SIGNAL MEADOW',
  width: 104,
  height: 17,
  spawn: { x: 48, y: 176 },
  bg: 'meadow',
  rows: [
    '.......................................................................................................',
    '.......................................................................................................',
    '.......................................................................................................',
    '..............o.o.o....................................................................................',
    '........................o.............................................................o..............',
    '....gg.........gggggg..........gggg..............................ggggg........................*....',
    '....gg...hh....gggggg....oo....gggg......gggg..........gggggg......gggg.....gggg.....gggg.....gggg...',
    'gggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggg',
    'gggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggg',
    'gggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggg',
    'gggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggg',
    'gggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggg',
    'gggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggg',
    'gggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggg',
    'gggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggg',
    'gggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggg',
    'gggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggg',
  ],
  entities: [
    // intro: bits on a ledge (jump for a reward)
    ['o', 14, 3], ['o', 16, 3], ['o', 18, 3],
    ['o', 24, 4],
    // first hopper on the flat stretch
    ['h', 12, 5],
    // small gap with spikes — teach hazard reading
    ['s', 30, 6, 2],
    ['o', 30, 4], ['o', 31, 4],
    // raised bit cluster (reward for jumping)
    ['o', 36, 4], ['o', 37, 4], ['o', 38, 4],
    // checkpoint
    ['#', 43, 5],
    // moving platform over a wide gap with spikes below
    ['M', 50, 5, 5, 0, 4.5],
    ['s', 52, 6, 3],
    // second hopper after checkpoint
    ['h', 60, 5],
    // drone floating over a platform
    ['d', 68, 3, 4, 0, 3],
    // bits along the high route
    ['o', 65, 4], ['o', 66, 4], ['o', 67, 4],
    // secret: hidden alcove under the final hill (data core 1)
    ['secret', 76, 12, 5, 3],
    ['*', 78, 11],
    // final stretch bits
    ['o', 84, 4], ['o', 85, 4],
    ['o', 92, 4],
    // tower on a firm foundation
    ['g', 94, 6], ['g', 95, 6], ['g', 96, 6], ['g', 97, 6],
    ['T', 94, 3],
  ],
  hint: 'A/D move  ·  SPACE jump  ·  SHIFT dash',
};

// ---------------- Level 2: CIRCUIT CAVERNS ----------------
// Vertical cave: falling platforms, bounce pads, drones, hidden room.
const L2 = {
  name: 'CIRCUIT CAVERNS',
  width: 76,
  height: 26,
  spawn: { x: 48, y: 48 },
  bg: 'cave',
  rows: [
    'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
    'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
    '..c.....c..............c.................................................c',
    '..c.....c..............c.................................................c',
    '..c.....c..............c.................................................c',
    '..c.....c..............c.................................................c',
    '..c.....c..............c.................................................c',
    '..c.....c..............c.................................................c',
    '..c.....c..............c.................................................c',
    '..c.....c..............c.................................................c',
    '..c.....c..............c.................................................c',
    '..c.....c..............c.................................................c',
    '..c.....c..............c.................................................c',
    '..c.....c..............c.................................................c',
    '..c.....c..............c.................................................c',
    '..c.....c..............c.................................................c',
    '..c.....c..............c.................................................c',
    '..c.....c..............c.................................................c',
    '..c.....c..............c.................................................c',
    '..c.....c..............c.................................................c',
    '..c.....c..............c.................................................c',
    '..c.....c..............c.................................................c',
    '..c.....c..............c.................................................c',
    '..c.....c..............c.................................................c',
    'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
    'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
  ],
  entities: [
    // spawn area on the surface
    ['o', 5, 1], ['o', 6, 1], ['o', 7, 1],
    // first drop via falling platforms
    ['f', 9, 5], ['f', 12, 7], ['f', 15, 9],
    ['o', 10, 4], ['o', 13, 6], ['o', 16, 8],
    // bounce pad down to the lower cavern
    ['B', 19, 11],
    ['o', 19, 9], ['o', 20, 9], ['o', 21, 9],
    // checkpoint in the cavern
    ['#', 25, 14],
    // drone patrol
    ['d', 31, 12, 5, 0, 3],
    ['o', 31, 13], ['o', 32, 13],
    // vertical moving platform ride
    ['V', 37, 10, 0, 6, 5],
    ['o', 37, 8], ['o', 38, 8],
    // spikes on the cavern floor
    ['s', 43, 24, 4],
    ['o', 43, 22], ['o', 44, 22], ['o', 45, 22], ['o', 46, 22],
    // hopper guarding the climb
    ['h', 49, 23],
    // second bounce pad to the high exit
    ['B', 53, 24],
    ['o', 53, 22],
    // falling platform staircase up
    ['f', 57, 20], ['f', 60, 18], ['f', 63, 16],
    ['o', 58, 19], ['o', 61, 17],
    // bug charger
    ['b', 67, 23],
    // hidden room in the right wall (data core 1)
    ['secret', 56, 16, 6, 4],
    ['c', 60, 16], ['c', 61, 16], ['c', 62, 16],
    ['c', 60, 17], ['c', 61, 17], ['c', 62, 17],
    ['c', 60, 18], ['c', 61, 18], ['c', 62, 18],
    ['c', 60, 19], ['c', 61, 19], ['c', 62, 19],
    ['*', 61, 18],
    ['o', 61, 17],
    // data core 2 on a high ledge
    ['c', 69, 14], ['c', 70, 14], ['c', 71, 14],
    ['*', 70, 13],
    ['o', 69, 13],
    // tower at the top right, on solid ground
    ['c', 66, 12], ['c', 67, 12], ['c', 68, 12], ['c', 69, 12], ['c', 70, 12], ['c', 71, 12],
    ['T', 67, 6],
  ],
  hint: 'Bounce pads launch you skyward',
};

// ---------------- Level 3: GLITCH TOWER ----------------
// Corrupted tower interior: lasers, phase blocks, dash gaps, fast enemies.
const L3 = {
  name: 'GLITCH TOWER',
  width: 84,
  height: 24,
  spawn: { x: 48, y: 64 },
  bg: 'glitch',
  rows: [
    'mmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm',
    'm..................................................................................m',
    'm..................................................................................m',
    'm..................................................................................m',
    'm..................................................................................m',
    'm..................................................................................m',
    'm..................................................................................m',
    'm..................................................................................m',
    'm..................................................................................m',
    'm..................................................................................m',
    'm..................................................................................m',
    'm..................................................................................m',
    'm..................................................................................m',
    'm..................................................................................m',
    'm..................................................................................m',
    'm..................................................................................m',
    'm..................................................................................m',
    'm..................................................................................m',
    'm..................................................................................m',
    'm..................................................................................m',
    'm..................................................................................m',
    'm..................................................................................m',
    'm..................................................................................m',
    'mmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm',
  ],
  entities: [
    // intro: bits + first laser timing
    ['o', 6, 21], ['o', 7, 21], ['o', 8, 21],
    ['L', 10, 19, 6, 1.4, 0.7],
    ['o', 12, 17], ['o', 13, 17],
    // phase block staircase
    ['p', 16, 20, 2.4, 0, 0.5],
    ['p', 18, 18, 2.4, 0.8, 0.5],
    ['p', 20, 16, 2.4, 1.6, 0.5],
    ['o', 16, 19], ['o', 18, 17], ['o', 20, 15],
    // checkpoint
    ['#', 24, 21],
    // dash gap with energy pit
    ['E', 27, 22, 5],
    ['o', 28, 20], ['o', 29, 20],
    // vertical lasers
    ['I', 33, 14, 6, 1.2, 0.6],
    ['I', 37, 14, 6, 1.2, 0.0],
    ['o', 35, 20],
    // bug charger pair
    ['b', 40, 21], ['b', 44, 21],
    // bounce pad over a laser
    ['B', 48, 21],
    ['L', 47, 17, 6, 1.0, 0.5],
    ['o', 48, 15], ['o', 49, 15],
    // secret room below (data core 1)
    ['secret', 52, 18, 6, 4],
    ['m', 54, 18], ['m', 55, 18], ['m', 56, 18], ['m', 57, 18],
    ['m', 54, 19], ['m', 57, 19],
    ['m', 54, 20], ['m', 55, 20], ['m', 56, 20], ['m', 57, 20],
    ['*', 56, 19],
    // moving platform crossing
    ['M', 60, 17, 5, 0, 4],
    ['I', 63, 12, 8, 1.0, 0.3],
    ['o', 62, 16], ['o', 63, 16],
    // data core 2 on high ledge
    ['m', 68, 12], ['m', 69, 12], ['m', 70, 12],
    ['*', 69, 11],
    // final climb: phase blocks + falling platform
    ['p', 70, 18, 2.2, 0, 0.55],
    ['p', 72, 16, 2.2, 0.7, 0.55],
    ['p', 74, 14, 2.2, 1.4, 0.55],
    ['f', 72, 20],
    ['h', 74, 21],
    // data core 3 near the tower
    ['m', 76, 8], ['m', 77, 8], ['m', 78, 8],
    ['*', 77, 7],
    // tower on a metal platform
    ['m', 72, 6], ['m', 73, 6], ['m', 74, 6], ['m', 75, 6], ['m', 76, 6], ['m', 77, 6], ['m', 78, 6],
    ['T', 74, 2],
  ],
  hint: 'Lasers pulse on a rhythm — time your runs',
};

export const LEVELS = [L1, L2, L3];
