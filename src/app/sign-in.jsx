import { useRef, useState } from 'react';
import { router } from 'expo-router';
import { useDispatch } from 'react-redux';
import { AuthScreen, Alert, Button, Input, PasswordInput } from '@/components';
import { useLoginMutation } from '@/services/authApi';
import { signIn } from '@/store/session';
import { useTheme } from '@/constants/theme';
import { apiError } from '@/utils/apiError';
import { getFieldError } from '@/utils/getFieldError';

export default function SignIn() {
  const dispatch = useDispatch();
  const [login, { isLoading, error }] = useLoginMutation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const passwordRef = useRef(null);
  const { message, fieldErrors } = apiError(error);
  const placeholderTextColor = `${useTheme().muted}80`; // 80 = 50% alpha on the #rrggbb token

  const submit = async () => {
    const res = await login({ email: email.trim(), password });
    if (res.data) dispatch(signIn(res.data.data));
  };

  return (
    <AuthScreen title="Welcome back" subtitle="Sign in to Rudhram CRM with your work email.">
      <Alert message={fieldErrors.length ? '' : message} />
      <Input
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="you@company.com"
        placeholderTextColor={placeholderTextColor}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="username"
        returnKeyType="next"
        error={getFieldError(fieldErrors, 'email')}
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <PasswordInput
        ref={passwordRef}
        label="Password"
        value={password}
        onChangeText={setPassword}
        placeholder="••••••••"
        placeholderTextColor={placeholderTextColor}
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        error={getFieldError(fieldErrors, 'password')}
        onSubmitEditing={submit}
      />
      <Button title="Forgot password?" variant="ghost" size="sm" className="-mt-2 self-end px-0" onPress={() => router.push('/forgot-password')} />
      <Button title="Sign in" loading={isLoading} disabled={!email || !password} onPress={submit} />
    </AuthScreen>
  );
}
