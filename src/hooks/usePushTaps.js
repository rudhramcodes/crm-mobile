import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';

// Calls onOpen(data) when the user taps a push notification, including the one that cold-started the app.
export function usePushTaps(onOpen) {
  const response = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    onOpen(response.notification.request.content.data ?? {});
    Notifications.clearLastNotificationResponseAsync();
  }, [response, onOpen]);
}
