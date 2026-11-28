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

// A fix this fresh and this accurate is reused, so a tap right after warmLocation() doesn't wait on the GPS.
const FRESH_MS = 2 * 60 * 1000;
const GOOD_METERS = 50; // the office geofence is 100 m
let lastFix = null;
let pendingFix = null;
const coords = (f) => ({ lat: f.coords.latitude, lng: f.coords.longitude });
const fresh = (f) => f && Date.now() - f.timestamp < FRESH_MS && (f.coords.accuracy ?? 0) <= GOOD_METERS;
const askGps = () => {
  pendingFix ||= Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
    .then((f) => { lastFix = f; return f; })
    .finally(() => { pendingFix = null; });
  return pendingFix;
};

// Location is left out (never null) when there's no permission or no fix within `wait` ms; the server then decides.
// Office clock-in needs it (100 m geofence), so it waits up to 8 s; clock-out doesn't, so callers pass a short wait.
export const getLocation = async ({ wait = 8000 } = {}) => {
  try {
    const { granted } = await Location.requestForegroundPermissionsAsync();
    if (!granted) return undefined;
    if (fresh(lastFix)) return coords(lastFix);
    const known = await Location.getLastKnownPositionAsync({ maxAge: FRESH_MS, requiredAccuracy: GOOD_METERS });
    if (known) return coords(known);
    const fix = await Promise.race([askGps(), new Promise((resolve) => setTimeout(() => resolve(null), wait))]);
    return fix ? coords(fix) : undefined;
  } catch {
    return undefined;
  }
};

// Start a GPS fix in the background when a clock screen opens, so it's ready by the time the button is tapped.
// Never prompts for permission: that waits for the tap.
export const warmLocation = async () => {
  try {
    if ((await Location.getForegroundPermissionsAsync()).granted && !fresh(lastFix)) askGps().catch(() => {});
  } catch { /* no GPS: the tap will say so */ }
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
