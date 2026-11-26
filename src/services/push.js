import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { authApi } from './authApi';
import { isQuietNow, isSoundOn } from '@/utils/notificationSound';
import { getPref, setPref } from '@/utils/prefs';

// Settings > Push notifications. On unless this phone's user turned it off.
const PUSH_KEY = 'pushEnabled';
export const isPushOn = async () => (await getPref(PUSH_KEY)) !== 'off';
export const setPushOn = (on) => setPref(PUSH_KEY, on ? null : 'off');

// The in-app "Turn on notifications?" explainer is shown once per person: 'asked' or 'later' once answered.
const PRIMER_KEY = 'pushPrimer';
export const getPrimerChoice = () => getPref(PRIMER_KEY);
export const setPrimerChoice = (v) => setPref(PRIMER_KEY, v);

// Sign out: the next person on this phone gets push on and sees the explainer again (if the phone can still ask).
export const resetPushChoices = () => Promise.all([setPushOn(true), setPrimerChoice(null)]);

// Where this phone stands: 'granted', 'ask' (the system prompt can still appear) or 'blocked' (only phone Settings can fix it).
export async function pushPermission() {
  if (Platform.OS === 'web') return 'blocked';
  const { granted, canAskAgain } = await Notifications.getPermissionsAsync();
  if (granted) return 'granted';
  return canAskAgain ? 'ask' : 'blocked';
}

let pushToken = null;
// True once this phone gets the server's pushes. Until then (simulator, permission off) the app posts the
// banner itself from the live socket, so notifications look the same either way.
export const hasPush = () => !!pushToken;

// The task on screen right now: its notifications skip the banner, like a chat app with that chat open.
let viewing = null;
export const setViewing = (id) => { viewing = id; };

// Android "Notification categories" (Settings > Apps > Rudhram CRM): each can be muted on its own.
// The server picks one per notification type (server/src/modules/notifications/pushStyle.js).
const CHANNELS = [
  ['reviews', 'Reviews waiting on you', 'MAX'],
  ['tasks', 'Tasks', 'HIGH'],
  ['chat', 'Messages', 'HIGH'],
  ['sales', 'Leads and meetings', 'HIGH'],
  ['people', 'Attendance and leave', 'HIGH'],
  ['money', 'Invoices and payments', 'DEFAULT'],
  ['default', 'Other', 'DEFAULT'],
];

// Buttons under a notification. Ids match the server's categoryId; the app acts on them in useLiveUpdates.
const CATEGORIES = {
  review: [{ identifier: 'approve', buttonTitle: 'Approve', options: { opensAppToForeground: true } }, { identifier: 'open', buttonTitle: 'Open' }],
  task_new: [{ identifier: 'start', buttonTitle: 'Start work', options: { opensAppToForeground: true } }, { identifier: 'open', buttonTitle: 'Open' }],
  chat: [{ identifier: 'reply', buttonTitle: 'Reply', textInput: { submitButtonTitle: 'Send', placeholder: 'Write a reply' }, options: { opensAppToForeground: true } }],
  open: [{ identifier: 'open', buttonTitle: 'Open' }],
  clock_out: [{ identifier: 'clock_out', buttonTitle: 'Clock out', options: { opensAppToForeground: true } }],
};

if (Platform.OS !== 'web') {
  // While the app is open, notifications still show as the phone's own banners (like any messaging app).
  // The in-app "Notification sound" setting mutes their sound.
  Notifications.setNotificationHandler({
    handleNotification: async (n) => {
      const here = !!viewing && n.request.content.data?.referenceId === viewing;
      const quiet = await isQuietNow().catch(() => false);
      const sound = !here && !quiet && (await isSoundOn().catch(() => true));
      return { shouldShowBanner: !here && !quiet, shouldShowList: !here, shouldPlaySound: sound, shouldSetBadge: true };
    },
  });
  Object.entries(CATEGORIES).forEach(([id, actions]) => {
    Notifications.setNotificationCategoryAsync(id, actions).catch(() => {});
  });
  // The old on-phone clock reminders were replaced by server pushes: drop any still scheduled, once per phone,
  // so reminders this app schedules later are never wiped on start.
  getPref('oldRemindersCleared').then((done) => done || Notifications.cancelAllScheduledNotificationsAsync()
    .then(() => setPref('oldRemindersCleared', '1'))).catch(() => {});
}

// Same look as a server push, for notifications that arrive over the socket on a phone without push.
// Buttons per type match the server's pushStyle.js.
const CATEGORY_OF = {
  task_review_requested: 'review', task_review_reminder: 'review', task_review_late: 'review', task_assigned: 'task_new',
  task_comment: 'chat', mention: 'chat',
  task_changes_requested: 'open', task_due_soon: 'open', task_reassigned: 'open', task_rescheduled: 'open',
  lead_assigned: 'open', meeting_requested: 'open', meeting_reminder: 'open', leave_applied: 'open', regularization_request: 'open',
  clock_out_reminder: 'clock_out',
};
// Follows the in-app sound setting and quiet hours, like the server pushes do through the foreground handler.
export async function showLocalNotification(n) {
  const sound = (await isSoundOn().catch(() => true)) && !(await isQuietNow().catch(() => false));
  return Notifications.scheduleNotificationAsync({
    content: {
      title: n.title || 'Rudhram CRM',
      body: n.message,
      data: { id: n._id, type: n.type, link: n.link, referenceModel: n.referenceModel, referenceId: n.referenceId },
      categoryIdentifier: CATEGORY_OF[n.type],
      threadIdentifier: n.referenceId ? `${n.referenceModel || 'item'}:${n.referenceId}` : undefined,
      sound: sound ? 'default' : false,
    },
    trigger: null,
  });
}

// Send this phone's Expo push token to the server. The system permission prompt only appears with `ask`
// (the user tapped Allow in the explainer or turned the Settings toggle on), never cold on app start.
// Returns 'granted', 'ask', 'blocked' or 'off'. Quietly does nothing where push can't work.
export async function registerPush(dispatch, { ask = false } = {}) {
  if (Platform.OS === 'web' || !(await isPushOn())) return 'off';
  if (Platform.OS === 'android') {
    await Promise.all(CHANNELS.map(([id, name, importance]) => Notifications.setNotificationChannelAsync(id, {
      name,
      // eslint-disable-next-line import/namespace -- re-exported from a .types file the lint plugin can't follow
      importance: Notifications.AndroidImportance[importance],
      lightColor: '#b47737',
    })));
  }
  let perm = await pushPermission();
  if (perm === 'ask' && ask) perm = (await Notifications.requestPermissionsAsync()).granted ? 'granted' : await pushPermission();
  if (perm !== 'granted' || !Device.isDevice) return perm;

  const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
  // Needs `eas init` once; until then the app works without push.
  if (!projectId) {
    console.warn('[push] No EAS projectId yet, so push is off. Run `npx eas-cli@latest init`.');
    return perm;
  }

  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  const res = await dispatch(authApi.endpoints.registerPushToken.initiate(data));
  if (!res.error) pushToken = data;
  return perm;
}

// Sign out: this phone stops getting the user's pushes. Needs the access token, so run it before logout.
export async function unregisterPush(dispatch) {
  Notifications.setBadgeCountAsync(0).catch(() => {});
  if (!pushToken) return;
  await dispatch(authApi.endpoints.unregisterPushToken.initiate(pushToken)).catch(() => {});
  pushToken = null;
}
