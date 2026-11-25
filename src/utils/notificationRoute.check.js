// Self-check for where notification taps go: `node src/utils/notificationRoute.check.js`
import assert from 'node:assert/strict';
import { appPath, staffRoute } from './notificationRoute.js';

// Staff: the item decides first.
assert.equal(staffRoute({ type: 'task_assigned', referenceModel: 'Task', referenceId: 't1', link: '/projects/p1' }), '/tasks/t1');
assert.equal(staffRoute({ type: 'task_review_late', referenceModel: 'Task', referenceId: 't1' }), '/tasks/t1');
assert.equal(staffRoute({ type: 'task_deleted', referenceModel: 'Task', referenceId: 't1' }), '/tasks');
assert.equal(staffRoute({ type: 'project_stage_reverted', referenceModel: 'Project', referenceId: 'p1' }), '/projects/p1');
assert.equal(staffRoute({ type: 'lead_assigned', referenceModel: 'Lead', referenceId: 'l1' }), '/leads/l1');
assert.equal(staffRoute({ type: 'lead_converted', referenceModel: 'Client', referenceId: 'c1' }), '/clients/c1');
assert.equal(staffRoute({ type: 'invoice_overdue', referenceModel: 'Invoice', referenceId: 'i1' }), '/invoices/i1');
assert.equal(staffRoute({ type: 'payment_received', referenceModel: 'Payment', referenceId: 'pay1' }), '/payments/pay1');
assert.equal(staffRoute({ type: 'meeting_reminder', referenceModel: 'Meeting', referenceId: 'm1' }), '/meetings/m1');
assert.equal(staffRoute({ type: 'task_due_soon', referenceModel: 'Task', referenceId: 't1', link: '/projects/p1' }), '/tasks/t1');
assert.equal(staffRoute({ type: 'task_due_soon', link: '/tasks' }), '/tasks'); // several tasks due: the Tasks tab
assert.equal(staffRoute({ type: null, link: '/attendance' }), '/attendance'); // a null type never crashes
// Types with fixed screens.
assert.equal(staffRoute({ type: 'leave_applied', referenceModel: 'LeaveRequest', referenceId: 'x' }), '/attendance/leaves');
assert.equal(staffRoute({ type: 'leave_rejected' }), '/attendance/leaves');
assert.equal(staffRoute({ type: 'regularization_request', referenceModel: 'Attendance', referenceId: 'a' }), '/attendance/regularization');
assert.equal(staffRoute({ type: 'regularization_approved' }), '/attendance');
// Server link as a fallback, only for known app sections.
assert.equal(staffRoute({ type: 'meeting_requested', referenceModel: 'User', referenceId: 'u', link: '/meetings/new?title=Call' }), '/meetings/new?title=Call');
assert.equal(staffRoute({ type: 'system', link: '/attendance' }), '/attendance');
assert.equal(staffRoute({ type: 'system', link: '/dashboard' }), '/');
assert.equal(staffRoute({ type: 'system', link: 'https://crm.rudhram.com/invoices/i9' }), '/invoices/i9');
assert.equal(staffRoute({ type: 'system', link: '/something-else' }), '/notifications');
assert.equal(staffRoute({ type: 'system', link: 'javascript:alert(1)' }), '/notifications');
assert.equal(staffRoute({ type: 'system' }), '/notifications');
assert.equal(staffRoute(), '/notifications');

// Old client-portal links have no screen here.
assert.equal(staffRoute({ type: 'system', link: '/portal/projects/p1' }), '/notifications');

assert.equal(appPath('//evil.com/x'), null);
assert.equal(appPath(''), null);
console.log('notificationRoute: all checks passed');
