import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { useTheme } from '@/constants/theme';
import { useLiveUpdates } from '@/hooks/useLiveUpdates';
import { useClockTimer } from '@/hooks/useClockTimer';

// Android: iOS-style slide with the screen behind easing away, and forms rising from the bottom. iOS keeps its native motion.
const android = Platform.OS === 'android';
const modal = { presentation: 'modal', animation: android ? 'slide_from_bottom' : 'default' };

// Tabs at the root; module screens (leads, task detail, ...) push on top of them as they're built.
export default function StaffLayout() {
  useLiveUpdates();
  useClockTimer();
  const theme = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, animation: android ? 'ios_from_right' : 'default', contentStyle: { backgroundColor: theme.bg } }}>
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
      <Stack.Screen name="freelancers/new" options={modal} />
      <Stack.Screen name="payments/edit" options={modal} />
      <Stack.Screen name="meetings/new" options={modal} />
      <Stack.Screen name="meetings/convert" options={modal} />
      <Stack.Screen name="projects/new" options={modal} />
      <Stack.Screen name="users/new" options={modal} />
      <Stack.Screen name="leads/lost" options={{ presentation: 'formSheet', sheetAllowedDetents: 'fitToContents', sheetGrabberVisible: true }} />
      <Stack.Screen name="leads/community" options={{ presentation: 'formSheet', sheetAllowedDetents: 'fitToContents', sheetGrabberVisible: true }} />
    </Stack>
  );
}
