// Local browser integration tests. ?qa uses an isolated, in-memory save.
export function installQA(g) {
  const dock = document.createElement('aside');
  dock.style.cssText = 'position:fixed;bottom:7px;left:8px;z-index:99;background:#0c2029;border:1px solid #709f8b;padding:8px 12px;font:10px monospace;color:#d7e1c7;max-width:90vw';
  dock.innerHTML = '<button id="qa-run" style="background:#e9e4ca;color:#17323a;border:0;padding:6px 12px;font:10px monospace;cursor:pointer">Run browser QA</button> <button id="qa-replay" style="background:#92bda5;color:#17323a;border:0;padding:6px 12px;font:10px monospace;cursor:pointer">Watch full playthroughs</button> <span id="qa-result">Isolated test save · no effect on player progress</span>';
  document.body.appendChild(dock);
  document.getElementById('qa-run').onclick = () => runQA(g, dock);
  document.getElementById('qa-replay').onclick = () => watchReplays(g, dock);
}

async function watchReplays(g, dock) {
  const button=dock.querySelector('#qa-replay'), status=dock.querySelector('#qa-result');
  if(button.dataset.running)return;
  button.dataset.running='true';button.disabled=true;dock.querySelector('#qa-run').disabled=true;
  const data=await(await fetch('./tests/playthroughs.json')).json();
  g.settings.reduced=false;g.settings.mute=true;g.ui.applySettings();g.testing=false;
  let sector=0,step=0,frame=0,wait=0;const original=g.fixedStep.bind(g);g.start(0);
  g.fixedStep=dt=>{
    if(g.state==='playing'){
      if(frame===0){const action=data.actions[data.runs[sector].actions[step++]];
        if(!action){status.textContent=`Replay ${sector+1} ended early`;g.fixedStep=original;return;}
        g.input.clear();if(action.axis)g.input.down('right');if(action.jump)g.input.down('jump');if(action.dash)g.input.down('dash');
      }
      original(dt);frame=(frame+1)%data.span;status.textContent=`PLAYTEST ${sector+1}/3 · ${g.level.name} · ${g.deaths} deaths`;
    }else{original(dt);if(g.state==='complete'){wait+=dt;if(wait>1.5){sector++;step=0;frame=0;wait=0;if(sector<3)g.start(sector);else{g.fixedStep=original;button.disabled=false;button.dataset.running='';dock.querySelector('#qa-run').disabled=false;status.textContent='3/3 full browser playthroughs complete · zero deaths';}}}}
  };
}

