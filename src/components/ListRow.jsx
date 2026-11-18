import { View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { Pressable } from './Pressable';
import { Text } from './Text';
import { useTheme } from '@/constants/theme';
import { cn } from '@/utils/cn';

// One settings / menu row: icon tile, label, and a chevron (onPress) or anything on the right.
export function ListRow({ icon: Icon, label, hint, right, onPress, danger, className }) {
  const theme = useTheme();
  const body = (
    <>
      {Icon && (
        <View className={cn('h-10 w-10 items-center justify-center rounded-xl', danger ? 'bg-danger/10' : 'bg-surface-2')}>
          <Icon size={20} color={danger ? theme.danger : theme.ink} />
        </View>
      )}
      <View className="flex-1">
        <Text className={cn('font-body-medium', danger && 'text-danger')}>{label}</Text>
        {!!hint && <Text className="text-sm text-muted">{hint}</Text>}
      </View>
      {right ?? (onPress && <ChevronRight size={18} color={theme.muted} />)}
    </>
  );
  const box = cn('min-h-[56px] flex-row items-center gap-3 py-2', className);
  return onPress ? <Pressable onPress={onPress} accessibilityLabel={label} className={box}>{body}</Pressable> : <View className={box}>{body}</View>;
}
