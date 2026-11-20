import { useEffect, useState } from 'react';
import { View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useSelector } from 'react-redux';
import { Check, CheckSquare, Link2, Lock, MessageSquareWarning, Pause, Play, Plus, RotateCcw, Send, Square, Timer, Trash2, X } from 'lucide-react-native';
import { Avatar } from './Avatar';
import { Button } from './Button';
import { Card } from './Card';
import { Chip } from './Chip';
import { Input } from './Input';
import { Pressable } from './Pressable';
import { Text } from './Text';
import { showToast } from './Toast';
import { UserPicker } from './UserPicker';
import { TaskRow, TaskStatusBadge } from './TaskParts';
import { ImageViewer, MessageFiles } from './TaskChat';
import {
  useAddChecklistItemMutation, useAddDependencyMutation, useAddTimeEntryMutation, useCreateTaskMutation,
  useGetDependenciesQuery, useGetSubtasksQuery, useGetTasksQuery, useRemoveChecklistItemMutation,
  useRemoveDependencyMutation, useRemoveTimeEntryMutation, useUpdateChecklistItemMutation, useUpdateTaskMutation,
} from '@/services/taskApi';
import { useTheme } from '@/constants/theme';
import { hms, runAction } from '@/utils/attendance';
import { formatHours, getTimeAgo } from '@/utils/formatters';
import { canManageTask, canReview, canWorkTask, getStopwatch, idOf, reviewClock, reviewerOf, setStopwatch, taskStatus } from '@/utils/tasks';
import { cn } from '@/utils/cn';

const Title = ({ children, right }) => (
  <View className="flex-row items-center gap-2">
    <Text className="flex-1 font-display text-title">{children}</Text>
    {right}
  </View>
);

// One-line add: Enter or the + button submits, then clears.
function AddLine({ placeholder, onAdd, loading, maxLength = 200 }) {
  const theme = useTheme();
  const [v, setV] = useState('');
  const go = async () => { if (v.trim() && !loading && (await onAdd(v.trim()))) setV(''); };
  return (
    <Input
      value={v}
      onChangeText={setV}
      onSubmitEditing={go}
      submitBehavior="submit"
      returnKeyType="done"
      placeholder={placeholder}
      accessibilityLabel={placeholder}
      maxLength={maxLength}
      right={<Pressable onPress={go} disabled={!v.trim() || loading} accessibilityLabel="Add" className="h-11 w-11 items-center justify-center"><Plus size={20} color={v.trim() ? theme.ink : theme.muted} /></Pressable>}
    />
  );
}

// Subtasks inherit the parent's assignee, deadline and project, so the parent needs the first two set.
export function Subtasks({ task }) {
  const me = useSelector((s) => s.auth.user);
  const { data } = useGetSubtasksQuery(task._id);
  const [create, { isLoading }] = useCreateTaskMutation();
  const subs = data?.data?.subtasks || [];
  const ready = task.assignedTo && task.dueDate;
  const add = (title) => runAction(create({
    title, parent: task._id, assignedTo: idOf(task.assignedTo), dueDate: task.dueDate, project: task.project ? idOf(task.project) : undefined, status: 'todo',
  }), ['done', 'review'].includes(task.status) ? 'Subtask added, task back in progress' : 'Subtask added', "Couldn't add the subtask");
  return (
    <Card className="gap-3 p-4">
      <Title right={<Text className="text-sm text-muted tabular-nums">{subs.filter((s) => s.status === 'done').length}/{subs.length}</Text>}>Subtasks</Title>
      {subs.map((s) => <TaskRow key={s._id} task={s} swipe={false} />)}
      {!canWorkTask(task, me) ? (!subs.length && <Text className="text-sm text-muted">No subtasks.</Text>)
        : ready ? <AddLine placeholder="Add a subtask" onAdd={add} loading={isLoading} />
          : <Text className="text-sm text-muted">{canManageTask(task, me) ? 'Set an assignee and due date on this task first.' : 'Ask the creator to set an assignee and due date first.'}</Text>}
    </Card>
  );
}

