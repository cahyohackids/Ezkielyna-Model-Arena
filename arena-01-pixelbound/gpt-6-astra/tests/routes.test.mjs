import {Player} from '../src/physics.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildLevel,updatePlatforms} from '../src/levels.js';
const dt=1/120;
function attempt(index, fromId, toId, startX, phase, dashAt, heldFrames=100) {
 const l=buildLevel(index);l.enemies=[];l.hazards=[];l.bits=[];l.cores=[];l.checkpoints=[];l.secrets=[];
 updatePlatforms(l,dt,phase,null);
 const from=l.platforms[fromId],to=l.platforms[toId];
 if(!from.active)return null;
 const p=new Player({x:Math.max(from.x,Math.min(from.x+from.w-22,startX)),y:from.y-30});p.grounded=true;p.standing=from;
 const dir=Math.sign(to.x+to.w/2-(p.x+11));p.vx=dir*226;p.facing=dir;
 for(let i=0;i<200;i++){
   updatePlatforms(l,dt,phase+i*dt,p.standing);
   const center=p.x+11, target=Math.max(to.x+14,Math.min(to.x+to.w-14,to.x+to.w/2));
   let axis=Math.abs(target-center)<12?0:Math.sign(target-center);
   if(p.dash>0)axis=dir;
   p.step(dt,{axis,jumpHeld:i<heldFrames,jumpPressed:i===0 && from.type!=='bounce',jumpReleased:i===heldFrames,dashPressed:i===dashAt},l);
   if(p.dead)return null;
   if(i>8&&p.grounded&&p.standing?.id!==fromId)return p.standing.id===toId?{startX,phase,dashAt,frames:i+1}:null;
 }
 return null;
}
for(let index=0;index<3;index++) test(`sector ${index+1}: every platform, core route and tower is reachable with real physics`,()=>{
 const level=buildLevel(index), edges=new Map();
 for(const from of level.platforms){const found=[];
  for(const to of level.platforms){if(from.id===to.id||to.type==='bounce')continue;
   const minDist=Math.max(0,to.x-from.x-from.w,from.x-to.x-to.w);
   if(minDist>270||from.y-to.y>(from.type==='bounce'?240:110))continue;
   const dir=to.x+to.w/2>from.x+from.w/2?1:-1;
   const start=dir>0?Math.min(from.x+from.w-23,to.x-70):Math.max(from.x+1,to.x+to.w+50);
   let hit=null;
   outer:for(const phase of [0,1,2,3,4.5,6])for(const x of [start,start-dir*35,start-dir*65])for(const dash of [-1,13,29,44]){hit=attempt(index,from.id,to.id,x,phase,dash);if(hit)break outer;}
   if(hit)found.push({to:to.id,...hit});
  }edges.set(from.id,found);
 }
 // Bounce pads may be walked onto from their supporting ground.
 for(const b of level.platforms.filter(p=>p.type==='bounce'))for(const g of level.platforms.filter(p=>p.type==='ground'&&b.x>=p.x&&b.x+b.w<=p.x+p.w&&Math.abs(b.y+8-p.y)<2))edges.get(g.id).push({to:b.id,walk:true});
 const seen=new Set([0]),queue=[0],parent={};while(queue.length){const a=queue.shift();for(const e of edges.get(a)){if(!seen.has(e.to)){seen.add(e.to);queue.push(e.to);parent[e.to]={from:a,...e};}}}
 const unreachable=level.platforms.filter(p=>!seen.has(p.id)).map(p=>({id:p.id,x:p.x,y:p.y,type:p.type}));
 const corePlatforms=level.cores.map(c=>level.platforms.filter(p=>c.x>=p.x&&c.x<=p.x+p.w&&p.y>c.y).sort((a,b)=>a.y-b.y)[0].id);
 const tower=level.platforms.filter(p=>level.tower.x>=p.x&&level.tower.x<=p.x+p.w).sort((a,b)=>a.y-b.y)[0].id;
 assert.ok(seen.has(tower),'Tower reachable');
 assert.ok(corePlatforms.every(id=>seen.has(id)),'All core routes reachable');
 assert.deepEqual(unreachable,[],'All platforms reachable');
});
