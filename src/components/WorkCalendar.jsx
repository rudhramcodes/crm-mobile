import { useEffect, useState } from 'react';
import { Modal, Pressable as RNPressable, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSelector } from 'react-redux';
import { CalendarPlus, ChevronLeft, ChevronRight, ListTodo, Plus, Video } from 'lucide-react-native';
import { Pressable } from './Pressable';
import { Text } from './Text';
import { Button } from './Button';
import { joinMeeting, meetingAccess } from './MeetingParts';
import { Section } from './DashboardParts';
import { useTheme } from '@/constants/theme';
import { useGetTasksQuery } from '@/services/taskApi';
import { useGetMeetingsQuery } from '@/services/meetingApi';
import { ymd } from '@/utils/attendance';
import { dayOf } from '@/utils/meetings';
import { isOverdue } from '@/utils/tasks';
import { toDisplay } from '@/utils/time';
import { cn } from '@/utils/cn';

const WEEK = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const idOf = (x) => (x && typeof x === 'object' ? x._id : x);
const addDays = (day, n) => { const d = new Date(`${day}T00:00:00`); d.setDate(d.getDate() + n); return ymd(d); };
export const mondayOf = (day) => addDays(day, -((new Date(`${day}T00:00:00`).getDay() + 6) % 7));
export const dayLabel = (day, opts = { weekday: 'short', day: 'numeric', month: 'short' }) => new Date(`${day}T00:00:00`).toLocaleDateString('en-IN', opts);

// My tasks (owner or helper) and meetings between two days, keyed by local day.
// shortcut: 100 tasks + 100 meetings per range (server max); page if a month ever holds more.
export function useCalendarItems(from, to) {
  const me = useSelector((s) => s.auth.user);
  // Due dates are stored as midnight of a day; a day of slack each side so no timezone drops one, then keyed locally.
  const t = useGetTasksQuery({ page: 1, limit: 100, sort: 'dueDate', dueDateFrom: addDays(from, -1), dueDateTo: `${addDays(to, 1)}T23:59:59.999Z`, assignedTo: me._id });
  const m = useGetMeetingsQuery({ page: 1, limit: 100, dateFrom: from, dateTo: `${to}T23:59:59.999Z` });
  const byDay = {};
  const put = (day, item) => { if (day >= from && day <= to) (byDay[day] ||= []).push(item); };
  for (const x of m.data?.data || []) {
    // The server shows every meeting to staff, so "mine" is filtered here: invited or organised by me.
    if (idOf(x.createdBy) !== me._id && !(x.attendees || []).some((a) => idOf(a) === me._id)) continue;
    put(dayOf(x), {
      kind: 'meeting', id: x._id, title: x.title, sort: x.startTime || '',
      time: x.startTime ? `${toDisplay(x.startTime)}${x.endTime ? ` – ${toDisplay(x.endTime)}` : ''}` : 'Meeting',
      description: x.notes, meta: x.client?.companyName || x.lead?.name || x.location, link: x.meetingLink, done: x.status === 'completed', cancelled: x.status === 'cancelled',
    });
  }
  for (const x of t.data?.data || []) {
    if (!x.dueDate) continue;
    put(ymd(x.dueDate), {
      kind: 'task', id: x._id, title: x.title, sort: '~', // after the timed meetings
      time: 'Due', description: x.description, meta: x.project?.name, late: isOverdue(x), done: x.status === 'done',
    });
  }
  Object.values(byDay).forEach((list) => list.sort((a, b) => a.sort.localeCompare(b.sort)));
  return { byDay, isFetching: t.isFetching || m.isFetching, isError: t.isError || m.isError, refetch: () => Promise.all([t.refetch(), m.refetch()]) };
}

// Tasks: accent (red when late, green when done). Meetings: ink. Inverted on the selected (ink) day.
const dotClass = (it, selected) => (it.kind === 'meeting'
  ? (selected ? 'bg-bg' : 'bg-ink')
  : it.late ? 'bg-danger' : it.done ? 'bg-success' : 'bg-accent');

function Dots({ items = [], selected }) {
  return (
    <View className="h-1.5 flex-row items-center gap-0.5">
      {items.slice(0, 3).map((it) => <View key={it.id} className={cn('h-1.5 w-1.5 rounded-full', dotClass(it, selected))} />)}
    </View>
  );
}

