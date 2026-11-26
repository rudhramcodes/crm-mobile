// Where tapping a notification goes. The item it is about (referenceModel + referenceId) decides first, so a
// missing or odd server link still lands on the right screen; the server link is only a fallback, and only
// for app paths this app knows. Types and models: server/src/modules/notifications/notification.constants.js.

// Staff: one detail screen per reference model.
const STAFF_ITEM = {
  Task: (id) => `/tasks/${id}`,
  Project: (id) => `/projects/${id}`,
  Lead: (id) => `/leads/${id}`,
  Client: (id) => `/clients/${id}`,
  Invoice: (id) => `/invoices/${id}`,
  Payment: (id) => `/payments/${id}`,
  Meeting: (id) => `/meetings/${id}`,
};

// Types whose screen doesn't depend on the item (or whose item has no screen of its own).
const STAFF_TYPE = {
  task_deleted: '/tasks',
  regularization_request: '/attendance/regularization',
  regularization_approved: '/attendance',
  regularization_rejected: '/attendance',
  leave_applied: '/attendance/leaves',
  leave_approved: '/attendance/leaves',
  leave_rejected: '/attendance/leaves',
  leave_cancelled: '/attendance/leaves',
};

// First path segments a server link may open. Anything else (an unknown or absolute web URL) goes to the inbox.
const STAFF_SECTIONS = [
  'tasks', 'projects', 'leads', 'clients', 'invoices', 'payments', 'meetings', 'quotations', 'attendance',
  'reports', 'users', 'teams', 'freelancers', 'settings', 'notifications', 'payroll', 'my-payslips',
];

// Keep only "/section/..." paths (web links may carry the site address); returns null for anything else.
export const appPath = (link) => {
  if (!link || typeof link !== 'string') return null;
  const path = link.replace(/^https?:\/\/[^/]+/i, '').trim();
  return path.startsWith('/') && !path.startsWith('//') ? path : null;
};
const section = (path) => path.split(/[/?#]/)[1] ?? '';

export function staffRoute({ type: rawType, link, referenceModel, referenceId } = {}) {
  const type = typeof rawType === 'string' ? rawType : '';
  if (STAFF_TYPE[type]) return STAFF_TYPE[type];
  if (referenceId && STAFF_ITEM[referenceModel]) return STAFF_ITEM[referenceModel](referenceId);
  const path = appPath(link);
  if (path === '/dashboard' || path === '/') return '/';
  if (path && STAFF_SECTIONS.includes(section(path))) return path;
  if (type.startsWith('regularization_')) return '/attendance';
  return '/notifications';
}

// Clients only have the portal: tasks and projects open their portal pages, meetings and invoices their tabs.
export function clientRoute({ link, referenceModel, referenceId } = {}) {
  if (referenceId && referenceModel === 'Task') return `/portal/tasks/${referenceId}`;
  if (referenceId && referenceModel === 'Project') return `/portal/projects/${referenceId}`;
  if (referenceModel === 'Meeting') return '/portal/meetings';
  if (referenceModel === 'Invoice' || referenceModel === 'Payment') return '/portal/invoices';
  const path = appPath(link);
  if (path?.startsWith('/portal')) return path;
  const m = path?.match(/^\/(tasks|projects)\/([A-Za-z0-9]+)/);
  if (m) return `/portal/${m[1]}/${m[2]}`;
  if (path && /^\/(meetings|invoices)\b/.test(path)) return `/portal/${section(path)}`;
  return '/portal/notifications';
}

export const notificationRoute = (n, { client = false } = {}) => (client ? clientRoute(n) : staffRoute(n));
