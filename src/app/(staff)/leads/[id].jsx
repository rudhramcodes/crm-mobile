import { useState } from 'react';
import { Linking, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useSelector } from 'react-redux';
import { Copy, Mail, MessageCircle, Pencil, Phone, Trash2, UserCheck } from 'lucide-react-native';
import {
  Avatar, Button, Card, Chip, ConfirmDialog, DashboardState, Input, LeadStatusBadge, PageHeader, Pressable, Screen, Text, backTo, labelOf, openCommunity, showToast, useLeadStatus, usePullRefresh,
} from '@/components';
import { LEAD_BRANDS, LEAD_SOURCES, LEAD_STATUS } from '@/constants';
import { useAddLeadNoteMutation, useDeleteLeadMutation, useGetLeadByIdQuery } from '@/services/leadApi';
import { useTheme } from '@/constants/theme';
import { canWriteModule } from '@/utils/access';
import { isAdmin, runAction } from '@/utils/attendance';
import { clientIdOf, telLink, waLink } from '@/utils/leads';

const Label = ({ children }) => <Text className="text-caption text-muted">{children}</Text>;
const day = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const roleName = { super_admin: 'Super admin', admin: 'Admin', manager: 'Manager', employee: 'Employee' };

function Field({ label, value }) {
  if (!value) return null;
  return (
    <View className="flex-row gap-3">
      <Text className="w-28 text-sm text-muted">{label}</Text>
      <Text className="flex-1 text-sm" selectable>{value}</Text>
    </View>
  );
}

// Calling or messaging a new lead asks for the community group first (web rule); email never does.
const contact = (l, kind) => {
  const url = kind === 'call' ? telLink(l.phone) : waLink(l.phone);
  if (l.status === 'new') return openCommunity(l, { then: kind });
  return Linking.openURL(url).catch(() => showToast({ title: kind === 'call' ? "Couldn't start the call" : "Couldn't open WhatsApp" }));
};

