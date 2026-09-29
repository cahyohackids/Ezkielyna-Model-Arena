const ground = (x, y, w) => ({ x, y, w, h: 720 - y, type: 'ground', solid: true });
const platform = (x, y, w = 100, type = 'static', extra = {}) => ({ x, y, w, h: 16, type, solid: false, ...extra });
const enemy = (x, y, left, right, type = 'hopper', extra = {}) => ({ x, y, w: type === 'drone' ? 28 : 26, h: type === 'drone' ? 22 : 24, left, right, type, ...extra });
const line = (x, y, count, spacing = 27) => Array.from({ length: count }, (_, i) => ({ x: x + spacing * i, y }));
const arc = (x, y, count, spacing = 28, rise = 42) => Array.from({ length: count }, (_, i) => ({ x: x + spacing * i, y: y - Math.sin(i / Math.max(1, count - 1) * Math.PI) * rise }));

export const LEVELS = [
  {
    name: 'Signal Meadow', subtitle: 'Where the quiet began.', theme: 'meadow', width: 4110, height: 640,
    intro: '01 / SIGNAL MEADOW', description: 'Follow the fragments. Find your feet.', spawn: { x: 100, y: 422 }, tower: { x: 3900, y: 422 },
    platforms: [
      ground(0, 452, 690), ground(810, 452, 600), ground(1630, 430, 500), ground(2240, 452, 610), ground(2970, 452, 1140),
      platform(345, 378, 132), platform(510, 304, 106), platform(946, 378, 120), platform(1096, 304, 142),
      platform(1465, 420, 100, 'moving', { rangeX: 37, speed: 1.05 }),
      platform(2330, 378, 112), platform(2480, 302, 152), platform(2680, 366, 92),
      platform(3300, 378, 108), platform(3450, 302, 150), platform(3680, 372, 104),
    ],
    bits: [...line(225, 420, 4), ...arc(353, 343, 4, 30, 20), ...line(528, 273, 3), ...arc(655, 383, 6, 34, 34), ...line(1115, 272, 4), ...arc(1400, 365, 6, 38, 34), ...arc(1830, 355, 4, 32, 23), ...arc(2110, 375, 5, 33, 27), ...line(2510, 270, 4), ...arc(2810, 375, 4, 42, 29), ...line(3477, 270, 3), ...line(3760, 420, 3)],
    cores: [{ x: 567, y: 267 }, { x: 2580, y: 263 }, { x: 3530, y: 263 }],
    enemies: [enemy(544, 428, 505, 644), enemy(1010, 428, 880, 1130), enemy(1750, 406, 1660, 1825), enemy(2740, 428, 2650, 2810), enemy(3210, 428, 3070, 3260)],
    hazards: [{ x: 1880, y: 418, w: 48, h: 12, type: 'spikes' }, { x: 3090, y: 440, w: 48, h: 12, type: 'spikes' }],
    checkpoints: [{ x: 1280, y: 452 }, { x: 2750, y: 452 }],
    secrets: [{ x: 502, y: 232, w: 122, h: 83, label: 'A forgotten uplink' }, { x: 2470, y: 236, w: 170, h: 82, label: 'The garden remembers' }],
    signs: [{ x: 205, y: 454, text: 'A D   MOVE', type: 'controls' }, { x: 404, y: 454, text: 'SPACE   JUMP', type: 'controls' }, { x: 660, y: 454, text: 'HOLD TO JUMP HIGHER', type: 'small' }, { x: 1190, y: 454, text: 'CHECKPOINT  →', type: 'small' }, { x: 1770, y: 432, text: 'SHIFT   DASH', type: 'controls' }, { x: 3360, y: 454, text: '↑  A QUIETER PATH', type: 'small' }],
  },
  {
    name: 'Circuit Caverns', subtitle: 'Something is still awake.', theme: 'cavern', width: 4490, height: 650,
    intro: '02 / CIRCUIT CAVERNS', description: 'Old circuits. New ways through.', spawn: { x: 90, y: 446 }, tower: { x: 4280, y: 382 },
    platforms: [
      ground(0, 476, 580), ground(890, 440, 640), ground(1850, 440, 630), ground(2670, 480, 530), ground(3400, 412, 1090),
      platform(260, 398, 105), platform(406, 322, 146),
      platform(610, 439, 92, 'falling'), platform(748, 406, 92, 'falling'),
      platform(1070, 363, 106), platform(1220, 287, 104), platform(1360, 214, 134),
      platform(1570, 323, 98, 'moving', { rangeY: 62, speed: .8 }), platform(1740, 358, 92, 'falling'),
      platform(1975, 432, 46, 'bounce'), platform(2020, 254, 110), platform(2170, 185, 156), platform(2340, 285, 95),
      platform(2530, 428, 92, 'falling'), platform(2745, 472, 46, 'bounce'), platform(2800, 303, 108), platform(2950, 230, 153),
      platform(3240, 410, 100, 'moving', { rangeY: 26, speed: 1.1 }), platform(3580, 336, 100), platform(3730, 262, 140), platform(3950, 337, 112),
    ],
    bits: [...line(182, 444, 4), ...line(426, 290, 3), ...arc(550, 374, 7, 44, 35), ...line(1260, 253, 3), ...line(1385, 183, 3), ...arc(1550, 265, 5, 36, 15), ...line(1970, 343, 3, 0).map((b, i) => ({ x: b.x + i * 17, y: b.y - i * 34 })), ...line(2200, 153, 4), ...arc(2460, 354, 5, 36, 25), ...line(2980, 198, 3), ...arc(3170, 363, 4, 42, 18), ...line(3760, 230, 3), ...line(4130, 380, 3)],
    cores: [{ x: 482, y: 282 }, { x: 2250, y: 144 }, { x: 3030, y: 190 }],
    enemies: [enemy(405, 452, 340, 533), enemy(990, 416, 920, 1080), enemy(1430, 341, 1300, 1470, 'drone', { rangeY: 20 }), enemy(1770, 290, 1620, 1820, 'drone', { rangeY: 32 }), enemy(2290, 416, 2130, 2400), enemy(2840, 368, 2800, 3020, 'drone', { rangeY: 28 }), enemy(3790, 388, 3610, 3910, 'bug')],
    hazards: [{ x: 1200, y: 428, w: 58, h: 12, type: 'spikes' }, { x: 2350, y: 428, w: 58, h: 12, type: 'spikes' }, { x: 4000, y: 400, w: 54, h: 12, type: 'spikes' }],
    checkpoints: [{ x: 1420, y: 440 }, { x: 3040, y: 480 }],
    secrets: [{ x: 404, y: 246, w: 155, h: 85, label: 'Memory room / 02' }, { x: 2165, y: 111, w: 170, h: 88, label: 'A signal beneath the stone' }],
    signs: [{ x: 340, y: 478, text: '↑  FOLLOW THE FIREFLIES', type: 'small' }, { x: 510, y: 478, text: 'FRAGILE / KEEP MOVING', type: 'small' }, { x: 1880, y: 442, text: 'SPRING UPLINK  ↑', type: 'small' }, { x: 2810, y: 482, text: 'THERE IS MORE ABOVE', type: 'small' }],
  },
  {
    name: 'Glitch Tower', subtitle: 'Bring everyone back online.', theme: 'tower', width: 4890, height: 650,
    intro: '03 / GLITCH TOWER', description: 'Find the rhythm. Close the circuit.', spawn: { x: 95, y: 422 }, tower: { x: 4670, y: 268 },
    platforms: [
      ground(0, 452, 550), ground(870, 422, 620), ground(1810, 390, 640), ground(2760, 420, 530), ground(3620, 350, 1270),
      platform(260, 376, 105), platform(408, 300, 132), platform(589, 408, 100, 'phase', { phase: 0 }), platform(727, 379, 100, 'phase', { phase: .3 }),
      platform(1000, 344, 102), platform(1150, 268, 142),
      platform(1530, 377, 110, 'moving', { rangeX: 32, speed: 1.4 }), platform(1678, 346, 92, 'phase', { phase: .6 }),
      platform(1920, 311, 108), platform(2070, 236, 145), platform(2250, 302, 105),
      platform(2494, 353, 100, 'phase', { phase: .2 }), platform(2630, 355, 100, 'phase', { phase: .8 }),
      platform(2860, 341, 108), platform(3010, 265, 142),
      platform(3335, 377, 90, 'falling'), platform(3470, 340, 100, 'moving', { rangeY: 24, speed: 1.2 }),
      platform(3780, 273, 110), platform(3930, 199, 150),
      ground(4270, 298, 620),
    ],
    bits: [...line(180, 420, 4), ...line(429, 268, 3), ...arc(538, 339, 7, 44, 24), ...line(1170, 236, 4), ...arc(1480, 300, 6, 44, 22), ...line(2100, 204, 3), ...arc(2430, 280, 7, 44, 22), ...line(3040, 233, 3), ...arc(3280, 290, 5, 42, 18), ...line(3960, 167, 3), ...line(4500, 266, 5)],
    cores: [{ x: 474, y: 260 }, { x: 2150, y: 197 }, { x: 4010, y: 161 }],
    enemies: [enemy(421, 428, 385, 502, 'bug'), enemy(1320, 398, 1130, 1435, 'bug'), enemy(1680, 248, 1490, 1740, 'drone', { rangeY: 30 }), enemy(2295, 366, 2180, 2370, 'bug'), enemy(3030, 396, 2880, 3190, 'bug'), enemy(3820, 326, 3670, 3900, 'bug'), enemy(4160, 268, 4110, 4240, 'drone', { rangeY: 24 })],
    hazards: [{ x: 1018, y: 354, w: 10, h: 68, type: 'laser', phase: 0 }, { x: 1950, y: 378, w: 48, h: 12, type: 'spikes' }, { x: 2320, y: 315, w: 10, h: 75, type: 'laser', phase: 1.1 }, { x: 3070, y: 348, w: 10, h: 72, type: 'laser', phase: .5 }, { x: 4080, y: 338, w: 48, h: 12, type: 'spikes' }, { x: 4420, y: 222, w: 10, h: 76, type: 'laser', phase: 1.6 }],
    checkpoints: [{ x: 1390, y: 422 }, { x: 3160, y: 420 }, { x: 4300, y: 298 }],
    secrets: [{ x: 400, y: 218, w: 145, h: 92, label: 'A message never sent' }, { x: 3930, y: 124, w: 160, h: 88, label: 'Home is on the other frequency' }],
    signs: [{ x: 377, y: 454, text: 'SHIFT  /  TRUST YOUR DASH', type: 'small' }, { x: 899, y: 424, text: 'LASERS PULSE. WATCH FIRST.', type: 'small' }, { x: 2270, y: 392, text: 'WATCH THE BLOCKS BREATHE', type: 'small' }, { x: 4530, y: 300, text: 'THE LAST CONNECTION  →', type: 'small' }],
  },
];