// People on the task add and tick; the task's managers remove. Others just see it. The server recalculates progress.
export function Checklist({ task }) {
  const theme = useTheme();
  const me = useSelector((s) => s.auth.user);
  const [add, a] = useAddChecklistItemMutation();
  const [update] = useUpdateChecklistItemMutation();
  const [remove] = useRemoveChecklistItemMutation();
  const items = task.checklists || [];
  const done = items.filter((c) => c.checked).length;
  const work = canWorkTask(task, me);
  const tick = (c) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    runAction(update({ id: task._id, itemId: c._id, checked: !c.checked }), null, "Couldn't update the item");
  };
  return (
    <Card className="gap-3 p-4">
      <Title right={<Text className="text-sm text-muted tabular-nums">{done}/{items.length}</Text>}>Checklist</Title>
      {!!items.length && (
        <View className="h-1.5 overflow-hidden rounded-full bg-sand"><View className="h-full rounded-full bg-accent" style={{ width: `${(done / items.length) * 100}%` }} /></View>
      )}
      {items.map((c) => (
        <View key={c._id} className="flex-row items-center gap-1">
          <Pressable onPress={() => tick(c)} disabled={!work} haptic={false} accessibilityRole="checkbox" accessibilityState={{ checked: c.checked }} accessibilityLabel={c.text} className="min-h-[44px] flex-1 flex-row items-center gap-3">
            {c.checked ? <CheckSquare size={22} color={theme.success} /> : <Square size={22} color={theme.muted} />}
            <Text className={cn('flex-1', c.checked && 'text-muted line-through')}>{c.text}</Text>
          </Pressable>
          {canManageTask(task, me) && (
            <Pressable onPress={() => runAction(remove({ id: task._id, itemId: c._id }), 'Item removed', "Couldn't remove")} accessibilityLabel={`Remove ${c.text}`} className="h-11 w-11 items-center justify-center">
              <X size={18} color={theme.muted} />
            </Pressable>
          )}
        </View>
      ))}
      {!items.length && !work && <Text className="text-sm text-muted">No checklist.</Text>}
      {work && <AddLine placeholder="Add an item" maxLength={500} onAdd={(text) => runAction(add({ id: task._id, text }), null, "Couldn't add the item")} loading={a.isLoading} />}
    </Card>
  );
}

// "Blocked by" tasks must be done before this one can start or finish; "Blocking" is the other direction.
export function Dependencies({ task }) {
  const theme = useTheme();
  const me = useSelector((s) => s.auth.user);
  const manage = canManageTask(task, me); // linking work is planning
  const { data } = useGetDependenciesQuery(task._id);
  const [link, l] = useAddDependencyMutation();
  const [unlink] = useRemoveDependencyMutation();
  const [q, setQ] = useState('');
  const deps = data?.data?.dependsOn || [];
  const blocking = data?.data?.blockedBy || [];
  const found = useGetTasksQuery({ search: q.trim(), page: 1, limit: 8, open: 'true', sort: '-createdAt' }, { skip: !manage || q.trim().length < 2 });
  const options = (found.data?.data || []).filter((t) => t._id !== task._id && !deps.some((d) => d._id === t._id));

  return (
    <Card className="gap-3 p-4">
      <Title>Dependencies</Title>
      <Text className="text-caption text-muted">BLOCKED BY</Text>
      {deps.map((d) => (
        <View key={d._id} className="flex-row items-center gap-2">
          <Pressable onPress={() => router.push(`/tasks/${d._id}`)} accessibilityLabel={`Open ${d.title}`} className="min-h-[44px] flex-1 flex-row items-center gap-2">
            <Link2 size={16} color={theme.muted} />
            <Text numberOfLines={1} className="flex-1">{d.title}</Text>
            <TaskStatusBadge status={d.status} />
          </Pressable>
          {manage && (
            <Pressable onPress={() => runAction(unlink({ id: task._id, depId: d._id }), 'Unlinked', "Couldn't unlink")} accessibilityLabel={`Unlink ${d.title}`} className="h-11 w-11 items-center justify-center">
              <X size={18} color={theme.muted} />
            </Pressable>
          )}
        </View>
      ))}
      {!deps.length && <Text className="text-sm text-muted">Nothing blocks this task.</Text>}
      {manage && <Input value={q} onChangeText={setQ} placeholder="Search a task to link" accessibilityLabel="Search a task to link" />}
      {options.map((t) => (
        <Pressable
          key={t._id}
          disabled={l.isLoading}
          onPress={async () => { if (await runAction(link({ id: task._id, dependsOn: [t._id] }), 'Dependency added', "Couldn't link")) setQ(''); }}
          accessibilityLabel={`Link ${t.title}`}
          className="flex-row items-center gap-2 rounded-2xl bg-surface-2 px-3 py-2.5"
        >
          <Text numberOfLines={1} className="flex-1">{t.title}</Text>
          <TaskStatusBadge status={t.status} />
        </Pressable>
      ))}
      {!!blocking.length && (
        <>
          <Text className="text-caption text-muted">BLOCKING</Text>
          {blocking.map((d) => (
            <Pressable key={d._id} onPress={() => router.push(`/tasks/${d._id}`)} accessibilityLabel={`Open ${d.title}`} className="min-h-[44px] flex-row items-center gap-2">
              <Text numberOfLines={1} className="flex-1">{d.title}</Text>
              <TaskStatusBadge status={d.status} />
            </Pressable>
          ))}
        </>
      )}
    </Card>
  );
}

