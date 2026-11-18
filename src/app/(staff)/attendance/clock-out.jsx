import { useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { CheckCircle2, LogOut } from 'lucide-react-native';
import { Alert, Button, MiniStats, SheetHeader, Text, backTo } from '@/components';
import { useClockOutMutation, useGetTodayStatusQuery } from '@/services/attendanceApi';
import { useTheme } from '@/constants/theme';
import { activeSession, clockTime, getLocation, workedSeconds } from '@/utils/attendance';
import { apiError } from '@/utils/apiError';
import { formatHours, formatMinutes } from '@/utils/formatters';

// Clock-out confirmation: today's totals so far, then the server's final summary once clocked out.
export default function ClockOutSheet() {
  const theme = useTheme();
  const { data } = useGetTodayStatusQuery();
  const [clockOut] = useClockOutMutation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);
  const [now] = useState(() => Date.now());

  const record = data?.data?.attendance;
  const active = activeSession(record);
  const openBreak = active?.breaks?.find((b) => !b.end);
  const shiftHours = record?.shift?.duration || 8;
  const workedMin = workedSeconds(record, now) / 60;

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await clockOut({ location: await getLocation() }).unwrap();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setDone(res.data.attendance);
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(apiError(e).message);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    const last = done.sessions?.at(-1);
    return (
      <SafeAreaView edges={['bottom']} className="gap-5 bg-surface px-5 pb-4 pt-6">
        <View className="items-center gap-2">
          <CheckCircle2 size={44} color={theme.success} />
          <Text className="font-display text-title">Clocked out</Text>
          {last && <Text className="text-sm text-muted">{clockTime(last.clockIn?.time)} → {clockTime(last.clockOut?.time)}</Text>}
        </View>
        <MiniStats items={[
          { label: 'Worked today', value: formatHours(done.workHours) },
          { label: 'Breaks', value: formatMinutes(done.totalBreakMinutes) },
          { label: 'Overtime', value: formatHours(done.overtime) },
        ]} />
        <Button title="Done" onPress={() => backTo()} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['bottom']} className="gap-5 bg-surface px-5 pb-4 pt-6">
      <SheetHeader title="Clock out?" sub={active ? `In since ${clockTime(active.clockIn.time)}` : 'You are not clocked in.'} closeLabel="Cancel" />
      <MiniStats items={[
        { label: 'Worked today', value: formatMinutes(workedMin) },
        { label: 'Breaks', value: formatMinutes(record?.totalBreakMinutes) },
        { label: 'Overtime', value: formatMinutes(Math.max(0, workedMin - shiftHours * 60)) },
      ]} />
      {openBreak && <Alert tone="info" message="You're on a break. Clocking out ends it now." />}
      <Text className="text-sm text-muted">{`Your shift is ${formatHours(shiftHours)}. You can clock in again later today; it starts a new session.`}</Text>
      <Alert message={error} />
      <Button title="Clock out" icon={LogOut} variant="danger" loading={busy} disabled={!active} onPress={confirm} />
    </SafeAreaView>
  );
}
