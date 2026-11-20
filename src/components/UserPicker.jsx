import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSelector } from 'react-redux';
import { Search, Star, X } from 'lucide-react-native';
import { Avatar } from './Avatar';
import { Chip } from './Chip';
import { Input } from './Input';
import { Pressable } from './Pressable';
import { Text } from './Text';
import { useGetUsersQuery } from '@/services/userApi';
import { useGetWorkloadQuery } from '@/services/taskApi';
import { useGetTeamsQuery } from '@/services/teamApi';
import { useTheme } from '@/constants/theme';

// Type a name, tap a match. Clients are left out: they have no attendance and can't own tasks.
// onCancel adds a Cancel link, so an opened picker is never a dead end.
export function UserPicker({ label = 'Employee', onPick, onCancel }) {
  const theme = useTheme();
  const [q, setQ] = useState('');
  const { data, isFetching } = useGetUsersQuery({ search: q.trim() || undefined, isActive: true, limit: 20 });
  const people = (data?.data?.users || []).filter((u) => u.role !== 'client').slice(0, 8);
  return (
    <View className="gap-2">
      <Input label={label} value={q} onChangeText={setQ} placeholder="Search by name" autoCapitalize="none" right={<Search size={18} color={theme.muted} />} />
      {people.map((u) => (
        <Pressable key={u._id} onPress={() => onPick(u)} accessibilityLabel={`Pick ${u.name}`} className="flex-row items-center gap-3 rounded-2xl bg-surface-2 px-3 py-2.5">
          <Avatar name={u.name} uri={u.avatar} size={32} />
          <View className="flex-1">
            <Text className="font-body-medium">{u.name}</Text>
            <Text numberOfLines={1} className="text-xs text-muted">{u.email}</Text>
          </View>
        </Pressable>
      ))}
      {!people.length && !isFetching && <Text className="text-sm text-muted">{q.trim() ? 'No one matches.' : 'No team members found.'}</Text>}
      {onCancel && (
        <Pressable onPress={onCancel} accessibilityRole="button" className="self-start py-2">
          <Text className="font-body-semibold text-sm text-accent-ink">Cancel</Text>
        </Pressable>
      )}
    </View>
  );
}

// "9 open, 2 overdue" under a name, so work goes to whoever has room.
export const workloadText = (w) => (!w?.open ? 'No open tasks' : `${w.open} open${w.overdue ? `, ${w.overdue} overdue` : ''}`);

// One owner (the star) and any number of helpers. Teams add everyone at once; the lead owns it if nobody does yet.
export function PeoplePicker({ owner, helpers = [], onChange }) {
  const theme = useTheme();
  const me = useSelector((s) => s.auth.user);
  const [q, setQ] = useState('');
  const { data, isFetching } = useGetUsersQuery({ search: q.trim() || undefined, isActive: true, limit: 30 }, { skip: !q.trim() });
  const teams = useGetTeamsQuery().data || [];
  const load = useGetWorkloadQuery().data || {};
  const chosen = [owner, ...helpers].filter(Boolean);
  const has = (id) => chosen.some((p) => p._id === id);
  const set = (people) => onChange({ owner: people[0] || null, helpers: people.slice(1) });

  const addTeam = (t) => {
    const extra = t.members.filter((m) => !has(m._id));
    if (owner || !t.lead) return set([...chosen, ...extra]);
    set([t.lead, ...[...chosen, ...extra].filter((p) => p._id !== t.lead._id)]);
  };
  // People from my teams come first.
  const mine = new Set(teams.filter((t) => t.members.some((m) => m._id === me._id)).flatMap((t) => t.members.map((m) => m._id)));
  const results = (data?.data?.users || [])
    .filter((u) => u.role !== 'client' && !has(u._id))
    .sort((a, b) => mine.has(b._id) - mine.has(a._id))
    .slice(0, 8);
  const hint = (id) => <Text className="text-xs text-muted tabular-nums">{workloadText(load[id])}</Text>;

  return (
    <View className="gap-2">
      {chosen.map((p, i) => (
        <View key={p._id} className="flex-row items-center gap-3 rounded-2xl bg-surface-2 py-2 pl-3 pr-1">
          <Avatar name={p.name} uri={p.avatar} size={32} />
          <View className="flex-1">
            <Text className="font-body-medium">{p.name}{p._id === me._id ? ' (me)' : ''}</Text>
            <Text className="text-xs text-muted">{i === 0 ? 'Owner' : 'Helper'} · {workloadText(load[p._id])}</Text>
          </View>
          <Pressable
            onPress={() => i && set([p, ...chosen.filter((x) => x._id !== p._id)])}
            accessibilityLabel={i === 0 ? `${p.name} is the owner` : `Make ${p.name} the owner`}
            accessibilityState={{ selected: i === 0 }}
            className="h-11 w-11 items-center justify-center"
          >
            <Star size={20} color={i === 0 ? theme.accent : theme.muted} fill={i === 0 ? theme.accent : 'transparent'} />
          </Pressable>
          <Pressable onPress={() => set(chosen.filter((x) => x._id !== p._id))} accessibilityLabel={`Remove ${p.name}`} className="h-11 w-11 items-center justify-center">
            <X size={18} color={theme.muted} />
          </Pressable>
        </View>
      ))}
      {!!teams.length && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-5" contentContainerClassName="gap-2 px-5">
          {teams.map((t) => <Chip key={t._id} label={`+ ${t.name}`} count={t.members.length} onPress={() => addTeam(t)} />)}
        </ScrollView>
      )}
      <Input value={q} onChangeText={setQ} placeholder={chosen.length ? 'Add a helper' : 'Search people'} accessibilityLabel="Search people to add" autoCapitalize="none" right={<Search size={18} color={theme.muted} />} />
      {results.map((u) => (
        <Pressable key={u._id} onPress={() => { set([...chosen, u]); setQ(''); }} accessibilityLabel={`Add ${u.name}`} className="flex-row items-center gap-3 rounded-2xl px-3 py-2">
          <Avatar name={u.name} uri={u.avatar} size={32} />
          <View className="flex-1">
            <Text className="font-body-medium">{u.name}</Text>
            {hint(u._id)}
          </View>
        </Pressable>
      ))}
      {!!q.trim() && !results.length && !isFetching && <Text className="text-sm text-muted">No one matches.</Text>}
    </View>
  );
}
