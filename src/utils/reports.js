// Pure report helpers (no React/RN imports, so reports.check.js runs under plain node).
// Same tabs, ranges and figures as the web Reports page (client/src/modules/reports).

export const REPORT_TABS = [
  { value: 'revenue', label: 'Revenue' },
  { value: 'pipeline', label: 'Pipeline' },
  { value: 'clients', label: 'Clients' },
  { value: 'invoices', label: 'Invoices' },
  { value: 'productivity', label: 'Productivity' },
];

export const RANGES = [
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: 'month', label: 'This Month' },
  { value: 'lastMonth', label: 'Last Month' },
  { value: 'year', label: 'This Year' },
  { value: 'all', label: 'All' },
];

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// { from, to } for /reports as local calendar days (YYYY-MM-DD); the server reads each as that whole day in India time.
// (The web builds them with toISOString(), which in India starts "This Month" on the previous day.)
export function rangeFor(key, now = new Date()) {
  const y = now.getFullYear();
  const m = now.getMonth();
  const day = (yy, mm, dd) => new Date(yy, mm, dd);
  const span = {
    '7d': [day(y, m, now.getDate() - 6), now],
    '30d': [day(y, m, now.getDate() - 29), now],
    month: [day(y, m, 1), now],
    lastMonth: [day(y, m - 1, 1), day(y, m, 0)],
    year: [day(y, 0, 1), now],
  }[key];
  if (!span) return {}; // "All": no dates, the server reports all time
  return { from: ymd(span[0]), to: ymd(span[1]) };
}

const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

// Revenue tab with or without cash. Unlike the web, the figures change with the toggle too, not only the chart labels.
export function revenueView(data, withCash = false) {
  const s = data?.summary || {};
  const c = data?.charts || {};
  const cash = s.cashCollected || 0;
  const collected = (s.totalRevenue || 0) + (withCash ? cash : 0);
  const months = (c.monthlyRevenue || []).map((m) => ({
    ...m,
    collected: (m.collected || 0) + (withCash ? m.cashCollected || 0 : 0),
    rate: pct((m.collected || 0) + (withCash ? m.cashCollected || 0 : 0), m.invoiced || 0),
  }));
  const methods = [...(c.byMethod || []), ...(withCash ? c.cashByMethod || [] : [])].sort((a, b) => b.amount - a.amount);
  return {
    collected,
    cash,
    outstanding: s.totalOutstanding || 0,
    invoiced: s.totalInvoiced || 0,
    rate: pct(collected, s.totalInvoiced || 0),
    months,
    methods,
  };
}

// Count lookup from a server group list: [{ status, count }] → count for one key.
export const countOf = (rows, key, field = 'status') => (rows || []).find((r) => r[field] === key)?.count || 0;

// Rows in a fixed order (e.g. pipeline stages), keeping any the server returns that the list doesn't know.
export function ordered(rows, order, field = 'status') {
  const list = rows || [];
  const known = order.map((k) => list.find((r) => r[field] === k)).filter(Boolean);
  return [...known, ...list.filter((r) => !order.includes(r[field]))];
}

export { pct };
