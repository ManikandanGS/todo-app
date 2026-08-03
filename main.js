/**
 * Luminate — Premium Todo App
 * Core Logic: State · LocalStorage · DOM Rendering · Events
 */

import { STORAGE_KEY, parseStoredTasks } from './storage.js';

// ─── State ────────────────────────────────────────────────────────────────────
let state = {
  tasks: [],
  filter: 'all', // 'all' | 'active' | 'completed'
  editingId: null,
};

/** True only when LocalStorage key was never set (first visit). */
let isFirstVisit = false;

/** Element that opened the edit modal, for focus restore. */
let editTriggerEl = null;

// ─── LocalStorage Helpers ─────────────────────────────────────────────────────
function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasks));
    return true;
  } catch (e) {
    console.warn('LocalStorage unavailable:', e);
    showToast('Could not save — storage is unavailable.');
    return false;
  }
}

function loadTasks() {
  let raw = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (e) {
    console.warn('LocalStorage unavailable:', e);
    state.tasks = [];
    isFirstVisit = false;
    return;
  }

  const { tasks, missing } = parseStoredTasks(raw);
  state.tasks = tasks;
  isFirstVisit = missing;
}

// ─── DOM References ───────────────────────────────────────────────────────────
const taskInput       = document.getElementById('task-input');
const addBtn          = document.getElementById('add-btn');
const taskList        = document.getElementById('task-list');
const emptyState      = document.getElementById('empty-state');
const emptyTitle      = document.querySelector('.empty-title');
const emptySubtitle   = document.querySelector('.empty-subtitle');
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

/** @type {WeakMap<Element, number>} */
const numberAnimTimers = new WeakMap();

// ─── Utilities ────────────────────────────────────────────────────────────────
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function showToast(message, duration = 2400) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), duration);
}

function svgIcon(paths) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = paths;
  return svg;
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

  animateNumber(totalCount,  parseInt(totalCount.textContent, 10)  || 0, total);
  animateNumber(activeCount, parseInt(activeCount.textContent, 10) || 0, active);
  animateNumber(doneCount,   parseInt(doneCount.textContent, 10)   || 0, completed);
}

function animateNumber(el, from, to) {
  if (from === to) {
    el.textContent = String(to);
    return;
  }

  const prev = numberAnimTimers.get(el);
  if (prev) clearInterval(prev);

  const diff = to - from;
  const steps = Math.min(Math.abs(diff), 12);
  let step = 0;
  const interval = setInterval(() => {
    step++;
    el.textContent = String(Math.round(from + (diff * step / steps)));
    if (step >= steps) {
      el.textContent = String(to);
      clearInterval(interval);
      numberAnimTimers.delete(el);
    }
  }, 25);
  numberAnimTimers.set(el, interval);
}

function updateFooter() {
  const active    = state.tasks.filter(t => !t.completed).length;
  const completed = state.tasks.filter(t =>  t.completed).length;
  const hasAny    = state.tasks.length > 0;

  footerActions.style.display = hasAny ? 'flex' : 'none';
  itemsLeft.textContent = `${active} item${active !== 1 ? 's' : ''} left`;
  clearCompletedBtn.style.display = completed > 0 ? '' : 'none';
}

function updateEmptyStateCopy() {
  if (state.filter === 'active') {
    emptyTitle.textContent = 'No active tasks';
    emptySubtitle.textContent = 'Everything is done — or add a new task above.';
  } else if (state.filter === 'completed') {
    emptyTitle.textContent = 'No completed tasks';
    emptySubtitle.textContent = 'Finish a task to see it here.';
  } else {
    emptyTitle.textContent = 'Nothing here yet';
    emptySubtitle.textContent = 'Add your first task above to get started.';
  }
}

function createTaskElement(task) {
  const li = document.createElement('li');
  li.className = `task-item${task.completed ? ' completed' : ''}`;
  li.dataset.id = task.id;
  li.setAttribute('role', 'listitem');

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'task-checkbox';
  checkbox.id = `check-${task.id}`;
  checkbox.setAttribute('aria-label', 'Mark task complete');
  checkbox.checked = task.completed;

  const text = document.createElement('span');
  text.className = 'task-text';
  text.textContent = task.text;
  text.title = task.text;

  const actions = document.createElement('div');
  actions.className = 'task-actions';
  actions.setAttribute('role', 'group');
  actions.setAttribute('aria-label', 'Task actions');

  const editBtn = document.createElement('button');
  editBtn.className = 'task-action-btn edit-btn';
  editBtn.setAttribute('aria-label', 'Edit task');
  editBtn.title = 'Edit';
  editBtn.appendChild(svgIcon(
    '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>' +
    '<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>'
  ));

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'task-action-btn delete-btn';
  deleteBtn.setAttribute('aria-label', 'Delete task');
  deleteBtn.title = 'Delete';
  deleteBtn.appendChild(svgIcon(
    '<polyline points="3 6 5 6 21 6"></polyline>' +
    '<path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>' +
    '<path d="M10 11v6M14 11v6"></path>' +
    '<path d="M9 6V4h6v2"></path>'
  ));

  actions.append(editBtn, deleteBtn);
  li.append(checkbox, text, actions);

  checkbox.addEventListener('change', () => toggleTask(task.id));
  editBtn.addEventListener('click', () => openEditModal(task.id, editBtn));
  deleteBtn.addEventListener('click', () => deleteTask(task.id, li));

  return li;
}

function render() {
  const filtered = getFilteredTasks();

  taskList.replaceChildren();

  if (filtered.length === 0) {
    updateEmptyStateCopy();
    emptyState.removeAttribute('aria-hidden');
    emptyState.style.display = 'flex';
  } else {
    emptyState.setAttribute('aria-hidden', 'true');
    emptyState.style.display = 'none';

    filtered.forEach(task => {
      taskList.appendChild(createTaskElement(task));
    });
  }

  updateStats();
  updateFooter();
}

