const elements = {};
let gpuElements = {};

document.addEventListener('DOMContentLoaded', init);

function init() {
  elements.statusDot = document.getElementById('statusDot');
  elements.statusText = document.getElementById('statusText');
  elements.statusPill = document.getElementById('statusPill');
  elements.networkSwitch = document.getElementById('networkSwitch');
  elements.lanLabel = document.getElementById('lanLabel');
  elements.vpnLabel = document.getElementById('vpnLabel');
  elements.summarizeSub = document.getElementById('summarizeSub');
  elements.nowPlaying = document.getElementById('nowPlaying');
  elements.progressCurrent = document.getElementById('progressCurrent');
  elements.progressTotal = document.getElementById('progressTotal');
  elements.progressFill = document.getElementById('progressFill');
  elements.playPauseBtn = document.getElementById('playPauseBtn');
  elements.playIcon = document.getElementById('playIcon');
  elements.pauseIcon = document.getElementById('pauseIcon');
  elements.stopBtn = document.getElementById('stopBtn');
  elements.prevBtn = document.getElementById('prevBtn');
  elements.nextBtn = document.getElementById('nextBtn');
  elements.readPageBtn = document.getElementById('readPageBtn');
  elements.voiceSelect = document.getElementById('voiceSelect');
  elements.modeSelect = document.getElementById('modeSelect');
  elements.summarizeBtn = document.getElementById('summarizeBtn');
  elements.summaryLoading = document.getElementById('summaryLoading');
  elements.summaryResult = document.getElementById('summaryResult');
  elements.summaryText = document.getElementById('summaryText');
  elements.summaryModel = document.getElementById('summaryModel');
  elements.summaryError = document.getElementById('summaryError');
  elements.readSummaryBtn = document.getElementById('readSummaryBtn');
  elements.copySummaryBtn = document.getElementById('copySummaryBtn');
  elements.pinBtn = document.getElementById('pinBtn');

  gpuElements = {
    card: document.getElementById('gpuCard'),
    barFill: document.getElementById('gpuBarFill'),
    text: document.getElementById('gpuText')
  };

  setupEventListeners();
  loadState();
  checkHealth();
  loadVoices();
  setInterval(checkHealth, 10000);
}

function setApiMode(mode) {
  const isVpn = mode === 'vpn';
  elements.networkSwitch.checked = isVpn;
  elements.lanLabel.classList.toggle('active', !isVpn);
  elements.vpnLabel.classList.toggle('active', isVpn);
  browser.runtime.sendMessage({ type: 'set-api-mode', apiMode: mode });
  setTimeout(() => {
    checkHealth();
    loadVoices();
  }, 500);
}

function setupEventListeners() {
  elements.networkSwitch.addEventListener('change', () => {
    setApiMode(elements.networkSwitch.checked ? 'vpn' : 'lan');
  });

  elements.lanLabel.addEventListener('click', () => setApiMode('lan'));
  elements.vpnLabel.addEventListener('click', () => setApiMode('vpn'));

  elements.playPauseBtn.addEventListener('click', () => {
    browser.runtime.sendMessage({ type: 'get-state' }).then((state) => {
      if (state.isPlaying && !state.isPaused) {
        browser.runtime.sendMessage({ type: 'pause' });
      } else if (state.isPlaying && state.isPaused) {
        browser.runtime.sendMessage({ type: 'play' });
      }
    });
  });

  elements.stopBtn.addEventListener('click', () => {
    browser.runtime.sendMessage({ type: 'stop' });
  });

  elements.prevBtn.addEventListener('click', () => {
    browser.runtime.sendMessage({ type: 'prev' });
  });

  elements.nextBtn.addEventListener('click', () => {
    browser.runtime.sendMessage({ type: 'next' });
  });

  elements.readPageBtn.addEventListener('click', () => {
    browser.runtime.sendMessage({ type: 'read-page', tabId: getTargetTabId() });
  });

  elements.voiceSelect.addEventListener('change', () => {
    browser.runtime.sendMessage({ type: 'set-voice', voice: elements.voiceSelect.value });
  });

  elements.modeSelect.addEventListener('change', () => {
    browser.runtime.sendMessage({ type: 'set-mode', mode: elements.modeSelect.value });
  });

  elements.summarizeBtn.addEventListener('click', () => {
    elements.summarizeBtn.disabled = true;
    elements.summarizeBtn.classList.add('is-busy');
    if (elements.summarizeSub) elements.summarizeSub.textContent = 'Working…';
    elements.summaryLoading.style.display = 'block';
    elements.summaryResult.style.display = 'none';
    elements.summaryError.style.display = 'none';

    browser.runtime.sendMessage({ type: 'summarize-page', tabId: getTargetTabId() }).then((response) => {
      elements.summaryLoading.style.display = 'none';
      elements.summarizeBtn.disabled = false;
      elements.summarizeBtn.classList.remove('is-busy');
      if (elements.summarizeSub) elements.summarizeSub.textContent = 'Key insights';

      if (response && response.success) {
        elements.summaryText.textContent = response.summary;
        elements.summaryModel.textContent = `Model: ${response.model} | Words sent: ${response.wordCount || '?'} | Time: ${response.timeTaken || '?'}s`;
        elements.summaryResult.style.display = 'block';
      } else {
        elements.summaryError.textContent = (response && response.error) || 'Failed to summarize';
        elements.summaryError.style.display = 'block';
      }
    }).catch((e) => {
      elements.summaryLoading.style.display = 'none';
      elements.summarizeBtn.disabled = false;
      elements.summarizeBtn.classList.remove('is-busy');
      if (elements.summarizeSub) elements.summarizeSub.textContent = 'Key insights';
      elements.summaryError.textContent = `Error: ${e.message}`;
      elements.summaryError.style.display = 'block';
    });
  });

  elements.readSummaryBtn.addEventListener('click', () => {
    const summaryText = elements.summaryText.textContent;
    if (summaryText) {
      browser.runtime.sendMessage({ type: 'read-summary', text: summaryText });
    }
  });

  elements.copySummaryBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(elements.summaryText.textContent).then(() => {
      elements.copySummaryBtn.textContent = 'Copied!';
      setTimeout(() => { elements.copySummaryBtn.textContent = 'Copy'; }, 1500);
    });
  });

  const urlParams = new URLSearchParams(window.location.search);
  const isDetached = urlParams.has('detached');
  if (isDetached) elements.pinBtn.classList.add('pinned');

  elements.pinBtn.addEventListener('click', () => {
    if (isDetached) {
      window.close();
      return;
    }
    browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      const tabId = tabs[0].id;
      browser.windows.create({
        url: browser.runtime.getURL(`popup.html?detached=1&tabId=${tabId}`),
        type: 'popup',
        width: 336,
        height: 560
      });
      window.close();
    });
  });
}

