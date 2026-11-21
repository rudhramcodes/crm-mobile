import { Alert, DashboardState, QuotationForm, Screen, SheetHeader, backTo } from "@/components";
import { useGetQuotationByIdQuery, useUpdateQuotationWorkingCopyMutation } from "@/services/quotationApi";
import { apiError } from "@/utils/apiError";
import { runAction } from "@/utils/attendance";
import { getFieldError } from "@/utils/getFieldError";
import { useLocalSearchParams } from "expo-router";
import { Platform } from "react-native";

// "Edit working draft", same form as the web with the client and project locked. Saves through the working copy
// with its version tokens, so an edit made on the web in the meantime is refused instead of overwritten.
function EditDraft({ quotation: q }) {
  const wc = q.workingCopy;
  const [update, u] = useUpdateQuotationWorkingCopyMutation();
  const { message, fieldErrors } = apiError(u.error);
  const err = (k) => getFieldError(fieldErrors, k) || getFieldError(fieldErrors, `changes.${k}`);

  const save = async (changes) => {
    const ok = await runAction(
      update({ id: q._id, baseVersion: wc?.baseVersion, editVersion: wc?.editVersion, changes }),
      "Working draft saved",
      "Couldn't save the draft",
    );
    if (ok) backTo(`/quotations/${q._id}`);
  };

  return (
    <>
      <SheetHeader title="Edit working draft" sub={`${q.quotationNumber} · not a saved version yet`} closeLabel="Cancel" />
      <Alert message={fieldErrors.length ? "" : message} />
      <QuotationForm
        initial={wc?.content}
        locked={{
          client: q.client?.companyName || "Client",
          project: q.project ? [q.project.projectCode, q.project.title].filter(Boolean).join(" — ") : "",
        }}
        onSubmit={save}
        submitLabel="Save working draft"
        loading={u.isLoading}
        fieldError={err}
      />
    </>
  );
}

// Android shows modals full screen under the status bar, so it needs the top inset; iOS sheets don't.
export default function EditQuotation() {
  const { id } = useLocalSearchParams();
  const { data, isLoading, isError, refetch } = useGetQuotationByIdQuery(id);
  const quotation = data?.data?.quotation;
  return (
    <Screen scroll edges={Platform.OS === "android" ? ["top", "bottom"] : ["bottom"]} className="gap-5 pt-6">
      {quotation?.workingCopy ? (
        <EditDraft key={`${quotation._id}-${quotation.workingCopy.editVersion}`} quotation={quotation} />
      ) : (
        <DashboardState isLoading={isLoading} isError={isError || !isLoading} refetch={refetch} />
      )}
    </Screen>
  );
}
