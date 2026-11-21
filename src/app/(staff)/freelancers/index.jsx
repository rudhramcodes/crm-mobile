import {
  Button,
  Chip,
  DashboardState,
  EmptyState,
  FreelancerRow,
  Input,
  MiniStats,
  PageHeader,
  Pager,
  Screen,
  VentureChips,
  freelancerAccess,
  usePullRefresh,
} from "@/components";
import { useTheme } from "@/constants/theme";
import { usePage, usePageNav } from "@/hooks/usePaged";
import { useGetFreelancersQuery, useGetFreelancerStatsQuery } from "@/services/freelancerApi";
import { cleanParams } from "@/utils/leads";
import { FlashList } from "@shopify/flash-list";
import { router } from "expo-router";
import { BriefcaseBusiness, Plus, Search, ShieldAlert } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { useSelector } from "react-redux";

// "All" = active + inactive, as the web's default "All current"; archived only on request.
const STATUS = [
  { value: "", label: "All" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "archived", label: "Archived" },
];

// Crew directory, same as the web /freelancers: stats, search, status and venture filters, 20 per page.
export default function Freelancers() {
  const theme = useTheme();
  const me = useSelector((s) => s.auth.user);
  const can = freelancerAccess(me);
  const [status, setStatus] = useState("");
  const [venture, setVenture] = useState("");
  const [typed, setTyped] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setSearch(typed.trim()), 350);
    return () => clearTimeout(t);
  }, [typed]);

  const LIMIT = 20;
  const listRef = useRef(null);
  const filters = cleanParams({ search, status, venture });
  const [page, setPage] = usePage(JSON.stringify(filters));
  const q = useGetFreelancersQuery({ ...filters, page, limit: LIMIT }, { skip: !can.view });
  const statsQ = useGetFreelancerStatsQuery(undefined, { skip: !can.view });
  const stats = statsQ.data?.data;
  const refreshControl = usePullRefresh(() => {
    statsQ.refetch();
    return q.refetch();
  });
  const list = q.data?.data || [];
  const meta = q.data?.pagination;
  const total = meta?.total ?? list.length;
  const goTo = usePageNav(listRef, page, setPage, meta?.pages);
  const filtered = !!(search || status || venture);

  if (!can.view) {
    return (
      <Screen className="gap-4 pt-2">
        <PageHeader caption="FREELANCERS" title="Freelancers" fallback="/more" />
        <EmptyState icon={ShieldAlert} title="Managers only" message="Ask an admin or manager if you need a freelancer's details." />
      </Screen>
    );
  }

  const reset = () => {
    setTyped("");
    setSearch("");
    setStatus("");
    setVenture("");
  };

  const header = (
    <View className="gap-4 pb-4 pt-2">
      <PageHeader
        caption={`${total} ${total === 1 ? "FREELANCER" : "FREELANCERS"}`}
        title="Freelancers"
        fallback="/more"
        right={can.manage ? <Button title="New" icon={Plus} size="sm" onPress={() => router.push("/freelancers/new")} /> : null}
      />
      {!!stats && (
        <MiniStats
          items={[
            { label: "Active", value: stats.active || 0 },
            { label: "Inactive", value: stats.inactive || 0 },
            { label: "Archived", value: stats.archived || 0 },
          ]}
        />
      )}
      <Input
        value={typed}
        onChangeText={setTyped}
        onSubmitEditing={() => setSearch(typed.trim())}
        placeholder="Name, phone, city, service or code"
        accessibilityLabel="Search freelancers"
        returnKeyType="search"
        autoCorrect={false}
        right={
          <View className="h-11 w-11 items-center justify-center">
            <Search size={18} color={theme.muted} />
          </View>
        }
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-5" contentContainerClassName="gap-2 px-5">
        {STATUS.map((s) => (
          <Chip key={s.value || "all"} label={s.label} active={status === s.value} onPress={() => setStatus(s.value)} />
        ))}
      </ScrollView>
      <VentureChips value={venture} onChange={setVenture} counts={stats?.byVenture} />
    </View>
  );

  const empty =
    q.isLoading || q.isError ? (
      <DashboardState isLoading={q.isLoading} isError={q.isError} refetch={q.refetch} />
    ) : (
      <EmptyState
        icon={BriefcaseBusiness}
        title={filtered ? "No freelancers match" : "No freelancers yet"}
        message={filtered ? "Try another search or clear the filters." : "Add your first photographer, event manager or production specialist."}
        actionTitle={filtered ? "Clear filters" : can.manage ? "Add freelancer" : undefined}
        onAction={filtered ? reset : () => router.push("/freelancers/new")}
      />
    );

  return (
    <Screen className="px-0">
      <FlashList
        ref={listRef}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        data={list}
        keyExtractor={(f) => f._id}
        renderItem={({ item }) => (
          <View className={q.isFetching ? "pb-2 opacity-50" : "pb-2"}>
            <FreelancerRow freelancer={item} />
          </View>
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={
          q.isError && list.length ? (
            <Button title="Couldn't load this page. Try again" variant="ghost" size="sm" onPress={q.refetch} />
          ) : (
            <Pager page={page} pages={meta?.pages} total={total} limit={LIMIT} loading={q.isFetching} onChange={goTo} />
          )
        }
        refreshControl={refreshControl}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
      />
    </Screen>
  );
}
