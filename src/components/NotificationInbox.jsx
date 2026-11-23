import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useDispatch } from 'react-redux';
import { startOfDay, startOfMonth, startOfWeek } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { BellOff, CheckCheck, CloudOff, Trash2 } from 'lucide-react-native';
import { Chip } from './Chip';
import { EmptyState } from './EmptyState';
import { Heading, Text } from './Text';
import { Pager } from './Pager';
import { Pressable } from './Pressable';
import { Screen } from './Screen';
import { Skeleton } from './Skeleton';
import { showToast } from './Toast';
import { PageHeader } from './AttendanceParts';
import { usePage, usePageNav } from '@/hooks/usePaged';
import { useGetNotificationsQuery, useGetUnreadCountQuery } from '@/services/notificationApi';
import { notificationConfig } from '@/constants/notifications';
import { openNotification } from '@/hooks/useLiveUpdates';
import { sendOrQueue } from '@/utils/offlineQueue';
import { getTimeAgo } from '@/utils/formatters';
import { brand, useTheme } from '@/constants/theme';
import { cn } from '@/utils/cn';

const DATES = [
  { key: 'all', label: 'All time' },
  { key: 'today', label: 'Today', from: startOfDay },
  { key: 'week', label: 'This week', from: startOfWeek },
  { key: 'month', label: 'This month', from: startOfMonth },
];
const LIMIT = 20;
const tiles = { sand: 'bg-sand', accent: 'bg-accent/15', success: 'bg-success/15', danger: 'bg-danger/15' };
const priorityDot = { high: 'bg-danger', medium: 'bg-accent', low: 'bg-success' };

function Row({ item, onOpen, onDelete }) {
  const theme = useTheme();
  const { icon: Icon, tone, label } = notificationConfig(item.type);
  const iconColor = { sand: brand.brown, accent: theme['accent-ink'], success: theme.success, danger: theme.danger }[tone];
  return (
    <ReanimatedSwipeable
      friction={2}
      rightThreshold={40}
      renderRightActions={() => (
        <Pressable onPress={onDelete} accessibilityLabel="Delete notification" className="ml-2 w-20 items-center justify-center rounded-3xl bg-danger">
          <Trash2 size={20} color={theme.bg} />
          <Text className="mt-1 font-body-semibold text-xs text-bg">Delete</Text>
        </Pressable>
      )}
    >
      <Pressable
        onPress={onOpen}
        accessibilityLabel={`${item.read ? '' : 'New. '}${item.title}. ${item.message}`}
        accessibilityActions={[{ name: 'delete', label: 'Delete' }]}
        onAccessibilityAction={(e) => e.nativeEvent.actionName === 'delete' && onDelete()}
        className={cn('flex-row gap-3 rounded-3xl border p-4', item.read ? 'border-line bg-surface' : 'border-accent/30 bg-surface')}
      >
        <View className={cn('h-11 w-11 items-center justify-center rounded-2xl', tiles[tone])}>
          <Icon size={20} color={iconColor} />
        </View>
        <View className="flex-1 gap-1">
          <View className="flex-row items-start gap-2">
            <Text className={cn('flex-1', item.read ? 'font-body-medium' : 'font-body-bold')} numberOfLines={1}>{item.title || label}</Text>
            {!item.read && <View className="mt-1.5 h-2 w-2 rounded-full bg-ochre" />}
          </View>
          <Text className="text-sm text-muted" numberOfLines={2}>{item.message}</Text>
          <View className="mt-1 flex-row items-center gap-2">
            <Text className="text-caption uppercase text-muted">{label}</Text>
            <View className="flex-row items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5">
              <View className={cn('h-1.5 w-1.5 rounded-full', priorityDot[item.priority] ?? priorityDot.medium)} />
              <Text className="text-xs text-muted">{(item.priority ?? 'medium').replace(/^./, (c) => c.toUpperCase())}</Text>
            </View>
            <Text className="ml-auto text-xs text-muted">{getTimeAgo(item.createdAt)}</Text>
          </View>
        </View>
      </Pressable>
    </ReanimatedSwipeable>
  );
}

