import {
  Amount,
  BrandMark,
  Button,
  Card,
  ConfirmDialog,
  DashboardState,
  PageHeader,
  PaymentStatusBadge,
  Pressable,
  Screen,
  Text,
  backTo,
  methodLabel,
  payDate,
  paymentAccess,
  purposeLabel,
  shareReceipt,
  showToast,
  usePullRefresh,
} from "@/components";
import { useTheme } from "@/constants/theme";
import { useDeletePaymentMutation, useGetInvoicePaymentsQuery, useGetPaymentByIdQuery } from "@/services/paymentApi";
import { runAction } from "@/utils/attendance";
import { formatCurrency } from "@/utils/formatters";
import * as Clipboard from "expo-clipboard";
import { router, useLocalSearchParams } from "expo-router";
import { Copy, Pencil, Share2, Trash2 } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import { useSelector, useStore } from "react-redux";

const Label = ({ children }) => <Text className="text-caption text-muted">{children}</Text>;

function Field({ label, value, mono }) {
  if (!value) return null;
  return (
    <View className="flex-row gap-3">
      <Text className="w-28 text-sm text-muted">{label}</Text>
      <Text className={mono ? "flex-1 font-body-semibold text-sm tabular-nums" : "flex-1 text-sm"} selectable>{value}</Text>
    </View>
  );
}

function InvoiceCard({ payment: p }) {
  const inv = p.invoice;
  const others = (useGetInvoicePaymentsQuery(inv?._id, { skip: !inv?._id }).data?.data?.payments || []).filter((x) => x._id !== p._id);
  if (!inv) {
    return (
      <Card className="gap-2 p-4">
        <Label>INVOICE</Label>
        <Text className="text-sm text-muted">Invoice deleted</Text>
      </Card>
    );
  }
  const paidPct = inv.total ? Math.min(100, Math.round(((inv.paidAmount || 0) / inv.total) * 100)) : 0;
  const settled = (inv.balanceDue || 0) <= 0;
  return (
    <Card className="gap-3 p-4">
      <View className="flex-row items-center">
        <Text className="flex-1 text-caption text-muted">INVOICE</Text>
        <Text className="font-body-semibold text-sm tabular-nums">{inv.invoiceNumber}</Text>
      </View>
      <View className="flex-row justify-between">
        <View>
          <Text className="text-xs text-muted">Total</Text>
          <Text className="font-body-semibold tabular-nums">{formatCurrency(inv.total)}</Text>
        </View>
        <View className="items-center">
          <Text className="text-xs text-muted">Paid</Text>
          <Text className="font-body-semibold tabular-nums text-success">{formatCurrency(inv.paidAmount)}</Text>
        </View>
        <View className="items-end">
          <Text className="text-xs text-muted">Balance</Text>
          <Text className={`font-body-semibold tabular-nums ${settled ? "text-success" : "text-ink"}`}>{settled ? "Settled" : formatCurrency(inv.balanceDue)}</Text>
        </View>
      </View>
      <View className="h-2 overflow-hidden rounded-full bg-surface-2" accessibilityLabel={`${paidPct}% paid`}>
        <View className="h-2 rounded-full bg-success" style={{ width: `${paidPct}%` }} />
      </View>
      {!!others.length && (
        <View className="gap-2 border-t border-line pt-3">
          <Text className="text-xs text-muted">Other payments on this invoice</Text>
          {others.map((o) => (
            <Pressable key={o._id} onPress={() => router.push(`/payments/${o._id}`)} accessibilityLabel={`Payment of ${formatCurrency(o.amount)}`} className="flex-row items-center gap-3">
              <Text className="flex-1 text-sm text-muted">{`${methodLabel(o.paymentMethod)} · ${payDate(o.paymentDate)}`}</Text>
              <Amount payment={o} className="text-sm" />
            </Pressable>
          ))}
        </View>
      )}
    </Card>
  );
}

