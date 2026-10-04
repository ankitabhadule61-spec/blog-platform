(async function () {
  const { $, api } = App;
  const user = await App.ready;
  if (user) { location.replace(App.next()); return; }

  const isRegister = !!$('input[name=username]');
  const next = new URLSearchParams(location.search).get('next');
  if (next) $('#alt').href += '?next=' + encodeURIComponent(next);

  $('#form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    const err = $('#err');
    err.hidden = true;
    const body = Object.fromEntries(new FormData(e.target));
    btn.disabled = true;
    try {
      await api(isRegister ? '/auth/register' : '/auth/login', { method: 'POST', body });
      location.href = App.next();
    } catch (ex) {
      err.textContent = ex.message;
      err.hidden = false;
      btn.disabled = false;
    }
  });
})();
