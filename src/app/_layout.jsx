import '../global.css';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { WifiOff } from 'lucide-react-native';
import { useFonts, Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold } from '@expo-google-fonts/manrope';
import { store } from '@/store';
import { restoreSession } from '@/store/session';
import { EmptyState, LockScreen, OfflineBanner, Screen, ToastHost } from '@/components';
import { useAutoLock } from '@/hooks/useAutoLock';

SplashScreen.preventAutoHideAsync();

function RootStack({ fontsReady }) {
  const dispatch = useDispatch();
  const { status, user, locked } = useSelector((s) => s.auth);
  const restoring = status === 'restoring';

  useEffect(() => { dispatch(restoreSession()); }, [dispatch]);
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
    <>
    <Stack screenOptions={{ headerShown: false }}>
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
    </>
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
