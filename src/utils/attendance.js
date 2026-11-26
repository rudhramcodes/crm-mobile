import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { showToast } from '@/components/Toast';
import { apiError } from './apiError';

const pad = (n) => String(n).padStart(2, '0');

// Local calendar day as the server's date-only strings: "2026-11-18".
export const ymd = (d = new Date()) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
};

// "9:05 AM"
export const clockTime = (d) => (d ? new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(d)).toUpperCase() : '');

export const hms = (s) => [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map(pad).join(':');

export const isLead = (user) => ['super_admin', 'admin', 'manager'].includes(user?.role);
export const isAdmin = (user) => ['super_admin', 'admin'].includes(user?.role);

export const activeSession = (record) => record?.sessions?.find((s) => s.clockIn?.time && !s.clockOut?.time);

// Finished breaks only; an open break stops the clock instead.
export const breakSeconds = (breaks = []) =>
  breaks.reduce((t, b) => t + (b.start && b.end ? (new Date(b.end) - new Date(b.start)) / 1000 : 0), 0);

// Seconds worked today across every session, live for the open one.
export const workedSeconds = (record, now) => (record?.sessions || []).reduce((t, s) => {
  if (!s.clockIn?.time) return t;
  const openBreak = s.breaks?.find((b) => !b.end);
  const end = s.clockOut?.time ? new Date(s.clockOut.time) : openBreak ? new Date(openBreak.start) : now;
  return t + Math.max(0, (end - new Date(s.clockIn.time)) / 1000 - breakSeconds(s.breaks));
}, 0);

// Where a session happened: the server's office/area name, else the raw coordinates.
export const placeOf = (loc) => {
  if (!loc) return null;
  if (loc.locationName || loc.address) return loc.locationName || loc.address;
  return loc.lat != null && loc.lng != null ? `${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}` : null;
};

// Location is left out (never null) when there's no permission or no fix within 8 s; the server then decides.
export const getLocation = async () => {
  try {
    const { granted } = await Location.requestForegroundPermissionsAsync();
    if (!granted) return undefined;
    const fix = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      new Promise((resolve) => setTimeout(() => resolve(null), 8000)),
    ]);
    return fix ? { lat: fix.coords.latitude, lng: fix.coords.longitude } : undefined;
  } catch {
    return undefined;
  }
};

// Runs a mutation with the house feedback: success haptic + toast, or error haptic + toast. Returns the result or null.
export const runAction = async (promise, done, failTitle = "Couldn't save") => {
  try {
    const res = await promise.unwrap();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (done) showToast({ title: done, tone: 'success' });
    return res ?? true;
  } catch (e) {
    if (__DEV__) console.warn('[runAction]', failTitle, JSON.stringify(e));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    showToast({ title: failTitle, message: apiError(e).message, tone: 'error' });
    return null;
  }
};

export const MONTHLY_HOURS_TARGET = 240;

// Days worked in the month: present + WFH, with each half day counting as 0.5.
export const presentDays = (s = {}) => (s.present || 0) + (s.wfh || 0) + (s.half_day || 0) * 0.5;

// Working days in the month: every day except Sundays (the server's only weekend) and holidays.
export const workingDays = (year, month, holidays = []) => {
  const off = new Set(holidays.map((h) => ymd(h.date)));
  let n = 0;
  for (let d = 1; d <= new Date(year, month, 0).getDate(); d++) {
    const day = new Date(year, month - 1, d);
    if (day.getDay() !== 0 && !off.has(ymd(day))) n++;
  }
  return n;
};

export const monthRange = (year, month) => ({ dateFrom: ymd(new Date(year, month - 1, 1)), dateTo: ymd(new Date(year, month, 0)) });
