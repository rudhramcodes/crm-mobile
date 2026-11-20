import { useState } from 'react';
import { View } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { AlertCircle, CalendarDays, X } from 'lucide-react-native';
import { Pressable } from './Pressable';
import { Text } from './Text';
import { useTheme } from '@/constants/theme';
import { cn } from '@/utils/cn';

// "2026-11-18" read as a local day, not UTC midnight.
export const fromYmd = (s) => (s ? new Date(`${s.slice(0, 10)}T00:00:00`) : null);
export const longDate = (s) => (s ? new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(fromYmd(s)) : '');

// Field that opens a month calendar inline; value and onChange use "YYYY-MM-DD". Pass onClear to allow "not set".
export function DateField({ label, value, onChange, onClear, minDate, maxDate, error, disabled, placeholder = 'Pick a date' }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View className="gap-1.5">
      {!!label && <Text className="font-body-medium text-sm">{label}</Text>}
      <Pressable
        onPress={() => setOpen((o) => !o)}
        disabled={disabled}
        accessibilityLabel={`${label || 'Date'}: ${value ? longDate(value) : 'not set'}`}
        accessibilityState={{ expanded: open }}
        className={cn('h-[52px] flex-row items-center gap-3 rounded-2xl border-[1.5px] bg-surface-2 px-4', error ? 'border-danger' : open ? 'border-accent' : 'border-transparent')}
      >
        <CalendarDays size={18} color={theme.muted} />
        <Text className={cn('flex-1 text-[15px]', !value && 'text-muted')}>{value ? longDate(value) : placeholder}</Text>
        {!!value && !!onClear && !disabled && (
          <Pressable onPress={() => { onClear(); setOpen(false); }} hitSlop={10} accessibilityLabel={`Clear ${label || 'date'}`} className="-mr-2 h-11 w-11 items-center justify-center">
            <X size={18} color={theme.muted} />
          </Pressable>
        )}
      </Pressable>
      {open && (
        <View className="overflow-hidden rounded-2xl border border-line">
          <Calendar
            key={theme.bg}
            current={value || undefined}
            minDate={minDate}
            maxDate={maxDate}
            firstDay={1}
            enableSwipeMonths
            markedDates={value ? { [value]: { selected: true } } : {}}
            onDayPress={(d) => { onChange(d.dateString); setOpen(false); }}
            theme={{
              calendarBackground: theme.surface,
              textSectionTitleColor: theme.muted,
              dayTextColor: theme.ink,
              todayTextColor: theme['accent-ink'],
              selectedDayBackgroundColor: theme.ink,
              selectedDayTextColor: theme.bg,
              textDisabledColor: theme.line,
              monthTextColor: theme.ink,
              arrowColor: theme.ink,
              textDayFontFamily: 'Manrope_500Medium',
              textMonthFontFamily: 'Manrope_600SemiBold',
              textDayHeaderFontFamily: 'Manrope_500Medium',
            }}
          />
        </View>
      )}
      {!!error && (
        <View className="flex-row items-center gap-1.5">
          <AlertCircle size={14} color={theme.danger} />
          <Text className="flex-1 text-sm text-danger">{error}</Text>
        </View>
      )}
    </View>
  );
}
