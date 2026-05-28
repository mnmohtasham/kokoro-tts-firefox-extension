const elements = {
  lanUrl: document.getElementById('lanUrl'),
  vpnUrl: document.getElementById('vpnUrl'),
  defaultVoice: document.getElementById('defaultVoice'),
  defaultMode: document.getElementById('defaultMode'),
  summaryProvider: document.getElementById('summaryProvider'),
  summaryModel: document.getElementById('summaryModel'),
  ollamaBaseUrl: document.getElementById('ollamaBaseUrl'),
  lmStudioBaseUrl: document.getElementById('lmStudioBaseUrl'),
  llamaCppBaseUrl: document.getElementById('llamaCppBaseUrl'),
  openaiApiKey: document.getElementById('openaiApiKey'),
  openaiBaseUrl: document.getElementById('openaiBaseUrl'),
  openaiModel: document.getElementById('openaiModel'),
  openaiCard: document.getElementById('openaiCard'),
  excludedSites: document.getElementById('excludedSites'),
  showFloatingButtons: document.getElementById('showFloatingButtons'),
  lanStatus: document.getElementById('lanStatus'),
  lanStatusText: document.getElementById('lanStatusText'),
  vpnStatus: document.getElementById('vpnStatus'),
  vpnStatusText: document.getElementById('vpnStatusText'),
  testBtn: document.getElementById('testBtn'),
  saveBtn: document.getElementById('saveBtn'),
  savedMsg: document.getElementById('savedMsg')
};

const DEFAULT_EXCLUDED = [
  'youtube.com',
  'google.com/search',
];

const FALLBACK_VOICES = [
  { id: 'af_heart', name: 'Heart (American Female)' },
  { id: 'af_bella', name: 'Bella (American Female)' },
  { id: 'am_adam', name: 'Adam (American Male)' },
  { id: 'bf_emma', name: 'Emma (British Female)' }
];

const VOICE_PATHS = [
  '/v1/audio/voices',
  '/v1/voices',
  '/api/voices',
  '/api/tts/speakers'
];

function joinUrl(base, path) {
  if (!base) return path;
  return base.replace(/\/+$/, '') + '/' + String(path || '').replace(/^\/+/, '');
}

function withTimeout(ms) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(new DOMException('Timeout', 'TimeoutError')), ms);
  return { signal: controller.signal, cancel: () => clearTimeout(timeoutId) };
}

function getOllamaBaseUrl(kokoroUrl) {
  const override = (elements.ollamaBaseUrl && elements.ollamaBaseUrl.value) ? elements.ollamaBaseUrl.value.trim() : '';
  if (override) return override.replace(/\/+$/, '');
  try {
    const u = new URL(kokoroUrl);
    return `${u.protocol}//${u.hostname}:11434`;
  } catch {
    return 'http://localhost:11434';
  }
}

async function loadOllamaModels(kokoroUrl, selectedModel) {
  const select = elements.summaryModel;
  while (select.firstChild) select.removeChild(select.firstChild);
  const autoOpt = document.createElement('option');
  autoOpt.value = '';
  autoOpt.textContent = 'Auto (recommended)';
  select.appendChild(autoOpt);
  try {
    const t = withTimeout(3000);
    let res;
    try {
      res = await fetch(`${getOllamaBaseUrl(kokoroUrl)}/api/tags`, { signal: t.signal });
    } finally {
      t.cancel();
    }
    if (!res.ok) return;
    const data = await res.json();
    const EMBED = ['embed', 'embedding', 'nomic-embed', 'bge', 'e5-', 'gte-'];
    const models = (data.models || [])
      .filter((m) => {
        const n = (m.name || m.model || '').toLowerCase();
        return !EMBED.some((k) => n.includes(k));
      })
      .sort((a, b) => (a.size || 0) - (b.size || 0));
    for (const m of models) {
      const name = m.name || m.model;
      const sizeGb = m.size ? `${(m.size / 1e9).toFixed(1)} GB` : '';
      const paramSize = (m.details && m.details.parameter_size) ? m.details.parameter_size : '';
      const label = [name, paramSize, sizeGb].filter(Boolean).join(' · ');
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = label;
      select.appendChild(opt);
    }
    if (selectedModel) select.value = selectedModel;
  } catch {
    /* Ollama unreachable */
  }
}

function resetSummaryModelSelect() {
  const select = elements.summaryModel;
  while (select.firstChild) select.removeChild(select.firstChild);
  const autoOpt = document.createElement('option');
  autoOpt.value = '';
  autoOpt.textContent = 'Auto (recommended)';
  select.appendChild(autoOpt);
}

