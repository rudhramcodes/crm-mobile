import { View } from 'react-native';
import { router } from 'expo-router';
import { useSelector } from 'react-redux';
import { ChevronRight, MailWarning } from 'lucide-react-native';
import { Screen } from './Screen';
import { Heading, Text } from './Text';
import { Card } from './Card';
import { Avatar } from './Avatar';
import { useTheme } from '@/constants/theme';

// shortcut: placeholder home for staff and clients until the M3 dashboards. Account actions live in More / Profile.
export function SignedInHome({ subtitle }) {
  const theme = useTheme();
  const user = useSelector((s) => s.auth.user);
  return (
    <Screen scroll className="gap-5 pt-6">
      <View className="flex-row items-center gap-3">
        <View className="flex-1">
          <Text className="text-sm text-muted">{subtitle}</Text>
          <Heading>Hi, {user.name.split(' ')[0]}</Heading>
        </View>
        <Avatar name={user.name} uri={user.avatar} size={48} />
      </View>
      {!user.isEmailVerified && (
        <Card onPress={() => router.push('/verify-email')} className="flex-row items-center gap-3 border-transparent bg-accent/15">
          <View className="h-10 w-10 items-center justify-center rounded-xl bg-accent/20">
            <MailWarning size={20} color={theme['accent-ink']} />
          </View>
          <View className="flex-1">
            <Text className="font-body-semibold">Verify your email</Text>
            <Text className="text-sm text-muted">{`We'll send a 6-digit code to ${user.email}.`}</Text>
          </View>
          <ChevronRight size={20} color={theme['accent-ink']} />
        </Card>
      )}
    </Screen>
  );
}
