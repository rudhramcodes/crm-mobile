import { createSlice } from '@reduxjs/toolkit';

// locked: signed in, but the lock screen waits for Face ID / fingerprint.
// status: 'restoring' (app start) | 'offline' (could not reach the server) | 'signedOut' | 'signedIn'
const signedOut = { status: 'signedOut', user: null, accessToken: null, locked: false };

const authSlice = createSlice({
  name: 'auth',
  initialState: { ...signedOut, status: 'restoring' },
  reducers: {
    setCredentials: (state, { payload }) => ({ ...state, ...payload }),
    setUser: (state, { payload }) => ({ ...state, user: { ...state.user, ...payload } }),
    setStatus: (state, { payload }) => ({ ...state, status: payload }),
    setLocked: (state, { payload }) => ({ ...state, locked: payload }),
    loggedOut: () => signedOut,
  },
});

export const { setCredentials, setUser, setStatus, setLocked, loggedOut } = authSlice.actions;
export default authSlice.reducer;
