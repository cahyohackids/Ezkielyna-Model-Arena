// sprites.js — procedural pixel art.
//
// All art is authored as compact string pixel-maps and baked once into
// offscreen canvases at a fixed "art pixel" scale. Baking (rather than
// drawing rects every frame) keeps the render loop cheap and guarantees
// perfectly crisp, consistent pixel sizes.
//
// Palette keys are single characters so the pixel maps stay readable.

export const PAL = {
  '.': null,            // transparent
  // --- PIP the courier robot ---
  'k': '#0c1424',       // outline / dark metal
  'K': '#16203a',       // darker plate
  'w': '#e8e2d0',       // cream body shell
  'W': '#f7f2e4',       // highlight cream
  'g': '#8894a8',       // mid grey metal
  'G': '#5d6a80',       // dark grey metal
  'c': '#4fe0cb',       // visor teal
  'C': '#9df5e6',       // visor highlight
  'o': '#f08a35',       // warm orange accent
  'O': '#ffc07a',       // light orange
  'b': '#3d6ea8',       // muted blue detail
  'r': '#e2564e',       // danger red
  'R': '#ff9a90',
  // --- enemies ---
  'p': '#a76fd6',       // glitch hopper purple
  'P': '#d7aef2',
  'y': '#f5c542',       // drone amber
  'Y': '#ffe08a',
  'm': '#c0424f',       // corrupt bug maroon
  'M': '#f07a72',
  'n': '#2f4a7a',       // steel blue
  'N': '#4a6ea8',
  // --- terrain / props ---
  'd': '#141d33',       // deep shadow
  't': '#26405e',       // tile blue top
  'T': '#3a5c80',       // tile blue light
  'u': '#1b2b45',       // tile body
  'U': '#2c4462',       // tile body light
  'h': '#3f7a52',       // meadow grass
  'H': '#69b374',       // meadow grass light
  'e': '#2b4f3c',       // meadow grass dark
  's': '#5a6b85',       // stone
  'S': '#8496ae',       // stone light
  'v': '#8b6f52',       // dirt
  'V': '#b08c68',       // dirt light
  'x': '#243b52',       // cave rock
  'X': '#33526f',       // cave rock light
  'i': '#1a2036',       // cave void
  'z': '#7a3f8f',       // glitch violet
  'Z': '#b06fd0',       // glitch bright violet
};

/** Parse a pixel map (array of equal-length strings) into {w,h,data}.
 *  Width is the max row length so minor authoring slips degrade gracefully. */
function parseMap(map) {
  const h = map.length;
  let w = 0;
  for (const r of map) if (r.length > w) w = r.length;
  return { w, h, map };
}

/**
 * Bake a pixel map into a canvas at `scale` (integer).
 * Returns a canvas whose CSS-pixel size is w*scale x h*scale.
 */
export function bake(map, scale = 1) {
  const { w, h } = parseMap(map);
  const c = document.createElement('canvas');
  c.width = w * scale;
  c.height = h * scale;
  const ctx = c.getContext('2d');
  for (let y = 0; y < h; y++) {
    const row = map[y];
    for (let x = 0; x < w; x++) {
      const ch = row[x];
      const col = PAL[ch];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }
  return c;
}

/** Bake with a horizontal flip applied. */
export function bakeFlipped(map, scale = 1) {
  const { w, h } = parseMap(map);
  const c = document.createElement('canvas');
  c.width = w * scale;
  c.height = h * scale;
  const ctx = c.getContext('2d');
  for (let y = 0; y < h; y++) {
    const row = map[y];
    for (let x = 0; x < w; x++) {
      const ch = row[x];
      const col = PAL[ch];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect((w - 1 - x) * scale, y * scale, scale, scale);
    }
  }
  return c;
}

/** Bake a pixel map tinted a single flat colour (used for silhouettes/variants). */
export function bakeTinted(map, scale, color) {
  const { w, h } = parseMap(map);
  const c = document.createElement('canvas');
  c.width = w * scale;
  c.height = h * scale;
  const ctx = c.getContext('2d');
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!PAL[map[y][x]]) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }
  return c;
}

// ═══════════════════════════════════════════════════════════════════════
//  PIP — the courier robot. 12x14 art pixels, origin at feet centre.
//  Silhouette rules: round head dome + visor, thin antenna, boxy torso,
//  backpack transmitter on the back, stubby legs.
// ═══════════════════════════════════════════════════════════════════════

// Idle frames (subtle antenna/body bob). 12 wide, 14 tall.
export const PIP_IDLE = [
  [ // 0
    '.....k......',
    '....kok.....',
    '...kkkkk....',
    '..kKKKKKk...',
    '.kwwwwwwwk..',
    'kwWWwwwwwwk.',
    'kwWWwwwwwwk.',
    'kwogkkkkggok',
    'kwogkcCCkggk',
    'kwogkkkkkkggk',
    '.kwwwwwwwwk.',
    '..kwwwwwwwk.',
    '...kkkkkkk..',
    '...gg...gg..',
  ],
  [ // 1 — antenna sways, body settles
    '....k.......',
    '...kok......',
    '...kkkkk....',
    '..kKKKKKk...',
    '.kwwwwwwwk..',
    'kwWWwwwwwwk.',
    'kwWWwwwwwwk.',
    'kwogkkkkggok',
    'kwogkcCCkggk',
    'kwogkkkkkkggk',
    '.kwwwwwwwwk.',
    '..kwwwwwwwk.',
    '...kkkkkkk..',
    '...gg...gg..',
  ],
  [ // 2 — breathing out
    '.....k......',
    '....kok.....',
    '...kkkkk....',
    '..kKKKKKk...',
    '.kwwwwwwwk..',
    'kwWWwwwwwwk.',
    'kwWWwwwwwwk.',
    'kwogkkkkggok',
    'kwogkcccKggk',
    'kwogkkkkkkggk',
    '.kwwwwwwwwk.',
    '..kwwwwwwwk.',
    '...kkkkkkk..',
    '..gg.....gg.',
  ],
];

