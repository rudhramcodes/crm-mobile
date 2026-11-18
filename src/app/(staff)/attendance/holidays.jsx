import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useSelector } from 'react-redux';
import { CalendarHeart, ChevronLeft, ChevronRight, Plus, Repeat } from 'lucide-react-native';
import { Badge, Button, Card, DashboardState, EmptyState, PageHeader, Pressable, Screen, Text, fromYmd, usePullRefresh } from '@/components';
import { useGetHolidaysQuery } from '@/services/attendanceApi';
import { HOLIDAY_TYPES } from '@/constants';
import { useTheme } from '@/constants/theme';
import { isAdmin, ymd } from '@/utils/attendance';
import { cn } from '@/utils/cn';

const typeMeta = (v) => HOLIDAY_TYPES.find((t) => t.value === v) || HOLIDAY_TYPES[1];

// The year's holidays; past ones fade. Admins add, edit and delete from here.
export default function Holidays() {
  const theme = useTheme();
  const me = useSelector((s) => s.auth.user);
  const admin = isAdmin(me);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const { data, isLoading, isError, refetch } = useGetHolidaysQuery({ year, page: 1, limit: 100 });
  const refreshControl = usePullRefresh(refetch);
  const list = [...(data?.data || [])].sort((a, b) => new Date(a.date) - new Date(b.date));
  const today = ymd();
  const edit = (h) => router.push({ pathname: '/attendance/holiday-form', params: h ? { id: h._id, name: h.name, date: ymd(h.date), type: h.type, description: h.description || '', isRecurring: h.isRecurring ? '1' : '' } : {} });

  return (
    <Screen scroll className="gap-5 pt-2" refreshControl={refreshControl}>
      <PageHeader caption="ATTENDANCE" title="Holidays" right={admin ? <Button title="Add" icon={Plus} size="sm" onPress={() => edit()} /> : undefined} />
      <View className="flex-row items-center">
        <Pressable onPress={() => setYear((y) => y - 1)} accessibilityLabel="Previous year" className="h-11 w-11 items-center justify-center"><ChevronLeft size={22} color={theme.ink} /></Pressable>
        <Text className="flex-1 text-center font-body-semibold text-lg tabular-nums">{year}</Text>
        <Pressable onPress={() => setYear((y) => y + 1)} accessibilityLabel="Next year" className="h-11 w-11 items-center justify-center"><ChevronRight size={22} color={theme.ink} /></Pressable>
      </View>

      {isLoading || isError ? <DashboardState isLoading={isLoading} isError={isError} refetch={refetch} /> : list.length ? (
        <View className="gap-3">
          {list.map((h) => {
            const d = fromYmd(ymd(h.date));
            const past = ymd(h.date) < today;
            const t = typeMeta(h.type);
            return (
              <Card key={h._id} onPress={admin ? () => edit(h) : undefined} accessibilityLabel={`${h.name}, ${d.toDateString()}, ${t.label}`} className={cn('flex-row items-center gap-4 p-4', past && 'opacity-60')}>
                <View className="w-12 items-center">
                  <Text className="font-display text-title tabular-nums">{d.getDate()}</Text>
                  <Text className="text-caption text-muted">{d.toLocaleString('en-IN', { month: 'short' }).toUpperCase()}</Text>
                </View>
                <View className="flex-1 gap-1">
                  <Text className="font-body-semibold">{h.name}</Text>
                  <Text className="text-sm text-muted">{d.toLocaleString('en-IN', { weekday: 'long' })}{h.description ? ` · ${h.description}` : ''}</Text>
                  <View className="flex-row items-center gap-2">
                    <Badge label={t.label} color={t.color} />
                    {h.isRecurring && <Repeat size={14} color={theme.muted} accessibilityLabel="Repeats every year" />}
                  </View>
                </View>
              </Card>
            );
          })}
        </View>
      ) : (
        <EmptyState icon={CalendarHeart} title={`No holidays for ${year}`} message={admin ? 'Add the year’s national and company holidays.' : 'Your admin hasn’t added any yet.'} actionTitle={admin ? 'Add holiday' : undefined} onAction={() => edit()} />
      )}
    </Screen>
  );
}
