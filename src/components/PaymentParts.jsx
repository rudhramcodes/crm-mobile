import { View } from 'react-native';
import { router } from 'expo-router';
import { Badge } from './Badge';
import { Pressable } from './Pressable';
import { Text } from './Text';
import { BrandMark } from './DashboardParts';
import { PAYMENT_METHODS, PAYMENT_STATUS, PAYMENT_TYPES } from '@/constants';
import { canWriteModule } from '@/utils/access';
import { isAdmin } from '@/utils/attendance';
import { formatCurrency } from '@/utils/formatters';
import { labelOf, receiptName } from '@/utils/payments';

// Server rules: admins view and edit, only super_admin deletes.
export const paymentAccess = (u) => ({
  view: isAdmin(u),
  edit: isAdmin(u) && canWriteModule(u, 'payments'),
  remove: u?.role === 'super_admin' && canWriteModule(u, 'payments'),
});

export function PaymentStatusBadge({ status }) {
  const m = PAYMENT_STATUS.find((s) => s.value === status) || { label: status || 'Unknown' };
  return <Badge label={m.label} color={m.color} />;
}

// Short purpose label for tight spots: "Advance", "Part", "Final", "Other".
export const purposeLabel = (v) => labelOf(PAYMENT_TYPES, v).replace(/ Payment$/, '');
export const methodLabel = (v) => labelOf(PAYMENT_METHODS, v);
export const payDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

// Refunds show as a negative amount, like the web detail page.
export function Amount({ payment: p, className }) {
  const refund = p.status === 'refunded';
  return (
    <Text className={`font-body-semibold tabular-nums ${refund ? 'text-danger' : 'text-ink'} ${className || ''}`}>
      {refund ? '−' : ''}{formatCurrency(p.amount)}
    </Text>
  );
}

// Client, venture, amount, invoice · date, method · purpose, status (the web table row as a card).
export function PaymentRow({ payment: p }) {
  return (
    <Pressable
      onPress={() => router.push(`/payments/${p._id}`)}
      accessibilityLabel={`${formatCurrency(p.amount)} from ${p.client?.companyName || 'client'}, ${p.status}`}
      className="gap-2 rounded-3xl border border-line bg-surface p-4"
    >
      <View className="flex-row items-center gap-3">
        {!!p.client?.brand && <BrandMark brand={p.client.brand} size={32} />}
        <View className="flex-1 gap-0.5">
          <Text numberOfLines={1} className="font-body-semibold">{p.client?.companyName || 'Client removed'}</Text>
          <Text numberOfLines={1} className="text-sm text-muted">
            {[p.invoice?.invoiceNumber || 'Invoice deleted', payDate(p.paymentDate)].join(' · ')}
          </Text>
        </View>
        <Amount payment={p} className="text-lg" />
      </View>
      <View className="flex-row items-center gap-2">
        <Text numberOfLines={1} className="flex-1 text-sm text-muted">{`${methodLabel(p.paymentMethod)} · ${purposeLabel(p.paymentType)}`}</Text>
        <PaymentStatusBadge status={p.status} />
      </View>
    </Pressable>
  );
}

// Where a payment's receipt PDF lives on the server and what to call the file (used with PdfActions).
export const receiptPdf = (payment) => ({ path: `/payments/${payment._id}/receipt`, fileName: receiptName(payment) });