// Run cycle — 6 frames. Legs alternate, body leans forward slightly.
export const PIP_RUN = [
  [ // 0 contact
    '......k.....',
    '.....kok....',
    '....kkkkk...',
    '...kKKKKKk..',
    '..kwwwwwwwk.',
    '.kwWWwwwwwwk',
    '.kwWWwwwwwwk',
    'kwogkkkkggok',
    'kwogkcCCkggk',
    'kwogkkkkkkggk',
    '.kwwwwwwwwk.',
    '..kwwwwwwwk.',
    '...kkkkkkk..',
    '..gg.....gg.',
  ],
  [ // 1 push
    '.....k......',
    '....kok.....',
    '....kkkkk...',
    '...kKKKKKk..',
    '..kwwwwwwwk.',
    '.kwWWwwwwwwk',
    '.kwWWwwwwwwk',
    'kwogkkkkggok',
    'kwogkcCCkggk',
    'kwogkkkkkkggk',
    '.kwwwwwwwwk.',
    '..kwwwwwwwk.',
    '...kkkkkkk..',
    '...gg....ggk',
  ],
  [ // 2 pass
    '.....k......',
    '....kok.....',
    '....kkkkk...',
    '...kKKKKKk..',
    '..kwwwwwwwk.',
    '.kwWWwwwwwwk',
    '.kwWWwwwwwwk',
    'kwogkkkkggok',
    'kwogkcCCkggk',
    'kwogkkkkkkggk',
    '.kwwwwwwwwk.',
    '..kwwwwwwwk.',
    '...kkkkkkk..',
    '....gg.gg...',
  ],
  [ // 3 contact (mirror)
    '.....k......',
    '....kok.....',
    '....kkkkk...',
    '...kKKKKKk..',
    '..kwwwwwwwk.',
    '.kwWWwwwwwwk',
    '.kwWWwwwwwwk',
    'kwogkkkkggok',
    'kwogkcCCkggk',
    'kwogkkkkkkggk',
    '.kwwwwwwwwk.',
    '..kwwwwwwwk.',
    '...kkkkkkk..',
    '..gg.....gg.',
  ],
  [ // 4 push
    '.....k......',
    '....kok.....',
    '....kkkkk...',
    '...kKKKKKk..',
    '..kwwwwwwwk.',
    '.kwWWwwwwwwk',
    '.kwWWwwwwwwk',
    'kwogkkkkggok',
    'kwogkcCCkggk',
    'kwogkkkkkkggk',
    '.kwwwwwwwwk.',
    '..kwwwwwwwk.',
    '...kkkkkkk..',
    'kgg....gg...',
  ],
  [ // 5 pass
    '.....k......',
    '....kok.....',
    '....kkkkk...',
    '...kKKKKKk..',
    '..kwwwwwwwk.',
    '.kwWWwwwwwwk',
    '.kwWWwwwwwwk',
    'kwogkkkkggok',
    'kwogkcCCkggk',
    'kwogkkkkkkggk',
    '.kwwwwwwwwk.',
    '..kwwwwwwwk.',
    '...kkkkkkk..',
    '....gg.gg...',
  ],
];

// Jump — arms/legs tucked, visor squints, body stretched slightly.
export const PIP_JUMP = [
  '.....k......',
  '....kok.....',
  '...kkkkk....',
  '..kKKKKKk...',
  '.kwwwwwwwk..',
  'kwWWwwwwwwk.',
  'kwWWwwwwwwk.',
  'kwogkkkkggok',
  'kwogkcccKggk',
  'kwogkkkkkkggk',
  '.kwwwwwwwwk.',
  '..kwwwwwwwk.',
  '...kkkkkkk..',
  '...gg..gg...',
];

// Fall — legs splayed, arms out, visor wide.
export const PIP_FALL = [
  '.....k......',
  '....kok.....',
  '...kkkkk....',
  '..kKKKKKk...',
  '.kwwwwwwwk..',
  'kwWWwwwwwwk.',
  'kwWWwwwwwwk.',
  'kwogkkkkggok',
  'kwogkcCCkggk',
  'kwogkkkkkkggk',
  '.kwwwwwwwwk.',
  '..kwwwwwwwk.',
  '...kkkkkkk..',
  '.gg.......gg',
];

