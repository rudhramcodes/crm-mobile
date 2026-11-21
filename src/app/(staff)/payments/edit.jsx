import { Alert, Button, Chip, DashboardState, DateField, Input, Screen, SheetHeader, Text, backTo } from "@/components";
import { PAYMENT_METHODS, PAYMENT_STATUS, PAYMENT_TYPES } from "@/constants";
import { useGetPaymentByIdQuery, useUpdatePaymentMutation } from "@/services/paymentApi";
import { apiError } from "@/utils/apiError";
import { runAction } from "@/utils/attendance";
import { formatCurrency } from "@/utils/formatters";
import { getFieldError } from "@/utils/getFieldError";
import { maxEditable, paymentBody, paymentForm } from "@/utils/payments";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Platform, View } from "react-native";

const textArea = { height: 96, paddingTop: 14, textAlignVertical: "top" };

function Field({ label, children }) {
  return (
    <View className="gap-1.5">
      <Text className="font-body-medium text-sm">{label}</Text>
      {children}
    </View>
  );
}

function Chips({ options, value, onChange }) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((o) => <Chip key={o.value} label={o.label} active={value === o.value} onPress={() => onChange(o.value)} />)}
    </View>
  );
}

// Same fields as the web "Edit Payment"; the invoice is fixed. Unlike the web, the amount is capped at what the invoice can take.
function PaymentEditForm({ payment: p }) {
  const [update, u] = useUpdatePaymentMutation();
  const [f, setF] = useState(() => paymentForm(p));
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const { message, fieldErrors } = apiError(u.error);
  const err = (k) => getFieldError(fieldErrors, k);

  const max = maxEditable(p);
  const amount = Number(f.amount);
  const amountError = !f.amount
    ? ""
    : !(amount > 0)
      ? "Amount must be greater than 0"
      : max != null && amount > max
        ? `More than this invoice can take. Enter ${formatCurrency(max)} or less.`
        : "";
  const ready = amount > 0 && !amountError;

  const save = async () => {
    if (await runAction(update({ id: p._id, ...paymentBody(f) }), "Payment updated", "Couldn't update the payment")) backTo(`/payments/${p._id}`);
  };

  return (
    <>
      <SheetHeader title="Edit payment" sub={[p.invoice?.invoiceNumber, p.client?.companyName].filter(Boolean).join(" · ")} closeLabel="Cancel" />
      <Alert message={fieldErrors.length ? "" : message} />
      <Input
        label="Amount *"
        value={f.amount}
        onChangeText={(v) => set("amount")(v.replace(/[^0-9.]/g, ""))}
        placeholder="e.g. 25000"
        keyboardType="decimal-pad"
        hint={max != null ? `Max ${formatCurrency(max)} for this invoice` : undefined}
        error={amountError || err("amount")}
      />
      <Field label="Purpose">
        <Chips options={PAYMENT_TYPES} value={f.paymentType} onChange={set("paymentType")} />
      </Field>
      <Field label="Method">
        <Chips options={PAYMENT_METHODS} value={f.paymentMethod} onChange={set("paymentMethod")} />
      </Field>
      <Field label="Status">
        <Chips options={PAYMENT_STATUS} value={f.status} onChange={set("status")} />
      </Field>
      <Input
        label="Reference no."
        value={f.referenceNo}
        onChangeText={set("referenceNo")}
        placeholder="UTR / Cheque no. / Transaction ID"
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={100}
        error={err("referenceNo")}
      />
      <DateField label="Payment date" value={f.paymentDate} onChange={set("paymentDate")} error={err("paymentDate")} />
      <Input label="Notes" value={f.notes} onChangeText={set("notes")} placeholder="e.g. Paid at the venue, balance after the event" multiline maxLength={500} style={textArea} error={err("notes")} />
      <Button title="Save changes" loading={u.isLoading} disabled={!ready} onPress={save} />
    </>
  );
}

// Android shows modals full screen under the status bar, so it needs the top inset; iOS sheets don't.
export default function EditPayment() {
  const { id } = useLocalSearchParams();
  const { data, isLoading, isError, refetch } = useGetPaymentByIdQuery(id);
  const payment = data?.data?.payment;
  return (
    <Screen scroll edges={Platform.OS === "android" ? ["top", "bottom"] : ["bottom"]} className="gap-5 pt-6">
      {payment ? (
        <PaymentEditForm key={payment._id} payment={payment} />
      ) : (
        <DashboardState isLoading={isLoading} isError={isError || !isLoading} refetch={refetch} />
      )}
    </Screen>
  );
}
