import { Platform, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSelector } from 'react-redux';
import { FilePenLine, PencilLine } from 'lucide-react-native';
import {
  Alert, Badge, Button, Card, DashboardState, MiniStats, RequestBadge, Screen, SessionList, SheetHeader, StatusBadge, Text, longDate,
} from '@/components';
import { useGetAttendanceSummaryQuery } from '@/services/attendanceApi';
import { clockTime, isAdmin, ymd } from '@/utils/attendance';
import { formatHours, formatMinutes } from '@/utils/formatters';
import { toDisplay } from '@/utils/time';

const EVENT = {
  clock_in: 'Clocked in', clock_out: 'Clocked out', break_start: 'Break started', break_end: 'Break ended', status_change: 'Status changed',
  regularization_request: 'Correction requested', regularization_approved: 'Correction approved', regularization_rejected: 'Correction rejected', auto_clock_out: 'Auto clocked out',
};

// One day in full: totals, sessions with places and breaks, the correction request and the event log.
export default function DaySheet() {
  const me = useSelector((s) => s.auth.user);
  const { date, employee, name } = useLocalSearchParams();
  const { data, isLoading, isError, refetch } = useGetAttendanceSummaryQuery({ employeeId: employee || undefined, date });
  const r = data?.data?.summary?.record;
  const own = !employee || employee === me._id;
  const reg = r?.regularization?.approval?.status && r.regularization;

  return (
    <Screen scroll edges={Platform.OS === 'android' ? ['top', 'bottom'] : ['bottom']} className="gap-5 pt-6">
      <SheetHeader title={longDate(date)} sub={name || undefined} />
      {isLoading || isError ? <DashboardState isLoading={isLoading} isError={isError} refetch={refetch} /> : !r ? (
        <Text className="text-muted">No attendance record for this day.</Text>
      ) : (
        <>
          <View className="flex-row flex-wrap gap-2">
            <StatusBadge status={r.status} />
            {r.isLate && <Badge label={`Late by ${formatMinutes(r.lateMinutes)}`} variant="danger" />}
            {r.isWFH && r.status !== 'wfh' && <Badge label="WFH" variant="warning" />}
            {r.shift?.name && <Badge label={`${r.shift.name} · ${toDisplay(r.shift.startTime)}`} />}
          </View>
          <MiniStats items={[
            { label: 'Worked', value: formatHours(r.workHours) },
            { label: 'Breaks', value: formatMinutes(r.totalBreakMinutes) },
            { label: 'Overtime', value: formatHours(r.overtime) },
          ]} />
          {!!r.wfhReason && <Alert tone="info" message={`WFH: ${r.wfhReason}`} />}
          {!!r.notes && <Alert tone="info" message={`Note: ${r.notes}`} />}
          <SessionList sessions={r.sessions} />

          {reg && (
            <Card className="gap-2">
              <View className="flex-row items-center gap-2">
                <Text className="flex-1 font-body-semibold">Correction request</Text>
                <RequestBadge status={reg.approval.status} />
              </View>
              {reg.request?.clockInTime && <Text className="text-sm tabular-nums">{toDisplay(reg.request.clockInTime)} → {toDisplay(reg.request.clockOutTime)}{reg.request.breakMinutes ? ` · ${reg.request.breakMinutes}m break` : ''}</Text>}
              {!!reg.request?.reason && <Text className="text-sm text-muted">{reg.request.reason}</Text>}
              {!!reg.approval.comment && <Text className="text-sm">{`${reg.approval.approvedBy?.name || 'Reviewer'}: ${reg.approval.comment}`}</Text>}
            </Card>
          )}

          {r.events?.length > 0 && (
            <View className="gap-2">
              <Text className="text-caption text-muted">ACTIVITY</Text>
              {r.events.map((e, i) => (
                <View key={e._id || i} className="flex-row gap-3">
                  <Text className="w-20 text-sm tabular-nums text-muted">{clockTime(e.timestamp)}</Text>
                  <Text className="flex-1 text-sm">{EVENT[e.type] || e.type}{e.metadata?.isLate ? `, late by ${e.metadata.lateMinutes}m` : ''}</Text>
                </View>
              ))}
            </View>
          )}
        </>
      )}

      {own && date <= ymd() && reg?.approval?.status !== 'pending' && (
        <Button title="Request a correction" icon={FilePenLine} variant="secondary" onPress={() => router.push({ pathname: '/attendance/regularize', params: { date } })} />
      )}
      {isAdmin(me) && (
        <Button title={r ? 'Edit this day' : 'Add an entry'} icon={PencilLine} variant="secondary" onPress={() => router.push({ pathname: '/attendance/edit', params: { date, employee: employee || me._id, name: name || me.name } })} />
      )}
    </Screen>
  );
}
