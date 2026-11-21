import { Alert, Button, Card, Chip, DashboardState, DateField, Input, Screen, SheetHeader, Text, Toggle, backTo } from "@/components";
import { INVOICE_STATUS, PAYMENT_METHODS, PAYMENT_STATUS, PAYMENT_TYPES } from "@/constants";
import { useGetInvoiceByIdQuery } from "@/services/invoiceApi";
import { useCreatePaymentMutation, useCreateSplitPaymentMutation } from "@/services/paymentApi";
import { apiError } from "@/utils/apiError";
import { runAction } from "@/utils/attendance";
import { formatCurrencyExact } from "@/utils/formatters";
import { afterPayment, paymentDefaults, paymentProblem, paymentRequest } from "@/utils/invoices";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Platform, View } from "react-native";

const textArea = { height: 80, paddingTop: 14, textAlignVertical: "top" };
const statusLabel = (v) => INVOICE_STATUS.find((s) => s.value === v)?.label || v;

function Field({ label, children }) {
  return (
    <View className="gap-1.5">
      <Text className="font-body-medium text-sm">{label}</Text>
      {children}
    </View>
  );
}
const Chips = ({ options, value, onChange }) => (
  <View className="flex-row flex-wrap gap-2">
    {options.map((o) => <Chip key={o.value} label={o.label} active={value === o.value} onPress={() => onChange(o.value)} />)}
  </View>
);

