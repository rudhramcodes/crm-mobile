import { ActivityIndicator, View } from 'react-native';
import { Pressable } from './Pressable';
import { Text } from './Text';
import { cn } from '@/utils/cn';
import { useTheme } from '@/constants/theme';

// [box, label, icon/spinner token]. Primary is ink-filled (brown on light, beige on dark), never ochre: DESIGN.md §1.
const variants = {
  primary: ['bg-ink', 'text-bg', 'bg'],
  secondary: ['bg-surface border border-line', 'text-ink', 'ink'],
  danger: ['bg-danger', 'text-bg', 'bg'],
  ghost: ['bg-transparent', 'text-ink', 'muted'],
};

const sizes = {
  sm: ['h-11 px-4', 'text-sm'],
  md: ['h-[52px] px-6', 'text-[15px]'],
};

// textClassName / iconColor: for the few buttons on brand brown (lock screen), where theme tokens don't apply.
export function Button({ title, icon: Icon, variant = 'primary', size = 'md', loading, disabled, className, textClassName, iconColor, ...props }) {
  const theme = useTheme();
  const [box, text, tone] = variants[variant];
  const [sizeBox, sizeText] = sizes[size];
  const color = iconColor ?? theme[tone];
  return (
    <Pressable
      disabled={disabled || loading}
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      className={cn('flex-row items-center justify-center gap-2 rounded-full', box, sizeBox, (disabled || loading) && 'opacity-40', className)}
      {...props}
    >
      {loading ? <ActivityIndicator size="small" color={color} /> : Icon && <View><Icon size={18} color={color} /></View>}
      <Text className={cn('font-body-semibold', text, sizeText, textClassName)}>{title}</Text>
    </Pressable>
  );
}
