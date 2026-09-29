// Headless smoke test for an Arena build: open the page in Chrome, press keys / click like a player,
// and report uncaught exceptions + console errors. Usage: node smoke.mjs <url>  (prints JSON)
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const url = process.argv[2];
const CHROME = ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Chromium.app/Contents/MacOS/Chromium"].find(existsSync);
if (!CHROME) { console.log(JSON.stringify({ ok: false, note: "no Chrome installed; smoke test unavailable" })); process.exit(0); }
const profile = mkdtempSync(join(tmpdir(), "arena-smoke-"));
const chrome = spawn(CHROME, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run",
  "--no-default-browser-check", "--mute-audio", "--autoplay-policy=no-user-gesture-required", "--window-size=1280,800", "about:blank"],
  { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const done = (out) => { try { chrome.kill("SIGKILL"); } catch {} ; try { rmSync(profile, { recursive: true, force: true }); } catch {} ; console.log(JSON.stringify(out)); process.exit(0); };
setTimeout(() => done({ ok: false, note: "smoke test timed out" }), 60000);

let port;
for (let i = 0; i < 100 && !port; i++) {
  await sleep(100);
  try { port = readFileSync(join(profile, "DevToolsActivePort"), "utf8").split("\n")[0]; } catch {}
}
if (!port) done({ ok: false, note: "Chrome did not start" });
const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const page = targets.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let id = 0; const pending = new Map();
const errors = [], consoleErrors = [], failedRequests = [];
ws.addEventListener("message", (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === "Runtime.exceptionThrown") {
    const d = m.params.exceptionDetails;
    const where = d.stackTrace?.callFrames?.[0];
    errors.push(`${d.exception?.description?.split("\n")[0] || d.text}${where ? ` (at ${where.url.replace(/^https?:\/\/[^/]+\//, "")}:${where.lineNumber + 1})` : ""}`);
  }
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") {
    consoleErrors.push(m.params.args.map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 300));
  }
  if (m.method === "Network.loadingFailed" && !m.params.canceled) failedRequests.push(m.params.errorText);
  if (m.method === "Network.responseReceived" && m.params.response.status >= 400) failedRequests.push(`${m.params.response.status} ${m.params.response.url.replace(/^https?:\/\/[^/]+\//, "")}`);
});
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const key = async (k, code, vk, holdMs = 60) => {
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code, windowsVirtualKeyCode: vk });
  await sleep(holdMs);
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code, windowsVirtualKeyCode: vk });
};
const click = async (x, y) => {
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
};
await send("Runtime.enable"); await send("Network.enable"); await send("Page.enable");
await send("Page.navigate", { url });
await sleep(2500);
const phases = [];
const LAYOUT = `(() => {
  const W = innerWidth, H = innerHeight, out = [];
  const vis = (e) => { const cs = getComputedStyle(e); return cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.05; };
  const els = [...document.querySelectorAll('button, a, [role=button], input, select')].filter(vis);
  const off = els.filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right <= 0 || r.left >= W || r.bottom <= 0 || r.top >= H || r.left < -2 || r.right > W + 2); });
  if (off.length) out.push(off.length + ' visible control(s) are partly or fully outside the ' + W + 'x' + H + ' viewport, e.g. ' + off.slice(0, 3).map((e) => '"' + (e.innerText || e.getAttribute('aria-label') || e.tagName).trim().slice(0, 30) + '" at x=' + Math.round(e.getBoundingClientRect().left) + ',y=' + Math.round(e.getBoundingClientRect().top)).join('; '));
  const cv = [...document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height)[0];
  if (cv) {
    const r = cv.getBoundingClientRect();
    if (r.right > W + 2 || r.bottom > H + 2 || r.left < -2 || r.top < -2) out.push('main canvas (' + Math.round(r.width) + 'x' + Math.round(r.height) + ' at ' + Math.round(r.left) + ',' + Math.round(r.top) + ') does not fit the ' + W + 'x' + H + ' viewport');
    try {
      const c2 = document.createElement('canvas'); c2.width = 64; c2.height = 36; const g = c2.getContext('2d'); g.drawImage(cv, 0, 0, 64, 36);
      const d = g.getImageData(0, 0, 64, 36).data, seen = new Set();
      for (let i = 0; i < d.length; i += 4) seen.add((d[i] >> 4) + ',' + (d[i + 1] >> 4) + ',' + (d[i + 2] >> 4));
      out.push('main canvas shows ' + seen.size + ' distinct colours' + (seen.size <= 2 ? ' (looks BLANK — nothing visible is being drawn)' : ''));
    } catch (e) { out.push('canvas could not be sampled'); }
  }
  return out.join(' | ');
})()`;
const layoutIssues = [];
const snap = async (label) => {
  const r = await send("Runtime.evaluate", { expression: "document.title + ' | canvases=' + document.querySelectorAll('canvas').length + ' | text=' + (document.body?.innerText||'').replace(/\\s+/g,' ').slice(0,160)", returnByValue: true });
  const l = await send("Runtime.evaluate", { expression: LAYOUT, returnByValue: true });
  const layout = l.result?.result?.value ?? "";
  if (/outside|does not fit|BLANK/.test(layout)) layoutIssues.push(`${label}: ${layout}`);
  phases.push(`${label}: ${r.result?.result?.value ?? "?"} | ${layout} | errors so far=${errors.length}`);
};
await snap("after load");
await click(640, 400); await key("Enter", "Enter", 13); await sleep(1200);
await key("Enter", "Enter", 13); await key(" ", "Space", 32); await sleep(1200);
await snap("after Enter/click (start game)");
await key("ArrowRight", "ArrowRight", 39, 1500);
await key(" ", "Space", 32, 250); await key("ArrowRight", "ArrowRight", 39, 800);
await key("Shift", "ShiftLeft", 16); await key("x", "KeyX", 88); await key("z", "KeyZ", 90); await key("c", "KeyC", 67);
await key("ArrowLeft", "ArrowLeft", 37, 600); await key("ArrowUp", "ArrowUp", 38, 200); await key("d", "KeyD", 68, 700); await key("w", "KeyW", 87, 200);
await sleep(1500);
await snap("after ~6s of play input");
await key("Escape", "Escape", 27); await sleep(600); await key("p", "KeyP", 80); await sleep(600);
await snap("after Escape/P (pause)");
const uniq = (a) => [...new Set(a)];
done({ ok: errors.length === 0 && consoleErrors.length === 0 && layoutIssues.length === 0, uncaught_exceptions: uniq(errors).slice(0, 15),
  layout_issues: layoutIssues.slice(0, 6), viewport: "1280x800 desktop browser window",
  console_errors: uniq(consoleErrors).slice(0, 10), failed_requests: uniq(failedRequests).slice(0, 10), phases });
