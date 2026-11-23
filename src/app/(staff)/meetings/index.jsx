import {
  Button,
  Chip,
  ConfirmDialog,
  DashboardState,
  DateField,
  EmptyState,
  Input,
  MeetingCalendar,
  MeetingRow,
  MiniStats,
  PageHeader,
  Pressable,
  Screen,
  SearchPick,
  Skeleton,
  Text,
  VentureChips,
  meetingAccess,
  usePullRefresh,
} from "@/components";
import { MEETING_STATUS } from "@/constants";
import { useTheme } from "@/constants/theme";
import { useGetClientsQuery } from "@/services/clientApi";
import {
  useDeleteMeetingMutation,
  useGetMeetingPagesInfiniteQuery,
} from "@/services/meetingApi";
import { runAction } from "@/utils/attendance";
import { cleanParams } from "@/utils/leads";
import { brandCounts, clientOptions } from "@/utils/meetings";
import { FlashList } from "@shopify/flash-list";
import { router } from "expo-router";
import {
  CalendarDays,
  Plus,
  Search,
  SlidersHorizontal,
} from "lucide-react-native";
import { useState } from "react";
import { useDebouncedSearch } from "@/hooks/useDebouncedSearch";
import { View } from "react-native";
import { useSelector } from "react-redux";

const EMPTY = { status: "", client: "", from: "", to: "" };

