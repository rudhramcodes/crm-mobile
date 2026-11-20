import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';

// Calls onOpen(data, action, text) when the user taps a notification or one of its buttons
// (including the tap that cold-started the app). action is 'open' for a plain tap; text is a typed reply.
export function usePushTaps(onOpen) {
  const response = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (!response) return;
    const action = response.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER ? 'open' : response.actionIdentifier;
    onOpen(response.notification.request.content.data ?? {}, action, response.userText);
    Notifications.clearLastNotificationResponseAsync();
  }, [response, onOpen]);
}
