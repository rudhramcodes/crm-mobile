import { View } from 'react-native';
import { AlertCircle, CheckCircle2 } from 'lucide-react-native';
import { Text } from './Text';
import { cn } from '@/utils/cn';
import { useTheme } from '@/constants/theme';

const tones = {
  error: ['bg-danger/10', 'text-danger', AlertCircle, 'danger'],
  success: ['bg-success/10', 'text-success', CheckCircle2, 'success'],
};

export function Alert({ tone = 'error', message, className }) {
  const theme = useTheme();
  if (!message) return null;
  const [box, text, Icon, color] = tones[tone];
  return (
    <View accessibilityRole="alert" accessibilityLiveRegion="polite" className={cn('flex-row gap-3 rounded-2xl p-4', box, className)}>
      <Icon size={18} color={theme[color]} />
      <Text className={cn('flex-1 text-sm', text)}>{message}</Text>
    </View>
  );
}
