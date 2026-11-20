// Self-check for the client helpers: `node src/utils/clients.check.js`
import assert from 'node:assert/strict';
import { GSTIN, PAN, addressOf, clientBody, hasAddress } from './clients.js';

assert.ok(GSTIN.test('22AAAAA0000A1Z5'));
assert.ok(!GSTIN.test('22aaaaa0000a1z5'));
assert.ok(!GSTIN.test('22AAAAA0000A0Z5')); // 13th char can't be 0
assert.ok(PAN.test('ABCDE1234F'));
assert.ok(!PAN.test('ABCD1234F'));

const b = clientBody({ brand: 'aghori', companyName: ' Acme ', contactPerson: 'Jo', email: ' a@b.co ', phone: ' ', gstNumber: '22aaaaa0000a1z5', panNumber: '', country: '' });
assert.equal(b.companyName, 'Acme');
assert.equal(b.email, 'a@b.co');
assert.equal(b.phone, undefined);
assert.equal(b.gstNumber, '22AAAAA0000A1Z5');
assert.equal(b.panNumber, undefined);
assert.equal(b.address.country, 'India');
assert.equal(b.status, 'active');

assert.deepEqual(addressOf('12 MG Road'), { street: '12 MG Road' });
assert.equal(hasAddress({ country: 'India' }), false);
assert.equal(hasAddress({ city: 'Pune' }), true);
assert.equal(hasAddress(null), false);
console.log('clients.check: ok');
