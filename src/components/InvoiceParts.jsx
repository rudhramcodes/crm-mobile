import { View } from 'react-native';
import { Badge } from './Badge';
import { Pressable } from './Pressable';
import { Text } from './Text';
import { BrandMark } from './DashboardParts';
import { ZoomLink } from './ZoomLink';
import { INVOICE_STATUS } from '@/constants';
import { canWriteModule } from '@/utils/access';
import { isAdmin } from '@/utils/attendance';
import { formatCurrency } from '@/utils/formatters';
import { isPastDue, paidPercent } from '@/utils/invoices';

// Server rule: super_admin and admin only.
export const invoiceAccess = (u) => ({ view: isAdmin(u), manage: isAdmin(u) && canWriteModule(u, 'invoices') });

export function InvoiceStatusBadge({ status }) {
  const m = INVOICE_STATUS.find((s) => s.value === status) || { label: status || 'Unknown' };
  return <Badge label={m.label} color={m.color} />;
}

export const invDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

// Thin progress bar: paid share of the total.
export function PaidBar({ invoice }) {
  const pct = paidPercent(invoice);
  return (
    <View className="h-1.5 overflow-hidden rounded-full bg-surface-2" accessibilityLabel={`${pct}% paid`}>
      <View className="h-1.5 rounded-full bg-success" style={{ width: `${pct}%` }} />
    </View>
  );
}

// Client, venture, number, total, paid progress, balance and due date (red once passed), status.
export function InvoiceRow({ invoice: i }) {
  const late = isPastDue(i);
  const settled = (i.balanceDue || 0) <= 0 && i.status !== 'draft' && i.status !== 'cancelled';
  return (
    <ZoomLink href={`/invoices/${i._id}`}>
      <Pressable
        accessibilityLabel={`${i.invoiceNumber}, ${i.client?.companyName || ''}, ${formatCurrency(i.total)}, ${i.status}`}
        className="gap-2.5 rounded-3xl border border-line bg-surface p-4"
      >
        <View className="flex-row items-center gap-3">
          {!!i.client?.brand && <BrandMark brand={i.client.brand} size={32} />}
          <View className="flex-1 gap-0.5">
            <Text numberOfLines={1} className="font-body-semibold">{i.client?.companyName || 'Client removed'}</Text>
            <Text numberOfLines={1} className="text-sm tabular-nums text-muted">{i.invoiceNumber}</Text>
          </View>
          <Text className="font-body-semibold text-lg tabular-nums">{formatCurrency(i.total)}</Text>
        </View>
        {i.status !== 'draft' && i.status !== 'cancelled' && <PaidBar invoice={i} />}
        <View className="flex-row items-center gap-2">
          <Text numberOfLines={1} className="flex-1 text-sm text-muted">
            {settled ? <Text className="text-sm text-success">Settled</Text> : `Balance ${formatCurrency(i.balanceDue)}`}
            {!settled && i.dueDate ? <Text className={late ? 'text-sm text-danger' : 'text-sm text-muted'}>{` · ${late ? 'was due' : 'due'} ${invDate(i.dueDate)}`}</Text> : null}
          </Text>
          <InvoiceStatusBadge status={i.status} />
        </View>
      </Pressable>
    </ZoomLink>
  );
}
