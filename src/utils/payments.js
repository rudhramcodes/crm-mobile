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

// Server record → edit form state.
export const paymentForm = (p) => ({
  amount: p?.amount != null ? String(p.amount) : '',
  paymentType: p?.paymentType || 'partial',
  paymentMethod: p?.paymentMethod || 'upi',
  status: p?.status || 'completed',
  referenceNo: p?.referenceNo || '',
  paymentDate: p?.paymentDate ? String(p.paymentDate).slice(0, 10) : '',
  notes: p?.notes || '',
});

// Edit form → PATCH body (same fields as the web PaymentForm; the invoice can't change).
export const paymentBody = (f) => ({
  amount: Number(f.amount),
  paymentType: f.paymentType,
  paymentMethod: f.paymentMethod,
  status: f.status,
  referenceNo: String(f.referenceNo || '').trim(),
  notes: String(f.notes || '').trim(),
  ...(f.paymentDate ? { paymentDate: f.paymentDate } : {}),
});

// Receipt file name: the receipt number when there is one (the web uses part of the id).
export const receiptName = (p) => `${String(p?.receiptNumber || `receipt-${String(p?._id || '').slice(-8)}`).replace(/[^\w-]/g, '_')}.pdf`;
