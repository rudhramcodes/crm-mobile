// Self-check for the client → Contacts helpers: `node src/utils/clientContacts.check.js`
import assert from 'node:assert/strict';
import { cleanEmail, contactFor, fillMissing, last10, planContacts, titleCase, toE164 } from './clientContacts.js';

assert.equal(toE164('98765 43210'), '+919876543210');
assert.equal(toE164('+91-98765-43210'), '+919876543210');
assert.equal(toE164('09876543210'), '+919876543210');
assert.equal(toE164('919876543210'), '+919876543210');
assert.equal(toE164('+1 (212) 555-0100'), '+12125550100');
assert.equal(toE164('123'), '');
assert.equal(toE164(null), '');
assert.equal(last10('+91 98765 43210'), '9876543210');

const shah = { _id: 'c1', clientId: 'RE-PG-2026-007', contactPerson: 'bhavin SHASTRI', companyName: 'Shah Weddings', phone: '9876543210', email: ' Bhavin@Shah.in ' };
assert.deepEqual(contactFor(shah), {
  givenName: 'Bhavin', familyName: 'Shastri', company: 'RE-PG-2026-007',
  phones: [{ label: 'mobile', number: '+919876543210' }],
  emails: [{ label: 'work', address: 'bhavin@shah.in' }],
});
assert.equal(contactFor(shah, { withNote: true }).note, 'Added from Rudhram HQ');
assert.equal(contactFor(shah).note, undefined);
assert.equal(contactFor(shah).urlAddresses, undefined);
assert.equal(titleCase('  mary-jane   o\'neil '), "Mary-Jane O'Neil");
assert.equal(titleCase('RAHUL kumar shah'), 'Rahul Kumar Shah');
assert.equal(titleCase(''), '');
assert.equal(contactFor({ companyName: 'shah weddings', phone: '9876543210' }).givenName, 'Shah');
assert.equal(contactFor({ companyName: 'shah weddings', phone: '9876543210' }).familyName, 'Weddings');
assert.equal(contactFor({ companyName: 'X', phone: '9876543210' }).company, undefined); // no client ID: nothing under the name
assert.equal(contactFor({ companyName: 'X', phone: '9876543210', email: 'not-an-email' }).emails, undefined);
assert.equal(contactFor({ contactPerson: 'Asha', phone: '' }), null);
assert.equal(cleanEmail('a@b'), '');

// Already on the phone: fill only what's missing, keep what's there.
const mine = { id: 'p1', phones: [{ id: 'ph', number: '+91 98765 43210' }], emails: [{ id: 'e1', label: 'home', address: 'bhavin@gmail.com' }], company: null };
assert.deepEqual(fillMissing(mine, shah), {
  emails: [{ id: 'e1', label: 'home', address: 'bhavin@gmail.com' }, { label: 'work', address: 'bhavin@shah.in' }],
  company: 'RE-PG-2026-007',
});
const complete = { ...mine, emails: [{ id: 'e2', address: 'BHAVIN@shah.in' }], company: 'Shastri Studio' };
assert.equal(fillMissing(complete, shah), null); // nothing missing; a typed company is never replaced

const plan = planContacts(
  [
    { contactPerson: 'A', phone: '98765 43210' }, // already on the phone, nothing to add
    { contactPerson: 'B', phone: '91234 56789' },
    { contactPerson: 'C', phone: '+91 91234 56789' }, // same as B
    { contactPerson: 'D' }, // no number
    { ...shah, phone: '90000 11111' }, // on the phone without email / ID
  ],
  ['+91 98765-43210', { id: 'p9', phones: [{ number: '+919000011111' }], emails: [] }],
);
assert.equal(plan.add.length, 1);
assert.equal(plan.add[0].givenName, 'B');
assert.equal(plan.update.length, 1);
assert.equal(plan.update[0].id, 'p9');
assert.equal(plan.update[0].patch.company, 'RE-PG-2026-007');
assert.equal(plan.skipped, 2);
assert.equal(plan.noNumber, 1);
console.log('clientContacts.check: ok');
