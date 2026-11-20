// Pure client helpers (no React/RN imports, so clients.check.js runs under plain node).

// Same formats as the server (client.validation.js).
export const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Form state → request body, like the web ClientForm: trimmed, GST/PAN upper-cased, empty optionals dropped.
export const clientBody = (f) => {
  const t = (v) => String(v || '').trim();
  return {
    brand: f.brand,
    companyName: t(f.companyName),
    contactPerson: t(f.contactPerson),
    email: t(f.email),
    phone: t(f.phone) || undefined,
    gstNumber: t(f.gstNumber).toUpperCase() || undefined,
    panNumber: t(f.panNumber).toUpperCase() || undefined,
    address: {
      street: t(f.street),
      city: t(f.city),
      state: t(f.state),
      pincode: t(f.pincode),
      country: t(f.country) || 'India',
    },
    status: f.status || 'active',
  };
};

// Old records may store the address as a plain string.
export const addressOf = (a) => (typeof a === 'string' ? { street: a } : a || {});
export const hasAddress = (a) => {
  const x = addressOf(a);
  return !!(x.street || x.city || x.state || x.pincode);
};
