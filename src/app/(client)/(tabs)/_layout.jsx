import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { NativeTabs } from 'expo-router/native-tabs';
import { brand } from '@/constants/theme';
import { useGetUnreadCountQuery } from '@/services/notificationApi';

// Paths match the web portal (/portal/projects, ...), so notification links land on the same place.
export default function ClientTabs() {
  // The app icon's red number matches the Inbox behind the bell on Home.
  const { data: unread = 0, isSuccess } = useGetUnreadCountQuery();
  useEffect(() => {
    if (isSuccess && Platform.OS !== 'web') Notifications.setBadgeCountAsync(unread).catch(() => {});
  }, [unread, isSuccess]);
  return (
    <NativeTabs tintColor={brand.ochre}>
      <NativeTabs.Trigger name="portal/index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="portal/projects">
        <NativeTabs.Trigger.Label>Projects</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'folder', selected: 'folder.fill' }} md="folder" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="portal/meetings">
        <NativeTabs.Trigger.Label>Meetings</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="calendar" md="calendar_month" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="portal/invoices">
        <NativeTabs.Trigger.Label>Invoices</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'doc.text', selected: 'doc.text.fill' }} md="receipt_long" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="portal/profile">
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'person', selected: 'person.fill' }} md="person" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
