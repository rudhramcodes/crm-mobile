import * as SecureStore from 'expo-secure-store';

// The refresh token lives in the iOS Keychain / Android Keystore.
const KEY = 'refreshToken';
export const getRefreshToken = () => SecureStore.getItemAsync(KEY);
export const saveRefreshToken = (token) => SecureStore.setItemAsync(KEY, token);
export const clearRefreshToken = () => SecureStore.deleteItemAsync(KEY);
