import { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react-native';
import { Input } from './Input';
import { Pressable } from './Pressable';
import { useTheme } from '@/constants/theme';

export const PasswordInput = forwardRef(function PasswordInput({ placeholder = '••••••••', ...props }, ref) {
  const theme = useTheme();
  const [shown, setShown] = useState(false);
  const Icon = shown ? EyeOff : Eye;
  return (
    <Input
      ref={ref}
      secureTextEntry={!shown}
      autoCapitalize="none"
      autoCorrect={false}
      placeholder={placeholder}
      right={(
        <Pressable
          onPress={() => setShown((s) => !s)}
          haptic={false}
          accessibilityLabel={shown ? 'Hide password' : 'Show password'}
          className="h-11 w-11 items-center justify-center"
        >
          <Icon size={18} color={theme.muted} />
        </Pressable>
      )}
      {...props}
    />
  );
});
