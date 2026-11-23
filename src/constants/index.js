import Constants from 'expo-constants';
import {
  LayoutDashboard,
  Users,
  UserCheck,
  Calendar,
  FileSignature,
  FolderKanban,
  Receipt,
  CreditCard,
  Bell,
  Settings,
  BarChart3,
  ClipboardCheck,
  BriefcaseBusiness,
  ListTodo,
  Wallet,
  PlusCircle,
  UsersRound,
} from 'lucide-react-native';

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  MANAGER: 'manager',
  EMPLOYEE: 'employee',
  CLIENT: 'client',
};

// Office a person works from (server LOCATIONS); teams are grouped by it.
export const LOCATIONS = ['Surat', 'Mumbai', 'Delhi'];

export const ROLE_LABELS = { super_admin: 'Super admin', admin: 'Admin', manager: 'Manager', employee: 'Employee', client: 'Client' };

export const LEAD_STATUS = [
  { value: 'new', label: 'New', color: 'bg-sand text-brown' },
  { value: 'contacted', label: 'Contacted', color: 'bg-accent/15 text-accent-ink' },
  { value: 'meeting_scheduled', label: 'Meeting Scheduled', color: 'bg-ink text-bg' },
  { value: 'proposal_sent', label: 'Proposal Sent', color: 'bg-ink text-bg' },
  { value: 'won', label: 'Won', color: 'bg-success/15 text-success' },
  { value: 'lost', label: 'Lost', color: 'bg-danger/15 text-danger' },
];

