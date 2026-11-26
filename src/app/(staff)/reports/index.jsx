import {
  BarList,
  Chip,
  ColumnChart,
  DashboardState,
  DonutChart,
  EmptyState,
  PageHeader,
  Screen,
  Section,
  KpiTile,
  TileGrid,
  Text,
  brandLabel,
  usePullRefresh,
} from "@/components";
import { CLIENT_STATUS, INVOICE_STATUS, LEAD_SOURCES, LEAD_STATUS, PAYMENT_METHODS, TASK_PRIORITY, TASK_STATUS } from "@/constants";
import { useGetReportQuery } from "@/services/reportApi";
import { isAdmin } from "@/utils/attendance";
import { formatCompactCurrency, formatCurrency } from "@/utils/formatters";
import { labelOf } from "@/utils/payments";
import { RANGES, REPORT_TABS, countOf, ordered, pct, rangeFor, revenueView } from "@/utils/reports";
import { ShieldAlert } from "lucide-react-native";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useSelector } from "react-redux";

const monthName = (ym) => new Date(`${ym}-01T00:00:00`).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
const monthShort = (ym) => new Date(`${ym}-01T00:00:00`).toLocaleDateString("en-IN", { month: "short" });
// Donut slices from a server group list; `slot` is the entity's place in its constant list, so its colour never moves.
const slicesOf = (rows, list, field = "status", fmt) =>
  (rows || []).map((r) => {
    const i = list.findIndex((x) => x.value === r[field]);
    return { key: String(r[field]), label: labelOf(list, r[field] || "Other"), value: r.count, slot: i < 0 ? list.length : i, ...(fmt ? { display: fmt(r) } : {}) };
  });
const monthsOf = (rows) => (rows || []).map((m) => ({ ...m, key: m.month, label: monthShort(m.month) }));
const money = (v) => formatCompactCurrency(v);
const Tiles = TileGrid;
const Empty = ({ children }) => <Text className="text-sm text-muted">{children}</Text>;
const rateTone = (r) => (r >= 80 ? "text-success" : r >= 50 ? "text-accent-ink" : "text-danger");

function ChipRow({ options, value, onChange }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-5 grow-0" contentContainerClassName="gap-2 px-5">
      {options.map((o) => <Chip key={o.value} label={o.label} active={value === o.value} onPress={() => onChange(o.value)} />)}
    </ScrollView>
  );
}

// Compact table row for the monthly breakdowns: month on the left, figures underneath.
function MonthRow({ month, main, sub, rate }) {
  return (
    <View className="gap-0.5 border-b border-line py-2.5">
      <View className="flex-row items-center gap-3">
        <Text className="flex-1 font-body-semibold text-sm">{monthName(month)}</Text>
        <Text className="text-sm tabular-nums">{main}</Text>
        {rate != null && <Text className={`w-11 text-right font-body-semibold text-sm tabular-nums ${rateTone(rate)}`}>{rate}%</Text>}
      </View>
      <Text className="text-xs tabular-nums text-muted">{sub}</Text>
    </View>
  );
}

function Revenue({ data, rangeKey }) {
  const [withCash, setWithCash] = useState(false);
  const v = revenueView(data, withCash);
  return (
    <>
      <ChipRow options={[{ value: false, label: "Without cash" }, { value: true, label: "With cash" }]} value={withCash} onChange={setWithCash} />
      <Tiles>
        <KpiTile label={withCash ? "Collection (with cash)" : "Revenue (excl. cash)"} value={formatCompactCurrency(v.collected)} sub={`${v.rate}% collection rate`} />
        <KpiTile label="Cash (separate)" value={formatCompactCurrency(v.cash)} sub={withCash ? "Included above" : "Excluded from revenue"} />
        <KpiTile label="Outstanding" value={formatCompactCurrency(v.outstanding)} sub="Pending payments" />
        <KpiTile label="Total invoiced" value={formatCompactCurrency(v.invoiced)} sub="Gross invoice value" />
      </Tiles>
      <Section title={withCash ? "Monthly collection (with cash)" : "Monthly revenue (excl. cash)"} sub="Collected vs outstanding. Tap a month.">
        {v.months.length ? (
          <ColumnChart
            key={`${rangeKey}-${withCash}`}
            data={monthsOf(v.months)}
            series={[{ key: "collected", label: "Collected", slot: 2 }, { key: "outstanding", label: "Outstanding", slot: 1 }]}
            value={(m, s) => m[s.key]}
            format={money}
            title={(m) => monthName(m.month)}
          />
        ) : (
          <Empty>No revenue in this period. Try a wider range.</Empty>
        )}
      </Section>
      <Section title={withCash ? "Payment methods (with cash)" : "Payment methods (excl. cash)"}>
        {v.methods.length ? (
          <DonutChart
            slices={v.methods.map((m) => {
              const i = PAYMENT_METHODS.findIndex((x) => x.value === m.method);
              return { key: m.method, label: `${labelOf(PAYMENT_METHODS, m.method)} · ${m.count}`, value: m.amount, slot: i < 0 ? PAYMENT_METHODS.length : i };
            })}
            total="Collected"
            format={money}
          />
        ) : (
          <Empty>No payments recorded in this period.</Empty>
        )}
      </Section>
      {!!v.months.length && (
        <Section title="Monthly breakdown" sub={`${v.months.length} month${v.months.length === 1 ? "" : "s"} · collection %`}>
          <View>
            {[...v.months].reverse().map((m) => (
              <MonthRow
                key={m.month}
                month={m.month}
                main={formatCurrency(m.invoiced)}
                rate={m.rate}
                sub={`Collected ${formatCurrency(m.collected)} · Cash ${formatCurrency(m.cashCollected)} · Outstanding ${formatCurrency(m.outstanding)} · ${m.count} invoice${m.count === 1 ? "" : "s"}`}
              />
            ))}
          </View>
        </Section>
      )}
    </>
  );
}

