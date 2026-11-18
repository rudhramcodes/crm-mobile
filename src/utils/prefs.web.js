// shortcut: web is only the dev preview, so localStorage stands in for SecureStore.
export const getPref = async (key) => localStorage.getItem(key);
export const setPref = async (key, value) => (value == null ? localStorage.removeItem(key) : localStorage.setItem(key, value));