// Dash — body pitched forward, compact, thruster flare at back.
export const PIP_DASH = [
  '........k...',
  '.......kok..',
  '....kkkkk...',
  '...kKKKKKk..',
  '..kwwwwwwwk.',
  '.kwWWwwwwwwk',
  'OkwWWwwwwwwk',
  'OOkkkkkkkggk',
  'OOkcccCCkggk',
  '.kwkkkkkkggk',
  '..kwwwwwwwk.',
  '...kkkkkkk..',
  '...gggg.....',
  '..gg........',
];

// Hurt — recoil, visor flickers to red-ish set via tint at runtime.
export const PIP_HURT = [
  '.....k......',
  '....kok.....',
  '...kkkkk....',
  '..kKKKKKk...',
  '.kwwwwwwwk..',
  'kwWWwwwwwwk.',
  'kwWWwwwwwwk.',
  'kwogkkkkggok',
  'kwogkrrrkggk',
  'kwogkkkkkkggk',
  '.kwwwwwwwwk.',
  '..kwwwwwwwk.',
  '...kkkkkkk..',
  '..gg.....gg.',
];

// Death — pieces coming apart (4 frames) then nothing.
export const PIP_DEATH = [
  [
    '.....k......',
    '....kok.....',
    '...kkkkk....',
    '..kKKKKKk...',
    '.kwwwwwwwk..',
    'kwWWwwwwwwk.',
    'kwWWwwwwwwk.',
    'kwogkkkkggok',
    'kwogkRRRkggk',
    'kwogkkkkkkggk',
    '.kwwwwwwwwk.',
    '..kwwwwwwwk.',
    '...kkkkkkk..',
    '..gg.....gg.',
  ],
  [
    '............',
    '.....k......',
    '....kok.....',
    '...kkkkk....',
    '..kKKKKKk...',
    '.kwwwwwwwk..',
    'kwWWwwwwwwk.',
    'kwogkkkkggok',
    'kwogkRRRkggk',
    'kwogkkkkkkggk',
    '..kwwwwwwwk.',
    '...kkkkkkk..',
    '..gg.....gg.',
    '...gg...gg..',
  ],
  [
    '............',
    '............',
    '.....k......',
    '....kok.....',
    '...kkkkk....',
    '..kKKKKKk...',
    '.kwwwwwwwk..',
    '.kwogkkkkgok',
    '..kwkkkkkkk.',
    '...kwwwwwwwk',
    '...kkkkkkk..',
    '..gg.....gg.',
    '............',
    '............',
  ],
  [
    '............',
    '............',
    '......k.....',
    '.....kok....',
    '....kkkkk...',
    '...kKKKKKk..',
    '..kwwwwwwwk.',
    '...kwgkkkgwk',
    '...kwwwwwwwk',
    '....kkkkkk..',
    '...gg....gg.',
    '............',
    '............',
    '............',
  ],
];

// Victory — arms up, sparkles handled by particles.
export const PIP_VICTORY = [
  [
    'g...k......g',
    'g...kok....g',
    'g..kkkkk...g',
    '..kKKKKKk...',
    '.kwwwwwwwk..',
    'kwWWwwwwwwk.',
    'kwWWwwwwwwk.',
    'kwogkkkkggok',
    'kwogkcCCkggk',
    'kwogkkkkkkggk',
    '.kwwwwwwwwk.',
    '..kwwwwwwwk.',
    '...kkkkkkk..',
    '...gg...gg..',
  ],
  [
    '.....k......',
    '....kok.....',
    '.g.kkkkk...g',
    '.gkKKKKKk.g.',
    '.kwwwwwwwk..',
    'kwWWwwwwwwk.',
    'kwWWwwwwwwk.',
    'kwogkkkkggok',
    'kwogkcCCkggk',
    'kwogkkkkkkggk',
    '.kwwwwwwwwk.',
    '..kwwwwwwwk.',
    '...kkkkkkk..',
    '...gg...gg..',
  ],
];

// ═══════════════════════════════════════════════════════════════════════
//  ENEMIES
// ═══════════════════════════════════════════════════════════════════════

// Glitch Hopper — 12x10, blocky bug with scissor legs. Two frames.
export const HOPPER = [
  [
    '...kk..kk...',
    '..kppkkppk..',
    '.kppPPppppk.',
    'kpPPpppppppk',
    'kpPkkppkkppk',
    'kppzppppzppk',
    'kpppppppppkk',
    '.kppppppkk..',
    '..kkkkkk....',
    '.k.k..k.k...',
  ],
  [
    '............',
    '...kk..kk...',
    '..kppkkppk..',
    '.kppPPppppk.',
    'kpPPpppppppk',
    'kpPkkppkkppk',
    'kppzppppzppk',
    'kpppppppppkk',
    'k.kkkkkk..k.',
    '.k.k....k.k.',
  ],
];

// Static Drone — 14x10, floating eye-thruster with rotor glow.
export const DRONE = [
  [
    '..kkkkkkkkk...',
    '.kyyyyyyyyyk..',
    'kyYYyyyyyyyYk.',
    'kyykkkkkkkyyk.',
    'kyyknnkknnyyk.',
    'kyyknNNnnnkyk.',
    'kyyyyyyyyyyyk.',
    '.kyyyyyyyyyk..',
    '..kkkkkkkkk...',
    '...ky....yk...',
  ],
  [
    '..kkkkkkkkk...',
    '.kyyyyyyyyyk..',
    'kyYYyyyyyyyYk.',
    'kyykkkkkkkyyk.',
    'kyykNNkknnkyk.',
    'kyyknnnnNnkyk.',
    'kyyyyyyyyyyyk.',
    '.kyyyyyyyyyk..',
    '..kkkkkkkkk...',
    '...yk....ky...',
  ],
];

