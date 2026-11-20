import { router } from 'expo-router';
import { Button, Card, ClientTaskRow, HomeHeader, Screen, Text, usePullRefresh } from '@/components';
import { useGetTasksQuery } from '@/services/taskApi';

// Client home: a hello, then the five tasks that moved most recently, so "what's new?" is one glance.
export default function ClientPortal() {
  const { data, refetch } = useGetTasksQuery({ page: 1, limit: 5, sort: '-updatedAt' });
  const refreshControl = usePullRefresh(refetch);
  const tasks = data?.data || [];
  return (
    <Screen scroll className="gap-5 pt-6" refreshControl={refreshControl}>
      <HomeHeader subtitle="Here's where your work stands." />
      {!!tasks.length && (
        <>
          <Text className="font-display text-title">Latest updates</Text>
          <Card className="gap-0 p-0">{tasks.map((t, i) => <ClientTaskRow key={t._id} task={t} first={!i} />)}</Card>
          <Button title="See all projects" variant="secondary" onPress={() => router.push('/portal/projects')} />
        </>
      )}
    </Screen>
  );
}
