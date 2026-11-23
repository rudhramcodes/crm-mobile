import { useEffect, useState } from 'react';
import { Modal, Platform, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Bell } from 'lucide-react-native';
import { Button } from './Button';
import { Text } from './Text';
import { getPrimerChoice, isPushOn, pushPermission, registerPush, setPrimerChoice, setPushOn } from '@/services/push';
import { biometricLabel, getBiometricPref } from '@/utils/biometric';
import { useTheme } from '@/constants/theme';

// Says why before the phone's one-time notification prompt. Shown once, only while the system can still ask;
// "Not now" turns push off here, and Settings > Push notifications brings the prompt back later.
export function PushPrimer({ client }) {
  const theme = useTheme();
  const dispatch = useDispatch();
  const locked = useSelector((s) => s.auth.locked);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web' || locked) return undefined;
    let stop = false;
    let timer;
    const check = async () => {
      if (stop || !(await isPushOn()) || (await getPrimerChoice()) || (await pushPermission()) !== 'ask') return;
      // The first sign-in also offers the fingerprint lock; wait for that answer so two prompts never stack.
      if ((await biometricLabel()) && !(await getBiometricPref())) {
        timer = setTimeout(check, 1500);
        return;
      }
      if (!stop) setShow(true);
    };
    timer = setTimeout(() => check().catch(() => {}), 800);
    return () => { stop = true; clearTimeout(timer); };
  }, [locked]);

  const allow = async () => {
    setBusy(true);
    await setPrimerChoice('asked');
    await registerPush(dispatch, { ask: true }).catch(() => {});
    setBusy(false);
    setShow(false);
  };
  const later = async () => {
    setShow(false);
    await setPrimerChoice('later');
    await setPushOn(false);
  };

  const message = client
    ? 'Get a heads-up when your project moves to a new stage, a task needs your input, or the team sends you a message.'
    : 'Get a heads-up when a task is assigned to you, a review is waiting on you, or someone mentions you in chat.';

  return (
    <Modal visible={show} transparent animationType="fade" statusBarTranslucent onRequestClose={() => !busy && later()}>
      <View className="flex-1 items-center justify-center bg-black/50 px-6">
        <View accessibilityViewIsModal className="w-full max-w-sm gap-4 rounded-3xl bg-surface p-6">
          <View className="h-12 w-12 items-center justify-center rounded-full bg-accent/15">
            <Bell size={22} color={theme['accent-ink']} />
          </View>
          <View className="gap-1.5">
            <Text accessibilityRole="header" className="font-body-semibold text-lg">Turn on notifications?</Text>
            <Text className="text-sm text-muted">{message}</Text>
            <Text className="text-sm text-muted">You can change this any time in Settings.</Text>
          </View>
          <View className="flex-row gap-3">
            <Button title="Not now" variant="secondary" className="flex-1" disabled={busy} onPress={later} />
            <Button title="Allow" className="flex-1" loading={busy} onPress={allow} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
