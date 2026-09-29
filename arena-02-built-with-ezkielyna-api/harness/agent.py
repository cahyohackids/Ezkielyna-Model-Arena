#!/usr/bin/env python3
"""Model Arena #02 — minimal coding agent that talks ONLY to Ezkielyna API (OpenAI-compatible chat + tools).

Every token of reasoning and every line of code comes from the model under test; this script only
executes its file tools inside one build folder. No shell, no network, no package installs.

  python3 agent.py <model> <build_dir> [--brief BRIEF.md] [--max-steps 160] [--max-minutes 120]

API key: ~/.ezkielyna-arena.env (EZKIELYNA_API_KEY=...). It is never printed or written to logs.
"""
import argparse, functools, http.server, json, os, re, shutil, subprocess, sys, tempfile, threading, time, urllib.error, urllib.request

API = "https://api.ezkielyna.store/v1/chat/completions"
PROJECT = "model-arena-02"
MAX_FILE = 400_000
MAX_FILES = 120
KEEP_RECENT = 14                 # messages kept verbatim when compacting history
COMPACT_AT_CHARS = 320_000       # ~80k tokens of history before older tool payloads are elided

SYSTEM = """You are a senior game developer taking part in a public benchmark. You work ALONE, fully autonomously, inside an empty project folder, using ONLY the tools provided.

ENVIRONMENT (hard facts, plan around them):
- The folder is served as static files over HTTPS exactly as you write them. There is no build step, no npm, no bundler, no shell, no internet.
- Use plain HTML + CSS + modern JavaScript (ES modules with relative imports, e.g. import { Player } from './src/player.js').
- The page runs under a strict Content-Security-Policy: script-src 'self'. So: NO inline <script> code, NO inline event handlers (onclick=...), NO eval/new Function, NO external URLs/CDNs. Put all JS in .js files loaded with <script type="module" src="./src/main.js"></script>.
- Images/sprites/sounds must be generated in code (canvas drawing, pixel arrays, Web Audio API). You cannot fetch or embed files from the internet.
- index.html must be at the root of the folder. Use relative paths only (./...).

TOOLS: list_files, read_file, write_file, edit_file, check_project, smoke_test, finish.
- write_file creates/overwrites a whole file. Prefer several focused modules over one giant file; keep each file under ~1500 lines.
- edit_file replaces an exact unique snippet; use it for targeted fixes.
- check_project syntax-checks every .js file as an ES module and verifies that every relative import/script/link target exists. Run it after every few files and ALWAYS before finish; fix every error it reports.
- smoke_test opens index.html in a real headless Chrome, clicks and presses Enter/Space/arrows/WASD/Shift/X/Z/C/Escape/P like a player for ~8 seconds, and returns every uncaught exception, console error and failed file request, layout problems (controls outside the viewport, canvas that does not fit, canvas that stays blank), plus a short trace of what was on the page. Static checks cannot find runtime bugs — run smoke_test after every significant change and fix what it reports. Note: it only exercises the start of the game; also reason carefully about code paths it cannot reach (later levels, death, checkpoints, boss).
- finish ends the session. Call it only when the game is complete, check_project and smoke_test are clean, and README.md (how to play, controls, features) and REPORT.md (architecture, decisions, known limitations, what you would do next) exist.

WORKING STYLE: plan the architecture briefly, then build it file by file. Do not stop to ask questions — make strong decisions yourself. Do not describe code you have not written; write it. Quality over speed: this is judged as a finished indie game."""

TOOLS = [
    {"type": "function", "function": {"name": "list_files", "description": "List files in the project (recursive) with sizes.",
     "parameters": {"type": "object", "properties": {}, "required": []}}},
    {"type": "function", "function": {"name": "read_file", "description": "Read a text file. Optionally a line range (1-based, inclusive).",
     "parameters": {"type": "object", "properties": {"path": {"type": "string"}, "start_line": {"type": "integer"}, "end_line": {"type": "integer"}},
                    "required": ["path"]}}},
    {"type": "function", "function": {"name": "write_file", "description": "Create or overwrite a text file with the full content.",
     "parameters": {"type": "object", "properties": {"path": {"type": "string"}, "content": {"type": "string"}}, "required": ["path", "content"]}}},
    {"type": "function", "function": {"name": "edit_file", "description": "Replace one exact, unique occurrence of old_string with new_string in a file.",
     "parameters": {"type": "object", "properties": {"path": {"type": "string"}, "old_string": {"type": "string"}, "new_string": {"type": "string"}},
                    "required": ["path", "old_string", "new_string"]}}},
    {"type": "function", "function": {"name": "check_project", "description": "Syntax-check all JS as ES modules and verify every relative import / script src / link href exists.",
     "parameters": {"type": "object", "properties": {}, "required": []}}},
    {"type": "function", "function": {"name": "smoke_test", "description": "Run the game in headless Chrome with simulated player input and report runtime errors.",
     "parameters": {"type": "object", "properties": {}, "required": []}}},
    {"type": "function", "function": {"name": "finish", "description": "End the session with a short summary of what was built.",
     "parameters": {"type": "object", "properties": {"summary": {"type": "string"}}, "required": ["summary"]}}},
]


