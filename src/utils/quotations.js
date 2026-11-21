// Pure quotation helpers (no React/RN imports, so quotations.check.js runs under plain node).
// Version rules copied from the web (modules/quotations/components/QuotationVersionActions.jsx).

// Filters → /quotations query. Empty values dropped; "To" covers the whole day (server compares issueDate as a Date).
export function quotationParams({ search, status, brand, dateFrom, dateTo, archived, page, limit } = {}) {
  const p = { search: search?.trim(), status, brand, page, limit, archived: archived ? 'true' : undefined };
  if (dateFrom) p.dateFrom = `${dateFrom}T00:00:00.000`;
  if (dateTo) p.dateTo = `${dateTo}T23:59:59.999`;
  return Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined && v !== null && v !== ''));
}

export const isVersioned = (q) => q?.schemaVersion === 2;

// Price, GST and total from any content (top-level, a revision's content or the working draft). Same maths as the server.
export function money(c = {}) {
  const price = Number(c.price || 0);
  const taxRate = Number(c.taxRate ?? 18);
  const taxAmount = c.taxAmount ?? (price * taxRate) / 100;
  return { price, taxRate, taxAmount, total: c.total ?? price + taxAmount, budget: Number(c.budget || 0) };
}

// Version chips, newest first: "Working draft" (when one exists) then V{n}…V1. Legacy quotations have none.
export function versionOptions(q) {
  if (!isVersioned(q)) return [];
  const saved = [...(q.revisions || [])].sort((a, b) => b.version - a.version).map((r) => ({ key: r.version, label: `V${r.version}`, status: r.status }));
  return q.workingCopy ? [{ key: 'working', label: 'Working draft' }, ...saved] : saved;
}

// What the detail screen opens on: the latest saved version, else the working draft (a new quotation is V0).
export const defaultSelection = (q) => (isVersioned(q) && q.latestVersion ? q.latestVersion : 'working');

// Which buttons apply to the selected version; same rules as the web QuotationVersionActions.
export function versionActions(q, selection) {
  const archived = !!q?.archivedAt;
  if (!isVersioned(q)) {
    const s = q?.status;
    return {
      baseline: true,
      legacyStatus: s === 'draft' ? ['sent', 'accepted', 'rejected', 'expired'] : s === 'sent' ? ['accepted', 'rejected', 'expired'] : [],
      legacyResend: s !== 'draft' && !!q?.sentAt,
      legacyDelete: s === 'draft',
    };
  }
  if (archived) return { restore: true };
  if (selection === 'working') {
    return { edit: !!q.workingCopy, save: !!q.workingCopy, discard: !!q.workingCopy && q.latestVersion > 0, archive: true };
  }
  const r = (q.revisions || []).find((x) => x.version === selection);
  if (!r) return { archive: true };
  const decide = ['draft', 'sent'].includes(r.status);
  return {
    send: r.status === 'draft',
    resend: !!r.sentAt,
    openWorking: !!q.workingCopy,
    createRevision: !q.workingCopy,
    status: [...(decide ? ['accepted', 'rejected'] : []), ...(r.status === 'sent' ? ['expired'] : [])],
    archive: true,
  };
}

// PDF path and file name for the selected version (stored artifact for saved versions, a fresh render for the draft).
export function pdfTarget(q, selection) {
  const no = String(q?.quotationNumber || 'quotation').replace(/[^\w-]/g, '_');
  if (!isVersioned(q)) return { path: `/quotations/${q._id}/pdf`, name: `${no}.pdf` };
  if (selection === 'working') return { path: `/quotations/${q._id}/working-copy/pdf`, name: `${no}-draft.pdf` };
  return { path: `/quotations/${q._id}/revisions/${selection}/pdf`, name: `${no}-V${selection}.pdf` };
}

// Valid-until passed on a quotation still open (draft/sent): warn on the card. Nothing on the server expires it.
export function isPastValid(q, today = new Date()) {
  if (!q?.validUntil || !['draft', 'sent'].includes(q.status)) return false;
  const end = new Date(q.validUntil);
  end.setHours(23, 59, 59, 999);
  return end < today;
}

export const ymdOf = (d) => (d ? String(d).slice(0, 10) : '');

// Same suggestion as the web form: Panigrahna clients get the wedding template, everyone else the standard one.
export const TEMPLATES = [
  { value: 'standard', label: 'Standard quotation', hint: '3 pages: cover letter, scope, summary' },
  { value: 'panigrahna', label: 'Panigrahna wedding', hint: '4 pages: letter + scope, deliverables, terms, pricing' },
];
export const recommendedTemplate = (brand) => (brand === 'panigrahna' ? 'panigrahna' : 'standard');

export const GST_RATES = [0, 5, 12, 18, 28];

// ---- Full quotation form (same fields, defaults and rules as the web QuotationForm) ----

