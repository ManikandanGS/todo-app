/**
 * Luminate — Premium Todo App
 * Core Logic: State · LocalStorage · DOM Rendering · Events
 */

// ─── State ────────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'luminate_tasks';

let state = {
  tasks: [],
  filter: 'all', // 'all' | 'active' | 'completed'
  editingId: null,
};

// ─── LocalStorage Helpers ─────────────────────────────────────────────────────
function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasks));
  } catch (e) {
    console.warn('LocalStorage unavailable:', e);
  }
}

function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) state.tasks = JSON.parse(raw);
  } catch (e) {
    state.tasks = [];
  }
}

// ─── DOM References ───────────────────────────────────────────────────────────
const taskInput       = document.getElementById('task-input');
const addBtn          = document.getElementById('add-btn');
const taskList        = document.getElementById('task-list');
const emptyState      = document.getElementById('empty-state');
const footerActions   = document.getElementById('footer-actions');
const itemsLeft       = document.getElementById('items-left');
const clearCompletedBtn = document.getElementById('clear-completed-btn');

const totalCount  = document.getElementById('total-count');
const activeCount = document.getElementById('active-count');
const doneCount   = document.getElementById('done-count');

const filterBtns  = document.querySelectorAll('.filter-btn');

// Modal
const editModal    = document.getElementById('edit-modal');
const editInput    = document.getElementById('edit-input');
const saveEditBtn  = document.getElementById('save-edit-btn');
const cancelEditBtn = document.getElementById('cancel-edit-btn');

// Toast
const toast = document.getElementById('toast');
let toastTimer = null;

// ─── Utilities ────────────────────────────────────────────────────────────────
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function sanitize(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function showToast(message, duration = 2400) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), duration);
}

// ─── Rendering ────────────────────────────────────────────────────────────────
function getFilteredTasks() {
  switch (state.filter) {
    case 'active':    return state.tasks.filter(t => !t.completed);
    case 'completed': return state.tasks.filter(t =>  t.completed);
    default:          return state.tasks;
  }
}

function updateStats() {
  const total     = state.tasks.length;
  const completed = state.tasks.filter(t => t.completed).length;
  const active    = total - completed;

  animateNumber(totalCount,  parseInt(totalCount.textContent)  || 0, total);
  animateNumber(activeCount, parseInt(activeCount.textContent) || 0, active);
  animateNumber(doneCount,   parseInt(doneCount.textContent)   || 0, completed);
}

function animateNumber(el, from, to) {
  if (from === to) return;
  const diff = to - from;
  const steps = Math.min(Math.abs(diff), 12);
  let step = 0;
  const interval = setInterval(() => {
    step++;
    el.textContent = Math.round(from + (diff * step / steps));
    if (step >= steps) { el.textContent = to; clearInterval(interval); }
  }, 25);
}

function updateFooter() {
  const active    = state.tasks.filter(t => !t.completed).length;
  const completed = state.tasks.filter(t =>  t.completed).length;
  const hasAny    = state.tasks.length > 0;

  footerActions.style.display = hasAny ? 'flex' : 'none';
  itemsLeft.textContent = `${active} item${active !== 1 ? 's' : ''} left`;
  clearCompletedBtn.style.display = completed > 0 ? '' : 'none';
}

function createTaskElement(task) {
  const li = document.createElement('li');
  li.className = `task-item${task.completed ? ' completed' : ''}`;
  li.dataset.id = task.id;
  li.setAttribute('role', 'listitem');

  li.innerHTML = `
    <input
      type="checkbox"
      class="task-checkbox"
      id="check-${task.id}"
      aria-label="Mark task complete"
      ${task.completed ? 'checked' : ''}
    />
    <span class="task-text" title="${sanitize(task.text)}">${sanitize(task.text)}</span>
    <div class="task-actions" role="group" aria-label="Task actions">
      <button class="task-action-btn edit-btn" aria-label="Edit task" title="Edit">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
      </button>
      <button class="task-action-btn delete-btn" aria-label="Delete task" title="Delete">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
          <path d="M10 11v6M14 11v6"></path>
          <path d="M9 6V4h6v2"></path>
        </svg>
      </button>
    </div>
  `;

  // Checkbox toggle
  const checkbox = li.querySelector('.task-checkbox');
  checkbox.addEventListener('change', () => toggleTask(task.id));

  // Edit button
  li.querySelector('.edit-btn').addEventListener('click', () => openEditModal(task.id));

  // Delete button
  li.querySelector('.delete-btn').addEventListener('click', () => deleteTask(task.id, li));

  return li;
}

function render() {
  const filtered = getFilteredTasks();

  // Clear list
  taskList.innerHTML = '';

  if (filtered.length === 0) {
    emptyState.removeAttribute('aria-hidden');
    emptyState.style.display = 'flex';
  } else {
    emptyState.setAttribute('aria-hidden', 'true');
    emptyState.style.display = 'none';

    filtered.forEach(task => {
      const el = createTaskElement(task);
      taskList.appendChild(el);
    });
  }

  updateStats();
  updateFooter();
}

