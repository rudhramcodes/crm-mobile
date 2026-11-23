import { useEffect, useState } from 'react';
import { Alert, AppState, Linking, Platform, Switch, View } from 'react-native';
import { router } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { Bell, Fingerprint, KeyRound, LogOut, MailWarning, Moon, Volume2 } from 'lucide-react-native';
import { Card } from './Card';
import { Text } from './Text';
import { Avatar } from './Avatar';
import { ListRow } from './ListRow';
import { Button } from './Button';
import { Chip } from './Chip';
import { signOut } from '@/store/session';
import { LOCK_CHOICES, authenticate, biometricLabel, getBiometricPref, getLockMinutes, setBiometricPref, setLockMinutes } from '@/utils/biometric';
import { isQuietOn, isSoundOn, playNotificationSound, setQuietOn, setSoundOn } from '@/utils/notificationSound';
import { hasPush, isPushOn, pushPermission, registerPush, setPrimerChoice, setPushOn, unregisterPush } from '@/services/push';
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

// Per-phone settings: biometric lock (and how soon it locks), push, sound. `test` adds a "Test" button to the sound row.
export function PhoneSettings({ test }) {
  const dispatch = useDispatch();
  const [label, setLabel] = useState(null);
  const [lock, setLock] = useState(false);
  const [lockMin, setLockMin] = useState(5);
  const [push, setPush] = useState(true);
  // 'granted' | 'ask' | 'blocked': 'blocked' means only the phone's Settings app can turn notifications back on.
  const [perm, setPerm] = useState(null);
  const [sound, setSound] = useState(true);
  const [quiet, setQuiet] = useState(false);

  useEffect(() => {
    isQuietOn().then(setQuiet);
    biometricLabel().then(setLabel);
    getBiometricPref().then((v) => setLock(v === 'on'));
    getLockMinutes().then(setLockMin);
    isPushOn().then(setPush);
    isSoundOn().then(setSound);
    if (Platform.OS === 'web') return undefined;
    // Re-check when coming back from the phone's Settings app: if notifications were allowed there, register now.
    const check = async () => {
      const p = await pushPermission();
      setPerm(p);
      if (p === 'granted' && !hasPush() && (await isPushOn())) registerPush(dispatch).catch(() => {});
    };
    check().catch(() => {});
    const sub = AppState.addEventListener('change', (s) => s === 'active' && check().catch(() => {}));
    return () => sub.remove();
  }, [dispatch]);

  // Turning the lock on proves the face/finger first, so nobody locks themselves out by accident.
  const toggleLock = async (on) => {
    if (on && !(await authenticate(`Turn on ${label}`)).success) return;
    setLock(on);
    setBiometricPref(on ? 'on' : 'off');
  };
  const pickLockMin = (min) => { setLockMin(min); setLockMinutes(min); };
  // Turning push on is a clear "yes", so this is where the phone's own prompt may appear.
  const togglePush = async (on) => {
    setPush(on);
    await setPushOn(on);
    if (!on) return unregisterPush(dispatch);
    await setPrimerChoice('asked');
    await registerPush(dispatch, { ask: true }).catch(() => {});
    setPerm(await pushPermission().catch(() => null));
  };
  const toggleSound = (on) => { setSound(on); setSoundOn(on); };
  const toggleQuiet = (on) => { setQuiet(on); setQuietOn(on); };

  return (
    <Card className="py-2">
      {label && <ListRow icon={Fingerprint} label={`Unlock with ${label}`} hint={`Locks after ${lockMin} ${lockMin === 1 ? 'minute' : 'minutes'} away`} right={<Toggle value={lock} onValueChange={toggleLock} label={`Unlock with ${label}`} />} />}
      {label && lock && (
        <View className="flex-row flex-wrap items-center gap-2 pb-3 pl-[52px]" accessibilityRole="radiogroup" accessibilityLabel="Lock after">
          <Text className="text-sm text-muted">Lock after</Text>
          {LOCK_CHOICES.map((m) => <Chip key={m} label={`${m} min`} active={lockMin === m} onPress={() => pickLockMin(m)} />)}
        </View>
      )}
      {Platform.OS !== 'web' && (perm === 'blocked' ? (
        <ListRow
          icon={Bell}
          label="Push notifications"
          hint="Off in your phone's settings"
          right={<Button title="Open settings" size="sm" variant="secondary" onPress={() => Linking.openSettings().catch(() => {})} />}
        />
      ) : (
        // Shown on only once the phone has said yes; until then turning it on brings up the phone's prompt.
        <ListRow icon={Bell} label="Push notifications" hint="Alerts when the app is closed" right={<Toggle value={push && perm !== 'ask'} onValueChange={togglePush} label="Push notifications" />} />
      ))}
      <ListRow
        icon={Volume2}
        label="Notification sound"
        hint="While the app is open"
        right={(
          <View className="flex-row items-center gap-2">
            {test && <Button title="Test" size="sm" variant="secondary" disabled={!sound} onPress={() => playNotificationSound({ test: true }).catch(() => {})} />}
            <Toggle value={sound} onValueChange={toggleSound} label="Notification sound" />
          </View>
        )}
      />
      {Platform.OS !== 'web' && <ListRow icon={Moon} label="Quiet at night" hint="9 PM to 8 AM, silent while the app is open" right={<Toggle value={quiet} onValueChange={toggleQuiet} label="Quiet at night" />} />}
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
