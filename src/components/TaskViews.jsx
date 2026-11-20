import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useSelector } from 'react-redux';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, CornerDownLeft, Plus, X } from 'lucide-react-native';
import { Button } from './Button';
import { Card } from './Card';
import { Chip } from './Chip';
import { Input } from './Input';
import { Pressable } from './Pressable';
import { Text } from './Text';
import { UserPicker } from './UserPicker';
import { ConfirmDelete } from './AttendanceParts';
import { TaskRow } from './TaskParts';
import { TASK_PRIORITY, TASK_STATUS } from '@/constants';
import { useGetProjectsQuery } from '@/services/projectApi';
import { useBulkUpdateTasksMutation, useCreateTaskMutation, useGetTasksQuery, useDeleteTaskMutation, useReorderTasksMutation, useUpdateTaskMutation } from '@/services/taskApi';
import { useTheme } from '@/constants/theme';
import { isAdmin, runAction, ymd } from '@/utils/attendance';
import { canManageTask, canReview, canWorkTask, isOverdue, myDay, reviewerOf, shareCsv } from '@/utils/tasks';
import { showToast } from './Toast';
import { cn } from '@/utils/cn';

const newTask = (params) => router.push({ pathname: '/tasks/new', params });

function Group({ title, tasks, tone, empty, hint }) {
  if (!tasks.length && !empty) return null;
  return (
    <View className="gap-2">
      <Text className={cn('text-caption', tone || 'text-muted')}>{title} · {tasks.length}</Text>
      {!!hint && !!tasks.length && <Text className="-mt-1 text-xs text-muted">{hint}</Text>}
      {tasks.length ? tasks.map((t) => <TaskRow key={t._id} task={t} />) : <Text className="text-sm text-muted">{empty}</Text>}
    </View>
  );
}

// Personal focus over my own tasks: a one-line add (Enter saves it for today, assigned to me),
// then what needs me (reviews, overdue, today), what's later, and what's with the reviewer.
export function MyDayView({ tasks }) {
  const theme = useTheme();
  const me = useSelector((s) => s.auth.user);
  const [title, setTitle] = useState('');
  const [create, { isLoading }] = useCreateTaskMutation();
  // Reviews come from their own query: they may sit outside the filtered list.
  const reviews = useGetTasksQuery({ status: 'review', reviewer: me._id, sort: 'reviewDueAt', limit: 50 }).data?.data || [];
  const g = myDay(tasks);
  const reviewIds = new Set(reviews.map((t) => t._id));
  const waiting = g.waiting.filter((t) => !reviewIds.has(t._id));
  const focus = g.overdue.length + g.today.length + g.done.length;
  const pct = focus ? Math.round((g.done.length / focus) * 100) : 0;

  const add = async () => {
    const t = title.trim();
    if (t.length < 2 || isLoading) return;
    if (await runAction(create({ title: t, assignedTo: me._id, dueDate: ymd(), status: 'todo', priority: 'medium' }), 'Added for today', "Couldn't add the task")) setTitle('');
  };

  return (
    <View className="gap-5">
      <Card className="gap-3 p-4">
        {!!focus && (
          <>
            <View className="flex-row items-end justify-between">
              <Text className="text-caption text-muted">TODAY</Text>
              <Text className="font-body-semibold tabular-nums">{g.done.length} of {focus} done</Text>
            </View>
            <View className="h-1.5 overflow-hidden rounded-full bg-sand" accessible accessibilityLabel={`${pct}% of today's tasks done`}>
              <View className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
            </View>
          </>
        )}
        <Input
          value={title}
          onChangeText={setTitle}
          onSubmitEditing={add}
          placeholder="Add a task for today"
          accessibilityLabel="Add a task for today"
          returnKeyType="done"
          submitBehavior="submit"
          maxLength={200}
          right={(
            <Pressable onPress={add} disabled={title.trim().length < 2 || isLoading} accessibilityLabel="Add task" className="h-11 w-11 items-center justify-center">
              <CornerDownLeft size={18} color={title.trim().length < 2 ? theme.muted : theme.ink} />
            </Pressable>
          )}
        />
      </Card>
      <Group title="NEEDS MY REVIEW" tasks={reviews} tone="text-accent-ink" hint="Approve or ask for changes within 1 office hour." />
      <Group title="OVERDUE" tasks={g.overdue} tone="text-danger" />
      <Group title="TODAY" tasks={g.today} empty={g.overdue.length ? 'Nothing else due today.' : 'Nothing due today. Add one above.'} />
      <Group title="LATER" tasks={g.upcoming} />
      <Group title="WITH THE REVIEWER" tasks={waiting} hint="Nothing to do until they reply." />
      <Group title="DONE TODAY" tasks={g.done} />
    </View>
  );
}

