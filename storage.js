/**
 * Luminate — LocalStorage task parsing & validation
 * Treats stored data as untrusted input.
 */

const TASK_ID_PATTERN = /^[\w-]+$/;
const PRIORITIES = new Set(['low', 'medium', 'high']);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isOptionalDueDate(value) {
  return value === undefined || (typeof value === 'number' && Number.isFinite(value));
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isOptionalPriority(value) {
  return value === undefined || (typeof value === 'string' && PRIORITIES.has(value));
}

/**
 * @param {unknown} task
 * @returns {boolean}
 */
export function isValidTask(task) {
  if (!task || typeof task !== 'object') return false;
  const { id, text, completed, priority, dueDate } = /** @type {Record<string, unknown>} */ (task);
  return (
    typeof id === 'string' &&
    TASK_ID_PATTERN.test(id) &&
    typeof text === 'string' &&
    typeof completed === 'boolean' &&
    isOptionalPriority(priority) &&
    isOptionalDueDate(dueDate)
  );
}

/**
 * Parse a LocalStorage raw string into validated tasks.
 * @param {string | null} raw - Result of localStorage.getItem; null means key missing
 * @returns {{ tasks: Array<{id: string, text: string, completed: boolean, createdAt?: number, priority?: string, dueDate?: number}>, missing: boolean }}
 */
export function parseStoredTasks(raw) {
  if (raw === null || raw === undefined) {
    return { tasks: [], missing: true };
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return { tasks: [], missing: false };
    }
    return {
      tasks: parsed.filter(isValidTask),
      missing: false,
    };
  } catch {
    return { tasks: [], missing: false };
  }
}

export const STORAGE_KEY = 'luminate_tasks';
export const SORT_KEY = 'luminate_sort';
