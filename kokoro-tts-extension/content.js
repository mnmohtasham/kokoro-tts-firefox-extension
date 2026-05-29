(function () {
  if (document.getElementById('ptts-float-btns')) return;

  const DEFAULT_EXCLUDED = [
    'youtube.com',
    'bilibili.com',
    'google.com/search',
    'bing.com/search',
    'duckduckgo.com',
    'baidu.com/s',
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

  const PTTS_BTN = 'padding:6px 10px;border:1px solid rgba(255,255,255,0.14);background:rgba(255,255,255,0.06);color:rgba(234,240,255,0.92);border-radius:12px;cursor:pointer;font-size:11px;flex-shrink:0;';
  const PTTS_BTN_ACCENT = 'padding:6px 10px;border:1px solid rgba(56,189,248,0.35);background:rgba(56,189,248,0.10);color:rgba(234,240,255,0.95);border-radius:12px;cursor:pointer;font-size:11px;flex-shrink:0;';
  const PTTS_BTN_ICON = 'width:32px;height:32px;display:flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,0.14);background:rgba(255,255,255,0.06);color:rgba(234,240,255,0.92);border-radius:12px;cursor:pointer;font-size:14px;line-height:1;padding:0;flex-shrink:0;';

  function showSummaryOverlay(result) {
    const existing = document.getElementById('ptts-summary-overlay');
    if (existing) existing.remove();

    if (!document.getElementById('ptts-summary-expand-style')) {
      const expandStyle = document.createElement('style');
      expandStyle.id = 'ptts-summary-expand-style';
      expandStyle.textContent = `
        #ptts-summary-overlay.ptts-summary-expanded {
          top: max(10px, env(safe-area-inset-top));
          right: max(10px, env(safe-area-inset-right));
          left: max(10px, env(safe-area-inset-left));
          bottom: max(10px, env(safe-area-inset-bottom));
          width: auto !important;
          max-width: none !important;
          max-height: none !important;
        }
      `;
      document.head.appendChild(expandStyle);
    }

    const overlay = document.createElement('div');
    overlay.id = 'ptts-summary-overlay';
    overlay.style.cssText = 'position:fixed;top:18px;right:18px;max-width:520px;width:92vw;max-height:82vh;display:flex;flex-direction:column;background:rgba(10,14,24,0.78);color:rgba(234,240,255,0.92);border:1px solid rgba(255,255,255,0.14);border-radius:12px;z-index:999999;box-shadow:0 20px 50px rgba(0,0,0,0.45);font-size:14px;line-height:1.55;backdrop-filter: blur(14px);';

    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;gap:8px;padding:10px 12px;flex-shrink:0;border-bottom:1px solid rgba(255,255,255,0.10);background:rgba(255,255,255,0.04);';

    const title = document.createElement('div');
    title.textContent = 'Summary';
    title.style.cssText = 'font-weight:bold;margin-right:auto;';
    header.appendChild(title);

    const themeBtn = document.createElement('button');
    themeBtn.innerHTML = '<span>Dark Mode</span><span style=\"width:34px;height:18px;border-radius:999px;background:rgba(255,255,255,0.10);border:1px solid rgba(255,255,255,0.14);position:relative;flex-shrink:0;display:inline-block;\"><span data-dot=\"1\" style=\"position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:999px;background:rgba(255,255,255,0.92);transition:transform 0.15s ease;\"></span></span>';
    themeBtn.style.cssText = 'padding:6px 10px;border:1px solid rgba(255,255,255,0.14);background:rgba(255,255,255,0.06);color:rgba(234,240,255,0.92);border-radius:999px;cursor:pointer;font-size:11px;flex-shrink:0;display:flex;align-items:center;gap:8px;user-select:none;';
    header.appendChild(themeBtn);

    let currentFontSize = 14;

    const summaryReadBtn = document.createElement('button');
    summaryReadBtn.textContent = 'Read';
    summaryReadBtn.setAttribute('data-ptts-summary-read', '1');
    summaryReadBtn.style.cssText = PTTS_BTN_ACCENT;
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
    copyBtn.style.cssText = PTTS_BTN;
    copyBtn.onclick = function () {
      navigator.clipboard.writeText(result.summary).then(function () {
        copyBtn.textContent = 'Copied!';
        setTimeout(function () { copyBtn.textContent = 'Copy'; }, 1500);
      });
    };
    header.appendChild(copyBtn);

    const fontMinus = document.createElement('button');
    fontMinus.textContent = '−';
    fontMinus.style.cssText = PTTS_BTN_ICON;
    header.appendChild(fontMinus);

    const fontPlus = document.createElement('button');
    fontPlus.textContent = '+';
    fontPlus.style.cssText = PTTS_BTN_ICON;
    header.appendChild(fontPlus);

    const expandBtn = document.createElement('button');
    expandBtn.textContent = '⤢';
    expandBtn.setAttribute('aria-label', 'Expand summary');
    expandBtn.style.cssText = PTTS_BTN_ICON;
    expandBtn.onclick = function () {
      const expanded = overlay.classList.toggle('ptts-summary-expanded');
      expandBtn.textContent = expanded ? '⤡' : '⤢';
    };
    header.appendChild(expandBtn);

    const close = document.createElement('button');
    close.textContent = '✕';
    close.style.cssText = PTTS_BTN_ICON;
    close.onclick = function () { overlay.remove(); };
    header.appendChild(close);

    overlay.appendChild(header);

    const scrollArea = document.createElement('div');
    scrollArea.style.cssText = 'overflow-y:auto;padding:12px 14px 14px;flex:1;min-height:0;';

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
    meta.style.cssText = 'margin-top:10px;font-size:11px;color:rgba(234,240,255,0.55);';
    scrollArea.appendChild(meta);

    overlay.appendChild(scrollArea);
    document.body.appendChild(overlay);

    function applySummaryTheme(theme) {
      const t = theme === 'day' ? 'day' : 'night';
      const dot = themeBtn.querySelector('[data-dot=\"1\"]');
      if (dot) dot.style.transform = (t === 'night') ? 'translateX(16px)' : 'translateX(0px)';
      // Toggle pill colors: green when Dark Mode is ON (night)
      const pill = dot ? dot.parentElement : null;
      if (pill && dot) {
        if (t === 'night') {
          pill.style.background = 'rgba(34,197,94,0.22)';
          pill.style.borderColor = 'rgba(34,197,94,0.45)';
          dot.style.background = '#22c55e';
        } else {
          pill.style.background = 'rgba(10,14,24,0.04)';
          pill.style.borderColor = 'rgba(10,14,24,0.12)';
          dot.style.background = 'rgba(10,14,24,0.45)';
        }
      }
      if (t === 'day') {
        themeBtn.style.background = 'rgba(10,14,24,0.04)';
        themeBtn.style.borderColor = 'rgba(10,14,24,0.12)';
        themeBtn.style.color = 'rgba(10,14,24,0.85)';
        overlay.style.background = 'rgba(255,255,255,0.92)';
        overlay.style.backgroundColor = 'rgba(255,255,255,0.92)';
        overlay.style.color = 'rgba(10,14,24,0.92)';
        overlay.style.border = '1px solid rgba(10,14,24,0.10)';
        header.style.background = 'rgba(10,14,24,0.04)';
        header.style.borderBottom = '1px solid rgba(10,14,24,0.08)';
        meta.style.color = 'rgba(10,14,24,0.55)';
        summaryReadBtn.style.borderColor = 'rgba(56,189,248,0.35)';
        summaryReadBtn.style.background = 'rgba(56,189,248,0.12)';
        summaryReadBtn.style.color = 'rgba(10,14,24,0.92)';
        copyBtn.style.color = 'rgba(10,14,24,0.92)';
        copyBtn.style.borderColor = 'rgba(10,14,24,0.12)';
        copyBtn.style.background = 'rgba(10,14,24,0.04)';
        fontMinus.style.color = 'rgba(10,14,24,0.92)';
        fontPlus.style.color = 'rgba(10,14,24,0.92)';
        expandBtn.style.color = 'rgba(10,14,24,0.92)';
        expandBtn.style.borderColor = 'rgba(10,14,24,0.12)';
        expandBtn.style.background = 'rgba(10,14,24,0.04)';
        close.style.color = 'rgba(10,14,24,0.92)';
        close.style.borderColor = 'rgba(10,14,24,0.12)';
        close.style.background = 'rgba(10,14,24,0.04)';
      } else {
        themeBtn.style.background = 'rgba(255,255,255,0.06)';
        themeBtn.style.borderColor = 'rgba(255,255,255,0.14)';
        themeBtn.style.color = 'rgba(234,240,255,0.92)';
        overlay.style.background = 'rgba(10,14,24,0.78)';
        overlay.style.backgroundColor = 'rgba(10,14,24,0.78)';
        overlay.style.color = 'rgba(234,240,255,0.92)';
        overlay.style.border = '1px solid rgba(255,255,255,0.14)';
        header.style.background = 'rgba(255,255,255,0.04)';
        header.style.borderBottom = '1px solid rgba(255,255,255,0.10)';
        meta.style.color = 'rgba(234,240,255,0.55)';
        summaryReadBtn.style.borderColor = 'rgba(56,189,248,0.35)';
        summaryReadBtn.style.background = 'rgba(56,189,248,0.10)';
        summaryReadBtn.style.color = 'rgba(234,240,255,0.95)';
        copyBtn.style.color = 'rgba(234,240,255,0.92)';
        copyBtn.style.borderColor = 'rgba(255,255,255,0.14)';
        copyBtn.style.background = 'rgba(255,255,255,0.06)';
        fontMinus.style.color = 'rgba(234,240,255,0.92)';
        fontPlus.style.color = 'rgba(234,240,255,0.92)';
        expandBtn.style.color = 'rgba(234,240,255,0.92)';
        expandBtn.style.borderColor = 'rgba(255,255,255,0.14)';
        expandBtn.style.background = 'rgba(255,255,255,0.06)';
        close.style.color = 'rgba(234,240,255,0.92)';
        close.style.borderColor = 'rgba(255,255,255,0.14)';
        close.style.background = 'rgba(255,255,255,0.06)';
      }
      browser.storage.local.set({ summaryTheme: t }).catch(() => {});
    }

    themeBtn.onclick = function () {
      browser.storage.local.get(['summaryTheme']).then((data) => {
        applySummaryTheme((data.summaryTheme || 'day') === 'day' ? 'night' : 'day');
      }).catch(() => applySummaryTheme('day'));
    };
    browser.storage.local.get(['summaryTheme']).then((data) => {
      applySummaryTheme(data.summaryTheme || 'day');
    }).catch(() => applySummaryTheme('day'));

    return summaryReadBtn;
  }

  browser.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'ptts-content-state') {
      updateReadBtnIcon(msg.state.isPlaying, msg.state.isPaused);
      updateSummaryReadBtn(msg.state.isPlaying, msg.state.isPaused);
    } else if (msg.type === 'ptts-show-summary' && msg.result) {
      showSummaryOverlay(msg.result);
    } else if (msg.type === 'ptts-request-extract') {
      return Promise.resolve({
        selectionText: window.getSelection().toString(),
        pageText: extractPageText()
      });
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
          bottom: 92px;
          right: 18px;
          z-index: 999998;
          display: flex;
          font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
          filter: drop-shadow(0 18px 30px rgba(0,0,0,0.35));
        }
        .ptts-dock {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px;
          border-radius: 12px;
          background: rgba(10, 14, 24, 0.40);
          border: 1px solid rgba(255,255,255,0.14);
          backdrop-filter: blur(12px);
        }
        .ptts-fab {
          width: 52px;
          height: 52px;
          border: 1px solid rgba(255,255,255,0.14);
          border-radius: 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255,255,255,0.08);
          backdrop-filter: blur(10px);
          transition: transform 0.18s ease, border-color 0.18s ease, background 0.18s ease;
          position: relative;
        }
        .ptts-fab:hover { transform: translateY(-2px); border-color: rgba(56,189,248,0.35); background: rgba(56,189,248,0.10); }
        .ptts-fab:active { transform: translateY(0px) scale(0.98); }
        .ptts-fab svg { width: 22px; height: 22px; fill: #fff; z-index: 1; }
        #ptts-chat {
          display: none;
          position: fixed;
          right: max(12px, env(safe-area-inset-right));
          left: auto;
          bottom: max(88px, env(safe-area-inset-bottom));
          width: min(380px, calc(100vw - 24px));
          height: min(560px, calc(100vh - 140px));
          display: none;
          flex-direction: column;
          background: rgba(10, 14, 24, 0.70);
          border: 1px solid rgba(255,255,255,0.14);
          border-radius: 12px;
          box-shadow: 0 20px 50px rgba(0,0,0,0.45);
          z-index: 999998;
          overflow: hidden;
          backdrop-filter: blur(14px);
          color: rgba(234,240,255,0.92);
        }
        #ptts-chat.ptts-open { display: flex; }
        #ptts-chat-header {
          display:flex;
          align-items:center;
          gap:10px;
          padding: 10px 12px;
          border-bottom: 1px solid rgba(255,255,255,0.10);
          background: rgba(255,255,255,0.04);
        }
        #ptts-chat-title { font-weight: 700; letter-spacing: 0.2px; font-size: 13px; margin-right:auto; }
        #ptts-chat-close,
        #ptts-chat-expand {
          width: 32px;
          height: 32px;
          display:flex;
          align-items:center;
          justify-content:center;
          border: 1px solid rgba(255,255,255,0.14);
          background: rgba(255,255,255,0.06);
          color: rgba(234,240,255,0.9);
          border-radius: 12px;
          cursor: pointer;
          font-size: 14px;
          line-height: 1;
          padding: 0;
        }
        #ptts-chat-theme {
          border: 1px solid rgba(255,255,255,0.14);
          background: rgba(255,255,255,0.06);
          color: rgba(234,240,255,0.9);
          border-radius: 999px;
          padding: 6px 10px;
          cursor: pointer;
          font-size: 12px;
          display:flex;
          align-items:center;
          gap: 8px;
          user-select: none;
        }
        #ptts-chat-theme .ptts-toggle-pill {
          width: 34px;
          height: 18px;
          border-radius: 999px;
          background: rgba(255,255,255,0.10);
          border: 1px solid rgba(255,255,255,0.14);
          position: relative;
          flex-shrink: 0;
        }
        #ptts-chat-theme .ptts-toggle-dot {
          position:absolute;
          top: 2px;
          left: 2px;
          width: 14px;
          height: 14px;
          border-radius: 999px;
          background: rgba(255,255,255,0.92);
          transition: transform 0.15s ease;
        }
        #ptts-chat.ptts-theme-night #ptts-chat-theme .ptts-toggle-pill {
          background: rgba(34,197,94,0.22);
          border-color: rgba(34,197,94,0.45);
        }
        #ptts-chat.ptts-theme-night #ptts-chat-theme .ptts-toggle-dot {
          background: #22c55e;
          transform: translateX(16px);
        }
        #ptts-chat.ptts-theme-night #ptts-chat-theme {
          background: rgba(255,255,255,0.06);
          border-color: rgba(255,255,255,0.14);
          color: rgba(234,240,255,0.90);
        }
        #ptts-chat.ptts-theme-day #ptts-chat-theme .ptts-toggle-pill {
          background: rgba(10,14,24,0.04);
          border-color: rgba(10,14,24,0.12);
        }
        #ptts-chat.ptts-theme-day #ptts-chat-theme .ptts-toggle-dot {
          background: rgba(10,14,24,0.45);
          transform: translateX(0px);
        }
        #ptts-chat.ptts-theme-day #ptts-chat-theme {
          background: rgba(10,14,24,0.04);
          border-color: rgba(10,14,24,0.12);
          color: rgba(10,14,24,0.85);
        }

        #ptts-chat.ptts-expanded {
          right: max(10px, env(safe-area-inset-right));
          left: max(10px, env(safe-area-inset-left));
          top: max(10px, env(safe-area-inset-top));
          bottom: max(10px, env(safe-area-inset-bottom));
          width: auto;
          height: auto;
          border-radius: 12px;
        }
        #ptts-chat-messages {
          padding: 12px;
          flex: 1;
          min-height: 0;
          overflow: auto;
        }
        .ptts-msg {
          max-width: 92%;
          padding: 10px 10px;
          border-radius: 14px;
          margin-bottom: 10px;
          border: 1px solid rgba(255,255,255,0.10);
          background: rgba(255,255,255,0.06);
          line-height: 1.45;
          font-size: 13px;
          white-space: pre-wrap;
        }
        .ptts-msg.user { margin-left: auto; background: rgba(56,189,248,0.12); border-color: rgba(56,189,248,0.18); }
        .ptts-msg.assistant { margin-right: auto; background: rgba(167,139,250,0.10); border-color: rgba(167,139,250,0.16); }
        #ptts-chat-inputbar {
          display:flex;
          gap: 8px;
          padding: 10px 12px;
          border-top: 1px solid rgba(255,255,255,0.10);
          background: rgba(255,255,255,0.04);
          flex-shrink: 0;
        }
        #ptts-chat-input {
          flex: 1;
          border: 1px solid rgba(255,255,255,0.14);
          background: rgba(255,255,255,0.06);
          color: rgba(234,240,255,0.92);
          border-radius: 14px;
          padding: 10px 10px;
          font-size: 13px;
          outline: none;
          resize: none;
          height: 40px;
          max-height: 120px;
          overflow: auto;
        }
        #ptts-chat-send {
          border: 1px solid rgba(56,189,248,0.35);
          background: rgba(56,189,248,0.12);
          color: rgba(234,240,255,0.95);
          border-radius: 12px;
          padding: 0 14px;
          min-height: 40px;
          cursor: pointer;
          font-weight: 700;
          font-size: 13px;
        }
        #ptts-chat-send:disabled { opacity: 0.6; cursor: default; }

        /* Theme variants (applied by toggles) */
        #ptts-chat.ptts-theme-night {
          background: rgba(10, 14, 24, 0.70);
          color: rgba(234,240,255,0.92);
          border: 1px solid rgba(255,255,255,0.14);
        }
        #ptts-chat.ptts-theme-day {
          background: rgba(255,255,255,0.88);
          color: rgba(10,14,24,0.92);
          border: 1px solid rgba(10,14,24,0.10);
        }
        #ptts-chat.ptts-theme-day #ptts-chat-header,
        #ptts-chat.ptts-theme-day #ptts-chat-inputbar {
          background: rgba(10,14,24,0.04);
          border-color: rgba(10,14,24,0.08);
        }
        #ptts-chat.ptts-theme-day #ptts-chat-input {
          background: rgba(255,255,255,0.90);
          color: rgba(10,14,24,0.92);
          border-color: rgba(10,14,24,0.12);
        }
        #ptts-chat.ptts-theme-day .ptts-msg { background: rgba(10,14,24,0.04); border-color: rgba(10,14,24,0.08); }
        #ptts-chat.ptts-theme-day .ptts-msg.user { background: rgba(56,189,248,0.14); border-color: rgba(56,189,248,0.22); }
        #ptts-chat.ptts-theme-day .ptts-msg.assistant { background: rgba(167,139,250,0.12); border-color: rgba(167,139,250,0.20); }
        #ptts-chat.ptts-theme-day #ptts-chat-close,
        #ptts-chat.ptts-theme-day #ptts-chat-expand {
          background: rgba(10,14,24,0.04);
          border-color: rgba(10,14,24,0.12);
          color: rgba(10,14,24,0.85);
        }
        #ptts-chat.ptts-theme-day #ptts-chat-theme {
          background: rgba(10,14,24,0.04);
          border-color: rgba(10,14,24,0.12);
          color: rgba(10,14,24,0.85);
        }
        #ptts-chat.ptts-theme-day #ptts-chat-send {
          background: rgba(56,189,248,0.14);
          border: 1px solid rgba(56,189,248,0.35);
          color: rgba(10,14,24,0.92);
        }
        .ptts-fab-tooltip {
          position: absolute;
          right: 60px;
          white-space: nowrap;
          background: rgba(10, 14, 24, 0.85);
          color: rgba(234,240,255,0.92);
          font-size: 12px;
          padding: 6px 10px;
          border-radius: 999px;
          pointer-events: none;
          opacity: 0;
          transform: translateX(6px);
          transition: opacity 0.15s ease, transform 0.15s ease;
          border: 1px solid rgba(255,255,255,0.12);
          backdrop-filter: blur(10px);
          z-index: 2;
        }
        .ptts-fab:hover .ptts-fab-tooltip { opacity: 1; transform: translateX(0px); }
        @keyframes ptts-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .ptts-fab.ptts-loading svg { animation: ptts-spin 1s linear infinite; }
        .ptts-fab.ptts-loading { pointer-events: none; opacity: 0.8; }
      </style>
      <div class="ptts-dock">
        <button id="ptts-btn-read" class="ptts-fab" title="Read page">
          <span class="ptts-fab-tooltip">Read page</span>
          <svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
        </button>
        <button id="ptts-btn-summarize" class="ptts-fab" title="Summarize page">
          <span class="ptts-fab-tooltip">Summarize</span>
          <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6zm2-8h8v2H8v-2zm0 4h5v2H8v-2z"/></svg>
        </button>
        <button id="ptts-btn-ask" class="ptts-fab" title="Ask AI">
          <span class="ptts-fab-tooltip">Ask</span>
          <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/><path d="M7 9h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2z"/></svg>
        </button>
      </div>
    `;

    document.body.appendChild(container);

    const chat = document.createElement('div');
    chat.id = 'ptts-chat';
    chat.innerHTML = `
      <div id="ptts-chat-header">
        <div id="ptts-chat-title">Ask AI</div>
        <button id="ptts-chat-theme" type="button" aria-label="Dark Mode toggle">
          <span>Dark Mode</span>
          <span class="ptts-toggle-pill"><span class="ptts-toggle-dot"></span></span>
        </button>
        <button id="ptts-chat-expand" type="button" aria-label="Expand chat">⤢</button>
        <button id="ptts-chat-close" type="button" aria-label="Close">✕</button>
      </div>
      <div id="ptts-chat-messages"></div>
      <div id="ptts-chat-inputbar">
        <textarea id="ptts-chat-input" placeholder="Ask a question about this page..."></textarea>
        <button id="ptts-chat-send" type="button">Send</button>
      </div>
    `;
    document.body.appendChild(chat);

    const askBtn = document.getElementById('ptts-btn-ask');
    const chatClose = chat.querySelector('#ptts-chat-close');
    const chatThemeBtn = chat.querySelector('#ptts-chat-theme');
    const chatExpandBtn = chat.querySelector('#ptts-chat-expand');
    const chatMessages = chat.querySelector('#ptts-chat-messages');
    const chatInput = chat.querySelector('#ptts-chat-input');
    const chatSend = chat.querySelector('#ptts-chat-send');

    const chatState = { messages: [], hasSeededPageText: false };

    function renderChatMessage(role, text) {
      const div = document.createElement('div');
      div.className = `ptts-msg ${role}`;
      div.textContent = text;
      chatMessages.appendChild(div);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function setChatTheme(theme) {
      const t = (theme === 'day') ? 'day' : 'night';
      chat.classList.toggle('ptts-theme-day', t === 'day');
      chat.classList.toggle('ptts-theme-night', t !== 'day');
      browser.storage.local.set({ chatTheme: t }).catch(() => {});
    }

    function openChat() {
      chat.classList.add('ptts-open');
      chatInput.focus();
      if (chatState.messages.length === 0) {
        renderChatMessage('assistant', 'Ask anything about this page. You can follow up and I will keep context.');
      }
    }
    function closeChat() {
      chat.classList.remove('ptts-open');
      chat.classList.remove('ptts-expanded');
    }

    askBtn.addEventListener('click', () => {
      const visible = chat.classList.contains('ptts-open');
      if (visible) closeChat();
      else openChat();
    });
    chatClose.addEventListener('click', closeChat);
    chatThemeBtn.addEventListener('click', () => {
      const isDay = chat.classList.contains('ptts-theme-day');
      setChatTheme(isDay ? 'night' : 'day');
    });
    chatExpandBtn.addEventListener('click', () => {
      const expanded = chat.classList.toggle('ptts-expanded');
      chatExpandBtn.textContent = expanded ? '⤡' : '⤢';
      // Keep focus usable on mobile after resize
      setTimeout(() => chatInput.focus(), 0);
    });

    browser.storage.local.get(['chatTheme']).then((data) => {
      // Dark Mode OFF by default
      setChatTheme(data.chatTheme || 'day');
    }).catch(() => setChatTheme('day'));

    async function sendChat() {
      const q = (chatInput.value || '').trim();
      if (!q) return;
      chatInput.value = '';
      chatState.messages.push({ role: 'user', content: q });
      renderChatMessage('user', q);

      chatSend.disabled = true;
      chatSend.textContent = '...';

      const pageText = extractPageText();
      const history = chatState.messages
        .slice(-10)
        .map(m => `${m.role.toUpperCase()}: ${m.content}`)
        .join('\\n');
      const prompt = chatState.hasSeededPageText
        ? `Answer the user's question using the page context. Keep it concise and factual.\\n\\nConversation:\\n${history}\\n`
        : `Answer the user's question using the page context. Keep it concise and factual.\\n\\nPage:\\n${pageText}\\n\\nConversation:\\n${history}\\n`;

      try {
        const result = await browser.runtime.sendMessage({ type: 'summarize-page', pageText, customPrompt: prompt });
        if (result && result.success) {
          chatState.hasSeededPageText = true;
          chatState.messages.push({ role: 'assistant', content: result.summary });
          renderChatMessage('assistant', result.summary);
        } else {
          renderChatMessage('assistant', `Ask failed: ${(result && result.error) ? result.error : 'Unknown error'}`);
        }
      } catch (e) {
        renderChatMessage('assistant', `Ask failed: ${e.message}`);
      } finally {
        chatSend.disabled = false;
        chatSend.textContent = 'Send';
      }
    }

    chatSend.addEventListener('click', sendChat);
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendChat();
      }
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
        type: 'toggle-read-with-text',
        hasSelection: !!selection,
        selectionText: selection,
        pageText: extractPageText()
      });
    });

    // Rewind/forward bar — show ABOVE the read button while playing
    const seekBar = document.createElement('div');
    seekBar.id = 'ptts-seekbar';
    seekBar.style.cssText = 'position:absolute;left:50%;bottom:66px;transform:translateX(-50%);display:none;gap:6px;align-items:center;background:rgba(10,14,24,0.85);padding:7px 8px;border-radius:999px;border:1px solid rgba(255,255,255,0.12);backdrop-filter: blur(10px);z-index:999999;';
    seekBar.innerHTML = `
      <button data-d="-10" style="border:1px solid rgba(255,255,255,0.14);background:rgba(255,255,255,0.08);color:rgba(234,240,255,0.95);border-radius:999px;padding:5px 9px;font-size:11px;cursor:pointer;transition:transform .12s ease,background .12s ease;">-10s</button>
      <button data-d="-5" style="border:1px solid rgba(255,255,255,0.14);background:rgba(255,255,255,0.08);color:rgba(234,240,255,0.95);border-radius:999px;padding:5px 9px;font-size:11px;cursor:pointer;transition:transform .12s ease,background .12s ease;">-5s</button>
      <button data-d="5" style="border:1px solid rgba(255,255,255,0.14);background:rgba(255,255,255,0.08);color:rgba(234,240,255,0.95);border-radius:999px;padding:5px 9px;font-size:11px;cursor:pointer;transition:transform .12s ease,background .12s ease;">+5s</button>
      <button data-d="10" style="border:1px solid rgba(255,255,255,0.14);background:rgba(255,255,255,0.08);color:rgba(234,240,255,0.95);border-radius:999px;padding:5px 9px;font-size:11px;cursor:pointer;transition:transform .12s ease,background .12s ease;">+10s</button>
    `;
    readBtn.appendChild(seekBar);

    function showSeekBar(show) {
      seekBar.style.display = show ? 'flex' : 'none';
    }
    let canShowSeek = false;
    let isHoveringRead = false;
    function refreshSeekBarVisibility() {
      showSeekBar(Boolean(canShowSeek && isHoveringRead));
    }
    readBtn.addEventListener('mouseenter', () => { isHoveringRead = true; refreshSeekBarVisibility(); });
    readBtn.addEventListener('mouseleave', () => { isHoveringRead = false; refreshSeekBarVisibility(); });
    seekBar.addEventListener('mouseenter', () => { isHoveringRead = true; refreshSeekBarVisibility(); });
    seekBar.addEventListener('mouseleave', () => { isHoveringRead = false; refreshSeekBarVisibility(); });

    seekBar.querySelectorAll('button[data-d]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const d = Number(btn.getAttribute('data-d'));
        if (!Number.isFinite(d)) return;
        browser.runtime.sendMessage({ type: 'seek', deltaSeconds: d });
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
        canShowSeek = true;
        svg.innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
        tooltip.textContent = 'Pause';
      } else {
        canShowSeek = false;
        showSeekBar(false);
        svg.innerHTML = '<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>';
        tooltip.textContent = 'Read page';
      }
      refreshSeekBarVisibility();
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

  browser.storage.local.get(['excludedSites', 'showFloatingButtons']).then((data) => {
    if (data.showFloatingButtons === false) return;
    const sites = data.excludedSites || DEFAULT_EXCLUDED;
    const url = location.hostname + location.pathname;
    const isExcluded = sites.some((pattern) => {
      const p = pattern.trim().toLowerCase();
      return p && url.toLowerCase().includes(p);
    });
    if (!isExcluded) injectButtons();
  }).catch(() => injectButtons());
})();
