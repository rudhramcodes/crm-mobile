import { Pressable as RNPressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { cn } from '@/utils/cn';

// Shared press feedback: slight shrink while held + light haptic. A plain RN Pressable so NativeWind
// styles it the same on iOS, Android and web (className on a Reanimated component didn't apply on device).
export function Pressable({ onPress, haptic = true, className, disabled, ...props }) {
  return (
    <RNPressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      hitSlop={8}
      onPress={(e) => { if (haptic) Haptics.selectionAsync(); onPress?.(e); }}
      className={cn('active:scale-[0.97] active:opacity-90', className)}
      {...props}
    />
  );
}
