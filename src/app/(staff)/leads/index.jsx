import {
  Button,
  DashboardState,
  EmptyState,
  Input,
  LeadBoard,
  LeadBulkBar,
  LeadFilters,
  LeadRow,
  MiniStats,
  PageHeader,
  Pressable,
  Screen,
  Text,
  VentureChips,
  usePullRefresh,
} from "@/components";
import { useTheme } from "@/constants/theme";
import { useGetLeadStatsQuery, useGetLeadsQuery } from "@/services/leadApi";
import { canWriteModule } from "@/utils/access";
import { cleanParams } from "@/utils/leads";
import { router } from "expo-router";
import {
  CheckSquare,
  Plus,
  Search,
  SlidersHorizontal,
  Users,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { useSelector } from "react-redux";

const EMPTY = { status: "", source: "", brand: "" };

// Leads pipeline: list or board over one filtered list, search, filters, stage stats, bulk select.
export default function Leads() {
  const theme = useTheme();
  const me = useSelector((s) => s.auth.user);
  const canWrite = canWriteModule(me, "leads");
  const [view, setView] = useState("list");
  const [f, setF] = useState(EMPTY);
  const [showFilters, setShowFilters] = useState(false);
  const [typed, setTyped] = useState("");
  const [search, setSearch] = useState("");
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState([]);

  // Search as you type, once typing pauses.
  useEffect(() => {
    const t = setTimeout(() => setSearch(typed.trim()), 350);
    return () => clearTimeout(t);
  }, [typed]);

  // shortcut: first 100 leads for the filters (server max); add paging when a filtered list routinely holds more.
  const q = useGetLeadsQuery(
    cleanParams({ page: 1, limit: 100, search, ...f }),
  );
  const stats = useGetLeadStatsQuery().data?.data;
  const refreshControl = usePullRefresh(q.refetch);
  const leads = q.data?.data || [];
  const total = q.data?.pagination?.total ?? leads.length;
  const active = [f.status, f.source].filter(Boolean).length; // venture has its own row

  // A new filter hides rows, so drop the selection: bulk actions must only touch visible leads.
  const set = (patch) => {
    setF((x) => ({ ...x, ...patch }));
    setSelected([]);
  };
  const toggle = (id) => {
    setSelecting(true);
    setSelected((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : [...s, id],
    );
  };
  const clear = () => {
    setSelecting(false);
    setSelected([]);
  };
  const reset = () => {
    setF(EMPTY);
    setTyped("");
    setSearch("");
  };

  return (
    <Screen scroll className="gap-4 pt-2" refreshControl={refreshControl}>
      <PageHeader
        caption={`${total} ${total === 1 ? "LEAD" : "LEADS"}`}
        title="Leads"
        fallback="/more"
        right={
          canWrite ? (
            <Button
              title="New"
              icon={Plus}
              size="sm"
              onPress={() => router.push("/leads/new")}
            />
          ) : null
        }
      />

      {!!stats && (
        <MiniStats
          items={[
            { label: "New", value: stats.new || 0 },
            {
              label: "Pipeline",
              value:
                (stats.meeting_scheduled || 0) + (stats.proposal_sent || 0),
            },
            { label: "Won", value: stats.won || 0 },
            {
              label: "Win rate",
              value: `${stats.total ? Math.round(((stats.won || 0) / stats.total) * 100) : 0}%`,
            },
          ]}
        />
      )}

      {/* <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="-mx-5"
        contentContainerClassName="gap-2 px-5"
      >
        {[
          ["list", "List"],
          ["board", "Board"],
        ].map(([v, l]) => (
          <Chip
            key={v}
            label={l}
            active={view === v}
            onPress={() => {
              setView(v);
              clear();
            }}
          />
        ))}
      </ScrollView> */}

      <View className="flex-row items-start gap-2">
        <Input
          className="flex-1"
          value={typed}
          onChangeText={(v) => {
            setTyped(v);
            setSelected([]);
          }}
          onSubmitEditing={() => setSearch(typed.trim())}
          placeholder="Search name, email, company, phone"
          accessibilityLabel="Search leads"
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
      {showFilters && <LeadFilters f={f} set={set} />}
      <VentureChips value={f.brand} onChange={(brand) => set({ brand })} />

      {view === "list" && canWrite && !!leads.length && (
        <Button
          title={selecting ? "Cancel" : "Select"}
          icon={CheckSquare}
          size="sm"
          variant="secondary"
          onPress={() => (selecting ? clear() : setSelecting(true))}
        />
      )}

      {q.isLoading || q.isError ? (
        <DashboardState
          isLoading={q.isLoading}
          isError={q.isError}
          refetch={q.refetch}
        />
      ) : (
        <>
          {selecting && (
            <LeadBulkBar
              leads={leads}
              selected={selected}
              onSelect={setSelected}
              onClear={clear}
            />
          )}
          {view === "board" && <LeadBoard leads={leads} canWrite={canWrite} />}
          {view === "list" &&
            (leads.length ? (
              <View className="gap-2">
                {leads.map((l) => (
                  <LeadRow
                    key={l._id}
                    lead={l}
                    selecting={selecting}
                    selected={selected.includes(l._id)}
                    onToggleSelect={canWrite ? toggle : undefined}
                  />
                ))}
                {canWrite && (
                  <Text className="text-xs text-muted">
                    Long-press a lead to select several.
                  </Text>
                )}
              </View>
            ) : (
              <EmptyState
                icon={Users}
                title={search || active ? "No leads match" : "No leads yet"}
                message={
                  search || active
                    ? "Try another search or clear the filters."
                    : canWrite
                      ? "Add the first one."
                      : "New leads will show up here."
                }
                actionTitle={
                  search || active
                    ? "Clear filters"
                    : canWrite
                      ? "New lead"
                      : undefined
                }
                onAction={
                  search || active ? reset : () => router.push("/leads/new")
                }
              />
            ))}
        </>
      )}
    </Screen>
  );
}
