import { Children, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Defs, Line, Pattern, Rect } from 'react-native-svg';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { ArrowUpRight } from 'lucide-react-native';
import { Pressable } from './Pressable';
import { Text } from './Text';
import { Card } from './Card';
import { BRAND_METAS } from '@/constants';
import { useTheme } from '@/constants/theme';
import { cn } from '@/utils/cn';

export const shortDate = (d) => new Date(d).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
const monthLabel = (ym, month = 'short') => new Date(`${ym}-01T00:00:00`).toLocaleDateString('en-IN', { month, year: month === 'long' ? 'numeric' : undefined });

// "₹12.35L" → ['₹', '12.35', 'L'], "68%" → ['', '68', '%'], "—" → ['', '—', '']: the digits big, the symbol and unit smaller.
export const splitNumber = (value) => {
  const m = String(value ?? '').match(/^(\D*?)(-?[\d.,]+)(\D*)$/);
  return m ? m.slice(1) : ['', String(value ?? ''), ''];
};

// KpiTiles two to a row. Plain rows, not flex-wrap: Yoga mis-measures a wrapped grid of stretched tiles and the next
// card overlaps the second row. An odd last tile gets an empty partner so it keeps half width.
export function TileGrid({ children }) {
  const tiles = Children.toArray(children).filter(Boolean);
  const rows = [];
  for (let i = 0; i < tiles.length; i += 2) rows.push(tiles.slice(i, i + 2));
  return (
    <View className="gap-3">
      {rows.map((r, i) => (
        <View key={i} className="flex-row gap-3">{r}{r.length === 1 && <View className="flex-1" />}</View>
      ))}
    </View>
  );
}

// A titled card for one chart or list; `action` adds the round ↗ that opens its full screen (and is its a11y label).
export function Section({ title, sub, action, onAction, children, className }) {
  return (
    <Card className={cn('gap-4', className)}>
      <View className="flex-row items-start gap-3">
        <View className="flex-1">
          <Text className="font-display-regular text-title">{title}</Text>
          {!!sub && <Text className="text-sm text-muted">{sub}</Text>}
        </View>
        {!!action && <ArrowButton onPress={onAction} label={action} />}
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
          <View className="h-3 overflow-hidden rounded-full bg-surface-2/50">
            <Hatch />
            <View className="h-full rounded-full bg-accent" style={{ width: `${(r.value / top) * 100}%` }} />
          </View>
        </View>
      ))}
    </View>
  );
}

// Big Goldenbook number with the ₹ and unit smaller, as separate texts on one baseline: nesting the Manrope ₹ inside
// the Goldenbook number pushes the digits up and clips them on iOS. Goldenbook has no ₹ glyph.
export function Numeral({ value, suffix, alert, className }) {
  const [pre, num, unit] = splitNumber(value);
  return (
    <View className={cn('flex-row items-baseline', className)}>
      {!!pre && <Text className="font-body-semibold text-xl text-muted">{pre}</Text>}
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} className={cn('shrink font-display text-[34px] leading-[40px] tabular-nums', alert ? 'text-danger' : 'text-ink')}>{num}</Text>
      {!!unit && <Text className={cn('font-display-regular text-2xl', alert ? 'text-danger' : 'text-ink')}>{unit}</Text>}
      {!!suffix && <Text className="font-display-regular text-xl tabular-nums text-muted"> {suffix}</Text>}
    </View>
  );
}

// Round ↗ on Home cards. Without onPress it's only a hint inside a tappable card, so screen readers skip it.
export function ArrowButton({ onPress, label, small }) {
  const theme = useTheme();
  const size = small ? 'h-8 w-8' : 'h-10 w-10';
  if (!onPress) {
    return (
      <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden className={cn(size, 'items-center justify-center rounded-full border border-line')}>
        <ArrowUpRight size={small ? 15 : 18} strokeWidth={1.8} color={theme.ink} />
      </View>
    );
  }
  return (
    <Pressable onPress={onPress} accessibilityRole="link" accessibilityLabel={label} hitSlop={6} className={cn(size, 'items-center justify-center rounded-full border border-line bg-surface')}>
      <ArrowUpRight size={18} strokeWidth={1.8} color={theme.ink} />
    </Pressable>
  );
}

// Diagonal hatching for the empty part of a bar (DESIGN.md §5). Fills its parent; the parent gives the shape and clips.
export function Hatch() {
  const theme = useTheme();
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <Pattern id="hatch" width={7} height={7} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <Line x1={0} y1={0} x2={0} y2={7} stroke={theme.muted} strokeOpacity={0.45} strokeWidth={2} />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#hatch)" />
    </Svg>
  );
}

// A share as one ochre block and a hatched rest, with the % on top. pct 0–100.
export function SplitBar({ pct, label }) {
  const p = Math.min(100, Math.max(0, Math.round(pct || 0)));
  return (
    <View className="gap-1.5" accessible accessibilityLabel={`${p}% ${label}`}>
      <Text className="text-xs text-muted"><Text className="font-body-semibold text-xs text-ink tabular-nums">{p}%</Text> {label}</Text>
      <View className="h-7 flex-row gap-1">
        {p > 0 && <View className="rounded-lg bg-accent" style={{ flex: p }} />}
        {p < 100 && <View className="overflow-hidden rounded-lg" style={{ flex: 100 - p }}><Hatch /></View>}
      </View>
    </View>
  );
}

const BAR_H = 150;

