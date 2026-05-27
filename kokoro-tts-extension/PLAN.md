# Page TTS Extension — Rebuild Plan

## Goal

Rebuild the Firefox extension with **feature parity** to the original, in a clean project tree, with **no prior authorship metadata** (new add-on ID, neutral naming, no signed META-INF bundle).

## Feature parity matrix

| Area | Behavior |
|------|----------|
| **TTS engine** | Local Kokoro API 0.4.x: `/health`, `/v1/audio/voices`, `/v1/audio/speech` |
| **Endpoints** | Two configurable bases (IP1 / IP2); auto-detect on first run via health check |
| **Playback** | Sentence splitting, prefetch (2 ahead), play / pause / stop / prev / next |
| **Sentence logic** | Abbreviation protection, CJK merge, citation bracket removal, block boundaries, long-sentence comma split |
| **Highlighting** | Highlight current phrase, scroll to ~20% from top, sequential position tracking |
| **Popup** | Status, LAN/VPN toggle, controls, read page, summarize, voice/mode, GPU bar from health, pin to detached window |
| **Options** | URLs, default voice/mode, Ollama summary model, excluded sites, connection test |
| **Context menus** | Read from selection, read page, summarize page |
| **Content UI** | Floating summarize / read / ask; summary overlay with markdown, read/copy/font controls |
| **Summarization** | Ollama on same host as Kokoro, port 11434; auto model pick or user-selected |
| **Storage** | `lanUrl`, `vpnUrl`, `apiMode`, `voice`, `mode`, `summaryModel`, `excludedSites`, `askPrompt` |

## Architecture

```
manifest.json
background.html → background.js   (state, TTS queue, menus, messages)
popup.html      → popup.js        (toolbar UI)
options.html    → options.js      (settings)
content.js                        (in-page FABs + overlays)
icon.svg
```

### Message types (background)

- `get-state`, `play`, `pause`, `stop`, `next`, `prev`
- `set-voice`, `set-mode`, `set-api-mode`
- `read-selection`, `read-page`, `read-summary`, `toggle-read`
- `get-voices`, `check-health`, `summarize-page`
- Outbound: `state-update` (popup), `ptts-content-state` (active tab)

## Naming (authorship-neutral)

| Original | Rebuild |
|----------|---------|
| `My KokoroTTS` | `Page TTS` |
| `kokoro-*` DOM / CSS | `ptts-*` |
| Fixed gecko ID | New UUID in manifest |
| META-INF signed files | Omitted (dev load only) |
| Personal default IPs in README | `127.0.0.1:8880` only |

## Out of scope (unchanged from original todo list)

- Mobile Firefox polish beyond existing guards
- Bottom control bar

## Load for testing

1. `about:debugging` → This Firefox → Load Temporary Add-on → `page-tts-extension/manifest.json`
2. Options: set IP1/IP2 to your Kokoro server
3. Ensure Ollama on Kokoro host:11434 for summarize / ask

## File checklist

- [x] `PLAN.md` (this document)
- [x] `README.md`
- [x] `manifest.json`
- [x] `background.html`, `background.js`
- [x] `popup.html`, `popup.js`
- [x] `options.html`, `options.js`
- [x] `content.js`
- [x] `icon.svg`
