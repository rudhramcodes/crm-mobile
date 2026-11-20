import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { BarList, Card, DashboardState, PageHeader, Ring, Screen, Section, StatTile, StatusCounts, Text, usePullRefresh } from '@/components';
import { TASK_PRIORITY } from '@/constants';
import { useGetTasksQuery, useGetWatchedTasksQuery } from '@/services/taskApi';
import { formatHours } from '@/utils/formatters';
import { isOverdue } from '@/utils/tasks';

const DOTS = { todo: 'bg-muted', in_progress: 'bg-sand', review: 'bg-accent', done: 'bg-success' };
// Tiles are narrow: "1.5h" fits where "1h 30m" truncates.
const short = (h) => `${Math.round(h * 10) / 10}h`;
const LABELS = { todo: 'To do', in_progress: 'In progress', review: 'In review', done: 'Done' };

// Same tasks the Tasks tab shows (its filters come in `q`): completion, overdue, hours, priority mix and team workload.
export default function TaskInsights() {
  const { q: raw } = useLocalSearchParams();
  const { watching, ...params } = JSON.parse(raw || '{}');
  const all = useGetTasksQuery(params, { skip: !!watching });
  const watched = useGetWatchedTasksQuery(params, { skip: !watching });
  const q = watching ? watched : all;
  const refreshControl = usePullRefresh(q.refetch);
  const tasks = q.data?.data || [];

  const count = (fn) => tasks.filter(fn).length;
  const done = count((t) => t.status === 'done');
  const est = tasks.reduce((s, t) => s + (Number(t.estimatedHours) || 0), 0);
  const actual = tasks.reduce((s, t) => s + (Number(t.actualHours) || Number(t.totalLoggedHours) || 0), 0);
  // Owners and helpers both carry the task; logged hours count once, for the owner.
  const people = Object.values(tasks.reduce((m, t) => {
    [t.assignedTo || null, ...(t.helpers || [])].forEach((p, i) => {
      const k = p?._id || 'none';
      m[k] ||= { key: k, label: p?.name || 'Unassigned', total: 0, open: 0, hours: 0 };
      m[k].total += 1;
      if (t.status !== 'done') m[k].open += 1;
      if (!i) m[k].hours += Number(t.actualHours) || Number(t.totalLoggedHours) || 0;
    });
    return m;
  }, {})).sort((a, b) => b.open - a.open);

  return (
    <Screen scroll className="gap-5 pt-2" refreshControl={refreshControl}>
      <PageHeader caption="TASKS" title="Insights" fallback="/tasks" />
      {q.isLoading || q.isError ? <DashboardState isLoading={q.isLoading} isError={q.isError} refetch={q.refetch} /> : (
        <>
          <Card className="flex-row items-center gap-5">
            <Ring done={done} total={tasks.length} />
            <StatusCounts items={Object.keys(LABELS).map((k) => ({ key: k, label: LABELS[k], dot: DOTS[k], count: count((t) => t.status === k) }))} />
          </Card>
          <View className="gap-3">
            <View className="flex-row gap-3">
              <StatTile label="OVERDUE" value={count(isOverdue)} alert={count(isOverdue) > 0} sub="Past due, not done" />
              <StatTile label="TASKS" value={tasks.length} sub={tasks.length >= 100 ? 'First 100 shown' : 'In this view'} />
            </View>
            <View className="flex-row gap-3">
              <StatTile label="ESTIMATED" value={short(est)} sub="Planned effort" />
              <StatTile label="LOGGED" value={short(actual)} sub={est ? `${Math.round((actual / est) * 100)}% of estimate` : 'No estimates yet'} />
            </View>
          </View>
          <Section title="By priority">
            <BarList rows={TASK_PRIORITY.map((p) => ({ key: p.value, label: p.label, value: count((t) => t.priority === p.value) }))} />
          </Section>
          {!!people.length && (
            <Section title="Team workload" sub="Open tasks per person">
              <BarList rows={people.map((x) => ({ key: x.key, label: x.label, value: x.open, display: `${x.open} open · ${x.total - x.open} done${x.hours ? ` · ${formatHours(x.hours)}` : ''}` }))} />
            </Section>
          )}
          {!tasks.length && <Text className="text-sm text-muted">No tasks in this view yet.</Text>}
        </>
      )}
    </Screen>
  );
}
