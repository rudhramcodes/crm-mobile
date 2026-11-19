// Self-check for the lead status rules: `node src/utils/leads.check.js`
import assert from 'node:assert/strict';
import { cleanParams, clientIdOf, statusStep, waLink } from './leads.js';

const at = (status) => ({ status });
assert.equal(statusStep(at('new'), 'new'), 'none');
assert.equal(statusStep(at('new'), 'lost'), 'contact_first');
assert.equal(statusStep(at('contacted'), 'lost'), 'lost');
assert.equal(statusStep(at('new'), 'contacted'), 'community');
assert.equal(statusStep(at('new'), 'won'), 'community');
assert.equal(statusStep(at('proposal_sent'), 'contacted'), 'community');
assert.equal(statusStep(at('contacted'), 'won'), 'update');
assert.equal(statusStep(at('lost'), 'proposal_sent'), 'update');

assert.equal(clientIdOf({ convertedToClient: { clientId: 'RE-PG-2026-007' } }), 'RE-PG-2026-007');
assert.equal(clientIdOf({}), '');
assert.deepEqual(cleanParams({ a: '', b: 0, c: undefined, d: 'x' }), { b: 0, d: 'x' });
assert.equal(waLink('98765 43210'), 'https://wa.me/919876543210');
assert.equal(waLink('+91 98765 43210'), 'https://wa.me/919876543210');
console.log('leads.check: ok');
