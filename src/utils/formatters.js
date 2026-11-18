export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

export function formatCurrencyExact(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

export function formatDate(date) {
  if (!date) return 'N/A';
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date));
}

export function formatDateTime(date) {
  if (!date) return 'N/A';
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export function getStatusColor(status) {
  const colors = {
    new: 'bg-sand text-brown',
    contacted: 'bg-accent/15 text-accent-ink',
    meeting_scheduled: 'bg-ink text-bg',
    proposal_sent: 'bg-ink text-bg',
    won: 'bg-success/15 text-success',
    lost: 'bg-danger/15 text-danger',
    todo: 'bg-surface-2 text-muted',
    in_progress: 'bg-sand text-brown',
    review: 'bg-accent/15 text-accent-ink',
    done: 'bg-success/15 text-success',
    completed: 'bg-success/15 text-success',
    draft: 'bg-surface-2 text-muted',
    sent: 'bg-sand text-brown',
    paid: 'bg-success/15 text-success',
    overdue: 'bg-danger/15 text-danger',
    scheduled: 'bg-sand text-brown',
    cancelled: 'bg-surface-2 text-muted',
    active: 'bg-success/15 text-success',
    planning: 'bg-ink text-bg',
  };
  return colors[status] || 'bg-surface-2 text-muted';
}

export function getInitials(name) {
  if (!name) return '??';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function getTimeAgo(date) {
  if (!date) return '';
  const now = new Date();
  const past = new Date(date);
  const diffMs = now - past;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(date);
}

/**
 * Format decimal hours to human-readable format (e.g., 1.5 → "1h 30m", 0.05 → "3m")
 * @param {number|string|null|undefined} decimalHours - Hours in decimal format
 * @param {string} fallback - Fallback value for null/undefined/zero
 * @returns {string} Formatted duration string
 */
export function formatHours(decimalHours, fallback = '0m') {
  if (decimalHours === null || decimalHours === undefined || decimalHours === '') {
    return fallback;
  }
  const hours = Number(decimalHours);
  if (!Number.isFinite(hours) || hours < 0) return fallback;
  if (hours === 0) return '0m';

  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;

  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

/**
 * Format total minutes to human-readable format (e.g., 90 → "1h 30m", 3 → "3m")
 * @param {number|string|null|undefined} totalMinutes - Total minutes
 * @param {string} fallback - Fallback value for null/undefined/zero
 * @returns {string} Formatted duration string
 */
export function formatMinutes(totalMinutes, fallback = '0m') {
  if (totalMinutes === null || totalMinutes === undefined || totalMinutes === '') {
    return fallback;
  }
  const minutes = Number(totalMinutes);
  if (!Number.isFinite(minutes) || minutes < 0) return fallback;
  if (minutes === 0) return '0m';

  const roundedMinutes = Math.round(minutes);
  const h = Math.floor(roundedMinutes / 60);
  const m = roundedMinutes % 60;

  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

// ₹6.21L / ₹1.2Cr / ₹45.5K: short enough for a stat tile; show the full amount next to it.
export function formatCompactCurrency(amount) {
  const n = Number(amount) || 0;
  const [div, unit] = Math.abs(n) >= 1e7 ? [1e7, 'Cr'] : Math.abs(n) >= 1e5 ? [1e5, 'L'] : Math.abs(n) >= 1e3 ? [1e3, 'K'] : [1, ''];
  return `₹${Number((n / div).toFixed(div === 1 ? 0 : div === 1e3 ? 1 : 2))}${unit}`;
}
