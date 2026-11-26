import { useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { router } from 'expo-router';
import { useSelector } from 'react-redux';
import { CheckCircle2, CloudOff, ListTodo, MapPin, Plane, CalendarDays, Video } from 'lucide-react-native';
import { Screen } from './Screen';
import { Text } from './Text';
import { Badge } from './Badge';
import { Button } from './Button';
import { Avatar } from './Avatar';
import { Pressable } from './Pressable';
import { Skeleton } from './Skeleton';
import { EmptyState } from './EmptyState';
import { ListRow } from './ListRow';
import { HomeHeader } from './SignedInHome';
import { AttendanceCard } from './AttendanceCard';
import { CalendarCard } from './WorkCalendar';
import { leaveDays } from './AttendanceParts';
import {
  ActivityRow, BarList, BrandMark, DotGrid, HatchBars, KpiTile, Legend, Numeral, Section, SplitBar, StageBar, shortDate,
} from './DashboardParts';
import { ZoomLink } from './ZoomLink';
import { useGetDashboardOverviewQuery, useGetEmployeeDashboardQuery } from '@/services/dashboardApi';
import { useGetMeetingsQuery } from '@/services/meetingApi';
import { useGetAttendanceOverviewStatsQuery, useGetLeaveBalanceQuery, useGetLeavesQuery } from '@/services/attendanceApi';
import { BRANDS, LEAD_SOURCES, LEAD_STATUS, LEAVE_TYPES, TASK_PRIORITY, TASK_STATUS } from '@/constants';
import { useTheme } from '@/constants/theme';
import { canOpenPath } from '@/utils/access';
import { formatCompactCurrency } from '@/utils/formatters';
import { toDisplay } from '@/utils/time';
import { isLead, ymd } from '@/utils/attendance';
import { cn } from '@/utils/cn';

const labelOf = (list, value) => list.find((i) => i.value === value)?.label || String(value ?? 'Other').replace(/_/g, ' ');
const TASK_DOT = { todo: 'bg-muted', in_progress: 'bg-sand', review: 'bg-accent', done: 'bg-success' };
// Server groups come back in any order; show them in workflow order.
const taskCounts = (byStatus = []) => TASK_STATUS.map((t) => ({ key: t.value, label: t.label, count: byStatus.find((s) => s.status === t.value)?.count || 0, dot: TASK_DOT[t.value] }));
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

// Collected over 12 months with the last 6 as hatched bars; tap a bar for its month. `onOpen` adds the ↗.
export function RevenueSection({ revenue, collected, sub, onOpen }) {
  const months = (revenue?.monthly || []).slice(-6);
  return (
    <Section title="Revenue" sub={sub} action={onOpen && 'Open revenue'} onAction={onOpen}>
      <View className="flex-row items-end justify-between gap-3">
        <View className="shrink">
          <Text className="text-caption text-muted">COLLECTED · 12 MONTHS</Text>
          <Numeral value={formatCompactCurrency(collected)} />
        </View>
        <View className="items-end pb-1">
          <Text className="text-caption text-muted">OUTSTANDING</Text>
          <Text className="font-body-semibold tabular-nums">{formatCompactCurrency(revenue?.summary?.totalOutstanding)}</Text>
        </View>
      </View>
      {months.some((m) => m.collected) ? (
        <HatchBars months={months} value={(m) => m.collected} short={(m) => formatCompactCurrency(m.collected)} />
      ) : (
        <Text className="text-sm text-muted">No revenue yet.</Text>
      )}
    </Section>
  );
}

const LEAD_DOT = { new: 'bg-sand', contacted: 'bg-accent/50', meeting_scheduled: 'bg-accent', proposal_sent: 'bg-brown dark:bg-beige', won: 'bg-success', lost: 'bg-danger' };

// Won % up top, then every stage (zeros too) on one segmented bar, like Tasks.
export function PipelineSection({ sub, rows }) {
  const items = LEAD_STATUS.map((s) => ({ key: s.value, label: s.label, count: rows?.find((r) => r.status === s.value)?.count || 0, dot: LEAD_DOT[s.value] }));
  const total = items.reduce((n, s) => n + s.count, 0);
  const won = items.find((s) => s.key === 'won').count;
  return (
    <Section title="Lead pipeline" sub={sub} action="Open leads" onAction={() => router.push('/leads')}>
      <View className="flex-row items-baseline gap-2" accessible accessibilityLabel={`${won} of ${total} leads won`}>
        <Numeral value={`${total ? Math.round((won / total) * 100) : 0}%`} />
        <Text className="text-sm text-muted">{won} of {total} won</Text>
      </View>
      <StageBar items={items} />
    </Section>
  );
}

// Each channel as its share of all leads, biggest first, so one lead out of two reads as half, not a full bar.
export function SourcesSection({ rows }) {
  const total = (rows || []).reduce((n, r) => n + r.count, 0);
  return (
    <Section title="Lead sources" sub={`Where ${total} lead${total === 1 ? '' : 's'} came from`} action="Open leads" onAction={() => router.push('/leads')}>
      {total ? (
        <BarList
          max={total}
          rows={[...rows].sort((a, b) => b.count - a.count).map((r) => ({
            key: String(r.source), label: labelOf(LEAD_SOURCES, r.source), value: r.count, display: `${r.count} · ${Math.round((r.count / total) * 100)}%`,
          }))}
        />
      ) : (
        <Text className="text-sm text-muted">No leads yet.</Text>
      )}
    </Section>
  );
}

// Done % and every stage on one bar. `children` go under it (the employee's own task list).
export function TasksSection({ tasks, title = 'Tasks', sub, children }) {
  const total = tasks?.total || 0;
  const done = tasks?.done || 0;
  return (
    <Section title={title} sub={sub} action="Open tasks" onAction={() => router.push('/tasks')}>
      <View className="flex-row items-baseline gap-2" accessible accessibilityLabel={`${done} of ${total} tasks done`}>
        <Numeral value={`${total ? Math.round((done / total) * 100) : 0}%`} />
        <Text className="text-sm text-muted">{done} of {total} done</Text>
      </View>
      <StageBar items={taskCounts(tasks?.byStatus)} />
      {children}
    </Section>
  );
}

// Day number over the month, the calendar-page look for meeting rows.
function DateBlock({ date }) {
  const d = new Date(date);
  return (
    <View className="h-12 w-12 items-center justify-center rounded-2xl bg-surface-2">
      <Text className="font-display text-xl leading-6 tabular-nums">{d.getDate()}</Text>
      <Text className="text-[10px] uppercase leading-3 text-muted">{d.toLocaleDateString('en-IN', { month: 'short' })}</Text>
    </View>
  );
}

// Upcoming meetings list, shared by both Homes. `loading` shows a short skeleton instead of "no meetings".
export function MeetingsSection({ meetings, loading, sub, max = 5 }) {
  const theme = useTheme();
  // The server sorts by day only; order same-day meetings by start time.
  const sorted = [...(meetings || [])].sort((a, b) => `${String(a.date).slice(0, 10)}${a.startTime}`.localeCompare(`${String(b.date).slice(0, 10)}${b.startTime}`)).slice(0, max);
  return (
    <Section title="Meetings" sub={sub} action="Open meetings" onAction={() => router.push('/meetings')}>
      {loading ? <Skeleton className="h-16 rounded-2xl" /> : sorted.length ? (
        <View>
          {sorted.map((m, i) => (
            <ZoomLink href={m._id && `/meetings/${m._id}`} key={m._id || i}>
              <Pressable haptic={false} className={cn('flex-row items-center gap-3 py-3', i && 'border-t border-line')}>
                <DateBlock date={m.date} />
                <View className="flex-1">
                  <Text numberOfLines={1} className="font-body-semibold">{m.title}</Text>
                  <Text numberOfLines={1} className="text-sm text-muted">
                    {[`${toDisplay(m.startTime)}–${toDisplay(m.endTime)}`, m.lead?.name || m.client?.companyName].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                {!!m.meetingLink && <Video size={18} color={theme.muted} />}
                {!!m.location && <MapPin size={18} color={theme.muted} />}
              </Pressable>
            </ZoomLink>
          ))}
        </View>
      ) : (
        <Text className="text-sm text-muted">{"No upcoming meetings. You're all clear."}</Text>
      )}
    </Section>
  );
}

// Who is in today, one dot per person.
function TeamToday({ o }) {
  const groups = [
    { key: 'office', label: 'In office', count: Math.max(0, o.presentCount - o.wfhCount), dot: 'bg-accent' },
    { key: 'wfh', label: 'From home', count: o.wfhCount, dot: 'bg-brown dark:bg-beige' },
    { key: 'leave', label: 'On leave', count: o.leaveCount, dot: 'bg-sand' },
    { key: 'absent', label: 'Not in', count: o.absentCount, dot: 'bg-line' },
  ];
  return (
    <Section
      title="Team today"
      sub={o.lateCount ? `${o.lateCount} came in late` : 'Nobody late so far'}
      action="Open attendance records"
      onAction={() => router.push('/attendance/records')}
      arrow
    >
      <View className="flex-row items-baseline gap-2" accessible accessibilityLabel={`${o.presentCount} of ${o.totalEmployees} people in today`}>
        <Numeral value={o.presentCount} />
        <Text className="text-sm text-muted">of {o.totalEmployees} in today</Text>
      </View>
      <DotGrid groups={groups} total={o.totalEmployees} />
      <Legend items={groups} />
    </Section>
  );
}

const typeLabel = (v) => LEAVE_TYPES.find((t) => t.value === v)?.label || v;
// "4 Mar", "11–12 Mar" or "30 Mar – 2 Apr".
const dateRange = (a, b) => {
  const [s, e] = [new Date(a), new Date(b)];
  if (ymd(s) === ymd(e)) return shortDate(s);
  return s.getMonth() === e.getMonth() ? `${s.getDate()}–${shortDate(e)}` : `${shortDate(s)} – ${shortDate(e)}`;
};

// Leave waiting for approval; the card only shows when something is pending.
function PendingLeaves({ leaves, count }) {
  return (
    <Section title="Leave requests" sub={`${count} waiting for approval`} action="Open leave requests" onAction={() => router.push('/attendance/leaves')}>
      <View>
        {leaves.map((l, i) => {
          const days = leaveDays(ymd(l.startDate), ymd(l.endDate));
          return (
            <Pressable
              key={l._id}
              haptic={false}
              onPress={() => router.push('/attendance/leaves')}
              className={cn('flex-row items-center gap-3 py-3', i && 'border-t border-line')}
            >
              <Avatar name={l.employee?.name || '?'} uri={l.employee?.avatar} size={44} />
              <View className="flex-1">
                <Text numberOfLines={1} className="font-body-semibold">{l.employee?.name}</Text>
                <Text numberOfLines={1} className="text-sm text-muted">
                  {typeLabel(l.leaveType)} leave · {l.halfDay ? 'Half day' : `${days} ${days === 1 ? 'day' : 'days'}`}
                </Text>
              </View>
              <View className="rounded-full bg-accent/15 px-3 py-1.5">
                <Text className="font-body-semibold text-xs text-accent-ink tabular-nums">{dateRange(l.startDate, l.endDate)}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </Section>
  );
}

// Admin / manager Home: the numbers first, then today's people, money, work and the calendar.
export function AdminDashboard() {
  const user = useSelector((s) => s.auth.user);
  const lead = isLead(user);
  const { data, isLoading, isError, refetch } = useGetDashboardOverviewQuery();
  const team = useGetAttendanceOverviewStatsQuery({}, { skip: !lead });
  const leavesQ = useGetLeavesQuery({ status: 'pending', page: 1, limit: 4 }, { skip: !lead });
  const meetingsQ = useGetMeetingsQuery({ status: 'scheduled', dateFrom: ymd(new Date()), sortBy: 'date', sortOrder: 'asc', page: 1, limit: 10 });
  const refreshControl = usePullRefresh(() => Promise.all([refetch(), meetingsQ.refetch(), ...(lead ? [team.refetch(), leavesQ.refetch()] : [])]));
  const d = data?.data;
  // A partial answer (no kpis) shows zeros instead of crashing Home.
  const k = d?.kpis ?? {};
  const byBrand = Object.fromEntries((d?.clients?.byBrand || []).map((b) => [b.brand, b.count]));
  // Tiles only link to pages this person can open (managers can't open money pages or Reports).
  const go = (path) => (canOpenPath(user, path) ? () => router.push(path) : undefined);
  const leaves = leavesQ.data?.data || [];

  return (
    <Screen tab scroll className="gap-4 pt-6" refreshControl={refreshControl}>
      <HomeHeader subtitle={today()} />
      <AttendanceCard />
      {!d ? <DashboardState isLoading={isLoading} isError={isError} refetch={refetch} /> : (
        <>
          {/* Two explicit rows: Yoga mis-measures a flex-wrap grid of stretched tiles, and the next card overlapped row 2. */}
          <View className="flex-row gap-3">
            <KpiTile label="Total leads" value={k.totalLeads ?? 0} onPress={go('/leads')}>
              <SplitBar pct={k.conversionRate} label="converted" />
            </KpiTile>
            <KpiTile label="Revenue" value={formatCompactCurrency(k.totalRevenue)} onPress={go('/payments')}>
              <SplitBar pct={k.collectionRate} label="of invoiced" />
            </KpiTile>
          </View>
          <View className="flex-row gap-3">
            <KpiTile label="Active clients" value={k.activeClients ?? 0} sub={`${k.activeProjects ?? 0} active project${k.activeProjects === 1 ? '' : 's'}`} onPress={go('/clients')} />
            <KpiTile
              label="Overdue invoices"
              value={k.overdueInvoices ?? 0}
              alert={k.overdueInvoices > 0}
              sub={`${k.pendingPayments ?? 0} payment${k.pendingPayments === 1 ? '' : 's'} pending`}
              onPress={go('/invoices')}
            />
          </View>

          {lead && (team.data?.data ? <TeamToday o={team.data.data} /> : team.isLoading && <Skeleton className="h-56 rounded-3xl" />)}
          {lead && leaves.length > 0 && <PendingLeaves leaves={leaves} count={leavesQ.data?.pagination?.pendingCount ?? leaves.length} />}
          <RevenueSection revenue={d.revenue} collected={k.totalRevenue} sub="Excl. cash. Tap a month." onOpen={go('/reports') || go('/payments')} />
          <TasksSection tasks={d.tasks} sub="Across every project" />
          <MeetingsSection meetings={meetingsQ.data?.data} loading={meetingsQ.isLoading} sub="Next on the company calendar" max={4} />

          <Section title="Ventures" sub="Clients per brand">
            <View>
              {BRANDS.map((b) => (
                <ZoomLink href={`/dashboard/venture/${b.value}`} key={b.value}>
                  <ListRow icon={() => <BrandMark brand={b.value} />} label={b.label} hint={`${byBrand[b.value] || 0} clients`} />
                </ZoomLink>
              ))}
            </View>
          </Section>
        </>
      )}
      <CalendarCard />
    </Screen>
  );
}

const NO_TASKS = { total: 0, done: 0, byStatus: [], items: [] };

// Employee Home: leave left as used-of-total bars, with one-tap links.
function TimeOffSection() {
  const me = useSelector((s) => s.auth.user);
  const bal = useGetLeaveBalanceQuery(me._id);
  const b = bal.data?.data?.balance;
  return (
    <Section title="Time off" sub="Leave left this year" action="Open leave calendar" onAction={() => router.push('/attendance/calendar')}>
      <View className="flex-row gap-3">
        {[['casual', 'Casual'], ['sick', 'Sick']].map(([k, label]) => (
          <View key={k} className="flex-1 gap-2 rounded-2xl bg-surface-2/60 p-3" accessible accessibilityLabel={`${label} leave: ${b?.[k]?.balance ?? 0} left of ${b?.[k]?.total ?? 0}`}>
            <Text className="text-caption text-muted">{label.toUpperCase()}</Text>
            <View className="flex-row items-baseline gap-1">
              <Numeral value={b?.[k]?.balance ?? (bal.isLoading ? '…' : '—')} />
              <Text className="text-sm text-muted">of {b?.[k]?.total ?? 0}</Text>
            </View>
            <SplitBar pct={b?.[k]?.total ? (b[k].balance / b[k].total) * 100 : 0} label="left" />
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
  // A partial answer (no tasks block) shows an empty bar instead of crashing Home.
  const tasks = { ...NO_TASKS, ...d?.tasks };

  return (
    <Screen tab scroll className="gap-4 pt-6" refreshControl={refreshControl}>
      <HomeHeader subtitle={today()} />
      <AttendanceCard />
      {!d ? <DashboardState isLoading={isLoading} isError={isError} refetch={refetch} /> : (
        <>
          <TasksSection tasks={tasks} title="My tasks" sub="Everything assigned to you">
            {tasks.items?.length ? (
              <View className="border-t border-line pt-1">
                {tasks.items.map((t) => (
                  <ZoomLink href={`/tasks/${t._id}`} key={t._id}>
                    <ActivityRow
                      icon={ListTodo}
                      title={t.title}
                      description={[t.project?.name, t.dueDate && `Due ${shortDate(t.dueDate)}`].filter(Boolean).join(' · ')}
                      right={<Badge label={labelOf(TASK_PRIORITY, t.priority)} color={TASK_PRIORITY.find((p) => p.value === t.priority)?.color} />}
                    />
                  </ZoomLink>
                ))}
              </View>
            ) : tasks.total - tasks.done === 0 && (
              <View className="flex-row items-center gap-3 border-t border-line pt-4">
                <CheckCircle2 size={22} color={theme.success} />
                <Text className="flex-1 text-sm text-muted">All tasks completed. Your queue is clear.</Text>
              </View>
            )}
          </TasksSection>
          <TimeOffSection />
          <MeetingsSection meetings={d.meetings} sub="Where you're invited" />
        </>
      )}
      <CalendarCard />
    </Screen>
  );
}
