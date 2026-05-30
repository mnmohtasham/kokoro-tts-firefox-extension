# Kokoro TTS web page reader (Firefox)

Reads web pages aloud using a local [Kokoro](https://github.com/hexgrad/kokoro) TTS API server. Summarization and AI chat via Llama.cpp, Ollama, or LM Studio serving any locally hosted AI model.

## Requirements

- Selfhosted Kokoro TTS server running on any machine (default is `http://127.0.0.1:8880` and can point to your remote server like `https://tts.yourdomain.com`). Status of the servers are visible in the preference menu.
- For summarize / AI chat : Choose either Llama.cpp, Ollama, or LM Studio served on any machine, with at least one capable GGUF AI model.

## Usage

- **Browser Toolbar popup:** playback controls, read page, summarize, voice selection and quality mode, Server1/Server2 switch. Supports 2 instances of Kokoro server for backup.
- **Floating Control buttons** pop up on every pages (domains can be excluded/disabled in the preference tab→ Excluded Sites). Floating window can be disabled in preference menu.
- **AI summerization:** User can choose between local AI model server which status is shown and automatically fetches available models.

## Features

- Sentence-by-sentence TTS with prefetch
- Sever1 / Server2) selection in popup menu
- Voices and modes: Fast, Balanced, Quality
- In-page word by word highlight while reading
- Page summary and webpage AI chat
- Detachable popup window
- Dark mode for AI chat and Summary window
- Font size control for Summary window
- Expandable AI chat and Summary window

## Troubleshooting

- **TTS Offline:** The app uses the default 8880 port for kokoro TTS. Update if you are running on different port.
- **Summerization Offline:** The app uses default ports for all AI model servers. Update if you are using different port number.

