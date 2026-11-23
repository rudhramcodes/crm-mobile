import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Check, X } from 'lucide-react-native';
import { Chip, DashboardState, Input, PageHeader, Screen, SettingsSection, Text } from '@/components';
import { PERMISSION_GROUPS, ROLE_DESCRIPTIONS, ROLE_LABELS } from '@/constants';
import { useTheme } from '@/constants/theme';
import { useGetRolesPermissionsQuery } from '@/services/settingsApi';

const ROLES = Object.keys(ROLE_DESCRIPTIONS);
const pretty = (p) => p.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

// Read-only, like the web Role Access tab: what each role is allowed to do.
export default function Roles() {
  const theme = useTheme();
  const { data, isLoading, isError, refetch } = useGetRolesPermissionsQuery();
  const [role, setRole] = useState('admin');
  const [q, setQ] = useState('');
  const enabled = new Set(data?.[role] || []);
  const term = q.trim().toLowerCase();
  const groups = PERMISSION_GROUPS
    .map((g) => ({ ...g, perms: g.module.toLowerCase().includes(term) ? g.perms : g.perms.filter((p) => p.replace(/_/g, ' ').includes(term)) }))
    .filter((g) => g.perms.length);

  return (
    <Screen scroll className="gap-5 pt-2">
      <PageHeader caption="SETTINGS" title="Role access" fallback="/settings" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-5" contentContainerClassName="gap-2 px-5">
        {ROLES.map((r) => <Chip key={r} label={ROLE_LABELS[r]} count={data?.[r]?.length} active={role === r} onPress={() => setRole(r)} />)}
      </ScrollView>
      <View className="gap-1">
        <Text className="font-body-semibold">{ROLE_LABELS[role]}</Text>
        <Text className="text-sm text-muted">{ROLE_DESCRIPTIONS[role]} · {enabled.size} permissions</Text>
      </View>
      <Input value={q} onChangeText={setQ} placeholder="Search access" autoCorrect={false} autoCapitalize="none" accessibilityLabel="Search access" />
      {!data ? <DashboardState isLoading={isLoading} isError={isError || !isLoading} refetch={refetch} /> : groups.map((g) => (
        <SettingsSection key={g.prefix} title={g.module}>
          {g.perms.map((p) => {
            const on = enabled.has(`${g.prefix}:${p}`);
            return (
              <View key={p} accessibilityLabel={`${g.module} ${pretty(p)}: ${on ? 'allowed' : 'not allowed'}`} className="min-h-[44px] flex-row items-center gap-3 py-2">
                <Text className={on ? 'flex-1' : 'flex-1 text-muted'}>{pretty(p)}</Text>
                {on ? <Check size={18} color={theme.success} /> : <X size={18} color={theme.muted} />}
              </View>
            );
          })}
        </SettingsSection>
      ))}
      {!!data && !groups.length && <Text className="text-center text-sm text-muted">No matches</Text>}
    </Screen>
  );
}
