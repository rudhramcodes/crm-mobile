import { View } from 'react-native';
import { router } from 'expo-router';
import { Trash2 } from 'lucide-react-native';
import { Avatar } from './Avatar';
import { Badge } from './Badge';
import { Pressable } from './Pressable';
import { Text } from './Text';
import { ROLE_LABELS } from '@/constants';
import { useTheme } from '@/constants/theme';
import { formatCurrencyExact } from '@/utils/formatters';
import { shortDate } from '@/utils/projects';

const ROLE_VARIANT = { super_admin: 'primary', admin: 'info', manager: 'warning', employee: 'default', client: 'success' };

export const RoleBadge = ({ role }) => <Badge label={ROLE_LABELS[role] || role} variant={ROLE_VARIANT[role]} />;

// The web table row as a card: person, role, employee ID / designation, joined, status, salary (payroll admins).
// readOnly: not tappable (managers viewing a team can't open the edit form).
export function UserRow({ user: u, showSalary, onDelete, readOnly }) {
  const theme = useTheme();
  const active = u.isActive !== false;
  const p = u.profile || {};
  const salary = u.compensation?.monthlyGrossSalary;
  return (
    <Pressable
      onPress={() => router.push(`/users/new?id=${u._id}`)}
      disabled={readOnly}
      accessibilityLabel={`${u.name}, ${ROLE_LABELS[u.role] || u.role}, ${active ? 'active' : 'inactive'}`}
      className="gap-3 rounded-3xl border border-line bg-surface p-4"
    >
      <View className="flex-row items-center gap-3">
        <Avatar name={u.name} uri={u.avatar} size={36} />
        <View className="flex-1 gap-0.5">
          <Text numberOfLines={1} className="font-body-semibold">{u.name}</Text>
          <Text numberOfLines={1} className="text-sm text-muted">{u.email}</Text>
        </View>
        {!!onDelete && (
          <Pressable onPress={() => onDelete(u)} accessibilityLabel={`Delete ${u.name}`} hitSlop={4} className="h-9 w-9 items-center justify-center rounded-full bg-surface-2">
            <Trash2 size={16} color={theme.danger} />
          </Pressable>
        )}
      </View>
      <View className="flex-row flex-wrap items-center gap-2">
        <RoleBadge role={u.role} />
        <Text className={active ? 'font-body-medium text-xs text-success' : 'font-body-medium text-xs text-danger'}>{active ? 'Active' : 'Inactive'}</Text>
        {!!u.location && <Text className="text-xs text-muted">{u.location}</Text>}
        {!!p.employeeId && <Text className="font-body-medium text-xs tabular-nums text-muted">{p.employeeId}</Text>}
        {!!p.designation && <Text numberOfLines={1} className="shrink text-xs text-muted">{p.designation}</Text>}
      </View>
      {(!!p.dateOfJoining || (showSalary && !!salary)) && (
        <View className="flex-row items-center justify-between border-t border-line pt-3">
          <Text className="text-xs text-muted">{p.dateOfJoining ? `Joined ${shortDate(p.dateOfJoining)}` : ''}</Text>
          {showSalary && !!salary && <Text className="font-body-medium text-sm tabular-nums">{formatCurrencyExact(salary)}</Text>}
        </View>
      )}
    </Pressable>
  );
}
