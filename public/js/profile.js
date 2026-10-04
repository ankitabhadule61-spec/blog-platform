(async function () {
  const { $, api, esc, avatar, dateFmt, postRow, pager, skeleton, toast } = App;
  await App.ready;
  const username = decodeURIComponent(location.pathname.split('/').filter(Boolean)[1] || '');
  let page = 1;

  try {
    const u = await api('/users/' + encodeURIComponent(username));
    document.title = `${u.username} – BlogSphere`;
    $('#head').innerHTML = `<div class="profile-head">${avatar(u, 'lg')}<div>
      <h1>${esc(u.username)}</h1>${u.bio ? `<p>${esc(u.bio)}</p>` : ''}
      <div class="meta" style="margin-top:10px"><span>${u.stats.posts} posts</span><span>${App.num(u.stats.likes)} likes</span><span>${App.num(u.stats.views)} views</span><span>Joined ${dateFmt(u.createdAt)}</span></div>
      ${App.user && App.user.username === u.username
        ? '<a class="btn sm" style="margin-top:12px" href="/settings">Edit profile</a>'
        : App.user ? `<button class="btn sm primary" id="followBtn" style="margin-top:12px">${u.stats.isFollowing ? 'Following' : 'Follow'}</button>` : '<a class="btn sm primary" style="margin-top:12px" href="/login">Follow</a>'}
    </div></div>`;
  } catch (e) {
    $('#head').innerHTML = `<div class="empty" style="padding-top:90px"><h3>${e.status === 404 ? 'No writer by that name' : 'Could not load profile'}</h3><p>${esc(e.message)}</p><a class="btn" href="/">Back to the feed</a></div>`;
    $('.tabs').hidden = true;
    return;
  }

  const followBtn = $('#followBtn');
  if (followBtn) followBtn.onclick = async () => {
    followBtn.disabled = true;
    try {
      const r = await api(`/users/${encodeURIComponent(username)}/follow`, { method: 'POST' });
      followBtn.textContent = r.following ? 'Following' : 'Follow';
      toast(r.following ? 'You are now following ' + u.username : 'Unfollowed ' + u.username);
    } catch (e) { toast(e.message, true); }
    finally { followBtn.disabled = false; }
  };

  async function load() {
    $('#list').innerHTML = skeleton(2);
    const data = await api(`/posts?author=${encodeURIComponent(username)}&page=${page}&limit=8`);
    $('#list').innerHTML = data.items.length
      ? data.items.map((p) => postRow(p)).join('')
      : '<div class="empty"><h3>No posts yet</h3><p>Nothing published so far.</p></div>';
    pager($('#pager'), data, (n) => { page = n; load(); scrollTo({ top: 0 }); });
  }
  load();
})();
