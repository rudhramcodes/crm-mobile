// Self-check for the invoice helpers: `node src/utils/invoices.check.js`
import assert from 'node:assert/strict';
import {
  afterPayment, applyClient, applyProject, fromQuotation, invoiceActions, invoiceBody, invoiceForm, invoiceParams,
  invoiceProblem, invoiceTotals, isPastDue, markPaidBody, paidPercent, paymentDefaults, paymentProblem, paymentRequest,
} from './invoices.js';

assert.deepEqual(invoiceParams({ search: ' INV ', status: '', dateTo: '2026-11-21', page: 1 }), { search: 'INV', page: 1, dateTo: '2026-11-21T23:59:59.999' });

// 2 items, 18% GST, 10% discount: GST and discount both on the subtotal (server formula).
const t = invoiceTotals([{ quantity: '2', unitPrice: '1000' }, { quantity: 1, unitPrice: 500 }], 18, '10');
assert.deepEqual(t, { subtotal: 2500, taxAmount: 450, discountAmount: 250, total: 2700 });

assert.equal(paidPercent({ total: 2000, paidAmount: 500 }), 25);
assert.equal(paidPercent({ total: 0 }), 0);
const today = new Date('2026-11-21T10:00:00');
assert.equal(isPastDue({ status: 'sent', dueDate: '2026-11-20' }, today), true);
assert.equal(isPastDue({ status: 'sent', dueDate: '2026-11-21' }, today), false);
assert.equal(isPastDue({ status: 'paid', dueDate: '2026-01-01' }, today), false);

let a = invoiceActions({ status: 'draft' });
assert.equal(a.edit && a.send && a.remove && a.recordAdvance && a.cancel, true);
assert.equal(a.recordPayment, false);
a = invoiceActions({ status: 'partially_paid', balanceDue: 100 });
assert.equal(a.recordPayment && a.markPaid && a.resend, true);
assert.equal(a.cancel, true); // web and server allow cancelling a partially paid invoice
assert.equal(invoiceActions({ status: 'paid' }).recordPayment, false);
assert.equal(invoiceActions({ status: 'overdue', balanceDue: 5 }).cancel, true);

// Blank form like the web: one item, today, +30 days, 0% GST.
const blank = invoiceForm();
assert.equal(blank.items.length, 1);
assert.ok(blank.dueDate > blank.issueDate);
assert.equal(blank.taxRate, 0);
assert.equal(invoiceProblem(blank), 'Choose a client');

// Client fills printed fields and address except typed ones.
const c = { companyName: 'Acme', email: 'a@acme.in', clientId: 'CL-1', address: { city: 'Jaipur' } };
let f = applyClient({ ...blank, recipientName: 'Typed' }, c, new Set(['recipientName', 'billingAddress.street']));
assert.equal(f.recipientName, 'Typed');
assert.equal(f.recipientEmail, 'a@acme.in');
assert.equal(f.billingAddress.city, 'Jaipur');
assert.equal(f.billingAddress.country, 'India');
assert.equal(applyProject(f, { projectCode: 'PRJ-9' }).projectReference, 'PRJ-9');

f = { ...f, client: 'c1', items: [{ description: ' Shoot ', quantity: '2', unitPrice: '1500.5' }], taxRate: 18, discountPercent: '5', sourceQuotation: 'q1', sourceRevision: 'r1' };
assert.equal(invoiceProblem(f), '');
const body = invoiceBody(f);
assert.deepEqual(body.items, [{ description: 'Shoot', quantity: 2, unitPrice: 1500.5 }]);
assert.equal(body.discountPercent, 5);
assert.equal(body.project, null);
assert.equal(body.sourceRevision, 'r1');
assert.ok(!('sourceQuotation' in invoiceBody(f, { editing: true }))); // server refuses provenance on edit
assert.equal(invoiceProblem({ ...f, dueDate: '2000-01-01' }), 'Due date must be on or after issue date');
assert.equal(invoiceProblem({ ...f, items: [{ description: 'x', quantity: '0', unitPrice: '1' }] }), 'Quantity must be at least 1');

