import {
  Avatar,
  Badge,
  BrandMark,
  Button,
  Card,
  Chip,
  ClientStatusBadge,
  ConfirmDialog,
  DashboardState,
  PageHeader,
  Pressable,
  Screen,
  Text,
  backTo,
  brandLabel,
  clientAccess,
  contactClient,
  showToast,
  usePullRefresh,
} from "@/components";
import { CLIENT_STATUS } from "@/constants";
import { useTheme } from "@/constants/theme";
import {
  useDeleteClientMutation,
  useGetClientByIdQuery,
  useUpdateClientMutation,
} from "@/services/clientApi";
import { runAction } from "@/utils/attendance";
import { addressOf, hasAddress } from "@/utils/clients";
import * as Clipboard from "expo-clipboard";
import { router, useLocalSearchParams } from "expo-router";
import {
  Calendar,
  Copy,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  Trash2,
} from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import { useSelector } from "react-redux";

const Label = ({ children }) => (
  <Text className="text-caption text-muted">{children}</Text>
);
const day = (d) =>
  new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
const roleName = {
  super_admin: "Super admin",
  admin: "Admin",
  manager: "Manager",
  employee: "Employee",
};

function Field({ label, value, mono }) {
  if (!value) return null;
  return (
    <View className="flex-row gap-3">
      <Text className="w-28 text-sm text-muted">{label}</Text>
      <Text
        className={
          mono
            ? "flex-1 font-body-semibold text-sm tabular-nums"
            : "flex-1 text-sm"
        }
        selectable
      >
        {value}
      </Text>
    </View>
  );
}

