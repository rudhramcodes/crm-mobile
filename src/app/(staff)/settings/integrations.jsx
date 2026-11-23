import { useState } from 'react';
import { Alert as RNAlert, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Alert, Badge, Button, ConfirmDialog, DashboardState, Input, PageHeader, PasswordInput, Screen, SettingsSection, Text, changedFields, showToast } from '@/components';
import { useDisconnectZohoMutation, useGetIntegrationSettingsQuery, useGetZohoAuthUrlMutation, useUpdateIntegrationSettingsMutation } from '@/services/settingsApi';
import { apiError } from '@/utils/apiError';
import { runAction } from '@/utils/attendance';
import { getFieldError } from '@/utils/getFieldError';

const FIELDS = ['resendFromEmail', 'resendFromName', 'zohoClientId', 'zohoClientSecret', 'zohoOrgName'];
const EMAIL = /^\S+@\S+\.\S+$/;

const Status = ({ on, yes, no }) => <Badge label={on ? yes : no} variant={on ? 'success' : 'default'} />;

function IntegrationsForm({ settings, refetch }) {
  const [initial, setInitial] = useState(() => Object.fromEntries(FIELDS.map((k) => [k, settings[k] ?? ''])));
  const [f, setF] = useState(initial);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const [save, s] = useUpdateIntegrationSettingsMutation();
  const [getAuthUrl, a] = useGetZohoAuthUrlMutation();
  const [disconnect, d] = useDisconnectZohoMutation();
  const [confirmOff, setConfirmOff] = useState(false);
  const { message, fieldErrors } = apiError(s.error);
  const err = (k) => getFieldError(fieldErrors, k);

  const changes = changedFields(f, initial);
  const emailError = f.resendFromEmail && !EMAIL.test(f.resendFromEmail) ? 'Enter a valid email' : '';
  const shortError = (k) => (f[k] && f[k].length < 10 ? 'At least 10 characters' : '');
  const invalid = !!(emailError || shortError('zohoClientId') || shortError('zohoClientSecret'));

  // Same warning as the web: bad credentials break meeting links for everyone.
  const submit = () => RNAlert.alert(
    'Change integration settings?',
    `Take permission from the developer first. Wrong credentials can stop meeting links from being created.\n\nChanged: ${Object.keys(changes).join(', ')}`,
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Save', style: 'destructive', onPress: async () => { if (await runAction(save(changes), 'Integrations saved')) setInitial(f); } },
    ],
  );

  // Zoho sends the browser back to the web app's settings page; when the browser closes we re-read the status.
  const connect = async () => {
    const url = await runAction(getAuthUrl(), null, "Couldn't start Zoho sign-in");
    if (typeof url !== 'string') return;
    await WebBrowser.openAuthSessionAsync(url);
    const { data } = await refetch();
    showToast(data?.zohoConnected ? { title: 'Zoho Meetings connected' } : { title: 'Zoho not connected', message: 'Finish signing in to Zoho, then try again.' });
  };

  return (
    <>
      <Alert message={fieldErrors.length ? '' : message} />
      <SettingsSection title="Email (Resend)" className="gap-4 p-4">
        <View className="flex-row items-center justify-between">
          <Text className="font-body-semibold">Email sending</Text>
          <Status on={settings.resendConfigured} yes="Configured" no="Not configured" />
        </View>
        <Input label="From email" value={f.resendFromEmail} onChangeText={set('resendFromEmail')} placeholder="crm@yourcompany.com" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" error={emailError || err('resendFromEmail')} />
        <Input label="From name" value={f.resendFromName} onChangeText={set('resendFromName')} placeholder="Rudhram CRM" maxLength={100} error={err('resendFromName')} />
      </SettingsSection>

      <SettingsSection title="Zoho Meetings" className="gap-4 p-4">
        <View className="flex-row items-center justify-between">
          <Text className="font-body-semibold">Meeting links</Text>
          <Status on={settings.zohoConnected} yes="Connected" no="Not connected" />
        </View>
        <Input label="Client ID" value={f.zohoClientId} onChangeText={set('zohoClientId')} autoCapitalize="none" autoCorrect={false} error={shortError('zohoClientId') || err('zohoClientId')} />
        <PasswordInput label="Client secret" value={f.zohoClientSecret} onChangeText={set('zohoClientSecret')} placeholder="" error={shortError('zohoClientSecret') || err('zohoClientSecret')} />
        <Input label="Organization name" value={f.zohoOrgName} onChangeText={set('zohoOrgName')} maxLength={200} error={err('zohoOrgName')} />
        {settings.zohoConnected
          ? <Button title="Disconnect Zoho" variant="secondary" onPress={() => setConfirmOff(true)} />
          : <Button title="Connect Zoho Meetings" variant="secondary" loading={a.isLoading} disabled={!!Object.keys(changes).length} onPress={connect} />}
        {!settings.zohoConnected && !!Object.keys(changes).length && <Text className="text-sm text-muted">Save your changes before connecting.</Text>}
      </SettingsSection>

      <Button title="Save settings" loading={s.isLoading} disabled={invalid || !Object.keys(changes).length} onPress={submit} />

      <ConfirmDialog
        visible={confirmOff}
        title="Disconnect Zoho Meetings?"
        message="New meetings will be created without links until it's connected again."
        confirmLabel="Disconnect"
        loading={d.isLoading}
        onCancel={() => setConfirmOff(false)}
        onConfirm={async () => { if (await runAction(disconnect(), 'Zoho disconnected')) setConfirmOff(false); }}
      />
    </>
  );
}

export default function Integrations() {
  const { data, isLoading, isError, refetch } = useGetIntegrationSettingsQuery();
  return (
    <Screen scroll className="gap-5 pt-2">
      <PageHeader caption="SETTINGS" title="Integrations" fallback="/settings" />
      {data ? <IntegrationsForm settings={data} refetch={refetch} /> : <DashboardState isLoading={isLoading} isError={isError || !isLoading} refetch={refetch} />}
    </Screen>
  );
}
