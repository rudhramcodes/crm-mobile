// Pure lead helpers (no React/RN imports, so leads.check.js runs under plain node).

export const LEAD_ASSIGNEE_EMAIL = 'palakgupta@rudhramenterprises.com';

// Bulk status is limited to the early stages (server schema).
export const BULK_STATUSES = ['new', 'contacted', 'meeting_scheduled', 'proposal_sent'];

// What a status change needs first. Same rules as the web app; the server enforces only "lost from new".
// none | contact_first (lost from new) | lost (ask a reason) | community (group check) | update
export const statusStep = (lead, next) => {
  if (!next || next === lead.status) return 'none';
  if (next === 'lost') return lead.status === 'new' ? 'contact_first' : 'lost';
  if (lead.status === 'new' || next === 'contacted') return 'community';
  return 'update';
};

export const clientIdOf = (lead) => lead?.clientId || lead?.convertedToClient?.clientId || '';

// The server rejects empty strings for enum filters, so drop every empty value.
export const cleanParams = (p) => Object.fromEntries(Object.entries(p).filter(([, v]) => v !== '' && v != null));

const digits = (phone) => String(phone || '').replace(/\D/g, '');
// Indian numbers without a country code get +91 (the server validates phones as IN).
export const waLink = (phone) => {
  const d = digits(phone);
  return `https://wa.me/${d.length === 10 ? `91${d}` : d}`;
};
export const telLink = (phone) => `tel:${String(phone || '').replace(/[^\d+]/g, '')}`;
