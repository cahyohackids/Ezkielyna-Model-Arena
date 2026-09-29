import { LEVELS } from "./levels.js";

const W = 960, H = 540;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const formatTime = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2,"0")}.${Math.floor((seconds % 1) * 10)}`;

class ParticleSystem {
  constructor(game) { this.game = game; this.items = []; }
  burst(x, y, color, count = 8, options = {}) {
    const reduced = this.game.settings.reducedMotion;
    count = reduced ? Math.ceil(count * .35) : count;
    for (let i = 0; i < count && this.items.length < 180; i++) {
      const angle = options.angle ?? Math.random() * Math.PI * 2;
      const spread = options.spread ?? Math.PI * 2;
      const a = angle + (Math.random() - .5) * spread;
      const speed = (options.speed || 100) * (.45 + Math.random() * .7);
      this.items.push({ x, y, vx:Math.cos(a)*speed, vy:Math.sin(a)*speed, life:options.life||.55, max:options.life||.55, color, size:options.size||3, gravity:options.gravity ?? 180, shape:options.shape||"square" });
    }
  }
  trail(x,y,color) {
    if (this.game.settings.reducedMotion && Math.random() > .3) return;
    this.items.push({x,y,vx:(Math.random()-.5)*22,vy:(Math.random()-.5)*22,life:.25,max:.25,color,size:4+Math.random()*4,gravity:0,shape:"square"});
  }
  update(dt) {
    for (const p of this.items) { p.life -= dt; p.vy += p.gravity*dt; p.x += p.vx*dt; p.y += p.vy*dt; p.vx *= Math.pow(.08,dt); }
    this.items = this.items.filter(p => p.life > 0);
  }
  draw(ctx,cameraX,cameraY) {
    for (const p of this.items) {
      const alpha = clamp(p.life / p.max,0,1); ctx.globalAlpha = alpha; ctx.fillStyle = p.color;
      const s = Math.max(1,Math.round(p.size*alpha));
      if (p.shape === "diamond") { ctx.save();ctx.translate(Math.round(p.x-cameraX),Math.round(p.y-cameraY));ctx.rotate(Math.PI/4);ctx.fillRect(-s/2,-s/2,s,s);ctx.restore(); }
      else ctx.fillRect(Math.round(p.x-cameraX),Math.round(p.y-cameraY),s,s);
    }
    ctx.globalAlpha = 1;
  }
}

export class Game {
  constructor(canvas, audio, settings, onEvent) {
    this.canvas = canvas; this.ctx = canvas.getContext("2d", { alpha:false }); this.ctx.imageSmoothingEnabled = false;
    this.audio = audio; this.settings = settings; this.onEvent = onEvent;
    this.active = false; this.paused = false; this.raf = 0; this.last = 0; this.accumulator = 0;
    this.keys = {left:false,right:false,jump:false,dash:false};
    this.pressed = {jump:false,dash:false}; this.released = {jump:false};
    this.camera = {x:0,y:0,shake:0}; this.particles = new ParticleSystem(this);
    this.resizeObserver = new ResizeObserver(() => this.fitCanvas()); this.resizeObserver.observe(canvas.parentElement);
    this.bindInput(); this.drawTitleBackdrop();
  }

  bindInput() {
    const map = {ArrowLeft:"left",KeyA:"left",ArrowRight:"right",KeyD:"right",Space:"jump",KeyW:"jump",ArrowUp:"jump",ShiftLeft:"dash",ShiftRight:"dash"};
    window.addEventListener("keydown", e => {
      if (e.code === "Escape" && this.active) { e.preventDefault(); this.onEvent(this.paused?"resume-request":"pause-request"); return; }
      if (e.code === "KeyR" && this.active) { this.onEvent("restart-request"); return; }
      const a = map[e.code]; if (!a || !this.active || this.paused) return;
      e.preventDefault(); this.setControl(a,true);
    });
    window.addEventListener("keyup", e => { const a=map[e.code]; if(a){e.preventDefault();this.setControl(a,false);} });
    window.addEventListener("blur",()=>{ for(const k of Object.keys(this.keys)) this.keys[k]=false; });
  }

  setControl(action, down) {
    if (!(action in this.keys)) return;
    if (down && !this.keys[action] && (action === "jump" || action === "dash")) this.pressed[action] = true;
    if (!down && this.keys[action] && action === "jump") this.released.jump = true;
    this.keys[action] = down;
  }

  fitCanvas() { this.ctx.imageSmoothingEnabled = false; }

  startLevel(index) {
    this.index = index;
    this.level = structuredClone(LEVELS[index]);
    this.level.platforms.forEach((p,i) => { p.baseX=p.x;p.baseY=p.y;p.prevX=p.x;p.prevY=p.y;p.id=i;p.active=true;p.fallState=0;p.fallTimer=0; });
    this.level.enemies.forEach((e,i)=>{e.id=i;e.w=e.type==="drone"?36:32;e.h=e.type==="drone"?26:28;e.alive=true;e.vx=e.type==="bug"?95:55;e.baseY=e.y;e.t=Math.random()*4;e.death=0;});
    this.level.checkpoint.forEach((c,i)=>{c.id=i;c.active=false;c.w=34;c.h=66;});
    this.levelTime=0; this.deaths=0; this.bits=0; this.cores=0; this.checkpoint={...this.level.spawn};
    this.intro=2.15; this.completeTimer=0; this.complete=false; this.deadTimer=0; this.hitFreeze=0; this.towerPulse=0;
    this.camera.x=0;this.camera.y=0;this.camera.shake=0;this.particles.items=[];
    this.spawnPlayer(true);
    this.active=true;this.paused=false;this.last=performance.now();this.accumulator=0;
    this.audio.startMusic(index);
    cancelAnimationFrame(this.raf);this.raf=requestAnimationFrame(t=>this.loop(t));
  }

  spawnPlayer(fullHeal=false) {
    const oldHealth=this.player?.health||3;
    this.player={x:this.checkpoint.x,y:this.checkpoint.y,w:28,h:38,vx:0,vy:0,facing:1,grounded:false,wasGrounded:false,coyote:0,jumpBuffer:0,dashTime:0,dashCooldown:0,invul:1,health:fullHeal?3:oldHealth,anim:0,squash:0,land:0,standing:null,dead:false};
  }

  stop() { this.active=false;this.paused=false;cancelAnimationFrame(this.raf);this.audio.stopMusic(); }
  pause(value=true) { this.paused=value; if(!value){this.last=performance.now();this.raf=requestAnimationFrame(t=>this.loop(t));} }
  applySettings(settings) { this.settings=settings; this.audio.settings=settings;this.audio.applySettings(); }

  loop(now) {
    if (!this.active || this.paused) return;
    const frame=Math.min(.05,(now-this.last)/1000||0);this.last=now;this.accumulator+=frame;
    const step=1/120; let safety=0;
    while(this.accumulator>=step&&safety++<8){this.update(step);this.accumulator-=step;}
    this.draw(); this.raf=requestAnimationFrame(t=>this.loop(t));
  }

  platformActive(p) {
    if (p.type!=="phase") return p.fallState!==3;
    const cycle=(this.levelTime+p.phase*2.4)%2.4;
    return cycle<1.55;
  }

  updatePlatforms(dt) {
    for(const p of this.level.platforms){
      p.prevX=p.x;p.prevY=p.y;
      if(p.type==="moving"){
        const offset=Math.sin(this.levelTime*p.speed*1.8+p.id)*p.range;
        p.x=p.baseX+(p.axis==="x"?offset:0);p.y=p.baseY+(p.axis==="y"?offset:0);
      }
      if(p.type==="falling"){
        if(p.fallState===1){p.fallTimer-=dt;if(p.fallTimer<=0){p.fallState=2;p.vy=0;}}
        else if(p.fallState===2){p.vy+=900*dt;p.y+=p.vy*dt;if(p.y>650){p.fallState=3;p.fallTimer=2.2;}}
        else if(p.fallState===3){p.fallTimer-=dt;if(p.fallTimer<=0){p.y=p.baseY;p.fallState=0;p.active=true;}}
      }
      p.active=this.platformActive(p);
    }
  }

  solids() { return this.level.platforms.filter(p=>p.active); }

  update(dt) {
    if(this.hitFreeze>0){this.hitFreeze-=dt;return;}
    this.levelTime+=dt;this.intro=Math.max(0,this.intro-dt);this.towerPulse+=dt;
    this.updatePlatforms(dt);this.particles.update(dt);
    if(this.complete){this.completeTimer-=dt;this.updateCamera(dt);if(this.completeTimer<=0){this.finishLevel();}return;}
    if(this.player.dead){this.deadTimer-=dt;this.player.vy+=1000*dt;this.player.y+=this.player.vy*dt;this.player.anim+=dt*9;this.updateCamera(dt);if(this.deadTimer<=0){this.onEvent("game-over");this.pause(true);}return;}
    this.updatePlayer(dt);this.updateEnemies(dt);this.updateCollectibles();this.updateHazards();this.updateCheckpoint();this.updateTower();this.updateCamera(dt);
    this.pressed.jump=false;this.pressed.dash=false;this.released.jump=false;
  }

  updatePlayer(dt) {
    const p=this.player;p.wasGrounded=p.grounded;p.grounded=false;p.standing=null;
    if(p.invul>0)p.invul-=dt;if(p.dashCooldown>0)p.dashCooldown-=dt;if(p.land>0)p.land-=dt;if(p.squash>0)p.squash-=dt;
    if(p.wasGrounded)p.coyote=.115;else p.coyote=Math.max(0,p.coyote-dt);
    if(this.pressed.jump)p.jumpBuffer=.14;else p.jumpBuffer=Math.max(0,p.jumpBuffer-dt);
    const dir=(this.keys.right?1:0)-(this.keys.left?1:0);if(dir)p.facing=dir;
    if(this.pressed.dash&&p.dashCooldown<=0){
      p.dashTime=.145;p.dashCooldown=.72;p.vx=p.facing*570;p.vy=0;p.squash=.16;this.audio.play("dash");this.camera.shake=Math.max(this.camera.shake,2.5);
      this.particles.burst(p.x+p.w/2,p.y+p.h/2,this.level.palette.glow,10,{speed:130,life:.3,angle:p.facing>0?Math.PI:0,spread:.8});
    }
    if(p.dashTime>0){p.dashTime-=dt;p.vy=0;p.vx=p.facing*570;if(Math.random()<.65)this.particles.trail(p.x+(p.facing<0?p.w:0),p.y+p.h/2,this.level.palette.glow);}
    else {
      const accel=p.wasGrounded?1750:1000,max=250;
      if(dir)p.vx=clamp(p.vx+dir*accel*dt,-max,max);else p.vx*=Math.pow(p.wasGrounded?.0007:.16,dt);
      const grav=1450*(p.vy>0?1.42:1);p.vy=clamp(p.vy+grav*dt,-900,850);
      if(p.jumpBuffer>0&&p.coyote>0){p.vy=-495;p.jumpBuffer=0;p.coyote=0;p.grounded=false;p.squash=.12;this.audio.play("jump");this.particles.burst(p.x+p.w/2,p.y+p.h,this.level.palette.edge,6,{speed:65,life:.3,angle:-Math.PI/2,spread:2.2,gravity:260});}
      if(this.released.jump&&p.vy<-120)p.vy*=.52;
    }
    p.anim+=dt*(Math.abs(p.vx)*.045+2);
    const oldX=p.x;p.x+=p.vx*dt;this.collideX(p,oldX);
    const oldY=p.y;p.y+=p.vy*dt;this.collideY(p,oldY);
    if(p.grounded&&!p.wasGrounded){p.land=.12;p.squash=.1;this.camera.shake=Math.max(this.camera.shake,Math.min(2,Math.abs(p.vy)*.003));this.particles.burst(p.x+p.w/2,p.y+p.h,this.level.palette.edge,7,{speed:75,life:.35,angle:-Math.PI/2,spread:2.5,gravity:280});}
    if(p.grounded&&Math.abs(p.vx)>100&&Math.random()<dt*8)this.particles.trail(p.x+p.w/2-p.facing*9,p.y+p.h-2,this.level.palette.edge);
    if(p.y>620)this.hurtPlayer(0,true);
    p.x=clamp(p.x,0,this.level.width-p.w);
  }

  collideX(p,oldX) {
    for(const s of this.solids()){
      if(!overlap(p,s))continue;
      if(oldX+p.w<=s.x+2&&p.vx>0){p.x=s.x-p.w;p.vx=0;p.dashTime=0;}
      else if(oldX>=s.x+s.w-2&&p.vx<0){p.x=s.x+s.w;p.vx=0;p.dashTime=0;}
    }
  }

  collideY(p,oldY) {
    for(const s of this.solids()){
      if(!overlap(p,s))continue;
      if(oldY+p.h<=s.y+5&&p.vy>=0){
        p.y=s.y-p.h;p.vy=0;p.grounded=true;p.coyote=.115;p.standing=s;
        if(s.type==="moving")p.x+=s.x-s.prevX;
        if(s.type==="falling"&&s.fallState===0){s.fallState=1;s.fallTimer=.48;}
      } else if(oldY>=s.y+s.h-3&&p.vy<0){p.y=s.y+s.h;p.vy=0;}
    }
    for(const b of this.level.bounces){
      if(overlap(p,b)&&oldY+p.h<=b.y+8&&p.vy>=0){p.y=b.y-p.h;p.vy=-710;p.grounded=false;p.squash=.18;this.audio.play("bounce");this.camera.shake=Math.max(this.camera.shake,3);this.particles.burst(b.x+b.w/2,b.y,this.level.palette.accent,12,{speed:140,life:.45,angle:-Math.PI/2,spread:1.8});}
    }
  }

  updateEnemies(dt) {
    const p=this.player;
    for(const e of this.level.enemies){
      if(!e.alive){e.death-=dt;continue;} e.t+=dt;
      if(e.type==="drone"){
        e.x+=e.vx*dt;if(e.x<e.min||e.x>e.max){e.vx*=-1;e.x=clamp(e.x,e.min,e.max);}e.y=e.baseY+Math.sin(e.t*2.1)*28;
      } else {
        const close=Math.abs((p.x+p.w/2)-(e.x+e.w/2))<250;
        const speed=e.type==="bug"&&(close||Math.sin(e.t*1.7)>.72)?155:(e.type==="bug"?78:54);
        e.x+=Math.sign(e.vx)*speed*dt;if(e.x<e.min||e.x>e.max){e.vx*=-1;e.x=clamp(e.x,e.min,e.max);}
        if(e.type==="hopper")e.y=e.baseY-Math.max(0,Math.sin(e.t*2.2))*22;
      }
      if(overlap(p,e)){
        const stomp=p.vy>80&&p.y+p.h<e.y+e.h*.62;
        if(stomp){e.alive=false;e.death=.45;p.vy=-330;p.squash=.11;this.audio.play("stomp");this.hitFreeze=.035;this.camera.shake=Math.max(this.camera.shake,3);this.particles.burst(e.x+e.w/2,e.y+e.h/2,this.level.palette.accent,13,{speed:150,life:.45});}
        else this.hurtPlayer(Math.sign((p.x+p.w/2)-(e.x+e.w/2))||1,false);
      }
    }
  }

  updateCollectibles() {
    const p=this.player, pc={x:p.x-6,y:p.y-5,w:p.w+12,h:p.h+10};
    for(const b of this.level.bits){if(!b.collected&&overlap(pc,{x:b.x-9,y:b.y-9,w:18,h:18})){b.collected=true;this.bits++;this.audio.play("bit");this.particles.burst(b.x,b.y,this.level.palette.glow,8,{speed:105,life:.4,shape:"diamond"});}}
    for(const c of this.level.cores){if(!c.collected&&overlap(pc,{x:c.x-13,y:c.y-13,w:26,h:26})){c.collected=true;this.cores++;this.audio.play("core");this.camera.shake=Math.max(this.camera.shake,2);this.particles.burst(c.x,c.y,this.level.palette.accent,18,{speed:145,life:.7,shape:"diamond"});this.onEvent("toast",`DATA CORE ${this.cores} / 3 RECOVERED`);}}
  }

  updateHazards() {
    const p=this.player;
    for(const h of this.level.hazards){
      const active=h.type!=="laser"||((this.levelTime+(h.phase||0)*2.2)%2.2)<1.25;
      if(active&&overlap(p,h))this.hurtPlayer(Math.sign((p.x+p.w/2)-(h.x+h.w/2))||-p.facing,h.type==="laser"?false:false);
    }
  }

  updateCheckpoint() {
    for(const c of this.level.checkpoint){
      if(!c.active&&overlap(this.player,{x:c.x-18,y:c.y-15,w:70,h:85})){
        this.level.checkpoint.forEach(v=>v.active=false);c.active=true;this.checkpoint={x:c.x+4,y:c.y-5};this.audio.play("checkpoint");this.player.health=3;
        this.camera.shake=Math.max(this.camera.shake,2);this.particles.burst(c.x+17,c.y+8,this.level.palette.glow,22,{speed:150,life:.8,angle:-Math.PI/2,spread:2.8,shape:"diamond"});this.onEvent("toast","CHECKPOINT LINKED · ENERGY RESTORED");
      }
    }
  }

  updateTower() {
    const t=this.level.tower;
    if(overlap(this.player,{x:t.x-15,y:t.y,w:105,h:170})){
      this.complete=true;this.completeTimer=1.65;this.player.vx=0;this.player.vy=0;this.audio.play("complete");this.camera.shake=5;
      this.particles.burst(t.x+36,t.y+25,this.level.palette.glow,45,{speed:230,life:1.35,shape:"diamond",gravity:-30});
    }
  }

  hurtPlayer(dir,pit=false) {
    const p=this.player;if(p.invul>0||p.dead||this.complete)return;
    p.health--;p.invul=1.25;this.audio.play("hurt");this.camera.shake=Math.max(this.camera.shake,5);this.particles.burst(p.x+p.w/2,p.y+p.h/2,"#ff6575",12,{speed:145,life:.55});
    if(p.health<=0){this.killPlayer();return;}
    if(pit){p.x=this.checkpoint.x;p.y=this.checkpoint.y;p.vx=0;p.vy=0;p.invul=1.4;}
    else {p.vx=dir*275;p.vy=-320;p.dashTime=0;}
  }

  killPlayer() {
    const p=this.player;p.dead=true;p.vx=0;p.vy=-380;this.deadTimer=1.25;this.deaths++;this.audio.play("death");this.camera.shake=6;this.particles.burst(p.x+p.w/2,p.y+p.h/2,"#ff6575",24,{speed:190,life:.85,shape:"diamond"});
  }

  retryCheckpoint() { this.spawnPlayer(true);this.paused=false;this.last=performance.now();this.raf=requestAnimationFrame(t=>this.loop(t)); }

  finishLevel() {
    this.completeTimer=999;this.pause(true);this.onEvent("complete",{level:this.index,time:this.levelTime,bits:this.bits,totalBits:this.level.bits.length,cores:this.cores,deaths:this.deaths,timeLabel:formatTime(this.levelTime)});
  }

  updateCamera(dt) {
    const p=this.player;const target=clamp(p.x-W*.4+p.vx*.22,0,this.level.width-W);
    const follow=this.settings.reducedMotion?1:1-Math.pow(.0008,dt);this.camera.x=lerp(this.camera.x,target,follow);
    const high=clamp((p.y-250)*.12,-24,10);this.camera.y=lerp(this.camera.y,high,1-Math.pow(.02,dt));
    this.camera.shake=Math.max(0,this.camera.shake-18*dt);
  }

  drawTitleBackdrop() {
    const c=this.ctx;const g=c.createLinearGradient(0,0,0,H);g.addColorStop(0,"#07111f");g.addColorStop(1,"#12303b");c.fillStyle=g;c.fillRect(0,0,W,H);
    c.fillStyle="#142d3a";for(let i=0;i<14;i++){const x=i*83+(i%3)*22;const h=70+(i%5)*24;c.fillRect(x,H-h-60,42,h);c.fillStyle="#1b3d48";c.fillRect(x+8,H-h-50,5,5);c.fillRect(x+25,H-h-32,5,5);c.fillStyle="#142d3a";}
    c.fillStyle="#0a1d29";c.fillRect(0,H-92,W,92);c.fillStyle="#37675f";c.fillRect(0,H-92,W,5);
  }

  draw() {
    const c=this.ctx,pal=this.level.palette;
    const sx=this.settings.shake&&this.camera.shake?Math.round((Math.random()-.5)*this.camera.shake*2):0;
    const sy=this.settings.shake&&this.camera.shake?Math.round((Math.random()-.5)*this.camera.shake*1.2):0;
    c.save();c.translate(sx,sy);this.drawBackground(c,pal);c.save();c.translate(0,-this.camera.y);
    this.drawPlatforms(c,pal);this.drawHazards(c,pal);this.drawCollectibles(c,pal);this.drawCheckpoints(c,pal);this.drawTower(c,pal);this.drawEnemies(c,pal);this.particles.draw(c,this.camera.x,this.camera.y);this.drawPlayer(c,pal);c.restore();c.restore();
    this.drawHUD(c,pal);if(this.intro>0)this.drawIntro(c,pal);if(this.complete)this.drawTowerFlash(c,pal);
  }

  drawBackground(c,pal) {
    const g=c.createLinearGradient(0,0,0,H);g.addColorStop(0,pal.sky);g.addColorStop(1,pal.sky2);c.fillStyle=g;c.fillRect(0,0,W,H);
    const cam=this.camera.x;
    c.globalAlpha=.28;c.fillStyle="#fff";for(let i=0;i<24;i++){const x=((i*181-cam*.08)%(W+80)+W+80)%(W+80)-40;const y=38+(i*71)%250;c.fillRect(Math.round(x),y,i%4===0?3:2,i%4===0?3:2);}c.globalAlpha=1;
    if(this.index===0){
      c.fillStyle=pal.far;for(let i=-1;i<8;i++){const x=i*210-(cam*.12%210);c.beginPath();c.moveTo(x,430);c.lineTo(x+100,235+(i%2)*45);c.lineTo(x+225,430);c.fill();}
      c.fillStyle=pal.mid;for(let i=-1;i<10;i++){const x=i*150-(cam*.24%150);c.beginPath();c.arc(x+75,410,110,Math.PI,0);c.fill();}
      c.fillStyle="rgba(244,239,207,.55)";c.fillRect(760-(cam*.05%1000),70,44,44);c.fillStyle=pal.sky;c.fillRect(760-(cam*.05%1000),70,18,18);
    } else if(this.index===1){
      c.fillStyle=pal.far;for(let i=-1;i<12;i++){const x=i*120-(cam*.12%120);c.beginPath();c.moveTo(x,0);c.lineTo(x+35,100+(i%4)*35);c.lineTo(x+65,0);c.fill();c.beginPath();c.moveTo(x+45,H);c.lineTo(x+90,390-(i%3)*30);c.lineTo(x+130,H);c.fill();}
      c.strokeStyle="rgba(112,223,224,.12)";c.lineWidth=2;for(let i=0;i<7;i++){const x=((i*190-cam*.2)%(W+200)+W+200)%(W+200);c.beginPath();c.moveTo(x,0);c.lineTo(x,160);c.lineTo(x+35,195);c.stroke();}
    } else {
      c.fillStyle=pal.far;for(let i=-1;i<12;i++){const x=i*105-(cam*.15%105),h=110+(i%5)*42;c.fillRect(x,H-h,76,h);c.fillStyle="rgba(103,240,206,.12)";c.fillRect(x+12,H-h+18,4,h-35);c.fillStyle=pal.far;}
      c.strokeStyle="rgba(255,111,113,.14)";c.lineWidth=1;for(let y=80;y<460;y+=46){c.beginPath();c.moveTo(0,y);c.lineTo(W,y+(Math.sin(y)*12));c.stroke();}
      if(!this.settings.reducedMotion){c.fillStyle="rgba(255,111,113,.17)";for(let i=0;i<7;i++){const y=(i*83+this.levelTime*35)%H;c.fillRect((i*157-cam*.35)%W,y,60+(i%3)*35,2);}}
    }
    c.fillStyle=pal.mid;for(let i=-1;i<10;i++){const x=i*175-(cam*.42%175),h=60+(i%4)*35;c.fillRect(Math.round(x),H-h-55,95,h);c.fillStyle="rgba(255,255,255,.04)";c.fillRect(Math.round(x+12),H-h-42,7,7);c.fillStyle=pal.mid;}
  }

  drawPlatforms(c,pal) {
    for(const p of this.level.platforms){
      const x=Math.round(p.x-this.camera.x),y=Math.round(p.y);if(x>W+20||x+p.w<-20)continue;
      let alpha=1;if(p.type==="phase"){const cycle=(this.levelTime+p.phase*2.4)%2.4;alpha=cycle<1.35?1:cycle<1.55?(1.55-cycle)/.2:cycle>2.2?(cycle-2.2)/.2:.12;}
      if(p.fallState===3)alpha=0;c.globalAlpha=alpha;
      const shake=p.type==="falling"&&p.fallState===1?Math.round(Math.sin(this.levelTime*65)*2):0;
      c.fillStyle=p.secret?"#0b2029":pal.ground;c.fillRect(x+shake,y,p.w,p.h);c.fillStyle=p.type==="phase"?pal.glow:pal.edge;c.fillRect(x+shake,y,p.w,5);
      c.fillStyle="rgba(255,255,255,.055)";for(let tx=10;tx<p.w-4;tx+=28)c.fillRect(x+tx+shake,y+12,12,3);
      c.fillStyle="rgba(0,0,0,.16)";for(let tx=0;tx<p.w;tx+=32)c.fillRect(x+tx+shake,y+24,2,Math.max(0,p.h-24));
      if(p.type==="moving"){c.fillStyle=pal.accent;c.fillRect(x+8,y+10,14,4);c.fillRect(x+p.w-22,y+10,14,4);}
      if(p.type==="falling"){c.fillStyle=pal.accent;c.fillRect(x+p.w/2-7+shake,y+11,14,3);}
    } c.globalAlpha=1;
    for(const b of this.level.bounces){const x=b.x-this.camera.x;if(x>W||x+b.w<0)continue;c.fillStyle=pal.ground;c.fillRect(x,b.y,b.w,12);c.fillStyle=pal.accent;c.fillRect(x+4,b.y-5,b.w-8,7);c.fillStyle="#f6d48b";c.fillRect(x+12,b.y-8,b.w-24,3);}
  }

  drawHazards(c,pal) {
    for(const h of this.level.hazards){const x=Math.round(h.x-this.camera.x);if(x>W+20||x+h.w<-20)continue;
      if(h.type==="spikes"){
        c.fillStyle="#592e40";c.fillRect(x,h.y+13,h.w,5);c.fillStyle="#ff7b70";const count=Math.ceil(h.w/18);for(let i=0;i<count;i++){c.beginPath();c.moveTo(x+i*18,h.y+15);c.lineTo(x+i*18+9,h.y);c.lineTo(x+i*18+18,h.y+15);c.fill();c.fillStyle="#ffb36a";c.fillRect(x+i*18+8,h.y+5,2,5);c.fillStyle="#ff7b70";}
      } else {
        const cycle=(this.levelTime+(h.phase||0)*2.2)%2.2,active=cycle<1.25,warning=cycle>1.82;c.fillStyle="#482742";c.fillRect(x-7,h.y-10,30,12);c.fillRect(x-7,h.y+h.h-2,30,12);c.fillStyle=active?"#ff5d76":warning?"#ffad5a":"#442944";c.fillRect(x,h.y,h.w,h.h);
        if(active){c.globalAlpha=.24;c.fillStyle="#ff5d76";c.fillRect(x-6,h.y,h.w+12,h.h);c.globalAlpha=1;c.fillStyle="#ffd5ba";c.fillRect(x+6,h.y,3,h.h);}
      }
    }
  }

  drawCollectibles(c,pal) {
    for(const b of this.level.bits){if(b.collected)continue;const x=b.x-this.camera.x;if(x<-20||x>W+20)continue;const s=5+Math.abs(Math.sin(this.levelTime*5+b.id))*4;c.save();c.translate(Math.round(x),Math.round(b.y+Math.sin(this.levelTime*3+b.id)*3));c.rotate(this.levelTime*2+b.id);c.globalAlpha=.18;c.fillStyle=pal.glow;c.fillRect(-10,-10,20,20);c.globalAlpha=1;c.fillStyle=pal.glow;c.fillRect(-s,-s,s*2,s*2);c.fillStyle="#e6fff4";c.fillRect(-2,-2,4,4);c.restore();}
    for(const d of this.level.cores){if(d.collected)continue;const x=d.x-this.camera.x;if(x<-25||x>W+25)continue;c.save();c.translate(Math.round(x),Math.round(d.y+Math.sin(this.levelTime*2+d.id)*4));c.rotate(-this.levelTime*.8);c.globalAlpha=.2;c.fillStyle=pal.accent;c.fillRect(-17,-17,34,34);c.globalAlpha=1;c.fillStyle=pal.accent;c.fillRect(-10,-10,20,20);c.fillStyle="#fff2c4";c.fillRect(-5,-5,10,10);c.fillStyle=pal.ground;c.fillRect(-2,-2,4,4);c.restore();}
  }

  drawCheckpoints(c,pal) {
    for(const t of this.level.checkpoint){const x=Math.round(t.x-this.camera.x);if(x<-60||x>W+60)continue;c.fillStyle="#0c2330";c.fillRect(x,t.y+14,34,52);c.fillStyle="#2c5260";c.fillRect(x-4,t.y+60,42,6);c.fillStyle=t.active?pal.glow:"#36505a";c.fillRect(x+8,t.y+24,18,17);c.fillStyle=t.active?"#eaffec":"#132832";c.fillRect(x+12,t.y+29,10,4);c.fillStyle="#496977";c.fillRect(x+15,t.y,4,16);c.fillStyle=t.active?pal.glow:pal.accent;c.fillRect(x+12,t.y-5,10,6);if(t.active){c.globalAlpha=.15+.1*Math.sin(this.levelTime*4);c.fillStyle=pal.glow;c.fillRect(x-12,t.y-18,58,78);c.globalAlpha=1;}}
  }

  drawTower(c,pal) {
    const t=this.level.tower,x=Math.round(t.x-this.camera.x);if(x<-130||x>W+130)return;
    c.fillStyle="#091c2a";c.fillRect(x,t.y+38,76,151);c.fillStyle="#254759";c.fillRect(x+8,t.y+48,60,141);c.fillStyle="#102d3b";c.fillRect(x+18,t.y+66,40,94);c.fillStyle=this.complete?pal.glow:"#314f59";c.fillRect(x+24,t.y+82,28,17);c.fillStyle=this.complete?"#efffd6":"#162b34";c.fillRect(x+31,t.y+88,14,5);c.fillStyle=pal.accent;c.fillRect(x+34,t.y-14,7,55);
    c.fillStyle="#183847";c.fillRect(x+15,t.y+24,46,12);c.fillRect(x+6,t.y+15,64,8);
    const powered=this.complete||Math.sin(this.towerPulse*3)>.75;c.fillStyle=powered?pal.glow:pal.accent;c.fillRect(x+31,t.y-19,13,8);
    if(this.complete){for(let i=0;i<4;i++){const r=(this.levelTime*80+i*38)%160;c.strokeStyle=`rgba(103,240,206,${1-r/160})`;c.lineWidth=3;c.beginPath();c.arc(x+38,t.y-14,r,Math.PI,Math.PI*2);c.stroke();}}
  }

  drawEnemies(c,pal) {
    for(const e of this.level.enemies){const x=Math.round(e.x-this.camera.x),y=Math.round(e.y);if(x<-50||x>W+50)continue;if(!e.alive){if(e.death>0){c.globalAlpha=e.death/.45;c.fillStyle=pal.accent;c.fillRect(x,y+e.h/2,e.w,Math.max(2,e.h*e.death));c.globalAlpha=1;}continue;}
      const flip=e.vx<0?-1:1;c.save();c.translate(x+e.w/2,y+e.h/2);c.scale(flip,1);
      if(e.type==="drone"){
        c.fillStyle="#142f40";c.fillRect(-16,-8,32,17);c.fillStyle="#567884";c.fillRect(-11,-12,20,5);c.fillStyle=pal.accent;c.fillRect(5,-4,6,6);c.fillStyle="#08151f";c.fillRect(7,-2,3,3);c.fillStyle=pal.glow;c.fillRect(-24,-2,8,3);c.fillRect(16,-2,8,3);c.fillStyle="rgba(103,240,206,.3)";c.fillRect(-12,11,24,3);
      } else if(e.type==="bug"){
        c.fillStyle="#2b253b";c.fillRect(-16,-9,32,18);c.fillStyle="#563a56";c.fillRect(-12,-13,20,8);c.fillStyle=pal.accent;c.fillRect(7,-7,7,5);c.fillStyle="#ffcf89";c.fillRect(9,-6,3,2);c.fillStyle="#51374e";c.fillRect(-13,9,6,6);c.fillRect(7,9,6,6);c.fillStyle=pal.accent;c.fillRect(-20,-5,5,3);
      } else {
        const hop=Math.abs(Math.sin(e.t*2.2));c.fillStyle="#173642";c.fillRect(-15,-10,30,19);c.fillStyle="#47706c";c.fillRect(-10,-15,18,7);c.fillStyle=pal.accent;c.fillRect(6,-7,6,5);c.fillStyle="#08151f";c.fillRect(8,-6,2,2);c.fillStyle="#0e2935";c.fillRect(-13,9,7,5+hop*4);c.fillRect(6,9,7,5+hop*4);
      }c.restore();
    }
  }

  drawPlayer(c,pal) {
    const p=this.player;if(p.invul>0&&!p.dead&&Math.floor(p.invul*14)%2===0)return;
    const x=Math.round(p.x-this.camera.x),y=Math.round(p.y);let sx=1,sy=1;
    if(p.squash>0){sx=1.14;sy=.86;}else if(!p.grounded){sx=.93;sy=1.07;}else if(Math.abs(p.vx)>30){sy=1+Math.sin(p.anim)*.035;sx=2-sy;}
    c.save();c.translate(x+p.w/2,y+p.h/2);c.scale(p.facing*sx,sy);if(p.dead)c.rotate(p.anim);
    if(p.dashTime>0){c.globalAlpha=.18;c.fillStyle=pal.glow;for(let i=1;i<4;i++)c.fillRect(-p.facing*i*14-14,-14,22,28);c.globalAlpha=1;}
    const run=p.grounded&&Math.abs(p.vx)>25?Math.sin(p.anim):0;
    c.fillStyle="#1b3642";c.fillRect(-15,-8,4,18);c.fillStyle="#f1edcf";c.fillRect(-12,-15,24,27);c.fillStyle="#aeb09a";c.fillRect(7,-8,7,18);c.fillStyle="#d7d6b9";c.fillRect(-9,10+run*2,7,7);c.fillRect(3,10-run*2,7,7);
    c.fillStyle="#102836";c.fillRect(-10,-11,19,10);c.fillStyle=pal.glow;c.fillRect(p.facing>0?1:-7,-8,7,3);c.fillStyle="#eaffdd";c.fillRect(p.facing>0?5:-3,-8,2,2);
    c.fillStyle="#9da28e";c.fillRect(-2,-22,4,7);c.fillStyle=pal.accent;c.fillRect(-4,-25,8,4);if(!this.settings.reducedMotion){c.globalAlpha=.25+.15*Math.sin(this.levelTime*5);c.fillRect(-7,-28,14,9);c.globalAlpha=1;}
    c.fillStyle="#71817d";c.fillRect(-14,-4,4,12);c.fillStyle="#ffad5a";c.fillRect(-16,-2,3,7);
    c.restore();
  }

  drawHUD(c,pal) {
    c.save();c.fillStyle="rgba(4,13,22,.78)";c.fillRect(18,18,314,48);c.strokeStyle="rgba(137,220,204,.25)";c.strokeRect(18.5,18.5,313,47);
    for(let i=0;i<3;i++){const x=34+i*31;c.fillStyle=i<this.player.health?pal.glow:"#243744";c.fillRect(x,32,20,15);c.fillStyle=i<this.player.health?"#dffff0":"#142632";c.fillRect(x+5,36,10,4);c.fillStyle="#07131f";c.fillRect(x+8,29,4,3);}
    c.fillStyle="#6e8b89";c.font="700 9px 'Chakra Petch', monospace";c.fillText("SIGNAL BITS",139,34);c.fillStyle="#f4efcf";c.font="700 15px 'Chakra Petch', monospace";c.fillText(`${String(this.bits).padStart(2,"0")} / ${this.level.bits.length}`,139,51);
    c.fillStyle="#6e8b89";c.font="700 9px 'Chakra Petch', monospace";c.fillText("CORES",240,34);for(let i=0;i<3;i++){c.fillStyle=i<this.cores?pal.accent:"#243744";c.save();c.translate(248+i*20,48);c.rotate(Math.PI/4);c.fillRect(-5,-5,10,10);c.restore();}
    c.fillStyle="rgba(4,13,22,.78)";c.fillRect(W-176,18,158,48);c.strokeStyle="rgba(137,220,204,.25)";c.strokeRect(W-175.5,18.5,157,47);c.fillStyle="#6e8b89";c.font="700 9px 'Chakra Petch', monospace";c.fillText("DASH",W-158,34);c.fillStyle="#172f3a";c.fillRect(W-158,43,116,8);const ready=clamp(1-this.player.dashCooldown/.72,0,1);c.fillStyle=ready>=1?pal.glow:pal.accent;c.fillRect(W-158,43,116*ready,8);c.fillStyle="#c3d5cb";c.fillText(ready>=1?"READY":"CHARGING",W-158,62);
    c.restore();
  }

  drawIntro(c,pal) {
    const fade=Math.min(1,this.intro/.35,(2.15-this.intro)/.3);c.globalAlpha=clamp(fade,0,1);c.fillStyle="rgba(4,13,22,.88)";c.fillRect(W/2-230,H/2-58,460,116);c.fillStyle=pal.glow;c.fillRect(W/2-230,H/2-58,5,116);c.textAlign="center";c.fillStyle=pal.accent;c.font="700 10px 'Chakra Petch', monospace";c.fillText(this.level.zone,W/2,H/2-25);c.fillStyle="#f4efcf";c.font="700 28px 'Chakra Petch', monospace";c.fillText(this.level.name,W/2,H/2+7);c.fillStyle="#8ba4a1";c.font="600 10px 'Chakra Petch', monospace";c.fillText(this.level.hint,W/2,H/2+34);c.textAlign="left";c.globalAlpha=1;
  }

  drawTowerFlash(c,pal) {const a=clamp((1.65-this.completeTimer)/1.2,0,.38);c.fillStyle=`rgba(103,240,206,${a})`;c.fillRect(0,0,W,H);}
}