def load_key():
    path = os.path.expanduser("~/.ezkielyna-arena.env")
    for line in open(path):
        if line.startswith("EZKIELYNA_API_KEY="):
            key = line.split("=", 1)[1].strip()
            if key:
                return key
    sys.exit("EZKIELYNA_API_KEY missing in ~/.ezkielyna-arena.env")


class Workspace:
    def __init__(self, root):
        self.root = os.path.realpath(root)

    def path(self, rel):
        rel = str(rel or "").strip().lstrip("/")
        full = os.path.realpath(os.path.join(self.root, rel))
        if full != self.root and not full.startswith(self.root + os.sep):
            raise ValueError("path escapes the project folder")
        if "/.arena" in full[len(self.root):] or full.endswith("/.arena"):
            raise ValueError("that folder is reserved")
        return full

    def files(self):
        out = []
        for base, dirs, names in os.walk(self.root):
            dirs[:] = [d for d in dirs if d != ".arena"]
            for n in names:
                full = os.path.join(base, n)
                out.append((os.path.relpath(full, self.root), os.path.getsize(full)))
        return sorted(out)

    def _serve(self):
        if getattr(self, "_port", None):
            return self._port
        class Quiet(http.server.SimpleHTTPRequestHandler):
            def log_message(self, *args):
                pass
        handler = functools.partial(Quiet, directory=self.root)
        srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        self._port = srv.server_address[1]
        return self._port

    def smoke_test(self):
        if not os.path.isfile(os.path.join(self.root, "index.html")):
            return "ERROR: no index.html yet"
        url = "http://127.0.0.1:%d/index.html?t=%d" % (self._serve(), int(time.time()))
        script = os.path.join(os.path.dirname(os.path.abspath(__file__)), "smoke.mjs")
        try:
            r = subprocess.run(["node", script, url], capture_output=True, text=True, timeout=90)
            data = json.loads((r.stdout or "{}").strip().splitlines()[-1])
        except Exception as e:
            return "smoke test could not run: %s" % e
        self.last_smoke_ok = bool(data.get("ok"))
        return json.dumps(data, indent=1)[:6000]

    # --- tools
    def list_files(self):
        items = self.files()
        return "\n".join("%s  (%d bytes)" % f for f in items) or "(empty folder)"

    def read_file(self, path, start_line=None, end_line=None):
        full = self.path(path)
        if not os.path.isfile(full):
            return "ERROR: %s does not exist" % path
        lines = open(full, encoding="utf-8", errors="replace").read().split("\n")
        s = max(1, int(start_line or 1)); e = min(len(lines), int(end_line or len(lines)))
        if e - s > 600:
            e = s + 600
        body = "\n".join("%5d  %s" % (i, lines[i - 1]) for i in range(s, e + 1))
        more = "" if e >= len(lines) else "\n... (%d more lines; read with start_line=%d)" % (len(lines) - e, e + 1)
        return body + more

    def write_file(self, path, content):
        full = self.path(path)
        if len(content.encode()) > MAX_FILE:
            return "ERROR: file too large (max %d bytes) — split it into modules" % MAX_FILE
        if not os.path.exists(full) and len(self.files()) >= MAX_FILES:
            return "ERROR: too many files (max %d)" % MAX_FILES
        os.makedirs(os.path.dirname(full), exist_ok=True)
        open(full, "w", encoding="utf-8").write(content)
        return "wrote %s (%d lines, %d bytes)" % (path, content.count("\n") + 1, len(content.encode()))

    def edit_file(self, path, old_string, new_string):
        full = self.path(path)
        if not os.path.isfile(full):
            return "ERROR: %s does not exist" % path
        text = open(full, encoding="utf-8").read()
        n = text.count(old_string)
        if n != 1:
            return "ERROR: old_string found %d times (must be exactly 1). Read the file and use a longer, unique snippet." % n
        open(full, "w", encoding="utf-8").write(text.replace(old_string, new_string, 1))
        return "edited %s" % path

    def check_project(self):
        problems, checked = [], 0
        node = shutil.which("node")
        tmp = tempfile.mkdtemp(prefix="arena-check-")
        try:
            for rel, _ in self.files():
                full = os.path.join(self.root, rel)
                if rel.endswith((".js", ".mjs")):
                    checked += 1
                    src = open(full, encoding="utf-8", errors="replace").read()
                    if node:
                        probe = os.path.join(tmp, "m.mjs")
                        open(probe, "w").write(src)
                        r = subprocess.run([node, "--check", probe], capture_output=True, text=True, timeout=30)
                        if r.returncode:
                            msg = re.sub(r"\S*arena-check-[^/\s]*/m\.mjs", rel, r.stderr or r.stdout).strip().split("\n")
                            problems.append("SYNTAX %s: %s" % (rel, " | ".join(msg[:6])[:600]))
                    for m in re.finditer(r"""(?:import|export)[^'"]*?from\s*['"](\.{1,2}/[^'"]+)['"]|import\(\s*['"](\.{1,2}/[^'"]+)['"]\s*\)|^\s*import\s+['"](\.{1,2}/[^'"]+)['"]""", src, re.M):
                        target = next(g for g in m.groups() if g)
                        if not os.path.isfile(os.path.normpath(os.path.join(os.path.dirname(full), target))):
                            problems.append("MISSING import in %s: %s" % (rel, target))
                    if re.search(r"\beval\s*\(|new\s+Function\s*\(", src):
                        problems.append("CSP %s: eval/new Function is blocked by the page's CSP" % rel)
                elif rel.endswith(".html"):
                    src = open(full, encoding="utf-8", errors="replace").read()
                    for m in re.finditer(r"""<(?:script|img|link)[^>]+(?:src|href)\s*=\s*['"]([^'"]+)['"]""", src, re.I):
                        t = m.group(1)
                        if re.match(r"^(https?:)?//", t):
                            problems.append("EXTERNAL URL in %s: %s (not allowed)" % (rel, t))
                        elif not t.startswith(("data:", "#")) and not os.path.isfile(os.path.normpath(os.path.join(os.path.dirname(full), t.split("?")[0]))):
                            problems.append("MISSING file referenced in %s: %s" % (rel, t))
                    if re.search(r"<script(?![^>]*\bsrc=)[^>]*>\s*\S", src, re.I):
                        problems.append("CSP %s: inline <script> code is blocked; move it to a .js file" % rel)
                    if re.search(r"\son[a-z]+\s*=\s*['\"]", src, re.I):
                        problems.append("CSP %s: inline event handler attributes (onclick=...) are blocked" % rel)
            if not os.path.isfile(os.path.join(self.root, "index.html")):
                problems.append("MISSING index.html at the project root")
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
        return ("OK: %d JS files checked, no problems." % checked) if not problems else "PROBLEMS (%d):\n%s" % (len(problems), "\n".join(problems[:60]))