function BarFill({ grow, height, picked }) {
  const style = useAnimatedStyle(() => ({ height: height * grow.value }));
  return (
    <Animated.View style={[styles.fill, style]}>
      <View className={cn('flex-1 rounded-full', picked ? 'bg-accent' : 'bg-sand')} />
    </Animated.View>
  );
}

// Monthly bars (DESIGN.md §5): each month a hatched pill, filled sand to its value; the picked month is ochre with
// its amount in a bubble. They grow in once (instant with Reduce Motion, Reanimated's default).
export function HatchBars({ months, value, short }) {
  const [picked, setPicked] = useState(months.length - 1);
  const top = Math.max(1, ...months.map(value));
  const grow = useSharedValue(0);
  useEffect(() => { grow.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) }); }, [grow]);
  return (
    <View className="flex-row gap-2 pt-9">
      {months.map((m, i) => {
        const v = value(m);
        const h = v ? Math.max(14, (v / top) * BAR_H) : 0;
        const on = i === picked;
        return (
          <Pressable
            key={m.month}
            onPress={() => setPicked(i)}
            accessibilityLabel={`${monthLabel(m.month, 'long')}: ${short(m)}`}
            accessibilityState={{ selected: on }}
            className="flex-1 items-center gap-2 active:scale-100"
          >
            <View style={{ height: BAR_H }} className="w-full overflow-hidden rounded-full bg-surface-2/50">
              <Hatch />
              <BarFill grow={grow} height={h} picked={on} />
            </View>
            <Text className={cn('text-xs', on ? 'font-body-semibold text-ink' : 'text-muted')}>{monthLabel(m.month)}</Text>
            {on && (
              // Wider than the bar so "₹1.24L" never truncates; centred over it.
              <View pointerEvents="none" style={{ position: 'absolute', bottom: h + 32, left: -28, right: -28 }} className="items-center">
                <View className="rounded-full bg-brown px-2.5 py-1 dark:bg-beige">
                  <Text numberOfLines={1} className="font-body-semibold text-[11px] text-beige tabular-nums dark:text-brown">{short(m)}</Text>
                </View>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

// Counts by stage as one segmented bar and a two-column legend: reads faster than a ring.
export function SegmentBar({ items }) {
  const total = items.reduce((n, s) => n + s.count, 0);
  return (
    <View className="gap-4">
      <View className="h-3 flex-row gap-1">
        {total ? items.filter((s) => s.count).map((s) => <View key={s.key} className={cn('rounded-full', s.dot)} style={{ flex: s.count }} />) : <View className="flex-1 rounded-full bg-surface-2" />}
      </View>
      <Legend items={items} />
    </View>
  );
}

// Dot, label and count in two columns, under a SegmentBar or DotGrid.
export function Legend({ items }) {
  return (
    <View className="flex-row flex-wrap gap-y-2.5">
      {items.map((s) => (
        <View key={s.key} className="w-1/2 flex-row items-center gap-2 pr-4">
          <View className={cn('h-2.5 w-2.5 rounded-full', s.dot)} />
          <Text numberOfLines={1} className="flex-1 text-sm text-muted">{s.label}</Text>
          <Text className="font-body-semibold text-sm tabular-nums">{s.count}</Text>
        </View>
      ))}
    </View>
  );
}

// One dot per person, coloured by group in order; the rest are empty.
// shortcut: caps at 120 dots (then each dot is several people); fine for a team this size.
export function DotGrid({ groups, total }) {
  const per = Math.max(1, Math.ceil(total / 120));
  const n = Math.ceil(total / per);
  const dots = groups.flatMap((g) => Array.from({ length: Math.round(g.count / per) }, () => g.dot)).slice(0, n);
  while (dots.length < n) dots.push('bg-line');
  return (
    <View className="flex-row flex-wrap gap-1.5" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {dots.map((d, i) => <View key={i} className={cn('h-3.5 w-3.5 rounded-full', d)} />)}
    </View>
  );
}

// Home KPI tile: label and ↗, the number, then an optional small visual and a muted line pinned to the bottom.
export function KpiTile({ label, value, suffix, sub, alert, onPress, children }) {
  return (
    <Card onPress={onPress} accessibilityLabel={[label, value, suffix, sub].filter(Boolean).join(', ')} className={cn('flex-1 gap-3 p-4', alert && 'border-transparent bg-danger/10')}>
      <View className="flex-row items-start gap-2">
        <Text numberOfLines={2} className="flex-1 font-body-medium text-sm">{label}</Text>
        {onPress && <ArrowButton small />}
      </View>
      <Numeral value={value} suffix={suffix} alert={alert} />
      {children}
      {!!sub && <Text numberOfLines={1} className={cn('mt-auto text-xs', alert ? 'text-danger' : 'text-muted')}>{sub}</Text>}
    </Card>
  );
}

const styles = StyleSheet.create({ fill: { position: 'absolute', left: 0, right: 0, bottom: 0 } });

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
  // Logos sit inset in the same tile as the initials, so a wide mark (Aghori's eye) never touches the edge.
  if (meta.logo) {
    return (
      <View style={box} className="items-center justify-center overflow-hidden bg-surface-2">
        <Image source={{ uri: meta.logo }} style={{ width: size * 0.72, height: size * 0.72 }} contentFit="contain" accessibilityLabel={meta.label} />
      </View>
    );
  }
  return (
    <View style={box} className="items-center justify-center bg-sand">
      <Text style={{ fontSize: size * 0.42 }} className="font-display text-brown">{meta.initial}</Text>
    </View>
  );
}
