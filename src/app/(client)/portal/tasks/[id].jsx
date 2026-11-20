import { useCallback } from 'react';
import { View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { CalendarClock } from 'lucide-react-native';
import {
  Avatar, Card, Checklist, DashboardState, FilesStrip, PageHeader, Screen, TaskChat, TaskStatusBadge, Text, backTo, usePullRefresh,
} from '@/components';
import { useGetTaskByIdQuery } from '@/services/taskApi';
import { useEntityRoom } from '@/hooks/useEntityRoom';
import { setViewing } from '@/services/push';
import { useTheme } from '@/constants/theme';
import { dueLabel, taskProgress } from '@/utils/tasks';

// What a client sees of one task: where it stands, who's on it, the brief, files, and the chat with the team.
// Read-only apart from the chat; the server strips internal history, time logs and review notes.
export default function PortalTask() {
  const theme = useTheme();
  const { id } = useLocalSearchParams();
  const { data, isLoading, isError, error, refetch } = useGetTaskByIdQuery(id);
  useEntityRoom('task', id, 'Task');
  useFocusEffect(useCallback(() => { setViewing(id); return () => setViewing(null); }, [id]));
  const refreshControl = usePullRefresh(refetch);
  const t = data?.data?.task;
  const back = () => backTo('/portal/projects');

  if (!t) {
    return (
      <Screen scroll className="gap-5 pt-2" refreshControl={refreshControl}>
        <PageHeader caption="TASK" title="" fallback="/portal/projects" />
        <DashboardState isLoading={isLoading} isError={isError || !isLoading} refetch={refetch} gone={[403, 404].includes(error?.status) && 'This task is gone'} onBack={back} />
      </Screen>
    );
  }

  const pct = taskProgress(t);
  return (
    <Screen scroll className="gap-5 pt-2" refreshControl={refreshControl}>
      <PageHeader caption={t.project?.title?.toUpperCase() || 'TASK'} title={t.title} fallback="/portal/projects" />
      <Card className="gap-4 p-4">
        <View className="flex-row items-center gap-3">
          <TaskStatusBadge status={t.status} />
          <Text className="flex-1 text-right text-sm text-muted tabular-nums">{pct}% done</Text>
        </View>
        <View className="h-1.5 overflow-hidden rounded-full bg-sand">
          <View className={t.status === 'done' ? 'h-full rounded-full bg-success' : 'h-full rounded-full bg-accent'} style={{ width: `${pct}%` }} />
        </View>
        {!!t.assignedTo && (
          <View className="flex-row items-center gap-3">
            <Avatar name={t.assignedTo.name} uri={t.assignedTo.avatar} size={32} />
            <Text className="flex-1 font-body-medium">{t.assignedTo.name}<Text className="text-sm text-muted"> is working on this</Text></Text>
          </View>
        )}
        {!!t.dueDate && t.status !== 'done' && (
          <View className="flex-row items-center gap-3">
            <CalendarClock size={20} color={theme.muted} />
            <Text className="flex-1 font-body-medium">Due {dueLabel(t.dueDate)}</Text>
          </View>
        )}
      </Card>
      {!!t.description && (
        <View className="gap-1.5">
          <Text className="text-caption text-muted">DETAILS</Text>
          <Text selectable>{t.description}</Text>
        </View>
      )}
      {!!t.checklists?.length && <Checklist task={t} />}
      <FilesStrip task={t} />
      <TaskChat task={t} />
    </Screen>
  );
}
