import { useState } from 'react';
import { View } from 'react-native';
import { Search } from 'lucide-react-native';
import { Avatar } from './Avatar';
import { Input } from './Input';
import { Pressable } from './Pressable';
import { Text } from './Text';
import { useGetUsersQuery } from '@/services/userApi';
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