function Pipeline({ data }) {
  const s = data.summary || {};
  const c = data.charts || {};
  const total = (c.byStatus || []).reduce((n, x) => n + x.count, 0);
  const sources = c.bySource || [];
  return (
    <>
      <Tiles>
        <KpiTile label="Total leads" value={String(total)} sub="All leads in pipeline" />
        <KpiTile label="Won" value={String(s.wonLeads || 0)} sub="Converted to client" />
        <KpiTile label="Conversion" value={`${s.conversionRate || 0}%`} sub={`${s.lostLeads || 0} lost`} />
        <KpiTile label="Avg. conversion" value={s.avgConversionDays ? `${s.avgConversionDays}d` : "—"} sub="Lead to client" />
      </Tiles>
      <Section title="Pipeline by status" sub={`${total} total`}>
        {total ? (
          <BarList rows={ordered(c.byStatus, LEAD_STATUS.map((x) => x.value)).map((x) => ({ key: String(x.status), label: labelOf(LEAD_STATUS, x.status), value: x.count }))} />
        ) : (
          <Empty>No leads in this period.</Empty>
        )}
      </Section>
      <Section title="Leads by source" sub="Share of all leads">
        {sources.length ? (
          <DonutChart slices={slicesOf(sources, LEAD_SOURCES, "source")} total="Leads" />
        ) : (
          <Empty>Sources appear once leads have them.</Empty>
        )}
      </Section>
    </>
  );
}

function Clients({ data, rangeKey }) {
  const s = data.summary || {};
  const c = data.charts || {};
  const brands = c.byBrand || [];
  const brandTotal = brands.reduce((n, x) => n + x.count, 0);
  return (
    <>
      <Text className="-mb-2 text-xs text-muted">Totals, status and brands are all-time; only new clients follow the date range (same as the website).</Text>
      <Tiles>
        <KpiTile label="Total clients" value={String(s.total || 0)} sub="All registered clients" />
        <KpiTile label="Active" value={String(s.active || 0)} sub="Currently active" />
        <KpiTile label="Inactive" value={String(countOf(c.byStatus, "inactive"))} sub="Inactive accounts" />
        <KpiTile label="Converted" value={String(s.converted || 0)} sub="From leads" />
      </Tiles>
      <Section title="Client status">
        {(c.byStatus || []).length ? (
          <DonutChart slices={slicesOf(c.byStatus, CLIENT_STATUS)} total="Clients" />
        ) : (
          <Empty>No clients yet.</Empty>
        )}
      </Section>
      <Section title="New clients (monthly)" sub="Tap a month for its count.">
        {(c.monthly || []).length ? (
          <ColumnChart key={rangeKey} data={monthsOf(c.monthly)} series={[{ key: "count", label: "New clients", slot: 0 }]} value={(m) => m.count} title={(m) => `${monthName(m.month)} · new clients`} />
        ) : (
          <Empty>No new clients in this period.</Empty>
        )}
      </Section>
      <Section title="Brand breakdown" sub={`${brandTotal} clients`}>
        {brands.length ? (
          <BarList rows={brands.map((x) => ({ key: String(x.brand), label: x.brand ? brandLabel(x.brand) : "Unbranded", value: x.count, display: `${x.count} · ${pct(x.count, brandTotal)}%` }))} />
        ) : (
          <Empty>No brand data yet.</Empty>
        )}
      </Section>
    </>
  );
}