function PaymentBody({ payment: p, refetch }) {
  const theme = useTheme();
  const store = useStore();
  const me = useSelector((s) => s.auth.user);
  const can = paymentAccess(me);
  const [del, d] = useDeletePaymentMutation();
  const [confirming, setConfirming] = useState(false);
  const [sharing, setSharing] = useState(false);
  const receipt = p.receiptNumber || `RCT-${p._id.slice(-8).toUpperCase()}`;

  const copyReceipt = async () => {
    await Clipboard.setStringAsync(receipt);
    showToast({ title: "Receipt number copied" });
  };
  const share = async () => {
    setSharing(true);
    await refetch(); // renews an expired login before the direct download, which can't refresh it itself
    await shareReceipt(p, store.getState().auth.accessToken);
    setSharing(false);
  };

  return (
    <>
      <PageHeader
        caption="PAYMENT"
        title={p.client?.companyName || "Payment"}
        fallback="/payments"
        right={
          can.edit ? (
            <Pressable
              onPress={() => router.push({ pathname: "/payments/edit", params: { id: p._id } })}
              accessibilityLabel="Edit payment"
              className="h-11 flex-row items-center gap-1.5 rounded-full bg-surface-2 px-4"
            >
              <Pencil size={16} color={theme.ink} />
              <Text className="font-body-semibold text-sm">Edit</Text>
            </Pressable>
          ) : null
        }
      />

      <Card className="gap-3 p-4">
        <View className="flex-row items-start gap-3">
          <View className="flex-1 gap-1">
            <Text className="text-sm text-muted">{p.status === "refunded" ? "Refund amount" : "Amount received"}</Text>
            <Amount payment={p} className="text-3xl leading-[38px]" />
          </View>
          <PaymentStatusBadge status={p.status} />
        </View>
        <Pressable onPress={copyReceipt} accessibilityLabel={`Receipt ${receipt}. Copy`} className="flex-row items-center gap-3">
          <Text className="w-28 text-sm text-muted">Receipt no.</Text>
          <Text className="flex-1 font-body-semibold text-sm tabular-nums">{receipt}</Text>
          <Copy size={16} color={theme["accent-ink"]} />
        </Pressable>
        <Field label="Purpose" value={purposeLabel(p.paymentType)} />
        <Field label="Method" value={methodLabel(p.paymentMethod)} />
        <Field label="Date" value={payDate(p.paymentDate)} />
        <Field label="Reference" value={p.referenceNo || "—"} mono />
      </Card>

      <Button title="Share receipt" icon={Share2} variant="secondary" loading={sharing} onPress={share} />

      <InvoiceCard payment={p} />

      <Card className="gap-3 p-4">
        <Label>CLIENT & PROJECT</Label>
        <View className="flex-row items-center gap-3">
          {!!p.client?.brand && <BrandMark brand={p.client.brand} size={32} />}
          <View className="flex-1">
            <Text className="font-body-semibold">{p.client?.companyName || "Client removed"}</Text>
            {!!p.client?.contactPerson && <Text className="text-sm text-muted">{p.client.contactPerson}</Text>}
          </View>
        </View>
        <Field label="Client ID" value={p.client?.clientId || "—"} mono />
        <Field label="Project" value={p.invoice?.project ? [p.invoice.project.projectCode, p.invoice.project.title].filter(Boolean).join(" · ") : "Not linked"} />
      </Card>

      <Card className="gap-2 p-4">
        <Label>NOTES</Label>
        <Text className={p.notes ? "" : "text-sm text-muted"} selectable>{p.notes || "No notes"}</Text>
        {!!p.createdBy?.name && <Text className="text-sm text-muted">Recorded by {p.createdBy.name}</Text>}
      </Card>

      {can.remove && (
        <>
          <Button
            title="Delete payment"
            icon={Trash2}
            variant="ghost"
            className="bg-danger/10"
            textClassName="text-danger"
            iconColor={theme.danger}
            onPress={() => setConfirming(true)}
          />
          <ConfirmDialog
            visible={confirming}
            title="Delete payment?"
            message={`${formatCurrency(p.amount)} will be removed and the invoice balance recalculated. This can't be undone.`}
            confirmLabel="Delete"
            loading={d.isLoading}
            onCancel={() => setConfirming(false)}
            onConfirm={async () => {
              const ok = await runAction(del(p._id), "Payment deleted", "Couldn't delete the payment");
              setConfirming(false);
              if (ok) backTo("/payments");
            }}
          />
        </>
      )}
    </>
  );
}

export default function PaymentDetail() {
  const { id } = useLocalSearchParams();
  const { data, isLoading, isError, refetch } = useGetPaymentByIdQuery(id);
  const refreshControl = usePullRefresh(refetch);
  const payment = data?.data?.payment;
  return (
    <Screen scroll className="gap-5 pt-2" refreshControl={refreshControl}>
      {payment ? (
        <PaymentBody key={payment._id} payment={payment} refetch={refetch} />
      ) : (
        <>
          <PageHeader caption="PAYMENT" title="" fallback="/payments" />
          <DashboardState isLoading={isLoading} isError={isError || (!isLoading && !payment)} refetch={refetch} />
        </>
      )}
    </Screen>
  );
}