// List with long-press (or Select) to pick several; the bulk bar sits above it.
export function ListView({ tasks, selecting, selected, onToggle }) {
  return (
    <View className="gap-2">
      {tasks.map((t) => <TaskRow key={t._id} task={t} selecting={selecting} selected={selected.includes(t._id)} onToggleSelect={onToggle} />)}
    </View>
  );
}

// Bulk status / priority (one request), delete (one request per task, admins), export the picked tasks.
export function BulkBar({ tasks, selected, onClear }) {
  const theme = useTheme();
  const me = useSelector((s) => s.auth.user);
  const [bulk, { isLoading }] = useBulkUpdateTasksMutation();
  const [remove] = useDeleteTaskMutation();
  const [deleting, setDeleting] = useState(false);
  const picked = tasks.filter((t) => selected.includes(t._id));
  const manageable = picked.filter((t) => canManageTask(t, me));

  // Act on the tasks you're allowed to change and say how many were skipped, instead of failing them all.
  const set = async (data, label) => {
    const ok = picked.filter((t) => (data.priority ? canManageTask(t, me) : canWorkTask(t, me)) && (data.status !== 'done' || t.status === 'done' || canReview(t, me)));
    const skipped = picked.length - ok.length;
    if (!ok.length) return showToast({ title: "You can't change these", message: data.status === 'done' ? 'Only their reviewer can mark them Done. Send them for review instead.' : 'Only people on a task, its creator or a manager can change it.' });
    const msg = `${ok.length} ${ok.length === 1 ? 'task' : 'tasks'} ${label}${skipped ? `, ${skipped} skipped (not yours to change)` : ''}`;
    if (await runAction(bulk({ ids: ok.map((t) => t._id), data }), msg, "Couldn't update")) onClear();
  };
  const del = async () => {
    setDeleting(true);
    const results = await Promise.allSettled(selected.map((id) => remove(id).unwrap()));
    setDeleting(false);
    const failed = results.filter((r) => r.status === 'rejected').length;
    showToast({ title: failed ? `${failed} couldn't be deleted` : `${selected.length} deleted` });
    onClear();
  };

  return (
    <Card className="gap-3 border-accent p-4">
      <View className="flex-row items-center">
        <Text className="flex-1 font-body-semibold">{selected.length} selected</Text>
        <Pressable onPress={onClear} accessibilityLabel="Clear selection" className="h-11 w-11 items-center justify-center"><X size={20} color={theme.ink} /></Pressable>
      </View>
      {!!selected.length && (
        <>
          <Text className="text-caption text-muted">SET STATUS</Text>
          <View className="flex-row flex-wrap gap-2">
            {TASK_STATUS.map((s) => <Chip key={s.value} label={s.label} onPress={() => !isLoading && set({ status: s.value }, `moved to ${s.label}`)} />)}
          </View>
          {!!manageable.length && (
            <>
              <Text className="text-caption text-muted">SET PRIORITY</Text>
              <View className="flex-row flex-wrap gap-2">
                {TASK_PRIORITY.map((p) => <Chip key={p.value} label={p.label} onPress={() => !isLoading && set({ priority: p.value }, `set to ${p.label}`)} />)}
              </View>
            </>
          )}
          <Button title="Export selected" variant="secondary" size="sm" onPress={() => shareCsv(picked)} />
          {isAdmin(me) && <ConfirmDelete label={`Delete ${selected.length}`} loading={deleting} onConfirm={del} />}
        </>
      )}
    </Card>
  );
}

const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0);

