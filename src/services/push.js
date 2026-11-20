import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { authApi } from './authApi';
import { isSoundOn } from '@/utils/notificationSound';

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
};

if (Platform.OS !== 'web') {
  // While the app is open, notifications still show as the phone's own banners (like any messaging app).
  // The in-app "Notification sound" setting mutes their sound.
  Notifications.setNotificationHandler({
    handleNotification: async (n) => {
      const here = !!viewing && n.request.content.data?.referenceId === viewing;
      const sound = !here && (await isSoundOn().catch(() => true));
      return { shouldShowBanner: !here, shouldShowList: !here, shouldPlaySound: sound, shouldSetBadge: true };
    },
  });
  Object.entries(CATEGORIES).forEach(([id, actions]) => {
    Notifications.setNotificationCategoryAsync(id, actions).catch(() => {});
  });
}

// Same look as a server push, for notifications that arrive over the socket on a phone without push.
const CATEGORY_OF = {
  task_review_requested: 'review', task_review_reminder: 'review', task_review_late: 'review', task_assigned: 'task_new',
  task_comment: 'chat', mention: 'chat',
};
export function showLocalNotification(n) {
  return Notifications.scheduleNotificationAsync({
    content: {
      title: n.title || 'Rudhram CRM',
      body: n.message,
      data: { id: n._id, type: n.type, link: n.link, referenceModel: n.referenceModel, referenceId: n.referenceId },
      categoryIdentifier: CATEGORY_OF[n.type],
      threadIdentifier: n.referenceId ? `${n.referenceModel || 'item'}:${n.referenceId}` : undefined,
      sound: 'default',
    },
    trigger: null,
  });
}

// Ask once, then send this phone's Expo push token to the server. Quietly does nothing where push can't work.
export async function registerPush(dispatch) {
  if (Platform.OS === 'web') return;
  if (Platform.OS === 'android') {
    await Promise.all(CHANNELS.map(([id, name, importance]) => Notifications.setNotificationChannelAsync(id, {
      name,
      // eslint-disable-next-line import/namespace -- re-exported from a .types file the lint plugin can't follow
      importance: Notifications.AndroidImportance[importance],
      lightColor: '#b47737',
    })));
  }
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') ({ status } = await Notifications.requestPermissionsAsync());
  if (status !== 'granted' || !Device.isDevice) return;

  const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
  // Needs `eas init` once; until then the app works without push.
  if (!projectId) return console.warn('[push] No EAS projectId yet, so push is off. Run `npx eas-cli@latest init`.');

  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  const res = await dispatch(authApi.endpoints.registerPushToken.initiate(data));
  if (!res.error) pushToken = data;
}

// Sign out: this phone stops getting the user's pushes. Needs the access token, so run it before logout.
export async function unregisterPush(dispatch) {
  Notifications.setBadgeCountAsync(0).catch(() => {});
  if (!pushToken) return;
  await dispatch(authApi.endpoints.unregisterPushToken.initiate(pushToken)).catch(() => {});
  pushToken = null;
}
