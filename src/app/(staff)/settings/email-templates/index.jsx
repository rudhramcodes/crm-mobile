import { router } from 'expo-router';
import { Mail } from 'lucide-react-native';
import { DashboardState, ListRow, PageHeader, Screen, SettingsSection, Text } from '@/components';
import { useGetEmailPreviewsQuery } from '@/services/settingsApi';

// Every email the CRM sends, grouped like the web preview studio. View only.
export default function EmailTemplates() {
  const { data, isLoading, isError, refetch } = useGetEmailPreviewsQuery();
  const groups = Object.entries((data || []).reduce((acc, t) => ({ ...acc, [t.category]: [...(acc[t.category] || []), t] }), {}));

  return (
    <Screen scroll className="gap-5 pt-2">
      <PageHeader caption="SETTINGS" title="Email templates" fallback="/settings" />
      <Text className="text-sm text-muted">What each email looks like, who gets it and when. Wording changes are made by the developer.</Text>
      {!data
        ? <DashboardState isLoading={isLoading} isError={isError || !isLoading} refetch={refetch} />
        : groups.map(([category, list]) => (
          <SettingsSection key={category} title={`${category} · ${list.length}`}>
            {list.map((t) => (
              <ListRow key={t.id} icon={Mail} label={t.title} hint={[t.recipient, t.trigger].filter(Boolean).join(' · ')} onPress={() => router.push({ pathname: '/settings/email-templates/[id]', params: { id: t.id } })} />
            ))}
          </SettingsSection>
        ))}
    </Screen>
  );
}