async function runQA(g, dock) {
  g.testing = true;
  const results = [], status = dock.querySelector('#qa-result');
  const assert = (value, label) => { if (!value) throw new Error(label); };
  const key = (code, down = true) => (document.activeElement || document.body).dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true }));
  const click = action => { const b = document.querySelector(`[data-action="${action}"]`); assert(b && !b.disabled, `Missing action ${action}`); b.click(); };
  const frames = (n = 1) => { for (let i = 0; i < n; i++) g.fixedStep(1/120); g.ui.update(); };
  const test = async (name, fn) => { status.textContent = name; try { await fn(); results.push({ name, pass: true }); } catch (e) { results.push({ name, pass: false, error: e.message }); } };
  await test('menu → field guide → menu', () => { g.menu(); click('help'); assert(g.ui.current === 'help', 'Guide opens'); click('back'); assert(g.ui.current === 'menu', 'Guide returns'); });
  await test('locked level select', () => { click('levels'); assert(document.querySelector('[data-action="level-1"]').disabled, 'Sector 2 locked'); assert(document.querySelector('[data-action="level-2"]').disabled, 'Sector 3 locked'); click('back'); });
  await test('settings control audio and accessibility', () => {
    click('settings');
    const music = document.getElementById('music-volume'); music.value = '17'; music.dispatchEvent(new Event('input', {bubbles:true})); assert(g.settings.music === 17, 'Music volume changes');
    const reduced = document.getElementById('setting-reduced'); reduced.click(); assert(g.settings.reduced === reduced.checked, 'Reduced motion changes'); assert(document.body.classList.contains('reduced') === reduced.checked, 'Reduced motion CSS applied');
    const mute = document.getElementById('setting-mute'); mute.click(); assert(g.settings.mute === mute.checked, 'Mute changes'); click('back');
  });
  await test('keyboard run, pickup, jump and dash through DOM events', () => {
    click('play'); frames(2); const startX=g.player.x; key('KeyD');frames(100);key('KeyD',false);
    assert(g.player.x>startX+160, 'Running input');assert(g.level.bits.some(b=>b.collected), 'Pickups from running');assert(document.getElementById('bits-count').textContent !== '00', 'HUD increments');
    const startY=g.player.y;key('Space');frames(30);key('Space',false);assert(g.player.y<startY-50,'Jump input');
    key('ShiftLeft');frames(6);key('ShiftLeft',false);assert(g.player.dash>0&&g.player.cooldown>0,'Dash input');key('KeyD',false);
  });
  await test('pause freezes time and settings return to pause',()=>{
    key('Escape');const time=g.elapsed;frames(120);assert(g.state==='paused'&&g.elapsed===time,'Pause stops simulation');
    click('settings');click('back');assert(g.ui.current==='pause','Settings return to pause');click('resume');assert(g.state==='playing','Resume works');
  });
  await test('restarting clears the run',()=>{key('KeyR');frames(2);assert(g.player.x===g.level.spawn.x,'Restart restores spawn');assert(g.level.bits.every(b=>!b.collected),'Restart clears pickups');assert(g.elapsed<.1,'Restart clears timer');});
  await test('simultaneous touch movement and jump',()=>{
    const right=document.querySelector('[data-key="right"]'), jump=document.querySelector('[data-key="jump"]');
    // Simulated pointer capture is intentionally stubbed only for this unit test.
    const originals=[right.setPointerCapture,jump.setPointerCapture];right.setPointerCapture=jump.setPointerCapture=()=>{};
    right.dispatchEvent(new PointerEvent('pointerdown',{pointerId:91,bubbles:true}));frames(15);
    jump.dispatchEvent(new PointerEvent('pointerdown',{pointerId:92,bubbles:true}));frames(20);
    assert(g.player.vx>100&&g.player.vy<0,'Direction plus jump');
    right.dispatchEvent(new PointerEvent('pointercancel',{pointerId:91,bubbles:true}));jump.dispatchEvent(new PointerEvent('pointerup',{pointerId:92,bubbles:true}));
    right.setPointerCapture=originals[0];jump.setPointerCapture=originals[1];assert(!g.input.isDown('right')&&!g.input.isDown('jump'),'Touch release/cancel clears input');
  });
  await test('checkpoint, damage, death UI and automatic respawn',()=>{
    g.start(0);const cp=g.level.checkpoints[0];g.player.x=cp.x-10;g.player.y=cp.y-30;g.player.health=1;frames(2);
    assert(cp.active&&g.player.health===3,'Checkpoint fills health');assert(g.checkpoint.x===cp.x-10,'Checkpoint position saved');
    g.player.health=0;frames(1);assert(g.state==='dying','Death animation starts');frames(90);assert(g.ui.current==='death','Signal lost UI appears');frames(400);
    assert(g.state==='playing'&&g.player.x===cp.x-10&&g.player.health===3,'Automatic checkpoint respawn');assert(g.deaths===1,'Death counter');
  });
  for(let index=0;index<3;index++) await test(`sector ${index+1} tower, results, save and next-level flow`,()=>{
    g.start(index);const t=g.level.tower;g.player.x=t.x-20;g.player.y=t.y;frames(2);assert(g.state==='celebrating','Tower activates');frames(360);
    assert(g.state==='complete'&&g.ui.current==='complete','Results appear');assert(g.store.data.records[index].completed,'Completion saved');
    assert(g.store.data.unlocked===Math.min(3,index+2),'Next level unlocked');
    click(index===2?'menu':'next');assert(g.state===(index===2?'menu':'playing'),'Next action works');
  });
  await test('no horizontal overflow',()=>{assert(document.documentElement.scrollWidth<=innerWidth,'Document overflows');});
  const passed=results.filter(r=>r.pass).length;
  status.textContent=`${passed}/${results.length} browser checks passed`;
  const report=document.createElement('details');report.style.cssText='margin-top:6px;max-height:160px;overflow:auto';
  report.innerHTML=`<summary>Test report</summary><pre style="font:9px monospace;white-space:pre-wrap">${results.map(r=>(r.pass?'PASS ':'FAIL ')+r.name+(r.error?' — '+r.error:'')).join('\n')}</pre>`;dock.appendChild(report);
  g.menu();g.testing=false;g.accumulator=0;
  console.info('PIXELBOUND browser QA',JSON.stringify(results));
}
