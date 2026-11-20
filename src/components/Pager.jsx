import { ActivityIndicator, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Pressable } from './Pressable';
import { Text } from './Text';
import { useTheme } from '@/constants/theme';
import { cn } from '@/utils/cn';

function Side({ to, pages, loading, label, icon: Icon, right, onChange }) {
  const theme = useTheme();
  const off = to < 1 || to > pages || loading;
  return (
    <Pressable
      onPress={() => onChange(to)}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={`${label} page`}
      accessibilityState={{ disabled: off }}
      className={cn('h-11 flex-row items-center gap-1 rounded-full border border-line bg-surface px-4', off && 'opacity-40')}
    >
      {!right && <Icon size={18} color={theme.ink} />}
      <Text className="font-body-semibold text-sm">{label}</Text>
      {right && <Icon size={18} color={theme.ink} />}
    </Pressable>
  );
}

// Page controls under a list: ‹ Previous · Page 2 of 7 · Next ›, with "21–40 of 134" under it.
// Hidden when everything fits on one page. `loading` shows while the new page is on its way.
export function Pager({ page, pages, total, limit, onChange, loading, className }) {
  const theme = useTheme();
  if (!pages || pages <= 1) return null;
  const first = (page - 1) * limit + 1;
  const last = Math.min(page * limit, total);
  return (
    <View className={cn('gap-1.5 py-3', className)}>
      <View className="flex-row items-center gap-2">
        <Side to={page - 1} pages={pages} loading={loading} onChange={onChange} label="Previous" icon={ChevronLeft} />
        <View className="flex-1 flex-row items-center justify-center gap-2">
          {loading && <ActivityIndicator size="small" color={theme.muted} />}
          <Text accessibilityLiveRegion="polite" className="font-body-semibold tabular-nums">Page {page} of {pages}</Text>
        </View>
        <Side to={page + 1} pages={pages} loading={loading} onChange={onChange} label="Next" icon={ChevronRight} right />
      </View>
      {!!total && <Text className="text-center text-xs text-muted tabular-nums">{first}–{last} of {total}</Text>}
    </View>
  );
}
