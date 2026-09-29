"""Tiny tool-calling probe per model through Ezkielyna API (key read from ~/.ezkielyna-arena.env, never printed)."""
import json, os, sys, time, urllib.request
key = [l.split("=", 1)[1].strip() for l in open(os.path.expanduser("~/.ezkielyna-arena.env")) if l.startswith("EZKIELYNA_API_KEY=")][0]
tools = [{"type": "function", "function": {"name": "write_file", "description": "Write a file",
          "parameters": {"type": "object", "properties": {"path": {"type": "string"}, "content": {"type": "string"}}, "required": ["path", "content"]}}}]
for model in sys.argv[1:]:
    body = {"model": model, "stream": True, "max_tokens": 300, "tools": tools,
            "messages": [{"role": "user", "content": "Create hello.txt containing exactly: hi. Use the write_file tool."}]}
    req = urllib.request.Request("https://api.ezkielyna.store/v1/chat/completions", data=json.dumps(body).encode(),
                                 headers={"Authorization": "Bearer " + key, "Content-Type": "application/json",
                                          "X-Ezkielyna-Project": "model-arena-02", "User-Agent": "ezk-arena-harness/1.0"})
    t = time.time(); calls = {}; text = ""; err = None
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            for raw in r:
                line = raw.decode("utf-8", "ignore").strip()
                if not line.startswith("data:") or line == "data: [DONE]": continue
                ch = json.loads(line[5:]).get("choices") or []
                if not ch: continue
                d = ch[0].get("delta") or {}
                text += d.get("content") or ""
                for tc in d.get("tool_calls") or []:
                    c = calls.setdefault(tc.get("index", 0), {"name": "", "args": ""})
                    f = tc.get("function") or {}
                    c["name"] += f.get("name") or ""; c["args"] += f.get("arguments") or ""
    except Exception as e:
        err = "%s %s" % (type(e).__name__, (getattr(e, "read", lambda: b"")() or b"")[:200])
    print("%-22s %5.1fs tools=%s text=%r err=%s" % (model, time.time() - t, [(c["name"], c["args"][:60]) for c in calls.values()], text[:80], err))
