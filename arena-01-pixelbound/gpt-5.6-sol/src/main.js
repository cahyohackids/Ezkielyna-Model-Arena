import { Game } from "./game.js";
import { AudioManager } from "./audio.js";
import { LEVELS } from "./levels.js";
import { loadSave, writeSave, recordCompletion } from "./storage.js";

const $ = sel => document.querySelector(sel);
const $$ = sel => [...document.querySelectorAll(sel)];
const canvas = $("#game");
const touchControls = $("#touch-controls");
const toast = $("#toast");
let save = loadSave();
let currentScreen = "main-menu";
let settingsReturn = "main-menu";
let toastTimer = 0;

const audio = new AudioManager(save.settings);
const game = new Game(canvas, audio, save.settings, handleGameEvent);

function showScreen(id) {
  $$(".screen").forEach(el => el.classList.toggle("active", el.id === id));
  currentScreen = id;
  const first = document.querySelector(`#${id} button:not([disabled])`);
  if (first) setTimeout(() => first.focus({ preventScroll:true }), 0);
}

function hideScreens() {
  $$(".screen").forEach(el => el.classList.remove("active"));
  currentScreen = "gameplay";
  canvas.focus?.();
}

function setTouchGameplay(value) { touchControls.classList.toggle("gameplay", value); }

function beginLevel(index) {
  hideScreens(); setTouchGameplay(true); audio.play("click"); game.startLevel(index);
}

function continuePlay() {
  let index = 0;
  for (let i = 0; i < LEVELS.length; i++) if (save.levels[String(i)]?.complete && i + 1 < save.unlocked) index = i + 1;
  beginLevel(index);
}

function renderLevelCards() {
  const container = $("#level-cards"); container.innerHTML = "";
  LEVELS.forEach((level, index) => {
    const unlocked = index < save.unlocked;
    const progress = save.levels[String(index)] || {};
    const button = document.createElement("button");
    button.className = `level-card${unlocked ? "" : " locked"}`;
    button.disabled = !unlocked;
    button.dataset.level = String(index);
    button.style.setProperty("--preview", level.palette.sky);
    button.style.setProperty("--hill", level.palette.mid);
    button.style.setProperty("--accent", level.palette.accent);
    button.innerHTML = `
      ${unlocked ? "" : '<span class="lock-label">SIGNAL LOCKED</span>'}
      <div class="level-preview"><i class="preview-lines"></i></div>
      <div class="level-copy"><small>${level.zone} · ${level.difficulty}</small><strong>${level.name}</strong><p>${level.subtitle}</p></div>
      <div class="level-progress"><span>${progress.complete ? "RESTORED" : "UNSTABLE"}</span><span>◆ ${progress.bits || 0}/${level.bits.length} &nbsp; ◉ ${progress.cores || 0}/3</span></div>`;
    if (unlocked) button.addEventListener("click", () => beginLevel(index));
    container.append(button);
  });
}

function openSettings() {
  settingsReturn = currentScreen === "gameplay" ? "pause-menu" : currentScreen;
  if (game.active && !game.paused) game.pause(true);
  syncSettingsUI(); showScreen("settings"); setTouchGameplay(false);
}

function closeSettings() {
  applySettings();
  if (settingsReturn === "pause-menu" && game.active) showScreen("pause-menu");
  else showScreen(settingsReturn === "settings" ? "main-menu" : settingsReturn);
}

function syncSettingsUI() {
  $("#music-volume").value = save.settings.music;
  $("#sfx-volume").value = save.settings.sfx;
  $("#mute").checked = save.settings.mute;
  $("#shake").checked = save.settings.shake;
  $("#reduced-motion").checked = save.settings.reducedMotion;
}

function applySettings() {
  save.settings = {
    music: Number($("#music-volume").value), sfx: Number($("#sfx-volume").value),
    mute: $("#mute").checked, shake: $("#shake").checked, reducedMotion: $("#reduced-motion").checked,
  };
  game.applySettings(save.settings); writeSave(save);
}

function showToast(message) {
  toast.textContent = message; toast.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove("show"),2100);
}

function handleGameEvent(type, payload) {
  if (type === "pause-request") { game.pause(true);showScreen("pause-menu");setTouchGameplay(false); }
  else if (type === "resume-request") resumeGame();
  else if (type === "restart-request") beginLevel(game.index);
  else if (type === "toast") showToast(payload);
  else if (type === "game-over") { showScreen("game-over");setTouchGameplay(false); }
  else if (type === "complete") {
    recordCompletion(save, payload.level, payload);renderLevelCards();
    const stat = (label,value) => `<div class="result-stat"><small>${label}</small><strong>${value}</strong></div>`;
    $("#result-stats").innerHTML = stat("TIME",payload.timeLabel)+stat("BITS",`${payload.bits}/${payload.totalBits}`)+stat("CORES",`${payload.cores}/3`)+stat("REBOOTS",payload.deaths);
    const next=$("[data-action='next-level']");next.textContent=payload.level<LEVELS.length-1?"NEXT LEVEL":"MAIN MENU";
    showScreen("level-complete");setTouchGameplay(false);
  }
}

function resumeGame() { hideScreens();setTouchGameplay(true);game.pause(false);audio.play("click"); }

document.addEventListener("click", e => {
  const button = e.target.closest("button[data-action]"); if (!button) return;
  const action = button.dataset.action;audio.unlock();audio.play("click");
  if (action === "play") continuePlay();
  else if (action === "level-select") { if(game.active)game.stop();renderLevelCards();showScreen("level-select");setTouchGameplay(false); }
  else if (action === "how-to") showScreen("how-to");
  else if (action === "settings") openSettings();
  else if (action === "back") { if(currentScreen==="settings")closeSettings();else showScreen("main-menu"); }
  else if (action === "resume") resumeGame();
  else if (action === "restart") beginLevel(game.index);
  else if (action === "retry") { hideScreens();setTouchGameplay(true);game.retryCheckpoint(); }
  else if (action === "main-menu") { game.stop();game.drawTitleBackdrop();showScreen("main-menu");setTouchGameplay(false); }
  else if (action === "next-level") { if(game.index<LEVELS.length-1)beginLevel(game.index+1);else{game.stop();game.drawTitleBackdrop();showScreen("main-menu");} }
});

for (const input of $$("#settings input")) input.addEventListener("input", applySettings);

for (const button of $$("[data-touch]")) {
  const action=button.dataset.touch;
  const down=e=>{e.preventDefault();button.setPointerCapture?.(e.pointerId);game.setControl(action,true);audio.unlock();};
  const up=e=>{e.preventDefault();game.setControl(action,false);};
  button.addEventListener("pointerdown",down);button.addEventListener("pointerup",up);button.addEventListener("pointercancel",up);button.addEventListener("pointerleave",e=>{if(e.buttons===0)up(e);});
}

document.addEventListener("visibilitychange",()=>{if(document.hidden&&game.active&&!game.paused)handleGameEvent("pause-request");});
document.addEventListener("contextmenu",e=>{if(e.target.closest("#touch-controls"))e.preventDefault();});
document.addEventListener("keydown", e => {
  if (currentScreen === "gameplay" || !["ArrowDown", "ArrowUp"].includes(e.key)) return;
  const buttons = [...document.querySelectorAll(`#${currentScreen} button:not([disabled])`)].filter(button => button.offsetParent !== null);
  if (!buttons.length) return;
  e.preventDefault();
  const current = buttons.indexOf(document.activeElement);
  const direction = e.key === "ArrowDown" ? 1 : -1;
  buttons[(current + direction + buttons.length) % buttons.length].focus();
});

syncSettingsUI();renderLevelCards();
