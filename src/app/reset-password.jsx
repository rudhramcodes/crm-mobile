import { SetPasswordForm } from '@/components';
import { useResetPasswordMutation } from '@/services/authApi';

export default function ResetPassword() {
  return (
    <SetPasswordForm
      title="Choose a new password"
      subtitle="You'll use it to sign in from now on."
      action="Reset password"
      done="Your password has been reset. Sign in with your new password."
      useMutation={useResetPasswordMutation}
    />
  );
}
