import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { NativeTabs } from 'expo-router/native-tabs';
import { brand, useTheme } from '@/constants/theme';
import { useGetUnreadCountQuery } from '@/services/notificationApi';

// Android: the theme's colours instead of Material You's wallpaper-based defaults, so every device looks the same.
// Ripple is opaque like the default (Material fades it itself); the indicator is a soft golden wash of the accent.
const androidBar = (t) => ({
  backgroundColor: t.surface,
  indicatorColor: `${t.accent}40`,
  rippleColor: t.accent,
  iconColor: { default: t.muted, selected: t['accent-ink'] },
  labelStyle: { default: { color: t.muted }, selected: { color: t['accent-ink'] } },
  badgeBackgroundColor: t.danger,
  badgeTextColor: t.surface,
});

// System tab bar: liquid glass on iOS 26, Material bottom bar on Android. sf = iOS symbol, md = Android symbol.
export default function StaffTabs() {
  const theme = useTheme();
  const { data: unread = 0, isSuccess } = useGetUnreadCountQuery();
  // The app icon's red number always matches Inbox (it also follows live updates and mark-as-read).
  useEffect(() => {
    if (isSuccess && Platform.OS !== 'web') Notifications.setBadgeCountAsync(unread).catch(() => {});
  }, [unread, isSuccess]);
  return (
    <NativeTabs tintColor={brand.ochre} {...(Platform.OS === 'android' && androidBar(theme))}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="tasks">
        <NativeTabs.Trigger.Label>Tasks</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="checklist" md="checklist" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="attendance">
        <NativeTabs.Trigger.Label>Attendance</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'clock', selected: 'clock.fill' }} md="schedule" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="notifications">
        <NativeTabs.Trigger.Label>Inbox</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'bell', selected: 'bell.fill' }} md="notifications" />
        {unread > 0 && <NativeTabs.Trigger.Badge>{unread > 99 ? '99+' : String(unread)}</NativeTabs.Trigger.Badge>}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="more">
        <NativeTabs.Trigger.Label>More</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'square.grid.2x2', selected: 'square.grid.2x2.fill' }} md="apps" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
