import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { AuthScreen, Alert, Button, OtpInput, Text } from '@/components';
import { useResendVerificationMutation, useVerifyEmailOtpMutation } from '@/services/authApi';
import { setUser } from '@/store/authSlice';
import { apiError } from '@/utils/apiError';

const COOLDOWN = 60;

export default function VerifyEmail() {
  const dispatch = useDispatch();
  const email = useSelector((s) => s.auth.user?.email);
  const [otp, setOtp] = useState('');
  const [wait, setWait] = useState(COOLDOWN);
  const [resend, sent] = useResendVerificationMutation();
  const [verify, { isLoading, error }] = useVerifyEmailOtpMutation();
  const message = apiError(error).message || apiError(sent.error).message;

  const sendCode = () => { setWait(COOLDOWN); setOtp(''); resend(email); };
  useEffect(() => { resend(email); }, [resend, email]); // the first code goes out on open
  useEffect(() => {
    if (!wait) return undefined;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const submit = async (code) => {
    const res = await verify({ email, otp: code });
    if (res.error) return setOtp('');
    dispatch(setUser({ isEmailVerified: true }));
    router.back();
  };
  const onChange = (code) => { setOtp(code); if (code.length === 6) submit(code); };

  return (
    <AuthScreen back title="Verify your email" subtitle={`Enter the 6-digit code we sent to ${email}. It expires in 10 minutes.`}>
      <Alert message={message} />
      <OtpInput value={otp} onChangeText={onChange} error={!!error} />
      <Button title="Verify" loading={isLoading} disabled={otp.length < 6} onPress={() => submit(otp)} />
      <Button
        title={wait ? `Resend code in ${wait}s` : 'Resend code'}
        variant="ghost"
        size="sm"
        disabled={!!wait || sent.isLoading}
        onPress={sendCode}
      />
      {sent.isSuccess && !message && <Text className="text-center text-sm text-muted">Code sent. Check your inbox and spam folder.</Text>}
    </AuthScreen>
  );
}
