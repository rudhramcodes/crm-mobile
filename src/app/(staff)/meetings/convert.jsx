import { useState } from 'react';
import { Platform, ScrollView, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Avatar, Button, Chip, DateField, Pressable, Screen, SheetHeader, Text, UserPicker, backTo, showToast } from '@/components';
import { useConvertActionItemMutation } from '@/services/meetingApi';
import { useGetProjectsQuery } from '@/services/projectApi';
import { useGetUsersQuery } from '@/services/userApi';
import { runAction } from '@/utils/attendance';

// Action item → task. Tasks need a project, an assignee and a deadline (same checks as the web).
export default function ConvertActionItem() {
  const p = useLocalSearchParams();
  const [convert, { isLoading }] = useConvertActionItemMutation();
  const projects = useGetProjectsQuery({ page: 1, limit: 100 }).data?.data || [];
  const users = useGetUsersQuery({ limit: 100 }).data?.data?.users || [];
  const [project, setProject] = useState('');
  const [assignee, setAssignee] = useState(p.assignee ? { _id: p.assignee } : null);
  const [picking, setPicking] = useState(false);
  const [dueDate, setDueDate] = useState(p.dueDate || '');
  const who = assignee && (users.find((u) => u._id === assignee._id) || assignee);

  const save = async () => {
    if (!project) return showToast({ title: 'Select a project to convert to' });
    if (!assignee) return showToast({ title: 'Select an assignee' });
    if (!dueDate) return showToast({ title: 'Select a deadline' });
    const ok = await runAction(
      convert({ id: p.id, itemId: p.itemId, projectId: project, assignedTo: assignee._id, dueDate }),
      'Action item converted to task',
      'Failed to convert to task',
    );
    if (ok) backTo(`/meetings/${p.id}`);
  };

  return (
    <Screen scroll edges={Platform.OS === 'android' ? ['top', 'bottom'] : ['bottom']} className="gap-4 pt-6">
      <SheetHeader title="Convert to task" sub="Tasks require an assignee and a deadline." closeLabel="Cancel" />
      <View className="rounded-2xl bg-surface-2 p-3"><Text>{p.text}</Text></View>

      <View className="gap-1.5">
        <Text className="font-body-medium text-sm">Project</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-5" contentContainerClassName="gap-2 px-5">
          {projects.map((x) => <Chip key={x._id} label={x.title} active={project === x._id} onPress={() => setProject(x._id)} />)}
        </ScrollView>
        {!projects.length && <Text className="text-sm text-muted">No projects found.</Text>}
      </View>

      {picking || !assignee ? (
        <UserPicker label="Assignee" onPick={(u) => { setAssignee(u); setPicking(false); }} onCancel={assignee ? () => setPicking(false) : undefined} />
      ) : (
        <View className="gap-1.5">
          <Text className="font-body-medium text-sm">Assignee</Text>
          <Pressable onPress={() => setPicking(true)} accessibilityLabel={`Assignee ${who?.name || ''}. Change`} className="flex-row items-center gap-3 rounded-2xl bg-surface-2 px-3 py-2.5">
            <Avatar name={who?.name || '?'} uri={who?.avatar} size={32} />
            <Text className="flex-1 font-body-medium">{who?.name || 'Assigned person'}</Text>
            <Text className="font-body-semibold text-sm text-accent-ink">Change</Text>
          </Pressable>
        </View>
      )}

      <DateField label="Deadline" value={dueDate} onChange={setDueDate} placeholder="Pick a deadline" />
      <Button title="Convert to task" loading={isLoading} onPress={save} />
    </Screen>
  );
}
