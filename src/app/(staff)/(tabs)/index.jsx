import { useSelector } from 'react-redux';
import { AdminDashboard, EmployeeDashboard } from '@/components';

// Same split as the web /dashboard: employees get their own view, everyone else the overview.
export default function StaffHome() {
  const role = useSelector((s) => s.auth.user.role);
  return role === 'employee' ? <EmployeeDashboard /> : <AdminDashboard />;
}