export function buildLevel(index) {
  const level = structuredClone(LEVELS[index]);
  level.index = index; level.bits = level.bits.slice(0, 50).map((b, id) => ({ ...b, id, collected: false }));
  level.cores = level.cores.map((b, id) => ({ ...b, id, collected: false }));
  level.platforms.forEach((p, i) => { p.id = i; p.baseX = p.x; p.baseY = p.y; p.dx = 0; p.dy = 0; p.active = true; p.timer = 0; p.fall = 0; });
  level.enemies.forEach((e, i) => { e.id = i; e.baseY = e.y; e.direction = i % 2 ? -1 : 1; e.alive = true; e.death = 0; e.cycle = i * .7; });
  level.checkpoints.forEach(c => c.active = false);
  level.secrets.forEach(s => s.revealed = false);
  return level;
}

export function updatePlatforms(level, dt, time, standing) {
  for (const p of level.platforms) {
    const oldX = p.x, oldY = p.y;
    if (p.type === 'moving') { p.x = p.baseX + Math.sin(time * p.speed) * (p.rangeX || 0); p.y = p.baseY + Math.sin(time * p.speed) * (p.rangeY || 0); }
    if (p.type === 'phase') { p.cycle = ((time + (p.phase || 0)) % 3.8) / 3.8; p.active = p.cycle < .77; }
    if (p.type === 'falling') {
      if (standing === p && !p.timer) p.timer = .001;
      if (p.timer) p.timer += dt;
      if (p.timer > .6 && p.timer < 3.3) { p.fall += 750 * dt; p.y += p.fall * dt; }
      if (p.timer >= 3.3) { p.y = p.baseY; p.timer = 0; p.fall = 0; }
      p.active = p.y < 680;
    }
    p.dx = p.x - oldX; p.dy = p.y - oldY;
  }
}

export function updateEnemies(level, dt, time) {
  for (const e of level.enemies) {
    if (!e.alive) { e.death = Math.max(0, e.death - dt); continue; }
    e.cycle += dt;
    const charge = e.type === 'bug' && e.cycle % 2.9 > 2;
    const speed = e.type === 'drone' ? 57 : e.type === 'bug' ? (charge ? 164 : 48) : 40;
    e.charging = charge; e.x += e.direction * speed * dt;
    if (e.x < e.left) { e.x = e.left; e.direction = 1; }
    if (e.x > e.right) { e.x = e.right; e.direction = -1; }
    if (e.type === 'drone') e.y = e.baseY + Math.sin(time * 1.8 + e.id) * (e.rangeY || 22);
  }
  for (const h of level.hazards) if (h.type === 'laser') { const t = (time + h.phase) % 3; h.active = t < 1.35; h.warning = t > 2.65; h.offset = Math.sin(time * 1.3 + h.phase) * 14; }
}
