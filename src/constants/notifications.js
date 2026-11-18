import {
  AlertCircle, AlertTriangle, ArrowRightCircle, AtSign, Bell, Calendar, CheckSquare, ClipboardCheck, Clock, CreditCard,
  FileText, FolderKanban, MessageCircle, MessageSquare, Receipt, Repeat, Trash2, UserPlus, Users,
} from 'lucide-react-native';

// Web NOTIFICATION_CONFIG, with its rainbow tints folded into the four brand tones (DESIGN.md §1).
export const NOTIFICATION_CONFIG = {
  task_assigned: { icon: CheckSquare, tone: 'sand', label: 'Task' },
  task_due_soon: { icon: AlertTriangle, tone: 'accent', label: 'Task' },
  task_status_change: { icon: ArrowRightCircle, tone: 'sand', label: 'Task' },
  task_comment: { icon: MessageSquare, tone: 'sand', label: 'Task' },
  task_deleted: { icon: Trash2, tone: 'danger', label: 'Task' },
  mention: { icon: AtSign, tone: 'accent', label: 'Mention' },
  project_assigned: { icon: FolderKanban, tone: 'sand', label: 'Project' },
  project_status_change: { icon: ArrowRightCircle, tone: 'sand', label: 'Project' },
  project_chat: { icon: MessageCircle, tone: 'sand', label: 'Project' },
  lead_created: { icon: UserPlus, tone: 'success', label: 'Leads' },
  lead_assigned: { icon: Users, tone: 'sand', label: 'Leads' },
  lead_converted: { icon: Repeat, tone: 'success', label: 'Leads' },
  meeting_scheduled: { icon: Calendar, tone: 'sand', label: 'Meeting' },
  meeting_reminder: { icon: Clock, tone: 'accent', label: 'Meeting' },
  invoice_paid: { icon: Receipt, tone: 'success', label: 'Invoice' },
  invoice_overdue: { icon: AlertCircle, tone: 'danger', label: 'Invoice' },
  payment_received: { icon: CreditCard, tone: 'success', label: 'Payment' },
  contract_expiry: { icon: FileText, tone: 'accent', label: 'Contract' },
  regularization_request: { icon: ClipboardCheck, tone: 'accent', label: 'Attendance' },
  system: { icon: Bell, tone: 'sand', label: 'System' },
};

export const notificationConfig = (type = '') =>
  NOTIFICATION_CONFIG[type] ?? (type.startsWith('regularization_') ? NOTIFICATION_CONFIG.regularization_request : NOTIFICATION_CONFIG.system);
