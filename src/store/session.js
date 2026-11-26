import { Alert } from 'react-native';
import { clearRefreshToken, getRefreshToken, saveRefreshToken } from '@/utils/refreshToken';
import { authenticate, biometricLabel, getBiometricPref, setBiometricPref, setLockMinutes } from '@/utils/biometric';
import { api } from '@/services/api';
import { authApi } from '@/services/authApi';
import { disconnectSocket } from '@/services/socket';
import { resetPushChoices, unregisterPush } from '@/services/push';
import { clearQueue } from '@/utils/offlineQueue';
import { loggedOut, setCredentials, setStatus } from './authSlice';

// After the first sign-in on this phone, offer the biometric lock once. "Not now" is remembered.
const offerBiometrics = async () => {
  const label = await biometricLabel();
  if (!label || (await getBiometricPref())) return;
  Alert.alert(`Unlock with ${label}?`, `Use ${label} each time you open Rudhram CRM, instead of only your password.`, [
    { text: 'Not now', style: 'cancel', onPress: () => setBiometricPref('off') },
    { text: 'Turn on', onPress: async () => setBiometricPref((await authenticate(`Turn on ${label}`)).success ? 'on' : 'off') },
  ]);
};

// The client portal is gone: client accounts can't use the app.
const NO_CLIENTS = ['Staff only', 'Rudhram CRM is for the Rudhram team. Please contact us if you need project updates.'];

// The login user carries mustChangePassword and isEmailVerified, which pick the first screen.
export const signIn = ({ user, accessToken, refreshToken }) => async (dispatch) => {
  if (user?.role === 'client') {
    dispatch(authApi.endpoints.logout.initiate(refreshToken)).catch(() => {});
    return Alert.alert(...NO_CLIENTS);
  }
  await saveRefreshToken(refreshToken);
  dispatch(setCredentials({ status: 'signedIn', accessToken, user, locked: false }));
  offerBiometrics();
};

// App start: no access token yet, so /auth/me gets a 401 and api.js refreshes with the stored token.
export const restoreSession = () => async (dispatch) => {
  dispatch(setStatus('restoring'));
  if (!(await getRefreshToken())) return dispatch(loggedOut());

  const res = await dispatch(authApi.endpoints.getMe.initiate(undefined, { forceRefetch: true }));
  res.unsubscribe?.();
  if (res.data?.role === 'client') {
    Alert.alert(...NO_CLIENTS);
    return dispatch(signOut());
  }
  if (res.data) {
    // Locks even if the fingerprints were removed since; the lock screen then falls back to the passcode or sign-out.
    const locked = (await getBiometricPref()) === 'on';
    return dispatch(setCredentials({ status: 'signedIn', user: res.data, locked }));
  }
  // A rejected refresh token already signed us out in api.js; anything else is the network.
  if (res.error?.status === 'FETCH_ERROR' || res.error?.status === 'TIMEOUT_ERROR') dispatch(setStatus('offline'));
  else dispatch(loggedOut());
};

export const signOut = () => async (dispatch) => {
  disconnectSocket();
  await unregisterPush(dispatch);
  const refreshToken = await getRefreshToken();
  // Best effort: sign this device out on the server, but never block leaving the app on it.
  if (refreshToken) await dispatch(authApi.endpoints.logout.initiate(refreshToken)).catch(() => {});
  await clearRefreshToken();
  // The next person to sign in on this phone chooses for themselves.
  await setBiometricPref(null);
  await resetPushChoices();
  await clearQueue();
  await setLockMinutes(null);
  dispatch(loggedOut());
  dispatch(api.util.resetApiState());
};