// Corrupt Bug — 12x9, low, wide, spiky, with a charge tell (red eye).
export const BUG = [
  [
    '.k........k.',
    'kmmk....kmmk',
    '.kmmmkkmmmk.',
    'kmmMMmmMMmmk',
    'kmmmmmmmmmmk',
    'kmrrmmmmrmmk',
    'kmmmmmmmmmmk',
    '.kmmmmmmmmk.',
    '..kkkkkkkk..',
  ],
  [
    '.k........k.',
    'kmmk....kmmk',
    '.kmmmkkmmmk.',
    'kmmMMmmMMmmk',
    'kmmmmmmmmmmk',
    'kmRRmmmmRRmk',
    'kmmmmmmmmmmk',
    '.kmmmmmmmmk.',
    '.kkkkkkkkkk.',
  ],
];

// Big turret-ish "Sentinel" used as a mini hazard on level 3 (spawning no projectiles,
// just a pulsing blocker). Kept simple: 12x12.
export const SENTINEL = [
  [
    '..kkkkkkkk..',
    '.kZZzzzzZZk.',
    'kZzzzzzzzzZk',
    'kzzkkkkkkzzk',
    'kzzkrrrrkzzk',
    'kzzkrRRrkzzk',
    'kzzkrrrrkzzk',
    'kzzkkkkkkzzk',
    'kZzzzzzzzzZk',
    '.kZZzzzzZZk.',
    '..kkkkkkkk..',
    '...kk..kk...',
  ],
];

// ═══════════════════════════════════════════════════════════════════════
//  PROPS & TILES
// ═══════════════════════════════════════════════════════════════════════

// 16x16 terrain tiles per theme, plus edge variants.
export const TILE_TOP_MEADOW = [
  'hhHHhhhhhhHHhhhH',
  'HehhhhhhhhhhhHhh',
  'hHhshhhhhhshhHhh',
  'hhhsshhhhsshhhhH',
  'tTTttttTTtttTTtt',
  'tUUtuuuuuutUUutt',
  'tuuuUUuuUUuuuuut',
  'tuuuuuuuuuuuuuut',
  'tuuuuUuuuUuuuuut',
  'tuuuuuuuuuuuuuut',
  'tuUtuuuuuuutUuut',
  'tuuuuuuuuuuuuuut',
  'tuuuuuuuuUUuuuut',
  'tuUuuuuuuuuuuuut',
  'tuuuuuuuuuuuuuut',
  'tttttttttttttttt',
];

export const TILE_FILL_MEADOW = [
  'tUuuuuuuuuuuuuut',
  'uuuuUUuuuuuuuuut',
  'uuuuuuuuuuUuuuut',
  'uUuuuuuuuuuuuuut',
  'uuuuuuuuuuuuUUut',
  'tuuuuuuuuuuuuuut',
  'uuuuuUuuuuuuuuut',
  'uuuuuuuuuuuuuuut',
  'uUuuuuuuuuUuuuut',
  'uuuuuuuuuuuuuuut',
  'uuuuuuuUUuuuuuut',
  'tuuuuuuuuuuuuuut',
  'uuuUuuuuuuuuuuut',
  'uuuuuuuuuuuUuuut',
  'tuuuuuuuuuuuuuut',
  'tttttttttttttttt',
];

export const TILE_TOP_CAVE = [
  'XxXXxxXXxxXXxXXX',
  'xxXXxxxXXxxxXXXX',
  'xXxxxxxxxxxxxxXX',
  'xxxxxXxxxxXxxxxx',
  'xxxxxuUUUxxxxxxx',
  'xxxxuUUUUUxxxxxx',
  'xxxxuuuuUxxxxxxx',
  'xxxxuuuuuuxxxxxx',
  'xxxxxuuuuxxxxxxx',
  'xxxxxxuuxxxxxxxx',
  'xxxxxxxuxxxxxxxx',
  'xxxxxxxxxxxxxxxx',
  'xxxxxxxxxxxxxxxx',
  'xxxxxxxxxxxxxxxx',
  'xxxxxxxxxxxxxxxx',
  'iiiiiiiiiiiiiiii',
];

export const TILE_FILL_CAVE = [
  'xxxxxxxxxxxxxxxx',
  'xxxXxxxxxxxXxxxx',
  'xxxxxxxXxxxxxxxx',
  'xxxxxxxxxxxxxxxx',
  'xxXxxxxxxxxxxxXx',
  'xxxxxxxxxxxxxxxx',
  'xxxxxxXxxxxxxxxx',
  'xxxxxxxxxxxXxxxx',
  'xxxxxxxxxxxxxxxx',
  'xxxxxxxxxxxxxxxx',
  'xxxxXxxxxxxXxxxx',
  'xxxxxxxxxxxxxxxx',
  'xxxxxxxxxxxxxxxx',
  'xxxxxxxXxxxxxxxx',
  'xxxxxxxxxxxxxxxx',
  'xxxxxxxxxxxxxxxx',
];