// Stopwatch (start time saved on the phone, so it survives closing the app) and manual entries of 0.25 h or more.
export function TimeTracker({ task }) {
  const theme = useTheme();
  const me = useSelector((s) => s.auth.user);
  const [log, { isLoading }] = useAddTimeEntryMutation();
  const [removeEntry] = useRemoveTimeEntryMutation();
  const [watch, setWatch] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [hours, setHours] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => { getStopwatch().then(setWatch); }, []);
  const mine = watch?.taskId === task._id;
  useEffect(() => {
    if (!mine) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [mine]);
  const secs = mine ? Math.max(0, Math.floor((now - watch.startedAt) / 1000)) : 0;

  const start = async () => {
    const cur = await getStopwatch();
    if (cur && cur.taskId !== task._id) return showToast({ title: 'Another stopwatch is running', message: `Stop it on "${cur.title}" first.` });
    const w = { taskId: task._id, title: task.title, startedAt: Date.now() };
    await setStopwatch(w);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setNow(Date.now());
    setWatch(w);
  };
  const discard = async () => { await setStopwatch(null); setWatch(null); };
  const stop = async () => {
    if (secs < 60) return showToast({ title: 'Run it at least a minute', message: 'Or discard this session.' });
    const h = Math.max(0.25, Math.round((secs / 3600) * 100) / 100);
    const ok = await runAction(log({ id: task._id, date: new Date().toISOString(), hours: h, description: `Stopwatch session (${Math.floor(secs / 60)} mins)` }), `Logged ${formatHours(h)}`, "Couldn't log time");
    if (ok) discard();
  };
  const h = Number(hours);
  const badHours = !!hours.trim() && !(h >= 0.25 && h <= 24);
  const addManual = async () => {
    if (await runAction(log({ id: task._id, date: new Date().toISOString(), hours: h, description: note.trim() }), `Logged ${formatHours(h)}`, "Couldn't log time")) { setHours(''); setNote(''); }
  };
  const entries = [...(task.timeEntries || [])].reverse();

  return (
    <Card className="gap-3 p-4">
      <Title right={<Text className="text-sm text-muted tabular-nums">{formatHours(task.totalLoggedHours || 0)}{task.estimatedHours ? ` of ${formatHours(task.estimatedHours)}` : ''}</Text>}>Time</Title>
      {canWorkTask(task, me) && (<>
      <View className="flex-row items-center gap-3 rounded-2xl bg-surface-2 p-3">
        <Text className="flex-1 font-display text-title tabular-nums" accessibilityLabel={`Stopwatch ${hms(secs)}`}>{hms(secs)}</Text>
        {mine ? (
          <>
            <Button title="Discard" variant="ghost" size="sm" onPress={discard} />
            <Button title="Stop & log" icon={Pause} size="sm" loading={isLoading} onPress={stop} />
          </>
        ) : <Button title="Start" icon={Play} size="sm" onPress={start} />}
      </View>
      <View className="flex-row gap-2">
        <Input className="w-28" value={hours} onChangeText={setHours} keyboardType="decimal-pad" placeholder="Hours" accessibilityLabel="Hours" error={badHours ? '0.25 – 24' : undefined} />
        <Input className="flex-1" value={note} onChangeText={setNote} placeholder="What did you work on?" accessibilityLabel="Time note" maxLength={500} />
      </View>
      <Button title="Log time" variant="secondary" size="sm" disabled={!hours.trim() || badHours} loading={isLoading && !mine} onPress={addManual} />
      </>)}
      {!entries.length && !canWorkTask(task, me) && <Text className="text-sm text-muted">No time logged yet.</Text>}
      {entries.slice(0, 10).map((e) => (
        <View key={e._id} className="flex-row items-center gap-3 border-t border-line pt-2">
          <View className="flex-1">
            <Text className="font-body-semibold tabular-nums">{formatHours(e.hours)}<Text className="font-body text-sm text-muted"> · {e.createdBy?.name || 'Someone'} · {new Date(e.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</Text></Text>
            {!!e.description && <Text numberOfLines={2} className="text-sm text-muted">{e.description}</Text>}
          </View>
          {(idOf(e.createdBy) === me._id || canManageTask(task, me)) && (
            <Pressable onPress={() => runAction(removeEntry({ id: task._id, entryId: e._id }), 'Entry removed', "Couldn't remove")} accessibilityLabel="Remove time entry" className="h-11 w-11 items-center justify-center">
              <Trash2 size={18} color={theme.muted} />
            </Pressable>
          )}
        </View>
      ))}
    </Card>
  );
}

const pretty = (v) => {
  if (v == null || v === '') return 'empty';
  if (/^[a-f0-9]{24}$/.test(v)) return 'another';
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) return new Date(v).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  if (typeof v === 'object') return v.name || v.title || '…';
  return String(v).replace(/_/g, ' ');
};

// Plain sentences for the common changes; anything else falls back to "changed <field> from A to B".
const describe = (a) => {
  const id = (v) => /^[a-f0-9]{24}$/.test(v || '');
  if (a.field === 'status') return `moved it from ${taskStatus(a.oldValue).label} to ${taskStatus(a.newValue).label}`;
  if (a.field === 'assignedTo') return id(a.newValue) || !a.newValue ? `reassigned it (was ${pretty(a.oldValue)})` : `assigned it to ${pretty(a.newValue)}`;
  if (a.field === 'helpers') return [a.newValue, a.oldValue].filter(Boolean).join(', ').replace(/^./, (c) => c.toLowerCase()).concat(' as helpers');
  if (a.field === 'dueDate') return `moved the due date from ${pretty(a.oldValue)} to ${pretty(a.newValue)}`;
  if (a.field && (a.oldValue || a.newValue)) return `changed ${a.field.replace(/([A-Z])/g, ' $1').toLowerCase()} from ${pretty(a.oldValue)} to ${pretty(a.newValue)}`;
  return a.action.replace(/_/g, ' ');
};

// Who changed what, newest first, with the reason when one was given (deadline moves).
export function ActivityLog({ task }) {
  const [all, setAll] = useState(false);
  const list = [...(task.activities || [])].reverse();
  if (!list.length) return null;
  return (
    <Card className="gap-3 p-4">
      <Title>Activity</Title>
      {(all ? list : list.slice(0, 8)).map((a, i) => (
        <View key={a._id || i} className="gap-0.5 border-l-2 border-line pl-3">
          <Text className="text-sm">
            <Text className="font-body-semibold text-sm">{a.performedBy?.name || 'Someone'}</Text>
            {' '}{describe(a)}
          </Text>
          {!!a.reason && <Text className="text-sm text-muted">Reason: {a.reason}</Text>}
          <Text className="text-xs text-muted">{getTimeAgo(a.createdAt || a.timestamp)}</Text>
        </View>
      ))}
      {list.length > 8 && <Button title={all ? 'Show less' : `Show all ${list.length}`} variant="ghost" size="sm" onPress={() => setAll((x) => !x)} />}
    </Card>
  );
}

const openNote = (t, mode) => router.push({ pathname: '/tasks/review-note', params: { id: t._id, title: t.title, mode } });

// Re-render every 30 s so "12 min left" counts down while the screen is open.
function useNow(on) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!on) return undefined;
    const i = setInterval(() => setNow(Date.now()), 30e3);
    return () => clearInterval(i);
  }, [on]);
  return now;
}

