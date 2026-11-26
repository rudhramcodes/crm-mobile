import { View } from 'react-native';
import { router } from 'expo-router';
import { useSelector } from 'react-redux';
import { BarChart3, CalendarDays, CalendarHeart, ChevronRight, Clock3, FilePenLine, ListChecks, Plane } from 'lucide-react-native';
import { Badge, ClockPanel, Heading, ListRow, MonthStats, Screen, Section, Text, usePullRefresh } from '@/components';
import {
  useGetAttendanceStatsQuery, useGetHolidaysQuery, useGetLeavesQuery, useGetRegularizationRequestsQuery, useGetTodayStatusQuery,
} from '@/services/attendanceApi';
import { useTheme } from '@/constants/theme';
import { isAdmin, isLead, monthRange } from '@/utils/attendance';

const todayLabel = () => new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
// Pending count next to the chevron; ListRow drops its own chevron whenever `right` is set.
function Count({ n }) {
  const theme = useTheme();
  return (
    <View className="flex-row items-center gap-2">
      {n > 0 && <Badge label={String(n)} variant="warning" />}
      <ChevronRight size={18} color={theme.muted} />
    </View>
  );
}

export default function AttendanceTab() {
  const user = useSelector((s) => s.auth.user);
  const lead = isLead(user);
  const today = useGetTodayStatusQuery(undefined, { pollingInterval: 60000 });
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const stats = useGetAttendanceStatsQuery(monthRange(year, month));
  const holidays = useGetHolidaysQuery({ year, page: 1, limit: 100 });
  const regs = useGetRegularizationRequestsQuery('pending', { skip: !lead });
  const leaves = useGetLeavesQuery({ status: 'pending', page: 1, limit: 1 });
  const refreshControl = usePullRefresh(() => Promise.all([today.refetch(), stats.refetch(), leaves.refetch(), ...(lead ? [regs.refetch()] : [])]));
  const pendingLeaves = leaves.data?.pagination?.pendingCount ?? 0;
  const pendingRegs = regs.data?.data?.requests?.length ?? 0;

  return (
    <Screen tab scroll className="gap-5 pt-6" refreshControl={refreshControl}>
      <View>
        <Text className="text-sm text-muted">{todayLabel()}</Text>
        <Heading>Attendance</Heading>
      </View>

      <ClockPanel />

      <Section title="This month" sub="Your attendance so far" action="Calendar" onAction={() => router.push('/attendance/calendar')}>
        <MonthStats stats={stats.data?.data} year={year} month={month} holidays={holidays.data?.data} today={today.data?.data?.attendance} onPress={() => router.push('/attendance/calendar')} />
      </Section>

      <View>
        <ListRow icon={CalendarDays} label="My calendar" hint="Month view and day details" onPress={() => router.push('/attendance/calendar')} />
        <ListRow icon={Plane} label="Leaves" hint={lead ? 'Balance, requests and approvals' : 'Balance and requests'} right={lead ? <Count n={pendingLeaves} /> : undefined} onPress={() => router.push('/attendance/leaves')} />
        <ListRow icon={FilePenLine} label="Regularization" hint={lead ? 'Corrections to approve and your requests' : 'Fix a missed or wrong punch'} right={lead ? <Count n={pendingRegs} /> : undefined} onPress={() => router.push('/attendance/regularization')} />
        <ListRow icon={CalendarHeart} label="Holidays" hint="National, company and optional" onPress={() => router.push('/attendance/holidays')} />
        {lead && (
          <>
            <ListRow icon={ListChecks} label="Attendance records" hint="Filter, view and edit any day" onPress={() => router.push('/attendance/records')} />
            <ListRow icon={BarChart3} label="Reports" hint="Daily, weekly and monthly" onPress={() => router.push('/attendance/reports')} />
            {isAdmin(user) && <ListRow icon={Clock3} label="Shifts" hint="Hours and grace periods" onPress={() => router.push('/attendance/shifts')} />}
          </>
        )}
      </View>
    </Screen>
  );
}
