import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useDispatch, useStore } from 'react-redux';
import { setLocked } from '@/store/authSlice';
import { getBiometricPref } from '@/utils/biometric';

const LOCK_AFTER = 5 * 60 * 1000;

// Quick trips out (copying an OTP from Gmail) stay unlocked; 5 minutes away locks again.
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
      if (away > LOCK_AFTER && store.getState().auth.status === 'signedIn' && (await getBiometricPref()) === 'on') dispatch(setLocked(true));
    });
    return () => sub.remove();
  }, [store, dispatch]);
}
