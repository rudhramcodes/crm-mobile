import { useState } from 'react';
import { Linking, View } from 'react-native';
import { router } from 'expo-router';
import { Mail, MessageCircle, Phone, Trash2, X } from 'lucide-react-native';
import { Avatar } from './Avatar';
import { Badge } from './Badge';
import { Input } from './Input';
import { Pressable } from './Pressable';
import { Text } from './Text';
import { useGetClientsQuery } from '@/services/clientApi';
import { BrandMark } from './DashboardParts';
import { showToast } from './Toast';
import { BRANDS, CLIENT_STATUS } from '@/constants';
import { useTheme } from '@/constants/theme';
import { canWriteModule } from '@/utils/access';
import { isAdmin } from '@/utils/attendance';
import { telLink, waLink } from '@/utils/leads';

const MANAGERS = ['super_admin', 'admin', 'manager'];
// Web rules: managers+ create/edit/invite/change status, admins delete, managers+ schedule meetings.
export const clientAccess = (u) => {
  const write = canWriteModule(u, 'clients');
  return { manage: write && MANAGERS.includes(u?.role), remove: write && isAdmin(u), meet: MANAGERS.includes(u?.role) };
};

export const brandLabel = (v) => BRANDS.find((b) => b.value === v)?.label || v || '';

export function ClientStatusBadge({ status }) {
  const m = CLIENT_STATUS.find((s) => s.value === status) || { label: status || 'Unknown' };
  return <Badge label={m.label} color={m.color} />;
}

const FAIL = { call: "Couldn't start the call", whatsapp: "Couldn't open WhatsApp", email: "Couldn't open email" };
// Call / WhatsApp / Email straight from the device (no community check for clients, as on the web).
export const contactClient = (c, kind) => {
  const url = kind === 'call' ? telLink(c.phone) : kind === 'whatsapp' ? waLink(c.phone) : `mailto:${c.email}`;
  return Linking.openURL(url).catch(() => showToast({ title: FAIL[kind] }));
};

// Type to find an active client; once picked it shows as a card with an X to change it. The venture comes from the client.
export function ClientField({ value, onChange, error }) {
  const theme = useTheme();
  const [q, setQ] = useState('');
  const found = useGetClientsQuery({ search: q.trim(), status: 'active', limit: 6 }, { skip: q.trim().length < 2 }).data?.data || [];
  if (value) {
    return (
      <View className="flex-row items-center gap-3 rounded-2xl bg-surface-2 px-4 py-3">
        <Avatar name={value.companyName} size={32} />
        <View className="flex-1">
          <Text className="font-body-medium">{value.companyName}</Text>
          {!!value.brand && <Text className="text-xs text-muted">{brandLabel(value.brand)}</Text>}
        </View>
        <Pressable onPress={() => onChange(null)} accessibilityLabel="Change client" className="h-11 w-11 items-center justify-center"><X size={18} color={theme.muted} /></Pressable>
      </View>
    );
  }
  return (
    <View className="gap-2">
      <Input value={q} onChangeText={setQ} placeholder="Search a client" accessibilityLabel="Search a client" autoCorrect={false} error={error} />
      {found.map((c) => (
        <Pressable key={c._id} onPress={() => { onChange(c); setQ(''); }} accessibilityLabel={`Pick ${c.companyName}`} className="flex-row items-center gap-3 rounded-2xl bg-surface-2 px-3 py-2.5">
          <Avatar name={c.companyName} size={28} />
          <Text numberOfLines={1} className="flex-1 font-body-medium">{c.companyName}</Text>
          {!!c.brand && <Text className="text-xs text-muted">{brandLabel(c.brand)}</Text>}
        </Pressable>
      ))}
      {q.trim().length >= 2 && !found.length && <Text className="text-sm text-muted">No active client matches. Add the client first in Clients.</Text>}
    </View>
  );
}

function IconAction({ icon: Icon, label, onPress, color }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} hitSlop={4} className="h-9 w-9 items-center justify-center rounded-full bg-surface-2">
      <Icon size={16} color={color || theme.ink} />
    </Pressable>
  );
}

// Company, contact person, venture, client ID / GST, status, and quick contact (the web's mobile card).
export function ClientRow({ client: c, onDelete }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => router.push(`/clients/${c._id}`)}
      accessibilityLabel={`${c.companyName}, ${c.contactPerson || ''}, ${c.status}`}
      className="gap-3 rounded-3xl border border-line bg-surface p-4"
    >
      <View className="flex-row items-center gap-3">
        <Avatar name={c.companyName} size={36} />
        <View className="flex-1 gap-0.5">
          <View className="flex-row items-center gap-2">
            <Text numberOfLines={1} className="flex-1 font-body-semibold">{c.companyName}</Text>
            {!!c.brand && (
              <View className="max-w-[45%] flex-row items-center gap-1.5">
                <BrandMark brand={c.brand} size={18} />
                <Text numberOfLines={1} className="shrink text-xs text-muted">{brandLabel(c.brand)}</Text>
              </View>
            )}
          </View>
          <Text numberOfLines={1} className="text-sm text-muted">{c.contactPerson || 'No contact person'}</Text>
        </View>
      </View>
      <View className="flex-row flex-wrap items-center gap-2">
        <ClientStatusBadge status={c.status} />
        {!!c.clientId && <Text className="font-body-medium text-xs tabular-nums text-muted">{c.clientId}</Text>}
        {!!c.gstNumber && <Text className="text-xs tabular-nums text-muted">GST {c.gstNumber}</Text>}
      </View>
      <View className="flex-row items-center gap-2 border-t border-line pt-3">
        {!!c.phone && <IconAction icon={Phone} label={`Call ${c.companyName}`} onPress={() => contactClient(c, 'call')} />}
        {!!c.phone && <IconAction icon={MessageCircle} label={`WhatsApp ${c.companyName}`} onPress={() => contactClient(c, 'whatsapp')} />}
        {!!c.email && <IconAction icon={Mail} label={`Email ${c.companyName}`} onPress={() => contactClient(c, 'email')} />}
        <View className="flex-1" />
        {!!onDelete && <IconAction icon={Trash2} label={`Delete ${c.companyName}`} color={theme.danger} onPress={() => onDelete(c)} />}
      </View>
    </Pressable>
  );
}
