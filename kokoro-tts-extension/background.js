const DEFAULT_LAN = 'http://127.0.0.1:8880';
const DEFAULT_VPN = 'http://127.0.0.1:8880';
const PREFETCH_COUNT = 2;

const HEALTH_PATH = '/health';
const VOICES_PATH = '/v1/audio/voices';
const SPEECH_PATH = '/v1/audio/speech';

function joinUrl(base, path) {
  if (!base) return path;
  return base.replace(/\/+$/, '') + '/' + String(path || '').replace(/^\/+/, '');
}

function withTimeout(ms) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(new DOMException('Timeout', 'TimeoutError')), ms);
  return { signal: controller.signal, cancel: () => clearTimeout(timeoutId) };
}

async function fetchJson(url, options, timeoutMs) {
  const t = typeof timeoutMs === 'number' ? withTimeout(timeoutMs) : null;
  try {
    const res = await fetch(url, { ...(options || {}), signal: t ? t.signal : (options || {}).signal });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  } finally {
    if (t) t.cancel();
  }
}

const state = {
  lanUrl: DEFAULT_LAN,
  vpnUrl: DEFAULT_VPN,
  apiBase: DEFAULT_LAN,
  apiMode: 'lan',
  voice: 'af_jessica',
  mode: 'balanced',
  summaryModel: '',
  isPlaying: false,
  isPaused: false,
  sentences: [],
  currentIndex: 0,
  audioQueue: new Map(),
  fetchingIndices: new Set(),
  currentAudio: null,
  activeTabId: null,
  _lastHighlightIndex: 0
};

function getApiUrl(mode) {
  return mode === 'vpn' ? state.vpnUrl : state.lanUrl;
}

browser.storage.local.get(['apiMode', 'voice', 'mode', 'lanUrl', 'vpnUrl', 'summaryModel']).then((data) => {
  if (data.lanUrl) state.lanUrl = data.lanUrl;
  if (data.vpnUrl) state.vpnUrl = data.vpnUrl;
  if (data.voice) state.voice = data.voice;
  if (data.mode) state.mode = data.mode;
  if (typeof data.summaryModel === 'string') state.summaryModel = data.summaryModel;
  if (data.apiMode) {
    state.apiMode = data.apiMode;
    state.apiBase = getApiUrl(data.apiMode);
  }
  if (!data.apiMode) autoDetectApi();
});

browser.storage.onChanged.addListener((changes) => {
  if (changes.lanUrl) state.lanUrl = changes.lanUrl.newValue;
  if (changes.vpnUrl) state.vpnUrl = changes.vpnUrl.newValue;
  if (changes.voice) state.voice = changes.voice.newValue;
  if (changes.mode) state.mode = changes.mode.newValue;
  if (changes.summaryModel) state.summaryModel = changes.summaryModel.newValue || '';
  state.apiBase = getApiUrl(state.apiMode);
});

async function autoDetectApi() {
  try {
    const t = withTimeout(2000);
    let response;
    try {
      response = await fetch(joinUrl(state.lanUrl, HEALTH_PATH), { method: 'GET', signal: t.signal });
    } finally {
      t.cancel();
    }
    if (response.ok) {
      state.apiBase = state.lanUrl;
      state.apiMode = 'lan';
    } else {
      throw new Error('IP1 not available');
    }
  } catch {
    try {
      const t = withTimeout(2000);
      let response;
      try {
        response = await fetch(joinUrl(state.vpnUrl, HEALTH_PATH), { method: 'GET', signal: t.signal });
      } finally {
        t.cancel();
      }
      if (response.ok) {
        state.apiBase = state.vpnUrl;
        state.apiMode = 'vpn';
      }
    } catch {
      /* keep default */
    }
  }
  browser.storage.local.set({ apiMode: state.apiMode });
}

function getOllamaBaseUrl() {
  try {
    const url = new URL(state.apiBase);
    return `${url.protocol}//${url.hostname}:11434`;
  } catch {
    return 'http://localhost:11434';
  }
}

