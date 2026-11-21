import { Linking, View } from 'react-native';
import { router } from 'expo-router';
import { Mail, MessageCircle, Phone } from 'lucide-react-native';
import { Avatar } from './Avatar';
import { Badge } from './Badge';
import { Pressable } from './Pressable';
import { Text } from './Text';
import { BrandMark } from './DashboardParts';
import { brandLabel } from './ClientParts';
import { showToast } from './Toast';
import { useTheme } from '@/constants/theme';
import { canWriteModule } from '@/utils/access';
import { isAdmin } from '@/utils/attendance';
import { telLink, waLink } from '@/utils/leads';
import { FREELANCER_STATUS, formatRate, headlineRate } from '@/utils/freelancers';

const MANAGERS = ['super_admin', 'admin', 'manager'];
// Server rules: managers+ view/create/edit/change status; admins archive and hard delete.
export const freelancerAccess = (u) => {
  const write = canWriteModule(u, 'freelancers');
  return { view: MANAGERS.includes(u?.role), manage: write && MANAGERS.includes(u?.role), remove: write && isAdmin(u) };
};

export function FreelancerStatusBadge({ status }) {
  const m = FREELANCER_STATUS.find((s) => s.value === status) || { label: status || 'Unknown' };
  return <Badge label={m.label} variant={m.variant} />;
}

const FAIL = { call: "Couldn't start the call", whatsapp: "Couldn't open WhatsApp", email: "Couldn't open email" };
// WhatsApp goes to the WhatsApp number when one is saved, else the phone.
export const contactFreelancer = (f, kind) => {
  const url = kind === 'call' ? telLink(f.phone) : kind === 'whatsapp' ? waLink(f.whatsappNumber || f.phone) : `mailto:${f.email}`;
  return Linking.openURL(url).catch(() => showToast({ title: FAIL[kind] }));
};

function IconAction({ icon: Icon, label, onPress }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} hitSlop={4} className="h-9 w-9 items-center justify-center rounded-full bg-surface-2">
      <Icon size={16} color={theme.ink} />
    </Pressable>
  );
}

// Name, code · city, ventures, top services, current rate, status, quick contact (the web's list row).
export function FreelancerRow({ freelancer: f }) {
  const profiles = f.ventureProfiles || [];
  const services = [...new Set(profiles.flatMap((p) => p.serviceCategories || []))];
  const rate = headlineRate(f);
  return (
    <Pressable
      onPress={() => router.push(`/freelancers/${f._id}`)}
      accessibilityLabel={`${f.fullName}, ${f.status}`}
      className="gap-3 rounded-3xl border border-line bg-surface p-4"
    >
      <View className="flex-row items-center gap-3">
        <Avatar name={f.fullName} uri={f.profilePhoto || undefined} size={40} />
        <View className="flex-1 gap-0.5">
          <Text numberOfLines={1} className="font-body-semibold">{f.fullName}</Text>
          <Text numberOfLines={1} className="text-sm text-muted">{[f.freelancerCode, f.city].filter(Boolean).join(' · ')}</Text>
        </View>
        <FreelancerStatusBadge status={f.status} />
      </View>
      <View className="flex-row items-center gap-3">
        <Text numberOfLines={1} className="flex-1 text-sm">
          {services.length ? services.slice(0, 3).join(', ') + (services.length > 3 ? ` +${services.length - 3}` : '') : 'Services not added'}
        </Text>
        {!!rate && <Text numberOfLines={1} className="font-body-semibold text-sm tabular-nums">{formatRate(rate)}</Text>}
      </View>
      <View className="flex-row items-center gap-2 border-t border-line pt-3">
        <View className="flex-1 flex-row flex-wrap gap-1.5">
          {profiles.map((p) => (
            <View key={p._id || p.venture} className="flex-row items-center gap-1.5 rounded-full bg-surface-2 py-1 pl-1 pr-2.5">
              <BrandMark brand={p.venture} size={20} />
              <Text numberOfLines={1} className="font-body-medium text-xs">{brandLabel(p.venture)}</Text>
            </View>
          ))}
        </View>
        {!!f.phone && <IconAction icon={Phone} label={`Call ${f.fullName}`} onPress={() => contactFreelancer(f, 'call')} />}
        {!!f.phone && <IconAction icon={MessageCircle} label={`WhatsApp ${f.fullName}`} onPress={() => contactFreelancer(f, 'whatsapp')} />}
        {!!f.email && <IconAction icon={Mail} label={`Email ${f.fullName}`} onPress={() => contactFreelancer(f, 'email')} />}
      </View>
    </Pressable>
  );
}
