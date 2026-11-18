import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSelector } from 'react-redux';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Card, DashboardState, MonthStats, PageHeader, Pressable, Screen, Text, usePullRefresh } from '@/components';
import { statusMeta } from '@/components/AttendanceParts';
import { useGetAttendanceCalendarQuery, useGetAttendanceStatsQuery, useGetHolidaysQuery } from '@/services/attendanceApi';
import { ATTENDANCE_STATUS } from '@/constants';
import { useTheme } from '@/constants/theme';
import { monthRange, ymd } from '@/utils/attendance';
import { cn } from '@/utils/cn';

const WEEK = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const monthName = (y, m) => new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(new Date(y, m - 1, 1));

// Month view coloured by day status (own, or any employee's for admins and managers via ?employee=&name=).
export default function AttendanceCalendar() {
  const theme = useTheme();
  const me = useSelector((s) => s.auth.user);
  const { employee, name } = useLocalSearchParams();
  const employeeId = employee || me._id;
  const [{ year, month }, setYm] = useState(() => ({ year: new Date().getFullYear(), month: new Date().getMonth() + 1 }));
  const cal = useGetAttendanceCalendarQuery({ employeeId, year, month });
  const stats = useGetAttendanceStatsQuery({ employee: employee || undefined, ...monthRange(year, month) });
  const { data: hol } = useGetHolidaysQuery({ year, page: 1, limit: 100 });
  const refreshControl = usePullRefresh(() => Promise.all([cal.refetch(), stats.refetch()]));

  const shift = (d) => setYm(({ year: y, month: m }) => {
    const n = new Date(y, m - 1 + d, 1);
    return { year: n.getFullYear(), month: n.getMonth() + 1 };
  });

  const byDay = Object.fromEntries((cal.data?.data?.records || []).map((r) => [ymd(r.date), r]));
  const holidays = Object.fromEntries((hol?.data || []).map((h) => [ymd(h.date), h.name]));
  const today = ymd();
  const days = new Date(year, month, 0).getDate();
  const lead = (new Date(year, month - 1, 1).getDay() + 6) % 7; // Monday-first offset
  const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => ymd(new Date(year, month - 1, i + 1)))];

  const statusOf = (d) => byDay[d]?.status || (holidays[d] ? 'holiday' : fromDay(d) === 0 ? 'weekend' : null);

  return (
    <Screen scroll className="gap-5 pt-2" refreshControl={refreshControl}>
      <PageHeader caption={name ? 'ATTENDANCE' : 'MY CALENDAR'} title={name || 'My calendar'} />

      <Card className="gap-4 p-4">
        <View className="flex-row items-center">
          <Pressable onPress={() => shift(-1)} accessibilityLabel="Previous month" className="h-11 w-11 items-center justify-center"><ChevronLeft size={22} color={theme.ink} /></Pressable>
          <Text className="flex-1 text-center font-body-semibold text-lg">{monthName(year, month)}</Text>
          <Pressable onPress={() => shift(1)} accessibilityLabel="Next month" className="h-11 w-11 items-center justify-center"><ChevronRight size={22} color={theme.ink} /></Pressable>
        </View>
        <View className="flex-row">
          {WEEK.map((w, i) => <Text key={i} className="flex-1 text-center text-caption text-muted">{w}</Text>)}
        </View>
        {cal.isLoading ? <DashboardState isLoading /> : (
          <View className="flex-row flex-wrap">
            {cells.map((d, i) => {
              if (!d) return <View key={`x${i}`} className="aspect-square w-[14.28%]" />;
              const s = statusOf(d);
              const r = byDay[d];
              const m = s && statusMeta(s);
              const label = [Number(d.slice(8)), m?.label, holidays[d], r?.isLate && 'late'].filter(Boolean).join(', ');
              return (
                <View key={d} className="aspect-square w-[14.28%] p-0.5">
                  <Pressable
                    onPress={() => router.push({ pathname: '/attendance/day', params: { date: d, employee: employee || '', name: name || '' } })}
                    accessibilityLabel={label}
                    className={cn('flex-1 items-center justify-center gap-1 rounded-xl', d === today && 'border-[1.5px] border-accent', r && 'bg-surface-2')}
                  >
                    <Text className={cn('font-body-medium text-sm tabular-nums', d > today && 'text-muted')}>{Number(d.slice(8))}</Text>
                    <View className="h-1.5 flex-row gap-0.5">
                      {m && <View className={cn('h-1.5 w-1.5 rounded-full', m.dot)} />}
                      {r?.isLate && <View className="h-1.5 w-1.5 rounded-full bg-danger" />}
                    </View>
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}
        <View className="flex-row flex-wrap gap-x-4 gap-y-2">
          {ATTENDANCE_STATUS.map((s) => (
            <View key={s.value} className="flex-row items-center gap-1.5">
              <View className={cn('h-2 w-2 rounded-full', s.dot)} />
              <Text className="text-xs text-muted">{s.label}</Text>
            </View>
          ))}
          <View className="flex-row items-center gap-1.5">
            <View className="flex-row gap-0.5"><View className="h-2 w-2 rounded-full bg-success" /><View className="h-2 w-2 rounded-full bg-danger" /></View>
            <Text className="text-xs text-muted">Late (extra red dot)</Text>
          </View>
        </View>
      </Card>

      <MonthStats stats={stats.data?.data} />
    </Screen>
  );
}

const fromDay = (d) => new Date(`${d}T00:00:00`).getDay();
