import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CircleAlert, CircleCheck, Info } from 'lucide-react-native';
import { Pressable } from './Pressable';
import { Text } from './Text';
import { colors } from '@/constants/colors';

let show = () => {};

// showToast({ title, message?, tone?: 'success' | 'error' | 'info', onPress?, action?: { label, onPress }, duration? });
// one at a time, newest wins. Without a tone, "Couldn't …" style titles read as errors and the rest as info.
export const showToast = (toast) => show(toast);

const ERROR_TITLE = /^(couldn't|could not|can't|cannot|failed|something went wrong|no |not )/i;
const TONES = {
  success: { icon: CircleCheck, color: 'success' },
  error: { icon: CircleAlert, color: 'danger' },
  info: { icon: Info, color: 'accent' },
};
const ICON = colors.dark; // the pill is black in both themes, so use the dark palette's brighter tones
const OPEN = { damping: 17, stiffness: 210, mass: 0.9 };
const CLOSE = { duration: 260, easing: Easing.in(Easing.cubic) };

// Dynamic Island style: a black pill grows out of the island (or a small pill at the top on phones without one),
// opens to show the message, then shrinks back into it. Tap runs onPress; swipe up dismisses.
// The island is always black, so the pill is too, in light and dark mode.
export function ToastHost() {
  const insets = useSafeAreaInsets();
  const { width: screen } = useWindowDimensions();
  const [toast, setToast] = useState(null);
  const shown = useRef(false);
  const p = useSharedValue(0); // 0 = tucked into the island, 1 = open
  const h = useSharedValue(64); // open height, from the content's layout
  const drag = useSharedValue(0);

  // shortcut: top inset ≥ 59 means a Dynamic Island iPhone (14 Pro and later); its size is Apple's fixed 126×37 at y 11.
  const island = Platform.OS === 'ios' && insets.top >= 59;
  const from = island ? { top: 11, w: 126, h: 37 } : { top: insets.top + 6, w: 120, h: 36 };
  const wide = Math.min(screen - 20, 420);
  const padTop = island ? 44 : 14; // on the island, the content sits below the camera

  const gone = () => { shown.current = false; setToast(null); };
  const hide = () => { p.set(withTiming(0, CLOSE, (done) => done && scheduleOnRN(gone))); };

  useEffect(() => {
    show = (t) => {
      setToast({ ...t, key: Date.now() });
      AccessibilityInfo.announceForAccessibility([t.title, t.message].filter(Boolean).join('. '));
    };
    return () => { show = () => {}; };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(hide, toast.duration ?? 4000);
    return () => clearTimeout(id);
  }, [toast]); // eslint-disable-line react-hooks/exhaustive-deps

  // Opens once the content is measured; a new toast while open gives the pill a small squeeze-and-pop instead.
  const onLayout = (e) => {
    h.set(withSpring(e.nativeEvent.layout.height + padTop + 14, OPEN));
    drag.set(0);
    if (shown.current) p.set(withSequence(withTiming(0.94, { duration: 110 }), withSpring(1, OPEN)));
    else p.set(withSpring(1, OPEN));
    shown.current = true;
  };

  const swipe = usePanGesture({
    onUpdate: (e) => { drag.set(e.translationY < 0 ? e.translationY : e.translationY / 6); },
    onDeactivate: (e) => {
      if (e.translationY < -20 || e.velocityY < -400) { drag.set(withSpring(0, OPEN)); scheduleOnRN(hide); }
      else drag.set(withSpring(0, OPEN));
    },
  });

  const pill = useAnimatedStyle(() => {
    const w = interpolate(p.get(), [0, 1], [from.w, wide]);
    const ht = interpolate(p.get(), [0, 1], [from.h, h.get()]);
    return {
      top: from.top,
      left: (screen - w) / 2,
      width: w,
      height: ht,
      borderRadius: Math.min(ht / 2, interpolate(p.get(), [0, 1], [from.h / 2, 34])),
      // On the island the tucked pill hides behind the real one; elsewhere it fades in and out.
      opacity: island ? 1 : Math.min(1, p.get() * 3),
      transform: [{ translateY: Math.min(drag.get(), 12) }],
    };
  });
  const content = useAnimatedStyle(() => ({
    opacity: interpolate(p.get(), [0.55, 1], [0, 1], 'clamp'),
    transform: [{ scale: interpolate(p.get(), [0, 1], [0.86, 1]) }],
  }));

  if (!toast) return null;
  const close = (fn) => () => { hide(); fn?.(); };
  const tone = TONES[toast.tone] || (ERROR_TITLE.test(toast.title || '') ? TONES.error : TONES.info);
  const Icon = tone.icon;

  return (
    <GestureDetector gesture={swipe}>
      <Animated.View
        style={[{ position: 'absolute', backgroundColor: '#000', overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 10 }, pill]}
      >
        <Animated.View style={[{ position: 'absolute', top: padTop, left: 14, width: wide - 28 }, content]}>
          <Pressable
            key={toast.key}
            onLayout={onLayout}
            onPress={close(toast.onPress)}
            haptic={false}
            accessibilityRole={toast.onPress ? 'button' : 'alert'}
            className="flex-row items-center gap-3 active:scale-100"
          >
            <View className="h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: `${ICON[tone.color]}33` }}>
              <Icon size={20} color={ICON[tone.color]} strokeWidth={2.25} />
            </View>
            <View className="flex-1 gap-0.5">
              <Text className="font-body-semibold text-[15px]" style={{ color: '#fff' }} numberOfLines={1}>{toast.title}</Text>
              {!!toast.message && <Text className="text-sm" style={{ color: 'rgba(255,255,255,0.62)' }} numberOfLines={2}>{toast.message}</Text>}
            </View>
            {!!toast.action && (
              <Pressable onPress={close(toast.action.onPress)} hitSlop={8} accessibilityRole="button" className="rounded-full px-3.5 py-1.5" style={{ backgroundColor: 'rgba(255,255,255,0.16)' }}>
                <Text className="font-body-semibold text-sm" style={{ color: '#fff' }}>{toast.action.label}</Text>
              </Pressable>
            )}
          </Pressable>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}
