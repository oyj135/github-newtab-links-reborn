// ==UserScript==
// @name         GitHub 链接新标签页打开
// @namespace    http://tampermonkey.net/
// @version      6.2.0
// @description  拦截点击实现 GitHub 链接新标签页/当前页打开；右侧单图标把手，悬浮展开左侧弹窗（不会移开就消失，可正常切换）。
// @match        https://github.com/*
// @run-at       document-start
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @license      MIT
// @downloadURL  https://github.com/oyj135/github-newtab-links-reborn/main/github_links_new_tab.user.js
// ==/UserScript==

(function () {
  'use strict';

  const KEY = 'gh_newtab_mode'; // 'enabled' | 'disabled'
  const DEFAULT = 'enabled';

  const getMode = () => GM_getValue(KEY, DEFAULT);
  const setMode = (m) => GM_setValue(KEY, m);

  // -------------------- Link handling --------------------
  const isModifiedClick = (e) =>
    e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;

  const closestAnchor = (el) => (el && el.closest ? el.closest('a[href]') : null);

  const shouldIgnoreLink = (a) => {
    if (!a) return true;

    const href = a.getAttribute('href');
    if (!href || href.startsWith('javascript:')) return true;
    if (a.hasAttribute('download')) return true;

    const role = a.getAttribute('role');
    if (role === 'button') return true;

    // 纯锚点（仅 # 或 #xxx）：当前页内跳转，不新开标签
    if (href.startsWith('#')) return true;

    // 同页锚点：目标 URL 与当前页同 origin、同 path，仅 hash 不同 → 不新开标签（如 README 里「简体中文 | English」）
    try {
      const u = new URL(a.href);
      const cur = window.location;
      if (u.origin === cur.origin && u.pathname === cur.pathname) return true;
    } catch (_) {}

    return false;
  };

  window.addEventListener(
    'click',
    (e) => {
      if (getMode() !== 'enabled') return;
      if (isModifiedClick(e)) return;

      const a = closestAnchor(e.target);
      if (shouldIgnoreLink(a)) return;

      const url = a.href;
      if (!url) return;

      e.preventDefault();
      e.stopPropagation();
      window.open(url, '_blank', 'noopener,noreferrer');
    },
    true
  );

  // -------------------- UI --------------------
  const ROOT_ID = 'ghnt-root';
  const HANDLE_ID = 'ghnt-handle';
  const PANEL_ID = 'ghnt-panel';
  const SELECT_ID = 'ghnt-select';
  const STATUS_ID = 'ghnt-status';

  const modeText = (m) => (m === 'enabled' ? '新标签页打开' : '当前页打开');

  const mountUI = () => {
    if (document.getElementById(ROOT_ID)) return;

    const root = document.createElement('div');
    root.id = ROOT_ID;

    const handle = document.createElement('div');
    handle.id = HANDLE_ID;
    handle.title = '链接打开方式';
    handle.setAttribute('aria-label', '链接打开方式');
    handle.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true">
        <path d="M6.5 3.5h-2A2.5 2.5 0 0 0 2 6v5A2.5 2.5 0 0 0 4.5 13.5h5A2.5 2.5 0 0 0 12 11v-2" stroke-width="1.4" stroke-linecap="round"/>
        <path d="M9 3h4v4" stroke-width="1.4" stroke-linecap="round"/>
        <path d="M13 3L7.5 8.5" stroke-width="1.4" stroke-linecap="round"/>
      </svg>
    `;

    const panel = document.createElement('div');
    panel.id = PANEL_ID;

    const title = document.createElement('div');
    title.className = 'ghnt-title';
    title.textContent = '打开方式';

    const status = document.createElement('div');
    status.id = STATUS_ID;
    status.className = 'ghnt-status';
    status.textContent = `当前：${modeText(getMode())}`;

    const select = document.createElement('select');
    select.id = SELECT_ID;
    select.className = 'ghnt-select';
    select.innerHTML = `
      <option value="enabled">🌐 新标签页打开</option>
      <option value="disabled">📌 当前页打开</option>
    `;
    select.value = getMode();
    select.addEventListener('change', () => {
      const m = select.value;
      setMode(m);
      status.textContent = `当前：${modeText(m)}`;
    });

    const hint = document.createElement('div');
    hint.className = 'ghnt-hint';
    hint.textContent = '提示：Ctrl/⌘ 点击仍按浏览器原逻辑';

    panel.appendChild(title);
    panel.appendChild(status);
    panel.appendChild(select);
    panel.appendChild(hint);

    root.appendChild(handle);
    root.appendChild(panel);
    document.documentElement.appendChild(root);

    // --- Open/close logic (prevents flicker) ---
    let closeTimer = null;
    const open = () => {
      if (closeTimer) {
        clearTimeout(closeTimer);
        closeTimer = null;
      }
      root.classList.add('ghnt-open');
    };
    const scheduleClose = () => {
      if (closeTimer) clearTimeout(closeTimer);
      closeTimer = setTimeout(() => root.classList.remove('ghnt-open'), 180);
    };

    // 只要在把手或面板上，就保持打开
    handle.addEventListener('mouseenter', open);
    panel.addEventListener('mouseenter', open);

    handle.addEventListener('mouseleave', scheduleClose);
    panel.addEventListener('mouseleave', scheduleClose);
  };

  GM_addStyle(`
    #${ROOT_ID}{
      position: fixed;
      top: 50%;
      right: 10px;
      transform: translateY(-50%);
      z-index: 2147483647;
      pointer-events: auto;

      font-family: -apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;
    }

    #${HANDLE_ID}{
      width: 42px;
      height: 42px;
      display: flex;
      align-items: center;
      justify-content: center;

      color: #fff;
      background: rgba(20,20,20,.90);
      border: 1px solid rgba(255,255,255,.18);
      border-radius: 12px;

      box-shadow: 0 10px 30px rgba(0,0,0,.28);
      backdrop-filter: blur(6px);

      user-select: none;
      cursor: default;
    }

    /* 面板固定在把手左侧，默认隐藏 */
    #${PANEL_ID}{
      position: absolute;
      top: 50%;
      right: 52px;
      width: 220px;
      padding: 10px 12px;

      border-radius: 12px;
      border: 1px solid rgba(255,255,255,.18);
      background: rgba(20,20,20,.92);
      color: #fff;

      box-shadow: 0 10px 30px rgba(0,0,0,.30);
      backdrop-filter: blur(6px);

      transform: translateY(-50%) translateX(10px) scale(.98);
      transform-origin: right center;

      opacity: 0;
      visibility: hidden;
      pointer-events: none;

      transition:
        transform .16s cubic-bezier(.2,.9,.2,1),
        opacity .16s ease,
        visibility 0s linear .16s;
      will-change: transform, opacity;
    }

    /* 由 JS 控制打开，避免“移过去就消失” */
    #${ROOT_ID}.ghnt-open #${PANEL_ID}{
      transform: translateY(-50%) translateX(0) scale(1);
      opacity: 1;
      visibility: visible;
      pointer-events: auto;

      transition:
        transform .16s cubic-bezier(.2,.9,.2,1),
        opacity .16s ease,
        visibility 0s;
    }

    .ghnt-title{
      font-size: 12px;
      font-weight: 700;
      opacity: .95;
      margin-bottom: 6px;
    }

    .ghnt-status{
      font-size: 12px;
      opacity: .85;
      margin-bottom: 8px;
    }

    .ghnt-select{
      width: 100%;
      height: 32px;
      padding: 0 10px;
      border-radius: 8px;
      font-size: 12px;
      cursor: pointer;

      color: #fff;
      background: rgba(255,255,255,.10);
      border: 1px solid rgba(255,255,255,.20);
      outline: none;
    }
    .ghnt-select:focus{
      box-shadow: 0 0 0 3px rgba(9,105,218,.35);
      border-color: rgba(9,105,218,.7);
    }
    .ghnt-select option{ color:#000; }

    .ghnt-hint{
      margin-top: 8px;
      font-size: 11px;
      opacity: .72;
      line-height: 1.25;
    }

    @media (prefers-reduced-motion: reduce){
      #${PANEL_ID}{ transition: none; }
    }
  `);

  const start = () => {
    mountUI();

    const obs = new MutationObserver(() => mountUI());
    obs.observe(document.documentElement, { childList: true, subtree: true });

    window.addEventListener('load', () => setTimeout(mountUI, 300));
    window.addEventListener('turbo:render', () => setTimeout(mountUI, 200));
  };

  start();
})();