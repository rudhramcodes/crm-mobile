// Pure helpers for saving clients to the phone's Contacts (no React/RN imports, so clientContacts.check.js runs under plain node).

// Last 10 digits: how two numbers are compared (+91 98765 43210 and 098765-43210 are the same phone).
export const last10 = (phone) => String(phone || '').replace(/\D/g, '').slice(-10);

// Stored numbers vary ("98765 43210", "+91-98765-43210", "09876543210"); Contacts gets E.164 when we can tell.
export const toE164 = (phone) => {
  const raw = String(phone || '').trim();
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 7) return '';
  if (raw.startsWith('+')) return `+${digits}`;
  if (digits.length === 10) return `+91${digits}`; // Indian mobile without a country code
  if (digits.length === 11 && digits.startsWith('0')) return `+91${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  return digits; // unknown shape: keep it as typed, minus the punctuation
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const cleanEmail = (email) => {
  const e = String(email || '').trim().toLowerCase();
  return EMAIL.test(e) ? e : '';
};

// "bhavin SHASTRI" → "Bhavin Shastri". Also capitalises after - and ' ("mary-jane o'neil" → "Mary-Jane O'Neil").
export const titleCase = (text) => String(text || '').trim().split(/\s+/).filter(Boolean)
  .map((w) => w.toLowerCase().replace(/(^|[-'])(\p{L})/gu, (m, sep, ch) => sep + ch.toUpperCase()))
  .join(' ');

// Written into the contact's notes, so anyone can see where it came from.
export const CONTACT_NOTE = 'Added from Rudhram HQ';

// One client → a new Contacts record, or null when there's no usable number.
// Name: the contact person in title case (no person → the company name). The only line under the name is the client ID
// (Company field, the one iPhone and Android both show under the name). Email in Email. `withNote` adds
// "Added from Rudhram HQ": always on Android; on iPhone only once Apple's contact-notes permission is set up.
export const contactFor = (c, { withNote = false } = {}) => {
  const number = toE164(c?.phone);
  if (!number) return null;
  const name = titleCase(c.contactPerson) || titleCase(c.companyName) || 'Client';
  const email = cleanEmail(c.email);
  const clientId = String(c.clientId || '').trim();
  const [first, ...rest] = name.split(' ');
  const rec = {
    givenName: first,
    familyName: rest.join(' ') || undefined,
    company: clientId || undefined,
    phones: [{ label: 'mobile', number }],
  };
  if (email) rec.emails = [{ label: 'work', address: email }];
  if (withNote) rec.note = CONTACT_NOTE;
  return rec;
};

// For a contact already on the phone with this client's number: only fills what's missing (email, client ID) and
// never changes what someone typed. Lists are sent whole, so existing entries are kept as they are.
// Returns the patch, or null when there's nothing to add.
export const fillMissing = (contact, c) => {
  const patch = {};
  const email = cleanEmail(c?.email);
  const emails = contact?.emails || [];
  if (email && !emails.some((e) => cleanEmail(e.address) === email)) patch.emails = [...emails, { label: 'work', address: email }];
  const clientId = String(c?.clientId || '').trim();
  if (clientId && !String(contact?.company || '').trim()) patch.company = clientId;
  return Object.keys(patch).length ? patch : null;
};

// What to do for the picked clients. existing: contacts on the phone as { id, phones, emails, company } (plain phone-number strings also work). Returns
// { add: [record], update: [{ id, patch }], skipped, noNumber } where skipped = already there and complete.
export const planContacts = (clients = [], existing = [], opts = {}) => {
  const byNumber = new Map();
  for (const e of existing) {
    const contact = typeof e === 'string' ? { phones: [{ number: e }] } : e;
    for (const p of contact.phones || []) {
      const key = last10(p.number);
      if (key && !byNumber.has(key)) byNumber.set(key, contact);
    }
  }
  const add = [];
  const update = [];
  const touched = new Set();
  let skipped = 0;
  let noNumber = 0;
  for (const c of clients) {
    const rec = contactFor(c, opts);
    if (!rec) { noNumber += 1; continue; }
    const key = last10(rec.phones[0].number);
    if (touched.has(key)) { skipped += 1; continue; } // same number twice in the picked list
    touched.add(key);
    const contact = byNumber.get(key);
    if (!contact) { add.push(rec); continue; }
    const patch = contact.id ? fillMissing(contact, c) : null;
    if (patch) update.push({ id: contact.id, patch });
    else skipped += 1;
  }
  return { add, update, skipped, noNumber };
};
