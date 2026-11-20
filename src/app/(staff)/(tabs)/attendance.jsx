import { View } from 'react-native';
import { router } from 'expo-router';
import { useSelector } from 'react-redux';
import { BarChart3, CalendarDays, CalendarHeart, Clock3, FilePenLine, ListChecks, Plane } from 'lucide-react-native';
import { Badge, ClockPanel, Heading, ListRow, MonthStats, Screen, Section, StatTile, Text, usePullRefresh } from '@/components';
import {
  useGetAttendanceOverviewStatsQuery, useGetAttendanceStatsQuery, useGetLeavesQuery, useGetRegularizationRequestsQuery, useGetTodayStatusQuery,
} from '@/services/attendanceApi';
import { isAdmin, isLead } from '@/utils/attendance';

const todayLabel = () => new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
const Count = ({ n }) => (n > 0 ? <Badge label={String(n)} variant="warning" /> : undefined);

export default function AttendanceTab() {
  const user = useSelector((s) => s.auth.user);
  const lead = isLead(user);
  const today = useGetTodayStatusQuery(undefined, { pollingInterval: 60000 });
  const stats = useGetAttendanceStatsQuery({});
  const overview = useGetAttendanceOverviewStatsQuery({}, { skip: !lead });
  const regs = useGetRegularizationRequestsQuery('pending', { skip: !lead });
  const leaves = useGetLeavesQuery({ status: 'pending', page: 1, limit: 1 });
  const refreshControl = usePullRefresh(() => Promise.all([today.refetch(), stats.refetch(), leaves.refetch(), ...(lead ? [overview.refetch(), regs.refetch()] : [])]));
  const o = overview.data?.data;
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
        <MonthStats stats={stats.data?.data} onPress={() => router.push('/attendance/calendar')} />
      </Section>

      <View>
        <ListRow icon={CalendarDays} label="My calendar" hint="Month view and day details" onPress={() => router.push('/attendance/calendar')} />
        <ListRow icon={Plane} label="Leaves" hint={lead ? 'Balance, requests and approvals' : 'Balance and requests'} right={lead ? <Count n={pendingLeaves} /> : undefined} onPress={() => router.push('/attendance/leaves')} />
        <ListRow icon={FilePenLine} label="Regularization" hint={lead ? 'Corrections to approve and your requests' : 'Fix a missed or wrong punch'} right={lead ? <Count n={pendingRegs} /> : undefined} onPress={() => router.push('/attendance/regularization')} />
        <ListRow icon={CalendarHeart} label="Holidays" hint="National, company and optional" onPress={() => router.push('/attendance/holidays')} />
      </View>

      {lead && (
        <>
          <Section title="Team today" sub={o ? `${o.totalEmployees} staff` : 'Loading…'} action="Records" onAction={() => router.push('/attendance/records')}>
            <View className="flex-row flex-wrap gap-3">
              <StatTile label="PRESENT" value={o?.presentCount ?? '—'} sub={`${o?.wfhCount ?? 0} working from home`} onPress={() => router.push({ pathname: '/attendance/records', params: { status: 'present' } })} />
              <StatTile label="ABSENT" value={o?.absentCount ?? '—'} alert={o?.absentCount > 0} onPress={() => router.push({ pathname: '/attendance/records', params: { status: 'absent' } })} />
              <StatTile label="ON LEAVE" value={o?.leaveCount ?? '—'} onPress={() => router.push({ pathname: '/attendance/records', params: { status: 'leave' } })} />
              <StatTile label="LATE" value={o?.lateCount ?? '—'} onPress={() => router.push({ pathname: '/attendance/records', params: { status: 'late' } })} />
            </View>
          </Section>
          <View>
            <ListRow icon={ListChecks} label="Attendance records" hint="Filter, view and edit any day" onPress={() => router.push('/attendance/records')} />
            <ListRow icon={BarChart3} label="Reports" hint="Daily, weekly and monthly" onPress={() => router.push('/attendance/reports')} />
            {isAdmin(user) && <ListRow icon={Clock3} label="Shifts" hint="Hours and grace periods" onPress={() => router.push('/attendance/shifts')} />}
          </View>
        </>
      )}
    </Screen>
  );
}