// Photos and PDFs posted in the chat since the task was last sent for review.
const reviewFiles = (t) => {
  const sent = [...(t.activities || [])].reverse().find((a) => a.field === 'status' && a.newValue === 'review')?.createdAt;
  if (!sent) return [];
  return (t.comments || []).filter((c) => new Date(c.createdAt) >= new Date(sent)).flatMap((c) => c.files || []);
};

// The review loop on one card: the doer sends it, the reviewer approves or sends it back, the clock shows the 1-hour promise.
export function ReviewPanel({ task: t }) {
  const theme = useTheme();
  const me = useSelector((s) => s.auth.user);
  const [update, u] = useUpdateTaskMutation();
  const [handing, setHanding] = useState(false);
  const [viewing, setViewing] = useState(null);
  const inReview = t.status === 'review';
  const now = useNow(inReview);
  const reviewer = reviewerOf(t);
  const mine = canReview(t, me);

  if (t.status === 'done') return null;
  if (!inReview) {
    if (mine) return null; // the reviewer closes it straight from the status row
    return <Button title="Send for review" icon={Send} variant="secondary" onPress={() => openNote(t, 'submit')} />;
  }

  const clock = reviewClock(t, now);
  const files = reviewFiles(t);
  const images = files.filter((f) => f.mime?.startsWith('image/'));
  const approve = async () => {
    if (await runAction(update({ id: t._id, status: 'done' }), 'Approved', "Couldn't approve")) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };
  const handTo = (p) => {
    setHanding(false);
    if (p._id !== idOf(reviewer)) runAction(update({ id: t._id, reviewer: p._id }), `${p.name} reviews it now`, "Couldn't change the reviewer");
  };

  return (
    <Card className={cn('gap-3 border p-4', clock?.late ? 'border-danger/40' : 'border-accent/40')}>
      <View className="flex-row items-center gap-3">
        <Avatar name={reviewer?.name || '?'} uri={reviewer?.avatar} size={32} />
        <View className="flex-1">
          <Text className="text-caption text-muted">IN REVIEW</Text>
          <Text className="font-body-semibold">{mine ? 'You review this' : `${reviewer?.name || 'The creator'} reviews this`}</Text>
        </View>
      </View>
      {!!clock && (
        <View className="flex-row items-center gap-2" accessibilityLiveRegion="polite">
          <Timer size={16} color={clock.late ? theme.danger : theme.muted} />
          <Text className={cn('text-sm tabular-nums', clock.late ? 'font-body-semibold text-danger' : 'text-muted')}>{clock.label}</Text>
        </View>
      )}
      {!!t.reviewNote && <Text className="text-sm">“{t.reviewNote}”</Text>}
      {!!files.length && <MessageFiles files={files} onOpenImage={(f) => setViewing(images.indexOf(f))} />}
      <ImageViewer key={viewing} images={images} index={viewing} onClose={() => setViewing(null)} />
      {mine ? (
        <View className="gap-2">
          <Button title="Approve" icon={Check} loading={u.isLoading} onPress={approve} />
          <Button title="Ask for changes" icon={MessageSquareWarning} variant="secondary" onPress={() => openNote(t, 'changes')} />
        </View>
      ) : (
        <Text className="text-sm text-muted">You&apos;ll get a notification when {reviewer?.name?.split(' ')[0] || 'they'} replies.</Text>
      )}
      {canManageTask(t, me) && (handing ? <UserPicker label="Hand review to" onPick={handTo} onCancel={() => setHanding(false)} /> : (
        <Pressable onPress={() => setHanding(true)} accessibilityRole="button" className="self-start py-1">
          <Text className="text-sm font-body-semibold text-accent-ink">Hand review to someone else</Text>
        </Pressable>
      ))}
    </Card>
  );
}

