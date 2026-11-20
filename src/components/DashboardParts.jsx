import { useState } from 'react';
import { Text as RNText, View } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Circle } from 'react-native-svg';
import { Pressable } from './Pressable';
import { Text } from './Text';
import { Card } from './Card';
import { BRAND_METAS } from '@/constants';
import { useTheme } from '@/constants/theme';
import { cn } from '@/utils/cn';

export const shortDate = (d) => new Date(d).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
const monthLabel = (ym, month = 'short') => new Date(`${ym}-01T00:00:00`).toLocaleDateString('en-IN', { month, year: month === 'long' ? 'numeric' : undefined });

// Icon tints from the brand palette only (DESIGN.md §1): ochre for pipeline/pending, green for money in, red for overdue.
const TONES = { accent: ['bg-accent/15', 'accent-ink'], success: ['bg-success/15', 'success'], danger: ['bg-danger/15', 'danger'] };

// "₹12.35L" → ['₹', '12.35', 'L'], "68%" → ['', '68', '%'], "—" → ['', '—', '']: the digits big, the symbol and unit smaller.
export const splitNumber = (value) => {
  const m = String(value ?? '').match(/^(\D*?)(-?[\d.,]+)(\D*)$/);
  return m ? m.slice(1) : ['', String(value ?? ''), ''];
};

// Stat tile (DESIGN.md §5): caption + icon, Numeral XL value, muted sub-line. `alert` = danger fill for overdue/unpaid.
export function StatTile({ label, value, sub, alert, onPress, icon: Icon, tone = 'accent' }) {
  const theme = useTheme();
  const [tint, ink] = TONES[tone];
  const [pre, num, unit] = splitNumber(value);
  return (
    <Card onPress={onPress} accessibilityLabel={`${label}, ${value}`} className={cn('min-w-[45%] flex-1 gap-1 p-4', alert && 'border-transparent bg-danger/10')}>
      <View className="flex-row items-center gap-2">
        <Text className="flex-1 text-caption text-muted">{label}</Text>
        {Icon && (
          <View className={cn('h-8 w-8 items-center justify-center rounded-xl', tint)}>
            <Icon size={16} strokeWidth={1.8} color={theme[ink]} />
          </View>
        )}
      </View>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} className={cn('mt-1 font-display text-[34px] leading-[40px] tabular-nums', alert ? 'text-danger' : 'text-ink')}>
        {/* ₹ in Manrope: Goldenbook has no rupee glyph. */}
        {!!pre && <RNText className="font-body-semibold text-xl text-muted">{pre}</RNText>}
        {num}
        {!!unit && <RNText className="font-display-regular text-2xl">{unit}</RNText>}
      </Text>
      {!!sub && <Text numberOfLines={1} className="text-xs text-muted">{sub}</Text>}
    </Card>
  );
}

// A titled card for one chart or list; `action` is a small text link on the right ("View all").
export function Section({ title, sub, action, onAction, children, className }) {
  return (
    <Card className={cn('gap-4', className)}>
      <View className="flex-row items-start gap-3">
        <View className="flex-1">
          <Text className="font-display-regular text-title">{title}</Text>
          {!!sub && <Text className="text-sm text-muted">{sub}</Text>}
        </View>
        {action && (
          <Pressable onPress={onAction} accessibilityRole="link" className="min-h-[44px] justify-center">
            <Text className="font-body-semibold text-sm text-accent-ink">{action}</Text>
          </Pressable>
        )}
      </View>
      {children}
    </Card>
  );
}

// Horizontal bars, one series, every row labelled, so it needs no legend. rows: [{ key, label, value, display? }]
export function BarList({ rows, max }) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <View className="gap-3">
      {rows.map((r) => (
        <View key={r.key} className="gap-1.5" accessible accessibilityLabel={`${r.label}, ${r.display ?? r.value}`}>
          <View className="flex-row justify-between gap-3">
            <Text numberOfLines={1} className="flex-1 text-sm">{r.label}</Text>
            <Text className="font-body-semibold text-sm tabular-nums">{r.display ?? r.value}</Text>
          </View>
          <View className="h-2 overflow-hidden rounded-full bg-surface-2">
            <View className="h-full rounded-full bg-accent" style={{ width: `${(r.value / top) * 100}%` }} />
          </View>
        </View>
      ))}
    </View>
  );
}