export const TILE_TOP_TOWER = [
  'zzZZzzzZzZZzzzzZ',
  'zZzzzzzzzzzzzzZz',
  'zzzzkkkkkzzzzzzz',
  'zzzkNNNNNkzzzzzz',
  'zzkNNNnnNNkzzzzz',
  'zkNNnnnnnnNkzzzz',
  'zkNnnnnnnnnNkzzz',
  'zkNnnnnnnnnNkzzz',
  'zkNnnnnnnnnNkzzz',
  'zzkNNnnnnNNkzzzz',
  'zzzkNNNNNNkzzzzz',
  'zzzzkNNNNkzzzzzz',
  'zzzzzkNNkzzzzzzz',
  'zzzzzzkkzzzzzzzz',
  'zzzzzzzzzzzzzzzz',
  'ZZzzzzzzzzzzzzzZ',
];

export const TILE_FILL_TOWER = [
  'zzzzzzzzzzzzzzzz',
  'zkkkkkkkkkkkkkkz',
  'zkNNnnnnnnnnNNkz',
  'zkNnnnnnnnnnnNkz',
  'zkNnnkkkkkknnNkz',
  'zkNnnkzzzzknnNkz',
  'zkNnnkzZZzknnNkz',
  'zkNnnkzzzzknnNkz',
  'zkNnnkkkkkknnNkz',
  'zkNnnnnnnnnnnNkz',
  'zkNNnnnnnnnnNNkz',
  'zkkkkkkkkkkkkkkz',
  'zzzzzzzzzzzzzzzz',
  'zZzzzzzzzzzzzzZz',
  'zzzzzzzzzzzzzzzz',
  'zzzzZZzzzzZZzzzz',
];

// Decorative background props
export const TREE_MEADOW = [
  '.....kk.....',
  '....kHHk....',
  '...kHHHHk...',
  '..kHHHHHHk..',
  '.kHHHHHHHHk.',
  'kHHHHHHHHHHk',
  'kHhHHHHHHhHk',
  '.khHHHHHHhk.',
  '...kgeegk...',
  '....kvvk....',
  '....kvvk....',
  '....kvvk....',
  '...kvvvvk...',
  '...kvVVvk...',
];

export const BUSH_MEADOW = [
  '....kkkk....',
  '..kkHHHHkk..',
  '.kHHHHHHHHk.',
  'kHHHhHHhHHHk',
  'khHHHHHHHHhk',
  '.kkhhhhhhkk.',
  '...ke..ek...',
];

export const PYLON_MEADOW = [
  '..kkkkkkk...',
  '.kNNNNNNNk..',
  'kNNnnnnnNNk.',
  'kNnkkkkknNk.',
  'kNnkNNNknNk.',
  'kNnkNnNknNk.',
  'kNnkkkkknNk.',
  'kNNnnnnnNNk.',
  '.kNNNNNNNk..',
  '..kkkkkkk...',
  '....kNk.....',
  '....kNk.....',
  '....kNk.....',
  '...kNNNk....',
  '..kNNNNNk...',
  '..kkkkkkk...',
];

export const STALACTITE = [
  'kkkk..kkkk..',
  'kXXk.kXXk...',
  '.kXk.kXk....',
  '.kXk.kXk....',
  '..kXk.kXk...',
  '..kXk..kXk..',
  '...kXk..kXk.',
  '...kXk...kXk',
  '....kXk...kk',
  '....kXk.....',
  '.....kXk....',
  '.....kk.....',
];

export const CRYSTAL = [
  '.....kk.....',
  '....kcCk....',
  '...kcCCck...',
  '...kcCCck...',
  '..kcCCCCck..',
  '..kcCCCCck..',
  '..kccCCcck..',
  '...kcccck...',
  '...kcccck...',
  '....kcck....',
  '....kcck....',
  '.....kk.....',
];

export const TOWER_BASE = [
  '..kkkkkkkkkkkkkkkk..',
  '.kNNNNNNNNNNNNNNNNk.',
  'kNNnnnnnnnnnnnnnnNNk',
  'kNnkkkkkkkkkkkkkknNk',
  'kNnkzzzzzzzzzzzzknNk',
  'kNnkzZZZZZZZZZZzknNk',
  'kNnkzzzzzzzzzzzzknNk',
  'kNnkkkkkkkkkkkkkknNk',
  'kNNnnnnnnnnnnnnnnNNk',
  'kNNnnnnnnnnnnnnnnNNk',
  'kNnnnnnnnnnnnnnnnnNk',
  'kNnkkkkkkkkkkkkkknNk',
  'kNnkOOOOOOOOOOOOknNk',
  'kNnkOoooooooooOOknNk',
  'kNnkOOOOOOOOOOOOknNk',
  'kNnkkkkkkkkkkkkkknNk',
  'kNNnnnnnnnnnnnnnnNNk',
  'kNNNNNNNNNNNNNNNNNNk',
  '.kkkkkkkkkkkkkkkkkk.',
];

// ═══════════════════════════════════════════════════════════════════════
//  Atlas — bake everything once. `SCALE` = screen pixels per art pixel.
// ═══════════════════════════════════════════════════════════════════════

export class SpriteAtlas {
  constructor(scale = 2) {
    this.scale = scale;
    this.s = scale;
    this.build();
  }

