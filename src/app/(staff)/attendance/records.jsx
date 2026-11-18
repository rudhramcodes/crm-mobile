import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSelector } from 'react-redux';
import { ListChecks, Plus, Search } from 'lucide-react-native';
import {
  Button, Card, Chip, DashboardState, DateField, EmptyState, Input, PageHeader, RecordRow, Screen, Text, usePullRefresh,
} from '@/components';
import { useGetAttendanceListQuery } from '@/services/attendanceApi';
import { ATTENDANCE_STATUS } from '@/constants';
import { useTheme } from '@/constants/theme';
import { isAdmin, ymd } from '@/utils/attendance';

const STATUSES = [{ value: '', label: 'All' }, ...ATTENDANCE_STATUS, { value: 'late', label: 'Late' }];

// Admins and managers: everyone's records by status, name and date range. A tile on the tab opens it pre-filtered to today.
export default function Records() {
  const theme = useTheme();
  const p = useLocalSearchParams();
  const me = useSelector((s) => s.auth.user);
  const [status, setStatus] = useState(p.status || '');
  const [from, setFrom] = useState(() => (p.status ? ymd() : ymd(Date.now() - 6 * 864e5)));
  const [to, setTo] = useState(ymd());
  const [typed, setTyped] = useState('');
  const [search, setSearch] = useState('');
  // shortcut: newest 100 records only; add paging when a range routinely holds more.
  const { data, isLoading, isFetching, isError, refetch } = useGetAttendanceListQuery({
    status: status || undefined, search: search || undefined, dateFrom: from, dateTo: to, page: 1, limit: 100,
  });
  const refreshControl = usePullRefresh(refetch);
  const rows = data?.data || [];
  const total = data?.pagination?.total ?? rows.length;

  return (
    <Screen scroll className="gap-5 pt-2" refreshControl={refreshControl}>
      <PageHeader
        caption="ATTENDANCE"
        title="Records"
        right={isAdmin(me) ? <Button title="Add" icon={Plus} size="sm" onPress={() => router.push('/attendance/edit')} /> : undefined}
      />
      <Input
        value={typed}
        onChangeText={setTyped}
        onSubmitEditing={() => setSearch(typed.trim())}
        onBlur={() => setSearch(typed.trim())}
        placeholder="Search by name or email"
        accessibilityLabel="Search by name or email"
        returnKeyType="search"
        autoCapitalize="none"
        right={<Search size={18} color={theme.muted} />}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-5 -mt-2" contentContainerClassName="gap-2 px-5">
        {STATUSES.map((s) => <Chip key={s.value || 'all'} label={s.label} active={status === s.value} onPress={() => setStatus(s.value)} />)}
      </ScrollView>
      <DateField label="From" value={from} onChange={(d) => { setFrom(d); if (d > to) setTo(d); }} maxDate={ymd()} />
      <DateField label="To" value={to} onChange={setTo} minDate={from} maxDate={ymd()} />

      {isLoading || isError ? <DashboardState isLoading={isLoading} isError={isError} refetch={refetch} /> : rows.length ? (
        <View className="gap-2">
          <Text className="text-caption text-muted">{isFetching ? 'UPDATING…' : `${total} ${total === 1 ? 'RECORD' : 'RECORDS'}${total > rows.length ? `, NEWEST ${rows.length} SHOWN` : ''}`}</Text>
          <Card className="py-1">
            {rows.map((r, i) => (
              <View key={r._id} className={i ? 'border-t border-line' : undefined}><RecordRow r={r} /></View>
            ))}
          </Card>
        </View>
      ) : (
        <EmptyState icon={ListChecks} title="No records" message="Nothing matches these filters. Try a wider date range." />
      )}
    </Screen>
  );
}
