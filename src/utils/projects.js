import { PROJECT_STAGES } from '@/constants';
import { canWriteModule } from './access';
import { idOf } from './tasks';

// Same rules as the server (server/src/modules/projects/projectStage.js, project.routes.js):
// - managers and admins create projects
// - admins edit any project; a manager edits projects they own or are on the team of
// - everyone on staff can see every project and add tasks to it
// A module set to read-only in Settings turns all of it off, as on the web.
export const canCreateProject = (u) => canWriteModule(u, 'projects') && ['manager', 'admin', 'super_admin'].includes(u?.role);
export const canEditProject = (p, u) => {
  if (!canWriteModule(u, 'projects')) return false;
  if (['admin', 'super_admin'].includes(u?.role)) return true;
  if (u?.role !== 'manager') return false;
  return idOf(p?.ownerId) === String(u._id) || (p?.teamMembers || []).some((m) => idOf(m.user) === String(u._id));
};

export const stageOf = (v) => PROJECT_STAGES.find((s) => s.value === v);
export const stageIndex = (v) => PROJECT_STAGES.findIndex((s) => s.value === v);
export const isProjectLate = (p) => !!p?.deadline && p.stage !== 'delivered' && new Date(p.deadline) < new Date(new Date().toDateString());
export const shortDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: new Date(d).getFullYear() === new Date().getFullYear() ? undefined : 'numeric' }) : '');
