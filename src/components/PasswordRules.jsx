import { View } from 'react-native';
import { Check, Circle } from 'lucide-react-native';
import { Text } from './Text';
import { useTheme } from '@/constants/theme';

// Same rules the server's zod schemas enforce (auth.validation.js); org policy is checked on submit.
export const PASSWORD_RULES = [
  { label: 'At least 8 characters', test: (v) => v.length >= 8 },
  { label: 'One uppercase letter', test: (v) => /[A-Z]/.test(v) },
  { label: 'One lowercase letter', test: (v) => /[a-z]/.test(v) },
  { label: 'One number', test: (v) => /[0-9]/.test(v) },
];

export const passwordValid = (v) => PASSWORD_RULES.every((r) => r.test(v));

export function PasswordRules({ value }) {
  const theme = useTheme();
  return (
    <View className="gap-1.5" accessibilityLabel="Password requirements">
      {PASSWORD_RULES.map(({ label, test }) => {
        const ok = test(value);
        return (
          <View key={label} className="flex-row items-center gap-2">
            {ok ? <Check size={14} color={theme.success} /> : <Circle size={14} color={theme.muted} />}
            <Text className={ok ? 'text-sm text-success' : 'text-sm text-muted'}>{label}</Text>
          </View>
        );
      })}
    </View>
  );
}
