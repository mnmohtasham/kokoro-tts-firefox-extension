const elements = {
  lanUrl: document.getElementById('lanUrl'),
  vpnUrl: document.getElementById('vpnUrl'),
  defaultVoice: document.getElementById('defaultVoice'),
  defaultMode: document.getElementById('defaultMode'),
  summaryModel: document.getElementById('summaryModel'),
  excludedSites: document.getElementById('excludedSites'),
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
  'bilibili.com',
  'google.com/search',
  'bing.com/search',
  'duckduckgo.com',
  'baidu.com/s'
];

const FALLBACK_VOICES = [
  { id: 'af_heart', name: 'Heart (American Female)' },
  { id: 'af_bella', name: 'Bella (American Female)' },
  { id: 'am_adam', name: 'Adam (American Male)' },
  { id: 'bf_emma', name: 'Emma (British Female)' }
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
  autoOpt.textContent = 'Auto (smallest / fastest)';
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

async function loadVoices(url) {
  try {
    const t = withTimeout(3000);
    let response;
    try {
      response = await fetch(joinUrl(url, '/v1/audio/voices'), { signal: t.signal });
    } finally {
      t.cancel();
    }
    const data = await response.json();
    return (data.voices && data.voices.length > 0) ? data.voices : FALLBACK_VOICES;
  } catch {
    return FALLBACK_VOICES;
  }
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

async function loadSettings() {
  const data = await browser.storage.local.get([
    'lanUrl', 'vpnUrl', 'voice', 'mode', 'apiMode', 'excludedSites', 'summaryModel'
  ]);

  if (data.lanUrl) elements.lanUrl.value = data.lanUrl;
  if (data.vpnUrl) elements.vpnUrl.value = data.vpnUrl;
  if (data.mode) elements.defaultMode.value = data.mode;
  elements.excludedSites.value = (data.excludedSites || DEFAULT_EXCLUDED).join('\n');

  const apiUrl = data.apiMode === 'vpn'
    ? (data.vpnUrl || elements.vpnUrl.value)
    : (data.lanUrl || elements.lanUrl.value);
  const voices = await loadVoices(apiUrl);
  populateVoiceSelect(voices, data.voice);
  await loadOllamaModels(apiUrl, data.summaryModel || '');
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

  await browser.storage.local.set({
    lanUrl: elements.lanUrl.value,
    vpnUrl: elements.vpnUrl.value,
    voice: elements.defaultVoice.value,
    mode: elements.defaultMode.value,
    summaryModel: elements.summaryModel.value,
    excludedSites
  });

  elements.savedMsg.classList.add('show');
  setTimeout(() => elements.savedMsg.classList.remove('show'), 2000);
}

elements.testBtn.addEventListener('click', testConnections);
elements.saveBtn.addEventListener('click', saveSettings);

loadSettings();
testConnections();
