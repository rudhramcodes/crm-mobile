import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSelector } from 'react-redux';
import { Alert, Avatar, Button, Chip, DateField, Input, Pressable, Screen, SheetHeader, Text, Toggle, UserPicker, backTo } from '@/components';
import { TASK_PRIORITY, TASK_STATUS } from '@/constants';
import { useCreateTaskMutation } from '@/services/taskApi';
import { useGetProjectByIdQuery, useGetProjectsQuery } from '@/services/projectApi';
import { runAction } from '@/utils/attendance';
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

// Full task form. Params prefill it: title, status, dueDate, project (from quick add, a board column or a calendar day).
export default function NewTask() {
  const p = useLocalSearchParams();
  const me = useSelector((s) => s.auth.user);
  const [create, { isLoading, error }] = useCreateTaskMutation();
  const [title, setTitle] = useState(p.title || '');
  const [description, setDescription] = useState('');
  const [assignee, setAssignee] = useState({ _id: me._id, name: me.name, avatar: me.avatar });
  const [picking, setPicking] = useState(false);
  const [project, setProject] = useState(p.project || '');
  const [milestone, setMilestone] = useState('');
  const [dueDate, setDue] = useState(p.dueDate || '');
  const [startDate, setStart] = useState('');
  const [hours, setHours] = useState('');
  const [priority, setPriority] = useState('medium');
  const [status, setStatus] = useState(p.status || 'todo');
  const [tags, setTags] = useState('');
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
      assignedTo: assignee._id,
      project: project || undefined,
      milestone: milestone || undefined,
      dueDate,
      startDate: startDate || undefined,
      estimatedHours: hours.trim() ? Number(hours) : undefined,
      priority,
      status,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      recurring: recurring ? { enabled: true, frequency, interval: 1 } : undefined,
    };
    const res = await runAction(create(body), 'Task created', "Couldn't create the task");
    const id = res?.data?.task?._id;
    if (id) router.replace(`/tasks/${id}`);
    else if (res) backTo('/tasks');
  };

  return (
    <Screen scroll edges={['bottom']} className="gap-4 pt-6">
      <SheetHeader title="New task" sub="Fields with * are required." closeLabel="Cancel" />
      <Alert message={fieldErrors.length ? '' : message} />
      <Input label="Title *" value={title} onChangeText={setTitle} placeholder="Edit the wedding teaser" maxLength={200} error={err('title')} />
      <Input label="Description" value={description} onChangeText={setDescription} multiline maxLength={5000} style={{ height: 96, paddingTop: 14, textAlignVertical: 'top' }} error={err('description')} />

      <View className="gap-1.5">
        <Text className="font-body-medium text-sm">Assignee *</Text>
        {picking ? <UserPicker label="Search people" onPick={(u) => { setAssignee(u); setPicking(false); }} /> : (
          <Pressable onPress={() => setPicking(true)} accessibilityLabel={`Assignee: ${assignee.name}. Change`} className="flex-row items-center gap-3 rounded-2xl bg-surface-2 px-4 py-3">
            <Avatar name={assignee.name} uri={assignee.avatar} size={32} />
            <Text className="flex-1 font-body-medium">{assignee._id === me._id ? `${assignee.name} (me)` : assignee.name}</Text>
            <Text className="font-body-semibold text-accent-ink">Change</Text>
          </Pressable>
        )}
        {!!err('assignedTo') && <Text className="text-sm text-danger">{err('assignedTo')}</Text>}
      </View>

      <DateField label="Due date *" value={dueDate} onChange={setDue} minDate={startDate || undefined} error={err('dueDate')} />
      <DateField label="Start date" value={startDate} onChange={(d) => { setStart(d); if (dueDate && d > dueDate) setDue(d); }} error={err('startDate')} />
      <Chips label="Priority" items={TASK_PRIORITY.map((x) => [x.value, x.label])} value={priority} onChange={setPriority} />
      <Chips label="Status" items={TASK_STATUS.map((x) => [x.value, x.label])} value={status} onChange={setStatus} />
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

      <Button title="Create task" loading={isLoading} disabled={title.trim().length < 2 || !dueDate || badHours} onPress={save} />
    </Screen>
  );
}