def stream_chat(key, model, messages, max_tokens, log):
    body = {"model": model, "messages": messages, "tools": TOOLS, "tool_choice": "auto", "stream": True,
            "stream_options": {"include_usage": True}, "max_tokens": max_tokens, "temperature": 0.4}
    req = urllib.request.Request(API, data=json.dumps(body).encode(), headers={
        "Authorization": "Bearer " + key, "Content-Type": "application/json", "Accept": "text/event-stream",
        "X-Ezkielyna-Project": PROJECT, "User-Agent": "ezk-arena-harness/1.0"})
    content, reasoning, calls, usage, finish = "", "", {}, None, None
    with urllib.request.urlopen(req, timeout=900) as r:
        for raw in r:
            line = raw.decode("utf-8", "ignore").strip()
            if not line.startswith("data:"):
                continue
            data = line[5:].strip()
            if data == "[DONE]":
                break
            try:
                chunk = json.loads(data)
            except ValueError:
                continue
            if chunk.get("error"):
                raise RuntimeError("stream error: %s" % str(chunk["error"])[:300])
            usage = chunk.get("usage") or usage
            for ch in chunk.get("choices") or []:
                d = ch.get("delta") or {}
                content += d.get("content") or ""
                reasoning += d.get("reasoning_content") or ""
                for tc in d.get("tool_calls") or []:
                    c = calls.setdefault(tc.get("index", 0), {"id": "", "name": "", "arguments": ""})
                    c["id"] = tc.get("id") or c["id"]
                    f = tc.get("function") or {}
                    c["name"] += f.get("name") or ""
                    c["arguments"] += f.get("arguments") or ""
                finish = ch.get("finish_reason") or finish
    return content, reasoning, [calls[i] for i in sorted(calls)], usage, finish


