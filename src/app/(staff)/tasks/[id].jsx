import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSelector } from 'react-redux';
import { CalendarClock, Eye, EyeOff, Repeat, X } from 'lucide-react-native';
import {
  ActivityLog, Avatar, Card, ReviewPanel, Checklist, Chip, ConfirmDelete, FilesStrip, DashboardState, DateField, Dependencies, Input, PageHeader, Pressable, Screen,
  Subtasks, TaskChat, Text, TimeTracker, UserPicker, backTo, openReschedule, showToast, usePullRefresh,
} from '@/components';
import { TASK_PRIORITY, TASK_STATUS } from '@/constants';
import { useDeleteTaskMutation, useGetTaskByIdQuery, useUnwatchTaskMutation, useUpdateTaskMutation, useWatchTaskMutation } from '@/services/taskApi';
import { useEntityRoom } from '@/hooks/useEntityRoom';
import { useTheme } from '@/constants/theme';
import { isAdmin, runAction, ymd } from '@/utils/attendance';
import { canReview, dueLabel, idOf, isOverdue, reviewerOf } from '@/utils/tasks';
import { cn } from '@/utils/cn';

const Label = ({ children }) => <Text className="text-caption text-muted">{children}</Text>;

// Everything about one task on one scroll: fields edit in place and save on blur or tap.
function TaskBody({ task: t }) {
  const theme = useTheme();
  const me = useSelector((s) => s.auth.user);
  const [update] = useUpdateTaskMutation();
  const [watch] = useWatchTaskMutation();
  const [unwatch] = useUnwatchTaskMutation();
  const [del, d] = useDeleteTaskMutation();
  const [title, setTitle] = useState(t.title);
  const [description, setDescription] = useState(t.description || '');
  const [hours, setHours] = useState(t.estimatedHours ? String(t.estimatedHours) : '');
  const [tag, setTag] = useState('');
  const [picking, setPicking] = useState(false);
  const creator = canReview(t, me);
  const watching = (t.watchers || []).some((w) => idOf(w) === me._id);
  const save = (body, done) => runAction(update({ id: t._id, ...body }), done, "Couldn't save");

  const saveTitle = () => {
    const v = title.trim();
    if (v === t.title) return;
    if (v.length < 2) { setTitle(t.title); return showToast({ title: 'Title needs 2 or more characters' }); }
    save({ title: v }, 'Title saved');
  };
  const setStatus = (s) => {
    if (s === t.status) return;
    if (s === 'done' && !creator) return showToast({ title: 'Only the reviewer can mark Done', message: `Send it for review; ${reviewerOf(t)?.name || 'the creator'} closes it.` });
    if (s === 'review') return router.push({ pathname: '/tasks/review-note', params: { id: t._id, title: t.title, mode: 'submit' } });
    save({ status: s }, s === 'review' ? 'Sent for review' : `Moved to ${TASK_STATUS.find((x) => x.value === s).label}`);
  };
  const addTag = () => {
    const v = tag.trim().replace(/^#/, '');
    setTag('');
    if (v && !(t.tags || []).includes(v)) save({ tags: [...(t.tags || []), v] });
  };

  return (
    <>
      <PageHeader
        caption={t.parent ? 'SUBTASK' : 'TASK'}
        title=""
        fallback="/tasks"
        right={(
          <Pressable onPress={() => runAction(watching ? unwatch(t._id) : watch(t._id), watching ? 'Stopped watching' : 'Watching this task')} accessibilityLabel={watching ? 'Stop watching' : 'Watch'} className="h-11 flex-row items-center gap-1.5 rounded-full bg-surface-2 px-4">
            {watching ? <EyeOff size={16} color={theme.ink} /> : <Eye size={16} color={theme.ink} />}
            <Text className="font-body-semibold text-sm">{watching ? 'Watching' : 'Watch'}</Text>
          </Pressable>
        )}
      />
      <Input value={title} onChangeText={setTitle} onBlur={saveTitle} onSubmitEditing={saveTitle} maxLength={200} accessibilityLabel="Title" className="-mt-3" style={{ fontFamily: 'Goldenbook-Regular', fontSize: 24, height: undefined, minHeight: 52, paddingVertical: 10 }} multiline submitBehavior="blurAndSubmit" />
      {!!t.parent && (
        <Pressable onPress={() => router.push(`/tasks/${idOf(t.parent)}`)} accessibilityRole="link" className="-mt-2">
          <Text className="text-sm text-accent-ink">Part of: {t.parent.title || 'parent task'}</Text>
        </Pressable>
      )}

      <View className="gap-2">
        <Label>STATUS</Label>
        <View className="flex-row flex-wrap gap-2">
          {TASK_STATUS.map((s) => <Chip key={s.value} label={s.value === 'review' && !creator ? 'Submit for review' : s.label} active={t.status === s.value} onPress={() => setStatus(s.value)} />)}
        </View>
        {!creator && <Text className="text-xs text-muted">Only {reviewerOf(t)?.name || 'the creator'} can mark it Done.</Text>}
      </View>
      <ReviewPanel task={t} />
      <FilesStrip task={t} />
      <View className="gap-2">
        <Label>PRIORITY</Label>
        <View className="flex-row flex-wrap gap-2">
          {TASK_PRIORITY.map((p) => <Chip key={p.value} label={p.label} active={t.priority === p.value} onPress={() => p.value !== t.priority && save({ priority: p.value }, `Priority ${p.label}`)} />)}
        </View>
      </View>

      <Card className="gap-4 p-4">
        <View className="gap-1.5">
          <Label>ASSIGNEE</Label>
          {picking ? <UserPicker label="Reassign to" onPick={(u) => { setPicking(false); if (u._id !== idOf(t.assignedTo)) save({ assignedTo: u._id }, `Assigned to ${u.name}`); }} /> : (
            <Pressable onPress={() => setPicking(true)} accessibilityLabel={`Assignee ${t.assignedTo?.name || 'none'}. Change`} className="flex-row items-center gap-3">
              <Avatar name={t.assignedTo?.name || '?'} uri={t.assignedTo?.avatar} size={32} />
              <Text className="flex-1 font-body-medium">{t.assignedTo?.name || 'Unassigned'}</Text>
              <Text className="font-body-semibold text-accent-ink">Change</Text>
            </Pressable>
          )}
        </View>
        <View className="gap-1.5">
          <Label>DUE</Label>
          <Pressable onPress={() => openReschedule(t)} accessibilityLabel={`Due ${dueLabel(t.dueDate)}. Reschedule`} className="flex-row items-center gap-3">
            <CalendarClock size={20} color={isOverdue(t) ? theme.danger : theme.muted} />
            <Text className={cn('flex-1 font-body-medium', isOverdue(t) && 'text-danger')}>{t.dueDate ? new Date(t.dueDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : 'No due date'}{isOverdue(t) ? ' · overdue' : ''}</Text>
            <Text className="font-body-semibold text-accent-ink">Reschedule</Text>
          </Pressable>
        </View>
        <DateField label="Start date" value={t.startDate ? ymd(t.startDate) : ''} onChange={(v) => save({ startDate: v }, 'Start date saved')} placeholder="Not set" />
        <Input label="Estimated hours" value={hours} onChangeText={setHours} keyboardType="decimal-pad" placeholder="0" onBlur={() => { const n = Number(hours || 0); if (n >= 0 && n !== (t.estimatedHours || 0)) save({ estimatedHours: n }, 'Estimate saved'); }} />
        {!!t.project && <Text className="text-sm text-muted">Project: <Text className="text-sm">{t.project.title}</Text></Text>}
        {t.recurring?.enabled && (
          <View className="flex-row items-center gap-2"><Repeat size={14} color={theme.muted} /><Text className="text-sm text-muted">Repeats {t.recurring.interval > 1 ? `every ${t.recurring.interval} ` : ''}{t.recurring.frequency}</Text></View>
        )}
        <Text className="text-xs text-muted">Created by {t.createdBy?.name || 'someone'} on {new Date(t.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}{t.completedAt ? ` · done ${new Date(t.completedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : ''}</Text>
      </Card>

      <Input
        label="Description"
        value={description}
        onChangeText={setDescription}
        onBlur={() => description.trim() !== (t.description || '') && save({ description: description.trim() }, 'Description saved')}
        placeholder="Add details, links, the brief…"
        multiline
        maxLength={5000}
        style={{ minHeight: 96, height: undefined, paddingTop: 14, paddingBottom: 14, textAlignVertical: 'top' }}
      />

      <View className="gap-2">
        <Label>TAGS</Label>
        <View className="flex-row flex-wrap items-center gap-2">
          {(t.tags || []).map((g) => (
            <Pressable key={g} onPress={() => save({ tags: t.tags.filter((x) => x !== g) })} accessibilityLabel={`Remove tag ${g}`} className="h-9 flex-row items-center gap-1 rounded-full bg-sand px-3">
              <Text className="text-sm text-brown">#{g}</Text>
              <X size={14} color={theme.ink} />
            </Pressable>
          ))}
        </View>
        <Input value={tag} onChangeText={setTag} onSubmitEditing={addTag} submitBehavior="submit" placeholder="Add a tag" accessibilityLabel="Add a tag" autoCapitalize="none" maxLength={40} returnKeyType="done" />
      </View>

      <Subtasks task={t} />
      <Checklist task={t} />
      <TimeTracker task={t} />
      <Dependencies task={t} />
      <TaskChat task={t} />
      <ActivityLog task={t} />
      {isAdmin(me) && <ConfirmDelete label="Delete task" loading={d.isLoading} onConfirm={async () => { if (await runAction(del(t._id), 'Task deleted', "Couldn't delete")) backTo('/tasks'); }} />}
    </>
  );
}

export default function TaskDetail() {
  const { id } = useLocalSearchParams();
  const { data, isLoading, isError, refetch } = useGetTaskByIdQuery(id);
  useEntityRoom('task', id, 'Task');
  const refreshControl = usePullRefresh(refetch);
  const task = data?.data?.task;
  return (
    <Screen scroll className="gap-5 pt-2" refreshControl={refreshControl}>
      {task ? <TaskBody key={task._id} task={task} /> : (
        <>
          <PageHeader caption="TASK" title="" fallback="/tasks" />
          <DashboardState isLoading={isLoading} isError={isError || (!isLoading && !task)} refetch={refetch} />
        </>
      )}
    </Screen>
  );
}
