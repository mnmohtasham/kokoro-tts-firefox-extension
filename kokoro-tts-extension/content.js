(function () {
  if (document.getElementById('ptts-float-btns')) return;

  const DEFAULT_EXCLUDED = [
    'youtube.com',
    'google.com/search',
  ];

  function extractPageText() {
    const article = document.querySelector('article') ||
      document.querySelector('[role="main"]') ||
      document.querySelector('main') ||
      document.body;
    const clone = article.cloneNode(true);
    clone.querySelectorAll(
      'script, style, nav, header, footer, aside, [role="navigation"], [role="banner"], .nav, .menu, .sidebar, .comments, .advertisement, .ad'
    ).forEach((el) => el.remove());
    return clone.innerText;
  }

  function mdToHtml(md) {
    md = md.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    md = md.replace(/```([\s\S]*?)```/g, '<pre style="background:#f4f4f4;padding:8px;border-radius:4px;overflow-x:auto;font-size:13px;"><code>$1</code></pre>');
    md = md.replace(/`([^`]+)`/g, '<code style="background:#f0f0f0;padding:1px 4px;border-radius:3px;font-size:13px;">$1</code>');
    md = md.replace(/^### (.+)$/gm, '<h4 style="margin:8px 0 4px;font-size:14px;">$1</h4>');
    md = md.replace(/^## (.+)$/gm, '<h3 style="margin:8px 0 4px;font-size:15px;">$1</h3>');
    md = md.replace(/^# (.+)$/gm, '<h2 style="margin:10px 0 4px;font-size:16px;">$1</h2>');
    md = md.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    md = md.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    md = md.replace(/\*(.+?)\*/g, '<em>$1</em>');
    md = md.replace(/^[\-\*] (.+)$/gm, '<li style="margin-left:16px;">$1</li>');
    md = md.replace(/(<li[^>]*>.*<\/li>\n?)+/g, '<ul style="margin:4px 0;padding-left:8px;">$&</ul>');
    md = md.replace(/^\d+\. (.+)$/gm, '<li style="margin-left:16px;">$1</li>');
    md = md.replace(/^&gt; (.+)$/gm, '<blockquote style="border-left:3px solid #ccc;margin:4px 0;padding-left:8px;color:#555;">$1</blockquote>');
    md = md.replace(/^---$/gm, '<hr style="border:none;border-top:1px solid #ddd;margin:8px 0;">');
    md = md.replace(/\n{2,}/g, '\n');
    md = md.replace(/\n/g, '<br>');
    md = md.replace(/<br>\s*(<\/?(?:ul|ol|li|pre|h[2-4]|blockquote|hr)[^>]*>)/g, '$1');
    md = md.replace(/(<\/?(?:ul|ol|li|pre|h[2-4]|blockquote|hr)[^>]*>)\s*<br>/g, '$1');
    return md;
  }

  function showToast(msg) {
    const t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;bottom:200px;right:24px;background:rgba(0,0,0,0.85);color:#fff;padding:10px 16px;border-radius:8px;font-size:13px;z-index:999999;max-width:300px;box-shadow:0 2px 8px rgba(0,0,0,0.3);';
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 4000);
  }

  function showSummaryOverlay(result) {
    const existing = document.getElementById('ptts-summary-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'ptts-summary-overlay';
    overlay.style.cssText = 'position:fixed;top:20px;right:20px;max-width:480px;width:90vw;max-height:80vh;display:flex;flex-direction:column;background:#fff;color:#222;border:1px solid #ccc;border-radius:8px;z-index:999999;box-shadow:0 4px 12px rgba(0,0,0,0.15);font-size:14px;line-height:1.5;';

    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;gap:6px;padding:10px 12px;flex-shrink:0;border-bottom:1px solid #eee;';

    const title = document.createElement('div');
    title.textContent = 'Summary';
    title.style.cssText = 'font-weight:bold;margin-right:auto;';
    header.appendChild(title);

    let currentFontSize = 14;

    const summaryReadBtn = document.createElement('button');
    summaryReadBtn.textContent = 'Read';
    summaryReadBtn.setAttribute('data-ptts-summary-read', '1');
    summaryReadBtn.style.cssText = 'padding:4px 10px;border:1px solid #7b2ff7;background:#fff;color:#7b2ff7;border-radius:4px;cursor:pointer;font-size:11px;flex-shrink:0;';
    summaryReadBtn.onclick = function () {
      const label = summaryReadBtn.textContent;
      if (label === 'Pause') {
        browser.runtime.sendMessage({ type: 'pause' });
      } else if (label === 'Resume') {
        browser.runtime.sendMessage({ type: 'play' });
      } else {
        browser.runtime.sendMessage({ type: 'read-summary', text: result.summary });
      }
    };
    header.appendChild(summaryReadBtn);

    const copyBtn = document.createElement('button');
    copyBtn.textContent = 'Copy';
    copyBtn.style.cssText = 'padding:4px 10px;border:1px solid #ccc;background:#fff;color:#333;border-radius:4px;cursor:pointer;font-size:11px;flex-shrink:0;';
    copyBtn.onclick = function () {
      navigator.clipboard.writeText(result.summary).then(function () {
        copyBtn.textContent = 'Copied!';
        setTimeout(function () { copyBtn.textContent = 'Copy'; }, 1500);
      });
    };
    header.appendChild(copyBtn);

    const fontMinus = document.createElement('button');
    fontMinus.textContent = '−';
    fontMinus.style.cssText = 'width:24px;height:24px;border:1px solid #ccc;background:#fff;color:#333;border-radius:4px;cursor:pointer;font-size:14px;line-height:1;padding:0;flex-shrink:0;';
    header.appendChild(fontMinus);

    const fontPlus = document.createElement('button');
    fontPlus.textContent = '+';
    fontPlus.style.cssText = 'width:24px;height:24px;border:1px solid #ccc;background:#fff;color:#333;border-radius:4px;cursor:pointer;font-size:14px;line-height:1;padding:0;flex-shrink:0;';
    header.appendChild(fontPlus);

    const close = document.createElement('button');
    close.textContent = '✕';
    close.style.cssText = 'background:none;border:none;font-size:14px;cursor:pointer;color:#666;padding:0 2px;flex-shrink:0;';
    close.onclick = function () { overlay.remove(); };
    header.appendChild(close);

    overlay.appendChild(header);

    const scrollArea = document.createElement('div');
    scrollArea.style.cssText = 'overflow-y:auto;padding:12px 16px 16px;flex:1;min-height:0;';

    const text = document.createElement('div');
    text.insertAdjacentHTML('afterbegin', mdToHtml(result.summary));
    fontMinus.onclick = function () {
      if (currentFontSize > 10) {
        currentFontSize -= 2;
        text.style.fontSize = `${currentFontSize}px`;
      }
    };
    fontPlus.onclick = function () {
      if (currentFontSize < 24) {
        currentFontSize += 2;
        text.style.fontSize = `${currentFontSize}px`;
      }
    };
    scrollArea.appendChild(text);

    const meta = document.createElement('div');
    meta.textContent = `Model: ${result.model} | Words: ${result.wordCount} | Time: ${result.timeTaken}s`;
    meta.style.cssText = 'margin-top:8px;font-size:11px;color:#888;';
    scrollArea.appendChild(meta);

    overlay.appendChild(scrollArea);
    document.body.appendChild(overlay);
    return summaryReadBtn;
  }

  browser.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'ptts-content-state') {
      updateReadBtnIcon(msg.state.isPlaying, msg.state.isPaused);
      updateSummaryReadBtn(msg.state.isPlaying, msg.state.isPaused);
    } else if (msg.type === 'ptts-show-summary' && msg.result) {
      showSummaryOverlay(msg.result);
    }
    return false;
  });

  function injectButtons() {
    const container = document.createElement('div');
    container.id = 'ptts-float-btns';
    container.innerHTML = `
      <style>
        #ptts-float-btns {
          position: fixed;
          bottom: 80px;
          right: 24px;
          z-index: 999998;
          display: flex;
          flex-direction: column;
          gap: 10px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        .ptts-fab {
          width: 48px;
          height: 48px;
          border: none;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 8px rgba(0,0,0,0.25);
          transition: transform 0.15s, box-shadow 0.15s;
          position: relative;
        }
        .ptts-fab:hover { transform: scale(1.1); box-shadow: 0 4px 14px rgba(0,0,0,0.3); }
        .ptts-fab:active { transform: scale(0.95); }
        .ptts-fab svg { width: 22px; height: 22px; fill: #fff; }
        #ptts-btn-summarize { background: linear-gradient(135deg, #667eea, #764ba2); }
        #ptts-btn-read { background: linear-gradient(135deg, #0095ff, #7b2ff7); }
        #ptts-btn-ask { background: linear-gradient(135deg, #e89b0c, #d4691a); }
        #ptts-ask-panel {
          display: none;
          position: fixed;
          bottom: 240px;
          right: 24px;
          width: 300px;
          background: #fff;
          border: 1px solid #ccc;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          z-index: 999998;
          padding: 10px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        #ptts-ask-panel textarea {
          width: 100%;
          height: 60px;
          border: 1px solid #ccc;
          border-radius: 4px;
          padding: 6px;
          font-size: 12px;
          resize: vertical;
          font-family: inherit;
          box-sizing: border-box;
        }
        #ptts-ask-panel button {
          margin-top: 6px;
          padding: 5px 16px;
          border: none;
          background: linear-gradient(135deg, #e89b0c, #d4691a);
          color: #fff;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        }
        #ptts-ask-panel button:disabled { opacity: 0.6; cursor: default; }
        .ptts-fab-tooltip {
          position: absolute;
          right: 56px;
          white-space: nowrap;
          background: rgba(0,0,0,0.8);
          color: #fff;
          font-size: 12px;
          padding: 4px 10px;
          border-radius: 4px;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.15s;
        }
        .ptts-fab:hover .ptts-fab-tooltip { opacity: 1; }
        @keyframes ptts-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .ptts-fab.ptts-loading svg { animation: ptts-spin 1s linear infinite; }
        .ptts-fab.ptts-loading { pointer-events: none; opacity: 0.8; }
      </style>
      <button id="ptts-btn-summarize" class="ptts-fab" title="Summarize page">
        <span class="ptts-fab-tooltip">Summarize</span>
        <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6zm2-8h8v2H8v-2zm0 4h5v2H8v-2z"/></svg>
      </button>
      <button id="ptts-btn-read" class="ptts-fab" title="Read aloud">
        <span class="ptts-fab-tooltip">Read aloud</span>
        <svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
      </button>
      <button id="ptts-btn-ask" class="ptts-fab" title="Ask page">
        <span class="ptts-fab-tooltip">Ask page</span>
        <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/><path d="M7 9h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2z"/></svg>
      </button>
    `;

    const askPanel = document.createElement('div');
    askPanel.id = 'ptts-ask-panel';
    const askTextarea = document.createElement('textarea');
    askTextarea.placeholder = 'e.g. List all book titles mentioned on this page';
    const askRunBtn = document.createElement('button');
    askRunBtn.textContent = 'Run';
    askPanel.appendChild(askTextarea);
    askPanel.appendChild(askRunBtn);

    browser.storage.local.get('askPrompt').then((data) => {
      if (data.askPrompt) askTextarea.value = data.askPrompt;
    }).catch(() => {});

    document.body.appendChild(container);
    document.body.appendChild(askPanel);

    const askBtn = document.getElementById('ptts-btn-ask');
    askBtn.addEventListener('click', () => {
      askPanel.style.display = askPanel.style.display === 'block' ? 'none' : 'block';
    });

    askRunBtn.addEventListener('click', () => {
      const prompt = askTextarea.value.trim();
      if (!prompt) return;
      browser.storage.local.set({ askPrompt: prompt }).catch(() => {});
      askRunBtn.textContent = 'Running…';
      askRunBtn.disabled = true;

      browser.runtime.sendMessage({
        type: 'summarize-page',
        pageText: extractPageText(),
        customPrompt: prompt
      }).then((result) => {
        askRunBtn.textContent = 'Run';
        askRunBtn.disabled = false;
        if (result && result.success) {
          askPanel.style.display = 'none';
          showSummaryOverlay(result);
        } else {
          showToast(`Ask failed: ${result ? result.error : 'Unknown error'}`);
        }
      }).catch((err) => {
        askRunBtn.textContent = 'Run';
        askRunBtn.disabled = false;
        showToast(`Ask failed: ${err.message}`);
      });
    });

    const sumBtn = document.getElementById('ptts-btn-summarize');
    const sumIcon = '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6zm2-8h8v2H8v-2zm0 4h5v2H8v-2z"/>';
    const spinnerIcon = '<circle cx="12" cy="12" r="10" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="47" stroke-linecap="round"/>';

    sumBtn.addEventListener('click', () => {
      if (sumBtn.classList.contains('ptts-loading')) return;
      sumBtn.classList.add('ptts-loading');
      sumBtn.querySelector('svg').innerHTML = spinnerIcon;
      sumBtn.querySelector('.ptts-fab-tooltip').textContent = 'Summarizing…';

      browser.runtime.sendMessage({
        type: 'summarize-page',
        pageText: extractPageText()
      }).then((result) => {
        sumBtn.classList.remove('ptts-loading');
        sumBtn.querySelector('svg').innerHTML = sumIcon;
        sumBtn.querySelector('.ptts-fab-tooltip').textContent = 'Summarize';
        if (result && result.success) {
          showSummaryOverlay(result);
        } else {
          showToast(`Summarize failed: ${result ? result.error : 'Unknown error'}`);
        }
      }).catch((err) => {
        sumBtn.classList.remove('ptts-loading');
        sumBtn.querySelector('svg').innerHTML = sumIcon;
        sumBtn.querySelector('.ptts-fab-tooltip').textContent = 'Summarize';
        showToast(`Summarize failed: ${err.message}`);
      });
    });

    const readBtn = document.getElementById('ptts-btn-read');
    readBtn.addEventListener('click', () => {
      const selection = window.getSelection().toString().trim();
      browser.runtime.sendMessage({
        type: 'toggle-read',
        hasSelection: !!selection
      });
    });

    function updateSummaryReadBtn(isPlaying, isPaused) {
      const overlay = document.getElementById('ptts-summary-overlay');
      if (!overlay) return;
      const btn = overlay.querySelector('[data-ptts-summary-read]');
      if (!btn) return;
      if (isPlaying && !isPaused) btn.textContent = 'Pause';
      else if (isPlaying && isPaused) btn.textContent = 'Resume';
      else btn.textContent = 'Read';
    }

    function updateReadBtnIcon(isPlaying, isPaused) {
      const tooltip = readBtn.querySelector('.ptts-fab-tooltip');
      const svg = readBtn.querySelector('svg');
      if (isPlaying && !isPaused) {
        svg.innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
        tooltip.textContent = 'Pause';
      } else {
        svg.innerHTML = '<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>';
        tooltip.textContent = 'Read aloud';
      }
    }

    window.__pttsUpdateReadBtn = updateReadBtnIcon;
    window.__pttsUpdateSummaryReadBtn = updateSummaryReadBtn;
  }

  function updateReadBtnIcon(isPlaying, isPaused) {
    if (typeof window.__pttsUpdateReadBtn === 'function') {
      window.__pttsUpdateReadBtn(isPlaying, isPaused);
    }
  }

  function updateSummaryReadBtn(isPlaying, isPaused) {
    if (typeof window.__pttsUpdateSummaryReadBtn === 'function') {
      window.__pttsUpdateSummaryReadBtn(isPlaying, isPaused);
    }
  }

  browser.storage.local.get('excludedSites').then((data) => {
    const sites = data.excludedSites || DEFAULT_EXCLUDED;
    const url = location.hostname + location.pathname;
    const isExcluded = sites.some((pattern) => {
      const p = pattern.trim().toLowerCase();
      return p && url.toLowerCase().includes(p);
    });
    if (!isExcluded) injectButtons();
  }).catch(() => injectButtons());
})();
