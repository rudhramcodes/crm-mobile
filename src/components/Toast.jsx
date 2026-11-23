import { useEffect, useState } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp, LinearTransition, useAnimatedStyle, useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CircleAlert, CircleCheck, Info, X } from 'lucide-react-native';
import { Pressable } from './Pressable';
import { Text } from './Text';
import { useTheme } from '@/constants/theme';
import { cn } from '@/utils/cn';

let show = () => {};

// showToast({ title, message?, tone?: 'success' | 'error' | 'info', onPress?, action?: { label, onPress }, duration? });
// one at a time, newest wins. Without a tone, "Couldn't …" style titles read as errors and the rest as info.
export const showToast = (toast) => show(toast);

const ERROR_TITLE = /^(couldn't|could not|can't|cannot|failed|something went wrong|no |not )/i;
const TONES = {
  success: { icon: CircleCheck, color: 'success', tile: 'bg-success/15', bar: 'bg-success' },
  error: { icon: CircleAlert, color: 'danger', tile: 'bg-danger/15', bar: 'bg-danger' },
  info: { icon: Info, color: 'accent-ink', tile: 'bg-accent/15', bar: 'bg-accent' },
};

// Thin line along the bottom that runs out with the toast's time.
function TimeBar({ duration, className }) {
  const left = useSharedValue(1);
  useEffect(() => { left.set(withTiming(0, { duration, easing: Easing.linear })); }, [duration, left]);
  const style = useAnimatedStyle(() => ({ width: `${left.get() * 100}%` }));
  return <Animated.View style={style} className={cn('absolute bottom-0 left-0 h-[3px] opacity-70', className)} />;
}

export function ToastHost() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
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
  const tone = TONES[toast.tone] || (ERROR_TITLE.test(toast.title || '') ? TONES.error : TONES.info);
  const Icon = tone.icon;

  return (
    <Animated.View
      key={toast.key}
      entering={FadeInUp.springify().damping(18).stiffness(180)}
      exiting={FadeOutUp.duration(180)}
      layout={LinearTransition}
      style={{ position: 'absolute', top: insets.top + 8, left: 16, right: 16 }}
    >
      <Pressable
        onPress={close(toast.onPress)}
        haptic={false}
        accessibilityRole={toast.onPress ? 'button' : 'alert'}
        className="flex-row items-center gap-3 overflow-hidden rounded-2xl border border-line bg-surface py-3 pl-3 pr-2 shadow-lg"
        style={{ shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8 }}
      >
        <View className={cn('h-10 w-10 items-center justify-center rounded-xl', tone.tile)}>
          <Icon size={20} color={theme[tone.color]} strokeWidth={2.25} />
        </View>
        <View className="flex-1 gap-0.5">
          <Text className="font-body-semibold text-[15px]" numberOfLines={1}>{toast.title}</Text>
          {!!toast.message && <Text className="text-sm text-muted" numberOfLines={2}>{toast.message}</Text>}
        </View>
        {toast.action ? (
          <Pressable onPress={close(toast.action.onPress)} hitSlop={8} accessibilityRole="button" className={cn('rounded-full px-3 py-1.5', tone.tile)}>
            <Text className="font-body-semibold text-sm text-ink">{toast.action.label}</Text>
          </Pressable>
        ) : (
          <Pressable onPress={close()} haptic={false} hitSlop={8} accessibilityLabel="Dismiss" className="h-8 w-8 items-center justify-center rounded-full">
            <X size={16} color={theme.muted} />
          </Pressable>
        )}
        <TimeBar duration={toast.duration ?? 4000} className={tone.bar} />
      </Pressable>
    </Animated.View>
  );
}
