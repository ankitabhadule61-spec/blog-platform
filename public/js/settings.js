(async function () {
  const { $, api, avatar, toast, confirmBox } = App;
  const me = await App.require();
  let avatarUrl = me.avatar || '';

  const pf = $('#profileForm');
  pf.username.value = me.username;
  pf.bio.value = me.bio || '';
  const count = () => ($('#bioCount').textContent = `${pf.bio.value.length}/300`);
  pf.bio.oninput = count; count();
  const prev = () => ($('#avatarPrev').innerHTML = avatar({ username: pf.username.value || me.username, avatar: avatarUrl }, 'lg'));
  prev();

  $('#avatarFile').onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const fd = new FormData();
    fd.append('image', f);
    try { avatarUrl = (await api('/upload', { method: 'POST', form: fd })).url; prev(); toast('Photo ready – save your profile to keep it'); }
    catch (ex) { toast(ex.message, true); }
    e.target.value = '';
  };
  $('#avatarClear').onclick = () => { avatarUrl = ''; prev(); };

  pf.onsubmit = async (e) => {
    e.preventDefault();
    try {
      await api('/users/me', { method: 'PUT', body: { username: pf.username.value, bio: pf.bio.value, avatar: avatarUrl } });
      toast('Profile saved');
      App.user = await api('/auth/me');
      App.renderNav();
    } catch (ex) { toast(ex.message, true); }
  };

  $('#pwForm').onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    try {
      await api('/auth/password', { method: 'PUT', body: { currentPassword: f.currentPassword.value, newPassword: f.newPassword.value } });
      toast('Password updated');
      f.reset();
    } catch (ex) { toast(ex.message, true); }
  };

  $('#delForm').onsubmit = async (e) => {
    e.preventDefault();
    const pw = e.target.password.value;
    const ok = await confirmBox({ title: 'Delete your account?', text: 'Your posts and comments will be removed permanently.', ok: 'Delete account', danger: true });
    if (!ok) return;
    try { await api('/auth/account', { method: 'DELETE', body: { password: pw } }); location.href = '/'; }
    catch (ex) { toast(ex.message, true); }
  };
})();
