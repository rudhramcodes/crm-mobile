import { View } from 'react-native';
import { Card } from './Card';
import { Text } from './Text';

// Caption above a card of rows, the settings list look.
export function SettingsSection({ title, children, className = 'py-2' }) {
  return (
    <View>
      {!!title && <Text className="mb-2 text-caption uppercase text-muted">{title}</Text>}
      <Card className={className}>{children}</Card>
    </View>
  );
}

// Label on the left, value on the right; read-only facts.
export function InfoRow({ label, value }) {
  return (
    <View className="min-h-[44px] flex-row items-center gap-3 py-2">
      <Text className="flex-1 text-sm text-muted">{label}</Text>
      <Text className="font-body-medium text-sm" numberOfLines={1}>{value}</Text>
    </View>
  );
}

// The keys of `form` that differ from `initial` (the web sends only what changed).
export const changedFields = (form, initial) => Object.fromEntries(Object.entries(form).filter(([k, v]) => v !== initial[k]));

// Who sees which settings screen (same roles as the web tabs; the org GET refuses managers).
export const SETTINGS_ACCESS = {
  organization: ['super_admin', 'admin', 'employee'],
  organizationEdit: ['super_admin', 'admin'],
  security: ['super_admin', 'admin'],
  integrations: ['super_admin', 'admin'],
  roles: ['super_admin'],
  emailTemplates: ['super_admin', 'admin', 'manager'],
};
export const canSeeSetting = (user, key) => SETTINGS_ACCESS[key].includes(user?.role);
