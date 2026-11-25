import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSelector } from 'react-redux';
import { CalendarClock, ChevronDown, ChevronLeft, ChevronUp, Repeat, X } from 'lucide-react-native';
import {
  ActivityLog, Avatar, Button, Card, Checklist, Chip, ConfirmDelete, FilesStrip, DashboardState, DateField, Dependencies, Input, PageHeader, PeoplePicker, Pressable, Screen,
  Subtasks, TaskChat, TaskFlow, Text, TimeTracker, backTo, openReschedule, showToast, usePullRefresh,
} from '@/components';
import { TASK_PRIORITY } from '@/constants';
import { useDeleteTaskMutation, useGetTaskByIdQuery, useUpdateTaskMutation } from '@/services/taskApi';
import { useEntityRoom } from '@/hooks/useEntityRoom';
import { setViewing } from '@/services/push';
import { useTheme } from '@/constants/theme';
import { isAdmin, runAction, ymd } from '@/utils/attendance';
import { canManageTask, dueLabel, idOf, isOnTask, isOverdue, taskPriority } from '@/utils/tasks';
import { cn } from '@/utils/cn';

const Label = ({ children }) => <Text className="text-caption text-muted">{children}</Text>;

// An edit field that follows the server's value (live updates from colleagues) except while you're in it.
// changed() is true only if you edited it, so leaving a field never writes back an old copy.
function useSynced(value) {
  const [v, setV] = useState(value);
  const at = useRef(null); // the value when you started editing; null when not editing
  useEffect(() => { if (at.current === null) setV(value); }, [value]);
  const onFocus = () => { at.current = value; };
  const done = () => { const edited = at.current !== null && v !== at.current; at.current = null; return edited; };
  return [v, setV, onFocus, done];
}

