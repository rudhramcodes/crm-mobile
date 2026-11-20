import { useState } from 'react';
import { Alert as RNAlert, Linking, View } from 'react-native';
import { router } from 'expo-router';
import { Building2, Check, ChevronDown, ChevronLeft, ChevronRight, MapPin, Repeat, Search, Trash2, User, Video, X } from 'lucide-react-native';
import { Avatar } from './Avatar';
import { Badge } from './Badge';
import { Button } from './Button';
import { Card } from './Card';
import { Input } from './Input';
import { Pressable } from './Pressable';
import { Text } from './Text';
import { BrandMark } from './DashboardParts';
import { brandLabel } from './ClientParts';
import { showToast } from './Toast';
import { MEETING_STATUS } from '@/constants';
import { useTheme } from '@/constants/theme';
import { useGetMeetingsQuery, useUpdateMeetingMutation } from '@/services/meetingApi';
import { isAdmin, runAction, ymd } from '@/utils/attendance';
import { cleanParams } from '@/utils/leads';
import { dayOf, meetingBrand, monthRange } from '@/utils/meetings';
import { toDisplay } from '@/utils/time';
import { cn } from '@/utils/cn';

const MANAGERS = ['super_admin', 'admin', 'manager'];
// Web rules: managers+ create/edit/change status/handle action items, admins delete, all staff write notes.
export const meetingAccess = (u) => ({ manage: MANAGERS.includes(u?.role), remove: isAdmin(u) });

export const meetingStatus = (v) => MEETING_STATUS.find((s) => s.value === v) || { value: v, label: v || 'Unknown', color: 'bg-surface-2 text-muted' };
export function MeetingStatusBadge({ status }) {
  const m = meetingStatus(status);
  return <Badge label={m.label} color={m.color} />;
}

export const meetingDay = (m, opts = { weekday: 'short', day: 'numeric', month: 'short' }) => new Date(`${dayOf(m)}T00:00:00`).toLocaleDateString('en-IN', opts);
export const meetingTime = (m) => `${toDisplay(m.startTime)} – ${toDisplay(m.endTime)}`;

// Opens Zoho / Google Meet in its app when installed, else the browser.
export const joinMeeting = (url) => Linking.openURL(url).catch(() => showToast({ title: "Couldn't open the meeting link" }));

// Status change from a row: the phone's own picker with the two other statuses.
export function useMeetingStatus() {
  const [update] = useUpdateMeetingMutation();
  return (m) => RNAlert.alert('Change status', m.title, [
    ...MEETING_STATUS.filter((s) => s.value !== m.status).map((s) => ({
      text: s.label,
      onPress: () => runAction(update({ id: m._id, status: s.value }), `Meeting status changed to ${s.value}`, "Couldn't update the status"),
    })),
    { text: 'Cancel', style: 'cancel' },
  ]);
}

