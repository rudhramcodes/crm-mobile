import { useState } from 'react';
import { router } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { AuthScreen, Alert, Button, PasswordInput, PasswordRules, passwordValid } from '@/components';
import { useChangePasswordMutation } from '@/services/authApi';
import { setUser } from '@/store/authSlice';
import { signOut } from '@/store/session';
import { apiError } from '@/utils/apiError';
import { getFieldError } from '@/utils/getFieldError';

export default function ChangePassword() {
  const dispatch = useDispatch();
  const forced = useSelector((s) => s.auth.user?.mustChangePassword);
  const [change, { isLoading, error }] = useChangePasswordMutation();
  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNew] = useState('');
  const { message, fieldErrors } = apiError(error);
  const canSubmit = currentPassword && passwordValid(newPassword);

  const submit = async () => {
    if (!canSubmit) return;
    const res = await change({ currentPassword, newPassword });
    if (res.error) return;
    dispatch(setUser({ mustChangePassword: false }));
    if (forced) router.replace('/');
    else router.back();
  };

  return (
    <AuthScreen
      back={!forced}
      title={forced ? 'Set a new password' : 'Change password'}
      subtitle={forced ? 'Your admin asked you to replace your temporary password before you continue.' : 'Use a password you don\'t use anywhere else.'}
    >
      <Alert message={fieldErrors.length ? '' : message} />
      <PasswordInput
        label={forced ? 'Temporary password' : 'Current password'}
        value={currentPassword}
        onChangeText={setCurrent}
        placeholder="••••••••"
        autoComplete="current-password"
        textContentType="password"
        error={getFieldError(fieldErrors, 'currentPassword')}
      />
      <PasswordInput
        label="New password"
        value={newPassword}
        onChangeText={setNew}
        placeholder="••••••••"
        autoComplete="new-password"
        textContentType="newPassword"
        error={getFieldError(fieldErrors, 'newPassword')}
        onSubmitEditing={submit}
      />
      <PasswordRules value={newPassword} />
      <Button title="Save password" loading={isLoading} disabled={!canSubmit} onPress={submit} />
      {forced && <Button title="Sign out" variant="ghost" onPress={() => dispatch(signOut())} />}
    </AuthScreen>
  );
}
