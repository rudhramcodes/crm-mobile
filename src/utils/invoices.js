// Pure invoice helpers (no React/RN imports, so invoices.check.js runs under plain node).
// Rules copied from the web (modules/invoices/*) and the server (invoice.model.js, invoice.service.js).

const ymdOf = (d) => (d ? String(d).slice(0, 10) : '');
const dayOf = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const addDays = (n, from = new Date()) => {
  const d = new Date(from);
  d.setDate(d.getDate() + n);
  return dayOf(d);
};

// Filters → /invoices query. Empty values dropped; "To" covers the whole day (server compares issueDate as a Date).
export function invoiceParams({ search, status, brand, dateFrom, dateTo, page, limit } = {}) {
  const p = { search: search?.trim(), status, brand, page, limit };
  if (dateFrom) p.dateFrom = `${dateFrom}T00:00:00.000`;
  if (dateTo) p.dateTo = `${dateTo}T23:59:59.999`;
  return Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined && v !== null && v !== ''));
}

// Same maths as the server's pre-save hook: GST and discount both on the subtotal, total = subtotal + GST − discount.
export function invoiceTotals(items = [], taxRate = 0, discountPercent = 0) {
  const subtotal = items.reduce((s, i) => s + (parseFloat(i.quantity) || 0) * (parseFloat(i.unitPrice) || 0), 0);
  const taxAmount = (subtotal * (parseFloat(taxRate) || 0)) / 100;
  const discountAmount = (subtotal * (parseFloat(discountPercent) || 0)) / 100;
  return { subtotal, taxAmount, discountAmount, total: subtotal + taxAmount - discountAmount };
}

// Paid share of the total, 0–100.
export const paidPercent = (inv) => (inv?.total ? Math.min(100, Math.round(((inv.paidAmount || 0) / inv.total) * 100)) : 0);

// Due date passed on an invoice still owed: shown red even before the nightly overdue job runs.
export function isPastDue(inv, today = new Date()) {
  if (!inv?.dueDate || !['sent', 'partially_paid', 'overdue'].includes(inv.status)) return false;
  const end = new Date(inv.dueDate);
  end.setHours(23, 59, 59, 999);
  return end < today;
}

// Which buttons the detail screen shows, by status (web InvoiceDetail rules).
export function invoiceActions(inv) {
  const s = inv?.status;
  const open = ['sent', 'overdue', 'partially_paid'].includes(s);
  return {
    edit: s === 'draft',
    send: s === 'draft',
    remove: s === 'draft',
    recordAdvance: s === 'draft',
    recordPayment: open,
    markPaid: open && (inv.balanceDue || 0) > 0,
    resend: open,
    cancel: s === 'draft' || open,
  };
}

export const PRINTED_FIELDS = [
  'recipientName', 'recipientEmail', 'recipientPhone', 'recipientGst',
  'clientReference', 'projectReference', 'issuerName', 'issuerAddress',
  'issuerEmail', 'issuerPhone', 'issuerGst', 'bankName', 'bankAccountName',
  'bankAccountNumber', 'bankIfsc', 'bankGst', 'bankUpi', 'signatoryName',
];
const ADDRESS = ['street', 'city', 'state', 'pincode', 'country'];
const emptyAddress = () => ({ street: '', city: '', state: '', pincode: '', country: 'India' });
const newItem = () => ({ description: '', quantity: '1', unitPrice: '0' });
export { newItem };

// Form state: from an existing invoice (edit), a quotation prefill, or blank (web InvoiceForm defaults).
export function invoiceForm(initial) {
  const i = initial || {};
  return {
    ...Object.fromEntries(PRINTED_FIELDS.map((k) => [k, i[k] ?? ''])),
    client: i.client?._id || i.client || '',
    project: i.project?._id || i.project || '',
    sourceQuotation: i.sourceQuotation?._id || i.sourceQuotation || '',
    sourceRevision: i.sourceRevision || '',
    issueDate: ymdOf(i.issueDate) || addDays(0),
    dueDate: initial ? ymdOf(i.dueDate) : addDays(30),
    items: (i.items?.length ? i.items : [{ description: '', quantity: 1, unitPrice: 0 }]).map((x) => ({
      description: x.description || '',
      quantity: String(x.quantity ?? 1),
      unitPrice: String(x.unitPrice ?? 0),
    })),
    taxRate: Number(i.taxRate ?? 0),
    discountPercent: String(i.discountPercent ?? 0),
    billingAddress: { ...emptyAddress(), ...(i.billingAddress || {}) },
    notes: i.notes || '',
    termsConditions: i.termsConditions || '',
  };
}

