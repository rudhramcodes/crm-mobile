import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { authApi } from './authApi';

let pushToken = null;

// In the foreground the live socket already shows a toast, so the system banner would double it.
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: false, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: true }),
  });
}

// Ask once, then send this phone's Expo push token to the server. Quietly does nothing where push can't work.
export async function registerPush(dispatch) {
  if (Platform.OS === 'web' || !Device.isDevice) return;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Notifications',
      // eslint-disable-next-line import/namespace -- re-exported from a .types file the lint plugin can't follow
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: '#b47737',
    });
  }
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') ({ status } = await Notifications.requestPermissionsAsync());
  if (status !== 'granted') return;

  const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
  // Needs `eas init` once; until then the app works without push.
  if (!projectId) return console.warn('[push] No EAS projectId yet, so push is off. Run `npx eas-cli@latest init`.');

  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  const res = await dispatch(authApi.endpoints.registerPushToken.initiate(data));
  if (!res.error) pushToken = data;
}

// Sign out: this phone stops getting the user's pushes. Needs the access token, so run it before logout.
export async function unregisterPush(dispatch) {
  if (!pushToken) return;
  await dispatch(authApi.endpoints.unregisterPushToken.initiate(pushToken)).catch(() => {});
  pushToken = null;
}
