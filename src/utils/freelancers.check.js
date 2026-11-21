// Self-check for the freelancer helpers: `node src/utils/freelancers.check.js`
import assert from 'node:assert/strict';
import { currentRate, formatRate, freelancerBody, freelancerForm } from './freelancers.js';

const today = new Date('2026-06-15T12:00:00Z');
const old = { amount: 3000, rateBasis: 'per_day', effectiveFrom: '2025-01-01', effectiveUntil: '2026-01-01' };
const live = { amount: 5000, rateBasis: 'per_day', effectiveFrom: '2026-01-02' };
const future = { amount: 9000, rateBasis: 'per_day', effectiveFrom: '2027-01-01' };
assert.equal(currentRate([old, live, future], today), live);
assert.equal(currentRate([old, future], today), future); // nothing live: latest start
assert.equal(currentRate([], today), undefined);
assert.equal(formatRate(live), '₹5,000 / per day');
assert.equal(formatRate({ amount: 20, currency: 'USD', rateBasis: 'per_hour' }), '$20 / per hour');

// Round trip: custom services split out on load and merged back on save; empty rates dropped.
const form = freelancerForm({
  fullName: 'Asha', phone: '9876543210', languages: ['hindi', 'english'], profilePhoto: 'https://img/a.jpg',
  ventureProfiles: [{ venture: 'panigrahna', serviceCategories: ['Drone Operator', 'Mehendi'], rateCards: [{ ...live, effectiveFrom: '2026-01-02T00:00:00.000Z' }] }],
});
assert.deepEqual(form.ventureProfiles[0].serviceCategories, ['Drone Operator']);
assert.equal(form.ventureProfiles[0].otherServices, 'Mehendi');
assert.equal(form.ventureProfiles[0].rateCards[0].effectiveFrom, '2026-01-02');
form.ventureProfiles[0].rateCards.push({ amount: '', effectiveFrom: '2026-02-01' });
form.email = ' A@B.CO ';
form.portfolioLinks = 'https://a.co\n\n https://b.co ';
const body = freelancerBody(form);
assert.equal(body.email, 'a@b.co');
assert.equal(body.profilePhoto, 'https://img/a.jpg');
assert.equal(freelancerBody(freelancerForm(null)).profilePhoto, ''); // removed photo is sent as '' so it clears
assert.deepEqual(body.languages, ['hindi', 'english']);
assert.deepEqual(body.portfolioLinks, ['https://a.co', 'https://b.co']);
assert.deepEqual(body.ventureProfiles[0].serviceCategories, ['Drone Operator', 'Mehendi']);
assert.equal(body.ventureProfiles[0].otherServices, undefined);
assert.equal(body.ventureProfiles[0].rateCards.length, 1);
assert.equal(body.ventureProfiles[0].rateCards[0].amount, 5000);
assert.equal(body.ventureProfiles[0].rateCards[0].effectiveUntil, null);
assert.equal(freelancerForm(null).ventureProfiles.length, 1);
console.log('freelancers.check: ok');
