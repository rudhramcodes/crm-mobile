import { View } from 'react-native';
import { Pressable } from './Pressable';
import { Text } from './Text';
import { cn } from '@/utils/cn';

// Web fallback for the native segmented control (Tabs.ios / Tabs.android).
export function Tabs({ tabs, value, onChange }) {
  return (
    <View accessibilityRole="tablist" className="flex-row gap-1 rounded-full bg-surface-2 p-1">
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <Pressable
            key={t.value}
            onPress={() => onChange(t.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={t.count ? `${t.label}, ${t.count}` : t.label}
            className={cn('h-10 flex-1 flex-row items-center justify-center gap-1 rounded-full px-1', active && 'bg-ink')}
          >
            <Text numberOfLines={1} className={cn('font-body-medium text-sm', active ? 'text-bg' : 'text-ink')}>{t.label}</Text>
            {!!t.count && <Text className={cn('text-xs tabular-nums', active ? 'text-bg/70' : 'text-muted')}>{t.count > 99 ? '99+' : t.count}</Text>}
          </Pressable>
        );
      })}
    </View>
  );
}