function ClientBody({ client: c }) {
  const theme = useTheme();
  const me = useSelector((s) => s.auth.user);
  const can = clientAccess(me);
  const [update, u] = useUpdateClientMutation();
  const [del, d] = useDeleteClientMutation();
  const [confirming, setConfirming] = useState(false);
  const address = addressOf(c.address);
  const notes = [...(c.notes || [])].reverse();
  const edit = () =>
    router.push({ pathname: "/clients/new", params: { id: c._id } });

  const copyId = async () => {
    await Clipboard.setStringAsync(c.clientId);
    showToast({ title: "Client ID copied" });
  };
  const setStatus = (status) => {
    if (status === c.status || u.isLoading) return;
    runAction(
      update({ id: c._id, status }),
      `Marked ${status}`,
      "Couldn't update the status",
    );
  };

  return (
    <>
      <PageHeader
        caption={c.brand ? brandLabel(c.brand).toUpperCase() : "CLIENT"}
        title={c.companyName}
        fallback="/clients"
        right={
          can.manage ? (
            <Pressable
              onPress={edit}
              accessibilityLabel="Edit client"
              className="h-11 flex-row items-center gap-1.5 rounded-full bg-surface-2 px-4"
            >
              <Pencil size={16} color={theme.ink} />
              <Text className="font-body-semibold text-sm">Edit</Text>
            </Pressable>
          ) : null
        }
      />

      <View className="flex-row flex-wrap items-center gap-2">
        <ClientStatusBadge status={c.status} />
        {!!c.convertedFrom && (
          <Badge label="Converted from lead" variant="info" />
        )}
      </View>

      <Card className="gap-3 p-4">
        <View className="flex-row items-center gap-3">
          <Avatar name={c.companyName} size={44} />
          <View className="flex-1">
            <Text className="font-body-semibold">{c.contactPerson}</Text>
            <Text className="text-sm text-muted">
              Point of contact · since {day(c.createdAt)}
            </Text>
          </View>
          {!!c.brand && <BrandMark brand={c.brand} size={36} />}
        </View>
        {c.clientId ? (
          <Pressable
            onPress={copyId}
            accessibilityLabel={`Client ID ${c.clientId}. Copy`}
            className="flex-row items-center gap-3"
          >
            <Text className="w-28 text-sm text-muted">Client ID</Text>
            <Text className="flex-1 font-body-semibold text-sm tabular-nums">
              {c.clientId}
            </Text>
            <Copy size={16} color={theme["accent-ink"]} />
          </Pressable>
        ) : (
          <Field label="Client ID" value="Not assigned" />
        )}
        <Field label="Email" value={c.email} />
        <Field label="Phone" value={c.phone || "Not provided"} />
      </Card>

      <View className="flex-row gap-2">
        {!!c.phone && (
          <Button
            title="Call"
            icon={Phone}
            size="sm"
            variant="secondary"
            className="flex-1"
            onPress={() => contactClient(c, "call")}
          />
        )}
        {!!c.phone && (
          <Button
            title="WhatsApp"
            icon={MessageCircle}
            size="sm"
            variant="secondary"
            className="flex-1"
            onPress={() => contactClient(c, "whatsapp")}
          />
        )}
        {!!c.email && (
          <Button
            title="Email"
            icon={Mail}
            size="sm"
            variant="secondary"
            className="flex-1"
            onPress={() => contactClient(c, "email")}
          />
        )}
      </View>

      {can.manage && (
        <View className="gap-2">
          <Label>ACCOUNT STATUS</Label>
          <View className="flex-row gap-2">
            {CLIENT_STATUS.map((s) => (
              <Chip
                key={s.value}
                label={s.label}
                active={c.status === s.value}
                onPress={() => setStatus(s.value)}
              />
            ))}
          </View>
        </View>
      )}
      {can.meet && (
        <Button
          title="Schedule meeting"
          icon={Calendar}
          size="sm"
          variant="secondary"
          onPress={() =>
            router.push({
              pathname: "/meetings/new",
              params: { client: c._id },
            })
          }
        />
      )}

      <Card className="gap-3 p-4">
        <Label>TAX & BUSINESS IDENTIFIERS</Label>
        <Field label="GSTIN" value={c.gstNumber || "Not registered"} mono />
        <Field label="PAN" value={c.panNumber || "Not provided"} mono />
        <Field label="Venture" value={brandLabel(c.brand) || "—"} />
      </Card>

      <Card className="gap-3 p-4">
        <Label>REGISTERED OFFICE</Label>
        {hasAddress(address) ? (
          <>
            <Field label="Street" value={address.street} />
            <Field label="City" value={address.city} />
            <Field label="State" value={address.state} />
            <Field label="PIN" value={address.pincode} mono />
            <Field label="Country" value={address.country || "India"} />
          </>
        ) : (
          <View className="items-center gap-2 py-3">
            <MapPin size={24} color={theme.muted} />
            <Text className="text-sm text-muted">No address recorded</Text>
            {can.manage && (
              <Button
                title="Add address"
                size="sm"
                variant="ghost"
                onPress={edit}
              />
            )}
          </View>
        )}
      </Card>

      <View className="gap-3">
        <Label>NOTES & ACTIVITY · {notes.length}</Label>
        {notes.map((x, n) => (
          <View key={x._id || n} className="flex-row gap-3">
            <Avatar
              name={x.createdBy?.name || "?"}
              uri={x.createdBy?.avatar}
              size={32}
            />
            <View className="flex-1 gap-0.5">
              <Text className="text-sm">
                <Text className="font-body-semibold text-sm">
                  {x.createdBy?.name || "Team member"}
                </Text>
                <Text className="text-sm text-muted">
                  {x.createdBy?.role
                    ? ` · ${roleName[x.createdBy.role] || x.createdBy.role}`
                    : ""}{" "}
                  · {day(x.createdAt)}
                </Text>
              </Text>
              <Text selectable>{x.text}</Text>
            </View>
          </View>
        ))}
        {!notes.length && (
          <Text className="text-sm text-muted">No notes recorded yet.</Text>
        )}
      </View>

      {can.remove && (
        <>
          <Button
            title="Delete client"
            icon={Trash2}
            variant="ghost"
            className="bg-danger/10"
            textClassName="text-danger"
            iconColor={theme.danger}
            onPress={() => setConfirming(true)}
          />
          <ConfirmDialog
            visible={confirming}
            title="Delete client account?"
            message={`"${c.companyName}" will be permanently deleted.`}
            confirmLabel="Delete"
            loading={d.isLoading}
            onCancel={() => setConfirming(false)}
            onConfirm={async () => {
              const ok = await runAction(
                del(c._id),
                "Client deleted",
                "Couldn't delete the client",
              );
              setConfirming(false);
              if (ok) backTo("/clients");
            }}
          />
        </>
      )}
    </>
  );
}

export default function ClientDetail() {
  const { id } = useLocalSearchParams();
  const { data, isLoading, isError, refetch } = useGetClientByIdQuery(id);
  const refreshControl = usePullRefresh(refetch);
  const client = data?.data?.client;
  return (
    <Screen scroll className="gap-5 pt-2" refreshControl={refreshControl}>
      {client ? (
        <ClientBody key={client._id} client={client} />
      ) : (
        <>
          <PageHeader caption="CLIENT" title="" fallback="/clients" />
          <DashboardState
            isLoading={isLoading}
            isError={isError || (!isLoading && !client)}
            refetch={refetch}
          />
        </>
      )}
    </Screen>
  );
}