function normalizeVoicesPayload(data) {
  if (!data) return [];
  const arr =
    Array.isArray(data) ? data :
    Array.isArray(data.voices) ? data.voices :
    Array.isArray(data.speakers) ? data.speakers :
    Array.isArray(data.data) ? data.data :
    [];
  return arr.map((v) => {
    const id = v.id || v.voice || v.name || v.speaker || v.model;
    const name = v.name || v.label || v.id || v.voice || v.speaker;
    return id ? { id: String(id), name: String(name || id) } : null;
  }).filter(Boolean);
}

async function loadVoices(url) {
  for (const p of VOICE_PATHS) {
    try {
      const t = withTimeout(3000);
      let response;
      try {
        response = await fetch(joinUrl(url, p), { signal: t.signal });
      } finally {
        t.cancel();
      }
      if (!response.ok) continue;
      const data = await response.json().catch(() => null);
      const voices = normalizeVoicesPayload(data);
      if (voices.length > 0) return voices;
    } catch {
      // try next
    }
  }
  return FALLBACK_VOICES;
}

function populateVoiceSelect(voices, selectedVoice) {
  elements.defaultVoice.innerHTML = '';
  for (const voice of voices) {
    const option = document.createElement('option');
    option.value = voice.id;
    option.textContent = voice.name;
    elements.defaultVoice.appendChild(option);
  }
  if (selectedVoice) elements.defaultVoice.value = selectedVoice;
}

async function loadLmStudioModels(baseUrl, selectedModel) {
  resetSummaryModelSelect();
  const base = (baseUrl || '').replace(/\/+$/, '');
  if (!base) return;
  try {
    const t = withTimeout(3000);
    let res;
    try {
      res = await fetch(`${base}/v1/models`, { signal: t.signal });
    } finally {
      t.cancel();
    }
    if (!res.ok) return;
    const data = await res.json().catch(() => null);
    // OpenAI-compatible: { object: 'list', data: [ {id: ...}, ... ] }
    // Some servers return { models: [...] } or just an array.
    const list = data && (data.data || data.models || data);
    const arr = Array.isArray(list) ? list : [];
    for (const m of arr) {
      const id = m.id || m.name || m.model;
      if (!id) continue;
      const opt = document.createElement('option');
      opt.value = String(id);
      opt.textContent = String(id);
      elements.summaryModel.appendChild(opt);
    }
    if (selectedModel) elements.summaryModel.value = selectedModel;
  } catch {
    // ignore
  }
}

function loadOpenAIModelSelect(selectedModel) {
  resetSummaryModelSelect();
  const common = ['gpt-4o-mini', 'gpt-4.1-mini', 'gpt-4.1', 'o4-mini', 'o3-mini'];
  for (const id of common) {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = id;
    elements.summaryModel.appendChild(opt);
  }
  if (selectedModel) elements.summaryModel.value = selectedModel;
}

async function refreshSummaryModelChoices(kokoroUrl, provider, selectedModel) {
  if (provider === 'openAI') {
    loadOpenAIModelSelect(selectedModel);
    return;
  }
  if (provider === 'ollama') {
    await loadLmStudioModels(elements.ollamaBaseUrl.value || 'http://127.0.0.1:11434', selectedModel);
    return;
  }
  if (provider === 'lm studio') {
    await loadLmStudioModels(elements.lmStudioBaseUrl.value || 'http://127.0.0.1:1234', selectedModel);
    return;
  }
  if (provider === 'llama.cpp') {
    await loadLmStudioModels(elements.llamaCppBaseUrl.value || 'http://127.0.0.1:8080', selectedModel);
    return;
  }
  await loadOllamaModels(kokoroUrl, selectedModel);
}

function applyProviderDefaultsIfEmpty(provider) {
  if (provider === 'ollama') {
    if (!elements.ollamaBaseUrl.value) elements.ollamaBaseUrl.value = 'http://127.0.0.1:11434';
  }
  if (provider === 'lm studio') {
    if (!elements.lmStudioBaseUrl.value) elements.lmStudioBaseUrl.value = 'http://127.0.0.1:1234';
  }
  if (provider === 'llama.cpp') {
    if (!elements.llamaCppBaseUrl.value) elements.llamaCppBaseUrl.value = 'http://127.0.0.1:8080';
  }
  if (provider === 'openAI') {
    if (!elements.openaiBaseUrl.value) elements.openaiBaseUrl.value = 'https://api.openai.com';
  }
}

function updateProviderVisibility() {
  if (!elements.openaiCard) return;
  elements.openaiCard.style.display = elements.summaryProvider.value === 'openAI' ? 'block' : 'none';
}

