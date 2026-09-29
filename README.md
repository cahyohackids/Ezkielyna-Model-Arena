# Ezkielyna Model Arena

The same game brief, given to different AI coding models. Every build here is the model's own work, published unedited by **Ezkielyna Lab**. Play them in your browser and compare.

Community page → **https://ezkielyna.store/community/challenges**

## Arena #01 — Pixelbound: Lost Signal

The brief: build a complete, polished 2D platformer from scratch ([BRIEF.md](arena-01-pixelbound/BRIEF.md)). Each model worked alone in its own coding agent.

| Model | Source | Play |
|---|---|---|
| GPT-6 Astra | [`arena-01-pixelbound/gpt-6-astra`](arena-01-pixelbound/gpt-6-astra) | [play](https://play.ezkielyna.store/pixelbound/gpt-6-astra/) |
| GPT-6 Luna | [`arena-01-pixelbound/gpt-6-luna`](arena-01-pixelbound/gpt-6-luna) | [play](https://play.ezkielyna.store/pixelbound/gpt-6-luna/) |
| GPT-5.6 Sol | [`arena-01-pixelbound/gpt-5.6-sol`](arena-01-pixelbound/gpt-5.6-sol) | [play](https://play.ezkielyna.store/pixelbound/gpt-5.6-sol/) |
| GPT-5.6 Luna | [`arena-01-pixelbound/gpt-5.6-luna`](arena-01-pixelbound/gpt-5.6-luna) | [play](https://play.ezkielyna.store/pixelbound/gpt-5.6-luna/) |
| GPT-5.6 Terra | [`arena-01-pixelbound/gpt-5.6-terra`](arena-01-pixelbound/gpt-5.6-terra) | [play](https://play.ezkielyna.store/pixelbound/gpt-5.6-terra/) |
| Claude Opus 5.5 | [cahyohackids/EzkielynaStore-Game](https://github.com/cahyohackids/EzkielynaStore-Game) | [play](https://play.ezkielyna.store/pixelbound/claude-opus-5.5/) |
| Claude Sonnet 5.5 | [cahyohackids/EzkielynaStore-Game1](https://github.com/cahyohackids/EzkielynaStore-Game1) | [play](https://play.ezkielyna.store/pixelbound/claude-sonnet-5.5/) |

The GPT builds were made with Codex (reasoning effort xhigh); the Claude builds with Claude Code.

## Arena #02 — Built with Ezkielyna API

Same brief, but every model is called through **[Ezkielyna API](https://api.ezkielyna.store)**, and every request is recorded in the gateway logs, so the "Built with Ezkielyna API" badge is backed by real usage. See [`arena-02-built-with-ezkielyna-api`](arena-02-built-with-ezkielyna-api) for the builds, the open-source agent harness and per-build stats.

| Model | Source | Status |
|---|---|---|
| DeepSeek v4.1 Flash | [`deepseek-v4.1-flash`](arena-02-built-with-ezkielyna-api/deepseek-v4.1-flash) | finished |
| DeepSeek v4 Pro | `deepseek-v4-pro` | in progress |
| Atria Dawn Preview | `atria-dawn-preview` | in progress |

## Arena #03 — Last Sector: Operation Blackridge

A 3D tactical shooter brief. Builds live in their own repositories:

| Model | Source | Play |
|---|---|---|
| Claude Opus 5.5 | [cahyohackids/Combat-Arena33](https://github.com/cahyohackids/Combat-Arena33) | [play](https://play.ezkielyna.store/last-sector/claude-opus-5.5/) |
| Claude Sonnet 5.5 | [cahyohackids/Combat-Arena99](https://github.com/cahyohackids/Combat-Arena99) | [play](https://play.ezkielyna.store/last-sector/claude-sonnet-5.5/) |

## Run a build locally

Every game is plain static files. From a build folder:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.
