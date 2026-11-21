import { View } from 'react-native';
import { router } from 'expo-router';
import { Badge } from './Badge';
import { Pressable } from './Pressable';
import { Text } from './Text';
import { BrandMark } from './DashboardParts';
import { QUOTATION_STATUS } from '@/constants';
import { canWriteModule } from '@/utils/access';
import { isAdmin } from '@/utils/attendance';
import { formatCurrency } from '@/utils/formatters';
import { isPastValid, isVersioned, money } from '@/utils/quotations';

// Server rule: super_admin and admin only, for everything.
export const quotationAccess = (u) => ({ view: isAdmin(u), manage: isAdmin(u) && canWriteModule(u, 'quotations') });

export function QuotationStatusBadge({ status }) {
  const m = QUOTATION_STATUS.find((s) => s.value === status) || { label: status || 'Unknown' };
  return <Badge label={m.label} color={m.color} />;
}

export const quoteDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

// "V2", "Working draft" (nothing saved yet) or "" for legacy quotations.
export const versionTag = (q) => (!isVersioned(q) ? '' : q.latestVersion ? `V${q.latestVersion}` : 'Working draft');

// Client, venture, number · version, total, issued · valid until (red when passed), status.
export function QuotationRow({ quotation: q }) {
  const late = isPastValid(q);
  const tag = versionTag(q);
  return (
    <Pressable
      onPress={() => router.push(`/quotations/${q._id}`)}
      accessibilityLabel={`${q.quotationNumber}, ${q.client?.companyName || ''}, ${formatCurrency(money(q).total)}, ${q.status}`}
      className="gap-2 rounded-3xl border border-line bg-surface p-4"
    >
      <View className="flex-row items-center gap-3">
        {!!q.client?.brand && <BrandMark brand={q.client.brand} size={32} />}
        <View className="flex-1 gap-0.5">
          <Text numberOfLines={1} className="font-body-semibold">{q.client?.companyName || 'Client removed'}</Text>
          <Text numberOfLines={1} className="text-sm tabular-nums text-muted">{[q.quotationNumber, tag].filter(Boolean).join(' · ')}</Text>
        </View>
        <Text className="font-body-semibold text-lg tabular-nums">{formatCurrency(money(q).total)}</Text>
      </View>
      <View className="flex-row items-center gap-2">
        <Text numberOfLines={1} className="flex-1 text-sm text-muted">
          {quoteDate(q.issueDate)}
          {q.validUntil ? <Text className={late ? 'text-sm text-danger' : 'text-sm text-muted'}>{late ? ' · Validity ended ' : ' · Valid till '}{quoteDate(q.validUntil)}</Text> : null}
        </Text>
        {!!q.archivedAt && <Badge label="Archived" />}
        <QuotationStatusBadge status={q.status} />
      </View>
    </Pressable>
  );
}
