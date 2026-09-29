const P = (x, y, w, h = 40, extra = {}) => ({ x, y, w, h, type: "static", ...extra });
const B = (x, y) => ({ x, y, w: 54, h: 12, type: "bounce" });
const bitLine = (x, y, count, gap = 42) => Array.from({ length: count }, (_, i) => ({ x: x + i * gap, y }));
const bitArc = (x, y, count, gap = 40, rise = 42) => Array.from({ length: count }, (_, i) => ({ x: x + i * gap, y: y - Math.sin((i / (count - 1)) * Math.PI) * rise }));

export const LEVELS = [
  {
    id: 0, name: "SIGNAL MEADOW", zone: "SECTOR 01", difficulty: "EASY",
    subtitle: "Sunlit buffers and sleepy bugs.", width: 4920, spawn: { x: 115, y: 390 }, tower: { x: 4690, y: 305 },
    palette: { sky: "#7fcbb8", sky2: "#d7d89c", far: "#4c8980", mid: "#2b625d", ground: "#153b3e", edge: "#6fa76f", accent: "#ffad5a", glow: "#56e0c5" },
    hint: "MOVE  A/D  ·  JUMP  SPACE", checkpoint: [{ x: 2360, y: 390 }],
    platforms: [
      P(0, 456, 710, 100), P(800, 456, 710, 100), P(1645, 456, 590, 100), P(2300, 456, 590, 100), P(3035, 456, 470, 100), P(3650, 456, 1270, 100),
      P(500, 370, 120, 22), P(880, 365, 145, 22), P(1120, 305, 140, 22), P(1370, 355, 100, 22),
      P(1750, 350, 130, 22), P(1970, 290, 120, 22), P(2530, 340, 130, 22),
      P(2790, 285, 115, 22, { type:"moving", axis:"y", range:80, speed:1.05 }),
      P(3110, 350, 120, 22), P(3390, 300, 110, 22, { type:"moving", axis:"x", range:90, speed:1.1 }),
      P(3730, 355, 130, 22), P(3970, 300, 130, 22), P(4220, 350, 110, 22),
      P(1480, 505, 165, 25, { secret:true }), P(2890, 505, 145, 25, { secret:true }), P(3505, 505, 145, 25, { secret:true }),
    ],
    hazards: [
      { type:"spikes", x:1245, y:438, w:90, h:18 }, { type:"spikes", x:2095, y:438, w:90, h:18 }, { type:"spikes", x:3235, y:438, w:100, h:18 },
    ],
    bounces: [B(2670, 444)],
    bits: [
      ...bitLine(205, 404, 6), ...bitArc(520, 330, 5), ...bitArc(820, 390, 6), ...bitLine(1130, 262, 4),
      ...bitArc(1680, 390, 7), ...bitLine(1978, 248, 3), ...bitArc(2320, 393, 6), ...bitArc(2725, 262, 6),
      ...bitArc(3070, 390, 6), ...bitArc(3655, 390, 7), ...bitArc(4100, 284, 6), ...bitLine(4480, 400, 4),
      ...bitLine(1505, 474, 3),
    ],
    cores: [{ x: 1410, y: 315 }, { x: 2960, y: 474, secret:true }, { x: 4310, y: 308 }],
    enemies: [
      { type:"hopper", x:930, y:420, min:820, max:1120 }, { type:"hopper", x:1810, y:420, min:1660, max:2050 },
      { type:"hopper", x:3140, y:420, min:3050, max:3390 }, { type:"drone", x:3860, y:270, min:3770, max:4100 },
    ],
  },
  {
    id: 1, name: "CIRCUIT CAVERNS", zone: "SECTOR 02", difficulty: "MEDIUM",
    subtitle: "Descend through the humming deep.", width: 5240, spawn: { x: 100, y: 390 }, tower: { x: 5010, y: 280 },
    palette: { sky: "#071323", sky2: "#132d42", far: "#172c3b", mid: "#1e4350", ground: "#102a35", edge: "#3a7780", accent: "#ff9b57", glow: "#70dfe0" },
    hint: "BOUNCE PADS LAUNCH YOU HIGHER", checkpoint: [{ x: 2480, y: 390 }],
    platforms: [
      P(0,456,620,100), P(750,456,480,100), P(1390,456,490,100), P(2050,456,700,100), P(2920,456,400,100), P(3500,456,620,100), P(4300,456,940,100),
      P(520,350,105,22,{type:"falling"}), P(680,285,110,22,{type:"falling"}), P(860,225,120,22),
      P(1100,330,115,22,{type:"moving",axis:"y",range:90,speed:1.15}), P(1420,350,120,22), P(1580,280,110,22), P(1750,210,120,22),
      P(2140,350,120,22), P(2320,285,110,22,{type:"moving",axis:"x",range:80,speed:1}), P(2580,335,110,22),
      P(3000,350,100,22,{type:"falling"}), P(3160,280,100,22,{type:"falling"}), P(3350,215,130,22),
      P(3590,340,120,22), P(3800,275,100,22,{type:"moving",axis:"y",range:85,speed:1.2}), P(3980,205,130,22),
      P(4370,350,110,22), P(4550,290,120,22), P(4740,350,115,22),
      P(1230,520,160,22,{secret:true}), P(1880,515,170,22,{secret:true}), P(4120,515,180,22,{secret:true}),
      P(1550,125,240,18,{secret:true}), P(1790,125,80,18,{secret:true}),
    ],
    hazards: [
      {type:"spikes",x:980,y:438,w:110,h:18},{type:"spikes",x:1600,y:438,w:100,h:18},{type:"spikes",x:2330,y:438,w:95,h:18},
      {type:"spikes",x:3700,y:438,w:120,h:18},{type:"spikes",x:4620,y:438,w:90,h:18},
    ],
    bounces: [B(1130,444),B(1900,444),B(3315,444),B(4180,444)],
    bits: [
      ...bitLine(180,405,6),...bitArc(510,325,6,40,58),...bitArc(780,380,7,42,100),...bitLine(1420,307,4),
      ...bitArc(1560,235,6),...bitLine(1580,82,6),...bitArc(2070,392,7),...bitArc(2500,295,6),
      ...bitArc(2915,390,7,42,110),...bitArc(3480,390,6),...bitArc(3780,235,6,42,75),...bitLine(3990,163,4),
      ...bitArc(4320,390,7),...bitLine(4750,307,4),...bitLine(4145,480,3),
    ],
    cores: [{x:1780,y:82,secret:true},{x:1960,y:480,secret:true},{x:4100,y:165}],
    enemies: [
      {type:"hopper",x:850,y:420,min:770,max:1120},{type:"drone",x:1500,y:235,min:1410,max:1770},
      {type:"drone",x:2250,y:240,min:2100,max:2640},{type:"hopper",x:3600,y:420,min:3510,max:3920},
      {type:"drone",x:4470,y:250,min:4330,max:4780},
    ],
  },
  {
    id: 2, name: "GLITCH TOWER", zone: "SECTOR 03", difficulty: "MEDIUM–HARD",
    subtitle: "Climb the fracture. Outrun the static.", width: 5700, spawn: { x: 100, y: 390 }, tower: { x: 5460, y: 270 },
    palette: { sky: "#090b1d", sky2: "#251a3b", far: "#252143", mid: "#30305a", ground: "#161f35", edge: "#615b91", accent: "#ff6f71", glow: "#67f0ce" },
    hint: "SHIFT TO DASH · WATCH THE LASER RHYTHM", checkpoint: [{ x: 2750, y: 390 }, { x: 4370, y: 390 }],
    platforms: [
      P(0,456,610,100),P(790,456,430,100),P(1410,456,430,100),P(2030,456,470,100),P(2670,456,490,100),P(3370,456,370,100),P(3940,456,500,100),P(4640,456,1060,100),
      P(520,350,110,22,{type:"phase",phase:0}),P(680,285,110,22,{type:"phase",phase:0.4}),P(840,225,110,22,{type:"phase",phase:.8}),
      P(1120,335,110,22,{type:"moving",axis:"x",range:100,speed:1.3}), P(1450,350,105,22),P(1640,285,105,22,{type:"phase",phase:.2}),P(1810,220,105,22,{type:"phase",phase:.6}),
      P(2110,340,110,22,{type:"falling"}),P(2300,275,110,22,{type:"moving",axis:"y",range:90,speed:1.25}),
      P(2790,340,110,22,{type:"phase",phase:.1}),P(2960,275,105,22,{type:"phase",phase:.5}),P(3130,210,120,22,{type:"phase",phase:.9}),
      P(3410,330,100,22,{type:"falling"}),P(3570,265,100,22,{type:"falling"}),P(3740,205,130,22),
      P(4020,340,105,22,{type:"moving",axis:"y",range:80,speed:1.4}),P(4230,275,110,22,{type:"phase",phase:.35}),
      P(4680,350,105,22),P(4860,285,105,22,{type:"moving",axis:"x",range:90,speed:1.3}),P(5070,225,110,22),P(5280,330,130,22),
      P(1220,515,190,22,{secret:true}),P(2500,515,170,22,{secret:true}),P(3740,515,200,22,{secret:true}),
      P(3230,120,260,18,{secret:true}),
    ],
    hazards: [
      {type:"spikes",x:900,y:438,w:120,h:18},{type:"laser",x:1260,y:338,w:16,h:118,phase:0},{type:"spikes",x:1730,y:438,w:90,h:18},
      {type:"laser",x:1935,y:276,w:16,h:180,phase:.5},{type:"spikes",x:2180,y:438,w:100,h:18},{type:"laser",x:3260,y:246,w:16,h:210,phase:.25},
      {type:"spikes",x:3480,y:438,w:100,h:18},{type:"laser",x:3880,y:306,w:16,h:150,phase:.7},{type:"spikes",x:4180,y:438,w:120,h:18},
      {type:"laser",x:4540,y:326,w:16,h:130,phase:.1},{type:"spikes",x:4950,y:438,w:100,h:18},
    ],
    bounces:[B(1370,444),B(2525,444),B(4450,444)],
    bits:[
      ...bitLine(170,405,6),...bitArc(500,315,7,40,75),...bitArc(790,390,6),...bitArc(1090,290,6,42,60),
      ...bitArc(1420,390,7,42,85),...bitArc(1770,185,5),...bitArc(2040,390,7,42,110),...bitArc(2670,390,6),
      ...bitArc(2790,300,7,42,90),...bitLine(3240,77,6),...bitArc(3380,390,7,42,130),...bitArc(3950,390,7),
      ...bitArc(4230,230,5),...bitArc(4640,390,7),...bitArc(5030,185,6),...bitLine(5380,395,4),
    ],
    cores:[{x:1295,y:478,secret:true},{x:3470,y:77,secret:true},{x:4370,y:235}],
    enemies:[
      {type:"bug",x:870,y:420,min:800,max:1130},{type:"drone",x:1510,y:240,min:1420,max:1820},{type:"bug",x:2080,y:420,min:2050,max:2410},
      {type:"bug",x:2720,y:420,min:2690,max:3090},{type:"drone",x:3460,y:190,min:3370,max:3830},{type:"bug",x:4010,y:420,min:3970,max:4370},
      {type:"drone",x:4820,y:250,min:4680,max:5160},{type:"bug",x:5210,y:420,min:5100,max:5400},
    ],
  },
];

for (const level of LEVELS) {
  level.bits = level.bits.map((b, i) => ({ ...b, id:i, collected:false }));
  level.cores = level.cores.map((c, i) => ({ ...c, id:i, collected:false }));
}
