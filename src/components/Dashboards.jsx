import { useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { router } from 'expo-router';
import { useSelector } from 'react-redux';
import {
  BarChart3, Calendar, CalendarDays, CheckCircle2, CircleAlert, CloudOff, IndianRupee, ListTodo, MapPin, Plane, Plus, UserCheck,
  Users, Video,
} from 'lucide-react-native';
import { Screen } from './Screen';
import { Text } from './Text';
import { Badge } from './Badge';
import { Button } from './Button';
import { Skeleton } from './Skeleton';
import { EmptyState } from './EmptyState';
import { ListRow } from './ListRow';
import { HomeHeader } from './SignedInHome';
import { AttendanceCard } from './AttendanceCard';
import { CalendarCard } from './WorkCalendar';
import { ActivityRow, BarList, BrandMark, MonthBars, Ring, Section, StatTile, StatusCounts, shortDate } from './DashboardParts';
import { useGetDashboardOverviewQuery, useGetEmployeeDashboardQuery } from '@/services/dashboardApi';
import { useGetMeetingsQuery } from '@/services/meetingApi';
import { useGetLeaveBalanceQuery } from '@/services/attendanceApi';
import { BRANDS, TASK_PRIORITY, TASK_STATUS } from '@/constants';
import { useTheme } from '@/constants/theme';
import { canOpenPath, canWriteModule } from '@/utils/access';
import { formatCompactCurrency, formatCurrency } from '@/utils/formatters';
import { toDisplay } from '@/utils/time';
import { ymd } from '@/utils/attendance';

const labelOf = (list, value) => list.find((i) => i.value === value)?.label || String(value ?? 'Other').replace(/_/g, ' ');
const TASK_DOT = { todo: 'bg-muted', in_progress: 'bg-sand', review: 'bg-accent', done: 'bg-success' };
// Server groups come back in any order; show them in workflow order.
const taskCounts = (byStatus = []) => TASK_STATUS.map((t) => ({ key: t.value, label: t.label, count: byStatus.find((s) => s.status === t.value)?.count || 0, dot: TASK_DOT[t.value] }));
// Stages in pipeline order; sources (no stage) biggest first.
const byStage = (list) => (a, b) => (a.status ? list.findIndex((i) => i.value === a.status) - list.findIndex((i) => i.value === b.status) : b.count - a.count);
const today = () => new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

// Pull to refresh that spins only for the pull, not for background polling.
export function usePullRefresh(refetch) {
  const theme = useTheme();
  const [pulling, setPulling] = useState(false);
  const onRefresh = () => {
    setPulling(true);
    refetch().finally(() => setPulling(false));
  };
  return <RefreshControl refreshing={pulling} onRefresh={onRefresh} tintColor={theme.accent} colors={[theme.accent]} />;
}

// Loading skeleton or an error with retry; null once data is in.
// `gone` (e.g. a 404 from an old notification): say it was deleted and offer a way back instead of a useless retry.
export function DashboardState({ isLoading, isError, refetch, gone, onBack }) {
  if (gone) {
    return <EmptyState icon={CloudOff} title={gone} message="It may have been deleted, or you no longer have access." actionTitle="Go back" onAction={onBack} />;
  }
  if (isLoading) {
    return (
      <View className="gap-3">
        <View className="flex-row gap-3"><Skeleton className="h-28 flex-1 rounded-3xl" /><Skeleton className="h-28 flex-1 rounded-3xl" /></View>
        <Skeleton className="h-56 rounded-3xl" />
      </View>
    );
  }
  if (isError) {
    return <EmptyState icon={CloudOff} title="Couldn't load this" message="Check your connection and try again." actionTitle="Try again" onAction={refetch} />;
  }
  return null;
}

export function RevenueSection({ revenue, collected, sub }) {
  const months = revenue?.monthly || [];
  return (
    <Section title="Revenue trend" sub={sub}>
      {months.length ? (
        <MonthBars months={months} value={(m) => m.collected} describe={(m) => `${formatCurrency(m.collected)} collected · ${formatCurrency(m.outstanding)} outstanding`} />
      ) : (
        <Text className="text-sm text-muted">No revenue yet.</Text>
      )}
      <View className="flex-row justify-between border-t border-line pt-3">
        <Text className="text-xs text-muted">Collected (excl. cash){'\n'}<Text className="font-body-semibold text-sm text-ink tabular-nums">{formatCurrency(collected)}</Text></Text>
        <Text className="text-right text-xs text-muted">Outstanding{'\n'}<Text className="font-body-semibold text-sm text-ink tabular-nums">{formatCurrency(revenue?.summary?.totalOutstanding)}</Text></Text>
      </View>
    </Section>
  );
}

export function PipelineSection({ title = 'Lead pipeline', sub, rows, list }) {
  return (
    <Section title={title} sub={sub} action="Leads" onAction={() => router.push('/leads')}>
      {rows?.length ? (
        <BarList rows={[...rows].sort(byStage(list)).map((r) => ({ key: String(r.status ?? r.source), label: labelOf(list, r.status ?? r.source), value: r.count }))} />
      ) : (
        <Text className="text-sm text-muted">No leads yet.</Text>
      )}
    </Section>
  );
}

export function TasksSection({ tasks, title = 'Task completion', sub }) {
  return (
    <Section title={title} sub={sub} action="Tasks" onAction={() => router.push('/tasks')}>
      <View className="flex-row items-center gap-5">
        <Ring done={tasks?.done || 0} total={tasks?.total || 0} label="tasks done" />
        <StatusCounts items={taskCounts(tasks?.byStatus)} />
      </View>
    </Section>
  );
}

// Upcoming meetings list, shared by both Homes. `loading` shows a short skeleton instead of "no meetings".
export function MeetingsSection({ meetings, loading, sub, max = 5 }) {
  const theme = useTheme();
  // The server sorts by day only; order same-day meetings by start time.
  const sorted = [...(meetings || [])].sort((a, b) => `${String(a.date).slice(0, 10)}${a.startTime}`.localeCompare(`${String(b.date).slice(0, 10)}${b.startTime}`)).slice(0, max);
  return (
    <Section title="Upcoming meetings" sub={sub} action="View all" onAction={() => router.push('/meetings')}>
      {loading ? <Skeleton className="h-16 rounded-2xl" /> : sorted.length ? (
        <View>
          {sorted.map((m, i) => (
            <ActivityRow
              key={m._id || i}
              icon={Calendar}
              title={m.title}
              description={[`${shortDate(m.date)}, ${toDisplay(m.startTime)}–${toDisplay(m.endTime)}`, m.lead?.name || m.client?.companyName].filter(Boolean).join(' · ')}
              onPress={m._id ? () => router.push(`/meetings/${m._id}`) : undefined}
              right={(
                <View className="flex-row gap-1.5">
                  {!!m.meetingLink && <Video size={16} color={theme.muted} />}
                  {!!m.location && <MapPin size={16} color={theme.muted} />}
                </View>
              )}
            />
          ))}
        </View>
      ) : (
        <Text className="text-sm text-muted">{"No upcoming meetings. You're all clear."}</Text>
      )}
    </Section>
  );
}

// Admin / manager Home: a short summary; detailed charts live in Reports and the venture dashboards.
export function AdminDashboard() {
  const user = useSelector((s) => s.auth.user);
  const { data, isLoading, isError, refetch } = useGetDashboardOverviewQuery();
  const refreshControl = usePullRefresh(refetch);
  const d = data?.data;
  // A partial answer (no kpis) shows zeros instead of crashing Home.
  const k = d?.kpis ?? {};
  const byBrand = Object.fromEntries((d?.clients?.byBrand || []).map((b) => [b.brand, b.count]));
  // Tiles only link to pages this person can open (managers can't open money pages or Reports).
  const go = (path) => (canOpenPath(user, path) ? () => router.push(path) : undefined);
  const meetingsQ = useGetMeetingsQuery({ status: 'scheduled', dateFrom: ymd(new Date()), sortBy: 'date', sortOrder: 'asc', page: 1, limit: 10 });

  return (
    <Screen tab scroll className="gap-5 pt-6" refreshControl={refreshControl}>
      <HomeHeader subtitle={today()} />
      <View className="flex-row gap-3">
        {canWriteModule(user, 'leads') && <Button title="New lead" icon={Plus} size="sm" className="flex-1" onPress={() => router.push('/leads/new')} />}
        {canOpenPath(user, '/reports') && <Button title="Reports" icon={BarChart3} variant="secondary" size="sm" className="flex-1" onPress={() => router.push('/reports')} />}
      </View>
      <AttendanceCard />
      <CalendarCard />
      {!d ? <DashboardState isLoading={isLoading} isError={isError} refetch={refetch} /> : (
        <>
          <View className="flex-row flex-wrap gap-3">
            {/* Only the 4 numbers people act on; the full breakdown lives in Reports and the venture dashboards. */}
            <StatTile label="TOTAL LEADS" icon={Users} value={k.totalLeads ?? 0} sub={`${k.conversionRate ?? 0}% converted`} onPress={go('/leads')} />
            <StatTile label="ACTIVE CLIENTS" icon={UserCheck} tone="success" value={k.activeClients ?? 0} sub={`${k.activeProjects ?? 0} active project${k.activeProjects === 1 ? '' : 's'}`} onPress={go('/clients')} />
            <StatTile label="REVENUE" icon={IndianRupee} tone="success" value={formatCompactCurrency(k.totalRevenue)} sub="Excl. cash, last 12 months" onPress={go('/payments')} />
            <StatTile label="OVERDUE" icon={CircleAlert} tone="danger" value={k.overdueInvoices ?? 0} sub={`${k.pendingPayments ?? 0} pending payments`} alert={k.overdueInvoices > 0} onPress={go('/invoices')} />
          </View>

          <Section title="Ventures" sub="Clients per brand. Tap one for its dashboard.">
            <View>
              {BRANDS.map((b) => (
                <ListRow
                  key={b.value}
                  icon={() => <BrandMark brand={b.value} />}
                  label={b.label}
                  hint={`${byBrand[b.value] || 0} clients`}
                  onPress={() => router.push(`/dashboard/venture/${b.value}`)}
                />
              ))}
            </View>
          </Section>

          <RevenueSection revenue={d.revenue} collected={k.totalRevenue} sub="Collected (excl. cash), last 12 months. Tap a month." />
          <MeetingsSection meetings={meetingsQ.data?.data} loading={meetingsQ.isLoading} sub="Next on the company calendar" max={4} />
          <TasksSection tasks={d.tasks} />
        </>
      )}
    </Screen>
  );
}

const NO_TASKS = { total: 0, done: 0, byStatus: [], items: [] };

// Employee Home: leave left with one-tap links, my tasks and upcoming meetings.
function TimeOffSection() {
  const me = useSelector((s) => s.auth.user);
  const bal = useGetLeaveBalanceQuery(me._id);
  const b = bal.data?.data?.balance;
  const left = (k) => (b?.[k]?.balance ?? (bal.isLoading ? '…' : '—'));
  return (
    <Section title="Time off" action="Calendar" onAction={() => router.push('/attendance/calendar')}>
      <View className="flex-row gap-3">
        {[['casual', 'Casual'], ['sick', 'Sick']].map(([k, label]) => (
          <View key={k} className="flex-1 gap-0.5 rounded-2xl bg-surface-2 p-3" accessible accessibilityLabel={`${label} leave left: ${left(k)}`}>
            <Text className="text-caption text-muted">{label.toUpperCase()} LEFT</Text>
            <Text className="font-display text-numeral tabular-nums">{left(k)}</Text>
          </View>
        ))}
      </View>
      <View className="flex-row gap-3">
        <Button title="Apply leave" icon={Plane} size="sm" className="flex-1" onPress={() => router.push('/attendance/apply-leave')} />
        <Button title="My leaves" icon={CalendarDays} size="sm" variant="secondary" className="flex-1" onPress={() => router.push('/attendance/leaves')} />
      </View>
    </Section>
  );
}

export function EmployeeDashboard() {
  const { data, isLoading, isError, refetch } = useGetEmployeeDashboardQuery();
  const refreshControl = usePullRefresh(refetch);
  const theme = useTheme();
  const d = data?.data;
  // A partial answer (no tasks block) shows an empty ring instead of crashing Home.
  const tasks = { ...NO_TASKS, ...d?.tasks };

  return (
    <Screen tab scroll className="gap-5 pt-6" refreshControl={refreshControl}>
      <HomeHeader subtitle={today()} />
      <AttendanceCard />
      <CalendarCard />
      {!d ? <DashboardState isLoading={isLoading} isError={isError} refetch={refetch} /> : (
        <>
          <Section title="My tasks" action="View all" onAction={() => router.push('/tasks')}>
            <View className="flex-row items-center gap-5">
              <Ring done={tasks.done} total={tasks.total} label="tasks completed" />
              <StatusCounts items={taskCounts(tasks.byStatus).filter((s) => s.key !== 'done')} />
            </View>
            {tasks.items?.length ? (
              <View className="border-t border-line pt-2">
                {tasks.items.map((t) => (
                  <ActivityRow
                    key={t._id}
                    icon={ListTodo}
                    title={t.title}
                    description={[t.project?.name, t.dueDate && `Due ${shortDate(t.dueDate)}`].filter(Boolean).join(' · ')}
                    onPress={() => router.push(`/tasks/${t._id}`)}
                    right={<Badge label={labelOf(TASK_PRIORITY, t.priority)} color={TASK_PRIORITY.find((p) => p.value === t.priority)?.color} />}
                  />
                ))}
              </View>
            ) : tasks.total - tasks.done === 0 && (
              <View className="flex-row items-center gap-3 border-t border-line pt-4">
                <CheckCircle2 size={22} color={theme.success} />
                <Text className="flex-1 text-sm text-muted">All tasks completed. Your queue is clear.</Text>
              </View>
            )}
          </Section>

          <MeetingsSection meetings={d.meetings} />
          <TimeOffSection />

        </>
      )}
    </Screen>
  );
}