export const TASK_STATUS = [
  { value: 'todo', label: 'To Do', color: 'bg-surface-2 text-muted' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-sand text-brown' },
  { value: 'review', label: 'Review', color: 'bg-accent/15 text-accent-ink' },
  { value: 'done', label: 'Done', color: 'bg-success/15 text-success' },
];

export const TASK_PRIORITY = [
  { value: 'low', label: 'Low', color: 'bg-surface-2 text-muted' },
  { value: 'medium', label: 'Medium', color: 'bg-sand text-brown' },
  { value: 'high', label: 'High', color: 'bg-accent/15 text-accent-ink' },
  { value: 'urgent', label: 'Urgent', color: 'bg-danger/15 text-danger' },
];

export const PROJECT_STAGES = [
  { value: 'brief', label: 'Brief', progress: 0 },
  { value: 'planning', label: 'Planning', progress: 20 },
  { value: 'execution', label: 'Execution', progress: 50 },
  { value: 'review', label: 'Review', progress: 80 },
  { value: 'delivered', label: 'Delivered', progress: 100 },
];

export const STAGE_PROGRESS = PROJECT_STAGES.reduce(
  (acc, stage) => ({ ...acc, [stage.value]: stage.progress }),
  {},
);

export const PROJECT_STATUS = [
  { value: 'planning', label: 'Planning', color: 'bg-ink text-bg' },
  { value: 'active', label: 'Active', color: 'bg-success/15 text-success' },
  { value: 'review', label: 'Review', color: 'bg-accent/15 text-accent-ink' },
  { value: 'completed', label: 'Completed', color: 'bg-sand text-brown' },
];

export const INVOICE_STATUS = [
  { value: 'draft', label: 'Draft', color: 'bg-surface-2 text-muted' },
  { value: 'sent', label: 'Sent', color: 'bg-sand text-brown' },
  { value: 'partially_paid', label: 'Partially Paid', color: 'bg-ink text-bg' },
  { value: 'paid', label: 'Paid', color: 'bg-success/15 text-success' },
  { value: 'overdue', label: 'Overdue', color: 'bg-danger/15 text-danger' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-surface-2 text-muted' },
];

export const QUOTATION_STATUS = [
  { value: 'draft', label: 'Draft', color: 'bg-surface-2 text-muted' },
  { value: 'sent', label: 'Sent', color: 'bg-sand text-brown' },
  { value: 'accepted', label: 'Accepted', color: 'bg-success/15 text-success' },
  { value: 'rejected', label: 'Rejected', color: 'bg-danger/15 text-danger' },
  { value: 'expired', label: 'Expired', color: 'bg-accent/15 text-accent-ink' },
];

export const BRANDS = [
  { value: 'panigrahna', label: 'Panigrahna' },
  { value: 'aghori', label: 'Aghori' },
  { value: 'house_of_joggi', label: 'House of Joggi' },
  { value: 'damrru', label: 'Damrru' },
  { value: 'tandavs', label: 'Tandavs' },
  { value: 'kapaalik', label: 'Kapaalik' },
  { value: 'kalyannam', label: 'Kalyannam' },
];

export const BRAND_METAS = {
  panigrahna: {
    label: 'Panigrahna',
    logo: 'https://res.cloudinary.com/dvsrgdyi7/image/upload/v1790058616/Panigrahna_3_cn65kz.avif',
    gradient: 'from-rose-500 to-amber-500',
    initial: 'P',
  },
  aghori: {
    label: 'Aghori',
    logo: 'https://res.cloudinary.com/dvsrgdyi7/image/upload/v1790058616/Aghhori_2_ug2a6r.avif',
    gradient: 'from-zinc-800 to-zinc-950',
    initial: 'A',
  },
  house_of_joggi: { label: 'House of Joggi', gradient: 'from-indigo-600 to-violet-600', initial: 'H' },
  damrru: { label: 'Damrru', gradient: 'from-amber-500 to-orange-600', initial: 'D' },
  tandavs: { label: 'Tandavs', gradient: 'from-emerald-500 to-teal-600', initial: 'T' },
  kapaalik: { label: 'Kapaalik', gradient: 'from-purple-600 to-pink-600', initial: 'K' },
  kalyannam: { label: 'Kalyannam', gradient: 'from-yellow-500 to-amber-600', initial: 'K' },
};

export const LEAD_BRANDS = [
  { value: 'panigrahna', label: 'Panigrahna' },
  { value: 'aghori', label: 'Aghori' },
  { value: 'house_of_joggi', label: 'House of Joggi' },
  { value: 'damrru', label: 'Damrru' },
  { value: 'tandavs', label: 'Tandavs' },
  { value: 'kapaalik', label: 'Kapaalik' },
  { value: 'kalyannam', label: 'Kalyannam' },
];

export const VENTURE_CODES = {
  panigrahna: 'PG',
  aghori: 'AG',
  house_of_joggi: 'HG',
  damrru: 'DM',
  tandavs: 'TD',
  kapaalik: 'KP',
  kalyannam: 'KL',
};

export const BRAND_COMMUNITY_NAMES = {
  panigrahna: 'Panigrahna by Rudhram Enterprises',
  aghori: 'Aghori by Rudhram Enterprises',
  house_of_joggi: 'House of Joggi by Rudhram Enterprises',
  damrru: 'Damrru by Rudhram Enterprises',
  tandavs: 'Tandavs by Rudhram Enterprises',
  kapaalik: 'Kapaalik by Rudhram Enterprises',
  kalyannam: 'Kalyannam by Rudhram Enterprises',
};

export const MEETING_STATUS = [
  { value: 'scheduled', label: 'Scheduled', color: 'bg-sand text-brown' },
  { value: 'completed', label: 'Completed', color: 'bg-success/15 text-success' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-danger/15 text-danger' },
];

export const PAYMENT_STATUS = [
  { value: 'completed', label: 'Completed', color: 'bg-success/15 text-success' },
  { value: 'pending', label: 'Pending', color: 'bg-accent/15 text-accent-ink' },
  { value: 'failed', label: 'Failed', color: 'bg-danger/15 text-danger' },
  { value: 'refunded', label: 'Refunded', color: 'bg-ink text-bg' },
];

export const PAYMENT_TYPES = [
  { value: 'advance', label: 'Advance Payment' },
  { value: 'partial', label: 'Part Payment' },
  { value: 'final', label: 'Final Payment' },
  { value: 'other', label: 'Other Payment' },
];

export const PAYMENT_METHODS = [
  { value: 'upi', label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'razorpay', label: 'Razorpay' },
  { value: 'stripe', label: 'Stripe' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'cash', label: 'Cash' },
];

export const CLIENT_STATUS = [
  { value: 'active', label: 'Active', color: 'bg-success/15 text-success' },
  { value: 'inactive', label: 'Inactive', color: 'bg-danger/15 text-danger' },
];

export const LEAD_SOURCES = [
  { value: 'google_ads', label: 'Google Ads' },
  { value: 'referral', label: 'Referral' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'website', label: 'Website' },
  { value: 'email', label: 'Email' },
  { value: 'call', label: 'Call' },
  { value: 'other', label: 'Other' },
];

// `href` overrides where a row goes (Dashboard is the Home tab).
export const NAV_ITEMS = [
  { label: 'Dashboard', path: '/dashboard', href: '/', icon: LayoutDashboard, roles: ['super_admin', 'admin', 'manager', 'employee'] },
  { label: 'Leads', path: '/leads', icon: Users, roles: ['super_admin', 'admin', 'manager', 'employee'] },
  { label: 'Clients', path: '/clients', icon: UserCheck, roles: ['super_admin', 'admin', 'manager', 'employee'] },
  { label: 'Meetings', path: '/meetings', icon: Calendar, roles: ['super_admin', 'admin', 'manager', 'employee'] },
  { label: 'Projects', path: '/projects', icon: FolderKanban, roles: ['super_admin', 'admin', 'manager', 'employee'] },
  { label: 'Tasks', path: '/tasks', icon: ListTodo, roles: ['super_admin', 'admin', 'manager', 'employee'] },
  { label: 'Quotations', path: '/quotations', icon: FileSignature, roles: ['super_admin', 'admin'] },
  { label: 'Invoices', path: '/invoices', icon: Receipt, roles: ['super_admin', 'admin'] },
  { label: 'Payments', path: '/payments', icon: CreditCard, roles: ['super_admin', 'admin'] },
  { label: 'Reports', path: '/reports', icon: BarChart3, roles: ['super_admin', 'admin'] },
  { label: 'Payroll', path: '/payroll', icon: Wallet, roles: ['super_admin', 'admin', 'manager', 'employee'], payrollOnly: true },
  { label: 'My Payslips', path: '/my-payslips', icon: Wallet, roles: ['admin', 'manager', 'employee'] },
  { label: 'Attendance', path: '/attendance', icon: ClipboardCheck, roles: ['super_admin', 'admin', 'manager', 'employee'] },
  { label: 'Teams', path: '/teams', icon: UsersRound, roles: ['super_admin', 'admin', 'manager'] },
  { label: 'Freelancers', path: '/freelancers', icon: BriefcaseBusiness, roles: ['super_admin', 'admin', 'manager'] },
  { label: 'Notifications', path: '/notifications', icon: Bell, roles: ['super_admin', 'admin', 'manager', 'employee'] },
  { label: 'Users', path: '/users', icon: Users, roles: ['super_admin', 'admin'] },
  { label: 'Settings', path: '/settings', icon: Settings, roles: ['super_admin', 'admin', 'manager', 'employee'] },
];

// Web sidebar groups (Sidebar.jsx): staff see the first set, employees the second.
export const NAV_SECTIONS = [
  { label: 'Overview', paths: ['/dashboard'] },
  { label: 'CRM & Pipeline', paths: ['/leads', '/clients', '/meetings'] },
  { label: 'Operations', paths: ['/projects', '/tasks', '/teams', '/attendance', '/freelancers'] },
  { label: 'Financials', paths: ['/quotations', '/invoices', '/payments', '/reports', '/payroll', '/my-payslips'] },
  { label: 'Administration', paths: ['/notifications', '/users', '/settings'] },
];
export const EMPLOYEE_NAV_SECTIONS = [
  { label: 'Overview', paths: ['/dashboard'] },
  { label: 'My Work', paths: ['/tasks', '/projects', '/meetings'] },
  { label: 'Self-Service & HR', paths: ['/attendance', '/my-payslips'] },
  { label: 'Sales & CRM', paths: ['/leads', '/clients'] },
  { label: 'Workspace', paths: ['/notifications', '/settings'] },
];

// Web command palette "Quick Actions"; module = the readOnlyModules key that hides it.
export const QUICK_ACTIONS = [
  { label: 'Create new lead', path: '/leads/new', icon: PlusCircle, module: 'leads', roles: ['super_admin', 'admin', 'manager', 'employee'] },
  { label: 'Add new client', path: '/clients/new', icon: PlusCircle, module: 'clients', roles: ['super_admin', 'admin', 'manager'] },
  { label: 'Generate new invoice', path: '/invoices/new', icon: PlusCircle, module: 'invoices', roles: ['super_admin', 'admin'] },
  { label: 'Create new quotation', path: '/quotations/new', icon: PlusCircle, module: 'quotations', roles: ['super_admin', 'admin'] },
  { label: 'Add new freelancer', path: '/freelancers/new', icon: PlusCircle, module: 'freelancers', roles: ['super_admin', 'admin', 'manager'] },
];

// On a phone "localhost" is the phone itself, so in dev point it at the Mac the app was loaded from.
const devHost = __DEV__ && Constants.expoConfig?.hostUri?.split(':')[0];
const reachable = (url) => (devHost ? url?.replace('localhost', devHost) : url);
export const API_BASE_URL = reachable(process.env.EXPO_PUBLIC_API_URL);
export const SOCKET_URL = reachable(process.env.EXPO_PUBLIC_SOCKET_URL);

// Attendance day statuses. `dot` fills calendar cells and legends; every cell also carries the word for screen readers.
export const ATTENDANCE_STATUS = [
  { value: 'present', label: 'Present', color: 'bg-success/15 text-success', dot: 'bg-success' },
  { value: 'wfh', label: 'WFH', color: 'bg-accent/15 text-accent-ink', dot: 'bg-accent' },
  { value: 'half_day', label: 'Half day', color: 'bg-sand text-brown', dot: 'bg-sand' },
  { value: 'absent', label: 'Absent', color: 'bg-danger/15 text-danger', dot: 'bg-danger' },
  { value: 'leave', label: 'Leave', color: 'bg-ink text-bg', dot: 'bg-ink' },
  { value: 'holiday', label: 'Holiday', color: 'bg-surface-2 text-ink', dot: 'bg-muted' },
  { value: 'weekend', label: 'Weekend', color: 'bg-surface-2 text-muted', dot: 'bg-line' },
];

export const LEAVE_TYPES = [
  { value: 'casual', label: 'Casual' },
  { value: 'sick', label: 'Sick' },
  { value: 'maternity', label: 'Maternity' },
  { value: 'paternity', label: 'Paternity' },
];

export const REQUEST_STATUS = [
  { value: 'pending', label: 'Pending', color: 'bg-accent/15 text-accent-ink' },
  { value: 'approved', label: 'Approved', color: 'bg-success/15 text-success' },
  { value: 'rejected', label: 'Rejected', color: 'bg-danger/15 text-danger' },
];

export const HOLIDAY_TYPES = [
  { value: 'national', label: 'National', color: 'bg-ink text-bg' },
  { value: 'company', label: 'Company', color: 'bg-sand text-brown' },
  { value: 'optional', label: 'Optional', color: 'bg-surface-2 text-muted' },
];

// Settings (same lists as the web settings tabs).
export const NOTIF_PREF_GROUPS = [
  { label: 'Tasks', types: [['task_assigned', 'Task assigned'], ['task_status_change', 'Task status change'], ['task_comment', 'Task comment'], ['mention', 'Mentions']] },
  { label: 'Projects', types: [['project_assigned', 'Project assigned'], ['project_status_change', 'Project status change'], ['project_chat', 'Project chat']] },
  { label: 'Leads', types: [['lead_created', 'New lead'], ['lead_assigned', 'Lead assigned']] },
  { label: 'Meetings', types: [['meeting_scheduled', 'Meeting scheduled'], ['meeting_reminder', 'Meeting reminder']] },
  { label: 'Money', types: [['invoice_paid', 'Invoice paid'], ['invoice_overdue', 'Invoice overdue'], ['payment_received', 'Payment received']] },
];
export const TIMEZONES = ['Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Asia/Shanghai', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Europe/London', 'Europe/Berlin', 'Europe/Paris', 'Australia/Sydney', 'Pacific/Auckland', 'UTC'].map((v) => ({ value: v, label: v }));
export const DATE_FORMATS = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD', 'DD MMM YYYY'].map((v) => ({ value: v, label: v }));
export const CURRENCIES = [
  { value: 'INR', label: '₹ INR' }, { value: 'USD', label: '$ USD' }, { value: 'EUR', label: '€ EUR' },
  { value: 'GBP', label: '£ GBP' }, { value: 'AED', label: 'د.إ AED' }, { value: 'SGD', label: 'S$ SGD' },
];
export const LANGUAGES = [{ value: 'en', label: 'English' }, { value: 'hi', label: 'Hindi' }, { value: 'mr', label: 'Marathi' }, { value: 'gu', label: 'ગુજરાતી' }];
export const PERMISSION_GROUPS = [
  { module: 'Users', prefix: 'users', perms: ['read', 'create', 'update', 'delete', 'manage_roles'] },
  ...['Leads', 'Clients', 'Projects', 'Tasks', 'Invoices', 'Payments', 'Meetings'].map((m) => ({ module: m, prefix: m.toLowerCase(), perms: ['read', 'create', 'update', 'delete'] })),
  { module: 'Reports', prefix: 'reports', perms: ['read', 'create'] },
  { module: 'Settings', prefix: 'settings', perms: ['read', 'update'] },
];
export const ROLE_DESCRIPTIONS = {
  super_admin: 'Full control across the entire workspace',
  admin: 'Manage operations, people, and settings',
  manager: 'Coordinate teams, work, and reports',
  employee: 'Access assigned work and collaboration tools',
  client: 'View shared projects, tasks, and billing',
};
