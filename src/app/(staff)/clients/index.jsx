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
  Screen,
  Skeleton,
  Text,
  VentureChips,
  clientAccess,
  usePullRefresh,
} from "@/components";
import { CLIENT_STATUS } from "@/constants";
import { useTheme } from "@/constants/theme";
import {
  useDeleteClientMutation,
  useGetClientPagesInfiniteQuery,
  useGetClientStatsQuery,
} from "@/services/clientApi";
import { runAction } from "@/utils/attendance";
import { cleanParams } from "@/utils/leads";
import { FlashList } from "@shopify/flash-list";
import { router } from "expo-router";
import { Plus, Search, UserCheck } from "lucide-react-native";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { useSelector } from "react-redux";

// Client directory: same as the web — active clients by default, search, venture switcher with counts, KPIs.
export default function Clients() {
  const theme = useTheme();
  const me = useSelector((s) => s.auth.user);
  const can = clientAccess(me);
  const [status, setStatus] = useState("active");
  const [brand, setBrand] = useState("");
  const [typed, setTyped] = useState("");
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState(null);
  const [del, d] = useDeleteClientMutation();

  // Search as you type, once typing pauses.
  useEffect(() => {
    const t = setTimeout(() => setSearch(typed.trim()), 350);
    return () => clearTimeout(t);
  }, [typed]);

  // 20 per page; the next page loads as the list nears its end.
  const q = useGetClientPagesInfiniteQuery(cleanParams({ search, status, brand }));
  const statsQ = useGetClientStatsQuery();
  const stats = statsQ.data?.data;
  const refreshControl = usePullRefresh(() => {
    statsQ.refetch();
    return q.refetch();
  });
  const pages = q.data?.pages || [];
  const clients = pages.flatMap((p) => p.data || []);
  const total = pages[0]?.pagination?.total ?? clients.length;
  const loadMore = () => q.hasNextPage && !q.isFetching && q.fetchNextPage();
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
          can.manage ? (
            <Button
              title="New"
              icon={Plus}
              size="sm"
              onPress={() => router.push("/clients/new")}
            />
          ) : null
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
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        data={clients}
        keyExtractor={(c) => c._id}
        renderItem={({ item }) => (
          <View className="pb-2">
            <ClientRow client={item} onDelete={can.remove ? setDeleting : undefined} />
          </View>
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={
          q.isFetchingNextPage ? (
            <Skeleton className="h-32 rounded-3xl" />
          ) : clients.length ? (
            <Text className="py-2 text-center text-xs text-muted">
              {q.hasNextPage ? `Showing ${clients.length} of ${total}` : `All ${total} shown`}
            </Text>
          ) : null
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
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
