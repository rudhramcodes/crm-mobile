import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { WebView } from 'react-native-webview';
import { Badge, Card, backTo, DashboardState, InfoRow, PageHeader, Screen, Text } from '@/components';
import { useGetEmailPreviewsQuery } from '@/services/settingsApi';

// One email: its details, then the real HTML as the recipient sees it.
export default function EmailTemplate() {
  const { id } = useLocalSearchParams();
  const { data, isLoading, isError, refetch } = useGetEmailPreviewsQuery();
  const t = data?.find((x) => x.id === id);
  if (!t) {
    return (
      <Screen className="gap-5 pt-2">
        <PageHeader caption="EMAIL TEMPLATE" title="" fallback="/settings/email-templates" />
        <DashboardState isLoading={isLoading} isError={isError} refetch={refetch} gone={!isLoading && !isError ? 'Template not found' : undefined} onBack={() => backTo('/settings/email-templates')} />
      </Screen>
    );
  }
  return (
    <Screen className="gap-4 pt-2">
      <PageHeader caption="EMAIL TEMPLATE" title={t.title} fallback="/settings/email-templates" oneLine />
      <Card className="gap-1 py-2">
        {!!t.badge && <Badge label={t.badge} variant="info" className="mb-1" />}
        <InfoRow label="To" value={t.recipient} />
        <InfoRow label="When" value={t.trigger} />
        <Text className="font-body-semibold">{t.subject}</Text>
        {!!t.preheader && <Text className="pb-1 text-sm text-muted">{t.preheader}</Text>}
      </Card>
      <View className="mb-4 flex-1 overflow-hidden rounded-3xl bg-white">
        {/* A preview only: links in the email don't open. */}
        <WebView source={{ html: t.html }} originWhitelist={['*']} onShouldStartLoadWithRequest={(r) => !/^(https?|mailto|tel):/.test(r.url)} />
      </View>
    </Screen>
  );
}
