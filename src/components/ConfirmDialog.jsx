import { Modal, Pressable as RNPressable, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Trash2 } from 'lucide-react-native';
import { Button } from './Button';
import { Text } from './Text';
import { useTheme } from '@/constants/theme';

// Centered confirm for destructive actions. Tapping the backdrop or Android back cancels (unless busy).
// secondaryLabel/onSecondary add a second destructive choice (e.g. "Delete entire series"); buttons then stack.
export function ConfirmDialog({ visible, title, message, confirmLabel = 'Delete', loading, onConfirm, onCancel, secondaryLabel, onSecondary }) {
  const theme = useTheme();
  const cancel = () => !loading && onCancel();
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={cancel} onShow={() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)}>
      <View className="flex-1 items-center justify-center px-6">
        <RNPressable onPress={cancel} accessibilityLabel="Cancel" className="absolute inset-0 bg-black/50" />
        <View accessibilityViewIsModal className="w-full max-w-sm gap-4 rounded-3xl bg-surface p-6">
          <View className="h-12 w-12 items-center justify-center rounded-full bg-danger/15">
            <Trash2 size={22} color={theme.danger} />
          </View>
          <View className="gap-1.5">
            <Text accessibilityRole="header" className="font-body-semibold text-lg">{title}</Text>
            {!!message && <Text className="text-sm text-muted">{message}</Text>}
          </View>
          {secondaryLabel ? (
            <View className="gap-2">
              <Button title={confirmLabel} variant="danger" loading={loading} onPress={onConfirm} />
              <Button title={secondaryLabel} variant="ghost" className="bg-danger/10" textClassName="text-danger" disabled={loading} onPress={onSecondary} />
              <Button title="Cancel" variant="secondary" disabled={loading} onPress={onCancel} />
            </View>
          ) : (
            <View className="flex-row gap-3">
              <Button title="Cancel" variant="secondary" className="flex-1" disabled={loading} onPress={onCancel} />
              <Button title={confirmLabel} variant="danger" className="flex-1" loading={loading} onPress={onConfirm} />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
