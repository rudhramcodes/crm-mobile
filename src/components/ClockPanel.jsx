import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Coffee, LogIn, LogOut, Play } from 'lucide-react-native';
import { Card } from './Card';
import { Text } from './Text';
import { Badge } from './Badge';
import { Button } from './Button';
import { Input } from './Input';
import { Alert } from './Alert';
import { Skeleton } from './Skeleton';
import { showToast } from './Toast';
import { Toggle } from './AccountSettings';
import { MiniStats, SessionList } from './AttendanceParts';
import {
  useClockInMutation, useEndBreakMutation, useGetHolidaysQuery, useGetTodayStatusQuery, useStartBreakMutation,
} from '@/services/attendanceApi';
import { activeSession, clockTime, getLocation, hms, runAction, workedSeconds, ymd } from '@/utils/attendance';
import { apiError } from '@/utils/apiError';
import { formatHours, formatMinutes } from '@/utils/formatters';

// Same wording as the server's clock-in block reasons.
const blockReason = (record, holiday) => {
  if (record?.status === 'leave') return 'You have an approved leave today.';
  if (record?.status === 'weekend' || (!record && new Date().getDay() === 0)) return 'Clock-in is not allowed on Sunday.';
  if (record?.status === 'holiday' || holiday) return `Today is a holiday${holiday?.name || record?.notes ? `: ${holiday?.name || record.notes}` : ''}.`;
  return null;
};

// The Attendance tab's clock: live timer, WFH or office (GPS) clock-in, breaks, and today's sessions.
export function ClockPanel() {
  const { data, isLoading } = useGetTodayStatusQuery(undefined, { pollingInterval: 60000 });
  const { data: holidays } = useGetHolidaysQuery({ year: new Date().getFullYear(), page: 1, limit: 100 });
  const [clockIn] = useClockInMutation();
  const [startBreak, { isLoading: starting }] = useStartBreakMutation();
  const [endBreak, { isLoading: ending }] = useEndBreakMutation();
  const [wfh, setWfh] = useState(false);
  const [wfhReason, setWfhReason] = useState('');
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [now, setNow] = useState(() => Date.now());

  const record = data?.data?.attendance;
  const active = activeSession(record);
  const openBreak = active?.breaks?.find((b) => !b.end);
  const worked = Math.floor(workedSeconds(record, now));
  const holiday = holidays?.data?.find((h) => ymd(h.date) === ymd());
  const blocked = !active && blockReason(record, holiday);
  const hasSessions = record?.sessions?.some((s) => s.clockIn?.time);

  useEffect(() => {
    if (!active || openBreak) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active, openBreak]);

  const onClockIn = async () => {
    setError(null);
    setBusy(wfh ? 'Clocking in…' : 'Getting your location…');
    try {
      const location = await getLocation();
      setBusy('Clocking in…');
      await clockIn({ location, isWFH: wfh || undefined, wfhReason: wfh && wfhReason.trim() ? wfhReason.trim() : undefined }).unwrap();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast({ title: hasSessions ? 'Clocked in again' : 'Clocked in. Have a good day.' });
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(apiError(e).message);
    } finally {
      setBusy(null);
    }
  };

  if (isLoading) return <Skeleton className="h-[260px] rounded-3xl" />;

  const since = openBreak ? `On break since ${clockTime(openBreak.start)}` : active ? `Clocked in at ${clockTime(active.clockIn.time)}` : hasSessions ? 'Clocked out' : 'Not clocked in yet';

  return (
    <View className="gap-4">
      <Card className="gap-4">
        <View className="flex-row flex-wrap items-center gap-2">
          {active && <Badge label={openBreak ? 'On break' : 'Clocked in'} variant={openBreak ? 'warning' : 'success'} />}
          {record?.isWFH && <Badge label="WFH" variant="warning" />}
          {record?.isLate && <Badge label={`Late by ${formatMinutes(record.lateMinutes)}`} variant="danger" />}
          {record?.shift?.name && <Badge label={`${record.shift.name} · ${record.shift.startTime}–${record.shift.endTime}`} />}
        </View>
        <View>
          <Text numberOfLines={1} adjustsFontSizeToFit className="font-display text-[46px] leading-[52px] tabular-nums" accessibilityLabel={`Worked ${formatMinutes(worked / 60)} today`}>{hms(worked)}</Text>
          <Text className="text-sm text-muted">{since}</Text>
        </View>

        {blocked ? <Alert tone="info" message={blocked} /> : !active && (
          <View className="gap-3">
            <View className="flex-row items-center gap-3">
              <View className="flex-1">
                <Text className="font-body-medium">Working from home</Text>
                <Text className="text-sm text-muted">{wfh ? 'No location check.' : 'Office clock-in uses GPS: within 100 m of the office.'}</Text>
              </View>
              <Toggle value={wfh} onValueChange={(v) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setWfh(v); }} label="Working from home" />
            </View>
            {wfh && <Input placeholder="Reason (optional)" value={wfhReason} onChangeText={setWfhReason} maxLength={500} />}
          </View>
        )}

        <Alert message={error} />

        {active ? (
          <View className="flex-row gap-3">
            {openBreak
              ? <Button title="End break" icon={Play} variant="secondary" className="flex-1" loading={ending} onPress={() => runAction(endBreak(), 'Break ended', "Couldn't end break")} />
              : <Button title="Break" icon={Coffee} variant="secondary" className="flex-1" loading={starting} onPress={() => runAction(startBreak(), 'Break started', "Couldn't start break")} />}
            <Button title="Clock out" icon={LogOut} className="flex-1" onPress={() => router.push('/attendance/clock-out')} />
          </View>
        ) : !blocked && (
          <Button title={busy || (hasSessions ? 'Clock in again' : 'Clock in')} icon={LogIn} loading={!!busy} onPress={onClockIn} />
        )}
      </Card>

      {hasSessions && (
        <View className="gap-3">
          <MiniStats items={[
            { label: 'Worked', value: formatMinutes(worked / 60) },
            { label: 'Breaks', value: formatMinutes(record.totalBreakMinutes) },
            { label: 'Overtime', value: formatHours(record.overtime) },
          ]} />
          <SessionList sessions={record.sessions} />
        </View>
      )}
    </View>
  );
}
