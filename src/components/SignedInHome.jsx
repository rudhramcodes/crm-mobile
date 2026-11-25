import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable as RNPressable, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Link, router } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { Bell, ChevronRight, LogOut, MailWarning, UserRound } from 'lucide-react-native';
import { Pressable } from './Pressable';
import { ListRow } from './ListRow';
import { Heading, Text } from './Text';
import { Card } from './Card';
import { Avatar } from './Avatar';
import { Badge } from './Badge';
import { confirmSignOut } from './AccountSettings';
import { useTheme } from '@/constants/theme';
import { useGetUnreadCountQuery } from '@/services/notificationApi';

const OPEN_MS = 200;
const CLOSE_MS = 150;

// Staff avatar: tap opens a small menu under it that grows from the top-right corner, and shrinks away on close.
// The avatar is also the source of iOS's zoom: Profile grows out of it, and shrinks back into it on the way back.
// Android has no zoom transition, so there Profile just pushes as usual.
function ProfileMenu({ user }) {
  const dispatch = useDispatch();
  const anchor = useRef(null);
  const zoomNav = useRef(null); // the Link's own (zoom-aware) navigation, handed up by AvatarButton
  const { width } = useWindowDimensions();
  const [pos, setPos] = useState(null); // { top, right } while the menu is open
  const p = useSharedValue(0);

  const open = () => anchor.current?.measureInWindow((x, y, w, h) => {
    setPos({ top: y + h + 8, right: width - (x + w) });
    p.set(withTiming(1, { duration: OPEN_MS, easing: Easing.out(Easing.cubic) }));
  });
  // Plays the close animation, then unmounts the menu (and runs `then`, e.g. navigation).
  const close = (then) => {
    p.set(withTiming(0, { duration: CLOSE_MS, easing: Easing.in(Easing.cubic) }));
    setTimeout(() => { setPos(null); then?.(); }, CLOSE_MS);
  };
  const openProfile = () => (zoomNav.current ? zoomNav.current() : router.push('/settings/profile'));
  const backdrop = useAnimatedStyle(() => ({ opacity: p.get() }));
  const menu = useAnimatedStyle(() => ({
    opacity: p.get(),
    transform: [{ translateY: (1 - p.get()) * -6 }, { scale: 0.92 + p.get() * 0.08 }],
  }));

  return (
    <>
      {/* Only the avatar sits inside the zoom source; the menu's Modal stays outside it. */}
      <Link href="/settings/profile" asChild>
        <Link.AppleZoom>
          <AvatarButton user={user} anchor={anchor} onOpen={open} navRef={zoomNav} />
        </Link.AppleZoom>
      </Link>
      <Modal visible={!!pos} transparent animationType="none" statusBarTranslucent onRequestClose={() => close()}>
        <Animated.View style={[{ flex: 1 }, backdrop]}>
          <RNPressable onPress={() => close()} accessibilityLabel="Close menu" className="absolute inset-0 bg-black/20" />
        </Animated.View>
        {pos && (
          <Animated.View accessibilityViewIsModal style={[{ position: 'absolute', top: pos.top, right: pos.right, width: 240, transformOrigin: 'top right' }, menu]} className="rounded-3xl border border-line bg-surface px-4 py-2 shadow-lg">
            <View className="border-b border-line py-3">
              <Text className="font-body-semibold" numberOfLines={1}>{user.name}</Text>
              <Text className="text-sm text-muted" numberOfLines={1}>{user.email}</Text>
            </View>
            <ListRow icon={UserRound} label="Profile" onPress={() => close(openProfile)} />
            <ListRow icon={LogOut} label="Sign out" danger onPress={() => close(() => confirmSignOut(dispatch))} />
          </Animated.View>
        )}
      </Modal>
    </>
  );
}

// The Link passes its navigation as `onPress`; keep it for the menu's Profile row, and open the menu on tap instead.
function AvatarButton({ user, anchor, onOpen, navRef, onPress }) {
  useEffect(() => { navRef.current = onPress; });
  return (
    <Pressable ref={anchor} collapsable={false} onPress={onOpen} accessibilityLabel="Account menu" className="rounded-full">
      <Avatar ring name={user.name} uri={user.avatar || undefined} size={44} />
    </Pressable>
  );
}

// Client Home: bell with the unread count, opening the portal Inbox (clients have no Inbox tab).
function InboxBell() {
  const theme = useTheme();
  const { data: unread = 0 } = useGetUnreadCountQuery();
  return (
    <Pressable
      onPress={() => router.push('/portal/notifications')}
      accessibilityLabel={unread ? `Inbox, ${unread} unread` : 'Inbox'}
      className="h-11 w-11 items-center justify-center rounded-full border border-line bg-surface"
    >
      <Bell size={20} color={theme.ink} />
      {unread > 0 && (
        <View className="absolute -right-1 -top-1 min-w-[20px] items-center rounded-full bg-danger px-1.5">
          <Text className="font-body-semibold text-xs text-bg">{unread > 99 ? '99+' : unread}</Text>
        </View>
      )}
    </Pressable>
  );
}

// Greeting + avatar, the designation pill, and the verify-email nudge; top of every Home.
export function HomeHeader({ subtitle }) {
  const theme = useTheme();
  const user = useSelector((s) => s.auth.user);
  return (
    <>
      <View className="flex-row items-center gap-3">
        <View className="flex-1">
          <Heading>Hi, {user.name.split(' ')[0]}</Heading>
          {!!subtitle && <Text className="mt-0.5 font-body-medium text-sm text-muted">{subtitle}</Text>}
          {!!user.profile?.designation && <Badge label={user.profile.designation} className="mt-1" />}
        </View>
        {user.role === 'client' ? (
          <>
            <InboxBell />
            <Avatar name={user.name} uri={user.avatar} size={48} />
          </>
        ) : <ProfileMenu user={user} />}
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
    </>
  );
}