// The web's mobile card: when, status, title (+ Recurring), venture, client or lead, place, Join.
export function MeetingRow({ meeting: m, canManage, onDelete }) {
  const theme = useTheme();
  const changeStatus = useMeetingStatus();
  const brand = meetingBrand(m);
  return (
    <Pressable onPress={() => router.push(`/meetings/${m._id}`)} accessibilityLabel={`${m.title}, ${meetingDay(m)}, ${meetingTime(m)}, ${meetingStatus(m.status).label}`} className="gap-3 rounded-3xl border border-line bg-surface p-4">
      <View className="flex-row items-center gap-2">
        <Text className="flex-1 font-body-medium text-sm text-muted">{meetingDay(m)} · {meetingTime(m)}</Text>
        {canManage ? (
          <Pressable onPress={() => changeStatus(m)} accessibilityLabel={`Status ${meetingStatus(m.status).label}. Change`} hitSlop={6}>
            <MeetingStatusBadge status={m.status} />
          </Pressable>
        ) : <MeetingStatusBadge status={m.status} />}
      </View>
      <View className="gap-1.5">
        <Text numberOfLines={2} className="font-body-semibold">{m.title}</Text>
        <View className="flex-row flex-wrap items-center gap-x-3 gap-y-1.5">
          {!!m.seriesId && <Meta icon={Repeat} text="Recurring" />}
          {!!brand && (
            <View className="flex-row items-center gap-1.5">
              <BrandMark brand={brand} size={16} />
              <Text className="text-xs text-muted">{brandLabel(brand)}</Text>
            </View>
          )}
          {m.client ? <Meta icon={Building2} text={m.client.companyName} /> : m.lead ? <Meta icon={User} text={m.lead.name} /> : null}
          {!!m.location && <Meta icon={MapPin} text={m.location} />}
        </View>
      </View>
      <View className="flex-row items-center gap-2 border-t border-line pt-3">
        {m.meetingLink ? (
          <Button title="Join meeting" icon={Video} size="sm" variant="secondary" onPress={() => joinMeeting(m.meetingLink)} />
        ) : <Text className="text-sm text-muted">In-person session</Text>}
        <View className="flex-1" />
        {!!onDelete && (
          <Pressable onPress={() => onDelete(m)} accessibilityLabel={`Delete ${m.title}`} className="h-9 w-9 items-center justify-center rounded-full bg-surface-2">
            <Trash2 size={16} color={theme.danger} />
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

function Meta({ icon: Icon, text }) {
  const theme = useTheme();
  return (
    <View className="max-w-full flex-row items-center gap-1">
      <Icon size={13} color={theme.muted} />
      <Text numberOfLines={1} className="shrink text-xs text-muted">{text}</Text>
    </View>
  );
}

const WEEK = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const dot = { completed: 'bg-success', cancelled: 'bg-danger' };

// Month grid (Sunday first, like the web) that loads the whole visible month with the list's filters.
// Tapping a day lists that day's meetings below.
export function MeetingCalendar({ filters, canManage, onDelete }) {
  const theme = useTheme();
  const [{ y, m }, setYm] = useState(() => ({ y: new Date().getFullYear(), m: new Date().getMonth() }));
  const [day, setDay] = useState(ymd());
  // shortcut: up to 100 meetings per month (server max); page if a month ever holds more.
  const { data, isFetching } = useGetMeetingsQuery(cleanParams({ ...filters, ...monthRange(y, m), limit: 100 }));
  const byDay = {};
  for (const x of data?.data || []) (byDay[dayOf(x)] ||= []).push(x);
  const lead = new Date(y, m, 1).getDay();
  const days = new Date(y, m + 1, 0).getDate();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => ymd(new Date(y, m, i + 1)))];
  const today = ymd();
  const shift = (d) => setYm(({ y: yy, m: mm }) => { const n = new Date(yy, mm + d, 1); return { y: n.getFullYear(), m: n.getMonth() }; });
  const goToday = () => { const n = new Date(); setYm({ y: n.getFullYear(), m: n.getMonth() }); setDay(today); };
  const list = byDay[day] || [];

  return (
    <View className="gap-4">
      <Card className="gap-3 p-4">
        <View className="flex-row items-center">
          <Pressable onPress={() => shift(-1)} accessibilityLabel="Previous month" className="h-11 w-11 items-center justify-center"><ChevronLeft size={22} color={theme.ink} /></Pressable>
          <Text className="flex-1 text-center font-body-semibold text-lg">{new Date(y, m, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</Text>
          <Pressable onPress={goToday} accessibilityLabel="Today" className="h-11 justify-center px-2"><Text className="font-body-semibold text-sm text-accent-ink">Today</Text></Pressable>
          <Pressable onPress={() => shift(1)} accessibilityLabel="Next month" className="h-11 w-11 items-center justify-center"><ChevronRight size={22} color={theme.ink} /></Pressable>
        </View>
        <View className="flex-row">{WEEK.map((w, i) => <Text key={i} className="flex-1 text-center text-caption text-muted">{w}</Text>)}</View>
        <View className={cn('flex-row flex-wrap', isFetching && 'opacity-60')}>
          {cells.map((d, i) => {
            if (!d) return <View key={`x${i}`} className="aspect-square w-[14.28%]" />;
            const on = byDay[d] || [];
            return (
              <View key={d} className="aspect-square w-[14.28%] p-0.5">
                <Pressable
                  onPress={() => setDay(d)}
                  accessibilityLabel={`${Number(d.slice(8))}, ${on.length} ${on.length === 1 ? 'meeting' : 'meetings'}`}
                  accessibilityState={{ selected: d === day }}
                  className={cn('flex-1 items-center justify-center gap-1 rounded-xl', d === day ? 'bg-ink' : d === today && 'border-[1.5px] border-accent')}
                >
                  <Text className={cn('font-body-medium text-sm tabular-nums', d === day && 'text-bg')}>{Number(d.slice(8))}</Text>
                  <View className="h-1.5 flex-row items-center gap-0.5">
                    {on.slice(0, 3).map((x) => <View key={x._id} className={cn('h-1.5 w-1.5 rounded-full', dot[x.status] || (d === day ? 'bg-bg' : 'bg-accent'))} />)}
                    {on.length > 3 && <Text className={cn('text-[8px] leading-[8px]', d === day ? 'text-bg' : 'text-muted')}>+</Text>}
                  </View>
                </Pressable>
              </View>
            );
          })}
        </View>
      </Card>
      <Text className="text-caption text-muted">
        {new Date(`${day}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase()} · {list.length} {list.length === 1 ? 'SESSION' : 'SESSIONS'}
      </Text>
      {list.map((x) => <MeetingRow key={x._id} meeting={x} canManage={canManage} onDelete={onDelete} />)}
      {!list.length && <Text className="text-sm text-muted">No meetings scheduled on this day.</Text>}
    </View>
  );
}

// Searchable single pick with a "None" choice (client, lead). items: [{ value, label, sub, match }].
export function SearchPick({ label, placeholder, searchPlaceholder, items, value, onChange, noneLabel }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const picked = items.find((i) => i.value === value);
  const needle = q.trim().toLowerCase();
  const shown = items.filter((i) => !needle || i.match.toLowerCase().includes(needle)).slice(0, 8);
  const pick = (v) => { onChange(v); setOpen(false); setQ(''); };
  return (
    <View className="gap-1.5">
      <Text className="font-body-medium text-sm">{label}</Text>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityLabel={`${label}: ${picked ? picked.label : 'none'}`}
        accessibilityState={{ expanded: open }}
        className={cn('min-h-[52px] flex-row items-center gap-3 rounded-2xl border-[1.5px] bg-surface-2 px-4 py-2', open ? 'border-accent' : 'border-transparent')}
      >
        <View className="flex-1">
          <Text numberOfLines={1} className={cn('text-[15px]', !picked && 'text-muted')}>{picked ? picked.label : placeholder}</Text>
          {!!picked?.sub && <Text numberOfLines={1} className="text-xs text-muted">{picked.sub}</Text>}
        </View>
        {picked ? (
          <Pressable onPress={() => pick('')} hitSlop={10} accessibilityLabel={`Clear ${label}`} className="-mr-2 h-11 w-11 items-center justify-center"><X size={18} color={theme.muted} /></Pressable>
        ) : <ChevronDown size={18} color={theme.muted} />}
      </Pressable>
      {open && (
        <View className="gap-1.5 rounded-2xl border border-line p-2">
          <Input value={q} onChangeText={setQ} placeholder={searchPlaceholder} accessibilityLabel={searchPlaceholder} autoCorrect={false} right={<View className="h-11 w-11 items-center justify-center"><Search size={18} color={theme.muted} /></View>} />
          <Pressable onPress={() => pick('')} className="rounded-xl px-3 py-2.5"><Text className="text-sm text-muted">{noneLabel}</Text></Pressable>
          {shown.map((i) => (
            <Pressable key={i.value} onPress={() => pick(i.value)} accessibilityState={{ selected: i.value === value }} className={cn('rounded-xl px-3 py-2.5', i.value === value && 'bg-surface-2')}>
              <Text numberOfLines={1} className="font-body-medium">{i.label}</Text>
              {!!i.sub && <Text numberOfLines={1} className="text-xs text-muted">{i.sub}</Text>}
            </Pressable>
          ))}
          {!shown.length && <Text className="px-3 py-2 text-sm text-muted">Nothing matches.</Text>}
        </View>
      )}
    </View>
  );
}

const roleLabel = { super_admin: 'Super admin', admin: 'Admin', manager: 'Manager', employee: 'Employee', client: 'Client' };

// Multi-select of people with search (staff and client portal users, as on the web).
export function AttendeePicker({ users, value, onChange, loading }) {
  const theme = useTheme();
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const shown = users.filter((u) => !needle || `${u.name} ${u.email} ${u.role}`.toLowerCase().includes(needle));
  const toggle = (id) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <View className="gap-2">
      <Text className="font-body-medium text-sm">Attendees & team invites</Text>
      <Text className="text-sm text-muted">{value.length} {value.length === 1 ? 'attendee' : 'attendees'} assigned</Text>
      <Input value={q} onChangeText={setQ} placeholder="Search colleagues..." accessibilityLabel="Search colleagues" autoCorrect={false} autoCapitalize="none" right={<View className="h-11 w-11 items-center justify-center"><Search size={18} color={theme.muted} /></View>} />
      <View className="overflow-hidden rounded-2xl border border-line">
        {loading && <Text className="p-3 text-sm text-muted">Loading team directory...</Text>}
        {!loading && !shown.length && <Text className="p-3 text-sm text-muted">{`No colleagues match "${q}"`}</Text>}
        {shown.slice(0, 30).map((u) => {
          const on = value.includes(u._id);
          return (
            <Pressable key={u._id} onPress={() => toggle(u._id)} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={u.name || u.email} className="flex-row items-center gap-3 border-b border-line px-3 py-2.5">
              <View className={cn('h-6 w-6 items-center justify-center rounded-md border-[1.5px]', on ? 'border-ink bg-ink' : 'border-line')}>{on && <Check size={14} color={theme.bg} />}</View>
              <Avatar name={u.name || u.email} uri={u.avatar} size={32} />
              <View className="flex-1">
                <Text numberOfLines={1} className="font-body-medium">{u.name || u.email}</Text>
                <Text numberOfLines={1} className="text-xs text-muted">{u.email}</Text>
              </View>
              <Badge label={roleLabel[u.role] || u.role} variant={u.role === 'client' ? 'success' : 'default'} />
            </Pressable>
          );
        })}
      </View>
      {shown.length > 30 && <Text className="text-xs text-muted">Showing 30 of {shown.length}. Search to narrow it down.</Text>}
    </View>
  );
}
