import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { TASK_PRIORITY, TASK_STATUS } from '@/constants';
import { getPref, setPref } from './prefs';
import { ymd } from './attendance';
import { showWorkTimer } from '@/services/liveActivity';

export const taskStatus = (v) => TASK_STATUS.find((s) => s.value === v) || TASK_STATUS[0];
export const taskPriority = (v) => TASK_PRIORITY.find((p) => p.value === v) || TASK_PRIORITY[1];
export const idOf = (x) => String(x?._id || x || '');

// Same rules as the server (server/src/modules/tasks/taskRules.js; the table is in TASKS-FLOW.md "Who can do what"):
// - managers of a task (creator, reviewer, manager/admin roles) plan it: title, priority, people, dependencies
// - the owner and helpers work it: status, progress, checklist, time, details, due date with a reason
// - everyone else follows and chats; only the reviewer marks Done (the creator unless review was handed over)
export const isCreator = (task, user) => !!user?._id && idOf(task?.createdBy) === String(user._id);
export const reviewerOf = (task) => task?.reviewer || task?.createdBy;
export const canReview = (task, user) => !!user?._id && idOf(reviewerOf(task)) === String(user._id);
export const finishStatus = (task, user) => (canReview(task, user) ? 'done' : 'review');
export const canManageTask = (task, user) => !!user?._id && (isCreator(task, user) || idOf(task?.reviewer) === String(user._id) || ['manager', 'admin', 'super_admin'].includes(user?.role));
export const isOnTask = (task, user) => !!user?._id && [task?.assignedTo, ...(task?.helpers || [])].some((p) => idOf(p) === String(user._id));
export const canWorkTask = (task, user) => canManageTask(task, user) || isOnTask(task, user);

// The 1-office-hour review clock, as words: "32 min left", "late by 1h 5m", "due 10:30 am, Tue".
export const reviewClock = (task, now = Date.now()) => {
  if (task?.status !== 'review' || !task.reviewDueAt) return null;
  const ms = new Date(task.reviewDueAt) - now;
  const span = (m) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`);
  if (ms < 0) return { late: true, label: `Review late by ${span(Math.max(1, Math.round(-ms / 60e3)))}` };
  if (ms <= 61 * 60e3) return { late: false, label: `${Math.max(1, Math.round(ms / 60e3))} min left to review` };
  const due = new Date(task.reviewDueAt);
  return { late: false, label: `Review due ${due.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}, ${due.toLocaleDateString('en-IN', { weekday: 'short' })}` };
};
// Late only while it's still with the doer: in review it waits on the reviewer (who has their own clock).
export const isOverdue = (t) => !!t.dueDate && !['done', 'review'].includes(t.status) && ymd(t.dueDate) < ymd();
export const dueLabel = (d) => {
  if (!d) return 'No due date';
  const day = ymd(d);
  const today = ymd();
  if (day === today) return 'Today';
  if (day === ymd(Date.now() + 864e5)) return 'Tomorrow';
  if (day === ymd(Date.now() - 864e5)) return 'Yesterday';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

// "@[Asha](64f…)" mentions read as "@Asha".
export const plainMentions = (text = '') => text.replace(/@\[([^\]]+)\]\([a-f0-9]{24}\)/g, '@$1');

// My Day buckets. In-progress work counts as today; tasks in review wait on the reviewer, so they never count as overdue.
// Done means done today; anything else open with a later (or no) date is upcoming.
export const myDay = (tasks) => {
  const today = ymd();
  const due = (t) => (t.dueDate ? ymd(t.dueDate) : null);
  const open = tasks.filter((t) => t.status !== 'done' && t.status !== 'review');
  const overdue = open.filter((t) => due(t) && due(t) < today);
  const todays = open.filter((t) => !overdue.includes(t) && (due(t) === today || t.status === 'in_progress'));
  return {
    overdue,
    today: todays,
    upcoming: open.filter((t) => !overdue.includes(t) && !todays.includes(t)),
    waiting: tasks.filter((t) => t.status === 'review'),
    done: tasks.filter((t) => t.status === 'done' && ymd(t.completedAt || t.updatedAt) === today),
  };
};

const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
export const tasksCsv = (tasks) => {
  const head = ['ID', 'Title', 'Status', 'Priority', 'Project', 'Assignee', 'Due Date', 'Estimated Hours', 'Actual Hours', 'Checklist Progress', 'Tags', 'Created At'];
  const rows = tasks.map((t) => [
    t._id, t.title, t.status, t.priority, t.project?.title || 'General', t.assignedTo?.name || 'Unassigned',
    t.dueDate ? ymd(t.dueDate) : '', t.estimatedHours || 0, t.actualHours || 0,
    `${t.checklists?.filter((c) => c.checked).length || 0}/${t.checklists?.length || 0}`,
    (t.tags || []).join(', '), t.createdAt ? new Date(t.createdAt).toISOString().slice(0, 16).replace('T', ' ') : '',
  ].map(cell).join(','));
  return [head.join(','), ...rows].join('\n');
};

// Phone: a real .csv through the share sheet. Web: a download.
export async function shareCsv(tasks) {
  const name = `tasks-${ymd()}.csv`;
  const csv = tasksCsv(tasks);
  if (Platform.OS === 'web') {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = name;
    a.click();
    return;
  }
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.writeSync(csv);
  await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Export tasks', UTI: 'public.comma-separated-values-text' });
}

// One stopwatch at a time, stored as {taskId, title, startedAt} so it keeps counting while the app is closed.
const WATCH_KEY = 'task-stopwatch';
export const getStopwatch = async () => {
  try { return JSON.parse((await getPref(WATCH_KEY)) || 'null'); } catch { return null; }
};
export const setStopwatch = (v) => {
  // Also shown in the Dynamic Island / Lock Screen while it runs.
  showWorkTimer('task', v ? { title: v.title, sub: 'Stopwatch running', start: v.startedAt, taskId: v.taskId } : null);
  return setPref(WATCH_KEY, v ? JSON.stringify(v) : null);
};