async function loadSettings() {
  const data = await browser.storage.local.get([
    'lanUrl',
    'vpnUrl',
    'voice',
    'mode',
    'apiMode',
    'excludedSites',
    'summaryProvider',
    'summaryModel',
    'ollamaBaseUrl',
    'lmStudioBaseUrl',
    'llamaCppBaseUrl',
    'openaiApiKey',
    'openaiBaseUrl',
    'openaiModel'
    ,'showFloatingButtons'
  ]);

  if (data.lanUrl) elements.lanUrl.value = data.lanUrl;
  if (data.vpnUrl) elements.vpnUrl.value = data.vpnUrl;
  if (data.mode) elements.defaultMode.value = data.mode;
  elements.excludedSites.value = (data.excludedSites || DEFAULT_EXCLUDED).join('\n');
  if (elements.showFloatingButtons) {
    const on = (data.showFloatingButtons !== false);
    elements.showFloatingButtons.value = on ? 'on' : 'off';
  }

  elements.summaryProvider.value = data.summaryProvider || 'ollama';
  if (data.ollamaBaseUrl && elements.ollamaBaseUrl) elements.ollamaBaseUrl.value = data.ollamaBaseUrl;
  if (data.lmStudioBaseUrl) elements.lmStudioBaseUrl.value = data.lmStudioBaseUrl;
  if (data.llamaCppBaseUrl) elements.llamaCppBaseUrl.value = data.llamaCppBaseUrl;
  if (typeof data.openaiApiKey === 'string') elements.openaiApiKey.value = data.openaiApiKey;
  if (data.openaiBaseUrl) elements.openaiBaseUrl.value = data.openaiBaseUrl;
  if (data.openaiModel) elements.openaiModel.value = data.openaiModel;
  applyProviderDefaultsIfEmpty(elements.summaryProvider.value);
  updateProviderVisibility();

  const apiUrl = data.apiMode === 'vpn'
    ? (data.vpnUrl || elements.vpnUrl.value)
    : (data.lanUrl || elements.lanUrl.value);
  const voices = await loadVoices(apiUrl);
  populateVoiceSelect(voices, data.voice);
  await refreshSummaryModelChoices(apiUrl, elements.summaryProvider.value, data.summaryModel || '');
}

async function testConnection(url, statusDot, statusText) {
  statusText.textContent = 'Checking...';
  statusDot.classList.remove('offline');
  try {
    const t = withTimeout(3000);
    let response;
    try {
      response = await fetch(joinUrl(url, '/health'), { method: 'GET', signal: t.signal });
    } finally {
      t.cancel();
    }
    const data = await response.json();
    const st = data && data.status;
    if (st === 'ok' || st === 'healthy') {
      statusDot.classList.remove('offline');
      statusText.textContent = 'Connected';
    } else {
      throw new Error('Not ok');
    }
  } catch {
    statusDot.classList.add('offline');
    statusText.textContent = 'Unavailable';
  }
}

function testConnections() {
  testConnection(elements.lanUrl.value, elements.lanStatus, elements.lanStatusText);
  testConnection(elements.vpnUrl.value, elements.vpnStatus, elements.vpnStatusText);
}

async function saveSettings() {
  const excludedSites = elements.excludedSites.value
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const provider = elements.summaryProvider.value || 'ollama';
  const chosenModel = provider === 'openAI'
    ? (elements.openaiModel.value || elements.summaryModel.value)
    : elements.summaryModel.value;

  await browser.storage.local.set({
    lanUrl: elements.lanUrl.value,
    vpnUrl: elements.vpnUrl.value,
    voice: elements.defaultVoice.value,
    mode: elements.defaultMode.value,
    summaryProvider: provider,
    summaryModel: chosenModel || '',
    ollamaBaseUrl: elements.ollamaBaseUrl ? elements.ollamaBaseUrl.value : '',
    lmStudioBaseUrl: elements.lmStudioBaseUrl.value,
    llamaCppBaseUrl: elements.llamaCppBaseUrl.value,
    openaiApiKey: elements.openaiApiKey.value,
    openaiBaseUrl: elements.openaiBaseUrl.value,
    openaiModel: elements.openaiModel.value,
    showFloatingButtons: elements.showFloatingButtons ? (elements.showFloatingButtons.value === 'on') : true,
    excludedSites
  });

  elements.savedMsg.classList.add('show');
  setTimeout(() => elements.savedMsg.classList.remove('show'), 2000);
}

elements.testBtn.addEventListener('click', testConnections);
elements.saveBtn.addEventListener('click', saveSettings);

elements.summaryProvider.addEventListener('change', async () => {
  const data = await browser.storage.local.get(['apiMode', 'lanUrl', 'vpnUrl', 'summaryModel']);
  const apiUrl = data.apiMode === 'vpn'
    ? (data.vpnUrl || elements.vpnUrl.value)
    : (data.lanUrl || elements.lanUrl.value);
  applyProviderDefaultsIfEmpty(elements.summaryProvider.value);
  updateProviderVisibility();
  await refreshSummaryModelChoices(apiUrl, elements.summaryProvider.value, data.summaryModel || '');
});

loadSettings();
testConnections();
