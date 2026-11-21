import {
  Amount,
  BrandMark,
  Button,
  Card,
  Chip,
  ConfirmDialog,
  DashboardState,
  InvoiceStatusBadge,
  PageHeader,
  PaidBar,
  PaymentStatusBadge,
  Pressable,
  Screen,
  Text,
  backTo,
  invDate,
  invoiceAccess,
  methodLabel,
  PdfActions,
  usePullRefresh,
} from "@/components";
import { PAYMENT_METHODS } from "@/constants";
import { useTheme } from "@/constants/theme";
import {
  useDeleteInvoiceMutation,
  useGetInvoiceByIdQuery,
  useResendInvoiceEmailMutation,
  useUpdateInvoiceStatusMutation,
} from "@/services/invoiceApi";
import {
  useCreatePaymentMutation,
  useGetInvoicePaymentsQuery,
} from "@/services/paymentApi";
import { useGetQuotationByIdQuery } from "@/services/quotationApi";
import { runAction } from "@/utils/attendance";
import { formatCurrency, formatCurrencyExact } from "@/utils/formatters";
import { invoiceActions, isPastDue, markPaidBody } from "@/utils/invoices";
import { router, useLocalSearchParams } from "expo-router";
import {
  Ban,
  CheckCircle2,
  Eye,
  FileSignature,
  Pencil,
  RefreshCw,
  Send,
  Trash2,
  Wallet,
} from "lucide-react-native";
import { useState } from "react";
import { Modal, Pressable as RNPressable, View } from "react-native";
import { useSelector } from "react-redux";

const Label = ({ children }) => (
  <Text className="text-caption text-muted">{children}</Text>
);

function Line({ label, value, strong, tone }) {
  return (
    <View className="flex-row justify-between gap-3">
      <Text className={strong ? "font-body-semibold" : "text-sm text-muted"}>
        {label}
      </Text>
      <Text
        className={`tabular-nums ${strong ? "font-body-semibold" : "text-sm"} ${tone || ""}`}
      >
        {value}
      </Text>
    </View>
  );
}

