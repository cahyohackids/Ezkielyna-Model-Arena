# Arena #02 — Built with Ezkielyna API

Every build in this folder was written by the model under test, called only through the Ezkielyna API gateway (`https://api.ezkielyna.store/v1`, OpenAI-compatible chat completions with tool calling).

## How the builds were made

[`harness/agent.py`](harness/agent.py) is a deliberately small coding agent. It gives the model six tools, and nothing else: no shell, no internet, no package installs.

| Tool | What it does |
|---|---|
| `list_files` | List the files in the build folder |
| `read_file` | Read a file |
| `write_file` | Create or overwrite a file |
| `edit_file` | Change one exact snippet in a file |
| `check_project` | ES-module syntax check, missing-import check, and page CSP rules |
| `smoke_test` | [`harness/smoke.mjs`](harness/smoke.mjs): opens the game in headless Chrome, plays inputs for about 8 seconds, and reports runtime errors, controls outside the viewport and blank canvases |

- A session ends only when the model calls `finish` and both checks are clean.
- Sessions that ran out of steps were continued from the model's own files (`--resume`, then a short `--wrapup`).
- `ARENA-STATS.json` in each build records its requests, tokens and sessions.
- The brief is identical to Arena #01: [BRIEF.md](BRIEF.md).
