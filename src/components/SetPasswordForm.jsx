import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { AuthScreen } from './AuthScreen';
import { PasswordInput } from './PasswordInput';
import { PasswordRules, passwordValid } from './PasswordRules';
import { Alert } from './Alert';
import { Button } from './Button';
import { apiError } from '@/utils/apiError';
import { getFieldError } from '@/utils/getFieldError';

// Reset-password and accept-invite are the same form: a token from the email link plus a new password.
export function SetPasswordForm({ title, subtitle, action, done, useMutation }) {
  const { token } = useLocalSearchParams();
  const [password, setPassword] = useState('');
  const [submit, { isLoading, error, isSuccess }] = useMutation();
  const { message, fieldErrors } = apiError(error);

  if (!token) {
    return (
      <AuthScreen back title="This link is incomplete" subtitle="Open the link from your email again, or ask for a new one.">
        <Button title="Back to sign in" onPress={() => router.replace('/sign-in')} />
      </AuthScreen>
    );
  }
  if (isSuccess) {
    return (
      <AuthScreen title="You're all set" subtitle={done}>
        <Button title="Sign in" onPress={() => router.replace('/sign-in')} />
      </AuthScreen>
    );
  }
  return (
    <AuthScreen back title={title} subtitle={subtitle}>
      <Alert message={fieldErrors.length ? '' : message} />
      <PasswordInput
        label="New password"
        value={password}
        onChangeText={setPassword}
        placeholder="••••••••"
        autoComplete="new-password"
        textContentType="newPassword"
        autoFocus
        error={getFieldError(fieldErrors, 'password')}
        onSubmitEditing={() => passwordValid(password) && submit({ token, password })}
      />
      <PasswordRules value={password} />
      <Button title={action} loading={isLoading} disabled={!passwordValid(password)} onPress={() => submit({ token, password })} />
    </AuthScreen>
  );
}
