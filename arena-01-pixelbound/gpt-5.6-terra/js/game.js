import { LEVELS, cloneLevel } from './levels.js';
import { AudioManager } from './audio.js';

const W = 1280, H = 720;
const clamp = (n,min,max) => Math.max(min,Math.min(max,n));
const lerp = (a,b,t) => a+(b-a)*t;
const overlap = (a,b) => a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
const ease = t => 1-Math.pow(1-t,3);

class InputManager {
  constructor() {
    this.down = Object.create(null); this.pressed = Object.create(null);
    const map = {ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',Space:'jump',KeyW:'jump',ArrowUp:'jump',ShiftLeft:'dash',ShiftRight:'dash',KeyR:'restart',Escape:'pause'};
    addEventListener('keydown', e => { const k=map[e.code]; if(!k) return; if(['left','right','jump','dash','pause'].includes(k)) e.preventDefault(); if(!this.down[k]) this.pressed[k]=true; this.down[k]=true; });
    addEventListener('keyup', e => { const k=map[e.code]; if(k) this.down[k]=false; });
    addEventListener('blur',()=>{ this.down=Object.create(null); });
  }
  tap(k){ this.pressed[k]=true; this.down[k]=true; }
  release(k){ this.down[k]=false; }
  consume(k){ const v=this.pressed[k]; delete this.pressed[k]; return v; }
  endFrame(){ this.pressed=Object.create(null); }
}

class ParticleSystem {
  constructor(){this.items=[];}
  burst(x,y,opts={}) {
    const {count=7,color='#6fe0cb',speed=120,size=4,life=.42,gravity=320,spread=Math.PI*2}=opts;
    for(let i=0;i<count;i++){const a=(-Math.PI/2-spread/2)+Math.random()*spread;const s=speed*(.45+Math.random()*.7);this.items.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:life*(.65+Math.random()*.45),max:life,size:size*(.6+Math.random()*.7),color,gravity,kind:opts.kind||'square'});}
  }
  update(dt, reduced){ for(const p of this.items){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=p.gravity*dt;} this.items=this.items.filter(p=>p.life>0).slice(- (reduced?100:320)); }
  draw(ctx,cam){ for(const p of this.items){const a=clamp(p.life/p.max,0,1);ctx.globalAlpha=a;ctx.fillStyle=p.color;const s=Math.max(1,Math.round(p.size*a));if(p.kind==='spark'){ctx.fillRect(Math.round(p.x-cam.x-s*2),Math.round(p.y-cam.y),s*4,s);ctx.fillRect(Math.round(p.x-cam.x),Math.round(p.y-cam.y-s*2),s,s*4);}else ctx.fillRect(Math.round(p.x-cam.x-s/2),Math.round(p.y-cam.y-s/2),s,s);}ctx.globalAlpha=1; }
}

