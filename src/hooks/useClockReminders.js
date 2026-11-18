import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useGetShiftsQuery, useGetTodayStatusQuery } from '@/services/attendanceApi';
import { activeSession } from '@/utils/attendance';
import { toDisplay } from '@/utils/time';

const IN = 'clock-in-reminder';
const OUT = 'clock-out-reminder';

const at = (hhmm, plusMin = 0) => {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m + plusMin, 0, 0);
  return d;
};

const schedule = (identifier, title, body, date) => date > new Date() && Notifications.scheduleNotificationAsync({
  identifier,
  content: { title, body, data: { link: '/attendance' } },
  trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
});

// Local reminders for today only, re-planned whenever today's status changes:
// "You haven't clocked in" at shift start + 15 min, "Still clocked in?" at shift end.
// shortcut: an overnight shift (end before start) gets no clock-out reminder; add a next-day date if such shifts appear.
export function useClockReminders() {
  const { data } = useGetTodayStatusQuery(undefined, { pollingInterval: 300000, skip: Platform.OS === 'web' });
  const { data: shifts } = useGetShiftsQuery(undefined, { skip: Platform.OS === 'web' });

  useEffect(() => {
    if (!data) return;
    const record = data.data?.attendance;
    const shift = record?.shift?.startTime ? record.shift : shifts?.data?.find((s) => s.isDefault && s.isActive !== false);
    (async () => {
      await Promise.all([Notifications.cancelScheduledNotificationAsync(IN), Notifications.cancelScheduledNotificationAsync(OUT)]);
      if (!shift || new Date().getDay() === 0 || ['leave', 'holiday', 'weekend'].includes(record?.status)) return;
      if (!record?.sessions?.length) {
        await schedule(IN, "You haven't clocked in", `${shift.name} started at ${toDisplay(shift.startTime)}. Tap to clock in.`, at(shift.startTime, 15));
      } else if (activeSession(record)) {
        await schedule(OUT, 'Still clocked in?', `${shift.name} ended at ${toDisplay(shift.endTime)}. Clock out when you're done.`, at(shift.endTime));
      }
    })().catch(() => {});
  }, [data, shifts]);
}
