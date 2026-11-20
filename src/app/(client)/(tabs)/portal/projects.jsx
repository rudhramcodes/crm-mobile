import { View } from 'react-native';
import { FolderOpen } from 'lucide-react-native';
import { Card, ClientTaskRow, DashboardState, EmptyState, Heading, Screen, Text, usePullRefresh } from '@/components';
import { useGetTasksQuery } from '@/services/taskApi';

// A client's view of the work: their projects' tasks, grouped by project, open ones first.
// shortcut: first 100 tasks; add paging when a client routinely has more.
export default function PortalProjects() {
  const { data, isLoading, isError, refetch } = useGetTasksQuery({ page: 1, limit: 100, sort: '-updatedAt' });
  const refreshControl = usePullRefresh(refetch);
  const tasks = [...(data?.data || [])].sort((a, b) => (a.status === 'done') - (b.status === 'done'));
  const groups = Object.values(tasks.reduce((m, t) => {
    const k = t.project?._id || 'none';
    (m[k] ||= { key: k, title: t.project?.title || 'Other work', tasks: [] }).tasks.push(t);
    return m;
  }, {}));

  return (
    <Screen scroll className="gap-5 pt-6" refreshControl={refreshControl}>
      <Heading>Projects</Heading>
      {isLoading || isError ? <DashboardState isLoading={isLoading} isError={isError} refetch={refetch} /> : !groups.length ? (
        <EmptyState icon={FolderOpen} title="No work to show yet" message="When the team starts on your project, its tasks show up here." />
      ) : groups.map((g) => {
        const done = g.tasks.filter((t) => t.status === 'done').length;
        return (
          <View key={g.key} className="gap-2">
            <View className="flex-row items-end justify-between px-1">
              <Text className="flex-1 font-display text-title">{g.title}</Text>
              <Text className="text-sm text-muted tabular-nums">{done} of {g.tasks.length} done</Text>
            </View>
            <Card className="gap-0 p-0">
              {g.tasks.map((t, i) => <ClientTaskRow key={t._id} task={t} first={!i} />)}
            </Card>
          </View>
        );
      })}
    </Screen>
  );
}
