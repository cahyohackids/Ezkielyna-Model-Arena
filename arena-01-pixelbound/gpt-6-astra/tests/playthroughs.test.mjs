import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Player } from '../src/physics.js';
import { buildLevel, updatePlatforms, updateEnemies } from '../src/levels.js';
const recorded = JSON.parse(readFileSync(new URL('./playthroughs.json', import.meta.url), 'utf8'));
for (const run of recorded.runs) test(`sector ${run.index+1}: full start-to-tower input replay with enemies and hazards, zero deaths`,()=>{
  const l=buildLevel(run.index),p=new Player(l.spawn);let t=0,freeze=0,complete=false,checkpoints=0;const dt=1/120;
  for(const action of run.actions){const a=recorded.actions[action];let jump=a.jump,dash=a.dash;
    for(let frame=0;frame<recorded.span;frame++){
      if(freeze>0){freeze-=dt;continue;}t+=dt;updatePlatforms(l,dt,t,p.standing);updateEnemies(l,dt,t);
      const events=p.step(dt,{axis:a.axis,jumpHeld:a.jump,jumpPressed:jump,jumpReleased:!a.jump,dashPressed:dash},l);jump=dash=false;
      assert.ok(!p.dead,'No deaths along complete route');
      for(const e of events){if(e.type==='stomp')freeze=.035;if(e.type==='checkpoint')checkpoints++;if(e.type==='complete')complete=true;}
      if(complete)break;
    }if(complete)break;
  }
  assert.ok(complete,'Signal tower reached entirely through normal movement');assert.equal(p.health,3);assert.ok(checkpoints>=1);assert.ok(l.bits.filter(b=>b.collected).length>=20);
});
