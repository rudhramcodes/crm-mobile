import {
  Button,
  Card,
  Chip,
  DashboardState,
  DateField,
  EmptyState,
  Input,
  InvoiceRow,
  MiniStats,
  PageHeader,
  Pager,
  Pressable,
  Screen,
  Text,
  VentureChips,
  invoiceAccess,
  usePullRefresh,
} from "@/components";
import { INVOICE_STATUS } from "@/constants";
import { useTheme } from "@/constants/theme";
import { usePage, usePageNav } from "@/hooks/usePaged";
import { useGetInvoicesQuery, useGetInvoiceStatsQuery } from "@/services/invoiceApi";
import { formatCompactCurrency } from "@/utils/formatters";
import { invoiceParams } from "@/utils/invoices";
import { FlashList } from "@shopify/flash-list";
import { router } from "expo-router";
import { Plus, Receipt, Search, ShieldAlert, SlidersHorizontal } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { useSelector } from "react-redux";

const NONE = { dateFrom: "", dateTo: "" };

// Invoices, same as the web /invoices: collection figures, status and venture counts, search, issue dates, 20 per page.
export default function Invoices() {
  const theme = useTheme();
  const me = useSelector((s) => s.auth.user);
  const can = invoiceAccess(me);
  const [status, setStatus] = useState("");
  const [brand, setBrand] = useState("");
  const [typed, setTyped] = useState("");
  const [search, setSearch] = useState("");
  const [f, setFilters] = useState(NONE);
  const [open, setOpen] = useState(false);
  const set = (patch) => setFilters((x) => ({ ...x, ...patch }));

  useEffect(() => {
    const t = setTimeout(() => setSearch(typed.trim()), 350);
    return () => clearTimeout(t);
  }, [typed]);

  const LIMIT = 20;
  const listRef = useRef(null);
  const filters = invoiceParams({ search, status, brand, ...f });
  const [page, setPage] = usePage(JSON.stringify(filters));
  const q = useGetInvoicesQuery({ ...filters, page, limit: LIMIT }, { skip: !can.view });
  const statsQ = useGetInvoiceStatsQuery(undefined, { skip: !can.view });
  const stats = statsQ.data?.data;
  const refreshControl = usePullRefresh(() => {
    statsQ.refetch();
    return q.refetch();
  });
  const list = q.data?.data || [];
  const meta = q.data?.pagination;
  const total = meta?.total ?? list.length;
  const goTo = usePageNav(listRef, page, setPage, meta?.pages);
  const active = [f.dateFrom, f.dateTo].filter(Boolean).length;
  const filtered = !!(search || status || brand || active);

  if (!can.view) {
    return (
      <Screen className="gap-4 pt-2">
        <PageHeader caption="INVOICES" title="Invoices" fallback="/more" />
        <EmptyState icon={ShieldAlert} title="Admins only" message="Ask an admin if you need an invoice." />
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
        caption={`${total} ${total === 1 ? "INVOICE" : "INVOICES"}`}
        title="Invoices"
        fallback="/more"
        right={can.manage ? <Button title="New" icon={Plus} size="sm" onPress={() => router.push("/invoices/new")} /> : null}
      />
      {!!stats && (
        <MiniStats
          items={[
            { label: "Collected", value: formatCompactCurrency(stats.revenue?.totalPaid) },
            { label: "Outstanding", value: formatCompactCurrency(stats.revenue?.totalPending) },
            { label: "Overdue", value: String(stats.overdueCount || 0) },
          ]}
        />
      )}
      <View className="flex-row gap-2">
        <View className="flex-1">
          <Input
            value={typed}
            onChangeText={setTyped}
            onSubmitEditing={() => setSearch(typed.trim())}
            placeholder="Invoice number or client"
            accessibilityLabel="Search invoices"
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
          {!!active && <Button title="Clear filters" variant="ghost" size="sm" className="self-start" onPress={() => setFilters(NONE)} />}
        </Card>
      )}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-5" contentContainerClassName="gap-2 px-5">
        <Chip label="All" active={!status} count={stats?.total} onPress={() => setStatus("")} />
        {INVOICE_STATUS.map((s) => (
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
        icon={Receipt}
        title={filtered ? "No invoices match" : "No invoices yet"}
        message={filtered ? "Try another search or clear the filters." : "Create your first invoice, or make one from a quotation."}
        actionTitle={filtered ? "Clear filters" : can.manage ? "New invoice" : undefined}
        onAction={filtered ? reset : () => router.push("/invoices/new")}
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
            <InvoiceRow invoice={item} />
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
