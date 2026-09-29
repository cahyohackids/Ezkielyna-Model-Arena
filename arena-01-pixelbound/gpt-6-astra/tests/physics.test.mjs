import test from 'node:test';
import assert from 'node:assert/strict';
import { Player, PHYSICS } from '../src/physics.js';
import { buildLevel, updatePlatforms, updateEnemies } from '../src/levels.js';
import { SaveStore } from '../src/utils.js';

const dt = 1 / 120;
const idle = { axis: 0, jumpHeld: false, jumpPressed: false, jumpReleased: false, dashPressed: false };
const surface = (x, y, w, h = 50, solid = true, type = 'ground') => ({ x, y, w, h, solid, type, active: true, dx: 0, dy: 0 });
const empty = platforms => ({ width: 3000, platforms, bits: [], cores: [], enemies: [], hazards: [], checkpoints: [], secrets: [], tower: { x: 2900, y: 100 } });
const step = (p,l,n,input={}) => { let events=[]; for(let i=0;i<n;i++) events.push(...p.step(dt, {...idle,...input, jumpPressed: !!input.jumpPressed && i===0, dashPressed: !!input.dashPressed && i===0},l)); return events; };

test('stable floor contact and friction', () => {
  const l = empty([surface(0, 400, 1800)]), p = new Player({x:100,y:370});
  step(p,l,120,{axis:1}); assert.equal(p.y,370); assert.equal(p.vy,0); assert.equal(p.vx,PHYSICS.speed);
  const x = p.x; step(p,l,120); assert.equal(p.vx,0); assert.ok(p.x-x<16); assert.equal(p.y,370);
});
test('jump height, release cut, and air control', () => {
  const l = empty([surface(0,400,1800)]);
  function height(held) { const p = new Player({x:100,y:370}); step(p,l,2); let min=p.y; for(let i=0;i<100;i++){ p.step(dt,{...idle,axis:1,jumpPressed:i===0,jumpHeld:i<held},l); min=Math.min(min,p.y); } return {height:370-min,p}; }
  const full=height(70),tap=height(7); assert.ok(full.height>96 && full.height<104); assert.ok(tap.height<full.height*.65); assert.ok(full.p.x>230);
});
test('coyote time permits a jump 80ms after leaving a ledge', () => {
  const l=empty([surface(0,400,150)]),p=new Player({x:140,y:370}); step(p,l,1); p.x=154;
  step(p,l,9,{axis:1}); assert.ok(!p.grounded); const events=step(p,l,1,{axis:1,jumpHeld:true,jumpPressed:true}); assert.ok(events.some(e=>e.type==='jump')); assert.ok(p.vy<-450);
});
test('expired coyote time does not grant a midair jump',()=>{
  const l=empty([surface(0,400,150)]),p=new Player({x:140,y:370}); step(p,l,1); p.x=154;step(p,l,19);
  assert.ok(!step(p,l,1,{jumpHeld:true,jumpPressed:true}).some(e=>e.type==='jump'));
});
test('buffered jump executes on landing',()=>{
  const l=empty([surface(0,400,1800)]),p=new Player({x:100,y:347});p.vy=250;
  const events=step(p,l,12,{jumpHeld:true,jumpPressed:true}); assert.ok(events.some(e=>e.type==='jump')); assert.ok(p.vy<0);
});
test('dash speed, cooldown, and solid walls do not tunnel',()=>{
  const l=empty([surface(0,400,1800),surface(240,100,16,300)]),p=new Player({x:100,y:370});step(p,l,2);
  step(p,l,12,{dashPressed:true,axis:1});assert.ok(p.x>155);assert.ok(p.cooldown>0);
  step(p,l,24,{axis:1});assert.equal(p.x,218);assert.equal(p.vx,0);
  assert.ok(!step(p,l,1,{dashPressed:true}).some(e=>e.type==='dash'));
});
test('ceilings stop upward motion without embedding',()=>{
  const l=empty([surface(0,400,1800),surface(70,285,130,35)]),p=new Player({x:100,y:370});step(p,l,2);
  let hit=false;for(let i=0;i<35;i++){p.step(dt,{...idle,jumpHeld:true,jumpPressed:i===0},l);if(p.y===320&&p.vy===0)hit=true;assert.ok(p.y>=320);}assert.ok(hit);
});
test('one-way platforms can be entered from below and landed upon',()=>{
  const l=empty([surface(0,400,1800),surface(50,335,180,16,false)]),p=new Player({x:100,y:370});step(p,l,2);step(p,l,110,{jumpHeld:true,jumpPressed:true});assert.equal(p.y,305);assert.ok(p.grounded);
});
test('moving platforms carry without drift or grounded jitter',()=>{
  const l=buildLevel(0),m=l.platforms.find(p=>p.type==='moving'),p=new Player({x:m.x+30,y:m.y-30});
  p.grounded=true;p.standing=m;const relative=p.x-m.x;
  for(let i=1;i<720;i++){updatePlatforms(l,dt,i*dt,p.standing);p.step(dt,idle,l);assert.ok(Math.abs(p.x-m.x-relative)<.001);assert.ok(Math.abs(p.y+30-m.y)<.001);assert.ok(p.grounded);}
});
test('falling platform warns, drops, and returns',()=>{
  const l=buildLevel(1),p=l.platforms.find(p=>p.type==='falling');updatePlatforms(l,dt,0,p);
  for(let i=0;i<60;i++)updatePlatforms(l,dt,i*dt,null);assert.equal(p.y,p.baseY);
  for(let i=0;i<90;i++)updatePlatforms(l,dt,i*dt,null);assert.ok(p.y>p.baseY+100);
  for(let i=0;i<300;i++)updatePlatforms(l,dt,i*dt,null);assert.equal(p.y,p.baseY);assert.ok(p.active);
});
test('spring launch reaches the optional cavern upper route without holding jump',()=>{
  const l=buildLevel(1),b=l.platforms.find(p=>p.type==='bounce'),p=new Player({x:b.x+10,y:b.y-35});let min=p.y;
  for(let i=0;i<120;i++){p.step(dt,idle,l);min=Math.min(min,p.y);}assert.ok(b.y-30-min>200);
});
test('phase blocks have predictable solid and absent windows',()=>{
  const l=buildLevel(2),p=l.platforms.find(p=>p.type==='phase');updatePlatforms(l,dt,1,null);assert.ok(p.active);updatePlatforms(l,dt,3.3,null);assert.ok(!p.active);updatePlatforms(l,dt,4,null);assert.ok(p.active);
});
test('enemy stomp and dash both defeat enemies',()=>{
  for(const dash of [false,true]){const l=empty([surface(0,400,1800)]);l.enemies=[{x:150,y:376,w:26,h:24,alive:true,type:'hopper'}];const p=new Player({x:154,y:dash?370:340});p.vy=dash?0:300;if(dash)p.dash=.1;const events=step(p,l,10,{axis:dash?1:0,jumpHeld:true});assert.ok(!l.enemies[0].alive);assert.ok(events.some(e=>e.type==='stomp'));assert.equal(p.health,3);}
});
test('damage removes one cell, applies knockback, and respects invulnerability',()=>{
  const p=new Player({x:100,y:100}),events=[];p.hurt(140,events);p.hurt(140,events);assert.equal(p.health,2);assert.ok(p.vx<0 && p.vy<0);assert.equal(events.length,1);
});
test('bits and cores collect once, checkpoints refill once, and death is emitted',()=>{
  const l=empty([surface(0,400,1800)]),p=new Player({x:100,y:370});p.health=1;
  l.bits=[{x:111,y:385,id:0}];l.cores=[{x:111,y:385,id:0}];l.checkpoints=[{x:112,y:400}];
  const events=step(p,l,10);assert.equal(events.filter(e=>e.type==='bit').length,1);assert.equal(events.filter(e=>e.type==='core').length,1);assert.equal(events.filter(e=>e.type==='checkpoint').length,1);assert.equal(p.health,3);
  p.health=0;assert.ok(step(p,l,1).some(e=>e.type==='death'));assert.ok(p.dead);
});
test('tower emits level completion on contact',()=>{
  const l=empty([surface(0,400,3000)]);l.tower={x:2700,y:370};const p=new Player({x:2670,y:370});assert.ok(step(p,l,1).some(e=>e.type==='complete'));
});
test('all three levels contain 50 bits, three cores, checkpoints, secrets, and live enemies',()=>{
  for(let i=0;i<3;i++){const l=buildLevel(i);assert.equal(l.bits.length,50);assert.equal(l.cores.length,3);assert.ok(l.checkpoints.length>=2);assert.ok(l.secrets.length>=1);updateEnemies(l,dt,1);assert.ok(l.enemies.every(e=>Number.isFinite(e.x)&&Number.isFinite(e.y)));}
});
test('saves persist unlocks, best time, distinct cores, and settings',()=>{
  let text=null;const storage={getItem:()=>text,setItem:(k,v)=>text=v};const s=new SaveStore(storage);
  s.complete(0,{time:45,bits:23,cores:[0,2]});s.complete(0,{time:55,bits:30,cores:[1]});s.data.settings.mute=true;s.save();const loaded=new SaveStore(storage);
  assert.equal(loaded.data.unlocked,2);assert.equal(loaded.data.records[0].best,45);assert.equal(loaded.data.records[0].bits,30);assert.equal(loaded.data.records[0].cores.length,3);assert.ok(loaded.data.settings.mute);
});
test('blocked or corrupt local storage does not prevent play',()=>{
  const s=new SaveStore({getItem:()=>'{bad',setItem:()=>{throw new Error('blocked')}});assert.equal(s.data.unlocked,1);assert.doesNotThrow(()=>s.save());
});