// ─── Task Operations ──────────────────────────────────────────────────────────
function addTask(text) {
  const trimmed = text.trim();
  if (!trimmed) {
    showToast('Please enter a task.');
    return false;
  }
  if (trimmed.length > 200) {
    showToast('Task is too long (max 200 chars).');
    return false;
  }

  const task = { id: genId(), text: trimmed, completed: false, createdAt: Date.now() };
  state.tasks.unshift(task);
  if (!saveTasks()) {
    state.tasks.shift();
    return false;
  }

  if (state.filter !== 'completed') {
    render();
    const el = taskList.querySelector(`[data-id="${CSS.escape(task.id)}"]`);
    if (el) {
      el.classList.add('entering');
      el.addEventListener('animationend', () => el.classList.remove('entering'), { once: true });
    }
  } else {
    updateStats();
    updateFooter();
  }

  showToast('Task added!');
  return true;
}

function toggleTask(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  const previous = task.completed;
  task.completed = !task.completed;
  if (!saveTasks()) {
    task.completed = previous;
    const el = taskList.querySelector(`[data-id="${CSS.escape(id)}"]`);
    const checkbox = el?.querySelector('.task-checkbox');
    if (checkbox) checkbox.checked = previous;
    return;
  }

  const el = taskList.querySelector(`[data-id="${CSS.escape(id)}"]`);
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
  const previous = state.tasks;
  state.tasks = state.tasks.filter(t => t.id !== id);
  if (!saveTasks()) {
    state.tasks = previous;
    showToast('Could not delete — storage is unavailable.');
    return;
  }

  el.classList.add('removing');
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    el.remove();
    updateStats();
    updateFooter();
    checkEmpty();
  };

  el.addEventListener('animationend', finish, { once: true });
  // Fallback if animationend never fires (e.g. reduced motion / display none)
  setTimeout(finish, 400);
  showToast('Task deleted.');
}

function checkEmpty() {
  const filtered = getFilteredTasks();
  if (filtered.length === 0) {
    updateEmptyStateCopy();
    emptyState.removeAttribute('aria-hidden');
    emptyState.style.display = 'flex';
  }
}

function clearCompleted() {
  const completedIds = state.tasks.filter(t => t.completed).map(t => t.id);
  if (!completedIds.length) return;

  const previous = state.tasks;
  state.tasks = state.tasks.filter(t => !t.completed);
  if (!saveTasks()) {
    state.tasks = previous;
    return;
  }

  completedIds.forEach(id => {
    const el = taskList.querySelector(`[data-id="${CSS.escape(id)}"]`);
    if (el) {
      el.classList.add('removing');
      el.addEventListener('animationend', () => el.remove(), { once: true });
    }
  });

  setTimeout(() => {
    updateStats();
    updateFooter();
    checkEmpty();
  }, 320);

  showToast(`Cleared ${completedIds.length} completed task${completedIds.length !== 1 ? 's' : ''}.`);
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────
function openEditModal(id, triggerEl) {
  state.editingId = id;
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  editTriggerEl = triggerEl || null;
  editInput.value = task.text;
  editModal.removeAttribute('hidden');
  editInput.focus();
  editInput.select();
}

function closeEditModal() {
  editModal.setAttribute('hidden', '');
  state.editingId = null;
  editInput.value = '';
  if (editTriggerEl && typeof editTriggerEl.focus === 'function') {
    editTriggerEl.focus();
  }
  editTriggerEl = null;
}

function saveEdit() {
  if (!state.editingId) return;
  const newText = editInput.value.trim();
  if (!newText) { showToast('Task cannot be empty.'); return; }

  const task = state.tasks.find(t => t.id === state.editingId);
  if (task) {
    const previous = task.text;
    task.text = newText;
    if (!saveTasks()) {
      task.text = previous;
      return;
    }
    const el = taskList.querySelector(`[data-id="${CSS.escape(task.id)}"] .task-text`);
    if (el) { el.textContent = newText; el.title = newText; }
    showToast('Task updated!');
  }
  closeEditModal();
}

// ─── Filter ───────────────────────────────────────────────────────────────────
function setFilter(filter) {
  state.filter = filter;
  filterBtns.forEach(btn => {
    const active = btn.dataset.filter === filter;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  render();
}

// ─── Event Listeners ──────────────────────────────────────────────────────────

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

filterBtns.forEach(btn => {
  btn.addEventListener('click', () => setFilter(btn.dataset.filter));
  btn.setAttribute('aria-pressed', btn.classList.contains('active') ? 'true' : 'false');
});

clearCompletedBtn.addEventListener('click', clearCompleted);

saveEditBtn.addEventListener('click', saveEdit);
cancelEditBtn.addEventListener('click', closeEditModal);

editInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') saveEdit();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !editModal.hasAttribute('hidden')) {
    e.preventDefault();
    closeEditModal();
  }
});

editModal.addEventListener('click', (e) => {
  if (e.target === editModal) closeEditModal();
});

// ─── Init ─────────────────────────────────────────────────────────────────────
(function init() {
  loadTasks();

  // Seed demo tasks only on first visit (storage key missing), not when the list is empty
  if (isFirstVisit) {
    const demos = [
      'Build something amazing today',
      'Review the project implementation plan',
      'Add glassmorphism effects to the UI',
    ];
    demos.forEach(text => {
      state.tasks.push({ id: genId(), text, completed: false, createdAt: Date.now() });
    });
    state.tasks[2].completed = true;
    saveTasks();
  }

  render();
})();
