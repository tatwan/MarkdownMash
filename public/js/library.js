// My library: saved Mashes a host keeps to host again.
// Loads after admin.js and relies on its top-level declarations; classic
// deferred scripts share one global scope, so nothing is re-declared here.

const homeLibraryBtn = document.getElementById('home-library-btn');
const libraryGrid = document.getElementById('library-grid');
const libraryEmpty = document.getElementById('library-empty');
const libraryStatus = document.getElementById('library-status');
const libraryFilterButtons = document.querySelectorAll('[data-library-filter]');
const libraryAddBtn = document.getElementById('library-add-btn');
const libraryEmptyAddBtn = document.getElementById('library-empty-add-btn');
const libraryBackBtn = document.getElementById('library-back-btn');

const libraryEditorModal = document.getElementById('library-editor-modal');
const libraryEditorTitle = document.getElementById('library-editor-title');
const libraryEditorName = document.getElementById('library-editor-name');
const libraryEditorKind = document.getElementById('library-editor-kind');
const libraryEditorTarget = document.getElementById('library-editor-target');
const libraryEditorTargetUpdate = document.getElementById('library-editor-target-update');
const libraryEditorMarkdownField = document.getElementById('library-editor-markdown-field');
const libraryEditorMarkdown = document.getElementById('library-editor-markdown');
const libraryEditorStatus = document.getElementById('library-editor-status');
const libraryEditorSave = document.getElementById('library-editor-save');
const libraryEditorCancel = document.getElementById('library-editor-cancel');
const libraryEditorClose = document.getElementById('library-editor-close');

const LIBRARY_KIND_LABEL = Object.freeze({ quiz: 'Quiz', survey: 'Survey' });

let libraryItems = [];
let libraryFilter = 'all';
// 'add' | 'edit' | 'studio'. 'studio' is wired in the studio integration.
let libraryEditorMode = 'add';
let libraryEditing = null; // { id, kind } while editing an existing item

// --- transport ---------------------------------------------------------

async function libraryFetchJson(url, options = {}) {
  const response = await authFetch(url, options);
  const data = await response.json().catch(() => null);
  if (response.status === 401) throw new Error('Session expired. Please log in again.');
  if (!response.ok || !data?.success) {
    throw new Error(data?.error || `Server error (${response.status})`);
  }
  return data;
}

function libraryJsonOptions(method, body) {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}

async function createLibraryItem(name, kind, markdown) {
  const data = await libraryFetchJson('/api/admin/library', libraryJsonOptions('POST', {
    name,
    kind,
    markdownBase64: encodeMarkdownBase64(markdown)
  }));
  return data.item;
}

async function updateLibraryItem(id, name, markdown) {
  const data = await libraryFetchJson(`/api/admin/library/${id}`, libraryJsonOptions('PUT', {
    name,
    markdownBase64: encodeMarkdownBase64(markdown)
  }));
  return data.item;
}

async function fetchLibraryItem(id) {
  const data = await libraryFetchJson(`/api/admin/library/${id}`);
  return data.item;
}

// --- status helpers ----------------------------------------------------

function showLibraryStatus(message, isSuccess) {
  libraryStatus.textContent = message;
  libraryStatus.className = `status-message mt-4 ${isSuccess ? 'success' : 'error'}`;
}

function hideLibraryStatus() {
  libraryStatus.classList.add('hidden');
}

function showEditorStatus(message, isSuccess) {
  libraryEditorStatus.textContent = message;
  libraryEditorStatus.className = `status-message ${isSuccess ? 'success' : 'error'}`;
}

// --- rendering ---------------------------------------------------------

function formatLibraryDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString();
}

function libraryCardMeta(item) {
  const count = `${item.questionCount} question${item.questionCount === 1 ? '' : 's'}`;
  return `${count} · Updated ${formatLibraryDate(item.updatedAt)}`;
}

function buildKindBadge(kind) {
  const badge = document.createElement('span');
  badge.className = `session-type-badge session-type-${kind}`;
  badge.textContent = LIBRARY_KIND_LABEL[kind] || kind;
  return badge;
}

