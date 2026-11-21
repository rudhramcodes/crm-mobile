// Self-check for the payment helpers: `node src/utils/payments.check.js`
import assert from 'node:assert/strict';
import { localDay, maxEditable, paymentBody, paymentForm, paymentParams, receiptName } from './payments.js';

assert.deepEqual(paymentParams({ search: '  UTR1 ', status: '', brand: 'aghori', dateFrom: '2026-11-01', dateTo: '2026-11-21', page: 2, limit: 20 }), {
  search: 'UTR1', brand: 'aghori', page: 2, limit: 20, dateFrom: '2026-11-01T00:00:00.000', dateTo: '2026-11-21T23:59:59.999',
});
assert.deepEqual(paymentParams({ search: '   ' }), {});

assert.equal(maxEditable({ amount: 4000, status: 'completed', invoice: { balanceDue: 6000 } }), 10000);
assert.equal(maxEditable({ amount: 4000, status: 'pending', invoice: { balanceDue: 6000 } }), 6000); // pending isn't counted yet
assert.equal(maxEditable({ amount: 4000, status: 'completed', invoice: { balanceDue: 0 } }), 4000); // settled invoice
assert.equal(maxEditable({ amount: 1, invoice: null }), null);

const f = paymentForm({ amount: 2500, paymentMethod: 'cash', paymentDate: '2026-11-20T10:00:00.000Z', referenceNo: ' ' });
assert.equal(f.amount, '2500');
assert.equal(f.paymentDate, '2026-11-20');
const b = paymentBody({ ...f, notes: '  paid at venue ' }, f);
assert.equal(b.amount, 2500);
assert.equal(b.referenceNo, '');
assert.equal(b.notes, 'paid at venue');
assert.equal(b.paymentDate, undefined); // date untouched → not re-sent, the stored time stays
assert.equal(paymentBody({ ...f, paymentDate: '2026-11-22' }, f).paymentDate, '2026-11-22'); // changed → sent
assert.equal(paymentBody({ ...f, paymentDate: '' }, f).paymentDate, undefined);

// Recorded 21 Nov 01:00 IST = 20 Nov 19:30 UTC: the form shows the device's day, not the UTC one.
const early = '2026-11-20T19:30:00.000Z';
const d = new Date(early);
assert.equal(localDay(early), `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
assert.equal(paymentForm({ paymentDate: early }).paymentDate, localDay(early));
if (-d.getTimezoneOffset() === 330) assert.equal(localDay(early), '2026-11-21'); // on an IST device
assert.equal(localDay('nope'), '');

assert.equal(receiptName({ receiptNumber: 'RCT-2026-ABC123' }), 'RCT-2026-ABC123.pdf');
assert.equal(receiptName({ _id: '665f1c2e9a1b2c3d4e5f6789' }), 'receipt-4e5f6789.pdf');
console.log('payments.check: ok');