  _b(map) { return bake(map, this.s); }
  _bf(map) { return bakeFlipped(map, this.s); }

  build() {
    const s = this.s;

    // ---- PIP ----
    this.pipIdle = PIP_IDLE.map((m) => this._b(m));
    this.pipRun = PIP_RUN.map((m) => this._b(m));
    this.pipJump = this._b(PIP_JUMP);
    this.pipFall = this._b(PIP_FALL);
    this.pipDash = this._b(PIP_DASH);
    this.pipHurt = this._b(PIP_HURT);
    this.pipDeath = PIP_DEATH.map((m) => this._b(m));
    this.pipVictory = PIP_VICTORY.map((m) => this._b(m));
    // Flipped variants (PIP faces right by default).
    this.pipIdleF = PIP_IDLE.map((m) => this._bf(m));
    this.pipRunF = PIP_RUN.map((m) => this._bf(m));
    this.pipJumpF = this._bf(PIP_JUMP);
    this.pipFallF = this._bf(PIP_FALL);
    this.pipDashF = this._bf(PIP_DASH);
    this.pipHurtF = this._bf(PIP_HURT);
    this.pipDeathF = PIP_DEATH.map((m) => this._bf(m));
    this.pipVictoryF = PIP_VICTORY.map((m) => this._bf(m));

    // ---- Enemies ----
    this.hopper = HOPPER.map((m) => this._b(m));
    this.hopperF = HOPPER.map((m) => this._bf(m));
    this.drone = DRONE.map((m) => this._b(m));
    this.droneF = DRONE.map((m) => this._bf(m));
    this.bug = BUG.map((m) => this._b(m));
    this.bugF = BUG.map((m) => this._bf(m));
    this.sentinel = this._b(SENTINEL);

    // ---- Tiles ----
    this.tileTop = {
      meadow: this._b(TILE_TOP_MEADOW),
      cave: this._b(TILE_TOP_CAVE),
      tower: this._b(TILE_TOP_TOWER),
    };
    this.tileFill = {
      meadow: this._b(TILE_FILL_MEADOW),
      cave: this._b(TILE_FILL_CAVE),
      tower: this._b(TILE_FILL_TOWER),
    };

    // ---- Props ----
    this.props = {
      tree: this._b(TREE_MEADOW),
      bush: this._b(BUSH_MEADOW),
      pylon: this._b(PYLON_MEADOW),
      stalactite: this._b(STALACTITE),
      crystal: this._b(CRYSTAL),
      towerBase: this._b(TOWER_BASE),
    };

    // ---- Signal Bit: authored 8x8, 4 spin frames (view from rotating) ----
    this.bit = [
      bitFrame(0), bitFrame(1), bitFrame(2), bitFrame(3),
    ].map((m) => this._b(m));

    // ---- Data Core: 10x10 rare, 4 frames ----
    this.core = [coreFrame(0), coreFrame(1), coreFrame(2), coreFrame(3)].map((m) => this._b(m));

    // ---- Checkpoint terminal, 12x16: 2 states x 2 anim frames ----
    this.checkpointOff = [cpFrame(false, 0), cpFrame(false, 1)].map((m) => this._b(m));
    this.checkpointOn = [cpFrame(true, 0), cpFrame(true, 1)].map((m) => this._b(m));

    // ---- Bounce pad, 14x8 ----
    this.bouncePad = [bounceFrame(0), bounceFrame(1)].map((m) => this._b(m));

    // ---- Phase block 16x16 ----
    this.phaseBlock = [phaseFrame(0), phaseFrame(1), phaseFrame(2)].map((m) => this._b(m));

    // ---- Spike strip 16x8 ----
    this.spikes = this._b(SPIKES);

    // ---- Goal beacon / tower top ----
    this.towerTop = [towerTopFrame(0), towerTopFrame(1), towerTopFrame(2)].map((m) => this._b(m));

    void s;

    // ---- Platform bodies (moving H / moving V / falling) ----
    this.platformMoveH = this._b(PLAT_MOVE_H);
    this.platformMoveV = this._b(PLAT_MOVE_V);
    this.platformFall = this._b(PLAT_FALL);

    // ---- Corrupt Bug charge frame (turns red and lowers its head) ----
    this.bugCharge = this._b(BUG_CHARGE);
    this.bugChargeF = this._bf(BUG_CHARGE);

    // ---- Small HUD glyphs ----
    this.hudCell = this._b(HUD_CELL);
    this.hudCellEmpty = this._b(HUD_CELL_EMPTY);
    this.hudDashReady = this._b(HUD_DASH_READY);
    this.hudDashEmpty = this._b(HUD_DASH_EMPTY);
  }
}

// --- Generated small sprites -------------------------------------------------

function bitFrame(f) {
  // A spinning 8-point signal shard. Frames narrow to fake rotation.
  const narrow = [
    [
      '...kk...',
      '..kCCk..',
      '.kCooCk.',
      'kCoOOoCk',
      'kCoOOoCk',
      '.kCooCk.',
      '..kCCk..',
      '...kk...',
    ],
    [
      '...kk...',
      '...kCk..',
      '..kCOk..',
      '..kCOk..',
      '..kCOk..',
      '..kCOk..',
      '...kCk..',
      '...kk...',
    ],
    [
      '...kk...',
      '..kook..',
      '.koOOok.',
      'koOOOOok',
      'koOOOOok',
      '.koOOok.',
      '..kook..',
      '...kk...',
    ],
    [
      '...kk...',
      '..kCok..',
      '..kCok..',
      '..kCok..',
      '..kCok..',
      '..kCok..',
      '..kCok..',
      '...kk...',
    ],
  ];
  return narrow[f % 4];
}