// Payments on this invoice, oldest first with a running total (web "Payments" card). Tap one to open it.
function Payments({ invoice: inv }) {
  const list = useGetInvoicePaymentsQuery(inv._id).data?.data?.payments || [];
  const ordered = [...list].sort(
    (a, b) => new Date(a.paymentDate) - new Date(b.paymentDate),
  );
  // Running total of completed payments up to and including each row.
  const runningTotals = ordered.map((_, i) =>
    ordered
      .slice(0, i + 1)
      .reduce((s, x) => s + (x.status === "completed" ? x.amount || 0 : 0), 0),
  );
  return (
    <View className="gap-3">
      <Label>PAYMENTS · {list.length}</Label>
      {!list.length && (
        <Text className="text-sm text-muted">No payments recorded yet.</Text>
      )}
      {ordered.map((p, i) => {
        const running = runningTotals[i];
        return (
          <Pressable
            key={p._id}
            onPress={() => router.push(`/payments/${p._id}`)}
            accessibilityLabel={`Payment ${formatCurrency(p.amount)}, ${p.status}`}
            className="gap-1 border-l-2 border-line pl-3"
          >
            <View className="flex-row items-center gap-2">
              <Amount payment={p} className="flex-1" />
              <PaymentStatusBadge status={p.status} />
            </View>
            <Text className="text-xs text-muted">
              {[
                methodLabel(p.paymentMethod),
                p.referenceNo && `#${p.referenceNo}`,
                invDate(p.paymentDate),
              ]
                .filter(Boolean)
                .join(" · ")}
              {p.status === "completed"
                ? ` → ${formatCurrency(running)} paid`
                : ""}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// "Mark as paid" / "Collect remaining": the whole balance in one tap after choosing how it was paid (web quick dialog).
function MarkPaid({ invoice: inv, visible, onClose }) {
  const [method, setMethod] = useState("bank_transfer");
  const [pay, p] = useCreatePaymentMutation();
  const partly = inv.status === "partially_paid";
  const close = () => !p.isLoading && onClose();
  const confirm = async () => {
    if (
      await runAction(
        pay(markPaidBody(inv, method)),
        "Payment recorded",
        "Couldn't record the payment",
      )
    )
      onClose();
  };
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={close}
    >
      <View className="flex-1 items-center justify-center px-6">
        <RNPressable
          onPress={close}
          accessibilityLabel="Cancel"
          className="absolute inset-0 bg-black/50"
        />
        <View
          accessibilityViewIsModal
          className="w-full max-w-sm gap-4 rounded-3xl bg-surface p-6"
        >
          <View className="gap-1.5">
            <Text
              accessibilityRole="header"
              className="font-body-semibold text-lg"
            >
              {partly ? "Collect remaining payment" : "Mark as paid"}
            </Text>
            <Text className="text-sm text-muted">
              {formatCurrencyExact(inv.balanceDue)} will be recorded as payment.
            </Text>
          </View>
          <View className="gap-2">
            <Text className="font-body-medium text-sm">Paid by</Text>
            <View className="flex-row flex-wrap gap-2">
              {PAYMENT_METHODS.map((m) => (
                <Chip
                  key={m.value}
                  label={m.label}
                  active={method === m.value}
                  onPress={() => setMethod(m.value)}
                />
              ))}
            </View>
          </View>
          <View className="flex-row gap-3">
            <Button
              title="Cancel"
              variant="secondary"
              className="flex-1"
              disabled={p.isLoading}
              onPress={onClose}
            />
            <Button
              title={partly ? "Collect & close" : "Confirm"}
              className="flex-1"
              loading={p.isLoading}
              onPress={confirm}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function InvoiceBody({ invoice: inv, refetch }) {
  const theme = useTheme();
  const me = useSelector((s) => s.auth.user);
  const can = invoiceAccess(me);
  const act = can.manage ? invoiceActions(inv) : {};
  const quote = useGetQuotationByIdQuery(inv.sourceQuotation, {
    skip: !inv.sourceQuotation,
  }).data?.data?.quotation;
  const [setStatus] = useUpdateInvoiceStatusMutation();
  const [resend] = useResendInvoiceEmailMutation();
  const [del] = useDeleteInvoiceMutation();
  const [confirm, setConfirm] = useState(null); // { title, message, label, task }
  const [busy, setBusy] = useState(false);
  const [paying, setPaying] = useState(false);
  const settled = (inv.balanceDue || 0) <= 0;
  const late = isPastDue(inv);

  const ask = (title, message, label, task) =>
    setConfirm({ title, message, label, task });
  const run = async (task) => {
    setBusy(true);
    await task?.();
    setBusy(false);
    setConfirm(null);
  };
  const pay = (advance) =>
    router.push({
      pathname: "/invoices/pay",
      params: { id: inv._id, ...(advance ? { advance: "1" } : {}) },
    });
  const pdf = { path: `/invoices/${inv._id}/pdf`, fileName: `${inv.invoiceNumber || "invoice"}.pdf` };

  return (
    <>
      <PageHeader
        caption={inv.invoiceNumber || "INVOICE"}
        title={inv.client?.companyName || "Invoice"}
        fallback="/invoices"
        right={
          act.edit ? (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/invoices/new",
                  params: { id: inv._id },
                })
              }
              accessibilityLabel="Edit invoice"
              className="h-11 flex-row items-center gap-1.5 rounded-full bg-surface-2 px-4"
            >
              <Pencil size={16} color={theme.ink} />
              <Text className="font-body-semibold text-sm">Edit</Text>
            </Pressable>
          ) : null
        }
      />

      <View className="flex-row flex-wrap items-center gap-2">
        {!!inv.client?.brand && (
          <BrandMark brand={inv.client.brand} size={28} />
        )}
        <InvoiceStatusBadge status={inv.status} />
        {!!inv.project && (
          <Text className="text-sm text-muted">
            {[inv.project.projectCode, inv.project.title]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        )}
      </View>
      {!!inv.sourceQuotation && (
        <Pressable
          onPress={() => router.push(`/quotations/${inv.sourceQuotation}`)}
          accessibilityLabel="Open source quotation"
          className="-mt-2 flex-row items-center gap-2 self-start"
        >
          <FileSignature size={14} color={theme["accent-ink"]} />
          <Text className="text-sm text-accent-ink">
            Created from {quote?.quotationNumber || "quotation"}
            {inv.sourceRevisionVersion ? ` V${inv.sourceRevisionVersion}` : ""}
          </Text>
        </Pressable>
      )}

      <Card className="gap-3 p-4">
        <View className="flex-row justify-between">
          <View>
            <Text className="text-xs text-muted">Total</Text>
            <Text className="font-body-semibold tabular-nums">
              {formatCurrency(inv.total)}
            </Text>
          </View>
          <View className="items-center">
            <Text className="text-xs text-muted">Paid</Text>
            <Text className="font-body-semibold tabular-nums text-success">
              {formatCurrency(inv.paidAmount)}
            </Text>
          </View>
          <View className="items-end">
            <Text className="text-xs text-muted">Balance</Text>
            <Text
              className={`font-body-semibold tabular-nums ${settled ? "text-success" : ""}`}
            >
              {settled && inv.status !== "draft"
                ? "Settled"
                : formatCurrency(inv.balanceDue)}
            </Text>
          </View>
        </View>
        <PaidBar invoice={inv} />
        <View className="flex-row justify-between">
          <Text className="text-sm text-muted">
            Issued {invDate(inv.issueDate)}
          </Text>
          <Text className={`text-sm ${late ? "text-danger" : "text-muted"}`}>
            {late ? "Was due" : "Due"} {invDate(inv.dueDate)}
          </Text>
        </View>
      </Card>

      {/* Main actions by status, same as the web detail page. */}
      <View className="gap-2">
        {act.send && (
          <Button
            title="Send invoice"
            icon={Send}
            onPress={() =>
              ask(
                "Send invoice?",
                "An email with the invoice PDF goes to the client.",
                "Send",
                () =>
                  runAction(
                    setStatus({ id: inv._id, status: "sent" }),
                    "Invoice sent",
                    "Couldn't send the invoice",
                  ),
              )
            }
          />
        )}
        {act.recordPayment && (
          <Button
            title="Record payment"
            icon={Wallet}
            onPress={() => pay(false)}
          />
        )}
        {act.markPaid && (
          <Button
            title={
              inv.status === "partially_paid"
                ? `Collect remaining ${formatCurrency(inv.balanceDue)}`
                : "Mark as paid"
            }
            icon={CheckCircle2}
            variant="secondary"
            onPress={() => setPaying(true)}
          />
        )}
        {act.recordAdvance && (
          <Button
            title="Record advance"
            icon={Wallet}
            variant="secondary"
            onPress={() => pay(true)}
          />
        )}
        <Button
          title="Preview invoice"
          icon={Eye}
          variant="secondary"
          onPress={() =>
            router.push({
              pathname: "/document-preview",
              params: { title: inv.invoiceNumber || "Invoice", htmlPath: `/invoices/${inv._id}/html`, ...pdf, label: "invoice" },
            })
          }
        />
        <PdfActions {...pdf} label="invoice" refresh={refetch} />
        {act.resend && (
          <Button
            title="Resend to client"
            icon={RefreshCw}
            variant="ghost"
            onPress={() =>
              ask(
                "Resend invoice?",
                "Send this invoice again to the client's email?",
                "Resend",
                () =>
                  runAction(
                    resend(inv._id),
                    "Invoice email resent",
                    "Couldn't resend the invoice",
                  ),
              )
            }
          />
        )}
      </View>

      <Card className="gap-3 p-4">
        <Label>ITEMS · {inv.items?.length || 0}</Label>
        {(inv.items || []).map((it, i) => (
          <View key={i} className="flex-row gap-3">
            <View className="flex-1">
              <Text className="text-sm" selectable>
                {it.description}
              </Text>
              <Text className="text-xs tabular-nums text-muted">
                {it.quantity} × {formatCurrencyExact(it.unitPrice)}
              </Text>
            </View>
            <Text className="text-sm tabular-nums">
              {formatCurrencyExact(it.amount ?? it.quantity * it.unitPrice)}
            </Text>
          </View>
        ))}
        <View className="gap-1.5 border-t border-line pt-3">
          <Line label="Subtotal" value={formatCurrencyExact(inv.subtotal)} />
          <Line
            label={`GST (${inv.taxRate || 0}%)`}
            value={formatCurrencyExact(inv.taxAmount)}
          />
          {!!inv.discountPercent && (
            <Line
              label={`Discount (${inv.discountPercent}%)`}
              value={`−${formatCurrencyExact(inv.discountAmount)}`}
              tone="text-danger"
            />
          )}
          <Line label="Total" value={formatCurrencyExact(inv.total)} strong />
        </View>
      </Card>

      <Payments invoice={inv} />

      <View className="gap-1.5">
        <Label>TIMELINE</Label>
        <Text className="text-sm text-muted">
          Created {invDate(inv.createdAt)}
          {inv.createdBy?.name ? ` by ${inv.createdBy.name}` : ""}
        </Text>
        {!!inv.sentAt && (
          <Text className="text-sm text-muted">Sent {invDate(inv.sentAt)}</Text>
        )}
        {inv.status === "partially_paid" && (
          <Text className="text-sm text-muted">
            Partially paid · {formatCurrency(inv.paidAmount)} collected
          </Text>
        )}
        {!!inv.paidAt && (
          <Text className="text-sm text-muted">Paid {invDate(inv.paidAt)}</Text>
        )}
        {!!inv.cancelledAt && (
          <Text className="text-sm text-muted">
            Cancelled {invDate(inv.cancelledAt)}
          </Text>
        )}
      </View>

      {(!!inv.notes || !!inv.termsConditions) && (
        <Card className="gap-2 p-4">
          {!!inv.notes && (
            <>
              <Label>NOTES</Label>
              <Text className="text-sm" selectable>
                {inv.notes}
              </Text>
            </>
          )}
          {!!inv.termsConditions && (
            <>
              <Label>TERMS</Label>
              <Text className="text-sm" selectable>
                {inv.termsConditions}
              </Text>
            </>
          )}
        </Card>
      )}

      {(act.cancel || act.remove) && (
        <View className="gap-2">
          {act.cancel && (
            <Button
              title="Cancel invoice"
              icon={Ban}
              variant="ghost"
              onPress={() =>
                ask(
                  "Cancel invoice?",
                  "Cancel this invoice? This cannot be undone.",
                  "Cancel invoice",
                  () =>
                    runAction(
                      setStatus({ id: inv._id, status: "cancelled" }),
                      "Invoice cancelled",
                      "Couldn't cancel the invoice",
                    ),
                )
              }
            />
          )}
          {act.remove && (
            <Button
              title="Delete invoice"
              icon={Trash2}
              variant="ghost"
              className="bg-danger/10"
              textClassName="text-danger"
              iconColor={theme.danger}
              onPress={() =>
                ask(
                  "Delete invoice?",
                  `${inv.invoiceNumber} will be deleted. This cannot be undone.`,
                  "Delete",
                  async () => {
                    if (
                      await runAction(
                        del(inv._id),
                        "Invoice deleted",
                        "Couldn't delete the invoice",
                      )
                    )
                      backTo("/invoices");
                  },
                )
              }
            />
          )}
        </View>
      )}

      <ConfirmDialog
        visible={!!confirm}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel={confirm?.label}
        loading={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => run(confirm?.task)}
      />
      <MarkPaid
        invoice={inv}
        visible={paying}
        onClose={() => setPaying(false)}
      />
    </>
  );
}

export default function InvoiceDetail() {
  const { id } = useLocalSearchParams();
  const { data, isLoading, isError, refetch } = useGetInvoiceByIdQuery(id);
  const refreshControl = usePullRefresh(refetch);
  const invoice = data?.data?.invoice;
  return (
    <Screen scroll className="gap-5 pt-2" refreshControl={refreshControl}>
      {invoice ? (
        <InvoiceBody key={invoice._id} invoice={invoice} refetch={refetch} />
      ) : (
        <>
          <PageHeader caption="INVOICE" title="" fallback="/invoices" />
          <DashboardState
            isLoading={isLoading}
            isError={isError || (!isLoading && !invoice)}
            refetch={refetch}
          />
        </>
      )}
    </Screen>
  );
}
