import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { cn } from '@/utils/cn';

// The pulse rides on a plain wrapper; the className stays on a normal View so NativeWind styles it on device.
export function Skeleton({ className }) {
  const reduced = useReducedMotion();
  const opacity = useSharedValue(1);
  useEffect(() => {
    if (!reduced) opacity.set(withRepeat(withTiming(0.45, { duration: 800 }), -1, true));
  }, [reduced, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View style={style} accessibilityElementsHidden>
      <View className={cn('rounded-lg bg-surface-2', className)} />
    </Animated.View>
  );
}
