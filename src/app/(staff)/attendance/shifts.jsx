import { View } from 'react-native';
import { router } from 'expo-router';
import { Clock3, Plus } from 'lucide-react-native';
import { Badge, Button, Card, DashboardState, EmptyState, PageHeader, Screen, Text, usePullRefresh } from '@/components';
import { useGetShiftsQuery } from '@/services/attendanceApi';
import { formatHours } from '@/utils/formatters';
import { toDisplay } from '@/utils/time';
import { cn } from '@/utils/cn';

// Admin: working hours and grace periods. The default shift decides who counts as late.
export default function Shifts() {
  const { data, isLoading, isError, refetch } = useGetShiftsQuery();
  const refreshControl = usePullRefresh(refetch);
  const list = data?.data || [];
  const edit = (s) => router.push({
    pathname: '/attendance/shift-form',
    params: s ? { id: s._id, name: s.name, startTime: s.startTime, endTime: s.endTime, gracePeriod: String(s.gracePeriod ?? 15), isDefault: s.isDefault ? '1' : '', isActive: s.isActive === false ? '' : '1' } : {},
  });

  return (
    <Screen scroll className="gap-5 pt-2" refreshControl={refreshControl}>
      <PageHeader caption="ATTENDANCE" title="Shifts" right={<Button title="Add" icon={Plus} size="sm" onPress={() => edit()} />} />
      {isLoading || isError ? <DashboardState isLoading={isLoading} isError={isError} refetch={refetch} /> : list.length ? (
        <View className="gap-3">
          {list.map((s) => (
            <Card key={s._id} onPress={() => edit(s)} accessibilityLabel={`${s.name}, ${toDisplay(s.startTime)} to ${toDisplay(s.endTime)}`} className={cn('gap-2', s.isActive === false && 'opacity-60')}>
              <View className="flex-row items-center gap-2">
                <Text className="flex-1 font-body-semibold">{s.name}</Text>
                {s.isDefault && <Badge label="Default" color="bg-ink text-bg" />}
                {s.isActive === false && <Badge label="Off" color="bg-surface-2 text-muted" />}
              </View>
              <Text className="font-display text-title tabular-nums">{toDisplay(s.startTime)} – {toDisplay(s.endTime)}</Text>
              <Text className="text-sm text-muted">{s.duration ? `${formatHours(s.duration)} · ` : ''}{s.gracePeriod ?? 15} min grace before late</Text>
            </Card>
          ))}
        </View>
      ) : (
        <EmptyState icon={Clock3} title="No shifts yet" message="Without one, 9:00 AM – 6:00 PM with 15 minutes' grace is used." actionTitle="Add shift" onAction={() => edit()} />
      )}
    </Screen>
  );
}
