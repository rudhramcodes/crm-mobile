import { View } from 'react-native';
import { useNetworkState } from 'expo-network';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WifiOff } from 'lucide-react-native';
import { Text } from './Text';
import { useTheme } from '@/constants/theme';

// Only when the phone is sure there's no internet (undefined = still checking).
export function OfflineBanner() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { isInternetReachable } = useNetworkState();
  if (isInternetReachable !== false) return null;
  return (
    <View pointerEvents="none" className="absolute inset-x-0 items-center" style={{ top: insets.top + 4 }} accessibilityLiveRegion="polite">
      <View className="flex-row items-center gap-2 rounded-full bg-ink px-4 py-2">
        <WifiOff size={14} color={theme.bg} />
        <Text className="text-sm text-bg">{"You're offline. Showing what was last loaded."}</Text>
      </View>
    </View>
  );
}
