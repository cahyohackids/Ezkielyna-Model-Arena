const P = (x,y,w,h=24,type='static',extra={}) => ({x,y,w,h,type,...extra});
const B = (x,y) => ({x,y});
const E = (type,x,y,extra={}) => ({type,x,y,...extra});

export const LEVELS = [
  {
    id: 1, name: 'SIGNAL MEADOW', subtitle: 'GREENLINE OUTER REACH', theme: 'meadow', width: 5100, spawn:{x:88,y:520},
    tip:'Follow the relay lights. A shining crack in the hillside hides old packets.',
    platforms:[
      P(0,620,560,120),P(675,620,700,120),P(1495,620,700,120),P(2315,620,840,120),P(3280,620,740,120),P(4140,620,960,120),
      P(230,500,150),P(460,445,125),P(810,510,150),P(1110,445,120),P(1270,380,140),P(1600,500,160),P(1810,435,145),
      P(2110,515,120),P(2470,485,145),P(2815,420,160),P(3040,350,110),P(3410,500,155),P(3650,430,130),P(3910,470,135),
      P(4290,490,135),P(4490,420,130),P(4680,505,190),
      P(570,545,96,20,'moving',{axis:'x',range:120,speed:1.2}),
      P(2030,535,90,20,'moving',{axis:'y',range:120,speed:1.1}),
      P(1010,555,92,20,'phase',{cycle:3.2,offset:.6}),
      P(2910,525,88,18,'phase',{cycle:2.6,offset:1.1}),
      P(3870,570,86,18,'bounce')
    ],
    bits:[B(280,455),B(335,455),B(505,400),B(605,500),B(835,465),B(900,465),B(1055,510),B(1150,400),B(1315,335),B(1650,455),B(1870,390),B(2070,490),B(2160,470),B(2510,440),B(2570,440),B(2870,375),B(3090,305),B(3470,455),B(3710,385),B(3915,425),B(3980,425),B(4320,445),B(4515,375),B(4750,460)],
    cores:[B(1325,330),B(3095,300),B(3980,425)],
    enemies:[E('hopper',880,572,{min:720,max:1260}),E('hopper',1740,572,{min:1530,max:2150}),E('bug',2680,572,{min:2380,max:3110}),E('hopper',3500,572,{min:3330,max:3980}),E('bug',4410,572,{min:4200,max:4700})],
    hazards:[{type:'spikes',x:1330,y:588,w:78,h:32},{type:'spikes',x:1920,y:588,w:82,h:32},{type:'spikes',x:3150,y:588,w:96,h:32},{type:'spikes',x:4010,y:588,w:95,h:32}],
    checkpoints:[{x:1980,y:552},{x:3860,y:552}], tower:{x:4825,y:454,w:76,h:166}, signs:[{x:95,y:572,text:'RUN // JUMP'},{x:1420,y:572,text:'UPLINK 01'},{x:3200,y:572,text:'CHECKPOINT →'}]
  },
  {
    id: 2, name: 'CIRCUIT CAVERNS', subtitle: 'SUBSTRATE 09', theme: 'cavern', width: 5480, spawn:{x:90,y:520},
    tip:'The cave breathes in cycles. Loose data blocks fall after you land on them.',
    platforms:[
      P(0,620,620,120),P(740,620,580,120),P(1450,620,480,120),P(2060,620,760,120),P(2940,620,540,120),P(3590,620,700,120),P(4420,620,1060,120),
      P(210,500,145),P(430,430,120),P(770,500,110),P(1030,450,125),P(1200,385,100),P(1510,500,130),P(1740,440,100),
      P(1990,540,80,18,'bounce'),P(2200,480,110),P(2370,400,110),P(2540,315,120),P(2700,390,90),P(3010,505,120),P(3250,425,130),
      P(3670,510,105),P(3860,435,110),P(4070,355,105),P(4300,490,100),P(4550,500,120),P(4780,425,110),P(4990,350,120),P(5170,470,180),
      P(625,535,100,20,'moving',{axis:'x',range:130,speed:1.3}),P(1330,520,90,20,'falling'),P(1900,510,90,20,'falling'),P(2815,540,100,20,'moving',{axis:'y',range:150,speed:1.15}),P(3450,520,88,20,'phase',{cycle:2.7,offset:.2}),P(4210,470,85,20,'moving',{axis:'x',range:130,speed:1.4}),P(4680,550,90,20,'bounce')
    ],
    bits:[B(250,455),B(465,385),B(655,500),B(800,455),B(1060,405),B(1230,340),B(1365,475),B(1540,455),B(1780,395),B(2030,495),B(2230,435),B(2400,355),B(2575,270),B(2730,345),B(2860,490),B(3050,460),B(3300,380),B(3490,470),B(3705,465),B(3890,390),B(4100,310),B(4240,425),B(4340,445),B(4580,455),B(4710,505),B(4810,380),B(5030,305),B(5200,425)],
    cores:[B(1240,340),B(2585,270),B(4100,310)],
    enemies:[E('hopper',820,572,{min:760,max:1280}),E('drone',1180,290,{min:1030,max:1370,amp:48}),E('bug',1560,572,{min:1470,max:1900}),E('drone',2440,250,{min:2260,max:2740,amp:70}),E('hopper',3120,572,{min:2970,max:3450}),E('drone',3970,290,{min:3740,max:4250,amp:45}),E('bug',4650,572,{min:4450,max:5050})],
    hazards:[{type:'spikes',x:630,y:588,w:90,h:32},{type:'spikes',x:1325,y:588,w:100,h:32},{type:'spikes',x:1935,y:588,w:110,h:32},{type:'spikes',x:2825,y:588,w:100,h:32},{type:'spikes',x:3490,y:588,w:86,h:32},{type:'spikes',x:4300,y:588,w:100,h:32}],
    checkpoints:[{x:1945,y:552},{x:4330,y:552}], tower:{x:5340,y:454,w:76,h:166}, signs:[{x:75,y:572,text:'CAVERN ROUTE'},{x:1410,y:572,text:'UNSTABLE BLOCKS'},{x:3500,y:572,text:'VERTICAL LINK'}]
  },
  {
    id: 3, name: 'GLITCH TOWER', subtitle: 'RELAY CORE // UNSTABLE', theme: 'tower', width: 5700, spawn:{x:90,y:520},
    tip:'Corruption pulses through the tower. Dash through clear lanes; phase blocks keep a steady rhythm.',
    platforms:[
      P(0,620,520,120),P(680,620,530,120),P(1360,620,480,120),P(1980,620,500,120),P(2620,620,530,120),P(3300,620,530,120),P(3980,620,580,120),P(4700,620,1000,120),
      P(180,500,130),P(390,430,95),P(735,510,95),P(920,440,100),P(1110,360,95),P(1410,510,100),P(1620,430,110),P(1870,515,90),
      P(2100,450,105),P(2310,365,100),P(2510,505,90),P(2720,470,105),P(2940,390,100),P(3160,500,90),P(3390,430,100),P(3600,350,100),P(3820,490,100),
      P(4060,420,100),P(4290,335,95),P(4480,470,105),P(4780,500,100),P(4970,420,110),P(5180,340,125),P(5400,465,190),
      P(530,540,95,20,'moving',{axis:'x',range:150,speed:1.4}),P(1220,520,90,20,'phase',{cycle:2.1,offset:0}),P(1840,545,90,20,'bounce'),P(2470,535,100,20,'phase',{cycle:2.2,offset:1}),P(3160,545,90,20,'moving',{axis:'y',range:140,speed:1.3}),P(3830,535,100,20,'phase',{cycle:1.9,offset:.5}),P(4590,540,95,20,'moving',{axis:'x',range:130,speed:1.5})
    ],
    bits:[B(220,455),B(415,385),B(555,500),B(760,465),B(945,395),B(1140,315),B(1245,480),B(1440,465),B(1660,385),B(1890,470),B(2140,405),B(2340,320),B(2520,460),B(2750,425),B(2970,345),B(3185,455),B(3420,385),B(3630,305),B(3850,445),B(4090,375),B(4320,290),B(4510,425),B(4620,490),B(4810,455),B(5000,375),B(5210,295),B(5450,420)],
    cores:[B(1140,315),B(3630,305),B(4320,290)],
    enemies:[E('bug',780,572,{min:700,max:1180}),E('drone',1050,270,{min:900,max:1280,amp:60}),E('hopper',1450,572,{min:1380,max:1810}),E('drone',2260,270,{min:2110,max:2480,amp:55}),E('bug',2750,572,{min:2640,max:3110}),E('drone',3520,250,{min:3350,max:3780,amp:65}),E('bug',4090,572,{min:4000,max:4500}),E('drone',5040,250,{min:4840,max:5290,amp:70})],
    hazards:[{type:'spikes',x:520,y:588,w:135,h:32},{type:'spikes',x:1220,y:588,w:120,h:32},{type:'spikes',x:1845,y:588,w:110,h:32},{type:'spikes',x:2490,y:588,w:115,h:32},{type:'spikes',x:3160,y:588,w:120,h:32},{type:'spikes',x:3850,y:588,w:110,h:32},{type:'spikes',x:4580,y:588,w:115,h:32}, {type:'laser',x:2180,y:492,w:18,h:128,range:120,speed:1.3}, {type:'laser',x:4110,y:340,w:18,h:170,range:150,speed:1.55}],
    checkpoints:[{x:1905,y:552},{x:4530,y:552}], tower:{x:5585,y:454,w:76,h:166}, signs:[{x:60,y:572,text:'CORE ACCESS'},{x:1250,y:572,text:'DASH LANES'},{x:4700,y:572,text:'FINAL RELAY'}]
  }
];

export function cloneLevel(source) {
  return {
    ...source,
    platforms: source.platforms.map(p=>({...p,baseX:p.x,baseY:p.y,dx:0,dy:0,fallen:false,fallTimer:0})),
    bits: source.bits.map((b,i)=>({...b,id:i,collected:false,phase:i*.52})),
    cores: source.cores.map((b,i)=>({...b,id:i,collected:false,phase:i*.85})),
    enemies: source.enemies.map((e,i)=>({...e,id:i,w:e.type==='drone'?34:36,h:e.type==='drone'?30:34,vx:e.type==='hopper'?-58:-70,alive:true,phase:i*.73,charge:0,hit:0})),
    hazards: source.hazards.map(h=>({...h,baseX:h.x,baseY:h.y,phase:Math.random()*4})),
    checkpoints: source.checkpoints.map(c=>({...c,active:false})),
    tower:{...source.tower,active:false}
  };
}
