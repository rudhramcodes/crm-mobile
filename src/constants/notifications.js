import {
  AlarmClock, AlertCircle, AlertTriangle, ArrowRightCircle, AtSign, Bell, Calendar, CalendarCheck, CalendarClock, CalendarPlus,
  CalendarX, CheckSquare, CircleCheck, ClipboardCheck, Clock, CreditCard, Eye, FileText, FolderKanban, Hourglass,
  MessageCircle, MessageSquare, PenLine, Plane, Receipt, Repeat, Trash2, Undo2, UserPlus, Users,
} from 'lucide-react-native';

// Web NOTIFICATION_CONFIG, with its rainbow tints folded into the four brand tones (DESIGN.md §1).
export const NOTIFICATION_CONFIG = {
  task_assigned: { icon: CheckSquare, tone: 'sand', label: 'Task' },
  task_due_soon: { icon: AlertTriangle, tone: 'accent', label: 'Task' },
  task_status_change: { icon: ArrowRightCircle, tone: 'sand', label: 'Task' },
  task_comment: { icon: MessageSquare, tone: 'sand', label: 'Task' },
  task_deleted: { icon: Trash2, tone: 'danger', label: 'Task' },
  task_review_requested: { icon: Eye, tone: 'accent', label: 'Review' },
  task_review_reminder: { icon: Hourglass, tone: 'accent', label: 'Review' },
  task_review_late: { icon: AlarmClock, tone: 'danger', label: 'Review' },
  task_changes_requested: { icon: PenLine, tone: 'accent', label: 'Task' },
  task_approved: { icon: CircleCheck, tone: 'success', label: 'Task' },
  task_reassigned: { icon: Users, tone: 'sand', label: 'Task' },
  task_rescheduled: { icon: CalendarClock, tone: 'sand', label: 'Task' },
  mention: { icon: AtSign, tone: 'accent', label: 'Mention' },
  project_assigned: { icon: FolderKanban, tone: 'sand', label: 'Project' },
  project_status_change: { icon: ArrowRightCircle, tone: 'sand', label: 'Project' },
  project_chat: { icon: MessageCircle, tone: 'sand', label: 'Project' },
  project_stage_reverted: { icon: Undo2, tone: 'danger', label: 'Project' },
  lead_created: { icon: UserPlus, tone: 'success', label: 'Leads' },
  lead_assigned: { icon: Users, tone: 'sand', label: 'Leads' },
  lead_converted: { icon: Repeat, tone: 'success', label: 'Leads' },
  meeting_scheduled: { icon: Calendar, tone: 'sand', label: 'Meeting' },
  meeting_reminder: { icon: Clock, tone: 'accent', label: 'Meeting' },
  meeting_requested: { icon: CalendarPlus, tone: 'accent', label: 'Meeting' },
  invoice_paid: { icon: Receipt, tone: 'success', label: 'Invoice' },
  invoice_overdue: { icon: AlertCircle, tone: 'danger', label: 'Invoice' },
  payment_received: { icon: CreditCard, tone: 'success', label: 'Payment' },
  contract_expiry: { icon: FileText, tone: 'accent', label: 'Contract' },
  regularization_request: { icon: ClipboardCheck, tone: 'accent', label: 'Attendance' },
  regularization_approved: { icon: ClipboardCheck, tone: 'success', label: 'Attendance' },
  regularization_rejected: { icon: ClipboardCheck, tone: 'danger', label: 'Attendance' },
  leave_applied: { icon: Plane, tone: 'accent', label: 'Leave' },
  leave_approved: { icon: CalendarCheck, tone: 'success', label: 'Leave' },
  leave_rejected: { icon: CalendarX, tone: 'danger', label: 'Leave' },
  leave_cancelled: { icon: CalendarX, tone: 'sand', label: 'Leave' },
  system: { icon: Bell, tone: 'sand', label: 'System' },
};

// Unknown, empty or null types fall back to the plain bell, so a new server type never breaks the Inbox.
export const notificationConfig = (type) => {
  const t = typeof type === 'string' ? type : '';
  return NOTIFICATION_CONFIG[t] ?? (t.startsWith('regularization_') ? NOTIFICATION_CONFIG.regularization_request : NOTIFICATION_CONFIG.system);
};