function LeadBody({ lead: l }) {
  const theme = useTheme();
  const me = useSelector((s) => s.auth.user);
  const canWrite = canWriteModule(me, 'leads');
  const change = useLeadStatus();
  const [addNote, n] = useAddLeadNoteMutation();
  const [del, d] = useDeleteLeadMutation();
  const [note, setNote] = useState('');
  const [confirming, setConfirming] = useState(false);
  const clientId = clientIdOf(l);
  const notes = [...(l.notes || [])].reverse();

  const saveNote = async () => {
    const text = note.trim();
    if (!text || n.isLoading) return;
    if (await runAction(addNote({ id: l._id, text }), 'Note added', "Couldn't add the note")) setNote('');
  };
  const copyId = async () => {
    await Clipboard.setStringAsync(clientId);
    showToast({ title: 'Client ID copied' });
  };

  return (
    <>
      <PageHeader
        caption={l.company ? l.company.toUpperCase() : 'LEAD'}
        title={l.name}
        fallback="/leads"
        right={canWrite ? (
          <Pressable onPress={() => router.push({ pathname: '/leads/new', params: { id: l._id } })} accessibilityLabel="Edit lead" className="h-11 flex-row items-center gap-1.5 rounded-full bg-surface-2 px-4">
            <Pencil size={16} color={theme.ink} />
            <Text className="font-body-semibold text-sm">Edit</Text>
          </Pressable>
        ) : null}
      />
      <LeadStatusBadge status={l.status} />

      <View className="flex-row gap-2">
        {!!l.phone && <Button title="Call" icon={Phone} size="sm" variant="secondary" className="flex-1" onPress={() => contact(l, 'call')} />}
        {!!l.phone && <Button title="WhatsApp" icon={MessageCircle} size="sm" variant="secondary" className="flex-1" onPress={() => contact(l, 'whatsapp')} />}
        {!!l.email && <Button title="Email" icon={Mail} size="sm" variant="secondary" className="flex-1" onPress={() => Linking.openURL(`mailto:${l.email}`)} />}
      </View>

      {canWrite && (
        <View className="gap-2">
          <Label>STAGE</Label>
          <View className="flex-row flex-wrap gap-2">
            {LEAD_STATUS.map((s) => <Chip key={s.value} label={s.value === 'lost' && l.status === 'new' ? 'Lost (contact first)' : s.label} active={l.status === s.value} onPress={() => change(l, s.value)} />)}
          </View>
        </View>
      )}
      {l.status === 'lost' && !!l.lostReason && (
        <Card className="gap-1 p-4">
          <Label>LOST BECAUSE</Label>
          <Text>{l.lostReason}</Text>
        </Card>
      )}
      {canWrite && l.status !== 'won' && <Button title="Convert to client" icon={UserCheck} onPress={() => change(l, 'won')} />}

      <Card className="gap-3 p-4">
        <Field label="Email" value={l.email} />
        <Field label="Phone" value={l.phone} />
        <Field label="Venture" value={labelOf(LEAD_BRANDS, l.brand)} />
        <Field label="Source" value={labelOf(LEAD_SOURCES, l.source)} />
        <Field label="Assigned rep" value={l.assignedTo?.name} />
        <Field label="Follow-up" value={l.followUpDate ? day(l.followUpDate) : ''} />
        <Field label="Converted" value={l.convertedAt ? day(l.convertedAt) : ''} />
        <Field label="Created" value={`${day(l.createdAt)}${l.createdBy?.name ? ` by ${l.createdBy.name}` : ''}`} />
        {!!clientId && (
          <Pressable onPress={copyId} accessibilityLabel={`Client ID ${clientId}. Copy`} className="flex-row items-center gap-3">
            <Text className="w-28 text-sm text-muted">Client ID</Text>
            <Text className="flex-1 font-body-semibold text-sm tabular-nums">{clientId}</Text>
            <Copy size={16} color={theme['accent-ink']} />
          </Pressable>
        )}
      </Card>

      <View className="gap-3">
        <Label>NOTES · {notes.length}</Label>
        {canWrite && (
          <View className="gap-2">
            <Input value={note} onChangeText={setNote} placeholder="Called, wants a quote by Friday" accessibilityLabel="New note" multiline maxLength={2000} style={{ minHeight: 72, height: undefined, paddingTop: 14, paddingBottom: 14, textAlignVertical: 'top' }} />
            <Button title="Add note" size="sm" variant="secondary" loading={n.isLoading} disabled={!note.trim()} onPress={saveNote} />
          </View>
        )}
        {notes.map((x) => (
          <View key={x._id} className="flex-row gap-3">
            <Avatar name={x.createdBy?.name || '?'} uri={x.createdBy?.avatar} size={32} />
            <View className="flex-1 gap-0.5">
              <Text className="text-sm">
                <Text className="font-body-semibold text-sm">{x.createdBy?.name || 'Someone'}</Text>
                <Text className="text-sm text-muted">{x.createdBy?.role ? ` · ${roleName[x.createdBy.role] || x.createdBy.role}` : ''} · {day(x.createdAt)}</Text>
              </Text>
              <Text selectable>{x.text}</Text>
            </View>
          </View>
        ))}
        {!notes.length && <Text className="text-sm text-muted">No notes yet.</Text>}
      </View>

      {isAdmin(me) && canWrite && (
        <>
          <Button title="Delete lead" icon={Trash2} variant="ghost" className="bg-danger/10" textClassName="text-danger" iconColor={theme.danger} onPress={() => setConfirming(true)} />
          <ConfirmDialog
            visible={confirming}
            title="Delete this lead?"
            message={`${l.name} and its notes will be removed from the pipeline.`}
            confirmLabel="Delete lead"
            loading={d.isLoading}
            onCancel={() => setConfirming(false)}
            onConfirm={async () => {
              const ok = await runAction(del(l._id), 'Lead deleted', "Couldn't delete");
              setConfirming(false);
              if (ok) backTo('/leads');
            }}
          />
        </>
      )}
    </>
  );
}

export default function LeadDetail() {
  const { id } = useLocalSearchParams();
  const { data, isLoading, isError, refetch } = useGetLeadByIdQuery(id);
  const refreshControl = usePullRefresh(refetch);
  const lead = data?.data?.lead;
  return (
    <Screen scroll className="gap-5 pt-2" refreshControl={refreshControl}>
      {lead ? <LeadBody key={lead._id} lead={lead} /> : (
        <>
          <PageHeader caption="LEAD" title="" fallback="/leads" />
          <DashboardState isLoading={isLoading} isError={isError || (!isLoading && !lead)} refetch={refetch} />
        </>
      )}
    </Screen>
  );
}