const STEPS = [['todo', 'To do'], ['in_progress', 'Working'], ['review', 'Review'], ['done', 'Done']];
const PCTS = [25, 50, 75];

// The task's whole life on one card: where it is, and the one thing to do next.
// To do: Start work. Working: how far along, then Send for review (or Mark done for the reviewer).
// Review: the review card. Done: who finished it, and Reopen.
export function TaskFlow({ task: t }) {
  const theme = useTheme();
  const me = useSelector((s) => s.auth.user);
  const [update, u] = useUpdateTaskMutation();
  const step = STEPS.findIndex(([v]) => v === t.status);
  const reviewer = canReview(t, me);
  const blockers = (t.dependsOn || []).filter((d) => d?.status && d.status !== 'done');
  const total = t.checklists?.length || 0;
  const ticked = t.checklists?.filter((c) => c.checked).length || 0;
  const pct = total ? Math.round((ticked / total) * 100) : t.progress || 0;
  const set = (body, done) => runAction(update({ id: t._id, ...body }), done, "Couldn't update the task");
  const finish = async () => {
    if (!reviewer) return openNote(t, 'submit');
    if (await set({ status: 'done' }, 'Marked done')) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  if (t.status === 'review') return <ReviewPanel task={t} />;

  return (
    <Card className="gap-4 p-4">
      <View className="gap-2" accessible accessibilityLabel={`Step ${step + 1} of 4: ${STEPS[step]?.[1]}`}>
        <View className="flex-row gap-1.5">
          {STEPS.map(([v], i) => <View key={v} className={cn('h-1.5 flex-1 rounded-full', i <= step ? (t.status === 'done' ? 'bg-success' : 'bg-accent') : 'bg-sand')} />)}
        </View>
        <View className="flex-row">
          {STEPS.map(([v, l], i) => <Text key={v} className={cn('flex-1 text-xs', i === step ? 'font-body-semibold text-ink' : 'text-muted')}>{l}</Text>)}
        </View>
      </View>

      {t.status === 'todo' && (blockers.length ? (
        <View className="flex-row items-center gap-3 rounded-2xl bg-surface-2 p-3">
          <Lock size={18} color={theme.muted} />
          <Text className="flex-1 text-sm">Waiting on {blockers.map((b) => `"${b.title}"`).join(', ')}. You&apos;ll get a notification when you can start.</Text>
        </View>
      ) : (
        <Button title="Start work" icon={Play} loading={u.isLoading} onPress={() => set({ status: 'in_progress' }, 'Started. Good luck!')} />
      ))}

      {t.status === 'in_progress' && (
        <>
          <View className="gap-2">
            <View className="flex-row items-end justify-between">
              <Text className="font-body-semibold">How far along?</Text>
              <Text className="font-body-semibold tabular-nums text-accent-ink">{pct}%</Text>
            </View>
            {total ? (
              <Text className="text-sm text-muted">{ticked === total ? 'All checklist items ticked. Ready when you are.' : `${ticked} of ${total} checklist items ticked. Tick them below as you go.`}</Text>
            ) : (
              <View className="flex-row gap-2">
                {PCTS.map((p) => <Chip key={p} label={`${p}%`} active={t.progress === p} onPress={() => p !== t.progress && set({ progress: p }, `${p}% done`)} />)}
              </View>
            )}
          </View>
          {blockers.length ? (
            // It can't be finished (or approved) before the tasks it depends on are done.
            <View className="flex-row items-center gap-3 rounded-2xl bg-surface-2 p-3">
              <Lock size={18} color={theme.muted} />
              <Text className="flex-1 text-sm">Finish {blockers.map((x) => `"${x.title}"`).join(', ')} first. This task depends on it.</Text>
            </View>
          ) : (
            <>
              <Button title={reviewer ? 'Mark done' : 'Done, send for review'} icon={reviewer ? Check : Send} loading={u.isLoading} onPress={finish} />
              {!reviewer && <Text className="-mt-2 text-xs text-muted">{reviewerOf(t)?.name || 'The creator'} checks it and marks it Done.</Text>}
            </>
          )}
        </>
      )}

      {t.status === 'done' && (
        <View className="flex-row items-center gap-3">
          <View className="h-10 w-10 items-center justify-center rounded-full bg-success/15"><Check size={20} color={theme.success} /></View>
          <Text className="flex-1 text-sm">Done{t.completedAt ? ` on ${new Date(t.completedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : ''}.</Text>
          <Button title="Reopen" icon={RotateCcw} size="sm" variant="secondary" loading={u.isLoading} onPress={() => set({ status: 'in_progress' }, 'Reopened')} />
        </View>
      )}

      {t.status === 'in_progress' && (
        <Pressable onPress={() => set({ status: 'todo' }, 'Moved back to To Do')} accessibilityRole="button" className="self-start py-1">
          <Text className="text-sm font-body-semibold text-muted">Not started after all? Move back to To Do</Text>
        </Pressable>
      )}
    </Card>
  );
}
