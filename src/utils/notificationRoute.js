// Where tapping a notification goes; same rules as the web app. Mobile routes keep the web paths,
// so a module not built yet lands on the "coming soon" screen instead of a dead end.
export const notificationRoute = ({ type = '', link, referenceModel, referenceId } = {}) => {
  if (type === 'regularization_request') return '/attendance/regularization';
  // Task alerts open the task itself (the web link points at its project page).
  if (referenceModel === 'Task' && referenceId && type !== 'task_deleted') return `/tasks/${referenceId}`;
  const path = link || (type.startsWith('regularization_') ? '/attendance' : '/notifications');
  return path === '/dashboard' ? '/' : path;
};
