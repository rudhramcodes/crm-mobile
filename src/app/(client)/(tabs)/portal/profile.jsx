import { AccountSettings, Heading, Screen } from '@/components';

export default function PortalProfile() {
  return (
    <Screen scroll className="gap-5 pt-6">
      <Heading>Profile</Heading>
      <AccountSettings />
    </Screen>
  );
}
