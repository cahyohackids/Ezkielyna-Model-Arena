// Sprite definitions for PIP (the courier robot) and world entities.
// All art is original pixel art drawn as string grids.

import { makeSprite, PALETTE as P } from './pix.js';

// PIP base palette
const pipPalette = {
  'o': '#ff8c42', // orange accents / visor glow
  'O': '#c65a20', // orange dark
  'w': '#f2e8d5', // cream body
  'c': '#d9ccb4', // cream shadow
  'n': '#2a4a7f', // navy/blue joints
  'N': '#1d2a45', // dark navy
  't': '#3fb8a8', // teal
  'y': '#7fe7ff', // neon cyan (visor)
  'd': '#0a0e1a', // deep dark
  'a': '#5a7fb8', // antenna steel
};

// PIP idle — 2 frames (antenna bob + visor)
const idle1 = `
..a....
..a....
.aaaw..
.owwy..
.wyyyy.
.wcccc.
.nwwww.
..n..n.
`;
const idle2 = `
..a....
...a...
.aaaw..
.owwy..
.wyyyy.
.wcccc.
.nwwww.
..n..n.
`;

// run frames (legs alternate)
const run1 = `
..a....
..a....
.aaaw..
.owwy..
.wyyyy.
.wcccc.
.nwwww.
.n..n..
`;
const run2 = `
..a....
..a....
.aaaw..
.owwy..
.wyyyy.
.wcccc.
.nwwww.
..nn...
`;
const run3 = `
..a....
..a....
.aaaw..
.owwy..
.wyyyy.
.wcccc.
.nwwww.
..n..n.
`;
const run4 = `
..a....
..a....
.aaaw..
.owwy..
.wyyyy.
.wcccc.
.nwwww.
.n..n..
`;

// jump (legs tucked)
const jump1 = `
..a....
..a....
.aaaw..
.owwy..
.wyyyy.
.wcccc.
.nwwwn.
..n.n..
`;
// fall (arms up slightly)
const fall1 = `
..a....
..a....
.aaaw..
.owwy..
.wyyyy.
.wcccc.
..nww..
.n..n..
`;

// dash (stretched)
const dash1 = `
...a...
...a...
.aaaww.
.owyyyy
.wccccw
.nwwww.
..n.n..
`;

// damage
const damage1 = `
..a....
..a....
.aaaw..
.owwy..
.wwww..
.wcccc.
.nwwww.
..n.n..
`;

// victory (arms up, visor bright)
const victory1 = `
.a.a...
.a.a...
.aaaw..
.owwy..
.wyyyy.
.wcccc.
.nwwww.
.n.n.n.
`;

const SPRITES = {
  idle: [makeSprite(idle1, pipPalette, 4), makeSprite(idle2, pipPalette, 4)],
  run: [makeSprite(run1, pipPalette, 4), makeSprite(run2, pipPalette, 4), makeSprite(run3, pipPalette, 4), makeSprite(run4, pipPalette, 4)],
  jump: [makeSprite(jump1, pipPalette, 4)],
  fall: [makeSprite(fall1, pipPalette, 4)],
  dash: [makeSprite(dash1, pipPalette, 4)],
  damage: [makeSprite(damage1, pipPalette, 4)],
  dead: [makeSprite(damage1, pipPalette, 4)],
  victory: [makeSprite(victory1, pipPalette, 4)],
};

// ---- Enemies ----
const hopperPalette = {
  'y': '#7fe7ff', 'd': '#0a0e1a', 'n': '#2a4a7f', 'w': '#f2e8d5', 't': '#3fb8a8',
};
const hopper1 = `
.yyyy..
.yyyy..
ddyyd..
dnnnnd.
.ddddd.
.n...n.
.n...n.
`;
const hopper2 = `
.yyyy..
.yyyy..
ddyyd..
dnnnnd.
.ddddd.
.n...n.
..n.n..
`;
const hopperPal = makeSprite(hopper1, hopperPalette, 4);
const hopperPal2 = makeSprite(hopper2, hopperPalette, 4);

const bugPalette = {
  'o': '#ff8c42', 'O': '#c65a20', 'd': '#0a0e1a', 'w': '#f2e8d5', 't': '#3fb8a8',
};
const bug1 = `
.oooo..
.oooo..
oOOOOo.
oddddo.
oOOOOo.
.o..o..
.o..o..
`;
const bug2 = `
.oooo..
.oooo..
oOOOOo.
oddddo.
oOOOOo.
..o.o..
..o.o..
`;
const bugPal = makeSprite(bug1, bugPalette, 4);
const bugPal2 = makeSprite(bug2, bugPalette, 4);

const dronePalette = {
  'y': '#7fe7ff', 'd': '#0a0e1a', 'n': '#2a4a7f', 'o': '#ff5a6e',
};
const drone1 = `
..yy..
.yyyy.
yyddyy
ydnnny
.yyyy.
..yy..
`;
const dronePal = makeSprite(drone1, dronePalette, 4);

// ---- Collectibles ----
const bitPalette = { 'y': '#7fe7ff', 'w': '#ffffff', 'n': '#2a4a7f' };
const bit1 = `
..y..
.ywy.
.ywy.
.ywy.
..y..
`;
const bitPal = makeSprite(bit1, bitPalette, 3);

const corePalette = { 'o': '#ff8c42', 'O': '#c65a20', 'w': '#f2e8d5', 'y': '#ffd9a0' };
const core1 = `
..oo..
.owwo.
owyywo
owyywo
.owwo.
..oo..
`;
const corePal = makeSprite(core1, corePalette, 4);

// ---- Checkpoint / tower drawn procedurally in renderer ----

export const SPRITE_MAP = {
  player: SPRITES,
  hopper: [hopperPal, hopperPal2],
  bug: [bugPal, bugPal2],
  drone: [dronePal],
  bit: bitPal,
  core: corePal,
};

export function getPlayerFrame(anim, t, walkCycle) {
  const frames = SPRITES[anim] || SPRITES.idle;
  if (anim === 'run') {
    const i = Math.floor(walkCycle) % frames.length;
    return frames[i];
  }
  if (anim === 'idle') {
    return frames[Math.floor(t * 3) % 2];
  }
  if (anim === 'damage' || anim === 'dead' || anim === 'victory') {
    return frames[0];
  }
  return frames[0];
}
