import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useDispatch, useStore } from 'react-redux';
import { setLocked } from '@/store/authSlice';
import { getBiometricPref, getLockMinutes } from '@/utils/biometric';

// Quick trips out (copying an OTP from Gmail) stay unlocked; longer than the chosen time (Settings, default 5 min) locks again.
export function useAutoLock() {
  const store = useStore();
  const dispatch = useDispatch();
  useEffect(() => {
    let leftAt = 0;
    const sub = AppState.addEventListener('change', async (state) => {
      if (state === 'background') return void (leftAt = Date.now());
      if (state !== 'active' || !leftAt) return;
      const away = Date.now() - leftAt;
      leftAt = 0;
      if (store.getState().auth.status !== 'signedIn' || (await getBiometricPref()) !== 'on') return;
      if (away > (await getLockMinutes()) * 60 * 1000) dispatch(setLocked(true));
    });
    return () => sub.remove();
  }, [store, dispatch]);
}
