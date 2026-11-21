import { Alert, QuotationForm, Screen, SheetHeader } from "@/components";
import { useCreateQuotationMutation } from "@/services/quotationApi";
import { apiError } from "@/utils/apiError";
import { runAction } from "@/utils/attendance";
import { getFieldError } from "@/utils/getFieldError";
import { router } from "expo-router";
import { Platform } from "react-native";

// Create quotation, same form as the web: it starts as a working draft; nothing is sent until a version is saved and sent.
export default function NewQuotation() {
  const [create, c] = useCreateQuotationMutation();
  const { message, fieldErrors } = apiError(c.error);

  const save = async (body) => {
    const res = await runAction(create(body), "Quotation draft created", "Couldn't create the quotation");
    const id = res?.data?.quotation?._id;
    if (id) router.replace(`/quotations/${id}`);
  };

  return (
    <Screen scroll edges={Platform.OS === "android" ? ["top", "bottom"] : ["bottom"]} className="gap-5 pt-6">
      <SheetHeader title="Create quotation" sub="Choose a client, review the suggested template, then edit each page. Nothing is sent until you approve the draft." closeLabel="Cancel" />
      <Alert message={fieldErrors.length ? "" : message} />
      <QuotationForm onSubmit={save} submitLabel="Create quotation" loading={c.isLoading} fieldError={(k) => getFieldError(fieldErrors, k)} />
    </Screen>
  );
}
