import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import {
  Card, ClientTaskRow, DashboardState, DeliverablesCard, MilestonesCard, PageHeader, ProjectChat, ProjectFiles, Screen, StageMeter, Text, backTo, usePullRefresh,
} from '@/components';
import { useEntityRoom } from '@/hooks/useEntityRoom';
import { useGetProjectByIdQuery } from '@/services/projectApi';
import { useGetTasksQuery } from '@/services/taskApi';
import { shortDate, stageOf } from '@/utils/projects';

// A client's project: where it stands, the work, what they'll receive, and the chat with the team.
// Read-only apart from the chat; the server sends the client view (no budget, internal activity or emails).
export default function PortalProject() {
  const { id } = useLocalSearchParams();
  const { data, isLoading, isError, error, refetch } = useGetProjectByIdQuery(id);
  const tq = useGetTasksQuery({ project: id, page: 1, limit: 100, sort: '-updatedAt' });
  useEntityRoom('project', id, 'Project');
  const refreshControl = usePullRefresh(() => Promise.all([refetch(), tq.refetch()]));
  const p = data?.data?.project;
  const tasks = tq.data?.data || [];

  if (!p) {
    return (
      <Screen scroll className="gap-5 pt-2" refreshControl={refreshControl}>
        <PageHeader caption="PROJECT" title="" fallback="/portal/projects" />
        <DashboardState isLoading={isLoading} isError={isError || !isLoading} refetch={refetch} gone={[403, 404].includes(error?.status) && 'This project is gone'} onBack={() => backTo('/portal/projects')} />
      </Screen>
    );
  }
  return (
    <Screen scroll className="gap-5 pt-2" refreshControl={refreshControl}>
      <PageHeader caption={p.projectCode ? `PROJECT ${p.projectCode}` : 'PROJECT'} title={p.title} fallback="/portal/projects" />
      <Card className="gap-3 p-4">
        <View className="flex-row items-end justify-between">
          <Text className="font-body-semibold">{stageOf(p.stage)?.label || 'In progress'}</Text>
          {!!p.deadline && <Text className="text-sm text-muted">Target {shortDate(p.deadline)}</Text>}
        </View>
        <StageMeter stage={p.stage} />
        {!!p.location && <Text className="text-sm text-muted">{p.location}</Text>}
        {!!p.description && <Text selectable className="border-t border-line pt-3">{p.description}</Text>}
      </Card>
      <DeliverablesCard project={p} canEdit={false} />
      <MilestonesCard project={p} canEdit={false} />
      {!!tasks.length && (
        <View className="gap-2">
          <Text className="font-display text-title">Work</Text>
          <Card className="gap-0 p-0">{tasks.map((t, i) => <ClientTaskRow key={t._id} task={t} first={!i} />)}</Card>
        </View>
      )}
      <ProjectChat project={p} />
      <ProjectFiles projectId={p._id} tasks={tasks} />
    </Screen>
  );
}