function coreFrame(f) {
  // 10x10 data core: a hexagonal teal ring around a warm orange heart that
  // pulses brighter on alternating frames.
  const h = f === 1 || f === 2 ? 'O' : 'o';   // heart brightness
  const n = f % 2 === 0 ? 'c' : 'C';          // ring notch brightness
  return [
    '..kkkkkk..',
    '.kcCCCCck.',
    `kcCC${n}${n}CCck`,
    `kCC${'c'}kkkk${'c'}CCk`,
    `kCC${'c'}k${h}${h}${h}k${'c'}CCk`,
    `kCC${'c'}k${h}${h}${h}k${'c'}CCk`,
    `kCC${'c'}kkkk${'c'}CCk`,
    `kcCC${n}${n}CCck`,
    '.kcCCCCck.',
    '..kkkkkk..',
  ];
}

function cpFrame(on, frame) {
  // 10 wide x 16 tall terminal on a short post. `on` lights the lamps teal,
  // `off` leaves them dim slate. The lamp pair alternates to hint at activity.
  const lampA = on ? (frame ? 'C' : 'c') : 'u';
  const lampB = on ? (frame ? 'c' : 'C') : 'u';
  const glow = on ? 'c' : 'u';
  const lampRow = `kNk${lampA}${lampB}kNNkNk`; // 10 chars
  return [
    '...kkkk...',
    `..kgg${glow}k..`,
    '..kgCCgk..',
    '..kggggk..',
    '..kkkkkk..',
    '.kNNNNNNk.',
    '.kNnnnnNk.',
    '.kkNnnNkk.',
    'kNkNNNNkNk',
    lampRow,
    'kNkNNNNkNk',
    'kNkkGGkkNk',
    'kNNkGGkNNk',
    '.kkkkkkkk.',
    '..kNkkNk..',
    '..kkkkkk..',
  ];
}

function bounceFrame(f) {
  const pad = f
    ? [
        '..kkkkkkkkkk..',
        '.kOOOOOOOOOOk.',
        'kOOooooooooOOk',
        'kOkkkkkkkkkkOk',
        'kGGGGGGGGGGGGk',
        '.kkkkkkkkkkkk.',
        '..kNNk..kNNk..',
        '..kkkk..kkkk..',
      ]
    : [
        '..kkkkkkkkkk..',
        '.kOOOOOOOOOOk.',
        'kOOooooooooOOk',
        'kOkkkkkkkkkkOk',
        'kGGGGGGGGGGGGk',
        '.kkkkkkkkkkkk.',
        '.kNNkkkkkkNNk.',
        '.kkkkkkkkkkkk.',
      ];
  return pad;
}

function phaseFrame(f) {
  // Three states: solid, dissolving, gone.
  const A = [
    'kkkkkkkkkkkkkkkk',
    'kNNNNNNNNNNNNNNk',
    'kNccNNNNNNNNccNk',
    'kNcCCNNNNNNcCCNk',
    'kNccNNkkkkNNccNk',
    'kNNNNkcccckNNNNk',
    'kNNNNkcCCckNNNNk',
    'kNNNNkcccckNNNNk',
    'kNccNNkkkkNNccNk',
    'kNcCCNNNNNNcCCNk',
    'kNccNNNNNNNNccNk',
    'kNNNNNNNNNNNNNNk',
    'kNNNNkkkkkkNNNNk',
    'kNNNNNNNNNNNNNNk',
    'kNNNNNNNNNNNNNNk',
    'kkkkkkkkkkkkkkkk',
  ];
  const B = [
    'k.k.kk.k.kk.k.kk',
    'kNNNNNNNNNNNNNNk',
    '.Nc.NNNNNN.cN.k.',
    'kN.kkkkkkk.ccNk.',
    'k.cNNkkkkNccN.k.',
    'NN.NNkcccckNNN.k',
    '.NNNk.cCCckNN.k.',
    'kN.Nk.cccckNNN.k',
    'k.ccNNkkkkNccN.k',
    'k.cCNNNNNNkcC.k.',
    'kN.cNNNNNN.NccNk',
    'kNNNNNNNNNNNN.k.',
    'kN.NNkkkkkkN.NNk',
    '.NNNNNNNNNNNNNk.',
    'kNNNNNNNNNNNNN.k',
    '.k.kk.k.kk.k.kk.',
  ];
  if (f === 0) return A;
  if (f === 1) return B;
  return A.map((r) => r.replace(/[^k]/g, '.')); // outline ghost
}

export const SPIKES = [
  '.k..k..k..k..k..',
  'kck.kck.kck.kck.',
  'kck.kck.kck.kck.',
  'kck.kck.kck.kck.',
  'kck.kck.kck.kck.',
  'kck.kck.kck.kck.',
  'kck.kck.kck.kck.',
  'kkkkkkkkkkkkkkkk',
];

