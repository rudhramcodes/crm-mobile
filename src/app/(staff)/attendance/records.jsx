import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSelector } from 'react-redux';
import { ListChecks, Plus, Search } from 'lucide-react-native';
import {
  Button, Card, Chip, DashboardState, DateField, EmptyState, Input, PageHeader, Pager, RecordRow, Screen, Text, usePullRefresh,
} from '@/components';
import { useGetAttendanceListQuery } from '@/services/attendanceApi';
import { ATTENDANCE_STATUS } from '@/constants';
import { useTheme } from '@/constants/theme';
import { usePage } from '@/hooks/usePaged';
import { isAdmin, ymd } from '@/utils/attendance';

const LIMIT = 20;
// Holiday and weekend days aren't worth filtering a team's records by.
const STATUSES = [{ value: '', label: 'All' }, ...ATTENDANCE_STATUS.filter((s) => s.value !== 'holiday' && s.value !== 'weekend'), { value: 'late', label: 'Late' }];
const NOT_CLOCKED_IN = { value: 'not_clocked_in', label: 'Not clocked in' };

// Admins and managers: everyone's records for one day (today by default), by status and name.
export default function Records() {
  const theme = useTheme();
  const p = useLocalSearchParams();
  const me = useSelector((s) => s.auth.user);
  const [status, setStatus] = useState(p.status || '');
  const [date, setDate] = useState(ymd());
  const [typed, setTyped] = useState('');
  const [search, setSearch] = useState('');
  const today = date === ymd();
  // Only today's list knows who hasn't clocked in (the server adds them when includeMissing is set).
  const shownStatus = !today && status === NOT_CLOCKED_IN.value ? '' : status;
  const chips = today ? [...STATUSES, NOT_CLOCKED_IN] : STATUSES;
  const filters = {
    status: shownStatus || undefined, search: search || undefined, dateFrom: date, dateTo: date, includeMissing: today ? 'true' : undefined,
  };
  const [page, setPage] = usePage(JSON.stringify(filters));
  const { data, isLoading, isFetching, isError, refetch } = useGetAttendanceListQuery({ ...filters, page, limit: LIMIT });
  const refreshControl = usePullRefresh(refetch);
  const rows = data?.data || [];
  const total = data?.pagination?.total ?? rows.length;
  const pages = Math.ceil(total / LIMIT);

  return (
    <Screen scroll className="gap-5 pt-2" refreshControl={refreshControl}>
      <PageHeader
        caption="ATTENDANCE"
        title="Records"
        right={isAdmin(me) ? <Button title="Add" icon={Plus} size="sm" onPress={() => router.push('/attendance/edit')} /> : undefined}
      />
      <DateField label="Date" value={date} onChange={setDate} maxDate={ymd()} relative />
      <Input
        value={typed}
        onChangeText={setTyped}
        onSubmitEditing={() => setSearch(typed.trim())}
        onBlur={() => setSearch(typed.trim())}
        placeholder="Search by name or email"
        accessibilityLabel="Search by name or email"
        returnKeyType="search"
        autoCapitalize="none"
        right={
          <View className="h-11 w-11 items-center justify-center">
            <Search size={18} color={theme.muted} />
          </View>
        }
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-5 -mt-2" contentContainerClassName="gap-2 px-5">
        {chips.map((s) => <Chip key={s.value || 'all'} label={s.label} active={shownStatus === s.value} onPress={() => setStatus(s.value)} />)}
      </ScrollView>

      {isLoading || isError ? <DashboardState isLoading={isLoading} isError={isError} refetch={refetch} /> : rows.length ? (
        <View className="gap-2">
          <Text className="text-caption text-muted">{isFetching ? 'UPDATING…' : `${total} ${today ? (total === 1 ? 'PERSON' : 'PEOPLE') : total === 1 ? 'RECORD' : 'RECORDS'}`}</Text>
          <Card className="py-1">
            {rows.map((r, i) => (
              <View key={r._id} className={i ? 'border-t border-line' : undefined}><RecordRow r={r} /></View>
            ))}
          </Card>
          <Pager page={page} pages={pages} total={total} limit={LIMIT} loading={isFetching} onChange={setPage} />
        </View>
      ) : (
        <EmptyState icon={ListChecks} title="No records" message="Nothing matches these filters. Try another date." />
      )}
    </Screen>
  );
}