// The Inbox tab for staff and clients; `client` sends taps to portal pages.
export function NotificationInbox({ client = false }) {
  const theme = useTheme();
  const dispatch = useDispatch();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [range, setRange] = useState('all');
  const [hidden, setHidden] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const pending = useRef(new Map());

  const from = DATES.find((d) => d.key === range).from;
  const arg = useMemo(() => ({ read: unreadOnly ? false : undefined, startDate: from?.(new Date()).toISOString() }), [unreadOnly, from]);
  // 20 per page from the server, with Previous / Next under the list; a filter change goes back to page 1.
  const listRef = useRef(null);
  const [page, setPage] = usePage(`${unreadOnly}|${range}`);
  const { data, isLoading, isError, isFetching, refetch } = useGetNotificationsQuery({ ...arg, page, limit: LIMIT });
  const meta = data?.pagination;
  const goTo = usePageNav(listRef, page, setPage, meta?.pages);
  const { data: unread = 0 } = useGetUnreadCountQuery();
  const [markingAll, setMarkingAll] = useState(false);
  // Offline, deletes and "mark all read" wait and go out when the connection is back.
  const remove = useCallback((id) => sendOrQueue(dispatch, 'deleteNotification', id).catch(() => {}), [dispatch]);

  const items = useMemo(() => (data?.data ?? []).filter((n) => !hidden.includes(n._id)), [data, hidden]);

  // Delete waits 5 s for Undo (DESIGN.md §8); leaving the screen sends whatever is still waiting.
  useEffect(() => {
    const map = pending.current;
    return () => map.forEach(({ timer }, id) => { clearTimeout(timer); remove(id); });
  }, [remove]);

  const deleteLater = (id) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setHidden((h) => [...h, id]);
    const timer = setTimeout(() => { pending.current.delete(id); remove(id); }, 5000);
    pending.current.set(id, { timer });
    showToast({
      title: 'Notification deleted',
      duration: 5000,
      action: {
        label: 'Undo',
        onPress: () => {
          clearTimeout(pending.current.get(id)?.timer);
          pending.current.delete(id);
          setHidden((h) => h.filter((x) => x !== id));
        },
      },
    });
  };

  const readAll = async () => {
    setMarkingAll(true);
    let res;
    try {
      res = await sendOrQueue(dispatch, 'markAllNotificationsRead');
    } catch {
      res = { error: true };
    } finally {
      setMarkingAll(false); // the button always comes back, even if the call throws
    }
    if (res.queued) return showToast({ title: "You're offline", message: "They'll be marked read when you're back online." });
    if (res.error) return showToast({ title: "Couldn't mark them read", message: 'Please try again.' });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showToast({ title: 'All caught up', message: 'Every notification is marked read.' });
  };

  const pull = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const markAllButton = unread > 0 && (
    <Pressable onPress={readAll} disabled={markingAll} accessibilityLabel="Mark all as read" className="h-11 w-11 items-center justify-center rounded-full border border-line bg-surface">
      <CheckCheck size={20} color={theme.ink} />
    </Pressable>
  );

  const header = (
    <View className={cn('gap-4 pb-4', client ? 'pt-2' : 'pt-6')}>
      {client ? <PageHeader caption="PORTAL" title="Inbox" fallback="/portal" right={markAllButton} /> : (
        <View className="flex-row items-center justify-between">
          <Heading>Inbox</Heading>
          {markAllButton}
        </View>
      )}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2" className="-mx-5" contentContainerStyle={{ paddingHorizontal: 20 }}>
        <Chip label="All" active={!unreadOnly} onPress={() => setUnreadOnly(false)} />
        <Chip label="Unread" count={unread} active={unreadOnly} onPress={() => setUnreadOnly(true)} />
        <View className="mx-1 w-px self-stretch bg-line" />
        {DATES.map((d) => <Chip key={d.key} label={d.label} active={range === d.key} onPress={() => setRange(d.key)} />)}
      </ScrollView>
    </View>
  );

  const empty = isLoading ? (
    <View className="gap-3">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-3xl" />)}</View>
  ) : isError ? (
    <EmptyState icon={CloudOff} title="Couldn't load your inbox" message="Check your connection and try again." actionTitle="Try again" onAction={refetch} />
  ) : (
    <EmptyState
      icon={BellOff}
      title={unreadOnly ? 'Nothing unread' : "You're all caught up"}
      message={range === 'all' ? 'New notifications show up here as they happen.' : 'Nothing in this period. Try a wider range.'}
      actionTitle={unreadOnly || range !== 'all' ? 'Show everything' : undefined}
      onAction={() => { setUnreadOnly(false); setRange('all'); }}
    />
  );

  return (
    <Screen tab={!client} className="px-0">
      <FlashList
        ref={listRef}
        contentInsetAdjustmentBehavior="automatic"
        data={items}
        keyExtractor={(n) => n._id}
        renderItem={({ item }) => (
          <View className="pb-3">
            <Row item={item} onOpen={() => openNotification(item, { dispatch, client })} onDelete={() => deleteLater(item._id)} />
          </View>
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={<Pager page={page} pages={meta?.pages} total={meta?.total} limit={LIMIT} loading={isFetching} onChange={goTo} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={pull} tintColor={theme.accent} colors={[theme.accent]} />}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
      />
    </Screen>
  );
}
