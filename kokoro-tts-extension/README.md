# Page TTS (Firefox)

Read web pages aloud using a local [Kokoro](https://github.com/hexgrad/kokoro) TTS API server. Optional page summarization and custom prompts via Ollama on the same host.

## Requirements

- Kokoro TTS server (default `http://127.0.0.1:8880`)
- For summarize / ask: Ollama on the same machine as Kokoro, port `11434`, with at least one text-generation model

## Install (development)

1. Open `about:debugging`
2. **This Firefox** → **Load Temporary Add-on…**
3. Select `page-tts-extension/manifest.json`

## Usage

- **Toolbar popup:** playback controls, read page, summarize, voice and quality mode, IP1/IP2 switch
- **Right-click:** read from selection, read page, summarize page
- **Floating buttons** on pages (disabled on sites listed in Options → Excluded Sites)
- **Options:** API URLs, defaults, summary model, excluded patterns

## Features

- Sentence-by-sentence TTS with prefetch
- LAN / VPN (IP1 / IP2) auto-detection
- Voices and modes: Fast, Balanced, Quality
- In-page highlight while reading
- Page summary and custom “ask page” prompts (Ollama)
- Detachable popup window (pin control)

## Troubleshooting

- **Offline:** confirm Kokoro is running and the correct IP1/IP2 is selected
- **No audio:** check the browser console; try a short selection first
- **Summarize fails:** confirm Ollama is reachable at `host:11434` from the machine running Kokoro
