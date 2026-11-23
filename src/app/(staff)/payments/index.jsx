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
  PaymentRow,
  Pressable,
  Screen,
  Text,
  VentureChips,
  paymentAccess,
  usePullRefresh,
} from "@/components";
import { PAYMENT_METHODS, PAYMENT_STATUS, PAYMENT_TYPES } from "@/constants";
import { useTheme } from "@/constants/theme";
import { usePage, usePageNav } from "@/hooks/usePaged";
import { useGetPaymentsQuery, useGetPaymentStatsQuery } from "@/services/paymentApi";
import { formatCompactCurrency } from "@/utils/formatters";
import { paymentParams } from "@/utils/payments";
import { FlashList } from "@shopify/flash-list";
import { CreditCard, Search, ShieldAlert, SlidersHorizontal } from "lucide-react-native";
import { useRef, useState } from "react";
import { useDebouncedSearch } from "@/hooks/useDebouncedSearch";
import { ScrollView, View } from "react-native";
import { useSelector } from "react-redux";

const NONE = { status: "", paymentMethod: "", paymentType: "", dateFrom: "", dateTo: "" };
const ALL = { value: "", label: "All" };
const short = (list) => list.map((i) => ({ ...i, label: i.label.replace(/ Payment$/, "") }));

function ChipRow({ options, value, onChange }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-4" contentContainerClassName="gap-2 px-4">
      {[ALL, ...options].map((o) => (
        <Chip key={o.value || "all"} label={o.label} active={value === o.value} onPress={() => onChange(o.value)} />
      ))}
    </ScrollView>
  );
}

// Payments & receipts, same as the web /payments: collection figures, venture, search, filters, 20 per page.
// No "New" here, as on the web: payments are recorded from an invoice.
export default function Payments() {
  const theme = useTheme();
  const me = useSelector((s) => s.auth.user);
  const can = paymentAccess(me);
  const [brand, setBrand] = useState("");
  const { typed, setTyped, search, setSearch } = useDebouncedSearch();
  const [f, setFilters] = useState(NONE);
  const [open, setOpen] = useState(false);
  const set = (patch) => setFilters((x) => ({ ...x, ...patch }));


  const LIMIT = 20;
  const listRef = useRef(null);
  const filters = paymentParams({ search, brand, ...f });
  const [page, setPage] = usePage(JSON.stringify(filters));
  const q = useGetPaymentsQuery({ ...filters, page, limit: LIMIT }, { skip: !can.view });
  const statsQ = useGetPaymentStatsQuery(undefined, { skip: !can.view });
  const stats = statsQ.data?.data;
  const refreshControl = usePullRefresh(() => {
    statsQ.refetch();
    return q.refetch();
  });
  const list = q.data?.data || [];
  const meta = q.data?.pagination;
  const total = meta?.total ?? list.length;
  const goTo = usePageNav(listRef, page, setPage, meta?.pages);
  const active = Object.values(f).filter(Boolean).length;
  const filtered = !!(search || brand || active);

  if (!can.view) {
    return (
      <Screen className="gap-4 pt-2">
        <PageHeader caption="PAYMENTS" title="Payments" fallback="/more" />
        <EmptyState icon={ShieldAlert} title="Admins only" message="Ask an admin if you need payment details." />
      </Screen>
    );
  }

  const reset = () => {
    setTyped("");
    setSearch("");
    setBrand("");
    setFilters(NONE);
  };

  const header = (
    <View className="gap-4 pb-4 pt-2">
      <PageHeader caption={`${total} ${total === 1 ? "PAYMENT" : "PAYMENTS"}`} title="Payments" fallback="/more" />
      {!!stats && (
        <MiniStats
          items={[
            { label: "Collected", value: formatCompactCurrency(stats.totalCollected) },
            { label: "Cash", value: formatCompactCurrency(stats.byMethod?.find((m) => m._id === "cash")?.total) },
            { label: "Outstanding", value: formatCompactCurrency(stats.pendingAmount) },
          ]}
        />
      )}
      <View className="flex-row gap-2">
        <View className="flex-1">
          <Input
            value={typed}
            onChangeText={setTyped}
            onSubmitEditing={() => setSearch(typed.trim())}
            placeholder="Reference, invoice or client"
            accessibilityLabel="Search payments"
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
          <Text className="text-caption text-muted">STATUS</Text>
          <ChipRow options={PAYMENT_STATUS} value={f.status} onChange={(v) => set({ status: v })} />
          <Text className="text-caption text-muted">METHOD</Text>
          <ChipRow options={PAYMENT_METHODS} value={f.paymentMethod} onChange={(v) => set({ paymentMethod: v })} />
          <Text className="text-caption text-muted">PURPOSE</Text>
          <ChipRow options={short(PAYMENT_TYPES)} value={f.paymentType} onChange={(v) => set({ paymentType: v })} />
          <DateField label="From" value={f.dateFrom} onChange={(d) => set({ dateFrom: d, dateTo: f.dateTo && d > f.dateTo ? d : f.dateTo })} onClear={() => set({ dateFrom: "" })} placeholder="Any date" />
          <DateField label="To" value={f.dateTo} onChange={(d) => set({ dateTo: d })} onClear={() => set({ dateTo: "" })} minDate={f.dateFrom || undefined} placeholder="Any date" />
          {!!active && <Button title="Clear filters" variant="ghost" size="sm" className="self-start" onPress={() => setFilters(NONE)} />}
        </Card>
      )}
      <VentureChips value={brand} onChange={setBrand} />
    </View>
  );

  const empty =
    q.isLoading || q.isError ? (
      <DashboardState isLoading={q.isLoading} isError={q.isError} refetch={q.refetch} />
    ) : (
      <EmptyState
        icon={CreditCard}
        title={filtered ? "No payments match" : "No payments yet"}
        message={filtered ? "Try another search or clear the filters." : "Payments appear here once they're recorded against invoices."}
        actionTitle={filtered ? "Clear filters" : undefined}
        onAction={filtered ? reset : undefined}
      />
    );

  return (
    <Screen className="px-0">
      <FlashList
        ref={listRef}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        data={list}
        keyExtractor={(p) => p._id}
        renderItem={({ item }) => (
          <View className={q.isFetching ? "pb-2 opacity-50" : "pb-2"}>
            <PaymentRow payment={item} />
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
