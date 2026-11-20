import {
  Alert,
  Button,
  Chip,
  DashboardState,
  Input,
  Screen,
  SheetHeader,
  Text,
  VentureChips,
  backTo,
} from "@/components";
import { CLIENT_STATUS } from "@/constants";
import {
  useCreateClientMutation,
  useGetClientByIdQuery,
  useUpdateClientMutation,
} from "@/services/clientApi";
import { apiError } from "@/utils/apiError";
import { runAction } from "@/utils/attendance";
import { EMAIL, GSTIN, PAN, addressOf, clientBody } from "@/utils/clients";
import { getFieldError } from "@/utils/getFieldError";
import { router, useLocalSearchParams } from "expo-router";
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

const initial = (c) => {
  const a = addressOf(c?.address);
  return {
    brand: c?.brand || "",
    companyName: c?.companyName || "",
    contactPerson: c?.contactPerson || "",
    email: c?.email || "",
    phone: c?.phone || "",
    status: c?.status || "active",
    gstNumber: c?.gstNumber || "",
    panNumber: c?.panNumber || "",
    street: a.street || "",
    city: a.city || "",
    state: a.state || "",
    pincode: a.pincode || "",
    country: a.country || "India",
    notes: "",
  };
};

// Same fields, labels and rules as the web ClientForm.
function ClientForm({ client }) {
  const editing = !!client;
  const [create, c] = useCreateClientMutation();
  const [update, u] = useUpdateClientMutation();
  const [f, setF] = useState(() => initial(client));
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const { message, fieldErrors } = apiError(c.error || u.error);
  const err = (k) => getFieldError(fieldErrors, k);

  const email = f.email.trim();
  const gst = f.gstNumber.trim();
  const pan = f.panNumber.trim();
  const badEmail = !!email && !EMAIL.test(email);
  const badGst = !!gst && !GSTIN.test(gst);
  const badPan = !!pan && !PAN.test(pan);
  const ready =
    f.brand &&
    f.companyName.trim().length >= 2 &&
    f.contactPerson.trim().length >= 2 &&
    EMAIL.test(email) &&
    !badGst &&
    !badPan;

  const save = async () => {
    const body = clientBody(f);
    if (editing) {
      if (
        await runAction(
          update({ id: client?._id, ...body }),
          "Client profile updated",
          "Couldn't update the client",
        )
      )
        backTo(`/clients/${client?._id}`);
      return;
    }
    const res = await runAction(
      create({ ...body, notes: f.notes.trim() || undefined }),
      "Client created",
      "Couldn't create the client",
    );
    const id = res?.data?.client?._id;
    if (id) router.replace(`/clients/${id}`);
    else if (res) backTo("/clients");
  };

  return (
    <>
      <SheetHeader
        title={editing ? "Edit Client" : "Create Client Account"}
        sub={
          editing
            ? client?.companyName
            : "Register a corporate or individual client profile with billing and portal access"
        }
        closeLabel="Cancel"
      />
      <Alert message={fieldErrors.length ? "" : message} />
      <Field label="Brand / Venture *">
        <VentureChips value={f.brand} onChange={set("brand")} noneLabel={null} />
        {!!err("brand") && (
          <Text className="text-sm text-danger">{err("brand")}</Text>
        )}
      </Field>
      <Input
        label="Company Name *"
        value={f.companyName}
        onChangeText={set("companyName")}
        placeholder="e.g. Acme Enterprises Ltd"
        autoCapitalize="words"
        maxLength={200}
        error={err("companyName")}
      />
      <Input
        label="Contact Person Name *"
        value={f.contactPerson}
        onChangeText={set("contactPerson")}
        placeholder="e.g. John Doe"
        autoCapitalize="words"
        autoComplete="name"
        maxLength={100}
        error={err("contactPerson")}
      />
      <Input
        label="Work Email Address *"
        value={f.email}
        onChangeText={set("email")}
        placeholder="john@company.com"
        keyboardType="email-address"
        autoComplete="email"
        autoCapitalize="none"
        autoCorrect={false}
        error={badEmail ? "Enter a valid email" : err("email")}
      />
      <Input
        label="Phone Number"
        value={f.phone}
        onChangeText={set("phone")}
        placeholder="98765 43210"
        keyboardType="phone-pad"
        autoComplete="tel"
        error={err("phone")}
      />
      <Field label="Account Status">
        <View className="flex-row gap-2">
          {CLIENT_STATUS.map((s) => (
            <Chip
              key={s.value}
              label={s.label}
              active={f.status === s.value}
              onPress={() => set("status")(s.value)}
            />
          ))}
        </View>
      </Field>
      <Input
        label="GST Identification Number (GSTIN)"
        value={f.gstNumber}
        onChangeText={(v) => set("gstNumber")(v.toUpperCase())}
        placeholder="22AAAAA0000A1Z5"
        maxLength={15}
        autoCapitalize="characters"
        autoCorrect={false}
        hint="15-character alphanumeric GSTIN"
        error={
          badGst ? "Invalid GST number format (e.g. 22AAAAA0000A1Z5)" : err("gstNumber")
        }
      />
      <Input
        label="PAN Number"
        value={f.panNumber}
        onChangeText={(v) => set("panNumber")(v.toUpperCase())}
        placeholder="ABCDE1234F"
        maxLength={10}
        autoCapitalize="characters"
        autoCorrect={false}
        hint="10-character Permanent Account Number"
        error={
          badPan ? "Invalid PAN number format (e.g. ABCDE1234F)" : err("panNumber")
        }
      />

      <Text className="text-caption text-muted">REGISTERED ADDRESS</Text>
      <Input
        label="Street / Office Address"
        value={f.street}
        onChangeText={set("street")}
        placeholder="Suite, building number, street, locality"
        maxLength={1000}
        error={err("address.street")}
      />
      <Input
        label="City"
        value={f.city}
        onChangeText={set("city")}
        placeholder="e.g. Mumbai"
        autoCapitalize="words"
        maxLength={200}
        error={err("address.city")}
      />
      <Input
        label="State / Province"
        value={f.state}
        onChangeText={set("state")}
        placeholder="e.g. Maharashtra"
        autoCapitalize="words"
        maxLength={200}
        error={err("address.state")}
      />
      <Input
        label="Postal Code / PIN"
        value={f.pincode}
        onChangeText={set("pincode")}
        placeholder="e.g. 400001"
        keyboardType="number-pad"
        maxLength={100}
        error={err("address.pincode")}
      />
      <Input
        label="Country"
        value={f.country}
        onChangeText={set("country")}
        placeholder="India"
        autoCapitalize="words"
        maxLength={200}
        error={err("address.country")}
      />
      {!editing && (
        <Input
          label="Initial Account Notes"
          value={f.notes}
          onChangeText={set("notes")}
          placeholder="Add context on key stakeholders, deal origins, or billing agreements..."
          multiline
          maxLength={2000}
          style={textArea}
          error={err("notes")}
        />
      )}
      <Button
        title={editing ? "Update Client Profile" : "Create Client Account"}
        loading={c.isLoading || u.isLoading}
        disabled={!ready}
        onPress={save}
      />
    </>
  );
}

// Create, or edit with ?id=. Android shows modals full screen under the status bar, so it needs the top inset; iOS sheets don't.
export default function NewClient() {
  const { id } = useLocalSearchParams();
  const { data, isLoading, isError, refetch } = useGetClientByIdQuery(id, {
    skip: !id,
  });
  const client = data?.data?.client;
  return (
    <Screen
      scroll
      edges={Platform.OS === "android" ? ["top", "bottom"] : ["bottom"]}
      className="gap-5 pt-6"
    >
      {!id || client ? (
        <ClientForm key={client?._id || "new"} client={client} />
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