// Kanban: one column per status, side by side. Move mode shows arrows to change status and order (no drag on a phone).
export function BoardView({ tasks }) {
  const theme = useTheme();
  const me = useSelector((s) => s.auth.user);
  const [moving, setMoving] = useState(false);
  const [update] = useUpdateTaskMutation();
  const [reorder] = useReorderTasksMutation();

  const shift = (t, dir) => {
    const i = TASK_STATUS.findIndex((s) => s.value === t.status) + dir;
    const next = TASK_STATUS[i]?.value;
    if (!next) return;
    if (next === 'done' && !canReview(t, me)) return showToast({ title: 'Only the reviewer can mark Done', message: `Ask ${reviewerOf(t)?.name || 'the creator'} to review it.` });
    runAction(update({ id: t._id, status: next }), `Moved to ${TASK_STATUS[i].label}`, "Couldn't move the task");
  };
  const bump = (col, i, dir) => {
    const ids = col.map((t) => t._id);
    [ids[i], ids[i + dir]] = [ids[i + dir], ids[i]];
    runAction(reorder({ status: col[0].status, orderedIds: ids }), null, "Couldn't reorder");
  };

  return (
    <View className="gap-3">
      <View className="flex-row items-center gap-2">
        <Chip label={moving ? 'Done moving' : 'Move cards'} active={moving} onPress={() => setMoving((m) => !m)} />
        <Text className="flex-1 text-sm text-muted">Swipe sideways for more columns.</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={292} decelerationRate="fast" className="-mx-5" contentContainerClassName="gap-3 px-5">
        {TASK_STATUS.map((s, si) => {
          const col = tasks.filter((t) => t.status === s.value).sort(byOrder);
          return (
            <View key={s.value} className="w-[280px] gap-2 rounded-3xl bg-surface-2 p-3">
              <View className="flex-row items-center gap-2 px-1">
                <Text className="flex-1 font-body-semibold">{s.label}</Text>
                <Text className="text-sm text-muted tabular-nums">{col.length}</Text>
                {['todo', 'in_progress'].includes(s.value) && <Pressable onPress={() => newTask({ status: s.value })} accessibilityLabel={`Add to ${s.label}`} className="h-9 w-9 items-center justify-center"><Plus size={18} color={theme.ink} /></Pressable>}
              </View>
              {col.map((t, i) => (
                <View key={t._id} className="gap-1">
                  <TaskRow task={t} swipe={false} />
                  {moving && canWorkTask(t, me) && (
                    <View className="flex-row justify-between px-1">
                      <MoveBtn icon={ChevronLeft} label={si ? `Move to ${TASK_STATUS[si - 1].label}` : 'Already first column'} disabled={!si} onPress={() => shift(t, -1)} />
                      <MoveBtn icon={ArrowUp} label="Move up" disabled={!i} onPress={() => bump(col, i, -1)} />
                      <MoveBtn icon={ArrowDown} label="Move down" disabled={i === col.length - 1} onPress={() => bump(col, i, 1)} />
                      <MoveBtn icon={ChevronRight} label={TASK_STATUS[si + 1] ? `Move to ${TASK_STATUS[si + 1].label}` : 'Already last column'} disabled={si === TASK_STATUS.length - 1} onPress={() => shift(t, 1)} />
                    </View>
                  )}
                </View>
              ))}
              {!col.length && <Text className="px-1 py-6 text-center text-sm text-muted">No tasks</Text>}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

function MoveBtn({ icon: Icon, label, disabled, onPress }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityLabel={label} className={cn('h-11 w-14 items-center justify-center rounded-full bg-surface', disabled && 'opacity-30')}>
      <Icon size={18} color={theme.ink} />
    </Pressable>
  );
}

const WEEK = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

// Month grid with a dot per due task; tap a day for its tasks or to add one on that date.
export function CalendarView({ tasks }) {
  const theme = useTheme();
  const [{ y, m }, setYm] = useState(() => ({ y: new Date().getFullYear(), m: new Date().getMonth() }));
  const [day, setDay] = useState(ymd());
  const byDay = {};
  for (const t of tasks) if (t.dueDate) (byDay[ymd(t.dueDate)] ||= []).push(t);
  const lead = (new Date(y, m, 1).getDay() + 6) % 7;
  const days = new Date(y, m + 1, 0).getDate();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => ymd(new Date(y, m, i + 1)))];
  const today = ymd();
  const shift = (d) => setYm(({ y: yy, m: mm }) => { const n = new Date(yy, mm + d, 1); return { y: n.getFullYear(), m: n.getMonth() }; });
  const list = byDay[day] || [];

  return (
    <View className="gap-4">
      <Card className="gap-3 p-4">
        <View className="flex-row items-center">
          <Pressable onPress={() => shift(-1)} accessibilityLabel="Previous month" className="h-11 w-11 items-center justify-center"><ChevronLeft size={22} color={theme.ink} /></Pressable>
          <Text className="flex-1 text-center font-body-semibold text-lg">{new Date(y, m, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</Text>
          <Pressable onPress={() => shift(1)} accessibilityLabel="Next month" className="h-11 w-11 items-center justify-center"><ChevronRight size={22} color={theme.ink} /></Pressable>
        </View>
        <View className="flex-row">{WEEK.map((w, i) => <Text key={i} className="flex-1 text-center text-caption text-muted">{w}</Text>)}</View>
        <View className="flex-row flex-wrap">
          {cells.map((d, i) => {
            if (!d) return <View key={`x${i}`} className="aspect-square w-[14.28%]" />;
            const due = byDay[d] || [];
            const late = due.some(isOverdue);
            return (
              <View key={d} className="aspect-square w-[14.28%] p-0.5">
                <Pressable
                  onPress={() => setDay(d)}
                  accessibilityLabel={`${Number(d.slice(8))}, ${due.length} ${due.length === 1 ? 'task' : 'tasks'} due`}
                  accessibilityState={{ selected: d === day }}
                  className={cn('flex-1 items-center justify-center gap-1 rounded-xl', d === day ? 'bg-ink' : d === today && 'border-[1.5px] border-accent')}
                >
                  <Text className={cn('font-body-medium text-sm tabular-nums', d === day && 'text-bg')}>{Number(d.slice(8))}</Text>
                  <View className="h-1.5 flex-row gap-0.5">
                    {due.slice(0, 3).map((t) => <View key={t._id} className={cn('h-1.5 w-1.5 rounded-full', late ? 'bg-danger' : t.status === 'done' ? 'bg-success' : 'bg-accent')} />)}
                  </View>
                </Pressable>
              </View>
            );
          })}
        </View>
      </Card>
      <View className="flex-row items-center">
        <Text className="flex-1 text-caption text-muted">DUE {new Date(`${day}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase()} · {list.length}</Text>
        <Button title="Add" icon={Plus} size="sm" variant="secondary" onPress={() => newTask({ dueDate: day })} />
      </View>
      {list.map((t) => <TaskRow key={t._id} task={t} />)}
      {!list.length && <Text className="text-sm text-muted">Nothing due this day.</Text>}
    </View>
  );
}

// Filters: status, priority, project, assignee, watching. Search lives above it.
export function FilterPanel({ f, set }) {
  const me = useSelector((s) => s.auth.user);
  const [picking, setPicking] = useState(false);
  const { data } = useGetProjectsQuery({ page: 1, limit: 50 });
  const projects = data?.data || [];
  const row = (items) => <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-4" contentContainerClassName="gap-2 px-4">{items}</ScrollView>;

  return (
    <Card className="gap-3 p-4">
      <Text className="text-caption text-muted">STATUS</Text>
      {row([{ value: '', label: 'All' }, ...TASK_STATUS].map((s) => <Chip key={s.value || 'all'} label={s.label} active={f.status === s.value} onPress={() => set({ status: s.value })} />))}
      <Text className="text-caption text-muted">PRIORITY</Text>
      {row([{ value: '', label: 'All' }, ...TASK_PRIORITY].map((p) => <Chip key={p.value || 'all'} label={p.label} active={f.priority === p.value} onPress={() => set({ priority: p.value })} />))}
      {!!projects.length && (
        <>
          <Text className="text-caption text-muted">PROJECT</Text>
          {row([{ _id: '', title: 'All' }, ...projects].map((p) => <Chip key={p._id || 'all'} label={p.title} active={f.project === p._id} onPress={() => set({ project: p._id })} />))}
        </>
      )}
      <Text className="text-caption text-muted">ASSIGNEE</Text>
      {row([
        <Chip key="any" label="Anyone" active={!f.assignedTo} onPress={() => set({ assignedTo: '', assigneeName: '' })} />,
        <Chip key="me" label="Me" active={f.assignedTo === me._id} onPress={() => set({ assignedTo: me._id, assigneeName: 'Me' })} />,
        f.assignedTo && f.assignedTo !== me._id
          ? <Chip key="who" label={f.assigneeName} active onPress={() => setPicking(true)} />
          : <Chip key="pick" label="Someone else…" onPress={() => setPicking(true)} />,
      ])}
      {picking && <UserPicker label="Assigned to" onPick={(u) => { set({ assignedTo: u._id, assigneeName: u.name }); setPicking(false); }} onCancel={() => setPicking(false)} />}
      <Text className="text-caption text-muted">SHOW</Text>
      {row([
        <Chip key="all" label="All tasks" active={!f.watching} onPress={() => set({ watching: false })} />,
        <Chip key="w" label="Watching" active={f.watching} onPress={() => set({ watching: true })} />,
      ])}
    </Card>
  );
}

