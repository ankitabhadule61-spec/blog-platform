/* Shared client helpers: API wrapper, nav, theme, toasts, dialogs, post rows. */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- API ----------
  async function api(path, { method = 'GET', body, form } = {}) {
    const opts = { method, credentials: 'same-origin', headers: {} };
    if (form) opts.body = form;
    else if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    let res;
    try {
      res = await fetch('/api' + path, opts);
    } catch {
      throw Object.assign(new Error('Cannot reach the server. Check your connection and try again.'), { status: 0 });
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.message || 'Request failed'), { status: res.status });
    return data;
  }

  // ---------- icons ----------
  const ICONS = {
    heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
    bookmark: '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>',
    comment: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>',
    reply: '<path d="m9 17-5-5 5-5"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
    out: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>'
  };
  const icon = (n, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`;

  // ---------- formatting ----------
  const dateFmt = (d) => new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  function ago(d) {
    const s = Math.round((Date.now() - new Date(d)) / 1000);
    if (s < 60) return 'just now';
    const steps = [[60, 'minute'], [3600, 'hour'], [86400, 'day'], [2592000, 'month']];
    for (let i = steps.length - 1; i >= 0; i--) {
      if (s >= steps[i][0]) {
        const n = Math.floor(s / steps[i][0]);
        return `${n} ${steps[i][1]}${n > 1 ? 's' : ''} ago`;
      }
    }
    return dateFmt(d);
  }
  const num = (n) => (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k' : String(n));

  const COLORS = ['#2441c8', '#b3441f', '#1b7f5c', '#8a3ffc', '#c2185b', '#0f766e', '#a16207'];
  function avatar(u, size = '') {
    if (!u) return `<span class="avatar ${size}">?</span>`;
    if (u.avatar) return `<img class="avatar ${size}" src="${esc(u.avatar)}" alt="" loading="lazy">`;
    const name = u.username || '?';
    const c = COLORS[[...name].reduce((a, ch) => a + ch.charCodeAt(0), 0) % COLORS.length];
    return `<span class="avatar ${size}" style="background:${c}" aria-hidden="true">${esc(name[0].toUpperCase())}</span>`;
  }

  // ---------- toasts & dialogs ----------
  function toast(msg, isErr) {
    let box = $('#toasts');
    if (!box) {
      box = document.createElement('div');
      box.id = 'toasts';
      box.setAttribute('role', 'status');
      document.body.append(box);
    }
    const t = document.createElement('div');
    t.className = 'toast' + (isErr ? ' err' : '');
    t.textContent = msg;
    box.append(t);
    setTimeout(() => t.remove(), 3800);
  }

  function confirmBox({ title, text, ok = 'Confirm', danger = false }) {
    return new Promise((resolve) => {
      const d = document.createElement('dialog');
      d.innerHTML = `<h3>${esc(title)}</h3><p>${esc(text)}</p><div class="bar"><button class="btn" value="no">Cancel</button><button class="btn ${danger ? 'danger' : 'primary'}" value="yes">${esc(ok)}</button></div>`;
      d.addEventListener('click', (e) => {
        const v = e.target.closest('button')?.value;
        if (v) d.close(v);
      });
      d.addEventListener('close', () => { resolve(d.returnValue === 'yes'); d.remove(); });
      document.body.append(d);
      d.showModal();
    });
  }

  // ---------- theme ----------
  function applyTheme(t) {
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem('theme', t); } catch {}
  }
  (function initTheme() {
    let t = null;
    try { t = localStorage.getItem('theme'); } catch {}
    if (!t) t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    document.documentElement.dataset.theme = t;
  })();

  // ---------- nav ----------
  const App = { user: null };
  function renderNav() {
    const u = App.user;
    const dark = document.documentElement.dataset.theme === 'dark';
    const q = new URLSearchParams(location.search).get('q') || '';
    const nav = $('#nav');
    if (!nav) return;
    nav.className = 'nav';
    nav.innerHTML = `<div class="wrap nav-in">
      <a class="brand" href="/"><span>Blog</span>Sphere</a>
      <form class="nav-search" action="/" role="search">${icon('search')}<input name="q" value="${esc(q)}" placeholder="Search posts" aria-label="Search posts" maxlength="80"></form>
      <div class="nav-end">
        <button class="btn icon ghost" id="themeBtn" aria-label="Switch to ${dark ? 'light' : 'dark'} theme" title="Theme">${icon(dark ? 'sun' : 'moon')}</button>
        ${u ? `
          <a class="btn primary sm" href="/editor">${icon('pen')}<span class="lbl">Write</span></a>
          <details class="menu"><summary aria-label="Account menu">${avatar(u)}</summary>
            <div class="menu-pop">
              <div class="menu-who"><b>${esc(u.username)}</b><small>${esc(u.email)}</small></div>
              <a href="/u/${encodeURIComponent(u.username)}">${icon('user')} Your profile</a>
              <a href="/dashboard">${icon('grid')} Dashboard</a>
              <a href="/bookmarks">${icon('bookmark')} Saved posts</a>
              <a href="/settings">${icon('gear')} Settings</a>
              <button id="logoutBtn">${icon('out')} Log out</button>
            </div></details>`
        : `<a class="btn ghost sm" href="/login">Log in</a><a class="btn primary sm" href="/register">Sign up</a>`}
      </div></div>`;
    $('#themeBtn').onclick = () => { applyTheme(dark ? 'light' : 'dark'); renderNav(); };
    const lo = $('#logoutBtn');
    if (lo) lo.onclick = async () => { await api('/auth/logout', { method: 'POST' }); location.href = '/'; };
  }

  function renderFooter() {
    const f = $('#footer');
    if (f) f.innerHTML = `<div class="wrap"><span>© ${new Date().getFullYear()} BlogSphere</span><span>Write something worth reading.</span></div>`;
    if (f) f.className = 'footer';
  }

  App.ready = (async () => {
    try { App.user = await api('/auth/me'); } catch { App.user = null; }
    renderNav();
    renderFooter();
    return App.user;
  })();

  // Pages that need a login call this; it redirects to the login page if missing.
  App.require = async () => {
    await App.ready;
    if (!App.user) {
      location.href = '/login?next=' + encodeURIComponent(location.pathname + location.search);
      return new Promise(() => {});
    }
    return App.user;
  };

  // Where to go after login (only same-site paths).
  App.next = () => {
    const n = new URLSearchParams(location.search).get('next');
    return n && n.startsWith('/') && !n.startsWith('//') ? n : '/dashboard';
  };

  // ---------- post row ----------
  function postRow(p, { manage = false } = {}) {
    const a = p.author || {};
    const href = `/p/${encodeURIComponent(p.slug)}`;
    return `<article class="row ${p.coverImage ? '' : 'nocover'}" data-id="${esc(p._id)}">
      <div>
        <div class="by">${avatar(a, 'sm')}<a href="/u/${encodeURIComponent(a.username || '')}">${esc(a.username || 'unknown')}</a>
          <span class="meta">${p.status === 'draft' ? '<span class="badge draft">Draft</span>' : `<span>${dateFmt(p.publishedAt || p.createdAt)}</span>`}</span></div>
        <div class="category-pill" style="display:inline-flex;margin-top:8px">${esc(p.category || 'General')}</div><h2><a href="${href}">${esc(p.title)}</a></h2>
        <p>${esc(p.excerpt)}</p>
        <div class="meta">
          <span>${icon('clock')} ${p.readingTime} min read</span>
          <span class="${p.liked ? 'on' : ''}">${icon('heart', p.liked ? 'filled' : '')} ${num(p.likesCount)}</span>
          <span>${icon('comment')} ${num(p.commentsCount)}</span>
          ${manage ? `<span>${icon('eye')} ${num(p.views)}</span>` : ''}
          ${p.tags.slice(0, 3).map((t) => `<a class="tag" href="/?tag=${encodeURIComponent(t)}">${esc(t)}</a>`).join('')}
        </div>
        ${manage ? `<div class="row-actions">
          <a class="btn sm" href="/editor?id=${esc(p._id)}">${icon('pen')} Edit</a>
          <button class="btn sm danger" data-del="${esc(p._id)}" data-title="${esc(p.title)}">${icon('trash')} Delete</button></div>` : ''}
      </div>
      ${p.coverImage ? `<a href="${href}" tabindex="-1" aria-hidden="true"><img class="thumb" src="${esc(p.coverImage)}" alt="" loading="lazy"></a>` : ''}
    </article>`;
  }

  function pager(el, data, onGo) {
    if (data.pages <= 1) { el.innerHTML = ''; return; }
    el.innerHTML = `<button class="btn sm" ${data.page <= 1 ? 'disabled' : ''} data-go="${data.page - 1}">Previous</button>
      <span>Page ${data.page} of ${data.pages}</span>
      <button class="btn sm" ${data.page >= data.pages ? 'disabled' : ''} data-go="${data.page + 1}">Next</button>`;
    el.onclick = (e) => {
      const b = e.target.closest('[data-go]');
      if (b && !b.disabled) onGo(Number(b.dataset.go));
    };
  }

  const skeleton = (n = 3) => Array.from({ length: n }, () => '<div class="skeleton"></div>').join('');

  window.App = Object.assign(App, { $, $$, esc, api, icon, dateFmt, ago, num, avatar, toast, confirmBox, postRow, pager, skeleton, renderNav });
})();
