// ── Storage ───────────────────────────────────────
const STORAGE_KEY = 'focus_tasks';

function loadTasks() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveTasks(tasks) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  syncToSupabase(tasks); // background sync — no-op if not configured
}

function createTask(title, description, duration) {
  return {
    id:        crypto.randomUUID(),
    title,
    description,
    duration,
    done:      false,
    outcome:   null,
    createdAt: Date.now(),
  };
}

// ── Navigation ────────────────────────────────────
const navBtns = document.querySelectorAll('.nav-btn');
const views   = document.querySelectorAll('.view');

navBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.view;
    navBtns.forEach(b => b.classList.remove('active'));
    views.forEach(v => v.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`view-${target}`).classList.add('active');
  });
});

// ── Filter state ──────────────────────────────────
let activeFilter = 'all';

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeFilter = btn.dataset.filter;
    renderTasks();
  });
});

// ── Helpers ───────────────────────────────────────
const DURATION_LABEL = { '30min': '⚡ 30 min', '2h': '🔥 2 hours', '1day': '🌊 1 day' };

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getFileCategory(dataUrl) {
  if (!dataUrl) return null;
  if (dataUrl.startsWith('data:image/'))            return 'image';
  if (dataUrl.startsWith('data:video/'))            return 'video';
  if (dataUrl.startsWith('data:application/pdf'))   return 'pdf';
  if (dataUrl.includes('spreadsheet') || dataUrl.includes('excel') || dataUrl.includes('csv')) return 'sheet';
  if (dataUrl.includes('presentation') || dataUrl.includes('powerpoint')) return 'slides';
  if (dataUrl.includes('word') || dataUrl.includes('msword')) return 'doc';
  if (dataUrl.startsWith('data:text/'))             return 'text';
  return 'file';
}

const FILE_BADGE = {
  image:  null,
  video:  '▶ video',
  pdf:    '📄 pdf',
  sheet:  '📊 spreadsheet',
  slides: '📑 slides',
  doc:    '📝 document',
  text:   '📝 text',
  file:   '📎 file',
};

function validateFile(file) {
  if (!file) return true;
  const limitMb  = file.type.startsWith('video/') ? 3 : 5;
  if (file.size > limitMb * 1024 * 1024) {
    alert(`File exceeds ${limitMb} MB. Please choose a smaller file.`);
    return false;
  }
  return true;
}

async function readFileAsBase64(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = ev => resolve(ev.target.result);
    reader.readAsDataURL(file);
  });
}

function buildCard(task) {
  const card = document.createElement('div');
  card.className = 'task-card' + (task.done ? ' task-card--done' : '');
  card.dataset.id = task.id;

  const category  = task.done ? getFileCategory(task.outcome?.image) : null;
  const badgeText = category ? FILE_BADGE[category] : null;
  const thumbHtml = category === 'image'
    ? `<img class="card-thumbnail" src="${task.outcome.image}" alt="outcome thumbnail" />`
    : badgeText
    ? `<span class="card-file-badge">${badgeText}</span>`
    : '';

  card.innerHTML = `
    <div class="task-card-main">
      <div class="task-card-info">
        <span class="task-badge">${DURATION_LABEL[task.duration]}</span>
        <h3 class="task-title">${escapeHtml(task.title)}</h3>
        ${task.description ? `<p class="task-desc">${escapeHtml(task.description)}</p>` : ''}
        ${thumbHtml}
      </div>
      <div class="task-card-actions">
        ${!task.done ? `<button class="btn-check" data-id="${task.id}" title="Mark as done">✓</button>` : ''}
        <button class="btn-delete" data-id="${task.id}" title="Delete task">✕</button>
      </div>
    </div>
  `;
  return card;
}

// ── Toast ─────────────────────────────────────────
let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

// ── Duration counts ───────────────────────────────
function updateDurationCounts() {
  const tasks = loadTasks();
  ['30min', '2h', '1day'].forEach(d => {
    const n   = tasks.filter(t => t.duration === d && !t.done).length;
    const el  = document.getElementById(`count-${d}`);
    if (!el) return;
    el.textContent   = n > 0 ? `${n} task${n !== 1 ? 's' : ''}` : 'no tasks';
    el.className     = 'duration-count' + (n === 0 ? ' duration-count--empty' : '');
  });
}

// ── Render ────────────────────────────────────────
function renderTasks() {
  const tasks = loadTasks();

  // Active tasks
  const activeList = document.getElementById('task-list');
  const emptyState = document.getElementById('empty-state');
  activeList.querySelectorAll('.task-card').forEach(el => el.remove());

  const active = tasks.filter(t =>
    !t.done && (activeFilter === 'all' || t.duration === activeFilter)
  );

  emptyState.style.display = active.length === 0 ? '' : 'none';
  active.forEach(t => activeList.appendChild(buildCard(t)));

  // Completed tasks
  const completedList    = document.getElementById('completed-list');
  const completedSection = document.getElementById('completed-section');
  const completedCount   = document.getElementById('completed-count');
  completedList.querySelectorAll('.task-card').forEach(el => el.remove());

  const done = tasks.filter(t => t.done)
    .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));

  completedCount.textContent         = done.length ? `${done.length}` : '';
  completedSection.style.display     = done.length ? '' : 'none';
  const completedEmpty = completedList.querySelector('.completed-empty');
  if (completedEmpty) completedEmpty.style.display = done.length ? 'none' : '';
  done.forEach(t => completedList.appendChild(buildCard(t)));

  // Update duration counts on select view
  updateDurationCounts();
}

