// shortcut: web is only the dev preview (SecureStore has no web build); a real web app would use the httpOnly cookie.
const KEY = 'refreshToken';
export const getRefreshToken = async () => localStorage.getItem(KEY);
export const saveRefreshToken = async (token) => localStorage.setItem(KEY, token);
export const clearRefreshToken = async () => localStorage.removeItem(KEY);