function towerTopFrame(f) {
  const bl = f === 1 ? 'C' : f === 2 ? 'c' : 'c';
  return [
    '.......kk.......',
    '......k..k......',
    '.....k....k.....',
    '....kk.cc.kk....',
    '...kNNNccNNNk...',
    '..kNNNNNNNNNNk..',
    '.kNNnnnnnnnnNNk.',
    'kNNnkkkkkkkknNNk',
    'kNnkOOOOOOOOknNk',
    `kNnkO${bl}oo${bl}oOOknNk`,
    'kNnkOOOOOOOOknNk',
    'kNNnkkkkkkkknNNk',
    '.kNNnnnnnnnnNNk.',
    '..kNNNNNNNNNNk..',
    '...kNNNNNNNNk...',
    '...kkkkkkkkkk...',
  ];
}

// ═══════════════════════════════════════════════════════════════════════
//  Draw helper: draws a baked sprite centred on (x,y) with given anchor.
//  x/y are in world units; sprite.w/h are already scaled.
// ═══════════════════════════════════════════════════════════════════════
export function drawSprite(ctx, img, x, y, camX, camY, flip = false, alpha = 1) {
  const sx = Math.round(x - camX - img.width / 2);
  const sy = Math.round(y - camY - img.height);
  if (alpha !== 1) {
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, sx, sy);
    ctx.globalAlpha = 1;
  } else {
    ctx.drawImage(img, sx, sy);
  }
  void flip;
}

export function drawSpriteCentered(ctx, img, x, y, camX, camY, alpha = 1) {
  const sx = Math.round(x - camX - img.width / 2);
  const sy = Math.round(y - camY - img.height / 2);
  if (alpha !== 1) {
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, sx, sy);
    ctx.globalAlpha = 1;
  } else {
    ctx.drawImage(img, sx, sy);
  }
}

// ────────────────────────────────────────────────────────────────────────
//  Extra small sprite maps (platforms + HUD glyphs).
// ────────────────────────────────────────────────────────────────────────

const PLAT_MOVE_H = [
  'kkkkkkkkkkkkkkkk',
  'kNNNNNNNNNNNNNNk',
  'kNnOOOOOOOOOOnNk',
  'kNnOkkkkkkkkOnNk',
  'kNnOknnnnnnkOnNk',
  'kNnOkkkkkkkkOnNk',
  'kNnOOOOOOOOOOnNk',
  'kkkkkkkkkkkkkkkk',
];

const PLAT_MOVE_V = [
  'kkkkkkkkkkkkkkkk',
  'kNNNNNNNNNNNNNNk',
  'kNnkkkkkkkkkknNk',
  'kNnkOOOOOOOOknNk',
  'kNnkOkkkkkkOknNk',
  'kNnkOOOOOOOOknNk',
  'kNnkkkkkkkkkknNk',
  'kkkkkkkkkkkkkkkk',
];

const PLAT_FALL = [
  'kkkkkkkkkkkkkkkk',
  'kNNNNNNNNNNNNNNk',
  'kNnkkkkkkkkkknNk',
  'kNnknnnnnnnnknNk',
  'kNnknnnnnnnnknNk',
  'kNnkkkkkkkkkknNk',
  'kkkkkkkkkkkkkkkk',
  '..k.k....k.k....',
];

const BUG_CHARGE = [
  '..k......k..',
  '.kmk....kmk.',
  'kmmmkkkkmmmk',
  'kmMMmmmmMMmk',
  'kmmkmmmmkmmk',
  'kmmkMmmMkmmk',
  '.kkkmmmmkkk.',
  'kkk.mmm..kkk',
  'kk..mmm..kkk',
  '....kmk.....',
];

const HUD_CELL = [
  'kkkkkkkkkk',
  'kNNNNNNNNk',
  'kNkkkkkkNk',
  'kNkcccckNk',
  'kNkcCCckNk',
  'kNkcCCckNk',
  'kNkcccckNk',
  'kNkkkkkkNk',
  'kNNNNNNNNk',
  'kkkkkkkkkk',
];

const HUD_CELL_EMPTY = [
  '..kkkkkk..',
  '.knnnnnnk.',
  'knkkkkkknk',
  'knk....knk',
  'knk....knk',
  'knk....knk',
  'knk....knk',
  'knkkkkkknk',
  '.knnnnnnk.',
  '..kkkkkk..',
];

const HUD_DASH_READY = [
  '..kkkkkk..',
  '.kCCCCCCk.',
  'kCooooooCk',
  'kCoOOOOoCk',
  'kCoOOOOoCk',
  'kCooooooCk',
  '.kCCCCCCk.',
  '..kkkkkk..',
];

const HUD_DASH_EMPTY = [
  '..kkkkkk..',
  '.kNNNNNNk.',
  'kNnnnnnnNk',
  'kNn....nNk',
  'kNn....nNk',
  'kNnnnnnnNk',
  '.kNNNNNNk.',
  '..kkkkkk..',
];

// ═══════════════════════════════════════════════════════════════════════
//  Atlas
//  Everything the renderer needs, baked once at load. `S` is the art scale:
//  every sprite pixel becomes S device-independent canvas units, so a single
//  consistent pixel grid is preserved across the whole game.
// ═══════════════════════════════════════════════════════════════════════

export const ART_SCALE = 2;
