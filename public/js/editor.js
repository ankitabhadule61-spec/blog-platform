(async function () {
  const { $, api, esc, toast } = App;
  await App.require();

  const id = new URLSearchParams(location.search).get('id');
  let current = null;          // post being edited
  let cover = '';
  let dirty = false;

  const quill = new Quill('#editor', {
    theme: 'snow',
    placeholder: 'Tell your story…',
    modules: {
      toolbar: {
        container: [
          [{ header: [2, 3, false] }],
          ['bold', 'italic', 'underline', 'strike'],
          [{ list: 'ordered' }, { list: 'bullet' }],
          ['blockquote', 'code-block', 'link', 'image'],
          [{ align: [] }],
          ['clean']
        ],
        handlers: { image: pickInlineImage }
      }
    }
  });

  async function upload(file) {
    const fd = new FormData();
    fd.append('image', file);
    return (await api('/upload', { method: 'POST', form: fd })).url;
  }

  function pickInlineImage() {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/png,image/jpeg,image/gif,image/webp';
    inp.onchange = async () => {
      if (!inp.files[0]) return;
      try {
        const url = await upload(inp.files[0]);
        const at = quill.getSelection(true).index;
        quill.insertEmbed(at, 'image', url, 'user');
        quill.setSelection(at + 1);
      } catch (e) { toast(e.message, true); }
    };
    inp.click();
  }

  function showCover() {
    $('#coverPrev').innerHTML = cover ? `<img src="${esc(cover)}" alt="Cover preview">` : 'No image';
    $('#coverClear').hidden = !cover;
  }
  $('#coverFile').onchange = async (e) => {
    if (!e.target.files[0]) return;
    try { cover = await upload(e.target.files[0]); showCover(); dirty = true; }
    catch (ex) { toast(ex.message, true); }
    e.target.value = '';
  };
  $('#coverClear').onclick = () => { cover = ''; showCover(); dirty = true; };

  if (id) {
    try {
      current = await api('/posts/' + id);
      $('#title').value = current.title;
      $('#tags').value = current.tags.join(', ');
      $('#category').value = current.category || 'General';
      quill.root.innerHTML = current.content;
      cover = current.coverImage;
      showCover();
      $('#state').textContent = current.status === 'draft' ? 'Editing draft' : 'Editing published post';
      $('#publishBtn').textContent = current.status === 'draft' ? 'Publish' : 'Update';
      $('#draftBtn').hidden = current.status === 'published';
      document.title = 'Edit – BlogSphere';
    } catch (e) {
      $('#state').textContent = 'Could not open this post';
      toast(e.message, true);
      return;
    }
  }
  setTimeout(() => { dirty = false; quill.on('text-change', () => (dirty = true)); $('#title').addEventListener('input', () => (dirty = true)); }, 0);

  async function save(status) {
    const err = $('#err');
    err.hidden = true;
    const body = {
      title: $('#title').value.trim(),
      content: quill.root.innerHTML,
      tags: $('#tags').value,
      category: $('#category').value,
      coverImage: cover,
      status
    };
    if (body.title.length < 3) { err.textContent = 'Add a title of at least 3 characters.'; err.hidden = false; $('#title').focus(); return; }
    if (quill.getText().trim().length < 10 && !quill.root.querySelector('img')) { err.textContent = 'Write a little more before saving – the post body is too short.'; err.hidden = false; return; }
    const btns = [$('#draftBtn'), $('#publishBtn')];
    btns.forEach((b) => (b.disabled = true));
    try {
      const saved = current
        ? await api('/posts/' + current._id, { method: 'PUT', body })
        : await api('/posts', { method: 'POST', body });
      dirty = false;
      if (status === 'draft') {
        toast('Draft saved');
        current = saved;
        history.replaceState(null, '', '/editor?id=' + saved._id);
        $('#state').textContent = 'Editing draft';
        btns.forEach((b) => (b.disabled = false));
      } else {
        toast(current && current.status === 'published' ? 'Post updated' : 'Post published');
        setTimeout(() => (location.href = '/p/' + saved.slug), 500);
      }
    } catch (e) {
      err.textContent = e.message;
      err.hidden = false;
      btns.forEach((b) => (b.disabled = false));
    }
  }
  $('#draftBtn').onclick = () => save('draft');
  $('#publishBtn').onclick = () => save('published');

  addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
})();
