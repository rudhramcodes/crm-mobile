import { View } from 'react-native';
import { router } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { Bell, Building2, KeyRound, LogOut, Mail, MailWarning, Plug, ShieldCheck, UserRound, UsersRound } from 'lucide-react-native';
import { Avatar, Card, ListRow, PageHeader, PhoneSettings, Pressable, Screen, SettingsSection, Text, canSeeSetting, confirmSignOut } from '@/components';
import { ROLE_LABELS } from '@/constants';

// Mobile version of the web settings tabs: one list, each row opens its own screen. Rows follow the web's role rules.
export default function Settings() {
  const dispatch = useDispatch();
  const user = useSelector((s) => s.auth.user);
  const can = (k) => canSeeSetting(user, k);
  const workspace = [
    can('organization') && <ListRow key="org" icon={Building2} label="Organization" hint="Company name, logo, timezone, currency" onPress={() => router.push('/settings/organization')} />,
    can('security') && <ListRow key="sec" icon={ShieldCheck} label="Security" hint="Password policy and login limits" onPress={() => router.push('/settings/security')} />,
    can('integrations') && <ListRow key="int" icon={Plug} label="Integrations" hint="Email sender and Zoho Meetings" onPress={() => router.push('/settings/integrations')} />,
    can('roles') && <ListRow key="roles" icon={UsersRound} label="Role access" hint="What each role can do" onPress={() => router.push('/settings/roles')} />,
    can('emailTemplates') && <ListRow key="mail" icon={Mail} label="Email templates" hint="Preview the emails the CRM sends" onPress={() => router.push('/settings/email-templates')} />,
  ].filter(Boolean);

  return (
    <Screen scroll className="gap-5 pt-2">
      <PageHeader caption="WORKSPACE" title="Settings" fallback="/more" />
      <Pressable onPress={() => router.push('/settings/profile')} accessibilityLabel="Edit profile">
        <Card className="flex-row items-center gap-3">
          <Avatar ring name={user.name} uri={user.avatar || undefined} size={52} />
          <View className="flex-1">
            <Text className="font-body-semibold text-lg" numberOfLines={1}>{user.name}</Text>
            <Text className="text-sm text-muted" numberOfLines={1}>{user.email}</Text>
            <Text className="text-caption uppercase text-accent-ink">{ROLE_LABELS[user.role] ?? user.role}</Text>
          </View>
          <Text className="font-body-semibold text-sm text-accent-ink">Edit</Text>
        </Card>
      </Pressable>
      <SettingsSection title="You">
        <ListRow icon={UserRound} label="Profile" hint="Name, phone and photo" onPress={() => router.push('/settings/profile')} />
        <ListRow icon={Bell} label="Notifications" hint="What reaches you, in the app and by email" onPress={() => router.push('/settings/notifications')} />
        <ListRow icon={KeyRound} label="Change password" onPress={() => router.push('/change-password')} />
      </SettingsSection>
      <View>
        <Text className="mb-2 text-caption uppercase text-muted">This phone</Text>
        <PhoneSettings test />
      </View>
      {!!workspace.length && <SettingsSection title="Workspace">{workspace}</SettingsSection>}
      <SettingsSection title="Account">
        {!user.isEmailVerified && <ListRow icon={MailWarning} label="Verify your email" onPress={() => router.push('/verify-email')} />}
        <ListRow icon={LogOut} label="Sign out" danger onPress={() => confirmSignOut(dispatch)} />
      </SettingsSection>
    </Screen>
  );
}
