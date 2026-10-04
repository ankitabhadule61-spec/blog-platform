(async function () {
  const { $, api, esc, postRow, pager, skeleton } = App;
  await App.require();
  let page = 1;
  async function load() {
    $('#list').innerHTML = skeleton(2);
    try {
      const data = await api(`/posts/bookmarks?page=${page}&limit=10`);
      if (!data.items.length) {
        $('#list').innerHTML = '<div class="empty"><h3>No saved posts</h3><p>Use the bookmark button on any post to keep it here.</p><a class="btn" href="/">Find something to read</a></div>';
        $('#pager').innerHTML = '';
        return;
      }
      $('#list').innerHTML = data.items.map((p) => postRow(p)).join('');
      pager($('#pager'), data, (n) => { page = n; load(); });
    } catch (e) { $('#list').innerHTML = `<div class="empty"><h3>Could not load saved posts</h3><p>${esc(e.message)}</p></div>`; }
  }
  load();
})();
