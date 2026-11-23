import { notificationApi } from '@/services/notificationApi';
import { taskApi } from '@/services/taskApi';
import { getPref, setPref } from './prefs';

// Small actions taken without internet (mark read, delete, the Approve / Start / Reply buttons on a
// notification) wait here and are sent, in order, when the connection is back. Kept on the phone, so
// closing the app doesn't lose them. Anything else still fails with the usual "can't reach the server".
const KEY = 'offlineQueue';
const MAX_ITEMS = 20;
const MAX_CHARS = 1800; // the phone's secure store keeps small values only

const ENDPOINTS = {
  markNotificationRead: () => notificationApi.endpoints.markNotificationRead,
  markAllNotificationsRead: () => notificationApi.endpoints.markAllNotificationsRead,
  deleteNotification: () => notificationApi.endpoints.deleteNotification,
  updateTask: () => taskApi.endpoints.updateTask,
  addTaskComment: () => taskApi.endpoints.addTaskComment,
};

export const isOfflineError = (error) => error?.status === 'FETCH_ERROR' || error?.status === 'TIMEOUT_ERROR';

const read = async () => {
  try { return JSON.parse((await getPref(KEY)) || '[]'); } catch { return []; }
};
const write = async (items) => {
  let list = items.slice(-MAX_ITEMS);
  // Too many, or too big to store: the oldest are dropped and the newest kept.
  while (list.length && JSON.stringify(list).length > MAX_CHARS) list = list.slice(1);
  await setPref(KEY, list.length ? JSON.stringify(list) : null);
};

let chain = Promise.resolve();
// One read-modify-write at a time, so two quick taps never overwrite each other's queue.
const locked = (fn) => (chain = chain.then(fn, fn));

// Sends now; on a network failure saves it for later and returns { queued: true } instead of the error.
export async function sendOrQueue(dispatch, endpoint, arg) {
  const res = await dispatch(ENDPOINTS[endpoint]().initiate(arg));
  if (!isOfflineError(res.error)) return res;
  await locked(async () => write([...(await read()), { endpoint, arg }]));
  return { queued: true };
}

export const pendingCount = async () => (await read()).length;

// Sends what's waiting, oldest first. Stops at the first network failure (still offline) and keeps the rest;
// an item the server refuses (already deleted, no longer allowed) is dropped, not retried forever.
// The queue is saved again after EACH item, so if the app is killed halfway, what already went out isn't sent twice.
// (Only an item whose send finished in the instant before the kill can repeat: the server has no duplicate check.)
export const flushQueue = (dispatch) => locked(async () => {
  const items = await read();
  let sent = 0;
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    if (ENDPOINTS[item.endpoint]) {
      const res = await dispatch(ENDPOINTS[item.endpoint]().initiate(item.arg));
      if (isOfflineError(res.error)) break;
      sent += 1;
    }
    await write(items.slice(i + 1));
  }
  return sent;
});

// Sign out: what one person queued must never be sent as the next person.
export const clearQueue = () => locked(() => setPref(KEY, null));
