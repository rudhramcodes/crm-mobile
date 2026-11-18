import { SetPasswordForm } from '@/components';
import { useAcceptInviteMutation } from '@/services/authApi';

export default function AcceptInvite() {
  return (
    <SetPasswordForm
      title="Set up your portal"
      subtitle="Create a password to open your client portal."
      action="Create password"
      done="Your password is set. Sign in with your email to open your portal."
      useMutation={useAcceptInviteMutation}
    />
  );
}