// One task on one scroll, in the order people use it: what and where it stands, who and when, the work itself
// (description, checklist, subtasks, files, chat), then rarely-needed fields behind "More details".
// Fields edit in place and save on blur or tap.
function TaskBody({ task: t }) {
  const theme = useTheme();
  const me = useSelector((s) => s.auth.user);
  const [update] = useUpdateTaskMutation();
  const [del, d] = useDeleteTaskMutation();
  const [title, setTitle, titleFocus, titleDone] = useSynced(t.title);
  const [description, setDescription, descFocus, descDone] = useSynced(t.description || '');
  const [hours, setHours, hoursFocus, hoursDone] = useSynced(t.estimatedHours ? String(t.estimatedHours) : '');
  const [tag, setTag] = useState('');
  const [people, setPeople] = useState(null); // draft { owner, helpers } while editing
  const [more, setMore] = useState(false);
  const manage = canManageTask(t, me); // plan it: title, priority, people
  const work = manage || isOnTask(t, me); // move it along: status, dates, details
  const save = (body, done) => runAction(update({ id: t._id, ...body }), done, "Couldn't save");

  const saveTitle = async () => {
    const v = title.trim();
    if (!titleDone() || v === t.title) return;
    if (v.length < 2) { setTitle(t.title); return showToast({ title: 'Title needs 2 or more characters' }); }
    if (!(await save({ title: v }, 'Title saved'))) setTitle(t.title); // refused: show the real title again
  };
  const addTag = () => {
    const v = tag.trim().replace(/^#/, '');
    setTag('');
    if (v && !(t.tags || []).includes(v)) save({ tags: [...(t.tags || []), v] });
  };

  return (
    <>
      <View className="flex-row items-center justify-between">
        <Pressable onPress={() => backTo('/tasks')} accessibilityLabel="Back" className="-ml-2 h-11 w-11 items-center justify-center">
          <ChevronLeft size={26} color={theme.ink} />
        </Pressable>
      </View>
      <View className="-mt-3 gap-1">
        {!!t.parent && (
          <Pressable onPress={() => router.push(`/tasks/${idOf(t.parent)}`)} accessibilityRole="link">
            <Text className="text-sm text-accent-ink">Subtask of {t.parent.title || 'parent task'}</Text>
          </Pressable>
        )}
        <Input editable={manage} value={title} onChangeText={setTitle} onFocus={titleFocus} onBlur={saveTitle} onSubmitEditing={saveTitle} maxLength={200} accessibilityLabel="Title" style={{ fontFamily: 'Goldenbook-Regular', fontSize: 24, height: undefined, minHeight: 52, paddingVertical: 10 }} multiline submitBehavior="blurAndSubmit" />
        {!!t.project && (
          <Pressable onPress={() => router.push(`/projects/${idOf(t.project)}`)} accessibilityRole="link" accessibilityLabel={`Project ${t.project.title}`}>
            <Text className="text-sm text-accent-ink">{t.project.title}</Text>
          </Pressable>
        )}
      </View>

      {work ? <TaskFlow task={t} /> : (
        <Text className="text-sm text-muted">Only the people on this task can change it. You can follow it and chat on it.</Text>
      )}

      <Card className="gap-4 p-4">
        <View className="gap-1.5">
          <Label>PEOPLE</Label>
          {people ? (
            <View className="gap-3">
              <PeoplePicker owner={people.owner} helpers={people.helpers} onChange={setPeople} />
              <View className="flex-row gap-2">
                <Button title="Cancel" variant="secondary" className="flex-1" onPress={() => setPeople(null)} />
                <Button title="Save people" className="flex-1" onPress={() => {
                  if (!people.owner) return showToast({ title: 'Star someone as the owner' });
                  save({ assignedTo: people.owner._id, helpers: people.helpers.map((h) => h._id) }, 'People saved');
                  setPeople(null);
                }} />
              </View>
            </View>
          ) : (
            <Pressable onPress={() => setPeople({ owner: t.assignedTo || null, helpers: t.helpers || [] })} disabled={!manage} accessibilityLabel={`Owner ${t.assignedTo?.name || 'none'}${t.helpers?.length ? `, ${t.helpers.length} helping` : ''}${manage ? '. Change' : ''}`} className="flex-row items-center gap-3">
              <Avatar name={t.assignedTo?.name || '?'} uri={t.assignedTo?.avatar} size={32} />
              <View className="flex-1">
                <Text className="font-body-medium">{idOf(t.assignedTo) === me._id ? 'You' : t.assignedTo?.name || 'Unassigned'}</Text>
                {!!t.helpers?.length && <Text className="text-sm text-muted" numberOfLines={1}>with {t.helpers.map((h) => (idOf(h) === me._id ? 'you' : h.name)).join(', ')}</Text>}
              </View>
              {manage && <Text className="font-body-semibold text-accent-ink">Change</Text>}
            </Pressable>
          )}
        </View>
        <View className="gap-1.5">
          <Label>DUE</Label>
          <Pressable onPress={() => openReschedule(t)} disabled={!work} accessibilityLabel={`Due ${dueLabel(t.dueDate)}${work ? '. Reschedule' : ''}`} className="flex-row items-center gap-3">
            <CalendarClock size={20} color={isOverdue(t) ? theme.danger : theme.muted} />
            <Text className={cn('flex-1 font-body-medium', isOverdue(t) && 'text-danger')}>{t.dueDate ? new Date(t.dueDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) : 'No due date'}{isOverdue(t) ? ', overdue' : ''}</Text>
            {work && <Text className="font-body-semibold text-accent-ink">Change</Text>}
          </Pressable>
          {work && !manage && <Text className="text-xs text-muted">Moving the date needs a reason. {t.createdBy?.name || 'The creator'} gets told.</Text>}
        </View>
        <View className="gap-1.5">
          <Label>PRIORITY</Label>
          {manage ? (
            <View className="flex-row flex-wrap gap-2">
              {TASK_PRIORITY.map((p) => <Chip key={p.value} label={p.label} active={t.priority === p.value} onPress={() => p.value !== t.priority && save({ priority: p.value }, `Priority ${p.label}`)} />)}
            </View>
          ) : <Text className="font-body-medium">{taskPriority(t.priority).label}</Text>}
        </View>
      </Card>

      {work ? (
        <Input
          label="Description"
          value={description}
          onChangeText={setDescription}
          onFocus={descFocus}
          onBlur={() => descDone() && description.trim() !== (t.description || '') && save({ description: description.trim() }, 'Description saved')}
          placeholder="Add details, links, the brief"
          multiline
          maxLength={5000}
          style={{ minHeight: 96, height: undefined, paddingTop: 14, paddingBottom: 14, textAlignVertical: 'top' }}
          hint={t.status === 'done' ? 'Changing the description reopens this task.' : undefined}
        />
      ) : !!t.description && (
        <View className="gap-1.5">
          <Label>DESCRIPTION</Label>
          <Text selectable>{t.description}</Text>
        </View>
      )}
      <Checklist task={t} />
      <Subtasks task={t} />
      <FilesStrip task={t} />
      <TaskChat task={t} />
      <TimeTracker task={t} />

      <Pressable onPress={() => setMore((m) => !m)} accessibilityRole="button" accessibilityState={{ expanded: more }} className="h-12 flex-row items-center justify-center gap-2 rounded-full bg-surface-2">
        <Text className="font-body-semibold">{more ? 'Fewer details' : 'More details'}</Text>
        {more ? <ChevronUp size={18} color={theme.ink} /> : <ChevronDown size={18} color={theme.ink} />}
      </Pressable>
      {more && (
        <>
          <Card className="gap-4 p-4">
            <DateField label="Start date" disabled={!work} value={t.startDate ? ymd(t.startDate) : ''} onChange={(v) => save({ startDate: v }, 'Start date saved')} onClear={() => save({ startDate: null }, 'Start date cleared')} placeholder="Not set" />
            <Input label="Estimated hours" editable={work} value={hours} onChangeText={setHours} onFocus={hoursFocus} keyboardType="decimal-pad" placeholder="0" onBlur={() => { const n = Number(hours || 0); if (hoursDone() && n >= 0 && n !== (t.estimatedHours || 0)) save({ estimatedHours: n }, 'Estimate saved'); }} />
            <View className="gap-2">
              <Label>TAGS</Label>
              {!!t.tags?.length && (
                <View className="flex-row flex-wrap items-center gap-2">
                  {t.tags.map((g) => (
                    <Pressable key={g} disabled={!work} onPress={() => save({ tags: t.tags.filter((x) => x !== g) })} accessibilityLabel={`Remove tag ${g}`} className="h-9 flex-row items-center gap-1 rounded-full bg-sand px-3">
                      <Text className="text-sm text-brown">#{g}</Text>
                      {work && <X size={14} color={theme.ink} />}
                    </Pressable>
                  ))}
                </View>
              )}
              {work && <Input value={tag} onChangeText={setTag} onSubmitEditing={addTag} submitBehavior="submit" placeholder="Add a tag" accessibilityLabel="Add a tag" autoCapitalize="none" maxLength={40} returnKeyType="done" />}
            </View>
            {t.recurring?.enabled && (
              <View className="flex-row items-center gap-2"><Repeat size={14} color={theme.muted} /><Text className="text-sm text-muted">Repeats {t.recurring.interval > 1 ? `every ${t.recurring.interval} ` : ''}{t.recurring.frequency}</Text></View>
            )}
            <Text className="text-xs text-muted">Created by {t.createdBy?.name || 'someone'} on {new Date(t.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}{t.completedAt ? `, done ${new Date(t.completedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : ''}</Text>
          </Card>
          <Dependencies task={t} />
          <ActivityLog task={t} />
          {isAdmin(me) && <ConfirmDelete label="Delete task" loading={d.isLoading} onConfirm={async () => { if (await runAction(del(t._id), 'Task deleted', "Couldn't delete")) backTo('/tasks'); }} />}
        </>
      )}
    </>
  );
}

export default function TaskDetail() {
  const { id } = useLocalSearchParams();
  const { data, isLoading, isError, error, refetch } = useGetTaskByIdQuery(id);
  useEntityRoom('task', id, 'Task');
  useFocusEffect(useCallback(() => { setViewing(id); return () => setViewing(null); }, [id]));
  const refreshControl = usePullRefresh(refetch);
  const task = data?.data?.task;
  const gone = [403, 404].includes(error?.status) && 'This task is gone';
  return (
    <Screen scroll className="gap-5 pt-2" refreshControl={refreshControl}>
      {task ? <TaskBody key={task._id} task={task} /> : (
        <>
          <PageHeader caption="TASK" title="" fallback="/tasks" />
          <DashboardState isLoading={isLoading} isError={isError || (!isLoading && !task)} refetch={refetch} gone={gone} onBack={() => backTo('/tasks')} />
        </>
      )}
    </Screen>
  );
}
