import { forwardRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import { AlertCircle } from 'lucide-react-native';
import { Text } from './Text';
import { cn } from '@/utils/cn';
import { useTheme } from '@/constants/theme';

export const Input = forwardRef(function Input({ label, error, hint, right, className, onFocus, onBlur, ...props }, ref) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View className={cn('gap-1.5', className)}>
      {label && <Text className="font-body-medium text-sm">{label}</Text>}
      <View className="justify-center">
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        placeholderTextColor={theme.muted}
        selectionColor={theme.accent}
        onFocus={(e) => { setFocused(true); onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); onBlur?.(e); }}
        className={cn(
          'h-[52px] rounded-2xl border-[1.5px] bg-surface-2 px-4 font-body text-[15px] text-ink',
          error ? 'border-danger' : focused ? 'border-accent' : 'border-transparent',
          right && 'pr-12',
        )}
        {...props}
      />
      {right && <View className="absolute right-1">{right}</View>}
      </View>
      {error ? (
        <View className="flex-row items-center gap-1.5">
          <AlertCircle size={14} color={theme.danger} />
          <Text className="flex-1 text-sm text-danger">{error}</Text>
        </View>
      ) : hint ? <Text className="text-sm text-muted">{hint}</Text> : null}
    </View>
  );
});
