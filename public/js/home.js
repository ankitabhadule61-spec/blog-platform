(async function () {
  const { $, $$, api, esc, postRow, pager, skeleton } = App;
  await App.ready;

  const state = (() => {
    const p = new URLSearchParams(location.search);
    return { q: p.get('q') || '', tag: p.get('tag') || '', sort: p.get('sort') || 'latest', page: Number(p.get('page')) || 1 };
  })();

  function syncUrl() {
    const p = new URLSearchParams();
    if (state.q) p.set('q', state.q);
    if (state.tag) p.set('tag', state.tag);
    if (state.sort !== 'latest') p.set('sort', state.sort);
    if (state.page > 1) p.set('page', state.page);
    history.replaceState(null, '', p.toString() ? '?' + p : location.pathname);
  }

  function renderHead() {
    const h = $('#head');
    if (state.q) h.innerHTML = `<h1>Results for “${esc(state.q)}”</h1><p><a href="/">Clear search</a></p>`;
    else if (state.tag) h.innerHTML = `<h1>#${esc(state.tag)}</h1><p><a href="/">Show all posts</a></p>`;
  }

  async function load() {
    syncUrl();
    $$('#sorts button').forEach((b) => b.classList.toggle('on', b.dataset.sort === state.sort));
    $('#list').innerHTML = skeleton();
    try {
      const qs = new URLSearchParams({ page: state.page, limit: 8, sort: state.sort });
      if (state.q) qs.set('q', state.q);
      if (state.tag) qs.set('tag', state.tag);
      const data = await api('/posts?' + qs);
      if (!data.items.length) {
        $('#list').innerHTML = state.q || state.tag
          ? `<div class="empty"><h3>Nothing matches yet</h3><p>Try a different word, or browse all posts.</p><a class="btn" href="/">Browse all posts</a></div>`
          : `<div class="empty"><h3>No posts yet</h3><p>Be the first to publish something.</p><a class="btn primary" href="${App.user ? '/editor' : '/register'}">${App.user ? 'Write a post' : 'Create an account'}</a></div>`;
        $('#pager').innerHTML = '';
        return;
      }
      $('#list').innerHTML = data.items.map((p) => postRow(p)).join('');
      pager($('#pager'), data, (n) => { state.page = n; load(); scrollTo({ top: 0, behavior: 'smooth' }); });
    } catch (e) {
      $('#list').innerHTML = `<div class="empty"><h3>Could not load posts</h3><p>${esc(e.message)}</p><button class="btn" id="retry">Try again</button></div>`;
      $('#retry').onclick = load;
    }
  }

  async function loadTags() {
    try {
      const tags = await api('/posts/tags');
      $('#tags').innerHTML = tags.length
        ? tags.map((t) => `<a class="tag ${t.name === state.tag ? 'on' : ''}" href="/?tag=${encodeURIComponent(t.name)}">${esc(t.name)} <small>${t.count}</small></a>`).join('')
        : '<span style="color:var(--ink-3)">Topics appear as people add tags.</span>';
    } catch { /* sidebar is optional */ }
  }

  $('#sorts').onclick = (e) => {
    const b = e.target.closest('[data-sort]');
    if (b) { state.sort = b.dataset.sort; state.page = 1; load(); }
  };


  function miniCard(p) {
    return `<a class="feature-card" href="/p/${encodeURIComponent(p.slug)}">
      ${p.coverImage ? `<img src="${esc(p.coverImage)}" alt="" loading="lazy">` : '<div class="feature-art">✦</div>'}
      <div class="feature-body"><span class="category-pill">${esc(p.category || 'General')}</span>
      <h3>${esc(p.title)}</h3><p>${esc(p.excerpt)}</p>
      <div class="feature-meta">${esc(p.author?.username || 'Writer')} · ${p.readingTime} min read</div></div>
    </a>`;
  }

  async function loadDiscover() {
    try {
      const [featured, trending] = await Promise.all([api('/posts/featured'), api('/posts/trending')]);
      $('#featured').innerHTML = featured.length ? featured.slice(0, 3).map(miniCard).join('') :
        '<div class="discover-empty">Featured stories will appear here.</div>';
      $('#trending').innerHTML = trending.length ? trending.slice(0, 5).map((p, i) =>
        `<a class="trend-item" href="/p/${encodeURIComponent(p.slug)}"><b>0${i + 1}</b><span>${esc(p.title)}<small>${esc(p.author?.username || 'Writer')} · ${p.views || 0} views</small></span></a>`).join('') :
        '<p class="muted">Start reading to shape the trends.</p>';
    } catch {
      $('#featured').innerHTML = '';
      $('#trending').innerHTML = '';
    }
  }

  renderHead();
  loadDiscover();
  loadTags();
  load();
})();