// Picking a client fills the printed recipient fields and billing address, except ones the user typed in (web behaviour).
export function applyClient(f, client, dirty = new Set()) {
  if (!client) return f;
  const next = { ...f };
  const printed = {
    recipientName: client.companyName || '',
    recipientEmail: client.email || '',
    recipientPhone: client.phone || '',
    recipientGst: client.gstNumber || '',
    clientReference: client.clientId || '',
  };
  for (const [k, v] of Object.entries(printed)) if (!dirty.has(k)) next[k] = v;
  if (client.address && typeof client.address === 'object') {
    next.billingAddress = { ...f.billingAddress };
    for (const k of ADDRESS) {
      if (!dirty.has(`billingAddress.${k}`)) next.billingAddress[k] = client.address[k] || (k === 'country' ? 'India' : '');
    }
  }
  return next;
}

// Picking a project fills the printed project reference unless typed in.
export const applyProject = (f, project, dirty = new Set()) =>
  (project && !dirty.has('projectReference') ? { ...f, projectReference: project.projectCode || '' } : f);

// Form → POST/PATCH body (web handleFormSubmit). Source fields only on create; the server refuses them on edit.
export function invoiceBody(f, { editing = false } = {}) {
  return {
    ...Object.fromEntries(PRINTED_FIELDS.map((k) => [k, String(f[k] ?? '').trim()])),
    client: f.client,
    project: f.project || null,
    ...(!editing && f.sourceQuotation ? { sourceQuotation: f.sourceQuotation } : {}),
    ...(!editing && f.sourceRevision ? { sourceRevision: f.sourceRevision } : {}),
    issueDate: f.issueDate,
    dueDate: f.dueDate,
    items: f.items.map((x) => ({ description: x.description.trim(), quantity: parseFloat(x.quantity), unitPrice: parseFloat(x.unitPrice) })),
    taxRate: parseFloat(f.taxRate) || 0,
    discountPercent: parseFloat(f.discountPercent) || 0,
    billingAddress: Object.fromEntries(ADDRESS.map((k) => [k, String(f.billingAddress?.[k] ?? '').trim()])),
    notes: f.notes.trim(),
    termsConditions: f.termsConditions.trim(),
  };
}

// What stops the form saving (web zod schema), or '' when it can be saved.
export function invoiceProblem(f) {
  if (!f.client) return 'Choose a client';
  if (!f.issueDate || !f.dueDate) return 'Set the issue and due dates';
  if (f.dueDate < f.issueDate) return 'Due date must be on or after issue date';
  if (!f.items.length) return 'Add at least one item';
  if (f.items.some((x) => !x.description.trim())) return 'Every item needs a description';
  if (f.items.some((x) => !(parseFloat(x.quantity) >= 1))) return 'Quantity must be at least 1';
  if (f.items.some((x) => !(parseFloat(x.unitPrice) >= 0))) return 'Rate must be 0 or more';
  const d = parseFloat(f.discountPercent);
  if (Number.isNaN(d) || d < 0 || d > 100) return 'Discount must be 0–100%';
  return '';
}

