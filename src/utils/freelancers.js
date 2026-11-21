// Pure freelancer helpers (no React/RN imports, so freelancers.check.js runs under plain node).
// Catalog and rate rules copied from the web (modules/freelancers/freelancerCatalog.js, rateCardUtils.js).

export const SERVICE_OPTIONS = {
  panigrahna: [
    'Wedding Photographer', 'Candid Photographer', 'Traditional Photographer', 'Cinematographer',
    'Traditional Videographer', 'Drone Operator', 'Second Shooter', 'Live Streaming Operator',
    'Photo Editor', 'Video Editor', 'Reels Editor', 'Album Designer', 'Makeup Artist', 'Decor or Production Support',
  ],
  aghori: [
    'Event Manager', 'Event Coordinator', 'Venue Coordinator', 'Stage Manager', 'Production Manager',
    'Decorator', 'Sound Engineer', 'Light Technician', 'LED or AV Operator', 'Anchor or Host',
    'Hospitality Staff', 'Security Coordinator', 'Logistics Coordinator', 'Runner or On-ground Support',
  ],
};

export const RATE_BASES = [
  { value: 'per_hour', label: 'Per hour' }, { value: 'per_shift', label: 'Per shift' }, { value: 'per_day', label: 'Per day' },
  { value: 'per_function', label: 'Per function' }, { value: 'per_event', label: 'Per event' },
  { value: 'per_deliverable', label: 'Per deliverable' }, { value: 'monthly', label: 'Monthly' }, { value: 'custom', label: 'Custom' },
];
export const CURRENCIES = ['INR', 'USD'];
export const SKILL_LEVELS = [
  { value: 'junior', label: 'Junior' }, { value: 'mid', label: 'Mid' }, { value: 'senior', label: 'Senior' },
  { value: 'specialist', label: 'Specialist' }, { value: 'lead', label: 'Lead' },
];
export const FREELANCER_TYPES = [
  { value: 'individual', label: 'Individual' }, { value: 'team', label: 'Team' },
  { value: 'agency', label: 'Agency' }, { value: 'vendor', label: 'Vendor' },
];
export const CONTACT_CHANNELS = [
  { value: 'phone', label: 'Phone' }, { value: 'whatsapp', label: 'WhatsApp' }, { value: 'email', label: 'Email' },
];
export const FREELANCER_STATUS = [
  { value: 'active', label: 'Active', variant: 'success' },
  { value: 'inactive', label: 'Inactive', variant: 'default' },
  { value: 'archived', label: 'Archived', variant: 'warning' },
];

export const labelOf = (list, v) => list.find((i) => i.value === v)?.label || v || '';

const time = (d) => new Date(d).getTime();
const newestFirst = (a, b) => time(b.effectiveFrom) - time(a.effectiveFrom);
// Rate in effect today (latest start wins); if none, the latest-starting rate. Same as the web getCurrentRate.
export function currentRate(rateCards = [], today = new Date()) {
  const rates = (Array.isArray(rateCards) ? rateCards : []).filter((r) => !Number.isNaN(time(r.effectiveFrom)));
  const now = today.getTime();
  const live = rates.filter((r) => time(r.effectiveFrom) <= now && (!r.effectiveUntil || time(r.effectiveUntil) >= now));
  return [...live].sort(newestFirst)[0] || [...rates].sort(newestFirst)[0];
}

export const formatRate = (r) => (r ? `${r.currency === 'USD' ? '$' : '₹'}${Number(r.amount || 0).toLocaleString('en-IN')} / ${labelOf(RATE_BASES, r.rateBasis).toLowerCase()}` : '');

// Best current rate across all venture profiles (for the list card).
export const headlineRate = (f) => currentRate((f?.ventureProfiles || []).flatMap((p) => p.rateCards || []));

const t = (v) => String(v ?? '').trim();
const split = (v, sep = ',') => String(v || '').split(sep).map((x) => x.trim()).filter(Boolean);
const ymd = (d) => (d ? String(d).slice(0, 10) : '');

