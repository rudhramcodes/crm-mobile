import { useState } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { useSelector } from 'react-redux';
import { Alert, Button, Chip, DashboardState, Input, PageHeader, Screen, SelectField, Text, canSeeSetting, changedFields } from '@/components';
import { CURRENCIES, DATE_FORMATS, LANGUAGES, TIMEZONES } from '@/constants';
import { useGetOrgSettingsQuery, useUpdateOrgSettingsMutation } from '@/services/settingsApi';
import { apiError } from '@/utils/apiError';
import { runAction } from '@/utils/attendance';
import { getFieldError } from '@/utils/getFieldError';

const DEFAULTS = { companyName: '', logo: '', address: '', timezone: 'Asia/Kolkata', dateFormat: 'DD/MM/YYYY', currency: 'INR', language: 'en' };
const textArea = { height: 96, paddingTop: 14, textAlignVertical: 'top' };

function Chips({ label, options, value, onChange, disabled }) {
  return (
    <View className="gap-1.5">
      <Text className="font-body-medium text-sm">{label}</Text>
      <View className="flex-row flex-wrap gap-2">
        {options.map((o) => <Chip key={o.value} label={o.label} active={value === o.value} onPress={disabled ? undefined : () => onChange(o.value)} />)}
      </View>
    </View>
  );
}

// Admins edit; employees see the same values read-only (the server refuses their save).
function OrgForm({ settings, canEdit }) {
  const [initial, setInitial] = useState(() => ({ ...DEFAULTS, ...settings }));
  const [f, setF] = useState(initial);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const [save, s] = useUpdateOrgSettingsMutation();
  const { message, fieldErrors } = apiError(s.error);
  const err = (k) => getFieldError(fieldErrors, k);
  const changes = changedFields(f, initial);
  const nameError = !f.companyName.trim() ? 'Company name is required' : '';
  const submit = async () => {
    if (await runAction(save(changes), 'Organization saved')) setInitial(f);
  };

  return (
    <>
      <Alert message={fieldErrors.length ? '' : message} />
      <Input label="Company name *" value={f.companyName} onChangeText={set('companyName')} editable={canEdit} placeholder="e.g. Rudhram Enterprises" maxLength={200} error={(f.companyName !== initial.companyName && nameError) || err('companyName')} />
      <View className="flex-row items-end gap-3">
        <Input label="Logo URL" value={f.logo} onChangeText={set('logo')} editable={canEdit} placeholder="https://example.com/logo.png" autoCapitalize="none" autoCorrect={false} keyboardType="url" className="flex-1" error={err('logo')} />
        {!!f.logo && <Image source={{ uri: f.logo }} style={{ width: 52, height: 52, borderRadius: 12 }} contentFit="contain" accessibilityLabel="Logo preview" />}
      </View>
      <Input label="Address" value={f.address} onChangeText={set('address')} editable={canEdit} placeholder="Office address, city, state, PIN code" multiline style={textArea} error={err('address')} />
      <SelectField label="Timezone" value={f.timezone} options={TIMEZONES} onChange={set('timezone')} placeholder="Select a timezone" disabled={!canEdit} searchable />
      <Chips label="Date format" options={DATE_FORMATS} value={f.dateFormat} onChange={set('dateFormat')} disabled={!canEdit} />
      <Chips label="Currency" options={CURRENCIES} value={f.currency} onChange={set('currency')} disabled={!canEdit} />
      <Chips label="Language" options={LANGUAGES} value={f.language} onChange={set('language')} disabled={!canEdit} />
      {canEdit
        ? <Button title="Save settings" loading={s.isLoading} disabled={!!nameError || !Object.keys(changes).length} onPress={submit} />
        : <Text className="text-sm text-muted">Only admins can change these.</Text>}
    </>
  );
}

export default function Organization() {
  const user = useSelector((st) => st.auth.user);
  const { data, isLoading, isError, refetch } = useGetOrgSettingsQuery();
  return (
    <Screen scroll className="gap-5 pt-2">
      <PageHeader caption="SETTINGS" title="Organization" fallback="/settings" />
      {isLoading || isError
        ? <DashboardState isLoading={isLoading} isError={isError} refetch={refetch} />
        : <OrgForm settings={data} canEdit={canSeeSetting(user, 'organizationEdit')} />}
    </Screen>
  );
}
