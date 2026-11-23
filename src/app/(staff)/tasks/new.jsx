import { useState } from 'react';
import { Platform, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSelector } from 'react-redux';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { Alert, Button, Chip, DateField, Input, PeoplePicker, Pressable, Screen, SheetHeader, Text, Toggle, backTo } from '@/components';
import { TASK_PRIORITY, TASK_STATUS } from '@/constants';
import { useTheme } from '@/constants/theme';
import { useCreateTaskMutation } from '@/services/taskApi';
import { useGetProjectByIdQuery, useGetProjectsQuery } from '@/services/projectApi';
import { runAction, ymd } from '@/utils/attendance';
import { apiError } from '@/utils/apiError';
import { getFieldError } from '@/utils/getFieldError';

const FREQ = [['daily', 'Daily'], ['weekly', 'Weekly'], ['monthly', 'Monthly']];

function Chips({ label, items, value, onChange }) {
  return (
    <View className="gap-1.5">
      <Text className="font-body-medium text-sm">{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-5" contentContainerClassName="gap-2 px-5">
        {items.map(([v, l]) => <Chip key={v || 'none'} label={l} active={value === v} onPress={() => onChange(v)} />)}
      </ScrollView>
    </View>
  );
}

// Task form: the four things every task needs up front (due defaults to today), the rest under "More options".
// Params prefill it: title, status, dueDate, project, priority, tags, people (JSON) — from quick add, a board column or a calendar day.
export default function NewTask() {
  const p = useLocalSearchParams();
  const theme = useTheme();
  const me = useSelector((s) => s.auth.user);
  const [more, setMore] = useState(!!(p.status || p.project || p.tags));
  const [create, { isLoading, error }] = useCreateTaskMutation();
  const [title, setTitle] = useState(p.title || '');
  const [description, setDescription] = useState('');
  const [team, setTeam] = useState(() => {
    const people = p.people ? JSON.parse(p.people) : [{ _id: me._id, name: me.name, avatar: me.avatar }];
    return { owner: people[0] || null, helpers: people.slice(1) };
  });
  const [copyForEach, setCopyForEach] = useState(false);
  const [project, setProject] = useState(p.project || '');
  const [milestone, setMilestone] = useState('');
  // Quick add can send a time ("5pm"); keep it unless the date is changed here.
  const timedDue = p.dueDate?.includes('T') ? p.dueDate : null;
  const [dueDate, setDue] = useState(p.dueDate ? ymd(p.dueDate) : ymd());
  const [startDate, setStart] = useState('');
  const [hours, setHours] = useState('');
  const [priority, setPriority] = useState(p.priority || 'medium');
  const [status, setStatus] = useState(['todo', 'in_progress'].includes(p.status) ? p.status : 'todo');
  const [tags, setTags] = useState(p.tags || '');
  const [recurring, setRecurring] = useState(false);
  const [frequency, setFrequency] = useState('weekly');
  const projects = useGetProjectsQuery({ page: 1, limit: 50 }).data?.data || [];
  const milestones = useGetProjectByIdQuery(project, { skip: !project }).data?.data?.project?.milestones || [];
  const { message, fieldErrors } = apiError(error);
  const err = (k) => getFieldError(fieldErrors, k);
  const badHours = !!hours.trim() && !(Number(hours) >= 0);

  const save = async () => {
    const body = {
      title: title.trim(),
      description: description.trim() || undefined,
      assignedTo: team.owner?._id,
      helpers: team.helpers.map((h) => h._id),
      copyForEach: team.helpers.length ? copyForEach : undefined,
      project: project || undefined,
      milestone: milestone || undefined,
      dueDate: timedDue && ymd(timedDue) === dueDate ? timedDue : dueDate,
      startDate: startDate || undefined,
      estimatedHours: hours.trim() ? Number(hours) : undefined,
      priority,
      status,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      recurring: recurring ? { enabled: true, frequency, interval: 1 } : undefined,
    };
    const res = await runAction(create(body), 'Task created', "Couldn't create the task");
    const id = res?.data?.task?._id;
    if (res?.data?.tasks?.length > 1) backTo('/tasks');
    else if (id) router.replace(`/tasks/${id}`);
    else if (res) backTo('/tasks');
  };

  return (
    <Screen scroll edges={Platform.OS === 'android' ? ['top', 'bottom'] : ['bottom']} className="gap-4 pt-6">
      <SheetHeader title="New task" closeLabel="Cancel" />
      <Alert message={fieldErrors.length ? '' : message} />
      <Input label="What needs doing?" value={title} onChangeText={setTitle} placeholder="Edit the wedding teaser" maxLength={200} autoFocus={!p.title} error={err('title')} />

      <View className="gap-1.5">
        <Text className="font-body-medium text-sm">Who does it?</Text>
        <Text className="text-sm text-muted">The star is the owner. Everyone else helps.</Text>
        <PeoplePicker owner={team.owner} helpers={team.helpers} onChange={setTeam} />
        {!!err('assignedTo') && <Text className="text-sm text-danger">{err('assignedTo')}</Text>}
      </View>
      {!!team.helpers.length && (
        <View className="flex-row items-center gap-3">
          <View className="flex-1">
            <Text className="font-body-medium">Copy for each person</Text>
            <Text className="text-sm text-muted">{copyForEach ? `${team.helpers.length + 1} separate tasks, each reviewed on its own.` : 'Off: one task everyone shares.'}</Text>
          </View>
          <Toggle value={copyForEach} onValueChange={setCopyForEach} label="Copy for each person" />
        </View>
      )}

      <DateField label="Due" value={dueDate} onChange={setDue} minDate={startDate || undefined} error={err('dueDate')} />
      <Chips label="Priority" items={TASK_PRIORITY.map((x) => [x.value, x.label])} value={priority} onChange={setPriority} />

      <Pressable onPress={() => setMore((m) => !m)} accessibilityRole="button" accessibilityState={{ expanded: more }} className="h-12 flex-row items-center justify-center gap-2 rounded-full bg-surface-2">
        <Text className="font-body-semibold">{more ? 'Fewer options' : 'More options'}</Text>
        {more ? <ChevronUp size={18} color={theme.ink} /> : <ChevronDown size={18} color={theme.ink} />}
      </Pressable>
      {more && (
        <>
          <Input label="Description" value={description} onChangeText={setDescription} multiline maxLength={5000} style={{ height: 96, paddingTop: 14, textAlignVertical: 'top' }} error={err('description')} />
          <DateField label="Start date" value={startDate} onChange={(d) => { setStart(d); if (dueDate && d > dueDate) setDue(d); }} error={err('startDate')} />
          <Chips label="Status" items={TASK_STATUS.filter((x) => ['todo', 'in_progress'].includes(x.value)).map((x) => [x.value, x.label])} value={status} onChange={setStatus} />
          {!!projects.length && <Chips label="Project" items={[['', 'None'], ...projects.map((x) => [x._id, x.title])]} value={project} onChange={(v) => { setProject(v); setMilestone(''); }} />}
          {!!milestones.length && <Chips label="Milestone" items={[['', 'None'], ...milestones.map((x) => [x._id, x.title])]} value={milestone} onChange={setMilestone} />}
          <Input label="Estimated hours" value={hours} onChangeText={setHours} keyboardType="decimal-pad" placeholder="4" error={badHours ? 'Enter a number of hours' : err('estimatedHours')} />
          <Input label="Tags" value={tags} onChangeText={setTags} placeholder="edit, urgent-client" autoCapitalize="none" hint="Separate with commas." error={err('tags')} />

          <View className="flex-row items-center gap-3">
            <View className="flex-1">
              <Text className="font-body-medium">Repeats</Text>
              <Text className="text-sm text-muted">A new copy is created on schedule.</Text>
            </View>
            <Toggle value={recurring} onValueChange={setRecurring} label="Repeats" />
          </View>
          {recurring && <Chips label="Every" items={FREQ} value={frequency} onChange={setFrequency} />}
        </>
      )}

      <Button title={copyForEach && team.helpers.length ? `Create ${team.helpers.length + 1} tasks` : 'Create task'} loading={isLoading} disabled={title.trim().length < 2 || !dueDate || !team.owner || badHours} onPress={save} />
    </Screen>
  );
}