function getTargetTabId() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.has('tabId') ? parseInt(urlParams.get('tabId'), 10) : null;
}

function updateUI(state) {
  if (!state) return;

  elements.networkSwitch.checked = state.apiMode === 'vpn';
  elements.lanLabel.classList.toggle('active', state.apiMode === 'lan');
  elements.vpnLabel.classList.toggle('active', state.apiMode === 'vpn');

  if (state.isPlaying && state.totalSentences > 0) {
    elements.progressCurrent.textContent = state.currentIndex + 1;
    elements.progressTotal.textContent = state.totalSentences;
    elements.progressFill.style.width = `${((state.currentIndex + 1) / state.totalSentences) * 100}%`;
    elements.playIcon.style.display = state.isPaused ? 'block' : 'none';
    elements.pauseIcon.style.display = state.isPaused ? 'none' : 'block';
  } else {
    elements.progressFill.style.width = '0%';
    elements.progressCurrent.textContent = '0';
    elements.progressTotal.textContent = '0';
    elements.playIcon.style.display = 'block';
    elements.pauseIcon.style.display = 'none';
  }

  if (state.voice && elements.voiceSelect.value !== state.voice) {
    elements.voiceSelect.value = state.voice;
  }
  if (state.mode && elements.modeSelect.value !== state.mode) {
    elements.modeSelect.value = state.mode;
  }
}

function loadState() {
  browser.runtime.sendMessage({ type: 'get-state' }).then(updateUI);
}

function setStatusOnline(isOnline, label) {
  if (elements.statusPill) {
    elements.statusPill.classList.toggle('offline', !isOnline);
  }
  if (elements.statusDot) {
    elements.statusDot.classList.toggle('offline', !isOnline);
  }
  elements.statusText.textContent = label;
}

function checkHealth() {
  browser.runtime.sendMessage({ type: 'check-health' }).then((health) => {
    if (health && (health.status === 'ok' || health.status === 'healthy')) {
      setStatusOnline(true, 'ONLINE');
      updateGpuStats(health);
    } else {
      const err = health && health.error ? health.error : 'Offline';
      setStatusOnline(false, err.length > 12 ? 'Offline' : err);
      gpuElements.card.style.display = 'none';
    }
  }).catch(() => {
    setStatusOnline(false, 'Offline');
    gpuElements.card.style.display = 'none';
  });
}

function loadVoices() {
  browser.runtime.sendMessage({ type: 'get-voices' }).then((voices) => {
    elements.voiceSelect.innerHTML = '';
    const voiceList = (voices && voices.length > 0) ? voices : [
      { id: 'af_heart', name: 'Heart (American Female)' },
      { id: 'af_bella', name: 'Bella (American Female)' },
      { id: 'am_adam', name: 'Adam (American Male)' },
      { id: 'bf_emma', name: 'Emma (British Female)' }
    ];
    for (const voice of voiceList) {
      const option = document.createElement('option');
      option.value = voice.id;
      option.textContent = voice.id || voice.name;
      if (voice.name && voice.name !== voice.id) {
        option.title = voice.name;
      }
      elements.voiceSelect.appendChild(option);
    }
    return browser.runtime.sendMessage({ type: 'get-state' });
  }).then((state) => {
    if (state && state.voice) elements.voiceSelect.value = state.voice;
  });
}

function updateGpuStats(health) {
  if (health && health.mem_used !== undefined && health.mem_total !== undefined) {
    gpuElements.card.style.display = 'block';
    const usedGB = (health.mem_used / 1024).toFixed(1);
    const totalGB = (health.mem_total / 1024).toFixed(1);
    const pct = (health.mem_used / health.mem_total) * 100;
    gpuElements.text.textContent = `${usedGB} / ${totalGB} GB`;
    gpuElements.barFill.style.width = `${pct}%`;
    gpuElements.barFill.classList.toggle('high', pct > 80);
  } else {
    gpuElements.card.style.display = 'none';
  }
}

browser.runtime.onMessage.addListener((message) => {
  if (message.type === 'state-update') updateUI(message.state);
});