function DayCell({ day, items, selected, onPress, className, children }) {
  const today = day === ymd();
  const n = items?.length || 0;
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={`${dayLabel(day, { weekday: 'long', day: 'numeric', month: 'long' })}, ${n ? `${n} item${n === 1 ? '' : 's'}` : 'nothing planned'}`}
      accessibilityState={{ selected }}
      className={cn('flex-1 items-center justify-center gap-1 rounded-xl', selected ? 'bg-ink' : today && 'border-[1.5px] border-accent', className)}
    >
      {children}
      <Text className={cn('font-body-medium text-sm tabular-nums', selected && 'text-bg')}>{Number(day.slice(8))}</Text>
      <Dots items={items} selected={selected} />
    </Pressable>
  );
}

function NavRow({ title, onPrev, onNext, onToday, prevLabel, nextLabel }) {
  const theme = useTheme();
  return (
    <View className="flex-row items-center">
      <Pressable onPress={onPrev} accessibilityLabel={prevLabel} className="h-11 w-11 items-center justify-center"><ChevronLeft size={22} color={theme.ink} /></Pressable>
      <Text className="flex-1 text-center font-body-semibold text-base">{title}</Text>
      {!!onToday && <Pressable onPress={onToday} accessibilityLabel="Today" className="h-11 justify-center px-2"><Text className="font-body-semibold text-sm text-accent-ink">Today</Text></Pressable>}
      <Pressable onPress={onNext} accessibilityLabel={nextLabel} className="h-11 w-11 items-center justify-center"><ChevronRight size={22} color={theme.ink} /></Pressable>
    </View>
  );
}

// Seven days (Monday first) with arrows to the previous/next week. `day` is the selected day.
export function WeekStrip({ day, onSelect, byDay }) {
  const start = mondayOf(day);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const title = `${dayLabel(days[0], { day: 'numeric', month: 'short' })} – ${dayLabel(days[6], { day: 'numeric', month: 'short' })}`;
  return (
    <View className="gap-2">
      <NavRow title={title} prevLabel="Previous week" nextLabel="Next week" onPrev={() => onSelect(addDays(day, -7))} onNext={() => onSelect(addDays(day, 7))} onToday={day === ymd() ? undefined : () => onSelect(ymd())} />
      <View className="flex-row">
        {days.map((d, i) => (
          <View key={d} className="h-[72px] flex-1 p-0.5">
            <DayCell day={d} items={byDay[d]} selected={d === day} onPress={() => onSelect(d)}>
              <Text className={cn('text-caption', d === day ? 'text-bg' : 'text-muted')}>{WEEK[i]}</Text>
            </DayCell>
          </View>
        ))}
      </View>
    </View>
  );
}

// Month grid (Monday first). `month` is { y, m } (m 0-11).
export function MonthGrid({ month: { y, m }, onMonth, day, onSelect, byDay, loading }) {
  const lead = (new Date(y, m, 1).getDay() + 6) % 7;
  const count = new Date(y, m + 1, 0).getDate();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => ymd(new Date(y, m, i + 1)))];
  const shift = (n) => { const d = new Date(y, m + n, 1); onMonth({ y: d.getFullYear(), m: d.getMonth() }); };
  const goToday = () => { const d = new Date(); onMonth({ y: d.getFullYear(), m: d.getMonth() }); onSelect(ymd()); };
  return (
    <View className="gap-3">
      <NavRow title={new Date(y, m, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })} prevLabel="Previous month" nextLabel="Next month" onPrev={() => shift(-1)} onNext={() => shift(1)} onToday={goToday} />
      <View className="flex-row">{WEEK.map((w, i) => <Text key={i} className="flex-1 text-center text-caption text-muted">{w}</Text>)}</View>
      <View className={cn('flex-row flex-wrap', loading && 'opacity-60')}>
        {cells.map((d, i) => (d
          ? <View key={d} className="aspect-square w-[14.28%] p-0.5"><DayCell day={d} items={byDay[d]} selected={d === day} onPress={() => onSelect(d)} /></View>
          : <View key={`x${i}`} className="aspect-square w-[14.28%]" />))}
      </View>
    </View>
  );
}

