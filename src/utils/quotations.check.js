// Self-check for the quotation helpers: `node src/utils/quotations.check.js`
import assert from 'node:assert/strict';
import {
  applyDefaults, applyProject, defaultSelection, docBody, docForm, isPastValid, money, pdfTarget,
  quotationParams, recommendedTemplate, versionActions, versionOptions,
} from './quotations.js';

assert.equal(recommendedTemplate('panigrahna'), 'panigrahna');
assert.equal(recommendedTemplate('aghori'), 'standard');

// New form starts like the web: today, +30 days, 18% GST, standard template, suggested deliverables/note/sign-off.
const blank = docForm();
assert.equal(blank.taxRate, 18);
assert.equal(blank.templateId, 'standard');
assert.ok(blank.validUntil > blank.issueDate);
assert.ok(blank.deliverables.startsWith('Brand Identity Design'));

// Server defaults fill only untouched fields; "Restore suggested text" forces them back.
const defs = { salutation: 'Dear Asha,', scopeOfWork: ['Day 1 - 2 shooters', 'Day 2 - drone'], budget: 90000, validUntil: '2026-12-21T00:00:00.000Z', recipientName: 'Asha' };
let d = applyDefaults({ ...blank, salutation: 'Hi team' }, defs, ['salutation', 'scopeOfWork', 'budget', 'validUntil', 'recipientName'], new Set(['salutation']));
assert.equal(d.salutation, 'Hi team'); // user's own text kept
assert.equal(d.scopeOfWork, 'Day 1 - 2 shooters\nDay 2 - drone');
assert.equal(d.budget, '90000');
assert.equal(d.validUntil, '2026-12-21');
assert.equal(d.recipientName, 'Asha');
d = applyDefaults(d, defs, ['salutation'], new Set(['salutation']), true);
assert.equal(d.salutation, 'Dear Asha,');
assert.equal(applyDefaults(blank, null, ['salutation']), blank);

// Project fills budget / scope heading / subject unless typed in.
const pj = applyProject(blank, { title: 'Brand Kit 2.0', budget: 50000 }, new Set(['budget']));
assert.equal(pj.budget, '0');
assert.equal(pj.scopeTitle, 'Brand Kit 2.0');
assert.equal(pj.subject, 'Submission of Quotation for Professional Brand Kit 2.0.');

// Body: numbers parsed, scope split into lines, empty project → null; edit (locked) leaves client/project out.
const body = docBody({ ...d, client: 'c1', project: '', price: '150000', budget: '', taxRate: 5, scopeOfWork: ' a \n\n b ' });
assert.equal(body.client, 'c1');
assert.equal(body.project, null);
assert.equal(body.price, 150000);
assert.equal(body.budget, 0);
assert.equal(body.taxRate, 5);
assert.deepEqual(body.scopeOfWork, ['a', 'b']);
assert.equal(body.recipientName, 'Asha');
assert.ok(!('client' in docBody(d, { lockIdentity: true })));

// Editing a working draft starts from its content.
const fromDraft = docForm({ client: 'c9', templateId: 'panigrahna', price: 5000, taxRate: 0, scopeOfWork: ['x', 'y'], issueDate: '2026-11-02T00:00:00.000Z', budget: 0 });
assert.equal(fromDraft.client, 'c9');
assert.equal(fromDraft.price, '5000');
assert.equal(fromDraft.taxRate, 0);
assert.equal(fromDraft.scopeOfWork, 'x\ny');
assert.equal(fromDraft.issueDate, '2026-11-02');

assert.deepEqual(quotationParams({ search: ' QTN ', status: '', archived: false, dateTo: '2026-11-21', page: 1 }), {
  search: 'QTN', page: 1, dateTo: '2026-11-21T23:59:59.999',
});
assert.equal(quotationParams({ archived: true }).archived, 'true');

assert.deepEqual(money({ price: 10000, taxRate: 18 }), { price: 10000, taxRate: 18, taxAmount: 1800, total: 11800, budget: 0 });
assert.equal(money({ price: 100, taxRate: 0 }).total, 100);

const q = {
  _id: 'q1', quotationNumber: 'QTN-PG-0007', schemaVersion: 2, latestVersion: 2, workingCopy: null, archivedAt: null,
  revisions: [{ version: 1, status: 'rejected', sentAt: '2026-10-01' }, { version: 2, status: 'draft', sentAt: null }],
};
assert.deepEqual(versionOptions(q).map((o) => o.label), ['V2', 'V1']);
assert.equal(defaultSelection(q), 2);
let a = versionActions(q, 2);
assert.equal(a.send, true);
assert.equal(a.resend, false);
assert.deepEqual(a.status, ['accepted', 'rejected']);
assert.equal(a.createRevision, true);
a = versionActions(q, 1);
assert.equal(a.send, false);
assert.equal(a.resend, true);
assert.deepEqual(a.status, []); // rejected: no more decisions
assert.deepEqual(versionActions({ ...q, revisions: [{ version: 2, status: 'sent', sentAt: 'x' }] }, 2).status, ['accepted', 'rejected', 'expired']);

const draft = { ...q, workingCopy: { baseVersion: 2, editVersion: 3, content: {} } };
assert.deepEqual(versionOptions(draft)[0], { key: 'working', label: 'Working draft' });
assert.deepEqual(versionActions(draft, 'working'), { edit: true, save: true, discard: true, archive: true });
assert.equal(versionActions(draft, 2).openWorking, true);
assert.equal(versionActions({ ...draft, latestVersion: 0, revisions: [] }, 'working').discard, false); // V0 can't be discarded
assert.equal(defaultSelection({ ...draft, latestVersion: 0 }), 'working');
assert.deepEqual(versionActions({ ...q, archivedAt: '2026-11-01' }, 2), { restore: true });

const legacy = { _id: 'l1', quotationNumber: 'QTN-AG-0001', status: 'sent', sentAt: 'x' };
assert.deepEqual(versionActions(legacy).legacyStatus, ['accepted', 'rejected', 'expired']);
assert.equal(versionActions(legacy).legacyDelete, false);
assert.deepEqual(versionOptions(legacy), []);

assert.deepEqual(pdfTarget(q, 2), { path: '/quotations/q1/revisions/2/pdf', name: 'QTN-PG-0007-V2.pdf' });
assert.equal(pdfTarget(draft, 'working').path, '/quotations/q1/working-copy/pdf');
assert.equal(pdfTarget(legacy).path, '/quotations/l1/pdf');

const today = new Date('2026-11-21T10:00:00');
assert.equal(isPastValid({ status: 'sent', validUntil: '2026-11-20' }, today), true);
assert.equal(isPastValid({ status: 'sent', validUntil: '2026-11-21' }, today), false); // valid through the whole day
assert.equal(isPastValid({ status: 'accepted', validUntil: '2026-01-01' }, today), false);
console.log('quotations.check: ok');
