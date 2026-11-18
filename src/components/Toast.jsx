import { useEffect, useState } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pressable } from './Pressable';
import { Text } from './Text';

let show = () => {};

// showToast({ title, message?, onPress?, action?: { label, onPress }, duration? }); one at a time, newest wins.
export const showToast = (toast) => show(toast);

export function ToastHost() {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState(null);

  useEffect(() => {
    show = (t) => {
      setToast({ ...t, key: Date.now() });
      AccessibilityInfo.announceForAccessibility([t.title, t.message].filter(Boolean).join('. '));
    };
    return () => { show = () => {}; };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), toast.duration ?? 4000);
    return () => clearTimeout(id);
  }, [toast]);

  if (!toast) return null;
  const close = (fn) => () => { setToast(null); fn?.(); };
  return (
    <Animated.View key={toast.key} entering={FadeInUp.duration(250)} exiting={FadeOutUp.duration(200)} style={{ position: 'absolute', top: insets.top + 8, left: 16, right: 16 }}>
      <Pressable onPress={close(toast.onPress)} haptic={false} className="flex-row items-center gap-3 rounded-2xl bg-ink px-4 py-3">
        <View className="flex-1">
          <Text className="font-body-semibold text-bg" numberOfLines={1}>{toast.title}</Text>
          {!!toast.message && <Text className="text-sm text-bg/70" numberOfLines={2}>{toast.message}</Text>}
        </View>
        {toast.action && (
          <Pressable onPress={close(toast.action.onPress)} hitSlop={12} accessibilityRole="button">
            <Text className="font-body-semibold text-accent">{toast.action.label}</Text>
          </Pressable>
        )}
      </Pressable>
    </Animated.View>
  );
}
