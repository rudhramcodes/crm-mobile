import { io } from 'socket.io-client';
import { SOCKET_URL } from '@/constants';
import { authApi } from './authApi';

let socket = null;
const AUTH_ERRORS = ['Invalid token', 'Authentication required'];

// One live connection per signed-in session. The token is read on every (re)connect, so a refreshed one is picked up.
// shortcut: no join:room/leave:room yet; add them with the first screen that follows one record live (M4 chat).
export function connectSocket({ getState, dispatch }) {
  disconnectSocket();
  const s = io(SOCKET_URL, { auth: (cb) => cb({ token: getState().auth.accessToken }), transports: ['websocket'] });
  let retried = false;
  s.on('connect', () => { retried = false; });
  // The server refuses an expired access token and socket.io won't retry that, so refresh once and reconnect.
  s.on('connect_error', async (err) => {
    if (retried || !AUTH_ERRORS.includes(err.message)) return;
    retried = true;
    const res = await dispatch(authApi.endpoints.getMe.initiate(undefined, { forceRefetch: true }));
    res.unsubscribe?.();
    if (res.data && socket === s) s.connect();
  });
  socket = s;
  return s;
}

export function disconnectSocket() {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
}
