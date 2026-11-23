import { NAV_ITEMS } from '@/constants';
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

// True when this user's More menu has the page, so a dashboard tile may link to it (e.g. managers can't open Invoices).
export const canOpenPath = (user, path) => NAV_ITEMS.some((i) => i.path === path && canSeeNavItem(user, i));

export const canUseQuickAction = (user, action) =>
  canSeeNavItem(user, { path: `/${action.module}`, roles: action.roles }) && canWriteModule(user, action.module);
