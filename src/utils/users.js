// Pure user-form helpers (no React/RN imports, so users.check.js runs under plain node). Same rules as the web UserFormModal.

// Roles that get an employee profile (ID, designation, dates) and compensation; the server's STAFF_ROLES.
// "Surat Team"; 'none' is the admins' list of staff without a location.
export const teamName = (location) => (location === 'none' ? 'No location' : `${location} Team`);

export const isStaffRole = (role) => ['admin', 'manager', 'employee'].includes(role);

// Stored date → "YYYY-MM-DD" in local time (the web's dateInput).
const dateInput = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

export const userForm = (u) => ({
  name: u?.name || '',
  email: u?.email || '',
  password: '',
  role: u?.role || 'employee',
  phone: u?.phone || '',
  location: u?.location || '',
  isActive: u?.isActive !== false,
  designation: u?.profile?.designation || '',
  dateOfJoining: dateInput(u?.profile?.dateOfJoining),
  dateOfLeaving: dateInput(u?.profile?.dateOfLeaving),
  monthlyGrossSalary: u?.compensation?.monthlyGrossSalary != null ? String(u.compensation.monthlyGrossSalary) : '',
  salaryEffectiveFrom: dateInput(u?.compensation?.salaryEffectiveFrom),
  bankName: u?.compensation?.bankName || '',
  bankAccountNumber: u?.compensation?.bankAccountNumber || '',
  ifscCode: u?.compensation?.ifscCode || '',
});

// First validation message in the web's order, or ''.
export const userFormError = (f, editing) => {
  if (!f.name.trim()) return 'Name is required';
  if (!f.email.trim()) return 'Email is required';
  if (!editing) {
    if (!f.password) return 'Password is required';
    if (f.password.length < 8) return 'Password must be at least 8 characters';
    if (!/[A-Z]/.test(f.password) || !/[a-z]/.test(f.password) || !/[0-9]/.test(f.password)) {
      return 'Password must include uppercase, lowercase, and a number';
    }
  }
  if (isStaffRole(f.role) && !f.dateOfJoining) return 'Date of joining is required for staff';
  return '';
};

// Form → request body, as the web sends it. Password only on create (the update endpoint ignores it); isActive only on edit.
export const userBody = (f, { editing, payroll }) => {
  const t = (v) => String(v || '').trim();
  const body = { name: t(f.name), email: t(f.email), role: f.role, phone: f.phone };
  body.location = f.role === 'client' ? null : f.location || null; // clients aren't in location teams
  if (!editing) body.password = f.password;
  if (editing) body.isActive = !!f.isActive;
  if (isStaffRole(f.role)) {
    body.designation = t(f.designation) || null;
    body.dateOfJoining = f.dateOfJoining;
    body.dateOfLeaving = f.dateOfLeaving || null;
    if (payroll) {
      body.monthlyGrossSalary = f.monthlyGrossSalary === '' ? 0 : Number(f.monthlyGrossSalary);
      body.salaryEffectiveFrom = f.salaryEffectiveFrom || null;
      body.bankName = t(f.bankName) || null;
      body.bankAccountNumber = t(f.bankAccountNumber) || null;
      body.ifscCode = t(f.ifscCode).toUpperCase() || null;
    }
  }
  return body;
};
