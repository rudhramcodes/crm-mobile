// Self-check for the user form helpers: `node src/utils/users.check.js`
import assert from 'node:assert/strict';
import { isStaffRole, userBody, userForm, userFormError } from './users.js';

assert.equal(isStaffRole('manager'), true);
assert.equal(isStaffRole('super_admin'), false);
assert.equal(isStaffRole('client'), false);

const f = { ...userForm(), name: ' Asha ', email: ' asha@x.com ', password: 'Secret123', dateOfJoining: '2026-11-02', ifscCode: ' hdfc0001 ', designation: ' ' };
assert.equal(userFormError(f, false), '');
assert.equal(userFormError({ ...f, password: 'secret123' }, false), 'Password must include uppercase, lowercase, and a number');
assert.equal(userFormError({ ...f, password: '' }, true), ''); // no password on edit
assert.equal(userFormError({ ...f, dateOfJoining: '' }, false), 'Date of joining is required for staff');
assert.equal(userFormError({ ...f, role: 'client', dateOfJoining: '' }, false), '');

const created = userBody({ ...f, location: 'Surat' }, { editing: false, payroll: true });
assert.equal(created.location, 'Surat');
assert.equal(userBody(f, { editing: false }).location, null);
assert.equal(userBody({ ...f, role: 'client', location: 'Surat' }, { editing: false }).location, undefined);
assert.equal(created.name, 'Asha');
assert.equal(created.password, 'Secret123');
assert.equal(created.isActive, undefined);
assert.equal(created.designation, null);
assert.equal(created.monthlyGrossSalary, 0);
assert.equal(created.ifscCode, 'HDFC0001');

const edited = userBody({ ...f, isActive: false }, { editing: true, payroll: false });
assert.equal(edited.password, undefined);
assert.equal(edited.isActive, false);
assert.equal(edited.monthlyGrossSalary, undefined);
assert.equal(userBody({ ...f, role: 'client' }, { editing: false, payroll: true }).dateOfJoining, undefined);

const u = userForm({ name: 'B', isActive: false, profile: { dateOfJoining: '2026-01-05T00:00:00.000Z' }, compensation: { monthlyGrossSalary: 0 } });
assert.equal(u.isActive, false);
assert.equal(u.monthlyGrossSalary, '0');
assert.match(u.dateOfJoining, /^2026-01-0[45]$/); // local-time date, as on the web
console.log('users.check: ok');
