// Self-check for the report helpers: `node src/utils/reports.check.js`
import assert from 'node:assert/strict';
import { countOf, ordered, rangeFor, revenueView } from './reports.js';

const now = new Date(2026, 10, 21, 15, 30); // 21 Nov 2026, local time
assert.deepEqual(rangeFor('all', now), {});
assert.deepEqual(rangeFor('month', now), { from: '2026-11-01', to: '2026-11-21' }); // the 1st, not the 31st
assert.deepEqual(rangeFor('lastMonth', now), { from: '2026-10-01', to: '2026-10-31' });
assert.equal(rangeFor('7d', now).from, '2026-11-15'); // today + 6 days back
assert.equal(rangeFor('year', now).from, '2026-01-01');
assert.equal(rangeFor('lastMonth', new Date(2026, 0, 10)).to, '2025-12-31'); // January → December of last year

const data = {
  summary: { totalRevenue: 6000, cashCollected: 2000, totalOutstanding: 2000, totalInvoiced: 10000 },
  charts: {
    monthlyRevenue: [{ month: '2026-11', invoiced: 10000, collected: 6000, cashCollected: 2000, outstanding: 2000 }],
    byMethod: [{ method: 'upi', amount: 6000, count: 2 }],
    cashByMethod: [{ method: 'cash', amount: 2000, count: 1 }],
  },
};
let v = revenueView(data);
assert.equal(v.collected, 6000);
assert.equal(v.rate, 60);
assert.equal(v.methods.length, 1);
assert.equal(v.months[0].rate, 60);
v = revenueView(data, true);
assert.equal(v.collected, 8000); // the cards change too
assert.equal(v.rate, 80);
assert.deepEqual(v.methods.map((m) => m.method), ['upi', 'cash']);
assert.equal(v.months[0].collected, 8000);
assert.equal(revenueView({ summary: { totalRevenue: 0, totalInvoiced: 0, totalOutstanding: 0 } }).rate, 0); // server's empty fallback

assert.equal(countOf([{ status: 'won', count: 3 }], 'won'), 3);
assert.equal(countOf(undefined, 'won'), 0);
assert.deepEqual(ordered([{ status: 'lost' }, { status: 'x' }, { status: 'new' }], ['new', 'lost']).map((s) => s.status), ['new', 'lost', 'x']);
console.log('reports.check: ok');