// Port of the web quotationToInvoiceDraft: one line item from the quotation (version) price, its GST, notes and terms.
export function fromQuotation(root, revision = null, now = new Date()) {
  const q = revision ? revision.content : root;
  const ca = (q.client && typeof q.client === 'object' && q.client.address) || {};
  const billingAddress = q.recipientAddress
    ? { street: q.recipientAddress, city: '', state: '', pincode: '', country: 'India' }
    : { street: ca.street || '', city: ca.city || '', state: ca.state || '', pincode: ca.pincode || '', country: ca.country || 'India' };
  return {
    ...Object.fromEntries(PRINTED_FIELDS.map((k) => [k, q[k] ?? ''])),
    recipientName: q.recipientName ?? q.client?.companyName ?? '',
    recipientEmail: q.recipientEmail ?? q.client?.email ?? '',
    recipientPhone: q.recipientPhone ?? q.client?.phone ?? '',
    recipientGst: q.recipientGst ?? q.client?.gstNumber ?? '',
    clientReference: q.clientReference ?? q.client?.clientId ?? '',
    projectReference: q.projectReference ?? q.project?.projectCode ?? '',
    sourceQuotation: root._id,
    ...(revision ? { sourceRevision: revision._id } : {}),
    client: q.client?._id || q.client,
    project: q.project?._id || q.project || '',
    issueDate: dayOf(now),
    dueDate: addDays(30, now),
    items: [{ description: q.scopeTitle || q.subject || 'Services', quantity: 1, unitPrice: Number(q.price || 0) }],
    taxRate: Number(q.taxRate ?? 0),
    discountPercent: 0,
    billingAddress,
    notes: q.note || '',
    termsConditions: q.paymentTerms || q.note || '',
  };
}

// ---- Recording payments (web PaymentForm / "Mark as paid") ----

const round2 = (n) => Math.round(n * 100) / 100;

// Advance when nothing is paid yet, otherwise a part payment; amount defaults to the whole balance.
export const paymentDefaults = (inv) => ({
  paymentType: (inv?.paidAmount || 0) > 0 ? 'partial' : 'advance',
  amount: String(round2(inv?.balanceDue || 0)),
  paymentMethod: 'upi',
  status: 'completed',
  referenceNo: '',
  paymentDate: dayOf(new Date()),
  notes: '',
  split: false,
  cash: '',
});

// "After this payment" preview: only completed payments count toward the invoice (server rule).
export function afterPayment(inv, amount, status = 'completed') {
  const add = status === 'completed' ? parseFloat(amount) || 0 : 0;
  const paid = Math.min(inv.total || 0, (inv.paidAmount || 0) + add);
  const balance = round2((inv.total || 0) - paid);
  const next = paid <= 0 ? inv.status : balance <= 0 ? 'paid' : 'partially_paid';
  return { paid, balance, status: next };
}

// What stops the payment, or '' (web PaymentForm validation; server also refuses more than the balance).
export function paymentProblem(inv, p) {
  const amount = parseFloat(p.amount);
  if (!(amount > 0)) return 'Amount must be greater than 0';
  if (amount > round2(inv.balanceDue || 0) + 0.001) return `Amount exceeds the balance due`;
  if (p.split) {
    const cash = parseFloat(p.cash);
    if (!(cash > 0) || !(amount - cash > 0)) return 'Split payment needs both a bank/UPI amount and a cash amount';
  }
  return '';
}

// Body for POST /payments, or POST /payments/split (bank/UPI part carries the reference, cash part the notes, as on the web).
export function paymentRequest(inv, p) {
  const common = { invoice: inv._id, paymentType: p.paymentType, status: p.status, ...(p.paymentDate ? { paymentDate: p.paymentDate } : {}) };
  const amount = round2(parseFloat(p.amount));
  if (p.split) {
    const cash = round2(parseFloat(p.cash));
    return {
      split: true,
      body: {
        ...common,
        payments: [
          { amount: round2(amount - cash), paymentMethod: 'bank_transfer', referenceNo: p.referenceNo.trim() },
          { amount: cash, paymentMethod: 'cash', notes: p.notes.trim() },
        ],
      },
    };
  }
  return { split: false, body: { ...common, amount, paymentMethod: p.paymentMethod, referenceNo: p.referenceNo.trim(), notes: p.notes.trim() } };
}

// One-tap "Mark as paid" / "Collect remaining": the whole balance as a final, completed payment.
export const markPaidBody = (inv, paymentMethod) => ({ invoice: inv._id, amount: round2(inv.balanceDue || 0), paymentMethod, paymentType: 'final', status: 'completed' });
