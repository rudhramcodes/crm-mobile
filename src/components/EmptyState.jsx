import { View } from 'react-native';
import { Text } from './Text';
import { Button } from './Button';
import { useTheme } from '@/constants/theme';

export function EmptyState({ icon: Icon, title, message, actionTitle, onAction }) {
  const theme = useTheme();
  return (
    <View className="items-center gap-3 px-8 py-16">
      {Icon && (
        <View className="h-14 w-14 items-center justify-center rounded-xl bg-accent/15">
          <Icon size={26} color={theme.accent} />
        </View>
      )}
      <Text className="text-center font-body-semibold text-lg">{title}</Text>
      {message && <Text className="text-center text-sm text-muted">{message}</Text>}
      {actionTitle && <Button title={actionTitle} onPress={onAction} size="sm" className="mt-2" />}
    </View>
  );
}
