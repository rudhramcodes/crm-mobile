import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { useTheme } from '@/constants/theme';
import { useLiveUpdates } from '@/hooks/useLiveUpdates';
import { PushPrimer } from '@/components/PushPrimer';

export default function ClientLayout() {
  useLiveUpdates({ client: true });
  const theme = useTheme();
  return (
    <>
      <PushPrimer client />
      <Stack screenOptions={{ headerShown: false, animation: Platform.OS === 'android' ? 'ios_from_right' : 'default', contentStyle: { backgroundColor: theme.bg } }} />
    </>
  );
}
