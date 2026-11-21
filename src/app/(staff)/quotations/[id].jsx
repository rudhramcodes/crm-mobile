import {
  Badge,
  BrandMark,
  Button,
  Card,
  Chip,
  ConfirmDialog,
  DashboardState,
  Input,
  PageHeader,
  Pressable,
  QuotationStatusBadge,
  Screen,
  Text,
  backTo,
  quotationAccess,
  quoteDate,
  shareServerPdf,
  usePullRefresh,
} from "@/components";
import { QUOTATION_STATUS } from "@/constants";
import { useTheme } from "@/constants/theme";
import {
  useCreateQuotationWorkingCopyMutation,
  useDeleteQuotationMutation,
  useDiscardQuotationWorkingCopyMutation,
  useGetQuotationByIdQuery,
  useGetQuotationRevisionQuery,
  useInitializeQuotationHistoryMutation,
  useResendQuotationEmailMutation,
  useResendQuotationRevisionMutation,
  useSaveQuotationRevisionMutation,
  useSendQuotationRevisionMutation,
  useSetQuotationArchiveMutation,
  useUpdateQuotationRevisionStatusMutation,
  useUpdateQuotationStatusMutation,
} from "@/services/quotationApi";
import { runAction } from "@/utils/attendance";
import { formatCurrency } from "@/utils/formatters";
import { defaultSelection, isPastValid, isVersioned, money, pdfTarget, versionActions, versionOptions } from "@/utils/quotations";
import { router, useLocalSearchParams } from "expo-router";
import { Archive, ArchiveRestore, FileClock, FilePlus2, FileText, Pencil, RefreshCw, Send, Trash2 } from "lucide-react-native";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useSelector, useStore } from "react-redux";

const Label = ({ children }) => <Text className="text-caption text-muted">{children}</Text>;
const statusLabel = (v) => QUOTATION_STATUS.find((s) => s.value === v)?.label || v;
const VERB = { accepted: "Accept", rejected: "Reject", expired: "Expire", sent: "Mark sent" };

function Row({ label, value, strong }) {
  if (value == null || value === "") return null;
  return (
    <View className="flex-row items-center gap-3">
      <Text className="flex-1 text-sm text-muted">{label}</Text>
      <Text className={strong ? "font-body-semibold tabular-nums" : "text-sm tabular-nums"} selectable>{value}</Text>
    </View>
  );
}

// Subtotal, GST, total, budget and dates for whatever is on screen (a saved version, the draft, or a legacy quotation).
function MoneyCard({ content: c, loading }) {
  const m = money(c);
  const late = isPastValid({ status: c.status || "sent", validUntil: c.validUntil });
  return (
    <Card className={`gap-2.5 p-4 ${loading ? "opacity-50" : ""}`}>
      <Text className="text-sm text-muted">Total</Text>
      <Text className="font-body-semibold text-3xl leading-[38px] tabular-nums">{formatCurrency(m.total)}</Text>
      <View className="gap-2 border-t border-line pt-3">
        <Row label="Subtotal" value={formatCurrency(m.price)} />
        <Row label={`GST (${m.taxRate}%)`} value={formatCurrency(m.taxAmount)} />
        <Row label="Client budget" value={m.budget ? formatCurrency(m.budget) : "Not set"} />
        <Row label="Issued" value={quoteDate(c.issueDate)} />
        {c.validUntil ? (
          <View className="flex-row items-center gap-3">
            <Text className="flex-1 text-sm text-muted">Valid until</Text>
            <Text className={`text-sm tabular-nums ${late ? "text-danger" : ""}`}>{quoteDate(c.validUntil)}{late ? " · ended" : ""}</Text>
          </View>
        ) : (
          <Row label="Valid until" value="No end date" />
        )}
      </View>
    </Card>
  );
}