def compact(messages):
    """Elide bulky payloads in older turns so the conversation fits the model's context."""
    size = sum(len(json.dumps(m)) for m in messages)
    if size < COMPACT_AT_CHARS:
        return messages
    cut = len(messages) - KEEP_RECENT
    for m in messages[2:cut]:
        if m["role"] == "tool" and len(m.get("content") or "") > 400:
            m["content"] = m["content"][:300] + "\n[older tool output elided to save context — call read_file if you need it again]"
        if m["role"] == "assistant":
            for tc in m.get("tool_calls") or []:
                a = tc["function"]["arguments"]
                if len(a) > 600:
                    try:
                        args = json.loads(a)
                        for k in ("content", "new_string", "old_string"):
                            if k in args and len(args[k]) > 200:
                                args[k] = args[k][:120] + " …[elided; the file on disk is the source of truth]"
                        tc["function"]["arguments"] = json.dumps(args)
                    except ValueError:
                        tc["function"]["arguments"] = json.dumps({"note": "elided"})
    return messages


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("model"); ap.add_argument("build_dir")
    ap.add_argument("--brief", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "BRIEF.md"))
    ap.add_argument("--max-steps", type=int, default=160); ap.add_argument("--max-minutes", type=int, default=120)
    ap.add_argument("--max-tokens", type=int, default=16000)
    ap.add_argument("--resume", action="store_true", help="continue a previous session's work in the same folder")
    ap.add_argument("--wrapup", action="store_true", help="short final session: finish docs + checks, no new features")
    a = ap.parse_args()
    key = load_key()
    os.makedirs(a.build_dir, exist_ok=True)
    ws = Workspace(a.build_dir)
    meta = os.path.join(ws.root, ".arena"); os.makedirs(meta, exist_ok=True)
    log = open(os.path.join(meta, "transcript.jsonl"), "a")
    prev = None
    if os.path.isfile(os.path.join(meta, "stats.json")):
        prev = json.load(open(os.path.join(meta, "stats.json")))
    brief = open(a.brief, encoding="utf-8").read()
    first = "Here is the full brief. Build the game it describes in this folder.\n\n" + brief
    if a.resume:
        first = ("Here is the full brief. The folder already contains YOUR OWN work from a previous session that ran out of steps. "
                 "Start with list_files and check_project, read what you need, then complete everything the brief asks for that is "
                 "missing or broken, write README.md and REPORT.md, and call finish.\n\n" + brief)
    if a.wrapup:
        first = ("The folder contains YOUR OWN game from previous sessions. It runs and smoke_test is clean, but you never called finish. "
                 "This is the final session (max %d steps): do NOT start new features or refactors. Fix only a clearly broken thing if you "
                 "find one, write README.md (how to play, controls, features) and REPORT.md (architecture, decisions, known limitations, next "
                 "steps) based on the actual code, run check_project and smoke_test, then call finish.\n\nOriginal brief for reference:\n\n" % a.max_steps) + brief
    messages = [{"role": "system", "content": SYSTEM}, {"role": "user", "content": first}]
    stats = {"model": a.model, "requests": 0, "prompt_tokens": 0, "completion_tokens": 0, "tool_calls": 0, "errors": 0,
             "started": time.strftime("%Y-%m-%d %H:%M:%S"), "finished": None, "summary": None}
    if (a.resume or a.wrapup) and prev:
        for k in ("requests", "prompt_tokens", "completion_tokens", "tool_calls", "errors"):
            stats[k] = prev.get(k, 0)
        stats["started"] = prev.get("started", stats["started"]); stats["sessions"] = prev.get("sessions", 1) + 1
    t0, nudges, max_tokens = time.time(), 0, a.max_tokens

    def save():
        stats["elapsed_min"] = round((time.time() - t0) / 60, 1)
        json.dump(stats, open(os.path.join(meta, "stats.json"), "w"), indent=2)

    for step in range(1, a.max_steps + 1):
        if time.time() - t0 > a.max_minutes * 60:
            print("time budget reached"); break
        messages = compact(messages)
        left = a.max_steps - step + 1
        if left in (20, 8):
            messages.append({"role": "user", "content": "Only %d steps left in this session. Wrap up: make sure README.md and REPORT.md exist, "
                                                        "check_project and smoke_test are clean, then call finish." % left})
        for attempt in range(6):
            try:
                content, reasoning, calls, usage, finish = stream_chat(key, a.model, messages, max_tokens, log)
                break
            except urllib.error.HTTPError as e:
                detail = e.read()[:300].decode("utf-8", "ignore")
                stats["errors"] += 1
                print("  HTTP %s: %s" % (e.code, detail[:160]))
                if e.code == 400 and "max_tokens" in detail and max_tokens > 8000:
                    max_tokens = 8000; continue
                if e.code in (401, 403):
                    save(); sys.exit("auth error — stopping")
                time.sleep(min(60, 5 * 2 ** attempt))
            except Exception as e:
                stats["errors"] += 1
                print("  error: %s" % str(e)[:200])
                time.sleep(min(60, 5 * 2 ** attempt))
        else:
            print("giving up after repeated errors"); break
        stats["requests"] += 1
        if usage:
            stats["prompt_tokens"] += usage.get("prompt_tokens") or 0
            stats["completion_tokens"] += usage.get("completion_tokens") or 0
        msg = {"role": "assistant", "content": content or None}
        bad_args = set()
        if calls:
            msg["tool_calls"] = []
            for i, c in enumerate(calls):
                args_text = c["arguments"] or "{}"
                try:
                    json.loads(args_text)
                except ValueError:
                    bad_args.add(i)
                    args_text = "{}"          # a cut-off call must not poison the history (upstream rejects invalid JSON)
                msg["tool_calls"].append({"id": c["id"] or "call_%d_%d" % (step, i), "type": "function",
                                          "function": {"name": c["name"] or "write_file", "arguments": args_text}})
        messages.append(msg)
        log.write(json.dumps({"step": step, "t": round(time.time() - t0, 1), "finish": finish, "usage": usage,
                              "content": content[:4000], "reasoning_chars": len(reasoning),
                              "calls": [{"name": c["name"], "args_chars": len(c["arguments"])} for c in calls]}) + "\n"); log.flush()
        names = ", ".join(c["name"] for c in calls) or "(text)"
        print("[%s] step %d  %.0fs  %s" % (a.model, step, time.time() - t0, names), flush=True)
        if not calls:
            nudges += 1
            if nudges > 4:
                print("model stopped using tools; ending"); break
            messages.append({"role": "user", "content": "Continue building using the tools. When everything is complete and check_project is clean, call finish."})
            continue
        nudges = 0
        done = False
        for i, tc in enumerate(msg["tool_calls"]):
            name = tc["function"]["name"]; stats["tool_calls"] += 1
            args = None if i in bad_args else json.loads(tc["function"]["arguments"] or "{}")
            if args is None:
                result = ("ERROR: this tool call was cut off because the response hit the output limit (finish_reason=%s). "
                          "Nothing was written. Keep thinking shorter and write smaller files (e.g. under ~600 lines each), one per call." % finish)
            if args is not None:
                try:
                    if name == "finish":
                        chk = ws.check_project()
                        missing = [f for f in ("index.html", "README.md", "REPORT.md") if not os.path.isfile(os.path.join(ws.root, f))]
                        smoke = ws.smoke_test() if chk.startswith("OK") else ""
                        if smoke and not getattr(ws, "last_smoke_ok", False):
                            chk = "smoke_test still reports errors:\n" + smoke
                        if chk.startswith("OK") and not missing:
                            stats["summary"] = str(args.get("summary", ""))[:2000]; done = True
                            result = "Session finished."
                        else:
                            result = "Not finished yet. %s %s" % (chk, ("Missing: " + ", ".join(missing)) if missing else "")
                    elif name in ("list_files", "check_project", "smoke_test"):
                        result = getattr(ws, name)()
                    elif name in ("read_file", "write_file", "edit_file"):
                        result = getattr(ws, name)(**{k: v for k, v in args.items() if k in ("path", "start_line", "end_line", "content", "old_string", "new_string")})
                    else:
                        result = "ERROR: unknown tool %s" % name
                except Exception as e:
                    result = "ERROR: %s" % e
            messages.append({"role": "tool", "tool_call_id": tc["id"], "content": result[:20000]})
            log.write(json.dumps({"step": step, "tool": name, "path": (args or {}).get("path"), "result": result[:300]}) + "\n"); log.flush()
        save()
        if done:
            stats["finished"] = time.strftime("%Y-%m-%d %H:%M:%S"); save()
            print("FINISHED:", stats["summary"][:300]); return
    save()
    print("stopped without finish (steps/time budget).")


if __name__ == "__main__":
    main()