// Monthly bars (DESIGN.md §5): past months sand, current month ochre, the tapped month brown; its numbers show above.
// shortcut: no diagonal hatching on past bars yet, add it with an SVG pattern if the flat sand reads too heavy.
export function MonthBars({ months, value, describe }) {
  const [picked, setPicked] = useState(months.length - 1);
  const top = Math.max(1, ...months.map(value));
  const sel = months[picked];
  return (
    <View className="gap-3">
      {sel && (
        <View>
          <Text className="text-caption text-muted">{monthLabel(sel.month, 'long')}</Text>
          <Text className="font-body-semibold tabular-nums">{describe(sel)}</Text>
        </View>
      )}
      <View className="h-32 flex-row items-end gap-1">
        {months.map((m, i) => (
          <Pressable
            key={m.month}
            onPress={() => setPicked(i)}
            accessibilityLabel={`${monthLabel(m.month, 'long')}: ${describe(m)}`}
            accessibilityState={{ selected: i === picked }}
            className="h-full flex-1 items-center justify-end gap-1 active:scale-100"
          >
            <View
              className={cn('w-full rounded-t-[4px]', i === picked ? 'bg-brown dark:bg-beige' : i === months.length - 1 ? 'bg-accent' : 'bg-sand')}
              style={{ height: `${Math.max(2, (value(m) / top) * 82)}%` }}
            />
            <Text className="text-[10px] text-muted">{monthLabel(m.month).slice(0, 1)}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// Progress ring with the count inside.
export function Ring({ done, total, size = 96, label = 'done' }) {
  const theme = useTheme();
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = total ? done / total : 0;
  return (
    <View style={{ width: size, height: size }} className="items-center justify-center" accessible accessibilityLabel={`${done} of ${total} ${label}`}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={theme['surface-2']} strokeWidth={stroke} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={theme.accent} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${c * pct} ${c}`} />
      </Svg>
      <Text className="font-display text-title tabular-nums">{Math.round(pct * 100)}%</Text>
      <Text className="text-xs text-muted">{done} of {total}</Text>
    </View>
  );
}

// Status counts beside a ring: dot, label, count.
export function StatusCounts({ items }) {
  return (
    <View className="flex-1 gap-2">
      {items.map((s) => (
        <View key={s.key} className="flex-row items-center gap-2">
          <View className={cn('h-2 w-2 rounded-full', s.dot)} />
          <Text className="flex-1 text-sm text-muted">{s.label}</Text>
          <Text className="font-body-semibold text-sm tabular-nums">{s.count}</Text>
        </View>
      ))}
    </View>
  );
}

// Activity row: icon tile, title, description, date on the right.
export function ActivityRow({ icon: Icon, title, description, right, onPress }) {
  const theme = useTheme();
  const Box = onPress ? Pressable : View;
  return (
    <Box onPress={onPress} haptic={false} className="min-h-[56px] flex-row items-center gap-3 py-2">
      <View className="h-10 w-10 items-center justify-center rounded-xl bg-surface-2">
        <Icon size={18} color={theme.ink} />
      </View>
      <View className="flex-1">
        <Text numberOfLines={1} className="font-body-medium">{title}</Text>
        {!!description && <Text numberOfLines={1} className="text-sm text-muted">{description}</Text>}
      </View>
      {right}
    </Box>
  );
}

// Venture logo, or its initial on sand when it has none.
export function BrandMark({ brand, size = 40 }) {
  const meta = BRAND_METAS[brand] || { label: brand, initial: brand?.[0]?.toUpperCase() };
  const box = { width: size, height: size, borderRadius: size * 0.3 };
  if (meta.logo) return <Image source={{ uri: meta.logo }} style={box} contentFit="contain" accessibilityLabel={meta.label} />;
  return (
    <View style={box} className="items-center justify-center bg-sand">
      <Text style={{ fontSize: size * 0.42 }} className="font-display text-brown">{meta.initial}</Text>
    </View>
  );
}
