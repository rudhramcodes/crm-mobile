import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LayoutAnimationConfig } from 'react-native-reanimated';
import { router } from 'expo-router';
import { useSelector } from 'react-redux';
import { CornerDownLeft, X } from 'lucide-react-native';
import { Button } from './Button';
import { Card } from './Card';
import { Chip } from './Chip';
import { Input } from './Input';
import { Pressable } from './Pressable';
import { Text } from './Text';
import { UserPicker } from './UserPicker';
import { ConfirmDelete } from './AttendanceParts';
import { ROW_LAYOUT, TaskRow } from './TaskParts';
import { TASK_PRIORITY, TASK_STATUS } from '@/constants';
import { useGetProjectsQuery } from '@/services/projectApi';
import { useGetUsersQuery } from '@/services/userApi';
import { useGetTeamsQuery } from '@/services/teamApi';
import { dueText, parseQuickAdd } from '@/utils/quickAdd';
import { useBulkUpdateTasksMutation, useCreateTaskMutation, useGetTasksQuery, useDeleteTaskMutation } from '@/services/taskApi';
import { useTheme } from '@/constants/theme';
import { isAdmin, runAction } from '@/utils/attendance';
import { canManageTask, canReview, canWorkTask, myDay, shareCsv } from '@/utils/tasks';
import { showToast } from './Toast';
import { cn } from '@/utils/cn';

const newTask = (params) => router.push({ pathname: '/tasks/new', params });

function Group({ title, tasks, tone, empty, hint }) {
  if (!tasks.length && !empty) return null;
  return (
    <Animated.View layout={ROW_LAYOUT} entering={FadeIn.duration(200)} exiting={FadeOut.duration(180)} style={{ gap: 8 }}>
      <Text className={cn('text-caption', tone || 'text-muted')}>{title} · {tasks.length}</Text>
      {!!hint && !!tasks.length && <Text className="-mt-1 text-xs text-muted">{hint}</Text>}
      {tasks.length ? tasks.map((t) => <TaskRow key={t._id} task={t} />) : <Text className="text-sm text-muted">{empty}</Text>}
    </Animated.View>
  );
}

// One-line add: Enter saves it; @person, a day or time, !priority and #tags are understood.
// `extra` is added to every task made here (a project page passes { project, milestone }).
export function QuickAddTask({ extra, placeholder = 'Add a task · @name tomorrow 5pm !high' }) {
  const theme = useTheme();
  const me = useSelector((s) => s.auth.user);
  const [title, setTitle] = useState('');
  const [create, { isLoading }] = useCreateTaskMutation();
  // People load only once an @ is typed; teams are small and cached.
  const users = useGetUsersQuery({ isActive: true, limit: 200 }, { skip: !title.includes('@') }).data?.data?.users || [];
  const teams = useGetTeamsQuery().data || [];
  const q = parseQuickAdd(title, { me, users: users.filter((u) => u.role !== 'client'), teams });
  const ok = q.title.length >= 2 && !isLoading;

  const add = async () => {
    if (!ok) return;
    const body = { title: q.title, assignedTo: q.owner._id, helpers: q.helpers.map((h) => h._id), dueDate: q.dueDate, status: 'todo', priority: q.priority, tags: q.tags, ...extra };
    const who = q.owner._id === me._id ? '' : ` for ${q.owner.name.split(' ')[0]}`;
    if (await runAction(create(body), `Added${who} · ${dueText(q.dueDate)}`, "Couldn't add the task")) setTitle('');
  };
  // Tapping what was understood opens the full form with it filled in.
  const more = () => {
    newTask({ title: q.title, dueDate: q.dueDate, priority: q.priority, tags: q.tags.join(', '), people: JSON.stringify([q.owner, ...q.helpers].map(({ _id, name, avatar }) => ({ _id, name, avatar }))), ...extra });
    setTitle('');
  };

  return (
    <>
      <Input
        value={title}
        onChangeText={setTitle}
        onSubmitEditing={add}
        placeholder={placeholder}
        accessibilityLabel="Add a task. Type @ for a person, a day, ! for priority, # for a tag"
        returnKeyType="done"
        submitBehavior="submit"
        maxLength={200}
        right={(
          <Pressable onPress={add} disabled={!ok} accessibilityLabel="Add task" className="h-11 w-11 items-center justify-center">
            <CornerDownLeft size={18} color={ok ? theme.ink : theme.muted} />
          </Pressable>
        )}
      />
      {!!q.bits.length && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerClassName="gap-2">
          {q.bits.map((b) => <Chip key={b.kind + b.label} label={b.label} active onPress={more} />)}
          <Chip label="More options" onPress={more} />
        </ScrollView>
      )}
    </>
  );
}

