import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { useTheme } from '@/constants/theme';
import { useLiveUpdates } from '@/hooks/useLiveUpdates';

export default function ClientLayout() {
  useLiveUpdates({ client: true });
  const theme = useTheme();
  return <Stack screenOptions={{ headerShown: false, animation: Platform.OS === 'android' ? 'ios_from_right' : 'default', contentStyle: { backgroundColor: theme.bg } }} />;
}
