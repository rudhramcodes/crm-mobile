#!/usr/bin/env node
// Sends the real clock-in / clock-out reminder push to one phone, shaped like the server's (CRM/server clockReminder.job.js + pushStyle.js).
//   npm run push:out      # "Clock out before you leave", with the Clock out button
//   npm run push:in       # "Time to clock in"
// The phone's token comes by itself: the app in dev posts it to the Expo dev server, which saves .push-token.json
// (metro.config.js). A token as the second argument overrides it.
import { existsSync, readFileSync } from 'node:fs';

const phone = existsSync('.push-token.json') ? JSON.parse(readFileSync('.push-token.json', 'utf8')) : null;

const whyNoToken = (p) => {
  if (p.error) return p.os === 'android' ? `${p.error}\nExpo Go on Android can't get push since SDK 53; use a development build.` : p.error;
  if (p.perm === 'off') return 'Push notifications are off in the app. Turn them on in Settings.';
  if (p.perm !== 'granted') return `Notification permission is "${p.perm}". Allow notifications for the app (Settings > Push notifications).`;
  if (!p.isDevice) return 'It is a simulator; push needs a real phone.';
  return 'unknown. Check the Expo terminal for a [push] warning.';
};

const PUSHES = {
  in: { title: 'Time to clock in', body: "It's 9:50. Clock in for today's shift.", data: { type: 'clock_in_reminder', link: '/attendance' } },
  out: {
    title: 'Clock out before you leave',
    body: 'Please clock out before leaving the office.',
    data: { type: 'clock_out_reminder', link: '/attendance' },
    channelId: 'people',
    interruptionLevel: 'time-sensitive',
    categoryId: 'clock_out',
  },
};

const [kind, token = phone?.token] = process.argv.slice(2);
if (!PUSHES[kind]) {
  console.error('Usage: npm run push:in | npm run push:out   (or: node scripts/test-push.mjs in|out [ExponentPushToken[...]])');
  process.exit(1);
}
if (!token?.startsWith('ExponentPushToken[')) {
  if (!phone) console.error('No push token yet. Restart Expo (Ctrl+C, then npx expo start) and reload the app on your phone while signed in.');
  else console.error(`The phone (${phone.os}, at ${phone.at}) has no push token: ${whyNoToken(phone)}`);
  process.exit(1);
}

const res = await fetch('https://exp.host/--/api/v2/push/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  body: JSON.stringify({ to: token, sound: 'default', priority: 'high', ...PUSHES[kind] }),
});
const { data, errors } = await res.json();
const ticket = Array.isArray(data) ? data[0] : data;
if (!res.ok || errors || ticket?.status !== 'ok') {
  console.error('Push failed:', JSON.stringify(errors || ticket));
  process.exit(1);
}
console.log(`Sent "${PUSHES[kind].title}" at ${new Date().toLocaleTimeString()}.`);
