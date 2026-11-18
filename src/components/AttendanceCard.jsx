import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { ChevronRight, LogIn, LogOut } from 'lucide-react-native';
import { Pressable } from './Pressable';
import { Card } from './Card';
import { Text } from './Text';
import { Badge } from './Badge';
import { Button } from './Button';
import { Skeleton } from './Skeleton';
import { useClockInMutation, useGetTodayStatusQuery } from '@/services/attendanceApi';
import { useTheme } from '@/constants/theme';
import { activeSession, getLocation, hms, runAction, workedSeconds } from '@/utils/attendance';

const BLOCKED = { leave: 'On leave today', holiday: 'Holiday today', weekend: 'Sunday' };

// Home clock card, the app's version of the web header pill: live timer, clock in, clock out.
export function AttendanceCard() {
  const theme = useTheme();
  const { data, isLoading } = useGetTodayStatusQuery(undefined, { pollingInterval: 60000 });
  const [clockIn] = useClockInMutation();
  const [clockingIn, setClockingIn] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const today = data?.data?.attendance;
  const active = activeSession(today);
  const onBreak = !!active?.breaks?.some((b) => !b.end);
  const elapsed = Math.floor(workedSeconds(today, now));

  useEffect(() => {
    if (!active || onBreak) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active, onBreak]);

  // Office clock-in from Home; WFH and the full reasons live on the Attendance tab.
  const onClockIn = async () => {
    setClockingIn(true);
    await runAction(clockIn({ location: await getLocation() }), 'Clocked in. Have a good day.', "Couldn't clock in");
    setClockingIn(false);
  };

  if (isLoading) return <Skeleton className="h-[148px] rounded-3xl" />;
  const blocked = BLOCKED[today?.status];

  return (
    <Card className="gap-3">
      <View className="flex-row items-center gap-2">
        <Text className="flex-1 text-caption text-muted">TODAY</Text>
        {active && <Badge label={onBreak ? 'On break' : 'Clocked in'} variant={onBreak ? 'warning' : 'success'} />}
        {!active && blocked && <Badge label={blocked} variant="info" />}
        <Pressable onPress={() => router.push('/attendance')} accessibilityLabel="Open attendance" hitSlop={12}>
          <ChevronRight size={20} color={theme.muted} />
        </Pressable>
      </View>
      <Text className="font-display text-numeral tabular-nums" accessibilityLabel={`Worked ${hms(elapsed)} today`}>
        {hms(elapsed)}
      </Text>
      {active ? (
        <Button title="Clock out" icon={LogOut} variant="secondary" size="sm" onPress={() => router.push('/attendance/clock-out')} />
      ) : (
        !blocked && <Button title="Clock in" icon={LogIn} size="sm" loading={clockingIn} onPress={onClockIn} />
      )}
    </Card>
  );
}
