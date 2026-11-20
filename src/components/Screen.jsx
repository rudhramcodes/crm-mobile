import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useEffect } from 'react';
import { useNavigation } from 'expo-router';
import { cn } from '@/utils/cn';

const grain = require('../../assets/images/grain.png');

// Paper grain: screen backgrounds only, under everything, never on cards (DESIGN.md §2).
export const Grain = () => (
  <View pointerEvents="none" accessibilityElementsHidden className="absolute inset-0 opacity-[0.07] dark:opacity-[0.05]">
    <Image source={grain} resizeMode="repeat" style={styles.fill} />
  </View>
);

const styles = StyleSheet.create({ fill: { width: '100%', height: '100%' }, flex: { flex: 1 } });
const ease = { duration: 260, easing: Easing.out(Easing.cubic) };

// Native tabs switch with no animation, so a tab's content fades and rises a little when its tab is pressed
// (not when coming back from a pushed screen, which already slides). The background stays put.
// Reanimated skips it when the system's reduce-motion setting is on.
function TabFade({ children }) {
  const navigation = useNavigation();
  const opacity = useSharedValue(0);
  const y = useSharedValue(10);
  useEffect(() => {
    const play = () => {
      opacity.set(0);
      y.set(10);
      opacity.set(withTiming(1, ease));
      y.set(withTiming(0, ease));
    };
    play(); // first open (tabs mount lazily, so tabPress fired before this listener existed)
    return navigation.addListener('tabPress', () => !navigation.isFocused() && play());
  }, [navigation, opacity, y]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.get(), transform: [{ translateY: y.get() }] }));
  return <Animated.View style={[styles.flex, style]}>{children}</Animated.View>;
}

// Android: native tabs pad the bottom for the tab bar. iOS: native tabs only pad the scroll view they find
// through first children, and Grain comes first here, so the ScrollView asks UIKit for the tab bar inset itself.
// `tab`: the screen is a tab root, so it gets the focus fade.
export function Screen({ scroll, className, edges = ['top'], refreshControl, tab, children }) {
  const body = scroll ? (
    // iOS insets the scroll view for the keyboard itself; Android is edge-to-edge (no window resize), so shrink it here.
    // The native Android ScrollView then scrolls the focused input back into view.
    <KeyboardAvoidingView behavior="padding" enabled={Platform.OS === 'android'} style={styles.flex}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerClassName={cn('px-5 pb-8', className)} refreshControl={refreshControl} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>{children}</ScrollView>
    </KeyboardAvoidingView>
  ) : (
    <View className={cn('flex-1 px-5', className)}>{children}</View>
  );
  return (
    <SafeAreaView edges={edges} className="flex-1 bg-bg">
      <Grain />
      {tab ? <TabFade>{body}</TabFade> : body}
    </SafeAreaView>
  );
}
