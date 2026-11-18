import { Stack } from 'expo-router';
import { useLiveUpdates } from '@/hooks/useLiveUpdates';

export default function ClientLayout() {
  useLiveUpdates({ client: true });
  return <Stack screenOptions={{ headerShown: false }} />;
}
