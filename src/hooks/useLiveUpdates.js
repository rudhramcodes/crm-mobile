import { useCallback, useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { addNetworkStateListener } from 'expo-network';
import { router } from 'expo-router';
import { useDispatch, useStore } from 'react-redux';
import { api } from '@/services/api';
import { attendanceApi } from '@/services/attendanceApi';
import { notificationApi } from '@/services/notificationApi';
import { connectSocket, disconnectSocket } from '@/services/socket';
import { hasPush, registerPush, showLocalNotification } from '@/services/push';
import { usePushTaps } from './usePushTaps';
import { showToast } from '@/components/Toast';
import { notificationRoute } from '@/utils/notificationRoute';
import { playNotificationSound } from '@/utils/notificationSound';
import { flushQueue, sendOrQueue } from '@/utils/offlineQueue';
import { apiError } from '@/utils/apiError';
import { clockTime, getLocation } from '@/utils/attendance';
import { formatHours } from '@/utils/formatters';

// Mark read and open; push data carries `id`, socket/REST notifications carry `_id`.
export const openNotification = (n, { dispatch }) => {
  const id = n._id ?? n.id;
  if (id && !n.read) sendOrQueue(dispatch, 'markNotificationRead', id).catch(() => {});
  router.push(notificationRoute(n));
};

// Buttons under a notification (see CATEGORIES in services/push.js). Offline, they wait and send when the
// connection is back; if the server refuses one, open the item instead.
const QUICK = {
  approve: (id) => ['updateTask', { id, status: 'done' }],
  start: (id) => ['updateTask', { id, status: 'in_progress' }],
  reply: (id, text) => ['addTaskComment', { id, text }],
};
const DONE = { approve: 'Approved', start: 'Started', reply: 'Reply sent' };
// Shown after a queued action finally goes through.
const sendWaiting = (dispatch) => flushQueue(dispatch)
  .then((n) => n && showToast({ tone: 'success', title: 'Back online', message: n === 1 ? 'Sent 1 action you took offline.' : `Sent ${n} actions you took offline.` }))
  .catch(() => {});

// "Clock out" on the 6:10 PM reminder: clocks out right away, never queued, since the server stamps the time it arrives.
const quickClockOut = async (dispatch) => {
  try {
    const res = await dispatch(attendanceApi.endpoints.clockOut.initiate({ location: await getLocation() })).unwrap();
    const a = res?.data?.attendance;
    const out = a?.sessions?.at(-1)?.clockOut?.time;
    showToast({ tone: 'success', title: out ? `Clocked out at ${clockTime(out)}` : 'Clocked out', message: a ? `Worked ${formatHours(a.workHours)} today.` : undefined });
  } catch (e) {
    showToast({ tone: 'error', title: "Couldn't clock out", message: apiError(e).message });
    router.push('/attendance');
  }
};

const runQuick = async (data, action, text, ctx) => {
  if (action === 'clock_out') return quickClockOut(ctx.dispatch);
  const id = data.referenceModel === 'Task' && data.referenceId;
  if (!QUICK[action] || !id || (action === 'reply' && !text?.trim())) return openNotification(data, ctx);
  try {
    const res = await sendOrQueue(ctx.dispatch, ...QUICK[action](id, text?.trim()));
    if (res.error) throw res.error;
    if (data.id) sendOrQueue(ctx.dispatch, 'markNotificationRead', data.id).catch(() => {});
    showToast(res.queued ? { title: "You're offline", message: `${DONE[action]} as soon as you're back online.` } : { tone: 'success', title: DONE[action] });
  } catch {
    showToast({ title: "Couldn't do that from the notification" });
    openNotification(data, ctx);
  }
};

// Signed-in shells only: live socket, push registration, and taps on push notifications.
export function useLiveUpdates() {
  const store = useStore();
  const dispatch = useDispatch();

  useEffect(() => {
    const socket = connectSocket(store);
    // Anything done offline goes out once the connection is back (socket up, network up, or app reopened).
    sendWaiting(dispatch);
    socket.on('connect', () => sendWaiting(dispatch));
    const net = addNetworkStateListener(({ isInternetReachable }) => isInternetReachable && sendWaiting(dispatch));
    socket.on('notification:new', (n) => {
      // A task alert means a task changed: refresh task lists too, not just the inbox.
      dispatch(api.util.invalidateTags(n.referenceModel === 'Task' ? ['Notification', 'Task'] : ['Notification']));
      // Phones show the system banner: the server's push, or one posted here when this phone has no push.
      // The web has no system notifications, so it keeps the in-app toast and sound.
      if (Platform.OS !== 'web') {
        if (!hasPush()) showLocalNotification(n).catch(() => {});
        return;
      }
      playNotificationSound().catch(() => {});
      showToast({ title: n.title || 'New notification', message: n.message, onPress: () => openNotification(n, { dispatch }) });
    });
    // A repeat folded into an earlier notification: refresh the list, no toast or sound.
    socket.on('notification:updated', () => dispatch(api.util.invalidateTags(['Notification'])));
    socket.on('notification:unread', ({ count }) => dispatch(notificationApi.util.upsertQueryData('getUnreadCount', undefined, count)));
    registerPush(dispatch).catch((e) => console.warn('[push]', e.message));
    // Back from the background: anything may have changed while the socket slept.
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      dispatch(api.util.invalidateTags(['Task', 'Notification']));
      sendWaiting(dispatch);
    });
    return () => { sub.remove(); net.remove(); disconnectSocket(); };
  }, [store, dispatch]);

  usePushTaps(useCallback((data, action, text) => runQuick(data, action, text, { dispatch }), [dispatch]));
}
