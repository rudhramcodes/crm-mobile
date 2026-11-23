import { useState } from 'react';
import { Asterisk, CaseLower, CaseUpper, Hash } from 'lucide-react-native';
import { Alert, Button, DashboardState, Input, ListRow, PageHeader, Screen, SettingsSection, Text, Toggle } from '@/components';
import { useGetSecuritySettingsQuery, useUpdateSecuritySettingsMutation } from '@/services/settingsApi';
import { apiError } from '@/utils/apiError';
import { runAction } from '@/utils/attendance';
import { getFieldError } from '@/utils/getFieldError';

const DEFAULTS = { passwordMinLength: 8, passwordRequireUpper: true, passwordRequireLower: true, passwordRequireNumber: true, passwordRequireSpecial: false, loginMaxAttempts: 5, loginLockoutMinutes: 15 };
// Same ranges as the server's updateSecuritySchema.
const NUMBERS = [
  ['passwordMinLength', 'Minimum password length', 4, 128],
  ['loginMaxAttempts', 'Max login attempts', 1, 100],
  ['loginLockoutMinutes', 'Lockout time (minutes)', 1, 1440],
];
const RULES = [
  ['passwordRequireUpper', 'Uppercase letter', CaseUpper],
  ['passwordRequireLower', 'Lowercase letter', CaseLower],
  ['passwordRequireNumber', 'Number', Hash],
  ['passwordRequireSpecial', 'Special character', Asterisk],
];

function SecurityForm({ settings }) {
  // Number fields are edited as text, sent as integers.
  const [initial, setInitial] = useState(() => {
    const v = { ...DEFAULTS, ...settings };
    return { ...v, ...Object.fromEntries(NUMBERS.map(([k]) => [k, String(v[k])])) };
  });
  const [f, setF] = useState(initial);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const [save, s] = useUpdateSecuritySettingsMutation();
  const { message, fieldErrors } = apiError(s.error);

  const rangeError = (k, min, max) => {
    const n = Number(f[k]);
    return f[k] === '' || n < min || n > max ? `Enter ${min} to ${max}` : '';
  };
  const invalid = NUMBERS.some(([k, , min, max]) => rangeError(k, min, max));
  const changes = Object.fromEntries(Object.keys(f).filter((k) => f[k] !== initial[k]).map((k) => [k, typeof f[k] === 'string' ? Number(f[k]) : f[k]]));
  const submit = async () => {
    if (await runAction(save(changes), 'Security settings saved')) setInitial(f);
  };

  return (
    <>
      <Alert message={fieldErrors.length ? '' : message} />
      <SettingsSection title="Passwords must include">
        {RULES.map(([k, label, icon]) => <ListRow key={k} icon={icon} label={label} right={<Toggle value={f[k]} onValueChange={set(k)} label={label} />} />)}
      </SettingsSection>
      {NUMBERS.map(([k, label, min, max]) => (
        <Input
          key={k}
          label={label}
          value={f[k]}
          onChangeText={(v) => set(k)(v.replace(/\D/g, ''))}
          keyboardType="number-pad"
          maxLength={4}
          hint={`${min} to ${max}`}
          error={rangeError(k, min, max) || getFieldError(fieldErrors, k)}
        />
      ))}
      <Text className="text-sm text-muted">New passwords also always need 8+ characters with an uppercase letter, a lowercase letter and a number.</Text>
      <Button title="Save settings" loading={s.isLoading} disabled={invalid || !Object.keys(changes).length} onPress={submit} />
    </>
  );
}

export default function Security() {
  const { data, isLoading, isError, refetch } = useGetSecuritySettingsQuery();
  return (
    <Screen scroll className="gap-5 pt-2">
      <PageHeader caption="SETTINGS" title="Security" fallback="/settings" />
      {data ? <SecurityForm settings={data} /> : <DashboardState isLoading={isLoading} isError={isError || !isLoading} refetch={refetch} />}
    </Screen>
  );
}