// Personal focus over my own tasks: a one-line add (Enter saves it; @person, dates, !priority and #tags are understood),
// then what needs me (reviews, overdue, today), what's later, and what's with the reviewer.
export function MyDayView({ tasks }) {
  const me = useSelector((s) => s.auth.user);
  // Reviews come from their own query: they may sit outside the filtered list.
  const reviews = useGetTasksQuery({ status: 'review', reviewer: me._id, sort: 'reviewDueAt', limit: 50 }).data?.data || [];
  const g = myDay(tasks);
  const reviewIds = new Set(reviews.map((t) => t._id));
  const waiting = g.waiting.filter((t) => !reviewIds.has(t._id));
  const focus = g.overdue.length + g.today.length + g.done.length;
  const pct = focus ? Math.round((g.done.length / focus) * 100) : 0;

  // Only changes animate, never the first load or a tab switch.
  return (
    <LayoutAnimationConfig skipEntering skipExiting>
    <View className="gap-5">
      <Card className="gap-3 p-4">
        {!!focus && (
          <>
            <View className="flex-row items-end justify-between">
              <Text className="text-caption text-muted">TODAY</Text>
              <Text className="font-body-semibold tabular-nums">{g.done.length} of {focus} done</Text>
            </View>
            <View className="h-1.5 overflow-hidden rounded-full bg-sand" accessible accessibilityLabel={`${pct}% of today's tasks done`}>
              <Animated.View style={{ height: '100%', width: `${pct}%`, transitionProperty: 'width', transitionDuration: 400, transitionTimingFunction: 'ease-out' }}>
                <View className="flex-1 rounded-full bg-accent" />
              </Animated.View>
            </View>
          </>
        )}
        <QuickAddTask />
      </Card>
      <Group title="NEEDS MY REVIEW" tasks={reviews} tone="text-accent-ink" hint="Approve or ask for changes within 1 office hour." />
      <Group title="OVERDUE" tasks={g.overdue} tone="text-danger" />
      <Group title="TODAY" tasks={g.today} empty={g.overdue.length ? 'Nothing else due today.' : 'Nothing due today. Add one above.'} />
      <Group title="LATER" tasks={g.upcoming} />
      <Group title="WITH THE REVIEWER" tasks={waiting} hint="Nothing to do until they reply." />
      <Group title="DONE TODAY" tasks={g.done} />
    </View>
    </LayoutAnimationConfig>
  );
}

// List with long-press (or Select) to pick several; the bulk bar sits above it.
export function ListView({ tasks, selecting, selected, onToggle }) {
  return (
    <LayoutAnimationConfig skipEntering skipExiting>
    <View className="gap-2">
        {tasks.map((t) => <TaskRow key={t._id} task={t} selecting={selecting} selected={selected.includes(t._id)} onToggleSelect={onToggle} />)}
    </View>
    </LayoutAnimationConfig>
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

// Filters: status, priority, project, assignee. Search lives above it.
export function FilterPanel({ f, set }) {
  const me = useSelector((s) => s.auth.user);
  const [picking, setPicking] = useState(false);
  const { data } = useGetProjectsQuery({ page: 1, limit: 50 });
  const projects = data?.data || [];
  const row = (items) => <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-4" contentContainerClassName="gap-2 px-4">{items}</ScrollView>;

  return (
    <Card className="gap-3 p-4">
      <Text className="text-caption text-muted">STATUS</Text>
      {row([{ value: '', label: 'All' }, { value: 'open', label: 'Not done' }, ...TASK_STATUS].map((s) => <Chip key={s.value || 'all'} label={s.label} active={f.status === s.value} onPress={() => set({ status: s.value })} />))}
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
    </Card>
  );
}

