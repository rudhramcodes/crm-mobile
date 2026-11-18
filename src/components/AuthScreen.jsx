import { ScrollView, View, useColorScheme } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ChevronLeft } from 'lucide-react-native';
import { Grain } from './Screen';
import { Pressable } from './Pressable';
import { Heading, Text } from './Text';
import { brand } from '@/constants/theme';

const logo = require('../../assets/images/splash-icon.png');

// A deep link can open these screens with nothing behind them, so back falls through to sign-in.
export const goBack = () => (router.canGoBack() ? router.back() : router.replace('/sign-in'));

// Shared frame for the account screens: brown brand header with the ochre mark, then a paper sheet
// holding the title and one form (DESIGN.md §5 Onboarding / auth).
export function AuthScreen({ title, subtitle, back, children }) {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  return (
    <View className="flex-1 bg-bg">
      <StatusBar style="light" />
      {/* Brown behind the top half so an iOS overscroll bounce doesn't flash the paper colour. */}
      <View className="absolute inset-x-0 top-0 h-1/2 bg-brown" />
      <ScrollView contentContainerClassName="flex-grow" keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        <View className="items-center bg-brown px-5 pb-16" style={{ paddingTop: insets.top + 4 }}>
          <Grain />
          <View className="h-11 self-stretch">
            {back && (
              <Pressable onPress={goBack} accessibilityLabel="Back" className="-ml-2 h-11 w-11 items-center justify-center rounded-full bg-beige/10">
                <ChevronLeft size={22} color={brand.beige} />
              </Pressable>
            )}
          </View>
          {/* The header is brown in both themes; in light mode the mark turns beige (single-colour PNG, so a tint recolours it). */}
          <Image source={logo} style={{ width: 150, height: 82 }} contentFit="contain" tintColor={scheme === 'dark' ? null : brand.beige} accessibilityLabel="Rudhram" />
        </View>
        <View className="-mt-8 flex-1 overflow-hidden rounded-t-[32px] bg-bg px-5 pt-8" style={{ paddingBottom: insets.bottom + 24 }}>
          <Grain />
          <Animated.View entering={FadeInDown.duration(350)} style={{ gap: 24 }}>
            <View className="gap-1.5">
              <Heading>{title}</Heading>
              {subtitle && <Text className="text-muted">{subtitle}</Text>}
            </View>
            <View className="gap-4">{children}</View>
          </Animated.View>
        </View>
      </ScrollView>
    </View>
  );
}