class Game {
  constructor() {
    this.canvas=document.querySelector('#game'); this.ctx=this.canvas.getContext('2d'); this.ctx.imageSmoothingEnabled=false;
    this.input=new InputManager(); this.hud=document.querySelector('#hud'); this.toastEl=document.querySelector('#toast'); this.particles=new ParticleSystem();
    this.settings=this.load('pixelbound-lost-signal-settings',{music:45,sfx:70,mute:false,shake:true,motion:false});
    this.save=this.load('pixelbound-lost-signal-save',{unlocked:1,records:{}}); this.audio=new AudioManager(this.settings);
    this.state='menu'; this.levelIndex=0; this.level=null; this.player=null; this.camera={x:0,y:0,shake:0}; this.worldTime=0; this.last=performance.now(); this.deaths=0; this.runBits=0; this.runCores=0; this.respawn=null; this.deathTimer=0; this.toastTimer=0; this.pauseSettings=false;
    this.bindUI(); this.syncSettingsUI(); this.renderCards(); this.show('menu'); requestAnimationFrame(t=>this.loop(t));
  }
  load(key, fallback){try{return {...fallback,...JSON.parse(localStorage.getItem(key)||'{}')}}catch{return fallback}}
  store(){localStorage.setItem('pixelbound-lost-signal-save',JSON.stringify(this.save));localStorage.setItem('pixelbound-lost-signal-settings',JSON.stringify(this.settings));}
  bindUI(){
    document.querySelectorAll('[data-action]').forEach(b=>b.addEventListener('click',()=>{this.audio.wake();this.action(b.dataset.action)}));
    document.querySelectorAll('.touch-button').forEach(b=>{const key=b.dataset.key;const down=e=>{e.preventDefault();this.audio.wake();this.input.tap(key)};const up=e=>{e.preventDefault();this.input.release(key)};b.addEventListener('pointerdown',down);b.addEventListener('pointerup',up);b.addEventListener('pointercancel',up);b.addEventListener('pointerleave',e=>{if(e.buttons===0)up(e)});});
    const connect=(id,key,valueId)=>{const el=document.querySelector(id);el.addEventListener('input',()=>{this.settings[key]=Number(el.value);document.querySelector(valueId).textContent=`${el.value}%`;this.store();});}; connect('#music-volume','music','#music-value');connect('#sfx-volume','sfx','#sfx-value');
    [['#mute','mute'],['#shake','shake'],['#motion','motion']].forEach(([id,key])=>document.querySelector(id).addEventListener('change',e=>{this.settings[key]=e.target.checked;this.store();}));
  }
  syncSettingsUI(){
    document.querySelector('#music-volume').value=this.settings.music;document.querySelector('#sfx-volume').value=this.settings.sfx;document.querySelector('#music-value').textContent=`${this.settings.music}%`;document.querySelector('#sfx-value').textContent=`${this.settings.sfx}%`;
    document.querySelector('#mute').checked=this.settings.mute;document.querySelector('#shake').checked=this.settings.shake;document.querySelector('#motion').checked=this.settings.motion;
  }
  action(name){
    if(name==='play'){this.startLevel(Math.min(this.save.unlocked,3)-1);return;}
    if(name==='select'){this.hud.classList.add('hidden');this.show('level-select');this.renderCards();return;}
    if(name==='menu'){this.state='menu';this.hud.classList.add('hidden');this.show('menu');return;}
    if(name==='howto'||name==='settings'){this.pauseSettings=false;this.show(name);return;}
    if(name==='settings-pause'){this.pauseSettings=true;this.show('settings');return;}
    if(name==='settings-back'){if(this.pauseSettings){this.pauseSettings=false;this.show('pause');}else this.show('menu');return;}
    if(name==='resume'){this.state='playing';this.hideScreens();this.hud.classList.remove('hidden');return;}
    if(name==='restart'||name==='replay'){this.startLevel(this.levelIndex);return;}
    if(name==='retry'){this.respawnPlayer();this.state='playing';this.hideScreens();this.hud.classList.remove('hidden');return;}
    if(name==='next'){this.startLevel(Math.min(2,this.levelIndex+1));return;}
  }
  show(id){ document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active')); const target=document.querySelector('#'+id);if(target)target.classList.add('active'); }
  hideScreens(){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));}
  renderCards(){
    const colors=['linear-gradient(135deg,#53b99e,#245e86)','linear-gradient(135deg,#202e58,#6f52a2)','linear-gradient(135deg,#3e234f,#bd546b)'];
    document.querySelector('#level-cards').innerHTML=LEVELS.map((l,i)=>{const locked=i+1>this.save.unlocked;const r=this.save.records[l.id]||{};return `<article class="level-card ${locked?'locked':''}" style="--card-color:${colors[i]}"><span class="sector">SECTOR 0${l.id}</span><h3>${l.name}</h3><p>${l.subtitle}</p><p class="progress">◆ ${r.bits||0}/${l.bits.length} &nbsp; ◈ ${r.cores||0}/3</p><button ${locked?'disabled':''} data-level="${i}">${locked?'LOCKED // RESTORE PREVIOUS':'ENTER SECTOR'}</button></article>`;}).join('');
    document.querySelectorAll('[data-level]').forEach(b=>b.addEventListener('click',()=>{this.audio.wake();this.startLevel(Number(b.dataset.level));}));
  }
  startLevel(index){
    this.levelIndex=index; this.level=cloneLevel(LEVELS[index]); this.player=this.makePlayer(this.level.spawn); this.respawn={...this.level.spawn}; this.deaths=0;this.runBits=0;this.runCores=0;this.worldTime=0;this.particles.items=[];this.camera={x:0,y:0,shake:0};this.state='playing';
    this.hideScreens();this.hud.classList.remove('hidden');document.querySelector('#level-label').textContent=this.level.name;this.audio.wake();this.toast(this.level.tip,3.5);this.updateHud();
  }
  makePlayer(s){return {x:s.x,y:s.y,w:34,h:44,vx:0,vy:0,facing:1,grounded:false,coyote:0,jumpBuffer:0,dashTime:0,dashCooldown:0,health:3,invuln:0,squash:0,landing:0,trail:0,anim:0,dead:false};}
  respawnPlayer(){ const held={};this.player={...this.makePlayer(this.respawn),...held};this.particles.burst(this.player.x+17,this.player.y+24,{count:16,color:'#6fe0cb',speed:160,size:5,life:.55,kind:'spark'});this.camera.shake=.12;this.toast('RECONNECTED AT TERMINAL',1.5); }
  toast(msg,seconds=1.8){this.toastEl.textContent=msg;this.toastEl.classList.add('show');this.toastTimer=seconds;}
  pause(){if(this.state==='playing'){this.state='paused';this.hud.classList.add('hidden');this.show('pause');}}
  die(){if(this.player.dead)return;this.player.dead=true;this.deaths++;this.state='dying';this.deathTimer=.72;this.audio.effect('hurt');this.particles.burst(this.player.x+17,this.player.y+22,{count:22,color:'#ff6d7c',speed:250,size:5,life:.7,kind:'spark'});this.bump(.2);}
  damage(fromX){const p=this.player;if(p.invuln>0||p.dead||this.state!=='playing')return;p.health--;p.invuln=1.15;p.vx=(p.x+17<fromX?-1:1)*330;p.vy=-370;p.squash=.2;this.audio.effect('hurt');this.particles.burst(p.x+17,p.y+23,{count:10,color:'#ff6d7c',speed:180,size:4,life:.4});this.bump(.11);if(p.health<=0)this.die();}
  bump(amount){if(this.settings.shake&&!this.settings.motion)this.camera.shake=Math.max(this.camera.shake,amount);}
  loop(now){const dt=Math.min(.033,(now-this.last)/1000);this.last=now;this.update(dt);this.draw();requestAnimationFrame(t=>this.loop(t));}
  update(dt){
    this.worldTime+=dt;
    if(this.toastTimer>0){this.toastTimer-=dt;if(this.toastTimer<=0)this.toastEl.classList.remove('show');}
    if(this.state==='playing'){
      if(this.input.consume('pause')){this.pause();this.input.endFrame();return;} if(this.input.consume('restart')){this.startLevel(this.levelIndex);this.input.endFrame();return;}
      this.updatePlatforms(dt);this.updatePlayer(dt);if(this.state==='playing'){this.updateEnemies(dt);this.updateInteractions();this.updateHazards();}this.updateCamera(dt);
    } else if(this.state==='dying') {this.deathTimer-=dt;if(this.deathTimer<=0){this.hud.classList.add('hidden');this.show('lost');this.state='lost';}}
    else if(this.state==='paused' && this.input.consume('pause')) this.action('resume');
    else if(this.state==='menu' && this.input.consume('pause')) this.input.consume('pause');
    this.particles.update(dt,this.settings.motion);this.updateHud();this.input.endFrame();
  }
  collidable(pl){return !pl.fallen && (pl.type!=='phase'||this.phaseVisible(pl));}
  phaseVisible(pl){return ((this.worldTime+(pl.offset||0))%(pl.cycle||2.5)) < (pl.cycle||2.5)*.62;}
  updatePlatforms(dt){
    for(const pl of this.level.platforms){pl.dx=0;pl.dy=0;
      if(pl.type==='moving'){const oldX=pl.x,oldY=pl.y;const phase=this.worldTime*(pl.speed||1);if(pl.axis==='x')pl.x=pl.baseX+Math.sin(phase)*pl.range;else pl.y=pl.baseY+Math.sin(phase)*pl.range;pl.dx=pl.x-oldX;pl.dy=pl.y-oldY;}
      if(pl.type==='falling'){
        if(pl.fallTimer){pl.fallTimer-=dt;if(pl.fallTimer<=0){pl.fallTimer=0;pl.dropping=true;this.particles.burst(pl.x+pl.w/2,pl.y+pl.h,{count:7,color:'#f6a858',speed:80,size:3,life:.35});}else if(pl.fallTimer<.22)pl.x=pl.baseX+(Math.random()-.5)*3;}
        if(pl.dropping){const oldY=pl.y;pl.y+=780*dt;pl.dy=pl.y-oldY;if(pl.y>790)pl.fallen=true;}
      }
    }
  }
  updatePlayer(dt){
    const p=this.player;p.anim+=dt;p.invuln=Math.max(0,p.invuln-dt);p.dashCooldown=Math.max(0,p.dashCooldown-dt);p.squash=Math.max(0,p.squash-dt*2.8);p.landing=Math.max(0,p.landing-dt*4);
    if(this.input.consume('jump'))p.jumpBuffer=.135; else p.jumpBuffer=Math.max(0,p.jumpBuffer-dt); p.coyote=Math.max(0,p.coyote-dt);
    const axis=(this.input.down.right?1:0)-(this.input.down.left?1:0); if(axis)p.facing=axis;
    if(this.input.consume('dash')&&p.dashCooldown<=0&&!p.dead){p.dashTime=.145;p.dashCooldown=.58;p.vx=p.facing*960;p.vy*=.18;p.trail=.16;this.audio.effect('dash');this.particles.burst(p.x+17-p.facing*13,p.y+22,{count:10,color:'#78ebd4',speed:170,size:4,life:.35,spread:1.5});this.bump(.045);}
    if(p.dashTime>0){p.dashTime-=dt;p.vx=p.facing*960;if(Math.random()>.35)this.particles.items.push({x:p.x+17-p.facing*12,y:p.y+23,vx:-p.facing*35,vy:0,life:.2,max:.2,size:11,color:'#6fe0cb',gravity:0,kind:'square'});} else {
      const max=275, accel=p.grounded?2450:1350, decel=p.grounded?3100:850; if(axis){p.vx+=axis*accel*dt;if(Math.sign(p.vx)!==axis&&Math.abs(p.vx)<accel*dt*1.2)p.vx=0;p.vx=clamp(p.vx,-max,max);} else p.vx=Math.sign(p.vx)*Math.max(0,Math.abs(p.vx)-decel*dt);
      if(p.jumpBuffer>0&&p.coyote>0){p.vy=-720;p.grounded=false;p.coyote=0;p.jumpBuffer=0;p.squash=.1;this.audio.effect('jump');this.particles.burst(p.x+17,p.y+p.h,{count:6,color:'#bfdde3',speed:105,size:3,life:.3,spread:1.8});}
      const gravity=p.vy<0?(this.input.down.jump?1850:3100):2550;p.vy=Math.min(p.vy+gravity*dt,780);
    }
    p.grounded=false;
    p.x+=p.vx*dt;for(const pl of this.level.platforms){if(!this.collidable(pl)||!overlap(p,pl))continue;if(p.vx>0){p.x=pl.x-p.w;p.vx=0;}else if(p.vx<0){p.x=pl.x+pl.w;p.vx=0;}}
    p.y+=p.vy*dt;for(const pl of this.level.platforms){if(!this.collidable(pl)||!overlap(p,pl))continue;if(p.vy>=0){const wasAir=!p.grounded;p.y=pl.y-p.h;if(pl.type==='bounce'){p.vy=-980;p.grounded=false;p.coyote=0;p.squash=.15;this.audio.effect('jump');this.particles.burst(p.x+17,pl.y,{count:10,color:'#ffbc61',speed:150,size:4,life:.35,spread:2.4});}else{p.vy=0;p.grounded=true;p.coyote=.12;if(pl.dx)p.x+=pl.dx;if(wasAir&&p.landing<=0){p.landing=.14;p.squash=.14;this.audio.effect('land');this.particles.burst(p.x+17,pl.y,{count:5,color:'#c8e2d6',speed:75,size:3,life:.28,spread:1.9});}if(pl.type==='falling'&&!pl.fallTimer&&!pl.dropping)pl.fallTimer=.42;}}else if(p.vy<0){p.y=pl.y+pl.h;p.vy=0;}}
    p.x=clamp(p.x,0,this.level.width-p.w); if(p.y>790)this.die();
  }
  updateEnemies(dt){
    const p=this.player;
    for(const e of this.level.enemies){if(!e.alive)continue;e.hit=Math.max(0,e.hit-dt);
      if(e.type==='drone'){e.x=e.min+(Math.sin(this.worldTime*1.25+e.phase)+1)/2*(e.max-e.min);e.y=(e.baseY??e.y);if(e.baseY===undefined)e.baseY=e.y;e.y=e.baseY+Math.sin(this.worldTime*2.2+e.phase)*e.amp;}
      else {let speed=e.type==='bug'?90:62;if(e.type==='bug'&&Math.sin(this.worldTime*1.2+e.phase)>.77)speed=185;e.x+=Math.sign(e.vx)*speed*dt;if(e.x<e.min||e.x>e.max){e.x=clamp(e.x,e.min,e.max);e.vx*=-1;}}
      if(overlap(p,e)&&p.invuln<=0){if(p.dashTime>0){this.killEnemy(e,true);continue;}if(p.vy>80 && p.y+p.h < e.y+20){this.killEnemy(e,false);p.vy=-430;p.squash=.13;this.bump(.05);}else this.damage(e.x+e.w/2);}
    }
  }
  killEnemy(e,dashed){e.alive=false;this.audio.effect('stomp');this.particles.burst(e.x+e.w/2,e.y+e.h/2,{count:14,color:dashed?'#6fe0cb':'#ffad57',speed:190,size:4,life:.5,kind:'spark'});this.bump(.065);}
  updateInteractions(){
    const p=this.player, center={x:p.x+p.w/2,y:p.y+p.h/2};
    for(const b of this.level.bits)if(!b.collected&&Math.hypot(center.x-b.x,center.y-b.y)<33){b.collected=true;this.runBits++;this.audio.effect('bit');this.particles.burst(b.x,b.y,{count:8,color:'#6fe0cb',speed:150,size:4,life:.4,kind:'spark'});}
    for(const c of this.level.cores)if(!c.collected&&Math.hypot(center.x-c.x,center.y-c.y)<37){c.collected=true;this.runCores++;this.audio.effect('core');this.particles.burst(c.x,c.y,{count:18,color:'#ffad57',speed:170,size:4,life:.6,kind:'spark'});this.toast('DATA CORE RECOVERED',1.7);}
    for(const c of this.level.checkpoints)if(!c.active&&overlap(p,{x:c.x-8,y:c.y,w:34,h:68})){c.active=true;this.respawn={x:c.x-4,y:566};this.audio.effect('check');this.particles.burst(c.x+10,c.y+18,{count:14,color:'#6fe0cb',speed:145,size:4,life:.55,kind:'spark'});this.toast('CHECKPOINT SYNCHRONIZED',1.7);}
    const t=this.level.tower;if(!t.active&&overlap(p,t)){t.active=true;this.completeLevel();}
  }
  updateHazards(){const p=this.player;for(const h of this.level.hazards){if(h.type==='laser'){h.x=h.baseX+Math.sin(this.worldTime*h.speed+h.phase)*h.range;h.active=Math.sin(this.worldTime*h.speed+h.phase)>-.35;}if((h.active!==false)&&overlap(p,h))this.damage(h.x+h.w/2);}}
  updateCamera(dt){const p=this.player;const tx=clamp(p.x-W*.38+p.vx*.13,0,this.level.width-W);const ty=clamp(p.y-375,0,105);this.camera.x=lerp(this.camera.x,tx,1-Math.pow(.0008,dt));this.camera.y=lerp(this.camera.y,ty,1-Math.pow(.0008,dt));this.camera.shake=Math.max(0,this.camera.shake-dt*2.4);}
  completeLevel(){
    this.state='complete';this.audio.effect('tower');this.particles.burst(this.level.tower.x+38,this.level.tower.y+32,{count:44,color:'#fff2cd',speed:280,size:5,life:1.05,kind:'spark'});this.bump(.18);
    const time=Math.floor(this.worldTime*10)/10, old=this.save.records[this.level.id]||{};this.save.records[this.level.id]={bits:Math.max(old.bits||0,this.runBits),cores:Math.max(old.cores||0,this.runCores),time:Math.min(old.time||Infinity,time)};this.save.unlocked=Math.max(this.save.unlocked,Math.min(3,this.levelIndex+2));this.store();this.renderCards();
    const next=this.levelIndex<2?'NEXT SECTOR':'LEVEL SELECT';document.querySelector('#results').innerHTML=`<div class="result">TIME<strong>${this.formatTime(time)}</strong></div><div class="result">DEATHS<strong>${this.deaths}</strong></div><div class="result">SIGNAL BITS<strong>◆ ${this.runBits} / ${this.level.bits.length}</strong></div><div class="result">DATA CORES<strong>◈ ${this.runCores} / 3</strong></div>`;setTimeout(()=>{this.hud.classList.add('hidden');this.show('complete');document.querySelector('#complete [data-action="next"]').textContent=next;},700);
  }
  formatTime(t){const m=Math.floor(t/60),s=(t%60).toFixed(1).padStart(4,'0');return `${m}:${s}`;}
  updateHud(){if(!this.player||this.state==='menu')return;const p=this.player;document.querySelector('#health').innerHTML=[0,1,2].map(i=>`<i class="cell ${i>=p.health?'off':''}"></i>`).join('');document.querySelector('#bits').textContent=`${this.runBits} / ${this.level.bits.length}`;document.querySelector('#cores').textContent=`${this.runCores} / 3`;document.querySelector('#dash-meter').style.width=`${Math.round((1-p.dashCooldown/.58)*100)}%`;}
  draw(){
    const c=this.ctx; c.clearRect(0,0,W,H);if(!this.level){this.drawAttract(c);return;} const shake=this.camera.shake&&this.settings.shake&&!this.settings.motion?(Math.random()-.5)*this.camera.shake*20:0;c.save();c.translate(Math.round(shake),Math.round(shake*.5));this.drawBackground(c);this.drawWorld(c);c.restore();
  }
  drawAttract(c){const fake={theme:'meadow',width:1600};this.drawBackground(c,fake,{x:180,y:0});c.fillStyle='#1b4c5d';c.fillRect(0,590,W,130);for(let x=0;x<W;x+=32){c.fillStyle=x%64?'#2b6c63':'#347c6a';c.fillRect(x,584,30,8);}this.drawPip(c,{x:560,y:518,w:34,h:44,facing:1,grounded:true,anim:this.worldTime,squash:0,invuln:0,dashTime:0},{x:0,y:0});}
  palette(){const th=this.level?.theme||'meadow';return th==='cavern'?{sky:'#111a36',far:'#1b2850',mid:'#28335d',ground:'#324461',top:'#6c8da0',edge:'#91bfc2',accent:'#a783db',glow:'#78e2d1'}:th==='tower'?{sky:'#1b1937',far:'#2a2451',mid:'#43265a',ground:'#4c3e68',top:'#a2728c',edge:'#db98a0',accent:'#ff6d7c',glow:'#85e1dd'}:{sky:'#17304f',far:'#234d68',mid:'#326b73',ground:'#287065',top:'#75bc91',edge:'#b2e1aa',accent:'#ffad57',glow:'#6fe0cb'};}
  drawBackground(c, level=this.level, cam=this.camera){
    const q=this.palette(),cx=cam.x||0;c.fillStyle=q.sky;c.fillRect(0,0,W,H);
    c.fillStyle=q.far;for(let i=-1;i<14;i++){const x=Math.round(i*150-(cx*.12%150));const ht=85+(i*37%120);c.fillRect(x,H-260-ht,118,ht);c.fillRect(x+20,H-275-ht,62,15);}
    c.fillStyle=q.mid;for(let i=-1;i<12;i++){const x=Math.round(i*190-(cx*.28%190));const ht=70+((i*61+90)%160);c.fillRect(x,H-175-ht,150,ht);c.fillRect(x+12,H-190-ht,35,15);c.fillRect(x+92,H-202-ht,22,27);} 
    c.fillStyle='#d8f7e8';c.globalAlpha=.34;for(let i=0;i<39;i++){const x=(i*173-cx*.05)%W,y=50+(i*67%300);c.fillRect(x<0?x+W:x,y,2,2);}c.globalAlpha=1;
    if(level?.theme==='cavern'){c.fillStyle='#0b1230';for(let i=-1;i<9;i++){const x=i*180-(cx*.16%180);c.beginPath();c.moveTo(x,0);c.lineTo(x+90,115+(i%3)*35);c.lineTo(x+180,0);c.fill();}c.fillStyle='#6a5b9a';c.globalAlpha=.35;for(let i=0;i<16;i++)c.fillRect((i*241-cx*.2)%W,120+(i*57%320),3,15);c.globalAlpha=1;}
    if(level?.theme==='tower'){c.fillStyle='#e8879b';c.globalAlpha=.13;for(let x=80-(cx*.09%210);x<W;x+=210){c.fillRect(x,0,2,H);c.fillRect(x+5,80,1,H-160);}c.globalAlpha=1;}
  }
  drawWorld(c){const cam=this.camera,q=this.palette();
    for(const s of this.level.signs){if(s.x<cam.x-80||s.x>cam.x+W+80)continue;c.fillStyle='#243a54';c.fillRect(s.x-cam.x,s.y-cam.y,3,48);c.fillStyle='#e4d39a';c.fillRect(s.x-cam.x-3,s.y-cam.y,55,17);c.fillStyle='#31445e';c.font='7px monospace';c.fillText(s.text,s.x-cam.x,s.y-cam.y+11);}
    for(const pl of this.level.platforms)this.drawPlatform(c,pl,cam,q);
    for(const h of this.level.hazards)this.drawHazard(c,h,cam,q);
    for(const b of this.level.bits)if(!b.collected)this.drawBit(c,b,cam,q,false);for(const b of this.level.cores)if(!b.collected)this.drawBit(c,b,cam,q,true);
    for(const cp of this.level.checkpoints)this.drawCheckpoint(c,cp,cam,q);this.drawTower(c,this.level.tower,cam,q);
    for(const e of this.level.enemies)if(e.alive)this.drawEnemy(c,e,cam,q);this.particles.draw(c,cam);if(this.player&&!this.player.dead)this.drawPip(c,this.player,cam);
    c.fillStyle=q.top;c.globalAlpha=.12;for(let x=(-cam.x%70)-70;x<W;x+=70)c.fillRect(x,686,48,2);c.globalAlpha=1;
  }
  drawPlatform(c,p,cam,q){if(p.x+p.w<cam.x-30||p.x>cam.x+W+30||p.fallen)return;const x=Math.round(p.x-cam.x),y=Math.round(p.y-cam.y);let alpha=1;if(p.type==='phase'&&!this.phaseVisible(p))alpha=.18;c.globalAlpha=alpha;
    if(p.type==='bounce'){c.fillStyle='#24344f';c.fillRect(x,y,p.w,p.h);c.fillStyle='#ffad57';c.fillRect(x+5,y+5,p.w-10,7);c.fillStyle='#fff2cd';for(let k=9;k<p.w-6;k+=16)c.fillRect(x+k,y+7,6,3);c.fillStyle='#be603d';c.fillRect(x+7,y+15,p.w-14,4);c.globalAlpha=1;return;}
    if(p.type==='phase'){c.fillStyle='#483a70';c.fillRect(x,y,p.w,p.h);c.strokeStyle='#a783db';c.setLineDash([5,4]);c.strokeRect(x+.5,y+.5,p.w-1,p.h-1);c.setLineDash([]);c.fillStyle='#c2b3e5';for(let k=8;k<p.w;k+=19)c.fillRect(x+k,y+8,4,3);c.globalAlpha=1;return;}
    c.fillStyle=q.ground;c.fillRect(x,y,p.w,p.h);c.fillStyle=q.top;c.fillRect(x,y,p.w,7);c.fillStyle=q.edge;c.globalAlpha=.7;for(let k=8;k<p.w;k+=18)c.fillRect(x+k,y+7,8,2);c.globalAlpha=1;
    if(p.type==='falling'){c.fillStyle='#e98467';c.fillRect(x+10,y+10,p.w-20,3);c.fillRect(x+p.w*.5,y+13,3,8);}if(p.type==='moving'){c.fillStyle=q.glow;c.fillRect(x+p.w/2-5,y+p.h-4,10,2);}c.globalAlpha=1;
  }
  drawHazard(c,h,cam,q){const x=Math.round(h.x-cam.x),y=Math.round(h.y-cam.y);if(h.type==='spikes'){c.fillStyle='#273046';for(let i=0;i<h.w;i+=16){c.beginPath();c.moveTo(x+i,y+h.h);c.lineTo(x+i+8,y);c.lineTo(x+i+16,y+h.h);c.fill();}c.fillStyle='#ff8e82';for(let i=0;i<h.w;i+=16){c.beginPath();c.moveTo(x+i+4,y+h.h-5);c.lineTo(x+i+8,y+7);c.lineTo(x+i+12,y+h.h-5);c.fill();}}else if(h.type==='laser'){c.fillStyle='#592e58';c.fillRect(x+4,y-8,10,h.h+16);c.fillStyle='#ff607c';c.globalAlpha=.7+Math.sin(this.worldTime*12)*.25;c.fillRect(x,y,h.w,h.h);c.fillStyle='#fff0d0';c.fillRect(x+h.w/2-2,y,4,h.h);c.globalAlpha=1;}}
  drawBit(c,b,cam,q,core){const x=b.x-cam.x,y=b.y-cam.y+Math.sin(this.worldTime*3+b.phase)*3;c.save();c.translate(Math.round(x),Math.round(y));const s=core?1.45:1;c.scale(s,s);c.fillStyle=core?'#ffad57':q.glow;c.globalAlpha=.15;c.fillRect(-12,-12,24,24);c.globalAlpha=1;c.fillStyle=core?'#fff2cd':'#dfffee';c.beginPath();c.moveTo(0,-7);c.lineTo(6,0);c.lineTo(0,7);c.lineTo(-6,0);c.fill();c.fillStyle=core?'#ffad57':'#39b8ae';c.fillRect(-2,-3,4,6);c.restore();}
  drawCheckpoint(c,cp,cam,q){const x=cp.x-cam.x,y=cp.y-cam.y;c.fillStyle='#20344e';c.fillRect(x,y,20,68);c.fillStyle=cp.active?q.glow:'#58728a';c.fillRect(x+4,y+9,12,19);c.fillStyle=cp.active?'#fff2cd':'#253a52';c.fillRect(x+7,y+13,6,6);c.fillStyle='#426078';c.fillRect(x-3,y+64,26,4);if(cp.active){c.globalAlpha=.2+Math.sin(this.worldTime*5)*.1;c.fillStyle=q.glow;c.fillRect(x-8,y+2,36,32);c.globalAlpha=1;}}
  drawTower(c,t,cam,q){const x=t.x-cam.x,y=t.y-cam.y;c.fillStyle='#172743';c.fillRect(x+16,y+20,44,146);c.fillStyle='#31526b';c.fillRect(x+22,y+25,32,136);c.fillStyle='#0f1b34';c.fillRect(x+29,y+39,18,75);c.fillStyle=t.active?'#fff2cd':'#ffad57';c.fillRect(x+32,y+45,12,33);c.fillStyle=t.active?q.glow:'#be603d';c.fillRect(x+34,y+48,8,27);c.fillStyle='#57748a';c.fillRect(x+8,y+164,60,4);c.fillStyle='#6c91a0';c.fillRect(x+34,y,10,23);c.fillRect(x+26,y+8,26,4);if(t.active){c.globalAlpha=.18+Math.sin(this.worldTime*5)*.08;c.fillStyle=q.glow;c.fillRect(x-24,y-18,92,184);c.globalAlpha=1;for(let i=0;i<3;i++){c.strokeStyle=q.glow;c.globalAlpha=.35-i*.08;c.beginPath();c.arc(x+38,y+15,20+i*18+Math.sin(this.worldTime*3)*2,0,Math.PI*2);c.stroke();}c.globalAlpha=1;}}
  drawEnemy(c,e,cam,q){const x=Math.round(e.x-cam.x),y=Math.round(e.y-cam.y);if(e.type==='drone'){c.fillStyle='#332d57';c.fillRect(x+5,y+9,24,16);c.fillStyle='#8f7bc0';c.fillRect(x+9,y+5,16,24);c.fillStyle='#ff6d7c';c.fillRect(x+13,y+10,8,5);c.fillStyle='#1a2442';c.fillRect(x,y+13,5,5);c.fillRect(x+29,y+13,5,5);c.fillStyle=q.glow;c.globalAlpha=.35;c.fillRect(x+8,y+27,18,5);c.globalAlpha=1;}else{const bug=e.type==='bug';c.fillStyle=bug?'#893c62':'#3b405f';c.fillRect(x+5,y+10,27,20);c.fillStyle=bug?'#d35a70':'#7ba1a7';c.fillRect(x+9,y+6,18,17);c.fillStyle='#111a32';c.fillRect(x+20,y+11,4,4);c.fillStyle=bug?'#ffad57':'#75e0cf';c.fillRect(x+5,y+30,7,4);c.fillRect(x+25,y+30,7,4);if(bug){c.fillStyle='#d35a70';c.fillRect(x,y+17,6,4);}}}
  drawPip(c,p,cam){const x=Math.round(p.x-cam.x),y=Math.round(p.y-cam.y);if(p.invuln>0&&Math.floor(p.invuln*15)%2===0)return;const sx=1+(p.landing>0?.12:0)-(p.dashTime>0?.1:0),sy=1-(p.landing>0?.12:0)+(p.dashTime>0?.08:0);c.save();c.translate(x+17,y+24);c.scale(sx*p.facing,sy);c.translate(-17,-24);
    c.fillStyle='#11213a';c.fillRect(3,35,9,8);c.fillRect(22,35,9,8);c.fillStyle='#283e5b';c.fillRect(1,13,5,19);c.fillRect(29,14,5,18);c.fillStyle='#223752';c.fillRect(5,10,25,27);c.fillStyle='#4d7590';c.fillRect(7,8,21,26);c.fillStyle='#98cbd0';c.fillRect(9,10,17,15);c.fillStyle='#16273f';c.fillRect(10,13,15,9);c.fillStyle='#6fe0cb';c.fillRect(13,15,8,3);c.fillStyle='#ffad57';c.fillRect(4,29,4,6);c.fillRect(26,29,4,6);c.fillStyle='#35536a';c.fillRect(11,28,13,6);c.fillStyle='#25384e';c.fillRect(14,2,6,6);c.fillStyle='#ffad57';c.fillRect(16,0,2,4);c.fillStyle='#dfffee';c.fillRect(15,4,4,3);c.restore();}
}

new Game();
