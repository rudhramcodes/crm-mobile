import * as SecureStore from 'expo-secure-store';

// Small per-device settings (biometric lock, notification sound) as plain strings.
export const getPref = (key) => SecureStore.getItemAsync(key);
export const setPref = (key, value) => (value == null ? SecureStore.deleteItemAsync(key) : SecureStore.setItemAsync(key, value));
