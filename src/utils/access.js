const PAYROLL_EMAILS = ['jaimishchhowala@rudhramenterprises.com'];

export const canWriteModule = (user, module) => Boolean(user) && !user.readOnlyModules?.includes(module);

export const canAccessPayroll = (user) => {
  if (!user) return false;
  if (user.role === 'super_admin' || user.canAccessPayroll === true) return true;
  return PAYROLL_EMAILS.includes(String(user.email || '').trim().toLowerCase());
};

const isSalesPerson = (user) => ['super_admin', 'admin', 'manager'].includes(user.role)
  || [user.department, user.profile?.department].some((d) => d?.toLowerCase() === 'sales');

// Same rules as the web sidebar: role, payroll access, and leads/clients only for sales (or read-only access).
export const canSeeNavItem = (user, item) => {
  if (!user || !item.roles.includes(user.role)) return false;
  if (item.payrollOnly && !canAccessPayroll(user)) return false;
  if ((item.path === '/leads' || item.path === '/clients') && user.role === 'employee' && !isSalesPerson(user)
    && !user.readOnlyModules?.includes(item.path.slice(1))) return false;
  return true;
};

export const canUseQuickAction = (user, action) =>
  canSeeNavItem(user, { path: `/${action.module}`, roles: action.roles }) && canWriteModule(user, action.module);
