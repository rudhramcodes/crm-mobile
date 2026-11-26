import {
  Alert,
  Button,
  Chip,
  DashboardState,
  DateField,
  EmptyState,
  Input,
  PasswordInput,
  PasswordRules,
  Screen,
  SheetHeader,
  Text,
  Toggle,
  backTo,
} from "@/components";
import { LOCATIONS, ROLE_LABELS } from "@/constants";
import { useCreateUserMutation, useGetUserByIdQuery, useUpdateUserMutation } from "@/services/userApi";
import { canAccessPayroll } from "@/utils/access";
import { apiError } from "@/utils/apiError";
import { runAction } from "@/utils/attendance";
import { getFieldError } from "@/utils/getFieldError";
import { isStaffRole, userBody, userForm, userFormError } from "@/utils/users";
import { useLocalSearchParams } from "expo-router";
import { Lock } from "lucide-react-native";
import { useState } from "react";
import { Platform, View } from "react-native";
import { useSelector } from "react-redux";

// The existing Super Admin is the only one, so it can't be picked (the server refuses it too).
const CREATABLE = Object.keys(ROLE_LABELS).filter((r) => r !== "super_admin");

const Section = ({ title, hint, right }) => (
  <View className="gap-1 border-t border-line pt-4">
    <View className="flex-row items-center justify-between gap-2">
      <Text className="text-caption text-muted">{title}</Text>
      {right}
    </View>
    {!!hint && <Text className="text-xs text-muted">{hint}</Text>}
  </View>
);

