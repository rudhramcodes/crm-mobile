import { Stack } from 'expo-router';
import { useLiveUpdates } from '@/hooks/useLiveUpdates';

// Tabs at the root; module screens (leads, task detail, ...) push on top of them as they're built.
export default function StaffLayout() {
  useLiveUpdates();
  return <Stack screenOptions={{ headerShown: false }} />;
}
