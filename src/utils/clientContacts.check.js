// Self-check for the client → Contacts helpers: `node src/utils/clientContacts.check.js`
import assert from 'node:assert/strict';
import { contactFor, last10, planContacts, toE164 } from './clientContacts.js';

assert.equal(toE164('98765 43210'), '+919876543210');
assert.equal(toE164('+91-98765-43210'), '+919876543210');
assert.equal(toE164('09876543210'), '+919876543210');
assert.equal(toE164('919876543210'), '+919876543210');
assert.equal(toE164('+1 (212) 555-0100'), '+12125550100');
assert.equal(toE164('123'), '');
assert.equal(toE164(null), '');
assert.equal(last10('+91 98765 43210'), '9876543210');

assert.deepEqual(contactFor({ contactPerson: 'Rahul Kumar Shah', companyName: 'Shah Weddings', phone: '9876543210' }), {
  givenName: 'Rahul', familyName: 'Kumar Shah', company: 'Shah Weddings', phones: [{ label: 'mobile', number: '+919876543210' }], note: 'Rudhram CRM client',
});
assert.equal(contactFor({ companyName: 'Shah Weddings', phone: '9876543210' }).givenName, 'Shah');
assert.equal(contactFor({ companyName: 'Shah Weddings', phone: '9876543210' }).company, undefined);
assert.equal(contactFor({ contactPerson: 'Asha', phone: '' }), null);

const plan = planContacts(
  [
    { contactPerson: 'A', phone: '98765 43210' }, // already on the phone
    { contactPerson: 'B', phone: '91234 56789' },
    { contactPerson: 'C', phone: '+91 91234 56789' }, // same as B
    { contactPerson: 'D' }, // no number
  ],
  ['+91 98765-43210'],
);
assert.equal(plan.add.length, 1);
assert.equal(plan.add[0].givenName, 'B');
assert.equal(plan.skipped, 2);
assert.equal(plan.noNumber, 1);
console.log('clientContacts.check: ok');