function libraryButton(label, className, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
}

function buildLibraryCard(item) {
  const card = document.createElement('article');
  card.className = 'library-card';

  const head = document.createElement('div');
  head.className = 'library-card-head';
  head.appendChild(buildKindBadge(item.kind));

  const name = document.createElement('h3');
  name.textContent = item.name;

  const meta = document.createElement('p');
  meta.className = 'text-muted';
  meta.textContent = libraryCardMeta(item);

  const actions = document.createElement('div');
  actions.className = 'library-card-actions';
  actions.append(
    libraryButton('Host this', 'btn btn-small btn-primary', () => hostLibraryItem(item)),
    libraryButton('Edit', 'btn btn-small btn-secondary', () => openLibraryEditor(item)),
    libraryButton('Delete', 'btn btn-small btn-danger', () => deleteLibraryItem(item))
  );

  card.append(head, name, meta, actions);
  return card;
}

function renderLibrary() {
  libraryGrid.replaceChildren();
  libraryEmpty.classList.toggle('hidden', libraryItems.length > 0);

  const visible = libraryFilter === 'all'
    ? libraryItems
    : libraryItems.filter(item => item.kind === libraryFilter);

  if (libraryItems.length > 0 && visible.length === 0) {
    const note = document.createElement('p');
    note.className = 'text-muted library-filter-empty';
    note.textContent = libraryFilter === 'survey' ? 'No saved surveys yet.' : 'No saved quizzes yet.';
    libraryGrid.appendChild(note);
    return;
  }

  for (const item of visible) {
    libraryGrid.appendChild(buildLibraryCard(item));
  }
}

async function loadLibrary() {
  hideLibraryStatus();
  try {
    const data = await libraryFetchJson('/api/admin/library');
    libraryItems = data.items;
    renderLibrary();
  } catch (error) {
    console.error('Library load failed:', error);
    showLibraryStatus(error.message || 'Could not load your library.', false);
  }
}

