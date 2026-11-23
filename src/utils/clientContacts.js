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

// One client → a new Contacts record, or null when there's no usable number.
// Name: the contact person (company in the Company field); no person → the company name.
export const contactFor = (c) => {
  const number = toE164(c?.phone);
  if (!number) return null;
  const person = String(c.contactPerson || '').trim();
  const company = String(c.companyName || '').trim();
  const [first, ...rest] = (person || company || 'Client').split(/\s+/);
  return {
    givenName: first,
    familyName: rest.join(' ') || undefined,
    company: person && company ? company : undefined,
    phones: [{ label: 'mobile', number }],
    note: 'Rudhram CRM client',
  };
};

// Which clients to add: skips numbers already on the phone (or repeated in the list itself).
// existing: phone numbers already in Contacts. Returns { add: [record], skipped, noNumber }.
export const planContacts = (clients = [], existing = []) => {
  const seen = new Set(existing.map(last10).filter(Boolean));
  const add = [];
  let skipped = 0;
  let noNumber = 0;
  for (const c of clients) {
    const rec = contactFor(c);
    if (!rec) { noNumber += 1; continue; }
    const key = last10(rec.phones[0].number);
    if (seen.has(key)) { skipped += 1; continue; }
    seen.add(key);
    add.push(rec);
  }
  return { add, skipped, noNumber };
};
