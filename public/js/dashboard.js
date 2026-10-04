(async function () {
  const { $, $$, api, esc, postRow, pager, skeleton, toast, confirmBox } = App;
  await App.require();
  let status = 'all', page = 1;

  async function load() {
    $('#list').innerHTML = skeleton(2);
    try {
      const data = await api(`/posts/mine?page=${page}&limit=10${status !== 'all' ? '&status=' + status : ''}`);
      const s = data.stats;
      $('#stats').innerHTML = [
        [s.published, 'Published'], [s.drafts, 'Drafts'], [App.num(s.views), 'Views'], [App.num(s.likes), 'Likes'], [App.num(s.comments), 'Comments']
      ].map(([n, l]) => `<div class="stat"><b>${n}</b><span>${l}</span></div>`).join('');
      if (!data.items.length) {
        $('#list').innerHTML = `<div class="empty"><h3>${status === 'draft' ? 'No drafts' : 'Nothing here yet'}</h3><p>Posts you write will show up here.</p><a class="btn primary" href="/editor">Write a post</a></div>`;
        $('#pager').innerHTML = '';
        return;
      }
      $('#list').innerHTML = data.items.map((p) => postRow(p, { manage: true })).join('');
      pager($('#pager'), data, (n) => { page = n; load(); });
    } catch (e) {
      $('#list').innerHTML = `<div class="empty"><h3>Could not load your posts</h3><p>${esc(e.message)}</p></div>`;
    }
  }

  $('#filters').onclick = (e) => {
    const b = e.target.closest('[data-s]');
    if (!b) return;
    status = b.dataset.s; page = 1;
    $$('#filters button').forEach((x) => x.classList.toggle('on', x === b));
    load();
  };

  $('#list').onclick = async (e) => {
    const b = e.target.closest('[data-del]');
    if (!b) return;
    const ok = await confirmBox({ title: 'Delete this post?', text: `“${b.dataset.title}” and its comments will be removed for good.`, ok: 'Delete post', danger: true });
    if (!ok) return;
    try {
      await api('/posts/' + b.dataset.del, { method: 'DELETE' });
      toast('Post deleted');
      load();
    } catch (ex) { toast(ex.message, true); }
  };
  load();
})();
