import { Alert, Button, DashboardState, EmptyState, InvoiceForm, Screen, SheetHeader, backTo, showToast } from "@/components";
import { useCreateInvoiceMutation, useGetInvoiceByIdQuery, useGetInvoicesQuery, useUpdateInvoiceMutation } from "@/services/invoiceApi";
import { useGetQuotationByIdQuery, useGetQuotationRevisionQuery } from "@/services/quotationApi";
import { apiError } from "@/utils/apiError";
import { runAction } from "@/utils/attendance";
import { getFieldError } from "@/utils/getFieldError";
import { fromQuotation } from "@/utils/invoices";
import { isVersioned } from "@/utils/quotations";
import { router, useLocalSearchParams } from "expo-router";
import { FileWarning } from "lucide-react-native";
import { Platform } from "react-native";

const fieldErr = (fieldErrors) => (k) => getFieldError(fieldErrors, k);

function CreateInvoice({ prefill, quotationId }) {
  const [create, c] = useCreateInvoiceMutation();
  const { message, fieldErrors } = apiError(c.error);
  const existing = useGetInvoicesQuery({ sourceQuotation: quotationId, limit: 1 }, { skip: !quotationId });

  const save = async (body) => {
    try {
      const res = await create(body).unwrap();
      showToast({ title: quotationId ? "Invoice draft created. Review it before sending." : "Invoice created" });
      router.replace(`/invoices/${res.data.invoice._id}`);
    } catch (e) {
      // Same as the web: a quotation that already has an invoice opens that invoice instead.
      if (e?.status === 409 && quotationId) {
        const found = (await existing.refetch()).data?.data?.[0];
        if (found) {
          showToast({ title: "This quotation already has an invoice. Opening it now." });
          return router.replace(`/invoices/${found._id}`);
        }
      }
      showToast({ title: "Couldn't create the invoice", message: apiError(e).message });
    }
  };

  return (
    <>
      <SheetHeader
        title={quotationId ? "Review invoice from quotation" : "Create invoice"}
        sub={quotationId ? "Prefilled from the quotation. Check the items and dates, then create the draft." : "It starts as a draft; nothing is emailed until you send it."}
        closeLabel="Cancel"
      />
      <Alert message={fieldErrors.length ? "" : message} />
      <InvoiceForm
        initial={prefill}
        lockIdentity={!!quotationId}
        onSubmit={save}
        submitLabel={quotationId ? "Confirm & create draft invoice" : "Create invoice"}
        loading={c.isLoading}
        fieldError={fieldErr(fieldErrors)}
      />
    </>
  );
}

function EditInvoice({ invoice }) {
  const [update, u] = useUpdateInvoiceMutation();
  const { message, fieldErrors } = apiError(u.error);
  const save = async (body) => {
    if (await runAction(update({ id: invoice._id, ...body }), "Invoice updated", "Couldn't update the invoice")) backTo(`/invoices/${invoice._id}`);
  };
  return (
    <>
      <SheetHeader title="Edit invoice" sub={`${invoice.invoiceNumber} · draft`} closeLabel="Cancel" />
      <Alert message={fieldErrors.length ? "" : message} />
      <InvoiceForm initial={invoice} onSubmit={save} submitLabel="Update invoice" loading={u.isLoading} fieldError={fieldErr(fieldErrors)} />
    </>
  );
}

// From a quotation: same checks as the web InvoiceCreate (archived, no saved version, already invoiced), then the prefilled form.
function FromQuotation({ quotationId, version }) {
  const qQ = useGetQuotationByIdQuery(quotationId);
  const q = qQ.data?.data?.quotation;
  const versioned = isVersioned(q);
  const v = version ? Number(version) : versioned ? q?.latestVersion : null;
  const revQ = useGetQuotationRevisionQuery({ id: quotationId, version: v }, { skip: !q || !versioned || !v });
  const revision = revQ.data?.data?.revision;
  const existing = useGetInvoicesQuery({ sourceQuotation: quotationId, limit: 1 });
  const already = existing.data?.data?.[0];

  if (qQ.isLoading || existing.isLoading || revQ.isLoading) return <DashboardState isLoading />;
  if (qQ.isError || !q) return <DashboardState isError refetch={qQ.refetch} />;
  if (already) {
    return (
      <EmptyState icon={FileWarning} title="Invoice already created" message={`${already.invoiceNumber} was made from this quotation. One quotation can have one invoice.`} actionTitle="Open invoice" onAction={() => router.replace(`/invoices/${already._id}`)} />
    );
  }
  const problem = q.archivedAt ? "Archived quotations cannot be invoiced." : versioned && !v ? "Cannot invoice a working draft. Save a quotation version first." : versioned && !revision ? "Couldn't load that quotation version." : "";
  if (problem) {
    return <EmptyState icon={FileWarning} title="Quotation cannot be invoiced" message={problem} actionTitle="Back to quotation" onAction={() => backTo(`/quotations/${quotationId}`)} />;
  }
  return <CreateInvoice prefill={fromQuotation(q, versioned ? revision : null)} quotationId={quotationId} />;
}

// /invoices/new: blank invoice; ?id= edits a draft; ?quotationId=&version= reviews an invoice from a quotation version.
export default function NewInvoice() {
  const { id, quotationId, version } = useLocalSearchParams();
  const edit = useGetInvoiceByIdQuery(id, { skip: !id });
  const invoice = edit.data?.data?.invoice;
  return (
    <Screen scroll edges={Platform.OS === "android" ? ["top", "bottom"] : ["bottom"]} className="gap-5 pt-6">
      {quotationId ? (
        <FromQuotation quotationId={quotationId} version={version} />
      ) : !id ? (
        <CreateInvoice />
      ) : invoice ? (
        invoice.status === "draft" ? (
          <EditInvoice key={invoice._id} invoice={invoice} />
        ) : (
          <>
            <EmptyState icon={FileWarning} title="Only drafts can be edited" message="This invoice has been sent or paid, so its items and totals are fixed." />
            <Button title="Back to invoice" variant="secondary" onPress={() => backTo(`/invoices/${invoice._id}`)} />
          </>
        )
      ) : (
        <DashboardState isLoading={edit.isLoading} isError={edit.isError || !edit.isLoading} refetch={edit.refetch} />
      )}
    </Screen>
  );
}
