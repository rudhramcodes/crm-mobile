import { useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { useDispatch, useStore } from 'react-redux';
import { api } from '@/services/api';
import { notificationApi } from '@/services/notificationApi';
import { connectSocket, disconnectSocket } from '@/services/socket';
import { hasPush, registerPush, showLocalNotification } from '@/services/push';
import { taskApi } from '@/services/taskApi';
import { usePushTaps } from './usePushTaps';
import { showToast } from '@/components/Toast';
import { notificationRoute } from '@/utils/notificationRoute';
import { playNotificationSound } from '@/utils/notificationSound';

// Mark read and open; push data carries `id`, socket/REST notifications carry `_id`.
export const openNotification = (n, { dispatch, client }) => {
  const id = n._id ?? n.id;
  if (id && !n.read) dispatch(notificationApi.endpoints.markNotificationRead.initiate(id));
  const path = notificationRoute(n);
  router.push(client && !path.startsWith('/portal') ? '/portal' : path);
};

// Buttons under a notification (see CATEGORIES in services/push.js). If the quick action fails, open the item instead.
const QUICK = {
  approve: (id) => taskApi.endpoints.updateTask.initiate({ id, status: 'done' }),
  start: (id) => taskApi.endpoints.updateTask.initiate({ id, status: 'in_progress' }),
  reply: (id, text) => taskApi.endpoints.addTaskComment.initiate({ id, text }),
};
const DONE = { approve: 'Approved', start: 'Started', reply: 'Reply sent' };

const runQuick = async (data, action, text, ctx) => {
  const id = data.referenceModel === 'Task' && data.referenceId;
  if (!QUICK[action] || !id || (action === 'reply' && !text?.trim())) return openNotification(data, ctx);
  try {
    await ctx.dispatch(QUICK[action](id, text?.trim())).unwrap();
    if (data.id) ctx.dispatch(notificationApi.endpoints.markNotificationRead.initiate(data.id));
    showToast({ title: DONE[action] });
  } catch {
    showToast({ title: "Couldn't do that from the notification" });
    openNotification(data, ctx);
  }
};

// Signed-in shells only: live socket, push registration, and taps on push notifications.
export function useLiveUpdates({ client = false } = {}) {
  const store = useStore();
  const dispatch = useDispatch();

  useEffect(() => {
    const socket = connectSocket(store);
    socket.on('notification:new', (n) => {
      dispatch(api.util.invalidateTags(['Notification']));
      // Phones show the system banner: the server's push, or one posted here when this phone has no push.
      // The web has no system notifications, so it keeps the in-app toast and sound.
      if (Platform.OS !== 'web') {
        if (!hasPush()) showLocalNotification(n).catch(() => {});
        return;
      }
      playNotificationSound().catch(() => {});
      showToast({ title: n.title || 'New notification', message: n.message, onPress: () => openNotification(n, { dispatch, client }) });
    });
    // A repeat folded into an earlier notification: refresh the list, no toast or sound.
    socket.on('notification:updated', () => dispatch(api.util.invalidateTags(['Notification'])));
    socket.on('notification:unread', ({ count }) => dispatch(notificationApi.util.upsertQueryData('getUnreadCount', undefined, count)));
    registerPush(dispatch).catch((e) => console.warn('[push]', e.message));
    return disconnectSocket;
  }, [store, dispatch, client]);

  usePushTaps(useCallback((data, action, text) => runQuick(data, action, text, { dispatch, client }), [dispatch, client]));
}