// Edit form from a saved invoice.
const ef = invoiceForm({ client: { _id: 'c1' }, items: [{ description: 'A', quantity: 3, unitPrice: 10 }], dueDate: '2026-12-01T00:00:00.000Z', taxRate: 5, discountPercent: 0 });
assert.equal(ef.client, 'c1');
assert.equal(ef.items[0].quantity, '3');
assert.equal(ef.dueDate, '2026-12-01');

// Quotation prefill (port of the web quotationToInvoiceDraft).
const now = new Date('2026-11-21T09:00:00');
const qd = fromQuotation(
  { _id: 'q1' },
  { _id: 'r2', content: { client: { _id: 'c1', companyName: 'Acme', email: 'a@acme.in', clientId: 'CL-1', address: { city: 'Pune' } }, project: { _id: 'p1', projectCode: 'PRJ-1' }, scopeTitle: 'Brand Kit', price: 50000, taxRate: 18, note: 'n', paymentTerms: '' } },
  now,
);
assert.equal(qd.sourceQuotation, 'q1');
assert.equal(qd.sourceRevision, 'r2');
assert.equal(qd.client, 'c1');
assert.equal(qd.project, 'p1');
assert.deepEqual(qd.items, [{ description: 'Brand Kit', quantity: 1, unitPrice: 50000 }]);
assert.equal(qd.recipientName, 'Acme');
assert.equal(qd.projectReference, 'PRJ-1');
assert.equal(qd.billingAddress.city, 'Pune');
assert.equal(qd.termsConditions, 'n'); // falls back to the note like the web
assert.equal(qd.dueDate, '2026-12-21');
assert.equal(fromQuotation({ _id: 'q', client: 'c', recipientAddress: '12 MG Road', price: 1 }).billingAddress.street, '12 MG Road');

// Payments.
const inv = { _id: 'i1', total: 10000, paidAmount: 0, balanceDue: 10000, status: 'sent' };
assert.equal(paymentDefaults(inv).paymentType, 'advance');
assert.equal(paymentDefaults({ ...inv, paidAmount: 1 }).paymentType, 'partial');
assert.equal(paymentDefaults(inv).amount, '10000');
assert.deepEqual(afterPayment(inv, '4000'), { paid: 4000, balance: 6000, status: 'partially_paid' });
assert.deepEqual(afterPayment(inv, '10000'), { paid: 10000, balance: 0, status: 'paid' });
assert.deepEqual(afterPayment(inv, '4000', 'pending'), { paid: 0, balance: 10000, status: 'sent' }); // pending doesn't count
assert.equal(paymentProblem(inv, { amount: '10001' }), 'Amount exceeds the balance due');
assert.equal(paymentProblem(inv, { amount: '0' }), 'Amount must be greater than 0');
assert.equal(paymentProblem(inv, { amount: '5000', split: true, cash: '5000' }), 'Split payment needs both a bank/UPI amount and a cash amount');
assert.equal(paymentProblem(inv, { amount: '5000', split: true, cash: '1000' }), '');

const p = { ...paymentDefaults(inv), amount: '5000', referenceNo: ' UTR1 ', notes: ' at venue ' };
assert.deepEqual(paymentRequest(inv, p).body, { invoice: 'i1', paymentType: 'advance', status: 'completed', paymentDate: p.paymentDate, amount: 5000, paymentMethod: 'upi', referenceNo: 'UTR1', notes: 'at venue' });
const s = paymentRequest(inv, { ...p, split: true, cash: '1500' });
assert.equal(s.split, true);
assert.deepEqual(s.body.payments, [
  { amount: 3500, paymentMethod: 'bank_transfer', referenceNo: 'UTR1' },
  { amount: 1500, paymentMethod: 'cash', notes: 'at venue' },
]);
assert.deepEqual(markPaidBody({ ...inv, balanceDue: 2500.004 }, 'cash'), { invoice: 'i1', amount: 2500, paymentMethod: 'cash', paymentType: 'final', status: 'completed' });
console.log('invoices.check: ok');
