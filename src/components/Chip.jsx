import { View } from 'react-native';
import { Pressable } from './Pressable';
import { Text } from './Text';
import { cn } from '@/utils/cn';

// Pill filter chip (DESIGN.md §5): ink fill when active, with an optional count inside.
export function Chip({ label, active, count, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={count ? `${label}, ${count}` : label}
      accessibilityState={{ selected: !!active }}
      className={cn('h-9 flex-row items-center gap-1.5 rounded-full px-4', active ? 'bg-ink' : 'bg-surface-2')}
    >
      <Text className={cn('font-body-medium text-sm', active ? 'text-bg' : 'text-ink')}>{label}</Text>
      {!!count && (
        <View className={cn('min-w-[20px] items-center rounded-full px-1.5', active ? 'bg-bg/20' : 'bg-ink/10')}>
          <Text className={cn('font-body-semibold text-xs', active ? 'text-bg' : 'text-ink')}>{count > 99 ? '99+' : count}</Text>
        </View>
      )}
    </Pressable>
  );
}
