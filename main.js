/**
 * Luminate — Premium Todo App
 * Core Logic: State · LocalStorage · DOM Rendering · Events
 */

import { STORAGE_KEY, SORT_KEY, parseStoredTasks } from './storage.js';

const PRIORITY_WEIGHT = { high: 3, medium: 2, low: 1, none: 0 };
const VALID_SORTS = new Set(['newest', 'oldest', 'priority', 'alphabetical', 'dueDate']);

// ─── State ────────────────────────────────────────────────────────────────────
let state = {
  tasks: [],
  filter: 'all', // 'all' | 'active' | 'completed'
  search: '',
  sort: 'newest',
  newPriority: 'none',
  editingId: null,
};

/** True only when LocalStorage key was never set (first visit). */
let isFirstVisit = false;

/** Element that opened the edit modal, for focus restore. */
let editTriggerEl = null;

/** @type {{ task: object, index: number } | null} */
let undoBuffer = null;

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

function saveSort() {
  try {
    localStorage.setItem(SORT_KEY, state.sort);
  } catch (e) {
    console.warn('Could not save sort preference:', e);
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

function loadSort() {
  try {
    const saved = localStorage.getItem(SORT_KEY);
    if (saved && VALID_SORTS.has(saved)) {
      state.sort = saved;
    }
  } catch (e) {
    console.warn('Could not load sort preference:', e);
  }
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
const priorityBtns = document.querySelectorAll('.priority-btn');

const searchInput     = document.getElementById('search-input');
const clearSearchBtn  = document.getElementById('clear-search-btn');
const sortSelect      = document.getElementById('sort-select');

// Modal
const editModal     = document.getElementById('edit-modal');
const editInput     = document.getElementById('edit-input');
const editPriority  = document.getElementById('edit-priority');
const editDueDate   = document.getElementById('edit-due-date');
const saveEditBtn   = document.getElementById('save-edit-btn');
const cancelEditBtn = document.getElementById('cancel-edit-btn');

// Toast
const toast         = document.getElementById('toast');
const toastMessage  = document.getElementById('toast-message');
const toastAction   = document.getElementById('toast-action');
let toastTimer = null;

/** @type {WeakMap<Element, number>} */
const numberAnimTimers = new WeakMap();

// ─── Utilities ────────────────────────────────────────────────────────────────
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function getPriorityWeight(task) {
  return PRIORITY_WEIGHT[task.priority] ?? 0;
}

function startOfDay(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function formatDueDate(ts) {
  const today = startOfDay(Date.now());
  const due = startOfDay(ts);
  const diffDays = Math.round((due - today) / 86400000);

  if (diffDays === 0) return 'Due today';
  if (diffDays === 1) return 'Due tomorrow';
  if (diffDays === -1) return 'Due yesterday';
  if (diffDays < -1) return `${Math.abs(diffDays)} days overdue`;

  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function getDueDateStatus(ts) {
  if (!ts) return '';
  const today = startOfDay(Date.now());
  const due = startOfDay(ts);
  if (due < today) return 'overdue';
  if (due === today) return 'due-today';
  return '';
}

function toDateInputValue(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDateInput(value) {
  if (!value) return undefined;
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d).getTime();
}

function showToast(message, options = {}) {
  const { duration = 2400, actionLabel = null, onAction = null } = options;
  toastMessage.textContent = message;

  if (actionLabel && onAction) {
    toastAction.textContent = actionLabel;
    toastAction.hidden = false;
    toastAction.onclick = () => {
      onAction();
      hideToast();
    };
  } else {
    toastAction.hidden = true;
    toastAction.onclick = null;
  }

  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, duration);
}

function hideToast() {
  toast.classList.remove('show');
  toastAction.hidden = true;
  toastAction.onclick = null;
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

// ─── Filtering & Sorting ──────────────────────────────────────────────────────
function matchesSearch(task) {
  if (!state.search) return true;
  return task.text.toLowerCase().includes(state.search.toLowerCase());
}

function getFilteredTasks() {
  let tasks = state.tasks;

  switch (state.filter) {
    case 'active':    tasks = tasks.filter(t => !t.completed); break;
    case 'completed': tasks = tasks.filter(t =>  t.completed); break;
    default: break;
  }

  if (state.search) {
    tasks = tasks.filter(matchesSearch);
  }

  return sortTasks(tasks);
}

function sortTasks(tasks) {
  const sorted = [...tasks];

  switch (state.sort) {
    case 'oldest':
      sorted.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
      break;
    case 'priority':
      sorted.sort((a, b) => {
        const diff = getPriorityWeight(b) - getPriorityWeight(a);
        if (diff !== 0) return diff;
        return (b.createdAt ?? 0) - (a.createdAt ?? 0);
      });
      break;
    case 'alphabetical':
      sorted.sort((a, b) => a.text.localeCompare(b.text, undefined, { sensitivity: 'base' }));
      break;
    case 'dueDate':
      sorted.sort((a, b) => {
        const aDue = a.dueDate ?? Infinity;
        const bDue = b.dueDate ?? Infinity;
        if (aDue !== bDue) return aDue - bDue;
        return (b.createdAt ?? 0) - (a.createdAt ?? 0);
      });
      break;
    case 'newest':
    default:
      sorted.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
      break;
  }

  return sorted;
}

// ─── Rendering ────────────────────────────────────────────────────────────────
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
  if (state.search) {
    emptyTitle.textContent = 'No matching tasks';
    emptySubtitle.textContent = 'Try a different search term or clear the search.';
    return;
  }

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

function createPriorityBadge(priority) {
  if (!priority || priority === 'none') return null;
  const badge = document.createElement('span');
  badge.className = `priority-badge priority-${priority}`;
  badge.textContent = priority;
  return badge;
}

function createDueDateBadge(task) {
  if (!task.dueDate) return null;
  const status = getDueDateStatus(task.dueDate);
  const badge = document.createElement('span');
  badge.className = `due-date-badge${status ? ` ${status}` : ''}`;
  badge.textContent = formatDueDate(task.dueDate);
  return badge;
}

function createTaskElement(task) {
  const li = document.createElement('li');
  const overdue = !task.completed && getDueDateStatus(task.dueDate) === 'overdue';
  li.className = `task-item${task.completed ? ' completed' : ''}${overdue ? ' overdue' : ''}`;
  li.dataset.id = task.id;
  li.setAttribute('role', 'listitem');

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'task-checkbox';
  checkbox.id = `check-${task.id}`;
  checkbox.setAttribute('aria-label', 'Mark task complete');
  checkbox.checked = task.completed;

  const content = document.createElement('div');
  content.className = 'task-content';

  const text = document.createElement('span');
  text.className = 'task-text';
  text.textContent = task.text;
  text.title = task.text;

  const meta = document.createElement('div');
  meta.className = 'task-meta';
  const priorityBadge = createPriorityBadge(task.priority);
  const dueBadge = createDueDateBadge(task);
  if (priorityBadge) meta.appendChild(priorityBadge);
  if (dueBadge) meta.appendChild(dueBadge);

  content.append(text);
  if (meta.childElementCount > 0) content.appendChild(meta);

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
  li.append(checkbox, content, actions);

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
  clearSearchBtn.hidden = !state.search;
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

  const priority = state.newPriority === 'none' ? undefined : state.newPriority;
  const task = {
    id: genId(),
    text: trimmed,
    completed: false,
    createdAt: Date.now(),
    ...(priority ? { priority } : {}),
  };

  state.tasks.unshift(task);
  if (!saveTasks()) {
    state.tasks.shift();
    return false;
  }

  undoBuffer = null;

  if (state.filter !== 'completed' && matchesSearch(task)) {
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
    el.classList.toggle('overdue', !task.completed && getDueDateStatus(task.dueDate) === 'overdue');
    const checkbox = el.querySelector('.task-checkbox');
    if (checkbox) checkbox.checked = task.completed;
    updateStats();
    updateFooter();
  }
}

function deleteTask(id, el) {
  const index = state.tasks.findIndex(t => t.id === id);
  if (index === -1) return;

  const removed = state.tasks[index];
  const previous = state.tasks;
  state.tasks = state.tasks.filter(t => t.id !== id);
  if (!saveTasks()) {
    state.tasks = previous;
    showToast('Could not delete — storage is unavailable.');
    return;
  }

  undoBuffer = { task: { ...removed }, index };

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
  setTimeout(finish, 400);

  showToast('Task deleted.', {
    duration: 5000,
    actionLabel: 'Undo',
    onAction: undoDelete,
  });
}

function undoDelete() {
  if (!undoBuffer) return;

  const { task, index } = undoBuffer;
  const insertAt = Math.min(index, state.tasks.length);
  state.tasks.splice(insertAt, 0, task);

  if (!saveTasks()) {
    state.tasks.splice(insertAt, 1);
    showToast('Could not restore — storage is unavailable.');
    return;
  }

  undoBuffer = null;
  render();
  showToast('Task restored.');
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

  undoBuffer = null;

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
  editPriority.value = task.priority || 'none';
  editDueDate.value = toDateInputValue(task.dueDate);
  editModal.removeAttribute('hidden');
  editInput.focus();
  editInput.select();
}

function closeEditModal() {
  editModal.setAttribute('hidden', '');
  state.editingId = null;
  editInput.value = '';
  editPriority.value = 'none';
  editDueDate.value = '';
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
    const previous = {
      text: task.text,
      priority: task.priority,
      dueDate: task.dueDate,
    };

    task.text = newText;
    const priority = editPriority.value;
    if (priority === 'none') {
      delete task.priority;
    } else {
      task.priority = priority;
    }

    const dueDate = parseDateInput(editDueDate.value);
    if (dueDate === undefined) {
      delete task.dueDate;
    } else {
      task.dueDate = dueDate;
    }

    if (!saveTasks()) {
      task.text = previous.text;
      if (previous.priority) task.priority = previous.priority;
      else delete task.priority;
      if (previous.dueDate) task.dueDate = previous.dueDate;
      else delete task.dueDate;
      return;
    }

    render();
    showToast('Task updated!');
  }
  closeEditModal();
}

// ─── Filter, Search & Sort ────────────────────────────────────────────────────
function setFilter(filter) {
  state.filter = filter;
  filterBtns.forEach(btn => {
    const active = btn.dataset.filter === filter;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  render();
}

function setSearch(query) {
  state.search = query.trim();
  render();
}

function setSort(sort) {
  state.sort = sort;
  saveSort();
  render();
}

function setNewPriority(priority) {
  state.newPriority = priority;
  priorityBtns.forEach(btn => {
    const active = btn.dataset.priority === priority;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
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

priorityBtns.forEach(btn => {
  btn.addEventListener('click', () => setNewPriority(btn.dataset.priority));
});

searchInput.addEventListener('input', () => setSearch(searchInput.value));
clearSearchBtn.addEventListener('click', () => {
  searchInput.value = '';
  setSearch('');
  searchInput.focus();
});

sortSelect.addEventListener('change', () => setSort(sortSelect.value));

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
  const tag = e.target.tagName;
  const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

  if (e.key === 'Escape' && !editModal.hasAttribute('hidden')) {
    e.preventDefault();
    closeEditModal();
    return;
  }

  if (e.key === '/' && !isTyping && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault();
    searchInput.focus();
    searchInput.select();
  }
});

editModal.addEventListener('click', (e) => {
  if (e.target === editModal) closeEditModal();
});

// ─── Init ─────────────────────────────────────────────────────────────────────
(function init() {
  loadTasks();
  loadSort();
  sortSelect.value = state.sort;

  if (isFirstVisit) {
    const demos = [
      { text: 'Build something amazing today', priority: 'high' },
      { text: 'Review the project implementation plan', priority: 'medium' },
      { text: 'Add glassmorphism effects to the UI', priority: 'low' },
    ];
    const tomorrow = startOfDay(Date.now()) + 86400000;
    demos.forEach(({ text, priority }, i) => {
      state.tasks.push({
        id: genId(),
        text,
        completed: false,
        createdAt: Date.now() - i * 1000,
        priority,
        ...(i === 0 ? { dueDate: tomorrow } : {}),
      });
    });
    state.tasks[2].completed = true;
    saveTasks();
  }

  render();
})();
