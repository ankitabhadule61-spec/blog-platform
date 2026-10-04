(async function () {
  const { $, api, esc, icon, avatar, dateFmt, ago, num, toast, confirmBox } = App;
  await App.ready;
  const slug = decodeURIComponent(location.pathname.split('/').filter(Boolean)[1] || '');
  let post, comments = [];

  function notFound(msg) {
    $('#post').innerHTML = `<div class="empty" style="padding-top:90px"><h3>Post not found</h3><p>${esc(msg || 'It may have been removed or is still a draft.')}</p><a class="btn" href="/">Back to the feed</a></div>`;
  }

  function actionsHtml() {
    return `<div class="actions">
      <button class="act ${post.liked ? 'on' : ''}" id="likeBtn" aria-pressed="${post.liked}" aria-label="Like">${icon('heart')} <span>${num(post.likesCount)}</span></button>
      <a class="act" href="#comments" style="text-decoration:none">${icon('comment')} <span id="ccount">${num(post.commentsCount)}</span></a>
      <button class="act ${post.bookmarked ? 'on' : ''}" id="bmBtn" aria-pressed="${post.bookmarked}" aria-label="Save for later">${icon('bookmark')}</button>
      <button class="act spacer" id="shareBtn" aria-label="Copy link">${icon('link')}</button>
    </div>`;
  }

  function render() {
    const a = post.author || {};
    const mine = App.user && (App.user._id === a._id || App.user.userId === a._id);
    document.title = `${post.title} – BlogSphere`;
    $('#post').innerHTML = `<article class="article">
      ${post.status === 'draft' ? '<p><span class="badge draft">Draft – only you can see this</span></p>' : ''}
      <h1>${esc(post.title)}</h1>
      <div class="by">${avatar(a)}<div><a href="/u/${encodeURIComponent(a.username || '')}">${esc(a.username || 'unknown')}</a>
        <div class="meta"><span>${dateFmt(post.publishedAt || post.createdAt)}</span><span>${icon('clock')} ${post.readingTime} min read</span><span>${icon('eye')} ${num(post.views)}</span></div></div>
        ${mine || (App.user && App.user.role === 'admin') ? `<a class="btn sm" style="margin-left:auto" href="/editor?id=${esc(post._id)}">${icon('pen')} Edit</a>` : ''}</div>
      ${post.coverImage ? `<img class="cover" src="${esc(post.coverImage)}" alt="">` : ''}
      <div class="prose" id="body"></div>
      ${post.tags.length ? `<div class="tags" style="margin-top:28px">${post.tags.map((t) => `<a class="tag" href="/?tag=${encodeURIComponent(t)}">${esc(t)}</a>`).join('')}</div>` : ''}
      ${post.status === 'published' ? actionsHtml() : ''}
      <div class="author-card">${avatar(a, 'lg')}<div><b><a href="/u/${encodeURIComponent(a.username || '')}" style="text-decoration:none">Written by ${esc(a.username || 'unknown')}</a></b>
        <p>${esc(a.bio || 'This writer has not added a bio yet.')}</p></div></div>
    </article>`;
    // Content is sanitized on the server before it is stored.
    $('#body').innerHTML = post.content;
    $('#body').querySelectorAll('img').forEach((i) => (i.loading = 'lazy'));
    wireActions();
  }

  function wireActions() {
    const need = () => {
      if (App.user) return true;
      toast('Log in to do that');
      setTimeout(() => (location.href = '/login?next=' + encodeURIComponent(location.pathname)), 700);
      return false;
    };
    const like = $('#likeBtn');
    if (!like) return;
    like.onclick = async () => {
      if (!need()) return;
      try {
        const r = await api(`/posts/${post._id}/like`, { method: 'POST' });
        like.classList.toggle('on', r.liked);
        like.setAttribute('aria-pressed', r.liked);
        like.querySelector('span').textContent = num(r.likesCount);
      } catch (e) { toast(e.message, true); }
    };
    $('#bmBtn').onclick = async () => {
      if (!need()) return;
      try {
        const r = await api(`/posts/${post._id}/bookmark`, { method: 'POST' });
        $('#bmBtn').classList.toggle('on', r.bookmarked);
        $('#bmBtn').setAttribute('aria-pressed', r.bookmarked);
        toast(r.bookmarked ? 'Saved for later' : 'Removed from saved');
      } catch (e) { toast(e.message, true); }
    };
    $('#shareBtn').onclick = async () => {
      try { await navigator.clipboard.writeText(location.href); toast('Link copied'); }
      catch { toast('Copy the link from the address bar', true); }
    };
  }

  // ---------- comments ----------
  const form = (id, { text = '', parent = '', label = 'Post comment' } = {}) => `<form class="c-form" data-form="${id}" data-parent="${parent}">
      <textarea class="input" maxlength="2000" placeholder="Write a comment…" aria-label="Comment" required>${esc(text)}</textarea>
      <div class="bar">${id !== 'new' ? '<button type="button" class="btn sm" data-cancel>Cancel</button>' : ''}<button class="btn sm primary" type="submit">${label}</button></div></form>`;

  function commentHtml(c, byParent) {
    const kids = byParent[c._id] || [];
    return `<div class="c" id="c-${c._id}" data-id="${c._id}">
      <div class="c-body">${avatar(c.author, 'sm')}
        <div class="c-text">
          <div class="c-head"><a href="/u/${encodeURIComponent(c.author.username)}">${esc(c.author.username)}</a><small>${ago(c.createdAt)}${c.edited ? ' · edited' : ''}</small></div>
          <p data-text>${esc(c.text)}</p>
          <div class="c-tools">
            ${post.status === 'published' ? `<button data-act="reply">${icon('reply')} Reply</button>` : ''}
            ${c.canEdit ? `<button data-act="edit">${icon('pen')} Edit</button>` : ''}
            ${c.canDelete ? `<button data-act="delete">${icon('trash')} Delete</button>` : ''}
          </div>
          <div data-slot></div>
        </div></div>
      ${kids.length ? `<div class="c-replies">${kids.map((k) => commentHtml(k, byParent)).join('')}</div>` : ''}
    </div>`;
  }

  function renderComments() {
    const byParent = {};
    const ids = new Set(comments.map((c) => c._id));
    for (const c of comments) {
      const key = c.parentCommentId && ids.has(c.parentCommentId) ? c.parentCommentId : 'root';
      (byParent[key] = byParent[key] || []).push(c);
    }
    $('#ccount') && ($('#ccount').textContent = num(comments.length));
    const roots = byParent.root || [];
    const box = $('#comments');
    box.hidden = false;
    box.innerHTML = `<h2>${comments.length ? `${comments.length} comment${comments.length > 1 ? 's' : ''}` : 'Comments'}</h2>
      ${post.status !== 'published' ? '' : App.user ? form('new') : `<div class="login-nudge"><a href="/login?next=${encodeURIComponent(location.pathname)}">Log in</a> or <a href="/register">sign up</a> to join the conversation.</div>`}
      <div id="clist">${roots.length ? roots.map((c) => commentHtml(c, byParent)).join('') : '<p style="color:var(--ink-3)">No comments yet. Start the conversation.</p>'}</div>`;
  }

  async function reload() {
    comments = await api(`/posts/${post._id}/comments`);
    renderComments();
  }

  document.addEventListener('submit', async (e) => {
    const f = e.target.closest('.c-form');
    if (!f) return;
    e.preventDefault();
    const ta = f.querySelector('textarea');
    const text = ta.value.trim();
    if (!text) return;
    const btn = f.querySelector('[type=submit]');
    btn.disabled = true;
    try {
      if (f.dataset.form === 'new' || f.dataset.form === 'reply') {
        await api(`/posts/${post._id}/comments`, { method: 'POST', body: { text, parentCommentId: f.dataset.parent || undefined } });
      } else {
        await api(`/comments/${f.dataset.form}`, { method: 'PUT', body: { text } });
      }
      await reload();
    } catch (ex) { toast(ex.message, true); btn.disabled = false; }
  });

  document.addEventListener('click', async (e) => {
    const cancel = e.target.closest('[data-cancel]');
    if (cancel) { cancel.closest('[data-slot]').innerHTML = ''; return; }
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const row = b.closest('.c');
    const c = comments.find((x) => x._id === row.dataset.id);
    const slot = row.querySelector('[data-slot]');
    if (b.dataset.act === 'reply') {
      slot.innerHTML = form('reply', { parent: c._id, label: 'Reply' });
      slot.querySelector('textarea').focus();
    } else if (b.dataset.act === 'edit') {
      slot.innerHTML = form(c._id, { text: c.text, label: 'Save' });
      slot.querySelector('textarea').focus();
    } else if (b.dataset.act === 'delete') {
      const ok = await confirmBox({ title: 'Delete this comment?', text: 'Replies to it will be removed too.', ok: 'Delete', danger: true });
      if (!ok) return;
      try { await api(`/comments/${c._id}`, { method: 'DELETE' }); toast('Comment deleted'); await reload(); }
      catch (ex) { toast(ex.message, true); }
    }
  });

  try {
    post = await api('/posts/' + encodeURIComponent(slug));
    render();
    await reload();
    if (location.hash === '#comments') $('#comments').scrollIntoView();
  } catch (e) {
    notFound(e.status === 404 ? '' : e.message);
  }
})();
