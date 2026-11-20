import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { cn } from '@/utils/cn';

const grain = require('../../assets/images/grain.png');

// Paper grain: screen backgrounds only, under everything, never on cards (DESIGN.md §2).
export const Grain = () => (
  <View pointerEvents="none" accessibilityElementsHidden className="absolute inset-0 opacity-[0.07] dark:opacity-[0.05]">
    <Image source={grain} resizeMode="repeat" style={styles.fill} />
  </View>
);

const styles = StyleSheet.create({ fill: { width: '100%', height: '100%' }, flex: { flex: 1 } });

// Android: native tabs pad the bottom for the tab bar. iOS: native tabs only pad the scroll view they find
// through first children, and Grain comes first here, so the ScrollView asks UIKit for the tab bar inset itself.
export function Screen({ scroll, className, edges = ['top'], refreshControl, children }) {
  return (
    <SafeAreaView edges={edges} className="flex-1 bg-bg">
      <Grain />
      {scroll ? (
        // iOS insets the scroll view for the keyboard itself; Android is edge-to-edge (no window resize), so shrink it here.
        // The native Android ScrollView then scrolls the focused input back into view.
        <KeyboardAvoidingView behavior="padding" enabled={Platform.OS === 'android'} style={styles.flex}>
          <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerClassName={cn('px-5 pb-8', className)} refreshControl={refreshControl} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>{children}</ScrollView>
        </KeyboardAvoidingView>
      ) : (
        <View className={cn('flex-1 px-5', className)}>{children}</View>
      )}
    </SafeAreaView>
  );
}
