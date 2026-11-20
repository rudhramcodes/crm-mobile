import { Stack } from 'expo-router';
import { useLiveUpdates } from '@/hooks/useLiveUpdates';
import { useClockReminders } from '@/hooks/useClockReminders';

const modal = { presentation: 'modal' };

// Tabs at the root; module screens (leads, task detail, ...) push on top of them as they're built.
export default function StaffLayout() {
  useLiveUpdates();
  useClockReminders();
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="attendance/clock-out" options={{ presentation: 'formSheet', sheetAllowedDetents: 'fitToContents', sheetGrabberVisible: true }} />
      <Stack.Screen name="attendance/day" options={modal} />
      <Stack.Screen name="attendance/regularize" options={modal} />
      <Stack.Screen name="attendance/apply-leave" options={modal} />
      <Stack.Screen name="attendance/edit" options={modal} />
      <Stack.Screen name="attendance/holiday-form" options={modal} />
      <Stack.Screen name="attendance/shift-form" options={modal} />
      <Stack.Screen name="tasks/new" options={modal} />
      <Stack.Screen name="tasks/reschedule" options={{ presentation: 'formSheet', sheetAllowedDetents: 'fitToContents', sheetGrabberVisible: true }} />
      <Stack.Screen name="tasks/review-note" options={{ presentation: 'formSheet', sheetAllowedDetents: 'fitToContents', sheetGrabberVisible: true }} />
      <Stack.Screen name="leads/new" options={modal} />
      <Stack.Screen name="clients/new" options={modal} />
      <Stack.Screen name="leads/lost" options={{ presentation: 'formSheet', sheetAllowedDetents: 'fitToContents', sheetGrabberVisible: true }} />
      <Stack.Screen name="leads/community" options={{ presentation: 'formSheet', sheetAllowedDetents: 'fitToContents', sheetGrabberVisible: true }} />
    </Stack>
  );
}
