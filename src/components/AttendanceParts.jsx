import { useEffect, useState } from 'react';
import { Linking, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { ChevronLeft, Coffee, MapPin, Trash2 } from 'lucide-react-native';
import { Pressable } from './Pressable';
import { Heading, Text } from './Text';
import { Badge } from './Badge';
import { Button } from './Button';
import { KpiTile, SplitBar, TileGrid } from './DashboardParts';
import { ATTENDANCE_STATUS, REQUEST_STATUS } from '@/constants';
import { useTheme } from '@/constants/theme';
import { activeSession, clockTime, MONTHLY_HOURS_TARGET, placeOf, presentDays, workedSeconds, workingDays, ymd } from '@/utils/attendance';
import { formatHours, formatMinutes } from '@/utils/formatters';
import { cn } from '@/utils/cn';

// Not a stored status: the server adds it on today's Records list for staff with no record yet.
const NOT_CLOCKED_IN = { value: 'not_clocked_in', label: 'Not clocked in', color: 'border border-line bg-surface-2 text-ink', dot: 'bg-muted' };
export const statusMeta = (v) => ATTENDANCE_STATUS.find((s) => s.value === v) || (v === NOT_CLOCKED_IN.value && NOT_CLOCKED_IN) || { value: v, label: v || 'No record', color: 'bg-surface-2 text-muted', dot: 'bg-surface-2' };
export const requestMeta = (v) => REQUEST_STATUS.find((s) => s.value === v) || REQUEST_STATUS[0];

export const backTo = (fallback = '/attendance') => (router.canGoBack() ? router.back() : router.replace(fallback));

// Back chevron, caption and title for pushed screens; `right` holds the screen's main action.
// oneLine: shrink a long title to fit one line instead of wrapping.
export function PageHeader({ caption, title, right, fallback, oneLine }) {
  const theme = useTheme();
  return (
    <View className="gap-1">
      <Pressable onPress={() => backTo(fallback)} accessibilityLabel="Back" className="-ml-2 h-11 w-11 items-center justify-center">
        <ChevronLeft size={26} color={theme.ink} />
      </Pressable>
      <View className="flex-row items-end gap-3">
        <View className="flex-1">
          {!!caption && <Text className="text-caption text-muted">{caption}</Text>}
          <Heading numberOfLines={oneLine ? 1 : 2} adjustsFontSizeToFit={oneLine}>{title}</Heading>
        </View>
        {right}
      </View>
    </View>
  );
}

// Title row for form sheets: swipe down closes on phones; the text button covers web and screen readers.
export function SheetHeader({ title, sub, closeLabel = 'Close' }) {
  return (
    <View className="flex-row items-start gap-3">
      <View className="flex-1">
        <Heading className="text-title">{title}</Heading>
        {!!sub && <Text className="text-sm text-muted">{sub}</Text>}
      </View>
      <Pressable onPress={() => backTo()} accessibilityLabel={closeLabel} className="h-11 justify-center">
        <Text className="font-body-semibold text-accent-ink">{closeLabel}</Text>
      </Pressable>
    </View>
  );
}

export function StatusBadge({ status }) {
  const m = statusMeta(status);
  return <Badge label={m.label} color={m.color} />;
}

export function RequestBadge({ status }) {
  const m = requestMeta(status);
  return <Badge label={m.label} color={m.color} />;
}

// Three small figures side by side: worked, breaks, overtime.
export function MiniStats({ items }) {
  return (
    <View className="flex-row gap-2">
      {items.map((i) => (
        <View key={i.label} className="flex-1 rounded-2xl bg-surface-2 px-2.5 py-2.5" accessible accessibilityLabel={`${i.label}: ${i.value}`}>
          {/* One line: long labels (e.g. CANCELLED in a row of four) shrink a little instead of wrapping. */}
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} className="text-caption text-muted">{i.label.toUpperCase()}</Text>
          <Text className="font-body-semibold tabular-nums">{i.value}</Text>
        </View>
      ))}
    </View>
  );
}

const Place = ({ loc, label }) => {
  const theme = useTheme();
  const place = placeOf(loc);
  if (!place) return null;
  const open = loc.lat != null ? () => Linking.openURL(`https://maps.google.com/?q=${loc.lat},${loc.lng}`) : undefined;
  return (
    <Pressable onPress={open} disabled={!open} haptic={false} accessibilityLabel={`${label} location: ${place}`} className="flex-row items-center gap-1.5">
      <MapPin size={13} color={theme.muted} />
      <Text className="flex-1 text-xs text-muted" numberOfLines={1}>{label} · {place}</Text>
    </Pressable>
  );
};

