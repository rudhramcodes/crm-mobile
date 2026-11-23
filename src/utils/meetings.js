// Pure meeting helpers (no React/RN imports, so meetings.check.js runs under plain node).

// Start-time slots, every 30 min from 09:00 to 23:30 (same list as the web form).
export const START_SLOTS = Array.from({ length: 30 }, (_, i) => {
  const m = 9 * 60 + i * 30;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
});

export const DURATIONS = [
  [15, '15 min'], [30, '30 min'], [45, '45 min'], [60, '1 hour'], [90, '1 hr 30 min'],
  [120, '2 hours'], [150, '2 hr 30 min'], [180, '3 hours'], [240, '4 hours'],
];

export const RECURRENCE = [['none', 'Does not repeat'], ['daily', 'Daily'], ['weekly', 'Weekly'], ['monthly', 'Monthly']];

const toMin = (t) => {
  const x = /^(\d{1,2}):(\d{2})$/.exec(String(t || ''));
  return x ? Number(x[1]) * 60 + Number(x[2]) : null;
};

// Minutes between start and end, or null (the server wants end after start on the same day).
export const durationOf = (start, end) => {
  const a = toMin(start);
  const b = toMin(end);
  return a == null || b == null ? null : b - a;
};

// "HH:mm" + minutes, or '' if it would pass midnight (the server rejects that).
export const endFrom = (start, minutes) => {
  const a = toMin(start);
  if (a == null || a + minutes >= 24 * 60) return '';
  const e = a + minutes;
  return `${String(Math.floor(e / 60)).padStart(2, '0')}:${String(e % 60).padStart(2, '0')}`;
};

// Form → request body, like the web MeetingForm. Recurrence only on create.
export const meetingBody = (f, editing) => {
  const t = (v) => String(v || '').trim();
  const body = {
    title: t(f.title),
    date: f.date,
    startTime: f.startTime,
    endTime: f.endTime,
    meetingLink: t(f.meetingLink) || undefined,
    location: t(f.location) || undefined,
    notes: t(f.notes) || undefined,
    status: f.status || 'scheduled',
    brand: f.brand || null,
    client: f.client || null,
    lead: f.lead || null,
    attendees: f.attendees || [],
  };
  if (!editing && f.recurrence && f.recurrence !== 'none') {
    body.recurrence = { type: f.recurrence, interval: 1, occurrences: Number(f.occurrences) || 3 };
  }
  return body;
};

// A meeting's day ("YYYY-MM-DD"). Dates are stored as UTC midnight of the chosen day.
export const dayOf = (m) => String(m?.date || '').slice(0, 10);

// Whole month for the calendar query; dateTo covers the last day.
export const monthRange = (y, m) => {
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const mm = String(m + 1).padStart(2, '0');
  return { dateFrom: `${y}-${mm}-01`, dateTo: `${y}-${mm}-${last}T23:59:59.999Z` };
};

// SearchPick options; `match` is what the search looks through (same fields as the web pickers).
export const clientOptions = (clients = []) => clients.map((c) => ({
  value: c._id,
  label: c.companyName,
  sub: c.contactPerson || c.email || 'No contact person',
  match: [c.companyName, c.contactPerson, c.email, c.clientId].filter(Boolean).join(' '),
}));
export const leadOptions = (leads = []) => leads.map((l) => ({
  value: l._id,
  label: l.name,
  sub: l.company || l.email || 'Lead prospect',
  match: [l.name, l.company, l.email, l.phone].filter(Boolean).join(' '),
}));

export const meetingBrand =(m) => m?.brand || m?.client?.brand || m?.lead?.brand || '';

// Venture tab counts over the loaded meetings (as on the web): { '': all, brand: n }.
export const brandCounts = (meetings) => {
  const counts = { '': meetings.length };
  for (const m of meetings) {
    const b = meetingBrand(m);
    if (b) counts[b] = (counts[b] || 0) + 1;
  }
  return counts;
};

// Same rule as the server's findConflicts: another non-cancelled meeting that day whose time overlaps
// and that shares a person (creator or attendee). Returns the first clash, or undefined.
const mins = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const idOf = (x) => String((x && typeof x === 'object' ? x._id : x) || '');
export const findClash = (meetings = [], { startTime, endTime, people = [], excludeId }) => {
  if (!startTime) return undefined;
  const s = mins(startTime);
  const e = endTime ? mins(endTime) : s + 1; // only a start picked: is that minute already taken?
  const who = new Set(people.map(idOf));
  return meetings.find((m) => m.status !== 'cancelled' && m._id !== excludeId && m.startTime && m.endTime
    && s < mins(m.endTime) && mins(m.startTime) < e
    && [m.createdBy, ...(m.attendees || [])].some((p) => who.has(idOf(p))));
};
