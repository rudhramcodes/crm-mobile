import { useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { router } from 'expo-router';
import { useSelector } from 'react-redux';
import {
  BarChart3, Calendar, CheckCircle2, CircleAlert, ClipboardCheck, Clock, CloudOff, CreditCard, IndianRupee, ListTodo, MapPin, Percent, Plus,
  TrendingUp, UserCheck, Users, Video, Wallet,
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
import { ActivityRow, BarList, BrandMark, MonthBars, Ring, Section, StatTile, StatusCounts, shortDate } from './DashboardParts';
import { useGetDashboardOverviewQuery, useGetEmployeeDashboardQuery } from '@/services/dashboardApi';
import { BRANDS, LEAD_SOURCES, LEAD_STATUS, TASK_PRIORITY, TASK_STATUS } from '@/constants';
import { useTheme } from '@/constants/theme';
import { canWriteModule } from '@/utils/access';
import { formatCompactCurrency, formatCurrency } from '@/utils/formatters';
import { toDisplay } from '@/utils/time';

const labelOf = (list, value) => list.find((i) => i.value === value)?.label || String(value ?? 'Other').replace(/_/g, ' ');
const TASK_DOT = { todo: 'bg-muted', in_progress: 'bg-sand', review: 'bg-accent', done: 'bg-success' };
// Server groups come back in any order; show them in workflow order.
const taskCounts = (byStatus = []) => TASK_STATUS.map((t) => ({ key: t.value, label: t.label, count: byStatus.find((s) => s.status === t.value)?.count || 0, dot: TASK_DOT[t.value] }));
// Stages in pipeline order; sources (no stage) biggest first.
const byStage = (list) => (a, b) => (a.status ? list.findIndex((i) => i.value === a.status) - list.findIndex((i) => i.value === b.status) : b.count - a.count);
const ACTIVITY_ICON = { lead: Users, client: UserCheck, payment: CreditCard, meeting: Calendar, task: ListTodo };
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

function ActivitySection({ items, empty = 'Activity shows up here as the team works.' }) {
  return (
    <Section title="Recent activity">
      {items?.length ? (
        <View>
          {items.map((a, i) => (
            <ActivityRow
              key={a._id || i}
              icon={ACTIVITY_ICON[a.type] || Calendar}
              title={a.title}
              description={a.description}
              right={(
                <View className="items-end gap-1">
                  <Text className="text-xs text-muted">{shortDate(a.timestamp)}</Text>
                  {a.user ? <Text numberOfLines={1} className="max-w-[90px] text-xs text-muted">{a.user}</Text> : null}
                  {a.priority ? <Badge label={labelOf(TASK_PRIORITY, a.priority)} color={TASK_PRIORITY.find((p) => p.value === a.priority)?.color} /> : null}
                </View>
              )}
            />
          ))}
        </View>
      ) : (
        <Text className="text-sm text-muted">{empty}</Text>
      )}
    </Section>
  );
}

// Admin / manager Home: same sections as the web /dashboard, stacked for a phone.
export function AdminDashboard() {
  const theme = useTheme();
  const user = useSelector((s) => s.auth.user);
  const { data, isLoading, isError, refetch } = useGetDashboardOverviewQuery();
  const refreshControl = usePullRefresh(refetch);
  const d = data?.data;
  const k = d?.kpis;
  const byBrand = Object.fromEntries((d?.clients?.byBrand || []).map((b) => [b.brand, b.count]));
  const aging = d?.invoices?.aging || [];

  return (
    <Screen scroll className="gap-5 pt-6" refreshControl={refreshControl}>
      <HomeHeader subtitle={today()} />
      <View className="flex-row gap-3">
        {canWriteModule(user, 'leads') && <Button title="New lead" icon={Plus} size="sm" className="flex-1" onPress={() => router.push('/leads/new')} />}
        <Button title="Reports" icon={BarChart3} variant="secondary" size="sm" className="flex-1" onPress={() => router.push('/reports')} />
      </View>
      <AttendanceCard />
      {!d ? <DashboardState isLoading={isLoading} isError={isError} refetch={refetch} /> : (
        <>
          <View className="flex-row flex-wrap gap-3">
            {/* Same icons as the web dashboard's KPI cards; Wallet and Percent where the web repeats or has none. */}
            <StatTile label="TOTAL LEADS" icon={Users} value={k.totalLeads} sub={`${k.conversionRate}% converted`} onPress={() => router.push('/leads')} />
            <StatTile label="ACTIVE CLIENTS" icon={UserCheck} tone="success" value={k.activeClients} sub={`${k.activeProjects} active project${k.activeProjects === 1 ? '' : 's'}`} onPress={() => router.push('/clients')} />
            <StatTile label="REVENUE" icon={IndianRupee} tone="success" value={formatCompactCurrency(k.totalRevenue)} sub={`${formatCurrency(k.totalRevenue)}, excl. cash`} onPress={() => router.push('/payments')} />
            <StatTile label="CASH COLLECTED" icon={Wallet} tone="success" value={formatCompactCurrency(k.cashCollected)} sub={`${formatCurrency(k.cashCollected)}, separate`} onPress={() => router.push('/payments')} />
            <StatTile label="PENDING PAYMENTS" icon={Clock} value={k.pendingPayments} sub="Unpaid invoices" onPress={() => router.push('/invoices')} />
            <StatTile label="OVERDUE" icon={CircleAlert} tone="danger" value={k.overdueInvoices} sub="Past due date" alert={k.overdueInvoices > 0} onPress={() => router.push('/invoices')} />
            <StatTile label="CONVERSION" icon={TrendingUp} value={`${k.conversionRate}%`} sub="Leads won" onPress={() => router.push('/leads')} />
            <StatTile label="COLLECTION RATE" icon={Percent} tone="success" value={`${k.collectionRate}%`} sub="Of invoiced amount" onPress={() => router.push('/invoices')} />
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

          <RevenueSection revenue={d.revenue} collected={k.totalRevenue} sub="Collected (excl. cash) per month. Tap a month." />
          <PipelineSection sub="Leads at each stage" rows={d.pipeline?.byStatus} list={LEAD_STATUS} />
          <PipelineSection title="Lead sources" sub="Where leads come from" rows={d.pipeline?.bySource} list={LEAD_SOURCES} />

          <Section title="Invoice aging" sub="Outstanding by days past due" action="Invoices" onAction={() => router.push('/invoices')}>
            {aging.some((a) => a.count) ? (
              <BarList rows={aging.map((a) => ({ key: a.label, label: `${a.label} · ${a.count}`, value: a.amount, display: formatCurrency(a.amount) }))} />
            ) : (
              <View className="flex-row items-center gap-3">
                <CheckCircle2 size={22} color={theme.success} />
                <Text className="flex-1 text-sm text-muted">All invoices cleared. Nothing is past due.</Text>
              </View>
            )}
          </Section>

          <TasksSection tasks={d.tasks} />
          <ActivitySection items={d.recentActivity} />
        </>
      )}
    </Screen>
  );
}

// Employee Home: my tasks, upcoming meetings, my activity, quick links (web /dashboard for employees).
export function EmployeeDashboard() {
  const { data, isLoading, isError, refetch } = useGetEmployeeDashboardQuery();
  const refreshControl = usePullRefresh(refetch);
  const theme = useTheme();
  const d = data?.data;
  const tasks = d?.tasks;

  return (
    <Screen scroll className="gap-5 pt-6" refreshControl={refreshControl}>
      <HomeHeader subtitle={today()} />
      <AttendanceCard />
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

          <Section title="Upcoming meetings" action="View all" onAction={() => router.push('/meetings')}>
            {d.meetings?.length ? (
              <View>
                {d.meetings.map((m, i) => (
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

          <ActivitySection items={d.activity} empty="Activity shows up here as you work." />

          <Section title="Quick links">
            <View>
              <ListRow icon={ListTodo} label="Tasks Hub" hint="View and submit your tasks" onPress={() => router.push('/tasks')} />
              <ListRow icon={ClipboardCheck} label="Attendance" hint="Punches, calendar, regularize" onPress={() => router.push('/attendance')} />
              <ListRow icon={Wallet} label="My payslips" hint="Salary slips and tax info" onPress={() => router.push('/my-payslips')} />
              <ListRow icon={Calendar} label="Meetings" hint="Team and client syncs" onPress={() => router.push('/meetings')} />
            </View>
          </Section>
        </>
      )}
    </Screen>
  );
}
