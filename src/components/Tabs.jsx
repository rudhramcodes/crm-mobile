import { View } from 'react-native';
import Animated, { Easing, LinearTransition } from 'react-native-reanimated';
import { Pressable } from './Pressable';
import { Text } from './Text';
import { cn } from '@/utils/cn';

const SLIDE = LinearTransition.duration(220).easing(Easing.out(Easing.cubic));

// Segmented control in the app's own colours on every platform: a pill track with an ink thumb that slides to the chosen tab.
export function Tabs({ tabs, value, onChange }) {
  const n = tabs.length;
  const i = tabs.findIndex((t) => t.value === value);
  return (
    <View accessibilityRole="tablist" className="flex-row rounded-full bg-surface-2 p-1">
      {/* Percent sizes so the thumb lines up with the equal-width tabs without measuring; the layout transition slides it. */}
      {i >= 0 && (
        <View pointerEvents="none" className="absolute inset-1">
          <Animated.View layout={SLIDE} className="h-full rounded-full bg-ink" style={{ width: `${100 / n}%`, left: `${(i * 100) / n}%` }} />
        </View>
      )}
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <Pressable
            key={t.value}
            onPress={() => !active && onChange(t.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={t.count ? `${t.label}, ${t.count}` : t.label}
            className="h-10 flex-1 flex-row items-center justify-center gap-1 rounded-full px-1"
          >
            <Text numberOfLines={1} className={cn('font-body-medium text-sm', active ? 'text-bg' : 'text-ink')}>{t.label}</Text>
            {!!t.count && <Text className={cn('text-xs tabular-nums', active ? 'text-bg/70' : 'text-muted')}>{t.count > 99 ? '99+' : t.count}</Text>}
          </Pressable>
        );
      })}
    </View>
  );
}
