import { useState } from 'react';
import { View, useColorScheme } from 'react-native';
import Svg, { Circle, Line, Rect } from 'react-native-svg';
import { Pressable } from './Pressable';
import { Text } from './Text';
import { useTheme } from '@/constants/theme';
import { cn } from '@/utils/cn';

// Categorical series colours from the brand palette only (DESIGN.md §1: no other hues): ochre, brown/beige, sand,
// green, red, then muted steps. Neighbours are close in hue, so every chart shows its values as text beside the colour
// (legend rows / tapped values): never colour alone.
const SERIES = {
  light: ['#b47737', '#3b2515', '#dcc19d', '#456b33', '#b3412e', '#7a6552', '#8a5524', '#c9a77a'],
  dark: ['#c98d4e', '#f6f1e0', '#dcc19d', '#8fb878', '#e07a63', '#a8957f', '#d29a5e', '#8a6a4a'],
};
export const useSeriesColors = () => SERIES[useColorScheme() === 'dark' ? 'dark' : 'light'];

const Swatch = ({ color }) => <View style={{ backgroundColor: color }} className="h-2.5 w-2.5 rounded-sm" />;

// Part-to-whole donut. slices: [{ key, label, value, display?, slot }] where `slot` is the entity's fixed colour
// index (its place in the constant list), so a colour follows the entity, not its rank. Tap a legend row or slice.
export function DonutChart({ slices, total: totalLabel = 'Total', format = (v) => String(v) }) {
  const theme = useTheme();
  const colors = useSeriesColors();
  const [picked, setPicked] = useState(null);
  const rows = slices.filter((s) => s.value > 0);
  const total = rows.reduce((n, s) => n + s.value, 0);
  const size = 148;
  const stroke = 22;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const gap = rows.length > 1 ? 2 : 0; // 2px surface gap between slices
  const lens = rows.map((s) => (s.value / total) * c);
  const arcs = rows.map((s, i) => ({ ...s, dash: `${Math.max(0, lens[i] - gap)} ${c}`, offset: -lens.slice(0, i).reduce((n, l) => n + l, 0) }));
  const sel = rows.find((s) => s.key === picked);
  const pctOf = (v) => (total ? Math.round((v / total) * 100) : 0);

  return (
    <View className="gap-4">
      <View className="items-center">
        <View style={{ width: size, height: size }} className="items-center justify-center" accessible accessibilityLabel={`${totalLabel} ${format(total)}`}>
          <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
            {arcs.length === 0 && <Circle cx={size / 2} cy={size / 2} r={r} stroke={theme['surface-2']} strokeWidth={stroke} fill="none" />}
            {arcs.map((a) => (
              <Circle
                key={a.key}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={colors[a.slot % colors.length]}
                strokeWidth={picked && picked !== a.key ? stroke - 8 : stroke}
                strokeDasharray={a.dash}
                strokeDashoffset={a.offset}
                onPress={() => setPicked(picked === a.key ? null : a.key)}
              />
            ))}
          </Svg>
          <Text className="max-w-[96px] text-center text-xs text-muted" numberOfLines={1}>{sel ? sel.label : totalLabel}</Text>
          <Text className="font-body-semibold tabular-nums" numberOfLines={1} adjustsFontSizeToFit>{format(sel ? sel.value : total)}</Text>
          {!!sel && <Text className="text-xs tabular-nums text-muted">{pctOf(sel.value)}%</Text>}
        </View>
      </View>
      <View className="gap-1">
        {rows.map((s) => (
          <Pressable
            key={s.key}
            onPress={() => setPicked(picked === s.key ? null : s.key)}
            accessibilityLabel={`${s.label}, ${s.display ?? format(s.value)}, ${pctOf(s.value)} percent`}
            accessibilityState={{ selected: picked === s.key }}
            className={cn('min-h-[36px] flex-row items-center gap-2.5 rounded-xl px-2', picked === s.key && 'bg-surface-2')}
          >
            <Swatch color={colors[s.slot % colors.length]} />
            <Text numberOfLines={1} className="flex-1 text-sm">{s.label}</Text>
            <Text className="text-sm tabular-nums">{s.display ?? format(s.value)}</Text>
            <Text className="w-10 text-right text-xs tabular-nums text-muted">{pctOf(s.value)}%</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// Columns over time, one or two series side by side on one axis. data: [{ key, label }], series: [{ key, label, slot }],
// value(d, s) → number. Tap a column group to read its exact numbers above the chart. Legend when ≥ 2 series.
export function ColumnChart({ data, series, value, format = (v) => String(v), title = (d) => d.label }) {
  const theme = useTheme();
  const colors = useSeriesColors();
  const [width, setWidth] = useState(0);
  const [picked, setPicked] = useState(data.length - 1);
  const height = 140;
  const top = Math.max(1, ...data.flatMap((d) => series.map((s) => value(d, s) || 0)));
  const groupW = width / Math.max(1, data.length);
  const barW = Math.max(3, Math.min(18, (groupW - 6) / series.length - 2));
  const sel = data[Math.min(picked, data.length - 1)];

  return (
    <View className="gap-3">
      {!!sel && (
        <View className="gap-0.5">
          <Text className="text-caption text-muted">{title(sel)}</Text>
          <View className="flex-row flex-wrap gap-x-4">
            {series.map((s) => (
              <View key={s.key} className="flex-row items-center gap-1.5">
                {series.length > 1 && <Swatch color={colors[s.slot % colors.length]} />}
                <Text className="font-body-semibold tabular-nums">{format(value(sel, s) || 0)}</Text>
                {series.length > 1 && <Text className="text-xs text-muted">{s.label}</Text>}
              </View>
            ))}
          </View>
        </View>
      )}
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height }}>
        {width > 0 && (
          <Svg width={width} height={height}>
            {[0.5, 1].map((f) => (
              <Line key={f} x1={0} x2={width} y1={height - f * (height - 8)} y2={height - f * (height - 8)} stroke={theme.line} strokeWidth={1} strokeDasharray="3 4" />
            ))}
            <Line x1={0} x2={width} y1={height - 0.5} y2={height - 0.5} stroke={theme.line} strokeWidth={1} />
            {data.map((d, i) => {
              const groupX = i * groupW + (groupW - series.length * (barW + 2) + 2) / 2;
              return series.map((s, j) => {
                const v = value(d, s) || 0;
                const h = v > 0 ? Math.max(2, (v / top) * (height - 8)) : 0;
                return (
                  <Rect
                    key={`${d.key}-${s.key}`}
                    x={groupX + j * (barW + 2)}
                    y={height - h}
                    width={barW}
                    height={h}
                    rx={barW / 2}
                    fill={colors[s.slot % colors.length]}
                    opacity={i === picked ? 1 : 0.55}
                  />
                );
              });
            })}
          </Svg>
        )}
        {/* Tap targets wider than the bars: one per column group. */}
        <View className="absolute inset-0 flex-row">
          {data.map((d, i) => (
            <Pressable
              key={d.key}
              onPress={() => setPicked(i)}
              haptic={false}
              accessibilityLabel={`${title(d)}: ${series.map((s) => `${s.label} ${format(value(d, s) || 0)}`).join(', ')}`}
              accessibilityState={{ selected: i === picked }}
              className="h-full flex-1"
            />
          ))}
        </View>
      </View>
      <View className="flex-row">
        {data.map((d, i) => (
          <Text key={d.key} numberOfLines={1} className={cn('flex-1 text-center text-[10px]', i === picked ? 'font-body-semibold text-ink' : 'text-muted')}>
            {data.length > 8 && i % 2 && i !== picked ? '' : d.label}
          </Text>
        ))}
      </View>
      <Text className="text-[10px] tabular-nums text-muted">Top line {format(top)}</Text>
    </View>
  );
}