// ─── Task Operations ──────────────────────────────────────────────────────────
function addTask(text) {
  const trimmed = text.trim();
  if (!trimmed) {
    showToast('⚠️ Please enter a task.');
    return false;
  }
  if (trimmed.length > 200) {
    showToast('⚠️ Task is too long (max 200 chars).');
    return false;
  }

  const task = { id: genId(), text: trimmed, completed: false, createdAt: Date.now() };
  state.tasks.unshift(task);
  saveTasks();

  // If not on "completed" filter, render and animate the new item
  if (state.filter !== 'completed') {
    render();
    const el = taskList.querySelector(`[data-id="${task.id}"]`);
    if (el) {
      el.classList.add('entering');
      el.addEventListener('animationend', () => el.classList.remove('entering'), { once: true });
    }
  } else {
    updateStats();
    updateFooter();
  }

  showToast('✅ Task added!');
  return true;
}

function toggleTask(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  task.completed = !task.completed;
  saveTasks();

  // Animate out if filter means item should disappear
  const el = taskList.querySelector(`[data-id="${id}"]`);
  if (!el) return;

  const willDisappear =
    (state.filter === 'active' && task.completed) ||
    (state.filter === 'completed' && !task.completed);

  if (willDisappear) {
    el.classList.add('removing');
    el.addEventListener('animationend', () => { el.remove(); updateStats(); updateFooter(); checkEmpty(); }, { once: true });
  } else {
    el.classList.toggle('completed', task.completed);
    const checkbox = el.querySelector('.task-checkbox');
    if (checkbox) checkbox.checked = task.completed;
    updateStats();
    updateFooter();
  }
}

function deleteTask(id, el) {
  el.classList.add('removing');
  el.addEventListener('animationend', () => {
    state.tasks = state.tasks.filter(t => t.id !== id);
    saveTasks();
    el.remove();
    updateStats();
    updateFooter();
    checkEmpty();
    showToast('🗑️ Task deleted.');
  }, { once: true });
}

function checkEmpty() {
  const filtered = getFilteredTasks();
  if (filtered.length === 0) {
    emptyState.removeAttribute('aria-hidden');
    emptyState.style.display = 'flex';
  }
}

function clearCompleted() {
  const completedIds = state.tasks.filter(t => t.completed).map(t => t.id);
  if (!completedIds.length) return;

  // Animate out each completed visible item
  completedIds.forEach(id => {
    const el = taskList.querySelector(`[data-id="${id}"]`);
    if (el) {
      el.classList.add('removing');
      el.addEventListener('animationend', () => el.remove(), { once: true });
    }
  });

  state.tasks = state.tasks.filter(t => !t.completed);
  saveTasks();

  setTimeout(() => {
    updateStats();
    updateFooter();
    checkEmpty();
  }, 320);

  showToast(`🧹 Cleared ${completedIds.length} completed task${completedIds.length !== 1 ? 's' : ''}.`);
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────
function openEditModal(id) {
  state.editingId = id;
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  editInput.value = task.text;
  editModal.removeAttribute('hidden');
  editInput.focus();
  editInput.select();
}

function closeEditModal() {
  editModal.setAttribute('hidden', '');
  state.editingId = null;
  editInput.value = '';
}

function saveEdit() {
  if (!state.editingId) return;
  const newText = editInput.value.trim();
  if (!newText) { showToast('⚠️ Task cannot be empty.'); return; }

  const task = state.tasks.find(t => t.id === state.editingId);
  if (task) {
    task.text = newText;
    saveTasks();
    // Update text in DOM without full re-render
    const el = taskList.querySelector(`[data-id="${task.id}"] .task-text`);
    if (el) { el.textContent = newText; el.title = newText; }
    showToast('✏️ Task updated!');
  }
  closeEditModal();
}

// ─── Filter ───────────────────────────────────────────────────────────────────
function setFilter(filter) {
  state.filter = filter;
  filterBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.filter === filter));
  render();
}

// ─── Event Listeners ──────────────────────────────────────────────────────────

// Add task
addBtn.addEventListener('click', () => {
  const success = addTask(taskInput.value);
  if (success) taskInput.value = '';
});

taskInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const success = addTask(taskInput.value);
    if (success) taskInput.value = '';
  }
});

// Filter
filterBtns.forEach(btn => {
  btn.addEventListener('click', () => setFilter(btn.dataset.filter));
});

// Clear completed
clearCompletedBtn.addEventListener('click', clearCompleted);

// Edit modal buttons
saveEditBtn.addEventListener('click', saveEdit);
cancelEditBtn.addEventListener('click', closeEditModal);

editInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') saveEdit();
  if (e.key === 'Escape') closeEditModal();
});

// Close modal on backdrop click
editModal.addEventListener('click', (e) => {
  if (e.target === editModal) closeEditModal();
});

// ─── Init ─────────────────────────────────────────────────────────────────────
(function init() {
  loadTasks();
  render();

  // Seed demo tasks on first ever load
  if (state.tasks.length === 0) {
    const demos = [
      'Build something amazing today 🚀',
      'Review the project implementation plan',
      'Add glassmorphism effects to the UI ✨',
    ];
    demos.forEach(text => {
      state.tasks.push({ id: genId(), text, completed: false, createdAt: Date.now() });
    });
    state.tasks[2].completed = true; // mark last one done
    saveTasks();
    render();
  }
})();
