import { useState } from 'react';
import { View } from 'react-native';
import { Mail, Smartphone } from 'lucide-react-native';
import { Button, DashboardState, PageHeader, PhoneSettings, Screen, SettingsSection, Text, Toggle } from '@/components';
import { NOTIF_PREF_GROUPS } from '@/constants';
import { useTheme } from '@/constants/theme';
import { useGetNotifPrefsQuery, useUpdateNotifPrefsMutation } from '@/services/settingsApi';
import { runAction } from '@/utils/attendance';

// A type with nothing saved shows in-app on, email off (same as the web grid).
const DEFAULT = { inApp: true, email: false };
const toMap = (notify = {}) => Object.fromEntries(NOTIF_PREF_GROUPS.flatMap((g) => g.types).map(([id]) => [id, { ...DEFAULT, ...notify[id] }]));

function PrefsForm({ prefs }) {
  const theme = useTheme();
  const [initial, setInitial] = useState(() => toMap(prefs?.notify));
  const [map, setMap] = useState(initial);
  const [save, s] = useUpdateNotifPrefsMutation();
  const dirty = JSON.stringify(map) !== JSON.stringify(initial);
  const flip = (id, ch) => (v) => setMap((m) => ({ ...m, [id]: { ...m[id], [ch]: v } }));
  const submit = async () => {
    if (await runAction(save(map), 'Preferences saved')) setInitial(map);
  };

  return (
    <>
      {NOTIF_PREF_GROUPS.map((g) => (
        <SettingsSection key={g.label} title={g.label}>
          {g.types.map(([id, label]) => (
            <View key={id} className="min-h-[56px] flex-row items-center gap-3 py-2">
              <Text className="flex-1 font-body-medium">{label}</Text>
              <View className="items-center gap-0.5">
                <Smartphone size={14} color={theme.muted} />
                <Toggle value={map[id].inApp} onValueChange={flip(id, 'inApp')} label={`${label} in the app`} />
              </View>
              <View className="items-center gap-0.5">
                <Mail size={14} color={theme.muted} />
                <Toggle value={map[id].email} onValueChange={flip(id, 'email')} label={`${label} by email`} />
              </View>
            </View>
          ))}
        </SettingsSection>
      ))}
      <Button title="Save preferences" loading={s.isLoading} disabled={!dirty} onPress={submit} />
    </>
  );
}

export default function NotificationSettings() {
  const { data, isLoading, isError, refetch } = useGetNotifPrefsQuery();
  return (
    <Screen scroll className="gap-5 pt-2">
      <PageHeader caption="SETTINGS" title="Notifications" fallback="/settings" />
      <View>
        <Text className="mb-2 text-caption uppercase text-muted">This phone</Text>
        <PhoneSettings test />
      </View>
      <Text className="text-sm text-muted">Choose what reaches you in the app (and on this phone) and by email. With both off, that notification is not sent.</Text>
      {data ? <PrefsForm prefs={data} /> : <DashboardState isLoading={isLoading} isError={isError || !isLoading} refetch={refetch} />}
    </Screen>
  );
}