export const PRINTED_FIELDS = [
  'recipientName', 'recipientAddress', 'recipientEmail', 'recipientPhone', 'recipientGst',
  'clientReference', 'projectReference', 'issuerName', 'issuerAddress', 'issuerEmail',
  'issuerPhone', 'issuerWebsite', 'issuerGst', 'bankName', 'bankAccountName',
  'bankAccountNumber', 'bankIfsc', 'bankGst', 'bankUpi', 'signatoryName',
  'closingNote', 'paymentTerms', 'conditions',
];
// Fields the server's /quotations/defaults can fill; the form only overwrites the ones the user hasn't typed in.
export const DEFAULTABLE = [
  'salutation', 'subject', 'letterBody', 'letterSignoff', 'scopeTitle',
  'scopeIntro', 'scopeOfWork', 'deliverables', 'note', 'budget', 'price', 'validUntil',
  ...PRINTED_FIELDS,
];
const TEXT_FIELDS = ['salutation', 'subject', 'scopeTitle', 'scopeIntro', 'scopeOfWork', 'deliverables', 'note', 'letterBody', 'letterSignoff', ...PRINTED_FIELDS];

const addDays = (n, from = new Date()) => {
  const d = new Date(from);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
// A field value as the form holds it: numbers and dates as strings, scope lines as one text block.
const asField = (name, v) => {
  if (v == null) return '';
  if (name === 'scopeOfWork') return Array.isArray(v) ? v.join('\n') : String(v);
  if (name === 'validUntil' || name === 'issueDate') return ymdOf(v);
  return String(v);
};

// Form state: from existing content (edit working draft) or the web's blank-form starting values (new).
export function docForm(initial) {
  if (initial) {
    return {
      templateId: initial.templateId || recommendedTemplate(initial.client?.brand),
      client: initial.client?._id || initial.client || '',
      project: initial.project?._id || initial.project || '',
      issueDate: ymdOf(initial.issueDate) || addDays(0),
      validUntil: ymdOf(initial.validUntil),
      budget: String(initial.budget ?? 0),
      price: String(initial.price ?? 0),
      taxRate: Number(initial.taxRate ?? 18),
      ...Object.fromEntries(TEXT_FIELDS.map((k) => [k, asField(k, initial[k])])),
    };
  }
  return {
    templateId: 'standard',
    client: '',
    project: '',
    issueDate: addDays(0),
    validUntil: addDays(30),
    budget: '0',
    price: '0',
    taxRate: 18,
    ...Object.fromEntries(TEXT_FIELDS.map((k) => [k, ''])),
    deliverables: 'Brand Identity Design\nLogo & Visual Assets\nPrint & Digital Collateral\nSocial Media Creatives\nFinal Files (Source + Export Formats)',
    note: 'Payment Terms: 50% advance along with the confirmation, 50% before final delivery.\nGST @18% is applicable as quoted.\nAny additional scope will be quoted separately.',
    letterSignoff: 'Warm Regards,\nRudhram Enterprises',
  };
}

// Fill `fields` from the server's suggested defaults, skipping ones the user edited (unless force: "Restore suggested text").
export function applyDefaults(f, defaults, fields, dirty = new Set(), force = false) {
  if (!defaults) return f;
  const next = { ...f };
  for (const name of fields) {
    if (!force && dirty.has(name)) continue;
    const v = defaults[name];
    if (v === undefined || v === null) continue;
    next[name] = asField(name, v);
  }
  return next;
}

// Picking a project fills budget, scope heading and subject from it (unless typed in), like the web form.
export function applyProject(f, project, dirty = new Set()) {
  if (!project) return f;
  return {
    ...f,
    ...(dirty.has('budget') ? {} : { budget: String(project.budget ?? 0) }),
    ...(dirty.has('scopeTitle') ? {} : { scopeTitle: project.title || '' }),
    ...(dirty.has('subject') ? {} : { subject: `Submission of Quotation for Professional ${project.title || 'Brand Kit'}.` }),
  };
}

// Form → request body (POST /quotations, or working-copy "changes" with lockIdentity, where client/project can't change).
export function docBody(f, { lockIdentity = false } = {}) {
  return {
    ...Object.fromEntries(TEXT_FIELDS.filter((k) => k !== 'scopeOfWork').map((k) => [k, f[k] ?? ''])),
    templateId: f.templateId,
    ...(lockIdentity ? {} : { client: f.client, project: f.project || null }),
    issueDate: f.issueDate || undefined,
    validUntil: f.validUntil || null,
    budget: parseFloat(f.budget) || 0,
    price: parseFloat(f.price) || 0,
    taxRate: parseFloat(f.taxRate) || 0,
    scopeOfWork: String(f.scopeOfWork || '').split('\n').map((l) => l.trim()).filter(Boolean),
  };
}