function History({ quotation: q, selection, onSelect }) {
  const revisions = [...(q.revisions || [])].sort((a, b) => b.version - a.version);
  if (!revisions.length) return null;
  return (
    <View className="gap-3">
      <Label>VERSION HISTORY · {revisions.length}</Label>
      {revisions.map((r) => {
        const events = [
          r.sentAt && `Sent ${quoteDate(r.sentAt)}`,
          r.acceptedAt && `Accepted ${quoteDate(r.acceptedAt)}`,
          r.rejectedAt && `Rejected ${quoteDate(r.rejectedAt)}`,
          r.expiredAt && `Expired ${quoteDate(r.expiredAt)}`,
        ].filter(Boolean);
        return (
          <Pressable
            key={r.version}
            onPress={() => onSelect(r.version)}
            accessibilityLabel={`Version ${r.version}, ${statusLabel(r.status)}`}
            className={`gap-1 border-l-2 pl-3 ${selection === r.version ? "border-accent" : "border-line"}`}
          >
            <View className="flex-row items-center gap-2">
              <Text className="flex-1 font-body-semibold">V{r.version}{r.version === q.latestVersion ? " · Latest" : ""}</Text>
              <QuotationStatusBadge status={r.status} />
            </View>
            {!!r.revisionNote && <Text className="text-sm">{r.revisionNote}</Text>}
            <Text className="text-xs text-muted">{[`Saved ${quoteDate(r.createdAt)}`, r.createdByName && `by ${r.createdByName}`].filter(Boolean).join(" ")}</Text>
            {!!events.length && <Text className="text-xs text-muted">{events.join(" · ")}</Text>}
          </Pressable>
        );
      })}
    </View>
  );
}

