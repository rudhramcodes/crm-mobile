import { useEffect, useState } from 'react';
import { Alert, Platform, Switch, View } from 'react-native';
import { router } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { Bell, Fingerprint, KeyRound, LogOut, MailWarning, Volume2 } from 'lucide-react-native';
import { Card } from './Card';
import { Text } from './Text';
import { Avatar } from './Avatar';
import { ListRow } from './ListRow';
import { Button } from './Button';
import { signOut } from '@/store/session';
import { authenticate, biometricLabel, getBiometricPref, setBiometricPref } from '@/utils/biometric';
import { isSoundOn, playNotificationSound, setSoundOn } from '@/utils/notificationSound';
import { isPushOn, registerPush, setPushOn, unregisterPush } from '@/services/push';
import { ROLE_LABELS } from '@/constants';
import { useTheme } from '@/constants/theme';

export function Toggle({ value, onValueChange, label }) {
  const theme = useTheme();
  return <Switch value={value} onValueChange={onValueChange} accessibilityLabel={label} trackColor={{ true: theme.accent, false: theme.line }} thumbColor={theme.surface} ios_backgroundColor={theme.line} />;
}

export const confirmSignOut = (dispatch) => Alert.alert('Sign out?', "You'll need your password to sign in again.", [
  { text: 'Cancel', style: 'cancel' },
  { text: 'Sign out', style: 'destructive', onPress: () => dispatch(signOut()) },
]);

// Per-phone settings: biometric lock, push, sound. `test` adds a "Test" button to the sound row.
export function PhoneSettings({ test }) {
  const dispatch = useDispatch();
  const [label, setLabel] = useState(null);
  const [lock, setLock] = useState(false);
  const [push, setPush] = useState(true);
  const [sound, setSound] = useState(true);

  useEffect(() => {
    biometricLabel().then(setLabel);
    getBiometricPref().then((v) => setLock(v === 'on'));
    isPushOn().then(setPush);
    isSoundOn().then(setSound);
  }, []);

  // Turning the lock on proves the face/finger first, so nobody locks themselves out by accident.
  const toggleLock = async (on) => {
    if (on && !(await authenticate(`Turn on ${label}`)).success) return;
    setLock(on);
    setBiometricPref(on ? 'on' : 'off');
  };
  const togglePush = async (on) => {
    setPush(on);
    await setPushOn(on);
    if (on) registerPush(dispatch).catch(() => {});
    else unregisterPush(dispatch);
  };
  const toggleSound = (on) => { setSound(on); setSoundOn(on); };

  return (
    <Card className="py-2">
      {label && <ListRow icon={Fingerprint} label={`Unlock with ${label}`} hint="Locks after 5 minutes away" right={<Toggle value={lock} onValueChange={toggleLock} label={`Unlock with ${label}`} />} />}
      {Platform.OS !== 'web' && <ListRow icon={Bell} label="Push notifications" hint="Alerts when the app is closed" right={<Toggle value={push} onValueChange={togglePush} label="Push notifications" />} />}
      <ListRow
        icon={Volume2}
        label="Notification sound"
        hint="While the app is open"
        right={(
          <View className="flex-row items-center gap-2">
            {test && <Button title="Test" size="sm" variant="secondary" disabled={!sound} onPress={() => playNotificationSound().catch(() => {})} />}
            <Toggle value={sound} onValueChange={toggleSound} label="Notification sound" />
          </View>
        )}
      />
    </Card>
  );
}

// Profile card, phone settings, password and sign out (client Profile).
// `compact` (staff More): just who's signed in and Sign out; the rest lives in Settings.
export function AccountSettings({ compact }) {
  const dispatch = useDispatch();
  const user = useSelector((s) => s.auth.user);

  if (compact) {
    return (
      <View>
        <Text className="mb-2 text-caption uppercase text-muted">Account</Text>
        <Card className="py-2">
          <View className="min-h-[64px] flex-row items-center gap-3 py-2">
            <Avatar ring name={user.name} uri={user.avatar || undefined} size={40} />
            <View className="flex-1">
              <Text className="font-body-semibold" numberOfLines={1}>{user.name}</Text>
              <Text className="text-sm text-muted" numberOfLines={1}>{user.email}</Text>
              <Text className="text-caption uppercase text-accent-ink">{ROLE_LABELS[user.role] ?? user.role}</Text>
            </View>
          </View>
          <ListRow icon={LogOut} label="Sign out" danger onPress={() => confirmSignOut(dispatch)} />
        </Card>
      </View>
    );
  }

  return (
    <View className="gap-5">
      <Card className="flex-row items-center gap-3">
        <Avatar name={user.name} uri={user.avatar} size={52} />
        <View className="flex-1">
          <Text className="font-body-semibold text-lg" numberOfLines={1}>{user.name}</Text>
          <Text className="text-sm text-muted" numberOfLines={1}>{user.email}</Text>
          <Text className="text-caption uppercase text-accent-ink">{ROLE_LABELS[user.role] ?? user.role}</Text>
        </View>
      </Card>
      <View>
        <Text className="mb-2 text-caption uppercase text-muted">This phone</Text>
        <PhoneSettings />
      </View>
      <View>
        <Text className="mb-2 text-caption uppercase text-muted">Account</Text>
        <Card className="py-2">
        {!user.isEmailVerified && <ListRow icon={MailWarning} label="Verify your email" onPress={() => router.push('/verify-email')} />}
        <ListRow icon={KeyRound} label="Change password" onPress={() => router.push('/change-password')} />
        <ListRow icon={LogOut} label="Sign out" danger onPress={() => confirmSignOut(dispatch)} />
        </Card>
      </View>
    </View>
  );
}