// Meetings & briefings: list or month calendar over the same filters, venture tabs, KPIs (web parity).
export default function Meetings() {
  const theme = useTheme();
  const me = useSelector((s) => s.auth.user);
  const can = meetingAccess(me);
  const [view, setView] = useState("list");
  const [f, setF] = useState(EMPTY);
  const [brand, setBrand] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const { typed, setTyped, search, setSearch } = useDebouncedSearch();
  const [deleting, setDeleting] = useState(null);
  const [del, d] = useDeleteMeetingMutation();
  const clients = useGetClientsQuery({ limit: 100 }).data?.data || [];

  // Search as you type, once typing pauses.

  const base = { search, brand, status: f.status, client: f.client };
  const q = useGetMeetingPagesInfiniteQuery(
    cleanParams({
      ...base,
      dateFrom: f.from,
      dateTo: f.to ? `${f.to}T23:59:59.999Z` : "",
    }),
  );
  const refreshControl = usePullRefresh(q.refetch);
  const pages = q.data?.pages || [];
  const meetings = pages.flatMap((p) => p.data || []);
  const total = pages[0]?.pagination?.total ?? meetings.length;
  const loadMore = () => q.hasNextPage && !q.isFetching && q.fetchNextPage();
  const count = (s) => meetings.filter((m) => m.status === s).length;
  const active = [f.status, f.client, f.from, f.to].filter(Boolean).length;
  const filtered = !!(search || brand || active);
  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  const reset = () => {
    setF(EMPTY);
    setBrand("");
    setTyped("");
    setSearch("");
  };

  const remove = async (allSeries) => {
    await runAction(
      del({ id: deleting?._id, allSeries }),
      allSeries
        ? "Recurring series deleted successfully"
        : "Meeting deleted successfully",
      allSeries ? "Failed to delete series" : "Failed to delete meeting",
    );
    setDeleting(null);
  };

  const header = (
    <View className="gap-4 pb-4 pt-2">
      <PageHeader
        caption={`${total} ${total === 1 ? "MEETING" : "MEETINGS"}`}
        title="Meetings"
        fallback="/more"
        right={
          can.manage ? (
            <Button
              title="New"
              icon={Plus}
              size="sm"
              onPress={() => router.push("/meetings/new")}
            />
          ) : me?.role === "employee" ? (
            <Button title="Request" icon={Plus} size="sm" variant="secondary" onPress={() => router.push("/meetings/request")} />
          ) : null
        }
      />
      {/* <Text className="-mt-2 text-sm text-muted">
        Coordinate video appointments, discussions, and follow-up agendas
      </Text> */}

      <MiniStats
        items={[
          { label: "Total", value: meetings.length },
          { label: "Scheduled", value: count("scheduled") },
          { label: "Completed", value: count("completed") },
          { label: "Cancelled", value: count("cancelled") },
        ]}
      />

      <View className="flex-row gap-2">
        <Chip
          label="List"
          active={view === "list"}
          onPress={() => setView("list")}
        />
        <Chip
          label="Calendar"
          active={view === "calendar"}
          onPress={() => setView("calendar")}
        />
      </View>

      <View className="flex-row items-start gap-2">
        <Input
          className="flex-1"
          value={typed}
          onChangeText={setTyped}
          onSubmitEditing={() => setSearch(typed.trim())}
          placeholder="Search meetings by title, agenda..."
          accessibilityLabel="Search meetings"
          returnKeyType="search"
          autoCorrect={false}
          right={
            <View className="h-11 w-11 items-center justify-center">
              <Search size={18} color={theme.muted} />
            </View>
          }
        />
        <Pressable
          onPress={() => setShowFilters((s) => !s)}
          accessibilityLabel={`Filters${active ? `, ${active} on` : ""}`}
          accessibilityState={{ expanded: showFilters }}
          className={
            showFilters || active
              ? "h-[52px] w-[52px] items-center justify-center rounded-2xl bg-ink"
              : "h-[52px] w-[52px] items-center justify-center rounded-2xl bg-surface-2"
          }
        >
          <SlidersHorizontal
            size={20}
            color={showFilters || active ? theme.bg : theme.ink}
          />
        </Pressable>
      </View>

      {showFilters && (
        <View className="gap-3 rounded-3xl border border-line bg-surface p-4">
          <SearchPick
            label="Client"
            placeholder="All clients"
            searchPlaceholder="Search clients by company, contact..."
            noneLabel="All clients"
            items={clientOptions(clients)}
            value={f.client}
            onChange={(client) => set({ client })}
          />
          <Text className="text-caption text-muted">STATUS</Text>
          <View className="flex-row flex-wrap gap-2">
            {[{ value: "", label: "All" }, ...MEETING_STATUS].map((s) => (
              <Chip
                key={s.value || "all"}
                label={s.label}
                active={f.status === s.value}
                onPress={() => set({ status: s.value })}
              />
            ))}
          </View>
          {view === "list" && (
            <>
              <DateField
                label="From"
                value={f.from}
                onChange={(from) => set({ from })}
                onClear={() => set({ from: "" })}
                placeholder="From date"
                maxDate={f.to || undefined}
              />
              <DateField
                label="To"
                value={f.to}
                onChange={(to) => set({ to })}
                onClear={() => set({ to: "" })}
                placeholder="To date"
                minDate={f.from || undefined}
              />
            </>
          )}
          {!!active && (
            <Button
              title="Clear filters"
              size="sm"
              variant="secondary"
              onPress={() => setF(EMPTY)}
            />
          )}
        </View>
      )}

      <VentureChips
        value={brand}
        onChange={setBrand}
        counts={brandCounts(meetings)}
      />
    </View>
  );

  const empty =
    view === "calendar" ? (
      <MeetingCalendar
        filters={base}
        canManage={can.manage}
        onDelete={can.remove ? setDeleting : undefined}
      />
    ) : q.isLoading || q.isError ? (
      <DashboardState
        isLoading={q.isLoading}
        isError={q.isError}
        refetch={q.refetch}
      />
    ) : (
      <EmptyState
        icon={CalendarDays}
        title={filtered ? "No meetings match" : "No scheduled meetings found"}
        message={
          filtered
            ? "Try another search or clear the filters."
            : "Schedule a new briefing or client sync to get started."
        }
        actionTitle={
          filtered
            ? "Clear filters"
            : can.manage
              ? "Schedule meeting"
              : undefined
        }
        onAction={filtered ? reset : () => router.push("/meetings/new")}
      />
    );

  return (
    <Screen className="px-0">
      <FlashList
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        data={view === "list" ? meetings : []}
        keyExtractor={(m) => m._id}
        renderItem={({ item }) => (
          <View className="pb-2">
            <MeetingRow
              meeting={item}
              canManage={can.manage}
              onDelete={can.remove ? setDeleting : undefined}
            />
          </View>
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={
          view !== "list" ? null : q.isFetchingNextPage ? (
            <Skeleton className="h-32 rounded-3xl" />
          ) : meetings.length ? (
            <Text className="py-2 text-center text-xs text-muted">
              {q.hasNextPage
                ? `Showing ${meetings.length} of ${total}`
                : `All ${total} shown`}
            </Text>
          ) : null
        }
        onEndReached={view === "list" ? loadMore : undefined}
        onEndReachedThreshold={0.5}
        refreshControl={refreshControl}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
      />

      <ConfirmDialog
        visible={!!deleting}
        title={
          deleting?.seriesId ? "Delete recurring meeting?" : "Delete meeting?"
        }
        message={
          deleting?.seriesId
            ? `"${deleting?.title}" is part of a recurring series.`
            : `Are you sure you want to delete meeting "${deleting?.title}"? This cannot be undone.`
        }
        confirmLabel={
          deleting?.seriesId ? "Delete this occurrence only" : "Delete meeting"
        }
        secondaryLabel={deleting?.seriesId ? "Delete entire series" : undefined}
        onSecondary={() => remove(true)}
        loading={d.isLoading}
        onCancel={() => setDeleting(null)}
        onConfirm={() => remove(false)}
      />
    </Screen>
  );
}