function Invoices({ data, rangeKey }) {
  const s = data.summary || {};
  const c = data.charts || {};
  const pending = countOf(c.byStatus, "sent") + countOf(c.byStatus, "partially_paid");
  const aging = c.aging || [];
  const months = c.monthly || [];
  return (
    <>
      <Tiles>
        <KpiTile label="Total invoices" value={String(s.totalInvoices || 0)} sub={`Avg ${formatCurrency(s.avgValue)}`} />
        <KpiTile label="Paid" value={String(s.paidInvoices || 0)} sub="Fully paid" />
        <KpiTile label="Overdue" value={String(s.overdueCount || 0)} sub="Past due date" alert={(s.overdueCount || 0) > 0} />
        <KpiTile label="Pending" value={String(pending)} sub="Awaiting payment" />
      </Tiles>
      <Section title="Invoice status">
        {(c.byStatus || []).length ? (
          <DonutChart slices={slicesOf(ordered(c.byStatus, INVOICE_STATUS.map((x) => x.value)), INVOICE_STATUS, "status", (x) => `${x.count} · ${money(x.total)}`)} total="Invoices" />
        ) : (
          <Empty>No invoices in this period.</Empty>
        )}
      </Section>
      <Section title="Aging (unpaid)" sub="Balance due by days past the due date">
        {aging.some((a) => a.count) ? (
          <BarList rows={aging.map((a) => ({ key: a.label, label: `${a.label} · ${a.count}`, value: a.amount, display: formatCurrency(a.amount) }))} />
        ) : (
          <Empty>Nothing past due. All invoices are on time.</Empty>
        )}
      </Section>
      {!!months.length && (
        <Section title="Monthly trends" sub="Invoiced vs collected (excl. cash). Tap a month.">
          <ColumnChart
            key={rangeKey}
            data={monthsOf(months)}
            series={[{ key: "total", label: "Invoiced", slot: 0 }, { key: "paid", label: "Collected", slot: 2 }]}
            value={(m, s) => m[s.key]}
            format={money}
            title={(m) => `${monthName(m.month)} · ${m.count} issued`}
          />
          <View>
            {[...months].reverse().map((m) => (
              <MonthRow
                key={m.month}
                month={m.month}
                main={formatCurrency(m.total)}
                rate={pct(m.paid || 0, m.total || 0)}
                sub={`${m.count} issued · Collected ${formatCurrency(m.paid)} (excl. cash) · Cash ${formatCurrency(m.cashCollected)}`}
              />
            ))}
          </View>
        </Section>
      )}
    </>
  );
}

function Productivity({ data }) {
  const s = data.summary || {};
  const c = data.charts || {};
  const people = c.byAssignee || [];
  return (
    <>
      <Tiles>
        <KpiTile label="Total tasks" value={String(s.total || 0)} sub="All tasks" />
        <KpiTile label="Completed" value={String(s.done || 0)} sub={`${s.completionRate || 0}% done`} />
        <KpiTile label="In progress" value={String(countOf(c.byStatus, "in_progress"))} sub="Currently active" />
        <KpiTile label="Overdue" value={String(s.overdue || 0)} sub="Past due date" alert={(s.overdue || 0) > 0} />
      </Tiles>
      <Section title="Tasks by status">
        {s.total ? (
          <DonutChart slices={slicesOf(ordered(c.byStatus, TASK_STATUS.map((x) => x.value)), TASK_STATUS)} total="Tasks" />
        ) : (
          <Empty>No tasks in this period.</Empty>
        )}
      </Section>
      <Section title="Tasks by priority">
        {(c.byPriority || []).length ? (
          <BarList rows={ordered(c.byPriority, TASK_PRIORITY.map((x) => x.value), "priority").map((x) => ({ key: String(x.priority), label: labelOf(TASK_PRIORITY, x.priority), value: x.count }))} />
        ) : (
          <Empty>No priority data.</Empty>
        )}
      </Section>
      <Section title="Tasks by assignee" sub={people.length ? `${people.length} team member${people.length === 1 ? "" : "s"} have tasks` : undefined}>
        {people.length ? <BarList rows={people.map((p, i) => ({ key: `${p.name}-${i}`, label: p.name, value: p.count }))} /> : <Empty>No assignments yet.</Empty>}
      </Section>
    </>
  );
}

const VIEWS = { revenue: Revenue, pipeline: Pipeline, clients: Clients, invoices: Invoices, productivity: Productivity };

// Reports, same tabs, ranges and figures as the web /reports (super admin and admin only).
export default function Reports() {
  const me = useSelector((s) => s.auth.user);
  const [tab, setTab] = useState("revenue");
  const [range, setRange] = useState("month");
  const params = { type: tab, ...rangeFor(range) };
  const q = useGetReportQuery(params, { skip: !isAdmin(me) });
  const refreshControl = usePullRefresh(q.refetch);
  // Keep the previous range's numbers (dimmed) while a new range loads, but never another tab's data.
  const data = q.data?.data?.type === tab ? q.data.data : undefined;
  const View_ = VIEWS[tab];

  if (!isAdmin(me)) {
    return (
      <Screen className="gap-4 pt-2">
        <PageHeader caption="ANALYTICS" title="Reports" fallback="/more" />
        <EmptyState icon={ShieldAlert} title="Admins only" message="Ask an admin if you need a report." />
      </Screen>
    );
  }

  return (
    <Screen scroll className="gap-4 pt-2" refreshControl={refreshControl}>
      <PageHeader caption="ANALYTICS" title="Reports" fallback="/more" />
      <ChipRow options={REPORT_TABS} value={tab} onChange={setTab} />
      <ChipRow options={RANGES} value={range} onChange={setRange} />
      {!data || q.isError ? (
        <DashboardState isLoading={q.isLoading || q.isFetching} isError={q.isError} refetch={q.refetch} />
      ) : (
        <View className={q.isFetching ? "gap-4 opacity-50" : "gap-4"}>
          <View_ key={`${tab}-${range}`} data={data} rangeKey={`${tab}-${range}`} />
        </View>
      )}
    </Screen>
  );
}