async function summarizePage(text, customPrompt) {
  const ollamaBase = getOllamaBaseUrl();
  const tags = await fetchJson(`${ollamaBase}/api/tags`, {}, 5000);
  if (!tags.ok || !tags.data) throw new Error('Ollama not reachable');

  const allModels = tags.data.models || [];
  if (allModels.length === 0) throw new Error('No models available on Ollama');

  const EMBED_KEYWORDS = ['embed', 'embedding', 'nomic-embed', 'bge', 'e5-', 'gte-'];
  const textModels = allModels.filter((m) => {
    const n = (m.name || m.model || '').toLowerCase();
    return !EMBED_KEYWORDS.some((k) => n.includes(k));
  });
  if (textModels.length === 0) {
    throw new Error('No text generation models available (only embedding models found)');
  }

  let chosen = null;
  if (state.summaryModel) {
    chosen = textModels.find((m) => (m.name || m.model) === state.summaryModel);
  }
  if (!chosen) {
    chosen = textModels.slice().sort((a, b) => (a.size || 0) - (b.size || 0))[0];
  }
  const model = chosen.name || chosen.model;

  const maxChars = 32000;
  const truncated = text.length > maxChars
    ? `${text.substring(0, maxChars)}\n\n[Text truncated...]`
    : text;
  const wordCount = truncated.split(/\s+/).filter((w) => w.length > 0).length;

  const startTime = Date.now();
  const t = withTimeout(120000);
  let genRes;
  try {
    genRes = await fetch(`${ollamaBase}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'You are a helpful assistant that summarizes text concisely.' },
          {
            role: 'user',
            content: `${customPrompt || 'Summarize the following text in 100-200 words. Be concise and capture the key points:'}\n\n${truncated}`
          }
        ],
        stream: false
      }),
      signal: t.signal
    });
  } finally {
    t.cancel();
  }

  if (!genRes.ok) {
    const errText = await genRes.text().catch(() => '');
    throw new Error(`Ollama generation failed: ${errText || genRes.status}`);
  }

  const genData = await genRes.json();
  const summary = genData.message ? genData.message.content : genData.response;
  const timeTaken = ((Date.now() - startTime) / 1000).toFixed(1);
  return { summary, model, wordCount, timeTaken };
}

if (browser.contextMenus) {
  browser.contextMenus.create({
    id: 'read-from-here',
    title: 'Read from here with Page TTS',
    contexts: ['selection']
  });
  browser.contextMenus.create({
    id: 'read-page',
    title: 'Read page with Page TTS',
    contexts: ['page']
  });
  browser.contextMenus.create({
    id: 'summarize-page',
    title: 'Summarize page',
    contexts: ['page']
  });
}

const PAGE_EXTRACT_CODE = `
  (function() {
    const article = document.querySelector('article') ||
                   document.querySelector('[role="main"]') ||
                   document.querySelector('main') ||
                   document.body;
    const clone = article.cloneNode(true);
    const remove = clone.querySelectorAll('script, style, nav, header, footer, aside, [role="navigation"], [role="banner"], .nav, .menu, .sidebar, .comments, .advertisement, .ad');
    remove.forEach(el => el.remove());
    return clone.innerText;
  })()
`;

function readFromSelection(tabId, selection) {
  return browser.tabs.executeScript(tabId, { code: PAGE_EXTRACT_CODE }).then((results) => {
    if (!results || !results[0]) return;
    const pageText = results[0];
    const selClean = selection.replace(/\s+/g, ' ').trim();
    const pageClean = pageText.replace(/\s+/g, ' ');
    const pos = pageClean.indexOf(selClean);
    startReading(pos >= 0 ? pageClean.substring(pos) : selection);
  });
}

if (browser.contextMenus) {
  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'read-from-here') {
      const selection = info.selectionText;
      if (!selection) return;
      state.activeTabId = tab.id;
      readFromSelection(tab.id, selection);
    } else if (info.menuItemId === 'read-page') {
      state.activeTabId = tab.id;
      browser.tabs.executeScript(tab.id, { code: PAGE_EXTRACT_CODE }).then((results) => {
        if (results && results[0]) startReading(results[0]);
      });
    } else if (info.menuItemId === 'summarize-page') {
      browser.tabs.executeScript(tab.id, { code: PAGE_EXTRACT_CODE }).then((results) => {
        if (!results || !results[0]) throw new Error('Could not extract page text');
        return summarizePage(results[0]);
      }).then((result) => {
        browser.tabs.sendMessage(tab.id, {
          type: 'ptts-show-summary',
          result
        }).catch(() => {
          browser.tabs.executeScript(tab.id, {
            code: `alert('Summarize failed: could not show overlay')`
          });
        });
      }).catch((err) => {
        browser.tabs.executeScript(tab.id, {
          code: `alert('Summarize failed: ' + ${JSON.stringify(err.message || 'Unknown error')})`
        });
      });
    }
  });
}

function splitIntoSentences(text) {
  text = text.replace(/\[(?:\d+|citation needed|edit|note \d+|clarification needed|when\?|who\?|by whom\?|according to whom\?)\]/gi, '');
  const blocks = text.split(/\n+/);
  const sentences = [];
  const PLACEHOLDER = '\x00DOT\x00';

  for (let block of blocks) {
    block = block.replace(/\s+/g, ' ').trim();
    if (!block) continue;

    const blockStart = sentences.length;
    let protectedText = block.replace(
      /\b(Mr|Mrs|Ms|Dr|Prof|Jr|Sr|St|Ave|Blvd|vs|etc|approx|vol|no|Gen|Gov|Sgt|Capt|Lt|Col|Rev|Fig|dept|est)\./gi,
      `$1${PLACEHOLDER}`
    );
    protectedText = protectedText.replace(/\b(e)\.(g)\./gi, `$1${PLACEHOLDER}$2${PLACEHOLDER}`);
    protectedText = protectedText.replace(/\b(i)\.(e)\./gi, `$1${PLACEHOLDER}$2${PLACEHOLDER}`);
    protectedText = protectedText.replace(/\b([A-Z])\.([A-Z])\./g, `$1${PLACEHOLDER}$2${PLACEHOLDER}`);
    protectedText = protectedText.replace(/\b([A-Z])\./g, `$1${PLACEHOLDER}`);
    protectedText = protectedText.replace(/(\d)\.(\d)/g, `$1${PLACEHOLDER}$2`);
    protectedText = protectedText.replace(/\.{3}/g, PLACEHOLDER.repeat(3));

    const rawSentences = protectedText.match(/[^.!?。！？]+[.!?。！？]+|[^.!?。！？]+$/g) || [protectedText];

    for (let s of rawSentences) {
      s = s.split(PLACEHOLDER).join('.').trim();
      if (!s) continue;

      if (s.length > 300) {
        const parts = s.split(/[,，、；]\s*/);
        let current = '';
        for (const part of parts) {
          if ((current + part).length > 250 && current) {
            sentences.push(current.trim());
            current = part;
          } else {
            current += (current ? ', ' : '') + part;
          }
        }
        if (current.trim()) sentences.push(current.trim());
      } else if (s.length < 20 && sentences.length > blockStart && !/[\u4e00-\u9fff]/.test(s)) {
        sentences[sentences.length - 1] += ` ${s}`;
      } else {
        sentences.push(s);
      }
    }
  }

  const merged = [];
  for (const s of sentences) {
    const isCJK = /[\u4e00-\u9fff]/.test(s);
    const prev = merged.length > 0 ? merged[merged.length - 1] : null;
    const prevIsCJK = prev && /[\u4e00-\u9fff]/.test(prev);
    if (isCJK && prevIsCJK && prev.length < 50) {
      merged[merged.length - 1] += s;
    } else {
      merged.push(s);
    }
  }

  return merged.filter((s) => s.length > 0);
}

async function fetchTTS(index) {
  if (state.fetchingIndices.has(index) || state.audioQueue.has(index)) return;
  if (index >= state.sentences.length) return;

  state.fetchingIndices.add(index);

  try {
    const speed = state.mode === 'fast' ? 1.15 : state.mode === 'quality' ? 0.95 : 1.0;
    const t = withTimeout(60000);
    let response;
    try {
      response = await fetch(joinUrl(state.apiBase, SPEECH_PATH), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: state.sentences[index],
          voice: state.voice,
          response_format: 'mp3',
          speed,
          stream: false
        }),
        signal: t.signal
      });
    } finally {
      t.cancel();
    }

    if (response.ok) {
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      state.audioQueue.set(index, { blob, url });
      if (index === state.currentIndex && state.isPlaying && !state.isPaused && !state.currentAudio) {
        playCurrentSentence();
      }
    }
  } catch (e) {
    console.error('TTS fetch error:', e, 'apiBase=', state.apiBase);
  } finally {
    state.fetchingIndices.delete(index);
  }
}

function prefetch() {
  for (let i = 0; i < PREFETCH_COUNT; i++) {
    const index = state.currentIndex + i;
    if (index < state.sentences.length) fetchTTS(index);
  }
}

function playCurrentSentence() {
  const audioData = state.audioQueue.get(state.currentIndex);
  if (!audioData) return;

  const audio = new Audio(audioData.url);
  state.currentAudio = audio;

  audio.onended = () => {
    URL.revokeObjectURL(audioData.url);
    state.audioQueue.delete(state.currentIndex);
    state.currentAudio = null;
    state.currentIndex++;

    if (state.currentIndex < state.sentences.length && state.isPlaying && !state.isPaused) {
      prefetch();
      playCurrentSentence();
    } else if (state.currentIndex >= state.sentences.length) {
      stopReading();
    }
    notifyClients();
  };

  audio.onerror = () => {
    state.currentAudio = null;
    state.currentIndex++;
    if (state.currentIndex < state.sentences.length && state.isPlaying) {
      playCurrentSentence();
    }
    notifyClients();
  };

  audio.play();
  highlightOnPage(state.sentences[state.currentIndex]);
  notifyClients();
}

function startReading(text) {
  const savedTabId = state.activeTabId;
  stopReading();
  state.activeTabId = savedTabId;

  state.sentences = splitIntoSentences(text);
  state.currentIndex = 0;
  state.isPlaying = true;
  state.isPaused = false;

  if (state.sentences.length === 0) return;

  prefetch();
  playCurrentSentence();
  notifyClients();
}

function stopReading() {
  state.isPlaying = false;
  state.isPaused = false;

  if (state.currentAudio) {
    state.currentAudio.pause();
    state.currentAudio = null;
  }

  for (const [, data] of state.audioQueue) {
    URL.revokeObjectURL(data.url);
  }
  state.audioQueue.clear();
  state.fetchingIndices.clear();
  state.sentences = [];
  state.currentIndex = 0;

  clearHighlightOnPage();
  notifyClients();
  state.activeTabId = null;
}

function pauseReading() {
  if (state.currentAudio && state.isPlaying) {
    state.currentAudio.pause();
    state.isPaused = true;
    notifyClients();
  }
}

function resumeReading() {
  if (state.currentAudio && state.isPaused) {
    state.currentAudio.play();
    state.isPaused = false;
    notifyClients();
  } else if (state.isPlaying && !state.currentAudio) {
    state.isPaused = false;
    playCurrentSentence();
    notifyClients();
  }
}

function skipNext() {
  if (state.currentAudio) {
    state.currentAudio.pause();
    state.currentAudio.onended = null;
    state.currentAudio = null;
  }

  const audioData = state.audioQueue.get(state.currentIndex);
  if (audioData) {
    URL.revokeObjectURL(audioData.url);
    state.audioQueue.delete(state.currentIndex);
  }

  state.currentIndex++;

  if (state.currentIndex < state.sentences.length && state.isPlaying && !state.isPaused) {
    prefetch();
    playCurrentSentence();
  } else if (state.currentIndex >= state.sentences.length) {
    stopReading();
  }

  notifyClients();
}

function skipPrev() {
  if (state.currentIndex <= 0) return;

  if (state.currentAudio) {
    state.currentAudio.pause();
    state.currentAudio.onended = null;
    state.currentAudio = null;
  }

  const audioData = state.audioQueue.get(state.currentIndex);
  if (audioData) {
    URL.revokeObjectURL(audioData.url);
    state.audioQueue.delete(state.currentIndex);
  }

  state.currentIndex--;

  if (state.isPlaying && !state.isPaused) {
    prefetch();
    playCurrentSentence();
  }

  notifyClients();
}

function buildFlexPattern(text) {
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return escaped.replace(/ /g, '\\s+');
}

function highlightOnPage(sentence) {
  if (!state.activeTabId) return;

  const words = sentence.trim().split(/\s+/).slice(0, 2).join(' ');
  if (!words) return;

  const goingForward = state.currentIndex >= (state._lastHighlightIndex || 0);
  state._lastHighlightIndex = state.currentIndex;

  const sentenceClean = sentence.trim().replace(/\s+/g, ' ');
  const prefix = sentenceClean.substring(0, 80);
  const sentencePattern = buildFlexPattern(prefix);
  const hlPattern = buildFlexPattern(words);

  browser.tabs.executeScript(state.activeTabId, {
    code: `
      (function() {
        document.querySelectorAll('.ptts-highlight').forEach(function(el) {
          var parent = el.parentNode;
          parent.replaceChild(document.createTextNode(el.textContent), el);
          parent.normalize();
        });

        if (!document.getElementById('ptts-highlight-style')) {
          var style = document.createElement('style');
          style.id = 'ptts-highlight-style';
          style.textContent = '.ptts-highlight { background: linear-gradient(90deg, #0095ff44, #7b2ff744); border-radius: 2px; padding: 0 1px; }';
          document.head.appendChild(style);
        }

        var goingForward = ${goingForward};
        if (!window.__pttsPos) window.__pttsPos = 0;
        if (!goingForward) window.__pttsPos = 0;

        var root = document.querySelector('article') || document.querySelector('[role="main"]') || document.querySelector('main') || document.body;
        var fullText = root.textContent;

        var sentenceRegex = new RegExp(${JSON.stringify(sentencePattern)}, 'g');
        var match;
        var foundPos = -1;
        var matchLen = 0;
        while ((match = sentenceRegex.exec(fullText)) !== null) {
          if (match.index >= window.__pttsPos) {
            foundPos = match.index;
            matchLen = match[0].length;
            break;
          }
        }
        if (foundPos < 0) {
          sentenceRegex.lastIndex = 0;
          match = sentenceRegex.exec(fullText);
          if (match) { foundPos = match.index; matchLen = match[0].length; }
        }
        if (foundPos < 0) return;

        window.__pttsPos = foundPos + matchLen;

        var hlRegex = new RegExp(${JSON.stringify(hlPattern)});
        var hlMatch = hlRegex.exec(fullText.substring(foundPos));
        if (!hlMatch) return;
        var hlStart = foundPos + hlMatch.index;
        var hlLen = hlMatch[0].length;

        var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
        var offset = 0;
        while (walker.nextNode()) {
          var node = walker.currentNode;
          var nodeLen = node.textContent.length;
          if (offset + nodeLen > hlStart) {
            var localStart = hlStart - offset;
            if (localStart + hlLen <= nodeLen) {
              var range = document.createRange();
              range.setStart(node, localStart);
              range.setEnd(node, localStart + hlLen);
              var hl = document.createElement('span');
              hl.className = 'ptts-highlight';
              range.surroundContents(hl);
              var rect = hl.getBoundingClientRect();
              var targetY = window.scrollY + rect.top - window.innerHeight * 0.20;
              window.scrollTo({ top: targetY, behavior: 'smooth' });
            }
            break;
          }
          offset += nodeLen;
        }
      })()
    `
  }).catch(() => {});
}

function clearHighlightOnPage() {
  if (!state.activeTabId) return;
  browser.tabs.executeScript(state.activeTabId, {
    code: `
      document.querySelectorAll('.ptts-highlight').forEach(function(el) {
        var parent = el.parentNode;
        parent.replaceChild(document.createTextNode(el.textContent), el);
        parent.normalize();
      });
      window.__pttsPos = 0;
    `
  }).catch(() => {});
}

function getStatePayload() {
  return {
    isPlaying: state.isPlaying,
    isPaused: state.isPaused,
    currentIndex: state.currentIndex,
    totalSentences: state.sentences.length,
    currentText: state.sentences[state.currentIndex] || '',
    apiMode: state.apiMode,
    voice: state.voice,
    mode: state.mode
  };
}

function notifyClients() {
  const stateMsg = getStatePayload();
  browser.runtime.sendMessage({ type: 'state-update', state: stateMsg }).catch(() => {});
  if (state.activeTabId) {
    browser.tabs.sendMessage(state.activeTabId, {
      type: 'ptts-content-state',
      state: stateMsg
    }).catch(() => {});
  }
}

function resolveTabId(message, sender) {
  if (message.tabId) return Promise.resolve(message.tabId);
  if (sender && sender.tab && sender.tab.id) return Promise.resolve(sender.tab.id);
  return browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => tabs[0].id);
}

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'get-state':
      sendResponse({ ...getStatePayload(), apiBase: state.apiBase });
      break;

    case 'play':
      resumeReading();
      break;

    case 'pause':
      pauseReading();
      break;

    case 'stop':
      stopReading();
      break;

    case 'next':
      skipNext();
      break;

    case 'prev':
      skipPrev();
      break;

    case 'set-voice':
      state.voice = message.voice;
      browser.storage.local.set({ voice: message.voice });
      break;

    case 'set-mode':
      state.mode = message.mode;
      browser.storage.local.set({ mode: message.mode });
      break;

    case 'set-api-mode':
      state.apiMode = message.apiMode;
      state.apiBase = getApiUrl(message.apiMode);
      browser.storage.local.set({ apiMode: message.apiMode });
      notifyClients();
      break;

    case 'read-selection':
      resolveTabId(message, sender).then((tabId) => {
        state.activeTabId = tabId;
        browser.tabs.executeScript(tabId, {
          code: `({ selection: window.getSelection().toString(), page: (${PAGE_EXTRACT_CODE}) })`
        }).then((results) => {
          if (results && results[0] && results[0].selection) {
            readFromSelection(tabId, results[0].selection);
          }
        });
      });
      break;

    case 'read-page':
      resolveTabId(message, sender).then((tabId) => {
        state.activeTabId = tabId;
        browser.tabs.executeScript(tabId, { code: PAGE_EXTRACT_CODE }).then((results) => {
          if (results && results[0]) startReading(results[0]);
        });
      });
      break;

    case 'get-voices':
      fetch(joinUrl(state.apiBase, VOICES_PATH))
        .then((r) => r.json())
        .then((data) => sendResponse((data && data.voices) || []))
        .catch(() => sendResponse([]));
      return true;

    case 'read-summary':
      if (sender && sender.tab && sender.tab.id) {
        state.activeTabId = sender.tab.id;
      }
      startReading(message.text.replace(/\*+/g, ''));
      break;

    case 'summarize-page':
      (message.pageText
        ? Promise.resolve(message.pageText)
        : resolveTabId(message, sender).then((tabId) =>
            browser.tabs.executeScript(tabId, { code: PAGE_EXTRACT_CODE })
          ).then((results) => {
            if (results && results[0]) return results[0];
            throw new Error('Could not extract page text');
          })
      ).then((raw) => summarizePage(raw.replace(/\s+/g, ' ').trim(), message.customPrompt))
        .then((result) => {
          sendResponse({ success: true, ...result });
        })
        .catch((err) => {
          sendResponse({ success: false, error: err.message });
        });
      return true;

    case 'toggle-read': {
      const senderTabId = sender && sender.tab && sender.tab.id;
      if (state.isPlaying && state.activeTabId === senderTabId) {
        if (state.isPaused) resumeReading();
        else pauseReading();
      } else if (senderTabId) {
        state.activeTabId = senderTabId;
        if (message.hasSelection) {
          browser.tabs.executeScript(senderTabId, {
            code: `({ selection: window.getSelection().toString(), page: (${PAGE_EXTRACT_CODE}) })`
          }).then((results) => {
            if (results && results[0] && results[0].selection) {
              readFromSelection(senderTabId, results[0].selection);
            }
          });
        } else {
          browser.tabs.executeScript(senderTabId, { code: PAGE_EXTRACT_CODE }).then((results) => {
            if (results && results[0]) startReading(results[0]);
          });
        }
      }
      break;
    }

    case 'check-health':
      (async () => {
        const url = joinUrl(state.apiBase, HEALTH_PATH);
        try {
          const res = await fetchJson(url, {}, 3000);
          if (!res.ok || !res.data) {
            sendResponse({ status: 'error', url, httpStatus: res.status || 0, error: `HTTP ${res.status || 'error'}` });
            return;
          }
          const normalized = { ...res.data };
          if (normalized.status === 'healthy') normalized.status = 'ok';
          sendResponse({ ...normalized, url });
        } catch (e) {
          sendResponse({ status: 'error', url, error: (e && e.message) ? e.message : String(e) });
        }
      })();
      return true;

    default:
      break;
  }
});
