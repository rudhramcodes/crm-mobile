import { useEffect, useState } from 'react';
import { Alert, Switch, View } from 'react-native';
import { router } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { Fingerprint, KeyRound, LogOut, MailWarning, Volume2 } from 'lucide-react-native';
import { Card } from './Card';
import { Text } from './Text';
import { Avatar } from './Avatar';
import { ListRow } from './ListRow';
import { signOut } from '@/store/session';
import { authenticate, biometricLabel, getBiometricPref, setBiometricPref } from '@/utils/biometric';
import { isSoundOn, setSoundOn } from '@/utils/notificationSound';
import { useTheme } from '@/constants/theme';

const roleName = { super_admin: 'Super admin', admin: 'Admin', manager: 'Manager', employee: 'Employee', client: 'Client' };

function Toggle({ value, onValueChange, label }) {
  const theme = useTheme();
  return <Switch value={value} onValueChange={onValueChange} accessibilityLabel={label} trackColor={{ true: theme.accent, false: theme.line }} thumbColor={theme.surface} ios_backgroundColor={theme.line} />;
}

// Profile card, phone settings (biometric lock, sound), password and sign out. Shared by staff More and client Profile.
export function AccountSettings() {
  const dispatch = useDispatch();
  const user = useSelector((s) => s.auth.user);
  const [label, setLabel] = useState(null);
  const [lock, setLock] = useState(false);
  const [sound, setSound] = useState(true);

  useEffect(() => {
    biometricLabel().then(setLabel);
    getBiometricPref().then((v) => setLock(v === 'on'));
    isSoundOn().then(setSound);
  }, []);

  // Turning the lock on proves the face/finger first, so nobody locks themselves out by accident.
  const toggleLock = async (on) => {
    if (on && !(await authenticate(`Turn on ${label}`)).success) return;
    setLock(on);
    setBiometricPref(on ? 'on' : 'off');
  };
  const toggleSound = (on) => { setSound(on); setSoundOn(on); };
  const confirmSignOut = () => Alert.alert('Sign out?', "You'll need your password to sign in again.", [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Sign out', style: 'destructive', onPress: () => dispatch(signOut()) },
  ]);

  return (
    <View className="gap-5">
      <Card className="flex-row items-center gap-3">
        <Avatar name={user.name} uri={user.avatar} size={52} />
        <View className="flex-1">
          <Text className="font-body-semibold text-lg" numberOfLines={1}>{user.name}</Text>
          <Text className="text-sm text-muted" numberOfLines={1}>{user.email}</Text>
          <Text className="text-caption uppercase text-accent-ink">{roleName[user.role] ?? user.role}</Text>
        </View>
      </Card>
      <View>
        <Text className="mb-2 text-caption uppercase text-muted">This phone</Text>
        <Card className="py-2">
        {label && <ListRow icon={Fingerprint} label={`Unlock with ${label}`} hint="Locks after 5 minutes away" right={<Toggle value={lock} onValueChange={toggleLock} label={`Unlock with ${label}`} />} />}
        <ListRow icon={Volume2} label="Notification sound" hint="While the app is open" right={<Toggle value={sound} onValueChange={toggleSound} label="Notification sound" />} />
        </Card>
      </View>
      <View>
        <Text className="mb-2 text-caption uppercase text-muted">Account</Text>
        <Card className="py-2">
        {!user.isEmailVerified && <ListRow icon={MailWarning} label="Verify your email" onPress={() => router.push('/verify-email')} />}
        <ListRow icon={KeyRound} label="Change password" onPress={() => router.push('/change-password')} />
        <ListRow icon={LogOut} label="Sign out" danger onPress={confirmSignOut} />
        </Card>
      </View>
    </View>
  );
}
