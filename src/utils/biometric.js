import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { getPref, setPref } from './prefs';

const KEY = 'biometricUnlock'; // 'on' | 'off' | null (not asked yet)
const ios = Platform.OS === 'ios';

// What to call the unlock on this phone, or null when it has none set up.
export async function biometricLabel() {
  if (Platform.OS === 'web') return null;
  if (!(await LocalAuthentication.hasHardwareAsync()) || !(await LocalAuthentication.isEnrolledAsync())) return null;
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return ios ? 'Face ID' : 'Face unlock';
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return ios ? 'Touch ID' : 'Fingerprint';
  return 'Biometrics';
}

export const getBiometricPref = () => getPref(KEY);
export const setBiometricPref = (value) => setPref(KEY, value);

// How long the app may sit in the background before the lock comes back. Settings offers these; 5 is the default.
export const LOCK_CHOICES = [1, 5, 15];
const LOCK_KEY = 'lockAfterMinutes';
export const getLockMinutes = async () => {
  const n = Number(await getPref(LOCK_KEY));
  return LOCK_CHOICES.includes(n) ? n : 5;
};
export const setLockMinutes = (min) => setPref(LOCK_KEY, min == null ? null : String(min));

// Falls back to the phone passcode after failed scans, like the system apps do.
export const authenticate = (promptMessage = 'Unlock Rudhram CRM') =>
  LocalAuthentication.authenticateAsync({ promptMessage, cancelLabel: 'Cancel' });