export const newRate = () => ({ rateBasis: 'per_day', amount: '', currency: 'INR', effectiveFrom: new Date().toISOString().slice(0, 10), effectiveUntil: '', notes: '' });
export const newProfile = (venture = 'panigrahna') => ({ venture, internalTitle: '', serviceCategories: [], otherServices: '', skillLevel: 'mid', experienceSummary: '', active: true, notes: '', rateCards: [] });

// Server record → form state (lists become text, dates become YYYY-MM-DD, custom services split out).
export function freelancerForm(f) {
  return {
    fullName: f?.fullName || '',
    displayName: f?.displayName || '',
    profilePhoto: f?.profilePhoto || '',
    phone: f?.phone || '',
    whatsappNumber: f?.whatsappNumber || '',
    email: f?.email || '',
    city: f?.city || '',
    preferredContactChannel: f?.preferredContactChannel || 'phone',
    freelancerType: f?.freelancerType || 'individual',
    experienceYears: f?.experienceYears ? String(f.experienceYears) : '',
    bio: f?.bio || '',
    languages: (f?.languages || []).join(', '),
    serviceAreas: (f?.serviceAreas || []).join(', '),
    portfolioLinks: (f?.portfolioLinks || []).join('\n'),
    internalTags: (f?.internalTags || []).join(', '),
    address: { street: '', city: '', state: '', pincode: '', country: 'India', ...(f?.address || {}) },
    emergencyContact: { name: '', relationship: '', phone: '', ...(f?.emergencyContact || {}) },
    ventureProfiles: f?.ventureProfiles?.length
      ? f.ventureProfiles.map((p) => {
        const catalog = SERVICE_OPTIONS[p.venture] || [];
        const services = p.serviceCategories || [];
        return {
          ...newProfile(p.venture),
          ...p,
          serviceCategories: services.filter((s) => catalog.includes(s)),
          otherServices: services.filter((s) => !catalog.includes(s)).join(', '),
          rateCards: (p.rateCards || []).map((r) => ({ ...r, amount: String(r.amount ?? ''), effectiveFrom: ymd(r.effectiveFrom), effectiveUntil: ymd(r.effectiveUntil), notes: r.notes || '' })),
        };
      })
      : [newProfile()],
  };
}

// Form state → request body, like the web FreelancerForm submit. Rates without an amount are dropped.
export function freelancerBody(f) {
  return {
    fullName: t(f.fullName),
    displayName: t(f.displayName),
    profilePhoto: t(f.profilePhoto),
    phone: t(f.phone),
    whatsappNumber: t(f.whatsappNumber),
    email: t(f.email).toLowerCase(),
    city: t(f.city),
    preferredContactChannel: f.preferredContactChannel,
    freelancerType: f.freelancerType,
    experienceYears: Number(f.experienceYears || 0),
    bio: t(f.bio),
    languages: split(f.languages),
    serviceAreas: split(f.serviceAreas),
    portfolioLinks: split(f.portfolioLinks, '\n'),
    internalTags: split(f.internalTags),
    address: Object.fromEntries(Object.entries(f.address || {}).map(([k, v]) => [k, t(v)])),
    emergencyContact: Object.fromEntries(Object.entries(f.emergencyContact || {}).map(([k, v]) => [k, t(v)])),
    ventureProfiles: (f.ventureProfiles || []).map(({ otherServices, ...p }) => ({
      ...p,
      internalTitle: t(p.internalTitle),
      experienceSummary: t(p.experienceSummary),
      notes: t(p.notes),
      serviceCategories: [...new Set([...(p.serviceCategories || []), ...split(otherServices)])],
      rateCards: (p.rateCards || [])
        .filter((r) => t(r.amount) !== '' && r.effectiveFrom)
        .map((r) => ({ ...r, amount: Number(r.amount), notes: t(r.notes), effectiveUntil: r.effectiveUntil || null })),
    })),
  };
}
