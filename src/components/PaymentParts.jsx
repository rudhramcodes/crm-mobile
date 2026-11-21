import { View } from 'react-native';
import { router } from 'expo-router';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Badge } from './Badge';
import { Pressable } from './Pressable';
import { Text } from './Text';
import { BrandMark } from './DashboardParts';
import { showToast } from './Toast';
import { API_BASE_URL, PAYMENT_METHODS, PAYMENT_STATUS, PAYMENT_TYPES } from '@/constants';
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

const PDF_TIMEOUT_MS = 90000; // working-draft quotations are rendered by a headless browser on each request

// Downloads a PDF the server renders (path under the API, with the user's token) and opens the share sheet
// (WhatsApp, Mail, Files…; iPhone previews it first). `label` names it in the dialog and the error toast.
// Uses fetch, not File.downloadFileAsync: that one's HTTP client gives up after 10 s, too short for rendered PDFs,
// and hides the server's error message.
export async function shareServerPdf(path, fileName, token, label = 'PDF') {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), PDF_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      headers: { Authorization: `Bearer ${token}`, 'X-Client': 'mobile' },
      signal: abort.signal,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      return showToast({ title: `Couldn't get the ${label}`, message: body?.message || `The server answered ${res.status}. Try again.` });
    }
    const file = new File(Paths.cache, fileName);
    if (file.exists) file.delete();
    file.create();
    await file.write(new Uint8Array(await res.arrayBuffer()));
    if (!(await Sharing.isAvailableAsync())) return showToast({ title: 'Sharing isn\'t available on this device' });
    await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: `Share ${label}` });
  } catch (e) {
    showToast({
      title: `Couldn't get the ${label}`,
      message: e?.name === 'AbortError' ? 'The server took too long to make the PDF. Try again.' : 'Check your connection and try again.',
    });
  } finally {
    clearTimeout(timer);
  }
}

export const shareReceipt = (payment, token) => shareServerPdf(`/payments/${payment._id}/receipt`, receiptName(payment), token, 'receipt');
