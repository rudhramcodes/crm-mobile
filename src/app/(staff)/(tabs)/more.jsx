import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useSelector } from 'react-redux';
import { Search, X } from 'lucide-react-native';
import { AccountSettings, Card, EmptyState, Heading, Input, ListRow, Pressable, Screen, Text } from '@/components';
import { EMPLOYEE_NAV_SECTIONS, NAV_ITEMS, NAV_SECTIONS, QUICK_ACTIONS } from '@/constants';
import { canSeeNavItem, canUseQuickAction } from '@/utils/access';
import { useTheme } from '@/constants/theme';

// Already one tap away on the tab bar.
const IN_TABS = ['/dashboard', '/tasks', '/attendance', '/notifications'];

export default function More() {
  const theme = useTheme();
  const user = useSelector((s) => s.auth.user);
  const [query, setQuery] = useState('');

  const items = useMemo(() => NAV_ITEMS.filter((item) => canSeeNavItem(user, item)), [user]);
  const sections = (user.role === 'employee' ? EMPLOYEE_NAV_SECTIONS : NAV_SECTIONS)
    .map((s) => ({ ...s, items: s.paths.filter((p) => !IN_TABS.includes(p)).map((p) => items.find((i) => i.path === p)).filter(Boolean) }))
    .filter((s) => s.items.length);

  // Global search, like the web command palette: every page and quick action this user can open.
  const q = query.trim().toLowerCase();
  const results = q
    ? [...items, ...QUICK_ACTIONS.filter((a) => canUseQuickAction(user, a))].filter((i) => `${i.label} ${i.path}`.toLowerCase().includes(q))
    : null;

  return (
    <Screen scroll className="gap-5 pt-6">
      <Heading>More</Heading>
      <Input
        value={query}
        onChangeText={setQuery}
        placeholder="Search pages and actions"
        accessibilityLabel="Search pages and actions"
        returnKeyType="search"
        autoCorrect={false}
        right={query ? (
          <Pressable onPress={() => setQuery('')} accessibilityLabel="Clear search" className="h-11 w-11 items-center justify-center">
            <X size={18} color={theme.muted} />
          </Pressable>
        ) : <View className="h-11 w-11 items-center justify-center"><Search size={18} color={theme.muted} /></View>}
      />
      {results ? (
        results.length ? (
          <Card className="py-2">
            {results.map((i) => <ListRow key={i.path} icon={i.icon} label={i.label} onPress={() => router.push(i.path)} />)}
          </Card>
        ) : (
          <EmptyState icon={Search} title="No matches" message={`Nothing called "${query.trim()}". Try ${items.slice(0, 3).map((i) => i.label).join(', ')}.`} />
        )
      ) : (
        <>
          {sections.map((s) => (
            <View key={s.label}>
              <Text className="mb-2 text-caption uppercase text-muted">{s.label}</Text>
              <Card className="py-2">
                {s.items.map((i) => <ListRow key={i.path} icon={i.icon} label={i.label} onPress={() => router.push(i.path)} />)}
              </Card>
            </View>
          ))}
          <AccountSettings />
        </>
      )}
    </Screen>
  );
}
