// Pure payment helpers (no React/RN imports, so payments.check.js runs under plain node).

export const labelOf = (list, v) => list.find((i) => i.value === v)?.label || String(v ?? '').replace(/_/g, ' ');

// Filters → /payments query. Empty values dropped; "To" covers the whole day (the server compares
// dateTo as a Date, so a bare "2026-11-21" would stop at midnight and drop that day's payments).
export function paymentParams({ search, status, paymentMethod, paymentType, brand, dateFrom, dateTo, page, limit } = {}) {
  const p = { search: search?.trim(), status, paymentMethod, paymentType, brand, page, limit };
  if (dateFrom) p.dateFrom = `${dateFrom}T00:00:00.000`;
  if (dateTo) p.dateTo = `${dateTo}T23:59:59.999`;
  return Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined && v !== null && v !== ''));
}

// Most this payment can be edited up to: what the invoice still owes plus what this payment already counts for.
// Only completed payments count toward paidAmount on the server. null = unknown (invoice not loaded).
export function maxEditable(payment) {
  const due = payment?.invoice?.balanceDue;
  if (due == null) return null;
  return Math.round((Number(due) + (payment.status === 'completed' ? Number(payment.amount || 0) : 0)) * 100) / 100;
}

// The calendar day on this device. A payment recorded at 01:00 IST is stored as the previous UTC day,
// so cutting the ISO string would show (and re-save) the wrong day.
const pad = (n) => String(n).padStart(2, '0');
export const localDay = (d) => {
  const x = new Date(d);
  return Number.isNaN(x.getTime()) ? '' : `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
};

// Server record → edit form state.
export const paymentForm = (p) => ({
  amount: p?.amount != null ? String(p.amount) : '',
  paymentType: p?.paymentType || 'partial',
  paymentMethod: p?.paymentMethod || 'upi',
  status: p?.status || 'completed',
  referenceNo: p?.referenceNo || '',
  paymentDate: p?.paymentDate ? localDay(p.paymentDate) : '',
  notes: p?.notes || '',
});

// Edit form → PATCH body (same fields as the web PaymentForm; the invoice can't change).
// The date is sent only when it was changed (`initial` is the form as it opened), so fixing a note
// never rewrites the stored date and time.
export const paymentBody = (f, initial) => ({
  amount: Number(f.amount),
  paymentType: f.paymentType,
  paymentMethod: f.paymentMethod,
  status: f.status,
  referenceNo: String(f.referenceNo || '').trim(),
  notes: String(f.notes || '').trim(),
  ...(f.paymentDate && f.paymentDate !== initial?.paymentDate ? { paymentDate: f.paymentDate } : {}),
});

// Receipt file name: the receipt number when there is one (the web uses part of the id).
export const receiptName = (p) => `${String(p?.receiptNumber || `receipt-${String(p?._id || '').slice(-8)}`).replace(/[^\w-]/g, '_')}.pdf`;
