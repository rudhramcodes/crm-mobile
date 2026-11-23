import {
  Button,
  Chip,
  ClientRow,
  ConfirmDialog,
  DashboardState,
  EmptyState,
  Input,
  MiniStats,
  PageHeader,
  Pager,
  Screen,
  VentureChips,
  clientAccess,
  usePullRefresh,
} from "@/components";
import { CLIENT_STATUS } from "@/constants";
import { useTheme } from "@/constants/theme";
import {
  useDeleteClientMutation,
  useGetClientsQuery,
  useGetClientStatsQuery,
} from "@/services/clientApi";
import { isAdmin, runAction } from "@/utils/attendance";
import { cleanParams } from "@/utils/leads";
import { FlashList } from "@shopify/flash-list";
import { router } from "expo-router";
import { Download, Plus, Search, UserCheck } from "lucide-react-native";
import { useRef, useState } from "react";
import { useDebouncedSearch } from "@/hooks/useDebouncedSearch";
import { usePage, usePageNav } from "@/hooks/usePaged";
import { View } from "react-native";
import { useSelector } from "react-redux";

// Client directory: same as the web — active clients by default, search, venture switcher with counts, KPIs.
export default function Clients() {
  const theme = useTheme();
  const me = useSelector((s) => s.auth.user);
  const can = clientAccess(me);
  const [status, setStatus] = useState("active");
  const [brand, setBrand] = useState("");
  const { typed, setTyped, search, setSearch } = useDebouncedSearch();
  const [deleting, setDeleting] = useState(null);
  const [del, d] = useDeleteClientMutation();

  // Search as you type, once typing pauses.

  // 20 per page from the server, with Previous / Next under the list.
  const LIMIT = 20;
  const listRef = useRef(null);
  const filters = cleanParams({ search, status, brand });
  const [page, setPage] = usePage(JSON.stringify(filters));
  const q = useGetClientsQuery({ ...filters, page, limit: LIMIT });
  const statsQ = useGetClientStatsQuery();
  const stats = statsQ.data?.data;
  const refreshControl = usePullRefresh(() => {
    statsQ.refetch();
    return q.refetch();
  });
  const clients = q.data?.data || [];
  const meta = q.data?.pagination;
  const total = meta?.total ?? clients.length;
  const goTo = usePageNav(listRef, page, setPage, meta?.pages);
  const filtered = !!(search || brand || status !== "active");
  const active = stats ? stats.active || 0 : 0;

  const reset = () => {
    setTyped("");
    setSearch("");
    setBrand("");
    setStatus("active");
  };

  const header = (
    <View className="gap-4 pb-4 pt-2">
      <PageHeader
        caption={`${total} ${total === 1 ? "CLIENT" : "CLIENTS"}`}
        title="Clients"
        fallback="/more"
        right={
          <View className="flex-row gap-2">
            {isAdmin(me) && (
              <Button title="Save to contacts" icon={Download} size="sm" variant="secondary" accessibilityLabel="Save client contacts to this phone" onPress={() => router.push("/clients/save-contacts")} />
            )}
            {can.manage && (
              <Button
                title="New"
                icon={Plus}
                size="sm"
                onPress={() => router.push("/clients/new")}
              />
            )}
          </View>
        }
      />

      {!!stats && (
        <MiniStats
          items={[
            { label: "Active", value: active },
            {
              label: "Retention",
              value: `${stats.total ? Math.round((active / stats.total) * 100) : 100}%`,
            },
            {
              label: "Ventures",
              value: Object.keys(stats.byBrand || {}).length,
            },
          ]}
        />
      )}

      <Input
        value={typed}
        onChangeText={setTyped}
        onSubmitEditing={() => setSearch(typed.trim())}
        placeholder="Search company, contact, email, GST"
        accessibilityLabel="Search clients"
        returnKeyType="search"
        autoCorrect={false}
        right={
          <View className="h-11 w-11 items-center justify-center">
            <Search size={18} color={theme.muted} />
          </View>
        }
      />
      {/* Inactive clients are visible to super admins only, as on the web. */}
      {me?.role === "super_admin" && (
        <View className="flex-row gap-2">
          {CLIENT_STATUS.map((s) => (
            <Chip
              key={s.value}
              label={s.label}
              active={status === s.value}
              onPress={() => setStatus(s.value)}
            />
          ))}
        </View>
      )}
      <VentureChips
        value={brand}
        onChange={setBrand}
        counts={stats ? { "": active, ...stats.byBrand } : undefined}
      />
    </View>
  );

  const empty =
    q.isLoading || q.isError ? (
      <DashboardState isLoading={q.isLoading} isError={q.isError} refetch={q.refetch} />
    ) : (
      <EmptyState
        icon={UserCheck}
        title={filtered ? "No clients match" : "No clients yet"}
        message={
          filtered
            ? "Try another search or clear the filters."
            : "Create a client or convert a won lead."
        }
        actionTitle={
          filtered ? "Clear filters" : can.manage ? "Add client" : undefined
        }
        onAction={filtered ? reset : () => router.push("/clients/new")}
      />
    );

  return (
    <Screen className="px-0">
      <FlashList
        ref={listRef}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        data={clients}
        keyExtractor={(c) => c._id}
        renderItem={({ item }) => (
          <View className={q.isFetching ? "pb-2 opacity-50" : "pb-2"}>
            <ClientRow client={item} onDelete={can.remove ? setDeleting : undefined} />
          </View>
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={
          q.isError && clients.length ? (
            <Button title="Couldn't load this page. Try again" variant="ghost" size="sm" onPress={q.refetch} />
          ) : (
            <Pager page={page} pages={meta?.pages} total={total} limit={LIMIT} loading={q.isFetching} onChange={goTo} />
          )
        }
        refreshControl={refreshControl}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
      />

      <ConfirmDialog
        visible={!!deleting}
        title="Delete client profile?"
        message={`"${deleting?.companyName}" will be deleted. This can't be undone.`}
        confirmLabel="Delete client"
        loading={d.isLoading}
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          await runAction(
            del(deleting?._id),
            "Client deleted",
            "Couldn't delete the client",
          );
          setDeleting(null);
        }}
      />
    </Screen>
  );
}