// Same sections, fields and rules as the web UserFormModal, plus an Active switch on edit.
function UserForm({ user, location }) {
  const editing = !!user;
  const me = useSelector((s) => s.auth.user);
  const payroll = canAccessPayroll(me);
  const [create, c] = useCreateUserMutation();
  const [update, u] = useUpdateUserMutation();
  const [f, setF] = useState(() => ({ ...userForm(user), ...(!user && location && { location }) }));
  const [error, setError] = useState("");
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const { message, fieldErrors } = apiError(c.error || u.error);
  const err = (k) => getFieldError(fieldErrors, k);
  const staff = isStaffRole(f.role);
  const roles = user?.role === "super_admin" ? ["super_admin"] : CREATABLE;
  const canDeactivate = editing && user?.role !== "super_admin" && user?._id !== me?._id;

  const save = async () => {
    const problem = userFormError(f, editing);
    setError(problem);
    if (problem) return;
    const body = userBody(f, { editing, payroll });
    const res = editing
      ? await runAction(update({ id: user?._id, ...body }), "User updated", "Failed to save user")
      : await runAction(create(body), "User created", "Failed to save user");
    if (res) backTo("/users");
  };

  return (
    <>
      <SheetHeader
        title={editing ? "Edit person" : "Create person"}
        sub={editing ? "Update access and employment details." : "A staff employee ID is generated automatically."}
        closeLabel="Cancel"
      />
      <Alert message={error || (fieldErrors.length ? "" : message)} />

      <Text className="text-caption text-muted">ACCOUNT</Text>
      <Input label="Name" placeholder="e.g. Asha Patel" value={f.name} onChangeText={set("name")} autoCapitalize="words" autoComplete="name" maxLength={100} error={err("name")} />
      <Input
        label="Email"
        placeholder="name@rudhramenterprises.com"
        value={f.email}
        onChangeText={set("email")}
        keyboardType="email-address"
        autoComplete="email"
        autoCapitalize="none"
        autoCorrect={false}
        error={err("email")}
      />
      {/* Create only: the update endpoint doesn't change passwords (people use "Forgot password"). */}
      {!editing && (
        <View className="gap-3">
          <PasswordInput label="Password" placeholder="Create a strong password" value={f.password} onChangeText={set("password")} autoComplete="new-password" error={err("password")} />
          <PasswordRules value={f.password} />
        </View>
      )}
      <Input label="Phone" placeholder="98765 43210" value={f.phone} onChangeText={set("phone")} keyboardType="phone-pad" autoComplete="tel" error={err("phone")} />
      <View className="gap-1.5">
        <Text className="font-body-medium text-sm">Role</Text>
        <View className="flex-row flex-wrap gap-2">
          {roles.map((r) => (
            <Chip key={r} label={ROLE_LABELS[r]} active={f.role === r} onPress={() => set("role")(r)} />
          ))}
        </View>
      </View>
      {f.role !== "client" && (
        <View className="gap-1.5">
          <Text className="font-body-medium text-sm">Location</Text>
          <View className="flex-row flex-wrap gap-2">
            {LOCATIONS.map((l) => (
              <Chip key={l} label={l} active={f.location === l} onPress={() => set("location")(f.location === l ? "" : l)} />
            ))}
          </View>
          {!!err("location") && <Text className="text-sm text-danger">{err("location")}</Text>}
        </View>
      )}
      {canDeactivate && (
        <View className="flex-row items-center gap-3">
          <View className="flex-1">
            <Text className="font-body-medium text-sm">Active</Text>
            <Text className="text-xs text-muted">Inactive people can&apos;t sign in. Use this instead of deleting someone with payroll history.</Text>
          </View>
          <Toggle value={f.isActive} onValueChange={set("isActive")} label="Active account" />
        </View>
      )}

      {staff && (
        <>
          <Section
            title="EMPLOYMENT"
            right={!!user?.profile?.employeeId && <Text className="font-body-medium text-xs tabular-nums text-muted">{user.profile.employeeId}</Text>}
          />
          <Input label="Designation" value={f.designation} onChangeText={set("designation")} placeholder="e.g. Video Editor" maxLength={100} error={err("designation")} />
          <DateField label="Date of joining" placeholder="Pick the first working day" value={f.dateOfJoining} onChange={set("dateOfJoining")} error={err("dateOfJoining")} />
          <DateField label="Date of leaving" value={f.dateOfLeaving} onChange={set("dateOfLeaving")} onClear={() => set("dateOfLeaving")("")} placeholder="Pick the last working day (optional)" />
          <Text className="-mt-3 text-xs text-muted">Optional. Use the last working day; that day is paid and later days are prorated on a 30-day basis.</Text>
        </>
      )}

      {staff && payroll && (
        <>
          <Section title="COMPENSATION" hint="Visible only to payroll admins. Missing salary or bank details block finalization." />
          <Input
            label="Monthly gross salary"
            value={f.monthlyGrossSalary}
            onChangeText={(v) => set("monthlyGrossSalary")(v.replace(/[^0-9.]/g, ""))}
            placeholder="e.g. 35000"
            keyboardType="decimal-pad"
            error={err("monthlyGrossSalary")}
          />
          <DateField label="Salary effective from" placeholder="Pick the date this salary starts" value={f.salaryEffectiveFrom} onChange={set("salaryEffectiveFrom")} onClear={() => set("salaryEffectiveFrom")("")} />
          <Input label="Bank name" value={f.bankName} onChangeText={set("bankName")} placeholder="e.g. HDFC Bank" maxLength={100} error={err("bankName")} />
          <Input label="Bank account number" placeholder="e.g. 50100123456789" value={f.bankAccountNumber} onChangeText={set("bankAccountNumber")} keyboardType="number-pad" maxLength={40} error={err("bankAccountNumber")} />
          <Input
            label="IFSC code"
            placeholder="e.g. HDFC0001234"
            value={f.ifscCode}
            onChangeText={(v) => set("ifscCode")(v.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={20}
            error={err("ifscCode")}
          />
        </>
      )}

      <Button title={editing ? "Update" : "Create User"} loading={c.isLoading || u.isLoading} onPress={save} />
    </>
  );
}

// Create, or edit with ?id=. Android shows modals full screen under the status bar, so it needs the top inset; iOS sheets don't.
export default function NewUser() {
  const { id, location } = useLocalSearchParams();
  const me = useSelector((s) => s.auth.user);
  const { data, isLoading, isError, refetch } = useGetUserByIdQuery(id, { skip: !id });
  const user = data?.data?.user;
  // The Super Admin's record is theirs alone to edit (also enforced on the server).
  const locked = user?.role === "super_admin" && user._id !== me?._id;
  return (
    <Screen scroll edges={Platform.OS === "android" ? ["top", "bottom"] : ["bottom"]} className="gap-5 pt-6">
      {locked ? (
        <EmptyState icon={Lock} title="Only the Super Admin can edit this account" message="Ask them to update it from their own login." actionTitle="Go back" onAction={() => backTo("/users")} />
      ) : !id || user ? (
        <UserForm key={user?._id || "new"} user={user} location={LOCATIONS.includes(location) ? location : ""} />
      ) : (
        <DashboardState isLoading={isLoading} isError={isError || !isLoading} refetch={refetch} />
      )}
    </Screen>
  );
}
