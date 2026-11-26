import {
  Alert,
  Avatar,
  Button,
  Chip,
  DashboardState,
  Input,
  Screen,
  SheetHeader,
  Text,
  VentureChips,
  backTo,
  showToast,
} from "@/components";
import { LEAD_SOURCES, LEAD_STATUS } from "@/constants";
import {
  useCreateLeadMutation,
  useGetLeadByIdQuery,
  useUpdateLeadMutation,
} from "@/services/leadApi";
import { useGetUsersQuery } from "@/services/userApi";
import { apiError } from "@/utils/apiError";
import { runAction } from "@/utils/attendance";
import { getFieldError } from "@/utils/getFieldError";
import { LEAD_ASSIGNEE_EMAIL } from "@/utils/leads";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Platform, ScrollView, View } from "react-native";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const textArea = { height: 96, paddingTop: 14, textAlignVertical: "top" };

function Field({ label, children }) {
  return (
    <View className="gap-1.5">
      <Text className="font-body-medium text-sm">{label}</Text>
      {children}
    </View>
  );
}

const chipRow = (items) => (
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    className="-mx-5"
    contentContainerClassName="gap-2 px-5"
  >
    {items}
  </ScrollView>
);

// shortcut: every lead goes to Palak Gupta, as on the web; swap for a UserPicker when sales grows.
function usePalak() {
  const { data, isLoading, isError } = useGetUsersQuery({
    limit: 100,
    search: LEAD_ASSIGNEE_EMAIL,
  });
  const user = (data?.data?.users || []).find(
    (u) =>
      u.role !== "client" &&
      u.isActive !== false &&
      u.email?.toLowerCase() === LEAD_ASSIGNEE_EMAIL,
  );
  return {
    user,
    isLoading,
    error: isError
      ? "Couldn't load Palak Gupta. Try again."
      : !isLoading && !user
        ? "Palak Gupta's active account wasn't found."
        : "",
  };
}

