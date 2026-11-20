import { useEffect } from 'react';
import { useGetTodayStatusQuery } from '@/services/attendanceApi';
import { showWorkTimer } from '@/services/liveActivity';
import { activeSession, clockTime, workedSeconds } from '@/utils/attendance';

// While clocked in, today's worked time counts in the Dynamic Island and on the Lock Screen;
// it pauses on a break and goes away on clock-out. Same numbers as the Home and Attendance timers.
export function useClockTimer() {
  const { data } = useGetTodayStatusQuery(undefined, { pollingInterval: 60000 });
  const today = data?.data?.attendance;
  const active = !!activeSession(today);
  const onBreak = !!activeSession(today)?.breaks?.some((b) => !b.end);
  const firstIn = today?.sessions?.find((s) => s.clockIn?.time)?.clockIn.time;

  useEffect(() => {
    if (!data) return;
    if (!active) return void showWorkTimer('clock', null);
    const now = Date.now();
    showWorkTimer('clock', {
      title: onBreak ? 'On a break' : 'Clocked in',
      sub: `Since ${clockTime(firstIn)}`,
      start: now - workedSeconds(today, now) * 1000, // when the count would have begun with no breaks
      paused: onBreak ? now : 0,
    });
    // Only a real change (clock in or out, break) updates it; iOS keeps the timer ticking between them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!data, active, onBreak, firstIn]);
}