function showLibrary() {
  instructorHomeSection.classList.add('hidden');
  uploadSection.classList.add('hidden');
  liveWorkspace.classList.add('hidden');
  analyticsSection.classList.add('hidden');
  sessionDetailSection.classList.add('hidden');
  librarySection.classList.remove('hidden');
  studioTitleLabel.textContent = 'My library';
  loadLibrary();
  document.getElementById('library-heading')?.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --- editor modal ------------------------------------------------------

function setEditorKind(kind, locked) {
  libraryEditorKind.querySelectorAll('input[name="library-kind"]').forEach(input => {
    input.checked = input.value === kind;
    input.disabled = locked;
  });
}

function editorKind() {
  return libraryEditorKind.querySelector('input[name="library-kind"]:checked')?.value || 'quiz';
}

function resetEditorChrome() {
  libraryEditorStatus.classList.add('hidden');
  libraryEditorTarget.classList.add('hidden');
  libraryEditorMarkdownField.classList.remove('hidden');
  libraryEditorSave.disabled = false;
}

async function openLibraryEditor(item = null) {
  resetEditorChrome();
  if (item) {
    libraryEditorMode = 'edit';
    libraryEditing = { id: item.id, kind: item.kind };
    libraryEditorTitle.textContent = 'Edit saved Mash';
    libraryEditorName.value = item.name;
    setEditorKind(item.kind, true);
    libraryEditorMarkdown.value = '';
    libraryEditorSave.disabled = true;
    libraryEditorModal.classList.remove('hidden');
    try {
      const full = await fetchLibraryItem(item.id);
      libraryEditorMarkdown.value = full.markdown;
    } catch (error) {
      showEditorStatus(error.message, false);
    } finally {
      libraryEditorSave.disabled = false;
    }
  } else {
    libraryEditorMode = 'add';
    libraryEditing = null;
    libraryEditorTitle.textContent = 'Add to library';
    libraryEditorName.value = '';
    setEditorKind('quiz', false);
    libraryEditorMarkdown.value = '';
    libraryEditorModal.classList.remove('hidden');
  }
  libraryEditorName.focus({ preventScroll: true });
}

function closeLibraryEditor() {
  libraryEditorModal.classList.add('hidden');
  libraryEditing = null;
}

async function saveLibraryEditor() {
  const name = libraryEditorName.value.trim();
  if (!name) {
    showEditorStatus('Give this Mash a name', false);
    libraryEditorName.focus({ preventScroll: true });
    return;
  }

  libraryEditorSave.disabled = true;
  try {
    if (libraryEditorMode === 'studio') {
      await saveStudioDraft(name);
      return;
    }

    const markdown = libraryEditorMarkdown.value;
    if (!markdown.trim()) {
      showEditorStatus('Paste some Markdown first', false);
      return;
    }
    const saved = libraryEditorMode === 'edit'
      ? await updateLibraryItem(libraryEditing.id, name, markdown)
      : await createLibraryItem(name, editorKind(), markdown);
    if (loadedLibraryItem?.id === saved.id) {
      loadedLibraryItem = { id: saved.id, name: saved.name, kind: saved.kind };
    }
    closeLibraryEditor();
    await loadLibrary();
    showLibraryStatus(`Saved "${saved.name}".`, true);
  } catch (error) {
    showEditorStatus(error.message || 'Could not save.', false);
  } finally {
    libraryEditorSave.disabled = false;
  }
}

// Defined in the studio integration; declared here so saveLibraryEditor
// can reference it before that section exists.
async function saveStudioDraft() {
  throw new Error('Save to library is not available yet');
}

async function deleteLibraryItem(item) {
  const confirmed = await showConfirmModal({
    title: `Delete "${item.name}"?`,
    message: 'This removes it from your library. Past sessions are not affected.',
    confirmText: 'Delete',
    cancelText: 'Keep it',
    danger: true
  });
  if (!confirmed) return;
  try {
    await libraryFetchJson(`/api/admin/library/${item.id}`, { method: 'DELETE' });
    if (loadedLibraryItem?.id === item.id) loadedLibraryItem = null;
    await loadLibrary();
    showLibraryStatus(`Deleted "${item.name}".`, true);
  } catch (error) {
    showLibraryStatus(error.message || 'Could not delete.', false);
  }
}

// --- host this ---------------------------------------------------------

function loadMarkdownIntoStudio(item) {
  switchStudioMode(item.kind);
  quizMarkdown.value = item.markdown;
  studioDrafts[item.kind] = item.markdown;
  loadedLibraryItem = { id: item.id, name: item.name, kind: item.kind };
}

async function hostLibraryItem(item) {
  if (sessionCode) {
    showLibraryStatus('End your live room before hosting another Mash.', false);
    return;
  }
  try {
    const full = await fetchLibraryItem(item.id);
    loadMarkdownIntoStudio(full);
    showInstructorStudio(item.kind);
    showStatus('upload-status', `Loaded "${item.name}" from your library. Edit anything you like, then open the room.`, true);
    builderHeading.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (error) {
    showLibraryStatus(error.message || 'Could not load that Mash.', false);
  }
}

// --- wiring ------------------------------------------------------------

homeLibraryBtn?.addEventListener('click', showLibrary);
libraryBackBtn?.addEventListener('click', showInstructorHome);
libraryAddBtn?.addEventListener('click', () => openLibraryEditor(null));
libraryEmptyAddBtn?.addEventListener('click', () => openLibraryEditor(null));

libraryFilterButtons.forEach(button => {
  button.addEventListener('click', () => {
    libraryFilter = button.dataset.libraryFilter || 'all';
    libraryFilterButtons.forEach(other => other.classList.toggle('active', other === button));
    renderLibrary();
  });
});

libraryEditorSave?.addEventListener('click', saveLibraryEditor);
libraryEditorCancel?.addEventListener('click', closeLibraryEditor);
libraryEditorClose?.addEventListener('click', closeLibraryEditor);
libraryEditorModal?.addEventListener('click', event => {
  if (event.target === libraryEditorModal) closeLibraryEditor();
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !libraryEditorModal?.classList.contains('hidden')) {
    closeLibraryEditor();
  }
});