function QuotationBody({ quotation: q, refetch }) {
  const theme = useTheme();
  const store = useStore();
  const me = useSelector((s) => s.auth.user);
  const can = quotationAccess(me);
  const versioned = isVersioned(q);
  const options = versionOptions(q);
  const [picked, setPicked] = useState(null);
  // Fall back to the default when the picked version no longer exists (draft saved or discarded).
  const selection = options.some((o) => o.key === picked) ? picked : defaultSelection(q);
  const working = selection === "working";
  const revision = versioned && !working ? (q.revisions || []).find((r) => r.version === selection) : null;
  const revQ = useGetQuotationRevisionQuery({ id: q._id, version: selection }, { skip: !revision });
  const content = !versioned ? q : working ? { ...(q.workingCopy?.content || {}), status: "draft" } : { ...(revQ.data?.data?.revision?.content || (selection === q.latestVersion ? q : {})), status: revision?.status };
  const act = can.manage ? versionActions(q, selection) : {};
  const wc = q.workingCopy;

  const [confirm, setConfirm] = useState(null); // { title, message, label, danger, task }
  const [saving, setSaving] = useState(false); // shows the "save as version" note box
  const [note, setNote] = useState("");
  const [sharing, setSharing] = useState(false);
  const [busy, setBusy] = useState(false);

  const [sendRev] = useSendQuotationRevisionMutation();
  const [resendRev] = useResendQuotationRevisionMutation();
  const [revStatus] = useUpdateQuotationRevisionStatusMutation();
  const [createWc] = useCreateQuotationWorkingCopyMutation();
  const [discardWc] = useDiscardQuotationWorkingCopyMutation();
  const [saveRev, sv] = useSaveQuotationRevisionMutation();
  const [setArchive] = useSetQuotationArchiveMutation();
  const [baseline] = useInitializeQuotationHistoryMutation();
  const [legacyStatus] = useUpdateQuotationStatusMutation();
  const [legacyResend] = useResendQuotationEmailMutation();
  const [del] = useDeleteQuotationMutation();

  const ask = (title, message, label, task, danger = false) => setConfirm({ title, message, label, task, danger });
  const run = async (task) => {
    setBusy(true);
    const res = await task();
    setBusy(false);
    setConfirm(null);
    return res;
  };
  const recipient = content.recipientEmail || q.recipientEmail || q.client?.email || "the saved recipient";
  const v = `V${selection}`;

  const sharePdf = async () => {
    setSharing(true);
    await refetch(); // renews an expired login before the direct download
    const t = pdfTarget(q, selection);
    await shareServerPdf(t.path, t.name, store.getState().auth.accessToken, "quotation");
    setSharing(false);
  };
  const createRevision = async () => {
    setBusy(true);
    const ok = await runAction(createWc({ id: q._id, sourceVersion: selection, baseVersion: q.latestVersion }), `Working draft created from ${v}`, "Couldn't create the working draft");
    setBusy(false);
    if (ok) setPicked("working");
  };
  const saveVersion = async () => {
    const res = await runAction(
      saveRev({ id: q._id, baseVersion: wc?.baseVersion, editVersion: wc?.editVersion, revisionNote: note.trim() }),
      `Saved as V${q.latestVersion + 1}`,
      "Couldn't save the version",
    );
    if (res) {
      setSaving(false);
      setNote("");
      setPicked(res.data?.revision?.version ?? q.latestVersion + 1);
    }
  };

  return (
    <>
      <PageHeader
        caption={q.quotationNumber || "QUOTATION"}
        title={q.client?.companyName || "Quotation"}
        fallback="/quotations"
        right={
          act.edit ? (
            <Pressable
              onPress={() => router.push({ pathname: "/quotations/edit", params: { id: q._id } })}
              accessibilityLabel="Edit working draft"
              className="h-11 flex-row items-center gap-1.5 rounded-full bg-surface-2 px-4"
            >
              <Pencil size={16} color={theme.ink} />
              <Text className="font-body-semibold text-sm">Edit</Text>
            </Pressable>
          ) : null
        }
      />

      <View className="flex-row flex-wrap items-center gap-2">
        {!!q.client?.brand && <BrandMark brand={q.client.brand} size={28} />}
        <QuotationStatusBadge status={q.status} />
        {!!q.archivedAt && <Badge label="Archived" />}
        {!!q.project && <Text className="text-sm text-muted">{[q.project.projectCode, q.project.title].filter(Boolean).join(" · ")}</Text>}
      </View>

      {versioned && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-5" contentContainerClassName="gap-2 px-5">
          {options.map((o) => <Chip key={o.key} label={o.label} active={selection === o.key} onPress={() => setPicked(o.key)} />)}
        </ScrollView>
      )}
      {working && <Text className="-mt-2 text-sm text-muted">Not a saved version yet. Save it to send it to the client.</Text>}
      {!!revision && (
        <View className="-mt-2 flex-row items-center gap-2">
          <Text className="text-sm text-muted">{v} is</Text>
          <QuotationStatusBadge status={revision.status} />
        </View>
      )}

      <MoneyCard content={content} loading={!!revision && revQ.isFetching} />

      <Button title={working ? "View draft PDF" : versioned ? `View / share ${v} PDF` : "View / share PDF"} icon={FileText} variant="secondary" loading={sharing} onPress={sharePdf} />

      {/* Saved version: send, resend, decide, branch a new draft. */}
      {(act.send || act.resend || act.status?.length || act.createRevision || act.openWorking) && (
        <View className="gap-2">
          {act.send && <Button title={`Send ${v} to client`} icon={Send} onPress={() => ask(`Send ${v}?`, `Email the saved ${v} PDF to ${recipient}?`, "Send", () => runAction(sendRev({ id: q._id, version: selection }), `${v} sent`, "Couldn't send the quotation"))} />}
          {act.resend && <Button title={`Resend ${v}`} icon={RefreshCw} variant="secondary" onPress={() => ask(`Resend ${v}?`, `Email the saved ${v} PDF to ${recipient} again?`, "Resend", () => runAction(resendRev({ id: q._id, version: selection }), `${v} resent`, "Couldn't resend the quotation"))} />}
          {!!act.status?.length && (
            <View className="gap-2">
              <Label>MARK {v}</Label>
              <View className="flex-row flex-wrap gap-2">
                {act.status.map((s) => (
                  <Chip
                    key={s}
                    label={VERB[s]}
                    onPress={() => ask(`${VERB[s]} ${v}?`, `This changes the status of ${v} only. Its saved content and PDF stay the same.`, VERB[s], () => runAction(revStatus({ id: q._id, version: selection, status: s, expectedStatus: revision?.status }), `${v} marked ${statusLabel(s).toLowerCase()}`, "Couldn't update the status"), s === "rejected")}
                  />
                ))}
              </View>
            </View>
          )}
          {act.createRevision && <Button title={`Create revision from ${v}`} icon={FilePlus2} variant="secondary" loading={busy && !confirm} onPress={createRevision} />}
          {act.openWorking && <Button title="Open working draft" variant="ghost" onPress={() => setPicked("working")} />}
        </View>
      )}

      {/* Working draft: save as the next version, or throw it away. */}
      {act.save && (
        saving ? (
          <Card className="gap-3 p-4">
            <Text className="font-body-semibold">Save as V{q.latestVersion + 1}</Text>
            <Text className="text-sm text-muted">{"Freezes the draft and its PDF as a new version. It doesn't email anyone."}</Text>
            <Input value={note} onChangeText={setNote} placeholder="What changed? e.g. Price revised after call" maxLength={2000} accessibilityLabel="Version note" />
            <View className="flex-row gap-2">
              <Button title="Cancel" variant="secondary" className="flex-1" onPress={() => setSaving(false)} />
              <Button title="Save version" className="flex-1" loading={sv.isLoading} onPress={saveVersion} />
            </View>
          </Card>
        ) : (
          <View className="gap-2">
            <Button title={`Save as V${q.latestVersion + 1}`} icon={FilePlus2} onPress={() => setSaving(true)} />
            {act.discard && (
              <Button
                title="Discard draft"
                icon={Trash2}
                variant="ghost"
                textClassName="text-danger"
                iconColor={theme.danger}
                onPress={() => ask("Discard working draft?", "The draft's changes are thrown away. All saved versions stay.", "Discard", () => runAction(discardWc({ id: q._id, baseVersion: wc?.baseVersion, editVersion: wc?.editVersion }), "Working draft discarded", "Couldn't discard the draft"), true)}
              />
            )}
          </View>
        )
      )}

      {/* Older quotations made before version history. */}
      {act.baseline && (
        <View className="gap-2">
          {!!act.legacyStatus?.length && (
            <View className="gap-2">
              <Label>MARK AS</Label>
              <View className="flex-row flex-wrap gap-2">
                {act.legacyStatus.map((s) => (
                  <Chip key={s} label={VERB[s]} onPress={() => ask(`${VERB[s]} quotation?`, s === "sent" ? `Mark as sent and email it to ${recipient}?` : `Mark this quotation ${statusLabel(s).toLowerCase()}?`, VERB[s], () => runAction(legacyStatus({ id: q._id, status: s }), `Quotation marked ${statusLabel(s).toLowerCase()}`, "Couldn't update the status"), s === "rejected")} />
                ))}
              </View>
            </View>
          )}
          {act.legacyResend && <Button title="Resend to client" icon={RefreshCw} variant="secondary" onPress={() => ask("Resend quotation?", `Email it to ${recipient} again?`, "Resend", () => runAction(legacyResend(q._id), "Quotation resent", "Couldn't resend the quotation"))} />}
          <Button title="Enable version history" icon={FileClock} variant="secondary" onPress={() => ask("Enable version history?", "Keeps the current quotation as V1. Its original sent PDF isn't available.", "Create V1", () => runAction(baseline({ id: q._id }), "Version history enabled", "Couldn't enable version history"))} />
          {act.legacyDelete && (
            <Button
              title="Delete quotation"
              icon={Trash2}
              variant="ghost"
              className="bg-danger/10"
              textClassName="text-danger"
              iconColor={theme.danger}
              onPress={() => ask("Delete quotation?", `${q.quotationNumber} will be deleted. This can't be undone.`, "Delete", async () => {
                const ok = await runAction(del(q._id), "Quotation deleted", "Couldn't delete the quotation");
                if (ok) backTo("/quotations");
                return ok;
              }, true)}
            />
          )}
        </View>
      )}

      <History quotation={q} selection={selection} onSelect={setPicked} />

      {(act.archive || act.restore) && (
        <Button
          title={act.restore ? "Restore quotation" : "Archive quotation"}
          icon={act.restore ? ArchiveRestore : Archive}
          variant="ghost"
          onPress={() =>
            ask(
              act.restore ? "Restore quotation?" : "Archive quotation?",
              act.restore ? "It can be revised and sent again." : "It's hidden from the list. Its versions and PDFs stay available.",
              act.restore ? "Restore" : "Archive",
              () => runAction(setArchive({ id: q._id, baseVersion: q.latestVersion, archived: !act.restore }), act.restore ? "Quotation restored" : "Quotation archived", "Couldn't update the quotation"),
            )
          }
        />
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
    </>
  );
}

export default function QuotationDetail() {
  const { id } = useLocalSearchParams();
  const { data, isLoading, isError, refetch } = useGetQuotationByIdQuery(id);
  const refreshControl = usePullRefresh(refetch);
  const quotation = data?.data?.quotation;
  return (
    <Screen scroll className="gap-5 pt-2" refreshControl={refreshControl}>
      {quotation ? (
        <QuotationBody key={quotation._id} quotation={quotation} refetch={refetch} />
      ) : (
        <>
          <PageHeader caption="QUOTATION" title="" fallback="/quotations" />
          <DashboardState isLoading={isLoading} isError={isError || (!isLoading && !quotation)} refetch={refetch} />
        </>
      )}
    </Screen>
  );
}
