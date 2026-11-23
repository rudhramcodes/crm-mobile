import {
  Button,
  Card,
  Chip,
  DashboardState,
  DateField,
  EmptyState,
  Input,
  MiniStats,
  PageHeader,
  Pager,
  Pressable,
  QuotationRow,
  Screen,
  Text,
  Toggle,
  VentureChips,
  quotationAccess,
  usePullRefresh,
} from "@/components";
import { QUOTATION_STATUS } from "@/constants";
import { useTheme } from "@/constants/theme";
import { usePage, usePageNav } from "@/hooks/usePaged";
import { useGetQuotationsQuery, useGetQuotationStatsQuery } from "@/services/quotationApi";
import { formatCompactCurrency } from "@/utils/formatters";
import { quotationParams } from "@/utils/quotations";
import { FlashList } from "@shopify/flash-list";
import { router } from "expo-router";
import { FileSignature, Plus, Search, ShieldAlert, SlidersHorizontal } from "lucide-react-native";
import { useRef, useState } from "react";
import { useDebouncedSearch } from "@/hooks/useDebouncedSearch";
import { ScrollView, View } from "react-native";
import { useSelector } from "react-redux";

const NONE = { dateFrom: "", dateTo: "", archived: false };

// Quotations, same as the web /quotations: value figures, status and venture counts, search, dates, archived, 20 per page.
// "New" is a quick create (client, template, price, dates); the full wording is refined in the web editor.
export default function Quotations() {
  const theme = useTheme();
  const me = useSelector((s) => s.auth.user);
  const can = quotationAccess(me);
  const [status, setStatus] = useState("");
  const [brand, setBrand] = useState("");
  const { typed, setTyped, search, setSearch } = useDebouncedSearch();
  const [f, setFilters] = useState(NONE);
  const [open, setOpen] = useState(false);
  const set = (patch) => setFilters((x) => ({ ...x, ...patch }));


  const LIMIT = 20;
  const listRef = useRef(null);
  const filters = quotationParams({ search, status, brand, ...f });
  const [page, setPage] = usePage(JSON.stringify(filters));
  const q = useGetQuotationsQuery({ ...filters, page, limit: LIMIT }, { skip: !can.view });
  const statsQ = useGetQuotationStatsQuery(undefined, { skip: !can.view });
  const stats = statsQ.data?.data;
  const refreshControl = usePullRefresh(() => {
    statsQ.refetch();
    return q.refetch();
  });
  const list = q.data?.data || [];
  const meta = q.data?.pagination;
  const total = meta?.total ?? list.length;
  const goTo = usePageNav(listRef, page, setPage, meta?.pages);
  const active = [f.dateFrom, f.dateTo, f.archived].filter(Boolean).length;
  const filtered = !!(search || status || brand || active);

  if (!can.view) {
    return (
      <Screen className="gap-4 pt-2">
        <PageHeader caption="QUOTATIONS" title="Quotations" fallback="/more" />
        <EmptyState icon={ShieldAlert} title="Admins only" message="Ask an admin if you need a quotation." />
      </Screen>
    );
  }

  const reset = () => {
    setTyped("");
    setSearch("");
    setStatus("");
    setBrand("");
    setFilters(NONE);
  };

  const header = (
    <View className="gap-4 pb-4 pt-2">
      <PageHeader
        caption={`${total} ${f.archived ? "ARCHIVED" : total === 1 ? "QUOTATION" : "QUOTATIONS"}`}
        title="Quotations"
        fallback="/more"
        right={can.manage ? <Button title="New" icon={Plus} size="sm" onPress={() => router.push("/quotations/new")} /> : null}
      />
      {!!stats && (
        <MiniStats
          items={[
            { label: "Quoted", value: formatCompactCurrency(stats.financials?.totalValue) },
            { label: "Accepted", value: formatCompactCurrency(stats.financials?.acceptedValue) },
            { label: "Conversion", value: `${stats.conversionRate || 0}%` },
          ]}
        />
      )}
      <View className="flex-row gap-2">
        <View className="flex-1">
          <Input
            value={typed}
            onChangeText={setTyped}
            onSubmitEditing={() => setSearch(typed.trim())}
            placeholder="Number, subject or client"
            accessibilityLabel="Search quotations"
            returnKeyType="search"
            autoCorrect={false}
            right={
              <View className="h-11 w-11 items-center justify-center">
                <Search size={18} color={theme.muted} />
              </View>
            }
          />
        </View>
        <Pressable
          onPress={() => setOpen((o) => !o)}
          accessibilityLabel={`Filters${active ? `, ${active} on` : ""}`}
          accessibilityState={{ expanded: open }}
          className={`h-[52px] w-[52px] items-center justify-center rounded-2xl ${open || active ? "bg-ink" : "bg-surface-2"}`}
        >
          <SlidersHorizontal size={20} color={open || active ? theme.bg : theme.ink} />
          {!!active && (
            <View className="absolute right-1.5 top-1.5 h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1">
              <Text className="text-[10px] leading-[14px] text-bg">{active}</Text>
            </View>
          )}
        </Pressable>
      </View>
      {open && (
        <Card className="gap-3 p-4">
          <DateField label="Issued from" value={f.dateFrom} onChange={(d) => set({ dateFrom: d, dateTo: f.dateTo && d > f.dateTo ? d : f.dateTo })} onClear={() => set({ dateFrom: "" })} placeholder="Any date" />
          <DateField label="Issued to" value={f.dateTo} onChange={(d) => set({ dateTo: d })} onClear={() => set({ dateTo: "" })} minDate={f.dateFrom || undefined} placeholder="Any date" />
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="font-body-medium text-sm">Show archived</Text>
              <Text className="text-sm text-muted">Archived quotations only</Text>
            </View>
            <Toggle value={f.archived} onValueChange={(v) => set({ archived: v })} label="Show archived" />
          </View>
          {!!active && <Button title="Clear filters" variant="ghost" size="sm" className="self-start" onPress={() => setFilters(NONE)} />}
        </Card>
      )}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-5" contentContainerClassName="gap-2 px-5">
        <Chip label="All" active={!status} count={stats?.total} onPress={() => setStatus("")} />
        {QUOTATION_STATUS.map((s) => (
          <Chip key={s.value} label={s.label} active={status === s.value} count={stats?.[s.value]} onPress={() => setStatus(s.value)} />
        ))}
      </ScrollView>
      <VentureChips value={brand} onChange={setBrand} counts={stats ? { "": stats.total, ...stats.byBrand } : undefined} />
    </View>
  );

  const empty =
    q.isLoading || q.isError ? (
      <DashboardState isLoading={q.isLoading} isError={q.isError} refetch={q.refetch} />
    ) : (
      <EmptyState
        icon={FileSignature}
        title={filtered ? "No quotations match" : "No quotations yet"}
        message={filtered ? "Try another search or clear the filters." : "Create a quotation draft for a client, then save and send it."}
        actionTitle={filtered ? "Clear filters" : can.manage ? "New quotation" : undefined}
        onAction={filtered ? reset : () => router.push("/quotations/new")}
      />
    );

  return (
    <Screen className="px-0">
      <FlashList
        ref={listRef}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        data={list}
        keyExtractor={(x) => x._id}
        renderItem={({ item }) => (
          <View className={q.isFetching ? "pb-2 opacity-50" : "pb-2"}>
            <QuotationRow quotation={item} />
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