// Same fields, labels and rules as the web LeadForm.
function LeadForm({ lead }) {
  const editing = !!lead;
  const palak = usePalak();
  const [create, c] = useCreateLeadMutation();
  const [update, u] = useUpdateLeadMutation();
  const [name, setName] = useState(lead?.name || "");
  const [email, setEmail] = useState(lead?.email || "");
  const [phone, setPhone] = useState(lead?.phone || "");
  const [brand, setBrand] = useState(lead?.brand || "");
  const [company, setCompany] = useState(lead?.company || "");
  const [source, setSource] = useState(lead?.source || "other");
  const [status, setStatus] = useState(lead?.status || "new");
  const [lostReason, setLostReason] = useState(lead?.lostReason || "");
  const [note, setNote] = useState("");
  const { message, fieldErrors } = apiError(c.error || u.error);
  const err = (k) => getFieldError(fieldErrors, k);
  const lostBlocked = !editing || lead?.status === "new"; // must be contacted first
  const badEmail = !!email.trim() && !EMAIL.test(email.trim());
  const ready =
    name.trim().length >= 2 &&
    EMAIL.test(email.trim()) &&
    phone.trim() &&
    palak.user &&
    (status !== "lost" || lostReason.trim());

  const pickStatus = (s) => {
    if (s === "lost" && lostBlocked)
      return showToast({
        title: "Contact the lead first",
        message: "A new lead can't be marked lost.",
      });
    setStatus(s);
  };

  const save = async () => {
    const body = {
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      brand: brand || undefined, // the server rejects '' for venture
      company: company.trim() || undefined,
      source,
      status,
      assignedTo: palak.user?._id,
      lostReason: status === "lost" ? lostReason.trim() : undefined,
    };
    if (editing) {
      if (
        await runAction(
          update({ id: lead?._id, ...body }),
          "Lead updated",
          "Couldn't update the lead",
        )
      )
        backTo(`/leads/${lead?._id}`);
      return;
    }
    const res = await runAction(
      create({
        ...body,
        notes: note.trim() ? [{ text: note.trim() }] : undefined,
      }),
      "Lead created",
      "Couldn't create the lead",
    );
    const id = res?.data?.lead?._id;
    if (id) router.replace(`/leads/${id}`);
    else if (res) backTo("/leads");
  };

  return (
    <>
      <SheetHeader
        title={editing ? "Edit Lead" : "Create New Lead"}
        sub={
          editing
            ? lead?.name
            : "Record a new prospective client or business inquiry in your pipeline"
        }
        closeLabel="Cancel"
      />
      <Alert message={fieldErrors.length ? "" : message} />
      <Input
        label="Full Name *"
        value={name}
        onChangeText={setName}
        placeholder="e.g. John Doe"
        autoCapitalize="words"
        autoComplete="name"
        maxLength={200}
        error={err("name")}
      />
      <Input
        label="Email Address *"
        value={email}
        onChangeText={setEmail}
        placeholder="john@example.com"
        keyboardType="email-address"
        autoComplete="email"
        autoCapitalize="none"
        autoCorrect={false}
        error={badEmail ? "Enter a valid email" : err("email")}
      />
      <Input
        label="Phone Number *"
        value={phone}
        onChangeText={setPhone}
        placeholder="98765 43210"
        keyboardType="phone-pad"
        autoComplete="tel"
        error={err("phone")}
      />
      <Input
        label="Company / Organization"
        value={company}
        onChangeText={setCompany}
        placeholder="e.g. Acme Corp"
        autoCapitalize="words"
        maxLength={200}
        error={err("company")}
      />
      <Field label="Company Brand / Venture">
        <VentureChips
          value={brand}
          onChange={setBrand}
          noneLabel="No venture"
        />
      </Field>

      <Field label="Lead Source">
        {chipRow(
          LEAD_SOURCES.map((s) => (
            <Chip
              key={s.value}
              label={s.label}
              active={source === s.value}
              onPress={() => setSource(s.value)}
            />
          )),
        )}
      </Field>
      {/* New leads always start as "new"; the stage is only changed when editing. */}
      {editing && <Field label="Pipeline Stage">
        {chipRow(
          LEAD_STATUS.map((s) => (
            <Chip
              key={s.value}
              label={
                s.value === "lost" && lostBlocked
                  ? `${s.label} (Contact first)`
                  : s.label
              }
              active={status === s.value}
              onPress={() => pickStatus(s.value)}
            />
          )),
        )}
      </Field>}

      <Field label="Assigned Representative">
        <View className="flex-row items-center gap-3 rounded-2xl bg-surface-2 px-4 py-3">
          <Avatar
            name={palak.user?.name || "Palak Gupta"}
            uri={palak.user?.avatar}
            size={32}
          />
          <Text className="flex-1 font-body-medium">
            {palak.isLoading
              ? "Loading representative…"
              : palak.user?.name || "Palak Gupta"}
          </Text>
        </View>
        {!!(palak.error || err("assignedTo")) && (
          <Text className="text-sm text-danger">
            {palak.error || err("assignedTo")}
          </Text>
        )}
      </Field>

      {status === "lost" && (
        <Input
          label="Lost Reason *"
          value={lostReason}
          onChangeText={setLostReason}
          placeholder="Why was this opportunity lost? (e.g. Price too high, chosen competitor...)"
          multiline
          maxLength={500}
          style={textArea}
          error={err("lostReason")}
        />
      )}
      {!editing && (
        <Input
          label="Notes"
          value={note}
          onChangeText={setNote}
          placeholder="Add requirement notes, budget expectations, or discussion summaries..."
          multiline
          maxLength={2000}
          style={textArea}
          error={err("notes")}
        />
      )}
      <Button
        title={editing ? "Update Lead" : "Create Lead"}
        loading={c.isLoading || u.isLoading}
        disabled={!ready}
        onPress={save}
      />
    </>
  );
}

// Create, or edit with ?id=. Android shows modals full screen under the status bar, so it needs the top inset; iOS sheets don't.
export default function NewLead() {
  const { id } = useLocalSearchParams();
  const { data, isLoading, isError, refetch } = useGetLeadByIdQuery(id, {
    skip: !id,
  });
  const lead = data?.data?.lead;
  return (
    <Screen
      scroll
      edges={Platform.OS === "android" ? ["top", "bottom"] : ["bottom"]}
      className="gap-5 pt-6"
    >
      {!id || lead ? (
        <LeadForm key={lead?._id || "new"} lead={lead} />
      ) : (
        <DashboardState
          isLoading={isLoading}
          isError={isError || !isLoading}
          refetch={refetch}
        />
      )}
    </Screen>
  );
}
