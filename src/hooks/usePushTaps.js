import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';

// Taps already acted on. Expo hands the last tap back whenever the hook mounts again (the signed-in layout
// remounting), which used to run a "Clock out" a second time minutes later.
const handled = new Set();

// Calls onOpen(data, action, text) once per tap on a notification or one of its buttons
// (including the tap that cold-started the app). action is 'open' for a plain tap; text is a typed reply.
export function usePushTaps(onOpen) {
  const response = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (!response) return;
    const key = `${response.notification.request.identifier}:${response.actionIdentifier}`;
    if (handled.has(key)) return;
    handled.add(key);
    const action = response.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER ? 'open' : response.actionIdentifier;
    onOpen(response.notification.request.content.data ?? {}, action, response.userText);
    Notifications.clearLastNotificationResponseAsync();
  }, [response, onOpen]);
}
