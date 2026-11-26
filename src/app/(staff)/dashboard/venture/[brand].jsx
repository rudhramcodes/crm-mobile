import { ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import {
  Badge, BarList, BrandMark, Chip, DashboardState, Hatch, Heading, KpiTile, ListRow, PipelineSection, Pressable, RevenueSection, Screen, Section,
  SourcesSection, SplitBar, TasksSection, Text, usePullRefresh, ZoomLink } from '@/components';
import { useGetVentureDashboardQuery } from '@/services/dashboardApi';
import { BRANDS, BRAND_METAS } from '@/constants';
import { useTheme } from '@/constants/theme';
import { formatCompactCurrency, formatCurrency } from '@/utils/formatters';
import { canOpenPath } from '@/utils/access';
import { useSelector } from 'react-redux';
import { cn } from '@/utils/cn';

// Web /dashboard/venture/:brand. Admin, super admin and manager only; employees never get a link here.
export default function VentureDashboard() {
  const theme = useTheme();
  const user = useSelector((s) => s.auth.user);
  const go = (path) => (canOpenPath(user, path) ? () => router.push(path) : undefined);
  const { brand } = useLocalSearchParams();
  const { data, isLoading, isFetching, isError, refetch } = useGetVentureDashboardQuery(brand);
  const refreshControl = usePullRefresh(refetch);
  const meta = BRAND_METAS[brand] || { label: brand };
  const d = data?.data;
  const k = d?.kpis ?? {}; // partial answer: zeros, not a crash
  const top = Math.max(1, ...(d?.comparison || []).map((c) => c.leads));

  return (
    <Screen scroll className="gap-5 pt-2" refreshControl={refreshControl}>
      <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} accessibilityLabel="Back to dashboard" className="-ml-2 h-11 w-11 items-center justify-center">
        <ChevronLeft size={26} color={theme.ink} />
      </Pressable>
      <View className="flex-row items-center gap-3">
        <BrandMark brand={brand} size={56} />
        <View className="flex-1">
          <Text className="text-caption text-muted">VENTURE</Text>
          <Heading numberOfLines={1}>{meta.label}</Heading>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-5" contentContainerClassName="gap-2 px-5">
        {BRANDS.map((b) => <Chip key={b.value} label={b.label} active={b.value === brand} onPress={() => router.setParams({ brand: b.value })} />)}
      </ScrollView>

      {!d || (isFetching && d.brand !== brand) ? <DashboardState isLoading={isLoading || isFetching} isError={isError} refetch={refetch} /> : (
        <>
          {/* Same 2×2 tiles as Home; won deals, conversion and cash ride along inside them instead of 3 more tiles. */}
          <View className="flex-row gap-3">
            <KpiTile label="Total leads" value={k.totalLeads ?? 0} sub={`${k.wonLeads ?? 0} won`} onPress={go('/leads')}>
              <SplitBar pct={k.conversionRate} label="converted" />
            </KpiTile>
            <KpiTile label="Revenue" value={formatCompactCurrency(k.totalRevenue)} sub={`+ ${formatCompactCurrency(k.cashCollected)} cash`} onPress={go('/payments')} />
          </View>
          <View className="flex-row gap-3">
            <KpiTile label="Active clients" value={k.activeClients ?? 0} onPress={go('/clients')} />
            <KpiTile label="Outstanding" value={formatCompactCurrency(k.totalOutstanding)} alert={k.totalOutstanding > 0} onPress={go('/invoices')} />
          </View>

          <RevenueSection revenue={d.revenue} collected={k.totalRevenue} sub={`Excl. cash, for ${meta.label}. Tap a month.`} onOpen={go('/payments')} />
          <PipelineSection sub={`Leads at each stage for ${meta.label}`} rows={d.pipeline?.byStatus} />
          <SourcesSection rows={d.pipeline?.bySource} />
          <TasksSection tasks={d.tasks} title="Task velocity" sub="Milestones and deliverables" />

          <Section title="Venture benchmark" sub="Leads and won deals across all brands">
            <View className="flex-row gap-4">
              <View className="flex-row items-center gap-1.5"><View className="h-2 w-2 rounded-full bg-sand" /><Text className="text-xs text-muted">Leads</Text></View>
              <View className="flex-row items-center gap-1.5"><View className="h-2 w-2 rounded-full bg-accent" /><Text className="text-xs text-muted">Won</Text></View>
            </View>
            {d.comparison?.length ? d.comparison.map((c) => (
              <View key={c.brand} className="gap-1.5" accessible accessibilityLabel={`${BRAND_METAS[c.brand]?.label || c.brand}: ${c.leads} leads, ${c.won} won`}>
                <View className="flex-row justify-between">
                  <Text className={cn('text-sm', c.brand === brand && 'font-body-semibold')}>{BRAND_METAS[c.brand]?.label || c.brand}</Text>
                  <Text className="text-sm tabular-nums text-muted">{c.leads} · {c.won}</Text>
                </View>
                <View className="h-3 overflow-hidden rounded-full bg-surface-2/50">
                  <Hatch />
                  <View className="h-full rounded-full bg-sand" style={{ width: `${(c.leads / top) * 100}%` }}>
                    <View className="h-full rounded-full bg-accent" style={{ width: `${c.leads ? (c.won / c.leads) * 100 : 0}%` }} />
                  </View>
                </View>
              </View>
            )) : <Text className="text-sm text-muted">No comparison data yet.</Text>}
          </Section>

          {d.invoices?.aging?.some((a) => a.count) && (
            <Section title="Invoice aging" sub="Outstanding by days past due">
              <BarList rows={d.invoices.aging.map((a) => ({ key: a.label, label: `${a.label} · ${a.count}`, value: a.amount, display: formatCurrency(a.amount) }))} />
            </Section>
          )}

          {d.clients?.topClients?.length > 0 && (
            <Section title={`Top clients`} sub={`${d.clients.topClients.length} key accounts`}>
              <View>
                {d.clients.topClients.map((c) => (
                  <ZoomLink href={`/clients/${c._id}`} key={c._id}>
                    <ListRow
                      label={c.companyName}
                      hint={[c.clientId, c.contactPerson, c.email].filter(Boolean).join(' · ')}
                      right={<Badge label={c.status} variant={c.status === 'active' ? 'success' : 'default'} />}
                    />
                  </ZoomLink>
                ))}
              </View>
            </Section>
          )}
        </>
      )}
    </Screen>
  );
}
