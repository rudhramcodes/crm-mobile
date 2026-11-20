import { ymd } from './attendance';

// One-line quick add: "Edit teaser @ravi tomorrow 5pm !high #wedding".
// @name → person or team (my teams first), !word → priority, #word → tag, date/time words → due.
// Pure: give it the text plus the people and teams it may match; nothing is fetched here.

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const PRIORITY = { low: 'low', medium: 'medium', high: 'high', urgent: 'urgent', h: 'high', u: 'urgent' };
const squash = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const monthOf = (w) => MONTHS.indexOf(w.slice(0, 3).toLowerCase());
const dayOf = (w) => DAYS.findIndex((d) => d.startsWith(w.toLowerCase()) && w.length >= 3);

// Date words, longest first so "in 3 days" wins over a bare number. Each returns a Date (day only).
const DATE_RULES = [
  [/\bin (\d{1,2}) (day|days|week|weeks)\b/i, (m, now) => addDays(now, +m[1] * (m[2].startsWith('week') ? 7 : 1))],
  [/\b(\d{1,2})(?:st|nd|rd|th)? ([a-z]{3,9})\b/i, (m, now) => monthOf(m[2]) >= 0 && dayInMonth(+m[1], monthOf(m[2]), now)],
  [/\b([a-z]{3,9}) (\d{1,2})(?:st|nd|rd|th)?\b/i, (m, now) => monthOf(m[1]) >= 0 && dayInMonth(+m[2], monthOf(m[1]), now)],
  [/\b(today|tonight|tod)\b/i, (m, now) => now],
  [/\b(tomorrow|tmrw|tmr|kal)\b/i, (m, now) => addDays(now, 1)],
  [/\b(?:next )?(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)(?:day|sday|nesday|rsday|urday)?\b/i, (m, now) => {
    const d = dayOf(m[1]);
    return d >= 0 && addDays(now, (d - now.getDay() + 7) % 7 || (/next/i.test(m[0]) ? 7 : 0));
  }],
];
const dayInMonth = (day, month, now) => {
  if (day < 1 || day > 31) return false;
  const d = new Date(now.getFullYear(), month, day);
  return d < new Date(now.getFullYear(), now.getMonth(), now.getDate()) ? new Date(now.getFullYear() + 1, month, day) : d;
};
const TIME = /\b(?:at )?(\d{1,2})(?::(\d{2}))? ?(am|pm)\b/i;

export function parseQuickAdd(text, { me, users = [], teams = [], now = new Date() } = {}) {
  let rest = ` ${text} `;
  const take = (m) => { rest = rest.replace(m[0], ' '); };
  const people = [];
  const addPerson = (u) => u && !people.some((p) => p._id === u._id) && people.push(u);
  const tags = [];
  const bits = []; // what was understood, for the chip row
  let priority;

  for (const m of [...rest.matchAll(/(^|\s)@([\w.-]+)/g)]) {
    const w = squash(m[2]);
    const team = teams.find((t) => squash(t.name) === w) || teams.find((t) => squash(t.name).startsWith(w));
    const user = !team && (users.find((u) => squash(u.name.split(' ')[0]) === w) || users.find((u) => squash(u.name).startsWith(w)));
    if (!team && !user) continue; // unknown @word stays in the title
    if (team) { addPerson(team.lead); team.members.forEach(addPerson); bits.push({ kind: 'team', label: team.name }); }
    else { addPerson(user); bits.push({ kind: 'person', label: user.name }); }
    take(m);
  }
  for (const m of [...rest.matchAll(/(^|\s)!([a-z]+)/gi)]) {
    const p = PRIORITY[m[2].toLowerCase()];
    if (p) { priority = p; bits.push({ kind: 'priority', label: p }); take(m); }
  }
  for (const m of [...rest.matchAll(/(^|\s)#([\w-]+)/g)]) {
    tags.push(m[2].toLowerCase()); bits.push({ kind: 'tag', label: `#${m[2].toLowerCase()}` }); take(m);
  }

  let day;
  for (const [re, fn] of DATE_RULES) {
    const m = [...rest.matchAll(new RegExp(re, 'gi'))].find((x) => fn(x, now));
    if (m) { day = fn(m, now); take(m); break; }
  }
  let due = ymd(day || now);
  const t = rest.match(TIME);
  if (t && +t[1] >= 1 && +t[1] <= 12 && (!t[2] || +t[2] < 60)) {
    const at = new Date(day || now);
    at.setHours((+t[1] % 12) + (t[3].toLowerCase() === 'pm' ? 12 : 0), +(t[2] || 0), 0, 0);
    due = at.toISOString();
    take(t);
  }
  if (day || t) bits.push({ kind: 'due', label: dueText(due, now) });

  const owner = people[0] || me;
  return {
    title: rest.replace(/\s+/g, ' ').trim().replace(/\s+(by|on|due|at)$/i, ''),
    owner,
    helpers: people.slice(1).filter((p) => p._id !== owner?._id),
    dueDate: due,
    priority: priority || 'medium',
    tags,
    bits,
  };
}

export const dueText = (due, now = new Date()) => {
  const d = new Date(due.includes('T') ? due : `${due}T00:00`);
  const days = Math.round((new Date(ymd(d)) - new Date(ymd(now))) / 864e5);
  const day = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  return due.includes('T') ? `${day}, ${d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}` : day;
};
