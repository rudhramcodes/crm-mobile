import '../global.css';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { WifiOff } from 'lucide-react-native';
import { useFonts, Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold } from '@expo-google-fonts/manrope';
import { store } from '@/store';
import { restoreSession } from '@/store/session';
import { EmptyState, LockScreen, OfflineBanner, Screen, ToastHost } from '@/components';
import { useAutoLock } from '@/hooks/useAutoLock';
import { useTheme } from '@/constants/theme';

SplashScreen.preventAutoHideAsync();

// Navigator colours = ours, so no screen, card or transition ever paints the library's default white.
const navTheme = (t, dark) => {
  const base = dark ? DarkTheme : DefaultTheme;
  return { ...base, colors: { ...base.colors, primary: t.accent, background: t.bg, card: t.bg, text: t.ink, border: t.line, notification: t.accent } };
};

function RootStack({ fontsReady }) {
  const dispatch = useDispatch();
  const { status, user, locked } = useSelector((s) => s.auth);
  const restoring = status === 'restoring';
  const theme = useTheme();
  const scheme = useColorScheme();

  useEffect(() => { dispatch(restoreSession()); }, [dispatch]);
  // The native window shows through while screens slide; it defaults to white, so give it our background.
  useEffect(() => { SystemUI.setBackgroundColorAsync(theme.bg); }, [theme.bg]);
  useAutoLock();
  useEffect(() => { if (fontsReady && !restoring) SplashScreen.hideAsync(); }, [fontsReady, restoring]);
  if (!fontsReady || restoring) return null;

  if (status === 'offline') {
    return (
      <Screen className="justify-center">
        <EmptyState
          icon={WifiOff}
          title="You're offline"
          message="Rudhram CRM needs a connection to sign you in. Check your internet and try again."
          actionTitle="Try again"
          onAction={() => dispatch(restoreSession())}
        />
      </Screen>
    );
  }

  const signedIn = status === 'signedIn';
  const ready = signedIn && !user.mustChangePassword;
  const client = user?.role === 'client';
  // Where each state lands; a guarded-off route goes here (explicit, not "first available").
  const home = !signedIn ? '/sign-in' : !ready ? '/change-password' : client ? '/portal' : '/';
  return (
    <ThemeProvider value={navTheme(theme, scheme === 'dark')}>
    <Stack screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: theme.bg } }}>
      <Stack.Protected redirectTo={home} guard={ready && !client}>
        <Stack.Screen name="(staff)" />
      </Stack.Protected>
      <Stack.Protected redirectTo={home} guard={ready && client}>
        <Stack.Screen name="(client)" />
      </Stack.Protected>
      <Stack.Protected redirectTo={home} guard={signedIn}>
        <Stack.Screen name="change-password" options={{ gestureEnabled: ready }} />
      </Stack.Protected>
      <Stack.Protected redirectTo={home} guard={ready}>
        <Stack.Screen name="verify-email" />
      </Stack.Protected>
      <Stack.Protected redirectTo={home} guard={!signedIn}>
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="forgot-password" />
        <Stack.Screen name="reset-password" />
        <Stack.Screen name="accept-invite" />
      </Stack.Protected>
    </Stack>
    <OfflineBanner />
    <ToastHost />
    {/* Over everything, so the screens underneath keep their place. */}
    {signedIn && locked && <LockScreen />}
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({ Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold,
    'Goldenbook-Bold': require('../../assets/fonts/Goldenbook Bold.otf'),
    'Goldenbook-Regular': require('../../assets/fonts/Goldenbook Regular.otf'),
  });
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Provider store={store}>
        <StatusBar style="auto" />
        <RootStack fontsReady={loaded || !!error} />
      </Provider>
    </GestureHandlerRootView>
  );
}
