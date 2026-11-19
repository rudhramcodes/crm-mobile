import { useEffect, useState } from 'react';
import { View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useSelector } from 'react-redux';
import { Check, CheckSquare, Link2, MessageSquareWarning, Pause, Play, Plus, Send, Square, Timer, Trash2, X } from 'lucide-react-native';
import { Avatar } from './Avatar';
import { Button } from './Button';
import { Card } from './Card';
import { Input } from './Input';
import { Pressable } from './Pressable';
import { Text } from './Text';
import { showToast } from './Toast';
import { UserPicker } from './UserPicker';
import { TaskRow, TaskStatusBadge } from './TaskParts';
import {
  useAddChecklistItemMutation, useAddDependencyMutation, useAddTimeEntryMutation, useCreateTaskMutation,
  useGetDependenciesQuery, useGetSubtasksQuery, useGetTasksQuery, useRemoveChecklistItemMutation,
  useRemoveDependencyMutation, useRemoveTimeEntryMutation, useUpdateChecklistItemMutation, useUpdateTaskMutation,
} from '@/services/taskApi';
import { useTheme } from '@/constants/theme';
import { hms, isAdmin, runAction } from '@/utils/attendance';
import { formatHours, getTimeAgo } from '@/utils/formatters';
import { canReview, getStopwatch, idOf, isCreator, reviewClock, reviewerOf, setStopwatch } from '@/utils/tasks';
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
      {ready ? <AddLine placeholder="Add a subtask" onAdd={add} loading={isLoading} /> : <Text className="text-sm text-muted">Set an assignee and due date on this task first.</Text>}
    </Card>
  );
}

// Anyone on staff adds and ticks; only admins remove. The server recalculates progress.
export function Checklist({ task }) {
  const theme = useTheme();
  const me = useSelector((s) => s.auth.user);
  const [add, a] = useAddChecklistItemMutation();
  const [update] = useUpdateChecklistItemMutation();
  const [remove] = useRemoveChecklistItemMutation();
  const items = task.checklists || [];
  const done = items.filter((c) => c.checked).length;
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
          <Pressable onPress={() => tick(c)} haptic={false} accessibilityRole="checkbox" accessibilityState={{ checked: c.checked }} accessibilityLabel={c.text} className="min-h-[44px] flex-1 flex-row items-center gap-3">
            {c.checked ? <CheckSquare size={22} color={theme.success} /> : <Square size={22} color={theme.muted} />}
            <Text className={cn('flex-1', c.checked && 'text-muted line-through')}>{c.text}</Text>
          </Pressable>
          {isAdmin(me) && (
            <Pressable onPress={() => runAction(remove({ id: task._id, itemId: c._id }), 'Item removed', "Couldn't remove")} accessibilityLabel={`Remove ${c.text}`} className="h-11 w-11 items-center justify-center">
              <X size={18} color={theme.muted} />
            </Pressable>
          )}
        </View>
      ))}
      <AddLine placeholder="Add an item" maxLength={500} onAdd={(text) => runAction(add({ id: task._id, text }), null, "Couldn't add the item")} loading={a.isLoading} />
    </Card>
  );
}

// "Blocked by" tasks must be done before this one can start or finish; "Blocking" is the other direction.
export function Dependencies({ task }) {
  const theme = useTheme();
  const { data } = useGetDependenciesQuery(task._id);
  const [link, l] = useAddDependencyMutation();
  const [unlink] = useRemoveDependencyMutation();
  const [q, setQ] = useState('');
  const deps = data?.data?.dependsOn || [];
  const blocking = data?.data?.blockedBy || [];
  const found = useGetTasksQuery({ search: q.trim(), page: 1, limit: 8 }, { skip: q.trim().length < 2 });
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
          <Pressable onPress={() => runAction(unlink({ id: task._id, depId: d._id }), 'Unlinked', "Couldn't unlink")} accessibilityLabel={`Unlink ${d.title}`} className="h-11 w-11 items-center justify-center">
            <X size={18} color={theme.muted} />
          </Pressable>
        </View>
      ))}
      {!deps.length && <Text className="text-sm text-muted">Nothing blocks this task.</Text>}
      <Input value={q} onChangeText={setQ} placeholder="Search a task to link" accessibilityLabel="Search a task to link" />
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
      {entries.slice(0, 10).map((e) => (
        <View key={e._id} className="flex-row items-center gap-3 border-t border-line pt-2">
          <View className="flex-1">
            <Text className="font-body-semibold tabular-nums">{formatHours(e.hours)}<Text className="font-body text-sm text-muted"> · {e.createdBy?.name || 'Someone'} · {new Date(e.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</Text></Text>
            {!!e.description && <Text numberOfLines={2} className="text-sm text-muted">{e.description}</Text>}
          </View>
          {(idOf(e.createdBy) === me._id || isAdmin(me)) && (
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
            {' '}{a.field && (a.oldValue || a.newValue) ? `changed ${a.field.replace(/([A-Z])/g, ' $1').toLowerCase()} from ${pretty(a.oldValue)} to ${pretty(a.newValue)}` : a.action.replace(/_/g, ' ')}
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

// The review loop on one card: the doer sends it, the reviewer approves or sends it back, the clock shows the 1-hour promise.
export function ReviewPanel({ task: t }) {
  const theme = useTheme();
  const me = useSelector((s) => s.auth.user);
  const [update, u] = useUpdateTaskMutation();
  const [handing, setHanding] = useState(false);
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
      {mine ? (
        <View className="gap-2">
          <Button title="Approve" icon={Check} loading={u.isLoading} onPress={approve} />
          <Button title="Ask for changes" icon={MessageSquareWarning} variant="secondary" onPress={() => openNote(t, 'changes')} />
        </View>
      ) : (
        <Text className="text-sm text-muted">You&apos;ll get a notification when {reviewer?.name?.split(' ')[0] || 'they'} replies.</Text>
      )}
      {(isCreator(t, me) || isAdmin(me)) && (handing ? <UserPicker label="Hand review to" onPick={handTo} /> : (
        <Pressable onPress={() => setHanding(true)} accessibilityRole="button" className="self-start py-1">
          <Text className="text-sm font-body-semibold text-accent-ink">Hand review to someone else</Text>
        </Pressable>
      ))}
    </Card>
  );
}
