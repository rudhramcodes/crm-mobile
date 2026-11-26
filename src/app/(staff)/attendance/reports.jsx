import { useState } from 'react';
import { View } from 'react-native';
import { BarChart3, ChevronLeft, ChevronRight } from 'lucide-react-native';
import {
  BarList, Card, Chip, DashboardState, EmptyState, PageHeader, Pressable, RecordRow, Screen, Section, KpiTile, Text, fromYmd, longDate, statusMeta, usePullRefresh,
} from '@/components';
import { useGetDailyReportQuery, useGetMonthlyReportQuery, useGetWeeklyReportQuery } from '@/services/attendanceApi';
import { useTheme } from '@/constants/theme';
import { ymd } from '@/utils/attendance';
import { formatHours } from '@/utils/formatters';

const PERIODS = [['daily', 'Day'], ['weekly', 'Week'], ['monthly', 'Month']];
const shift = (s, days) => { const d = fromYmd(s); d.setDate(d.getDate() + days); return ymd(d); };
const monday = (s) => { const d = fromYmd(s); return shift(s, -((d.getDay() + 6) % 7)); };
const short = (s) => fromYmd(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

// Admins and managers: one day, week or month across the team. Export to Excel stays on the web.
export default function Reports() {
  const theme = useTheme();
  const [period, setPeriod] = useState('daily');
  const [anchor, setAnchor] = useState(ymd());
  const start = period === 'weekly' ? monday(anchor) : anchor;
  const d = fromYmd(anchor);
  // shortcut: first 50 records per period; the summary figures still cover everything.
  const page = { page: 1, limit: 50 };
  const daily = useGetDailyReportQuery({ date: anchor, ...page }, { skip: period !== 'daily' });
  const weekly = useGetWeeklyReportQuery({ startDate: start, ...page }, { skip: period !== 'weekly' });
  const monthly = useGetMonthlyReportQuery({ year: d.getFullYear(), month: d.getMonth() + 1, ...page }, { skip: period !== 'monthly' });
  const q = { daily, weekly, monthly }[period];
  const refreshControl = usePullRefresh(q.refetch);

  const step = (dir) => {
    if (period === 'monthly') { const m = fromYmd(anchor); m.setDate(1); m.setMonth(m.getMonth() + dir); setAnchor(ymd(m)); }
    else setAnchor(shift(anchor, dir * (period === 'weekly' ? 7 : 1)));
  };
  const label = period === 'daily' ? longDate(anchor)
    : period === 'weekly' ? `${short(start)} – ${short(shift(start, 6))}`
      : d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const atNow = period === 'monthly' ? ymd(d).slice(0, 7) >= ymd().slice(0, 7) : (period === 'weekly' ? shift(start, 6) : anchor) >= ymd();

  const s = q.data?.pagination?.summary;
  const records = q.data?.data || [];
  const statusRows = (s?.statusDistribution || []).filter((x) => x.value).map((x) => ({ key: x.status, label: statusMeta(x.status).label, value: x.value }));
  const hourRows = (s?.employeeHours || []).filter((x) => x.hours).map((x, i) => ({ key: `${x.name}-${i}`, label: x.name, value: x.hours, display: formatHours(x.hours) }));

  return (
    <Screen scroll className="gap-5 pt-2" refreshControl={refreshControl}>
      <PageHeader caption="ATTENDANCE" title="Reports" />
      <View className="flex-row gap-2">
        {PERIODS.map(([v, l]) => <Chip key={v} label={l} active={period === v} onPress={() => setPeriod(v)} />)}
      </View>
      <View className="flex-row items-center">
        <Pressable onPress={() => step(-1)} accessibilityLabel="Previous" className="h-11 w-11 items-center justify-center"><ChevronLeft size={22} color={theme.ink} /></Pressable>
        <Text className="flex-1 text-center font-body-semibold tabular-nums">{label}</Text>
        <Pressable onPress={() => step(1)} disabled={atNow} accessibilityLabel="Next" className={atNow ? 'h-11 w-11 items-center justify-center opacity-30' : 'h-11 w-11 items-center justify-center'}><ChevronRight size={22} color={theme.ink} /></Pressable>
      </View>

      {q.isLoading || q.isError ? <DashboardState isLoading={q.isLoading} isError={q.isError} refetch={q.refetch} /> : !s?.totalRecords ? (
        <EmptyState icon={BarChart3} title="No attendance yet" message="Nobody has a record in this period." />
      ) : (
        <>
          <View className="gap-3">
            <View className="flex-row gap-3">
              <KpiTile label="People" value={s.totalEmployees} sub={`${s.totalRecords} records`} />
              <KpiTile label="Present" value={s.presentRecords} sub="incl. WFH and half days" />
            </View>
            <View className="flex-row gap-3">
              <KpiTile label="Absent" value={s.absentRecords} alert={s.absentRecords > 0} sub={`${s.leaveRecords} on leave`} />
              <KpiTile label="Hours" value={formatHours(s.workedHours)} sub={s.workedRecords ? `${formatHours(s.workedHours / s.workedRecords)} a day avg.` : undefined} />
            </View>
          </View>
          {!!statusRows.length && <Section title="By status"><BarList rows={statusRows} /></Section>}
          {!!hourRows.length && <Section title="Most hours" sub="Top of the team for this period"><BarList rows={hourRows} /></Section>}
          <View className="gap-2">
            <Text className="text-caption text-muted">{s.totalRecords > records.length ? `FIRST ${records.length} OF ${s.totalRecords} RECORDS` : 'RECORDS'}</Text>
            <Card className="py-1">
              {records.map((r, i) => <View key={r._id} className={i ? 'border-t border-line' : undefined}><RecordRow r={r} /></View>)}
            </Card>
          </View>
          <Text className="text-xs text-muted">Export to Excel from the web app.</Text>
        </>
      )}
    </Screen>
  );
}