// ── Task list events ──────────────────────────────
function removeCardAnimated(id, afterFn) {
  const card = document.querySelector(`.task-card[data-id="${id}"]`);
  if (card) {
    card.classList.add('task-card--removing');
    card.addEventListener('animationend', afterFn, { once: true });
  } else {
    afterFn();
  }
}

function handleListClick(e) {
  const deleteBtn = e.target.closest('.btn-delete');
  if (deleteBtn) {
    const id = deleteBtn.dataset.id;
    removeCardAnimated(id, () => {
      saveTasks(loadTasks().filter(t => t.id !== id));
      renderTasks();
    });
    return;
  }

  const checkBtn = e.target.closest('.btn-check');
  if (checkBtn) {
    const id = checkBtn.dataset.id;
    removeCardAnimated(id, () => completeTask(id, null));
    return;
  }

  const card = e.target.closest('.task-card');
  if (card) {
    const task = loadTasks().find(t => t.id === card.dataset.id);
    if (task) openTaskModal(task);
  }
}

document.getElementById('task-list').addEventListener('click', handleListClick);
document.getElementById('completed-list').addEventListener('click', handleListClick);

// ── Task Detail Modal ─────────────────────────────
const taskModalOverlay = document.getElementById('task-modal-overlay');
let modalTaskId = null;

function openTaskModal(task) {
  modalTaskId = task.id;

  document.getElementById('modal-badge').textContent = DURATION_LABEL[task.duration];
  document.getElementById('modal-title').textContent = task.title;
  document.getElementById('modal-title').classList.toggle('modal-title--done', task.done);

  const descEl = document.getElementById('modal-desc');
  descEl.textContent   = task.description || '';
  descEl.style.display = task.description ? '' : 'none';

  // Outcome display for completed tasks
  const outcomeEl = document.getElementById('modal-outcome');
  outcomeEl.innerHTML = '';
  if (task.done && task.outcome) {
    const { note, link, image } = task.outcome;
    if (note || link || image) {
      const div = document.createElement('div');
      div.className = 'modal-outcome-body';
      if (note)  div.innerHTML += `<p class="modal-outcome-note">${escapeHtml(note)}</p>`;
      if (link)  div.innerHTML += `<a class="outcome-link" href="${escapeHtml(link)}" target="_blank" rel="noopener">${escapeHtml(link)}</a>`;
      if (image) {
        const cat      = getFileCategory(image);
        const fileName = task.outcome.fileName || `focus-outcome`;
        let   media    = '';
        if (cat === 'image') {
          media = `<img class="modal-outcome-image" src="${image}" alt="outcome" />`;
        } else if (cat === 'video') {
          media = `<video class="modal-outcome-video" src="${image}" controls playsinline></video>`;
        } else {
          media = `<div class="modal-file-preview">${FILE_BADGE[cat] || '📎'} <span>${escapeHtml(fileName)}</span></div>`;
        }
        div.innerHTML += `
          <div class="modal-image-wrap">
            ${media}
            <a class="btn-download" href="${image}" download="${escapeHtml(fileName)}">↓ Download</a>
          </div>`;
      }
      outcomeEl.appendChild(div);
    }
  }

  // Show/hide mark-as-done section
  const doneSectionEl = document.getElementById('modal-done-section');
  doneSectionEl.style.display = task.done ? 'none' : '';
  resetModalOutcomeForm();

  taskModalOverlay.classList.add('open');
}

function closeTaskModal() {
  taskModalOverlay.classList.remove('open');
  modalTaskId = null;
}

function resetModalOutcomeForm() {
  document.getElementById('modal-done-actions').style.display   = '';
  document.getElementById('modal-outcome-section').classList.remove('open');
  document.getElementById('modal-outcome-note').value  = '';
  document.getElementById('modal-outcome-link').value  = '';
  document.getElementById('modal-outcome-image').value = '';
  document.getElementById('modal-file-upload-text').textContent = 'Attach a file';
}

document.getElementById('modal-mark-done').addEventListener('click', () => {
  document.getElementById('modal-done-actions').style.display = 'none';
  document.getElementById('modal-outcome-section').classList.add('open');
});

document.getElementById('modal-outcome-cancel').addEventListener('click', resetModalOutcomeForm);

document.getElementById('modal-outcome-image').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!validateFile(file)) { e.target.value = ''; return; }
  document.getElementById('modal-file-upload-text').textContent = file ? file.name : 'Attach a file';
});

