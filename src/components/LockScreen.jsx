import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import * as Haptics from 'expo-haptics';
import { Fingerprint, LogOut, ScanFace } from 'lucide-react-native';
import { Grain } from './Screen';
import { Heading, Text } from './Text';
import { Button } from './Button';
import { authenticate, biometricLabel } from '@/utils/biometric';
import { setLocked } from '@/store/authSlice';
import { signOut } from '@/store/session';

const logo = require('../../assets/images/splash-icon.png');

// Covers the app (it stays mounted underneath) until Face ID / fingerprint / passcode succeeds.
export function LockScreen() {
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const name = useSelector((s) => s.auth.user?.name?.split(' ')[0]);
  const [label, setLabel] = useState(null);
  const [error, setError] = useState(null);

  const done = useCallback((res) => {
    if (res.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return dispatch(setLocked(false));
    }
    if (res.error === 'user_cancel' || res.error === 'system_cancel' || res.error === 'app_cancel') return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    setError(res.error === 'not_enrolled' || res.error === 'passcode_not_set' || res.error === 'not_available'
      ? 'This phone has no Face ID, fingerprint or passcode set up any more. Sign out and sign in with your password.'
      : res.error === 'lockout'
        ? 'Too many tries. Unlock your phone with its passcode, then try again.'
        : "That didn't work. Try again.");
  }, [dispatch]);
  const unlock = () => authenticate().then(done);

  // Ask straight away, so opening the app goes face/finger -> in.
  useEffect(() => {
    biometricLabel().then(setLabel);
    authenticate().then(done);
  }, [done]);

  const Icon = label === 'Face ID' || label === 'Face unlock' ? ScanFace : Fingerprint;
  return (
    <View
      className="absolute inset-0 items-center justify-between bg-brown px-8"
      style={{ paddingTop: insets.top + 64, paddingBottom: insets.bottom + 32 }}
    >
      <StatusBar style="light" />
      <Grain />
      <Image source={logo} style={{ width: 150, height: 82 }} contentFit="contain" accessibilityLabel="Rudhram" />
      <View className="items-center gap-3">
        <View className="mb-2 h-20 w-20 items-center justify-center rounded-full bg-beige/10">
          <Icon size={36} color="#f6f1e0" strokeWidth={1.5} />
        </View>
        <Heading className="text-center text-beige">{name ? `Welcome back, ${name}` : 'Welcome back'}</Heading>
        <Text className="text-center text-beige/70">{error ?? 'Rudhram CRM is locked.'}</Text>
      </View>
      <View className="w-full gap-2">
        <Button title={label ? `Unlock with ${label}` : 'Unlock'} icon={Icon} onPress={unlock} className="bg-beige" textClassName="text-brown" iconColor="#3b2515" />
        <Button title="Sign out" icon={LogOut} variant="ghost" onPress={() => dispatch(signOut())} textClassName="text-beige" iconColor="#f6f1e0" />
      </View>
    </View>
  );
}
