export const toDisplay = (value) => {
  if (!value) return '';
  const [h, m] = value.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return '';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const period = h >= 12 ? 'PM' : 'AM';
  return `${String(hour12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
};

// Accepts: "9", "9am", "9:30", "09:30", "9:30 AM", "9:30pm", "2130" -> "HH:mm" (24h)
export const parseTime = (raw) => {
  let s = (raw || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!s) return '';
  let h;
  let m = 0;
  let isPM = null;

  const ampm = s.match(/(am|pm)$/);
  if (ampm) {
    isPM = ampm[1] === 'pm';
    s = s.slice(0, -2).trim();
  }

  if (s.includes(':')) {
    const [hs, ms] = s.split(':');
    h = Number(hs);
    m = Number(ms);
  } else if (/^\d{4}$/.test(s)) {
    h = Number(s.slice(0, 2));
    m = Number(s.slice(2));
  } else {
    h = Number(s);
  }

  if (Number.isNaN(h) || Number.isNaN(m)) return '';
  if (isPM !== null) {
    if (h < 1 || h > 12 || m < 0 || m > 59) return '';
    if (isPM && h !== 12) h += 12;
    if (!isPM && h === 12) h = 0;
  } else {
    if (h < 0 || h > 23 || m < 0 || m > 59) return '';
  }
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

export const toMin = (t) => {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m) || !t.includes(':')) return null;
  return h * 60 + m;
};

