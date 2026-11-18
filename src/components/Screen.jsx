import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { cn } from '@/utils/cn';

const grain = require('../../assets/images/grain.png');

// Paper grain: screen backgrounds only, under everything, never on cards (DESIGN.md §2).
export const Grain = () => (
  <View pointerEvents="none" accessibilityElementsHidden className="absolute inset-0 opacity-[0.07] dark:opacity-[0.05]">
    <Image source={grain} resizeMode="repeat" style={styles.fill} />
  </View>
);

const styles = StyleSheet.create({ fill: { width: '100%', height: '100%' } });

// Under native tabs the system pads for the tab bar: the first ScrollView on iOS, a SafeAreaView on Android.
export function Screen({ scroll, className, edges = ['top'], children }) {
  return (
    <SafeAreaView edges={edges} className="flex-1 bg-bg">
      <Grain />
      {scroll ? (
        <ScrollView contentContainerClassName={cn('px-5 pb-8', className)} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>{children}</ScrollView>
      ) : (
        <View className={cn('flex-1 px-5', className)}>{children}</View>
      )}
    </SafeAreaView>
  );
}