// Record payment / advance / split payment against one invoice (web PaymentForm). The invoice is fixed.
function PaymentForm({ invoice: inv, advance }) {
  const [create, c] = useCreatePaymentMutation();
  const [createSplit, s] = useCreateSplitPaymentMutation();
  const [p, setP] = useState(() => paymentDefaults(inv));
  const set = (k) => (v) => setP((x) => ({ ...x, [k]: v }));
  const { message } = apiError(c.error || s.error);
  const num = (v) => v.replace(/[^0-9.]/g, "");

  const problem = paymentProblem(inv, p);
  const after = afterPayment(inv, p.amount, p.status);
  const full = Math.abs((parseFloat(p.amount) || 0) - (inv.balanceDue || 0)) < 0.005;
  const cash = parseFloat(p.cash) || 0;
  const bank = Math.max(0, (parseFloat(p.amount) || 0) - cash);
  const title = p.split ? "Record split payment" : advance ? "Record advance payment" : "Record payment";

  const save = async () => {
    const req = paymentRequest(inv, p);
    const ok = await runAction(
      req.split ? createSplit(req.body) : create(req.body),
      req.split ? "Split payment recorded" : "Payment recorded",
      "Couldn't record the payment",
    );
    if (ok) backTo(`/invoices/${inv._id}`);
  };

  return (
    <>
      <SheetHeader title={title} sub={`${inv.invoiceNumber} · ${inv.client?.companyName || ""}`} closeLabel="Cancel" />
      <Alert message={message} />
      {advance && (
        <Text className="text-sm text-muted">{"This invoice is still a draft. Recording an advance locks it for editing and doesn't email it; use Resend afterwards to send it to the client."}</Text>
      )}

      <Card className="flex-row items-center gap-3 p-4">
        <View className="flex-1">
          <Text className="text-caption text-muted">BALANCE DUE</Text>
          <Text className="font-body-semibold text-xl tabular-nums">{formatCurrencyExact(inv.balanceDue)}</Text>
        </View>
        {!full && <Button title="Full amount" size="sm" variant="secondary" onPress={() => set("amount")(String(inv.balanceDue || 0))} />}
      </Card>

      <Field label="Payment purpose">
        <Chips options={PAYMENT_TYPES.map((t) => ({ ...t, label: t.label.replace(/ Payment$/, "") }))} value={p.paymentType} onChange={set("paymentType")} />
        <Text className="text-xs text-muted">Use Advance for an initial collection before the invoice is fully settled.</Text>
      </Field>

      <View className="flex-row items-center justify-between">
        <View className="flex-1">
          <Text className="font-body-medium text-sm">Split payment (bank + cash)</Text>
          <Text className="text-xs text-muted">Creates two payment entries against this same invoice.</Text>
        </View>
        <Toggle value={p.split} onValueChange={set("split")} label="Split payment" />
      </View>

      <Input
        label={p.split ? "Total amount received *" : "Amount *"}
        value={p.amount}
        onChangeText={(v) => set("amount")(num(v))}
        keyboardType="decimal-pad"
        hint={`Maximum collectible amount: ${formatCurrencyExact(inv.balanceDue)}`}
        error={(parseFloat(p.amount) || 0) > (inv.balanceDue || 0) + 0.001 ? `Exceeds balance due of ${formatCurrencyExact(inv.balanceDue)}` : undefined}
      />

      {p.split ? (
        <>
          <Input label="Cash portion *" value={p.cash} onChangeText={(v) => set("cash")(num(v))} placeholder="e.g. 5000" keyboardType="decimal-pad" hint="Bank portion is total minus cash." />
          <Card className="gap-1 p-4">
            <View className="flex-row justify-between"><Text className="text-sm text-muted">Bank / UPI portion</Text><Text className="text-sm tabular-nums">{formatCurrencyExact(bank)}</Text></View>
            <View className="flex-row justify-between"><Text className="text-sm text-muted">Cash portion</Text><Text className="text-sm tabular-nums">{formatCurrencyExact(cash)}</Text></View>
          </Card>
        </>
      ) : (
        <Field label="Payment method">
          <Chips options={PAYMENT_METHODS} value={p.paymentMethod} onChange={set("paymentMethod")} />
        </Field>
      )}

      <Field label="Status">
        <Chips options={PAYMENT_STATUS} value={p.status} onChange={set("status")} />
      </Field>
      <Input
        label={p.split ? "Bank reference / UTR" : "Reference no."}
        value={p.referenceNo}
        onChangeText={set("referenceNo")}
        placeholder={p.split ? "UTR / transaction ID for the bank portion" : "UTR / Cheque no. / Transaction ID"}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={100}
      />
      <DateField label="Payment date" value={p.paymentDate} onChange={set("paymentDate")} />
      <Input label="Notes" value={p.notes} onChangeText={set("notes")} placeholder="Optional notes..." multiline maxLength={500} style={textArea} />

      <Card className="gap-1.5 p-4">
        <Text className="text-caption text-muted">AFTER THIS PAYMENT</Text>
        <View className="flex-row justify-between"><Text className="text-sm text-muted">Paid amount</Text><Text className="text-sm tabular-nums">{formatCurrencyExact(after.paid)}</Text></View>
        <View className="flex-row justify-between"><Text className="text-sm text-muted">Balance due</Text><Text className={`text-sm tabular-nums ${after.balance <= 0 ? "text-success" : ""}`}>{after.balance <= 0 ? "Fully paid ✓" : formatCurrencyExact(after.balance)}</Text></View>
        <View className="flex-row justify-between"><Text className="text-sm text-muted">New status</Text><Text className="text-sm">{statusLabel(after.status)}</Text></View>
        {p.status !== "completed" && <Text className="text-xs text-muted">Only completed payments count toward the invoice.</Text>}
      </Card>

      {!!problem && !!p.amount && <Text className="text-sm text-danger">{problem}</Text>}
      <Button title={p.split ? "Record split payment" : full ? "Pay full amount" : "Record payment"} loading={c.isLoading || s.isLoading} disabled={!!problem} onPress={save} />
    </>
  );
}

// Android shows modals full screen under the status bar, so it needs the top inset; iOS sheets don't.
export default function RecordPayment() {
  const { id, advance } = useLocalSearchParams();
  const { data, isLoading, isError, refetch } = useGetInvoiceByIdQuery(id);
  const invoice = data?.data?.invoice;
  return (
    <Screen scroll edges={Platform.OS === "android" ? ["top", "bottom"] : ["bottom"]} className="gap-5 pt-6">
      {invoice ? (
        <PaymentForm key={invoice._id} invoice={invoice} advance={advance === "1"} />
      ) : (
        <DashboardState isLoading={isLoading} isError={isError || !isLoading} refetch={refetch} />
      )}
    </Screen>
  );
}
