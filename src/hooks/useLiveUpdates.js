import { useCallback, useEffect } from 'react';
import { router } from 'expo-router';
import { useDispatch, useStore } from 'react-redux';
import { api } from '@/services/api';
import { notificationApi } from '@/services/notificationApi';
import { connectSocket, disconnectSocket } from '@/services/socket';
import { registerPush } from '@/services/push';
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

// Signed-in shells only: live socket, push registration, and taps on push notifications.
export function useLiveUpdates({ client = false } = {}) {
  const store = useStore();
  const dispatch = useDispatch();

  useEffect(() => {
    const socket = connectSocket(store);
    socket.on('notification:new', (n) => {
      dispatch(api.util.invalidateTags(['Notification']));
      playNotificationSound().catch(() => {});
      showToast({ title: n.title || 'New notification', message: n.message, onPress: () => openNotification(n, { dispatch, client }) });
    });
    socket.on('notification:unread', ({ count }) => dispatch(notificationApi.util.upsertQueryData('getUnreadCount', undefined, count)));
    registerPush(dispatch).catch((e) => console.warn('[push]', e.message));
    return disconnectSocket;
  }, [store, dispatch, client]);

  usePushTaps(useCallback((data) => openNotification(data, { dispatch, client }), [dispatch, client]));
}
