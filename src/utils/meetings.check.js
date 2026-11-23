// Self-check for the meeting helpers: `node src/utils/meetings.check.js`
import assert from 'node:assert/strict';
import { START_SLOTS, brandCounts, dayOf, durationOf, endFrom, findClash, meetingBody, monthRange } from './meetings.js';

assert.equal(START_SLOTS[0], '09:00');
assert.equal(START_SLOTS.at(-1), '23:30');
assert.equal(START_SLOTS.length, 30);

assert.equal(endFrom('09:50', 60), '10:50');
assert.equal(endFrom('23:30', 45), ''); // past midnight
assert.equal(durationOf('09:00', '10:30'), 90);
assert.equal(durationOf('', '10:30'), null);

const f = { title: ' Sync ', date: '2026-11-20', startTime: '10:00', endTime: '11:00', meetingLink: ' ', brand: '', client: 'c1', attendees: ['u1'], recurrence: 'weekly', occurrences: '4' };
const b = meetingBody(f, false);
assert.equal(b.title, 'Sync');
assert.equal(b.meetingLink, undefined);
assert.equal(b.brand, null);
assert.equal(b.status, 'scheduled');
assert.deepEqual(b.recurrence, { type: 'weekly', interval: 1, occurrences: 4 });
assert.equal(meetingBody(f, true).recurrence, undefined);
assert.equal(meetingBody({ ...f, recurrence: 'none' }, false).recurrence, undefined);

assert.deepEqual(monthRange(2026, 1), { dateFrom: '2026-02-01', dateTo: '2026-02-28T23:59:59.999Z' });
assert.equal(dayOf({ date: '2026-11-20T00:00:00.000Z' }), '2026-11-20');
assert.deepEqual(brandCounts([{ brand: 'aghori' }, { client: { brand: 'aghori' } }, {}]), { '': 3, aghori: 2 });
const busy = [{ _id: 'a', status: 'scheduled', startTime: '09:00', endTime: '10:00', createdBy: { _id: 'me' }, attendees: [] }];
assert.equal(findClash(busy, { startTime: '09:00', endTime: '09:30', people: ['me'] })?._id, 'a');
assert.equal(findClash(busy, { startTime: '09:30', people: ['me'] })?._id, 'a'); // start only, inside the slot
assert.equal(findClash(busy, { startTime: '10:00', endTime: '11:00', people: ['me'] }), undefined); // back to back is fine
assert.equal(findClash(busy, { startTime: '09:00', endTime: '10:00', people: ['someone'] }), undefined); // nobody shared
assert.equal(findClash(busy, { startTime: '09:00', endTime: '10:00', people: ['me'], excludeId: 'a' }), undefined); // editing itself
assert.equal(findClash([{ ...busy[0], status: 'cancelled' }], { startTime: '09:00', endTime: '10:00', people: ['me'] }), undefined);
console.log('meetings.check: ok');