// Every session of a day with its in/out times, places and breaks (the break history).
export function SessionList({ sessions = [] }) {
  const theme = useTheme();
  const list = sessions.filter((s) => s.clockIn?.time);
  if (!list.length) return <Text className="text-sm text-muted">No sessions recorded.</Text>;
  return (
    <View className="gap-3">
      {list.map((s, i) => {
        const open = !s.clockOut?.time;
        return (
          <View key={s._id || i} className="gap-1.5 rounded-2xl bg-surface-2 p-3.5">
            <View className="flex-row items-center gap-2">
              <Text className="flex-1 font-body-semibold tabular-nums">
                {clockTime(s.clockIn.time)} → {open ? 'now' : clockTime(s.clockOut.time)}
              </Text>
              {open ? <Badge label="Open" variant="success" /> : <Text className="text-sm tabular-nums text-muted">{formatMinutes(s.workMinutes)}</Text>}
            </View>
            <Text className="text-caption text-muted">SESSION {i + 1}</Text>
            <Place loc={s.clockIn.location} label="In" />
            {!open && <Place loc={s.clockOut?.location} label="Out" />}
            {s.breaks?.map((b, j) => (
              <View key={b._id || j} className="flex-row items-center gap-1.5">
                <Coffee size={13} color={theme.muted} />
                <Text className={cn('text-xs tabular-nums', b.end ? 'text-muted' : 'text-accent-ink')}>
                  Break {clockTime(b.start)}{b.end ? ` – ${clockTime(b.end)} · ${formatMinutes(b.duration || (new Date(b.end) - new Date(b.start)) / 60000)}` : ' · on break'}
                </Text>
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}

// Month figures from /attendance/stats. Pass `today` (the own, current-month record) to count the open session live.
export function MonthStats({ stats, year, month, holidays, today, onPress }) {
  const live = !!activeSession(today);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!live) return undefined;
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [live]);

  const days = workingDays(year, month, holidays);
  const present = presentDays(stats);
  // Server totals only include today's hours as of the last punch; swap them for the live figure.
  const hours = Math.max(0, (stats?.totalWorkHours || 0) - (today?.workHours || 0) + (today ? workedSeconds(today, new Date()) / 3600 : 0));
  const secs = Math.floor(hours * 3600);
  const left = Math.max(0, MONTHLY_HOURS_TARGET - hours);
  const done = Math.min(1, hours / MONTHLY_HOURS_TARGET);
  return (
    <TileGrid>
      <KpiTile label="Days present" value={`${present}/${days}`} sub={`${stats?.wfh || 0} WFH · ${stats?.half_day || 0} half · ${stats?.absent || 0} absent`} onPress={onPress} />
      <KpiTile label="Late arrivals" value={stats?.late ?? 0} alert={stats?.late > 0} onPress={onPress} />
      <KpiTile label="Hours worked" value={`${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`} suffix={`${secs % 60}s`} sub={`${formatHours(stats?.totalOvertime)} overtime`} onPress={onPress} />
      <KpiTile label={`Left of ${MONTHLY_HOURS_TARGET}h target`} value={left ? formatHours(left) : 'Done'} sub={`${formatHours(hours)} of ${MONTHLY_HOURS_TARGET}h done`} onPress={onPress}>
        <View className="h-2 overflow-hidden rounded-full bg-surface-2" accessible={false}>
          <View className="h-full rounded-full bg-accent" style={{ width: `${done * 100}%` }} />
        </View>
      </KpiTile>
    </TileGrid>
  );
}

// Working days between two "YYYY-MM-DD" dates, as the server charges leave: Sundays and holidays are free.
export const leaveDays = (a, b, holidays = []) => {
  const off = new Set(holidays.map((h) => ymd(h.date)));
  let n = 0;
  for (const d = new Date(`${a}T00:00:00`); ymd(d) <= b; d.setDate(d.getDate() + 1)) {
    if (d.getDay() !== 0 && !off.has(ymd(d))) n += 1;
  }
  return n;
};
export function BalanceCards({ balance }) {
  return (
    <View className="flex-row gap-3">
      {[['casual', 'Casual', 'Accrues 1 a month'], ['sick', 'Sick', 'Per year']].map(([k, label, note]) => {
        const b = balance?.[k];
        return (
          <KpiTile key={k} label={`${label} leave`} value={b?.balance ?? '—'} sub={`${b?.used ?? 0} of ${b?.total ?? 0} used · ${note}`}>
            <SplitBar pct={b?.total ? (b.balance / b.total) * 100 : 0} label="left" />
          </KpiTile>
        );
      })}
    </View>
  );
}


// Two-tap delete: the first tap arms it (warning haptic), the second deletes. Works on web, where Alert.alert can't confirm.
export function ConfirmDelete({ label, onConfirm, loading }) {
  const theme = useTheme();
  const [armed, setArmed] = useState(false);
  return (
    <Button
      title={armed ? 'Tap again to delete' : label}
      icon={Trash2}
      variant={armed ? 'danger' : 'ghost'}
      loading={loading}
      textClassName={armed ? undefined : 'text-danger'}
      iconColor={armed ? undefined : theme.danger}
      onPress={() => {
        if (armed) return onConfirm();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setArmed(true);
      }}
    />
  );
}

// One attendance record (records list, reports): who, which day, status, hours. Opens that day.
export function RecordRow({ r }) {
  const name = r.employee?.name || 'Unknown employee';
  const day = new Date(r.date);
  const date = ymd(r.date);
  const first = r.sessions?.[0]?.clockIn?.time;
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/attendance/day', params: { date, employee: r.employee?._id || r.employee, name } })}
      accessibilityLabel={`${name}, ${day.toDateString()}, ${statusMeta(r.status).label}`}
      className="flex-row items-center gap-3 py-4"
    >
      <View className="flex-1 gap-0.5">
        <Text numberOfLines={1} className="font-body-semibold">{name}</Text>
        <Text className="text-sm text-muted tabular-nums">
          {day.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
          {first ? ` · in ${clockTime(first)}` : ''}
          {r.workHours ? ` · ${formatHours(r.workHours)}` : ''}
        </Text>
      </View>
      {r.isLate && <Badge label="Late" color="bg-danger/15 text-danger" />}
      <StatusBadge status={r.status} />
    </Pressable>
  );
}
