import { useState } from 'react';
import { AuthScreen, Alert, Button, Input, goBack } from '@/components';
import { useForgotPasswordMutation } from '@/services/authApi';
import { apiError } from '@/utils/apiError';
import { getFieldError } from '@/utils/getFieldError';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [send, { isLoading, error, isSuccess }] = useForgotPasswordMutation();
  const { message, fieldErrors } = apiError(error);

  if (isSuccess) {
    return (
      <AuthScreen back title="Check your email" subtitle={`If ${email.trim()} has an account, we've sent a link to reset your password. It expires in 1 hour.`}>
        <Button title="Back to sign in" onPress={goBack} />
      </AuthScreen>
    );
  }
  return (
    <AuthScreen back title="Reset your password" subtitle="Enter your work email and we'll send you a reset link.">
      <Alert message={fieldErrors.length ? '' : message} />
      <Input
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="you@company.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        autoFocus
        returnKeyType="send"
        error={getFieldError(fieldErrors, 'email')}
        onSubmitEditing={() => send(email.trim())}
      />
      <Button title="Send reset link" loading={isLoading} disabled={!email} onPress={() => send(email.trim())} />
    </AuthScreen>
  );
}