export function CalendarLegend() {
  return (
    <View className="flex-row flex-wrap items-center gap-x-4 gap-y-1">
      {[['bg-ink', 'Meeting'], ['bg-accent', 'Task'], ['bg-danger', 'Overdue'], ['bg-success', 'Done']].map(([c, l]) => (
        <View key={l} className="flex-row items-center gap-1.5">
          <View className={cn('h-2 w-2 rounded-full', c)} />
          <Text className="text-xs text-muted">{l}</Text>
        </View>
      ))}
    </View>
  );
}

const SHEET_IN = 240;
const SHEET_OUT = 180;

function AddOption({ icon: Icon, tone, title, hint, onPress }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityLabel={title} className="flex-row items-center gap-4 rounded-3xl border border-line bg-surface-2/60 p-4">
      <View className={cn('h-12 w-12 items-center justify-center rounded-2xl', tone)}>
        <Icon size={22} color={theme.ink} />
      </View>
      <View className="flex-1">
        <Text className="font-body-semibold text-base">{title}</Text>
        <Text className="text-sm text-muted">{hint}</Text>
      </View>
      <ChevronRight size={18} color={theme.muted} />
    </Pressable>
  );
}

// Bottom sheet: Task or Meeting for the chosen day. Slides up with a fading backdrop and slides away on close.
function AddSheet({ day, canMeet, onClose, onTask, onMeeting }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const p = useSharedValue(0);
  const [shown, setShown] = useState(null); // keeps the day on screen while the sheet slides out
  if (day && day !== shown) setShown(day);
  useEffect(() => {
    p.set(withTiming(day ? 1 : 0, { duration: day ? SHEET_IN : SHEET_OUT, easing: day ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic) }));
    if (!day) { const t = setTimeout(() => setShown(null), SHEET_OUT); return () => clearTimeout(t); }
  }, [day, p]);
  const backdrop = useAnimatedStyle(() => ({ opacity: p.get() }));
  const sheet = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - p.get()) * 360 }] }));

  return (
    <Modal visible={!!shown} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <Animated.View style={[{ flex: 1 }, backdrop]}>
        <RNPressable onPress={onClose} accessibilityLabel="Close" className="flex-1 bg-black/45" />
      </Animated.View>
      <Animated.View accessibilityViewIsModal style={[{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: insets.bottom + 16 }, sheet]} className="gap-3 rounded-t-[28px] bg-surface px-5 pt-3">
        <View className="h-1.5 w-10 self-center rounded-full bg-line" />
        <View className="flex-row items-center gap-3 pb-1 pt-2">
          <View className="h-10 w-10 items-center justify-center rounded-xl bg-accent/15"><CalendarPlus size={20} color={theme['accent-ink']} /></View>
          <View className="flex-1">
            <Text className="font-body-semibold text-lg">Add to your calendar</Text>
            <Text className="text-sm text-muted">{shown ? dayLabel(shown, { weekday: 'long', day: 'numeric', month: 'long' }) : ''}</Text>
          </View>
        </View>
        <AddOption icon={ListTodo} tone="bg-accent/20" title="Task" hint="Something to get done by this day" onPress={onTask} />
        {canMeet
          ? <AddOption icon={Video} tone="bg-sand" title="Meeting" hint="A call or visit at a set time" onPress={onMeeting} />
          : <AddOption icon={Video} tone="bg-sand" title="Request a meeting" hint="Ask an admin or manager to set it up" onPress={onMeeting} />}
        <Button title="Cancel" variant="ghost" onPress={onClose} />
      </Animated.View>
    </Modal>
  );
}

// "Add" for a day: returns [add(day), sheet]. Employees can't schedule meetings (the server refuses them),
// so their second option is "Request a meeting" instead.
export function useAddToDay() {
  const me = useSelector((s) => s.auth.user);
  const canMeet = meetingAccess(me).manage;
  const [day, setDay] = useState(null);
  const go = (pathname, params) => { setDay(null); setTimeout(() => router.push({ pathname, params }), SHEET_OUT); };
  const add = setDay;
  const sheet = (
    <AddSheet
      day={day}
      canMeet={canMeet}
      onClose={() => setDay(null)}
      onTask={() => go('/tasks/new', { dueDate: day })}
      onMeeting={() => go(canMeet ? '/meetings/new' : '/meetings/request', { date: day })}
    />
  );
  return [add, sheet];
}