document.getElementById('modal-outcome-submit').addEventListener('click', async () => {
  if (!modalTaskId) return;

  const note     = document.getElementById('modal-outcome-note').value.trim();
  const link     = document.getElementById('modal-outcome-link').value.trim();
  const file     = document.getElementById('modal-outcome-image').files[0];
  const fileData = file ? await readFileAsBase64(file) : null;

  const outcome = (note || link || fileData)
    ? { note: note || null, link: link || null, image: fileData || null, fileName: file?.name || null }
    : null;

  completeTask(modalTaskId, outcome);
  closeTaskModal();
});

document.getElementById('task-modal-close').addEventListener('click', closeTaskModal);
taskModalOverlay.addEventListener('click', e => {
  if (e.target === taskModalOverlay) closeTaskModal();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeTaskModal();
});

// ── Form submit ───────────────────────────────────
document.getElementById('task-form').addEventListener('submit', e => {
  e.preventDefault();
  const title    = document.getElementById('task-title').value.trim();
  const desc     = document.getElementById('task-desc').value.trim();
  const duration = document.querySelector('input[name="duration"]:checked')?.value;
  if (!title || !duration) return;

  const tasks = loadTasks();
  tasks.unshift(createTask(title, desc, duration));
  saveTasks(tasks);

  document.getElementById('task-form').reset();
  document.getElementById('task-title').focus();
  renderTasks();
  showToast('Task added');
});

// ── Random Selector ───────────────────────────────
const resultWrap     = document.getElementById('result-wrap');
const resultCard     = document.getElementById('result-card');
const resultEmpty    = document.getElementById('result-empty');
const resultTitle    = document.getElementById('result-title');
const resultDesc     = document.getElementById('result-desc');
const resultActions  = document.getElementById('result-actions');
const outcomeSection = document.getElementById('outcome-section');
const pickAnotherBtn = document.getElementById('result-pick-another');
const markDoneBtn    = document.getElementById('result-mark-done');
const outcomeCancel  = document.getElementById('outcome-cancel');
const outcomeSubmit  = document.getElementById('outcome-submit');

let currentDuration = null;
let currentTaskId   = null;

function pickRandom(duration) {
  const pool = loadTasks().filter(t => t.duration === duration && !t.done);
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

function showResult(duration) {
  currentDuration = duration;
  const task = pickRandom(duration);

  resultWrap.classList.add('visible');
  hideOutcomeForm();
  resultCard.classList.remove('result-card--success');
  markDoneBtn.style.display = '';
  pickAnotherBtn.textContent = 'Pick another';

  if (!task) {
    resultCard.style.display  = 'none';
    resultEmpty.style.display = '';
    currentTaskId = null;
    return;
  }

  currentTaskId            = task.id;
  resultCard.style.display  = '';
  resultEmpty.style.display = 'none';
  resultCard.classList.remove('result-card--in');
  void resultCard.offsetWidth;
  resultCard.classList.add('result-card--in');

  resultTitle.textContent  = task.title;
  resultDesc.textContent   = task.description || '';
  resultDesc.style.display = task.description ? '' : 'none';
}

function hideOutcomeForm() {
  outcomeSection.classList.remove('open');
  resultActions.style.display = '';
  document.getElementById('outcome-note').value  = '';
  document.getElementById('outcome-link').value  = '';
  document.getElementById('outcome-image').value = '';
  document.getElementById('file-upload-text').textContent = 'Attach a file';
}

function completeTask(id, outcome) {
  const tasks = loadTasks().map(t =>
    t.id !== id ? t : { ...t, done: true, outcome, completedAt: Date.now() }
  );
  saveTasks(tasks);
  renderTasks();
  showToast('Task completed ✓');
}

document.querySelectorAll('.duration-card').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.duration-card').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    showResult(btn.dataset.duration);
  });
});

pickAnotherBtn.addEventListener('click', () => {
  if (currentDuration) showResult(currentDuration);
});

markDoneBtn.addEventListener('click', () => {
  resultActions.style.display = 'none';
  outcomeSection.classList.add('open');
});

outcomeCancel.addEventListener('click', hideOutcomeForm);

document.getElementById('outcome-image').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!validateFile(file)) { e.target.value = ''; return; }
  document.getElementById('file-upload-text').textContent = file ? file.name : 'Attach a file';
});

outcomeSubmit.addEventListener('click', async () => {
  if (!currentTaskId) return;

  const note     = document.getElementById('outcome-note').value.trim();
  const link     = document.getElementById('outcome-link').value.trim();
  const file     = document.getElementById('outcome-image').files[0];
  const fileData = file ? await readFileAsBase64(file) : null;

  const outcome = (note || link || fileData)
    ? { note: note || null, link: link || null, image: fileData || null, fileName: file?.name || null }
    : null;

  completeTask(currentTaskId, outcome);

  resultCard.classList.add('result-card--success');
  resultTitle.textContent  = 'Done! Great work.';
  resultDesc.style.display = 'none';
  outcomeSection.classList.remove('open');
  resultActions.style.display  = '';
  markDoneBtn.style.display    = 'none';
  pickAnotherBtn.textContent   = 'Pick another task';
  currentTaskId = null;
});

// ── Init ──────────────────────────────────────────
(async () => {
  await syncFromSupabase(); // pull from cloud first (no-op if not configured)
  renderTasks();
})();