function AgendaItem({ item: it }) {
  const theme = useTheme();
  const meeting = it.kind === 'meeting';
  const Icon = meeting ? Video : ListTodo;
  const bar = meeting ? 'bg-ink' : it.late ? 'bg-danger' : it.done ? 'bg-success' : 'bg-accent';
  return (
    <Pressable
      onPress={() => router.push(meeting ? `/meetings/${it.id}` : `/tasks/${it.id}`)}
      accessibilityLabel={`${meeting ? 'Meeting' : 'Task'}: ${it.title}, ${it.time}`}
      className="flex-row gap-3 overflow-hidden rounded-2xl border border-line bg-surface p-3"
    >
      <View className={cn('w-1 rounded-full', bar)} />
      <View className="flex-1 gap-1">
        <View className="flex-row items-center gap-1.5">
          <Icon size={14} color={theme.muted} />
          <Text className={cn('flex-1 text-xs font-body-semibold uppercase', it.late ? 'text-danger' : 'text-muted')}>
            {meeting ? it.time : it.late ? 'Overdue' : it.done ? 'Done' : 'Task due'}{it.cancelled ? ' · Cancelled' : ''}
          </Text>
        </View>
        <Text numberOfLines={2} className={cn('font-body-semibold', (it.done || it.cancelled) && 'text-muted line-through')}>{it.title}</Text>
        {!!it.description && <Text numberOfLines={2} className="text-sm text-muted">{it.description}</Text>}
        {!!it.meta && <Text numberOfLines={1} className="text-xs text-muted">{it.meta}</Text>}
        {meeting && !!it.link && !it.cancelled && !it.done && (
          <Button title="Join" icon={Video} size="sm" variant="secondary" className="mt-1 self-start" onPress={() => joinMeeting(it.link)} />
        )}
      </View>
    </Pressable>
  );
}

// The chosen day's meetings (by time) then tasks. Empty future days offer Add; past days don't.
export function DayAgenda({ day, items = [] }) {
  const theme = useTheme();
  const me = useSelector((s) => s.auth.user);
  const [add, sheet] = useAddToDay();
  const canAdd = day >= ymd();
  return (
    <View className="gap-2">
      {sheet}
      <View className="min-h-[36px] flex-row items-center gap-2">
        <Text className="flex-1 text-caption uppercase text-muted">{day === ymd() ? 'Today' : dayLabel(day, { weekday: 'long', day: 'numeric', month: 'short' })} · {items.length}</Text>
        {canAdd && !!items.length && <Button title="Add" icon={Plus} size="sm" variant="secondary" onPress={() => add(day)} />}
      </View>
      {items.map((it) => <AgendaItem key={`${it.kind}${it.id}`} item={it} />)}
      {!items.length && (canAdd ? (
        <Pressable onPress={() => add(day)} accessibilityLabel={`Add to ${dayLabel(day)}`} className="flex-row items-center gap-3 rounded-2xl border border-dashed border-line p-4">
          <View className="h-10 w-10 items-center justify-center rounded-xl bg-accent/15"><CalendarPlus size={20} color={theme['accent-ink']} /></View>
          <View className="flex-1">
            <Text className="font-body-medium">No plans yet</Text>
            <Text className="text-sm text-muted">Tap to add a task or {meetingAccess(me).manage ? 'meeting' : 'request a meeting'}.</Text>
          </View>
          <View className="flex-row items-center gap-1 rounded-full bg-accent/15 px-3 py-1.5">
            <Plus size={16} color={theme['accent-ink']} />
            <Text className="font-body-semibold text-sm text-accent-ink">Add</Text>
          </View>
        </Pressable>
      ) : <Text className="py-2 text-sm text-muted">Nothing on this day.</Text>)}
    </View>
  );
}

// Home card: this week's strip and the chosen day's plan. The full month lives at /calendar.
export function CalendarCard() {
  const [day, setDay] = useState(ymd());
  const start = mondayOf(day);
  const { byDay, isFetching } = useCalendarItems(start, addDays(start, 6));
  return (
    <Section title="My calendar" action="Open" onAction={() => router.push({ pathname: '/calendar', params: { day } })}>
      <View className={cn(isFetching && 'opacity-80')}><WeekStrip day={day} onSelect={setDay} byDay={byDay} /></View>
      <DayAgenda day={day} items={byDay[day]} />
    </Section>
  );
}
