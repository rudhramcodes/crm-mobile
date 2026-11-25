import { useState } from 'react';
import { View } from 'react-native';
import { useSelector } from 'react-redux';
import { CalendarClock, Check, Trash2 } from 'lucide-react-native';
import { Avatar } from './Avatar';
import { Button } from './Button';
import { Card } from './Card';
import { ConfirmDialog } from './ConfirmDialog';
import { AttachButtons, FilesStrip, ImageViewer, MessageFiles, PendingFiles, useAttachments } from './TaskChat';
import { Input } from './Input';
import { Pressable } from './Pressable';
import { Text } from './Text';
import { BrandMark } from './DashboardParts';
import { brandLabel } from './ClientParts';
import { ZoomLink } from './ZoomLink';
import { PROJECT_STAGES } from '@/constants';
import { useTheme } from '@/constants/theme';
import { useAddProjectMessageMutation, useChangeProjectStageMutation, useDeleteProjectMessageMutation, useGetProjectMessagesQuery } from '@/services/projectApi';
import { useGetUsersQuery } from '@/services/userApi';
import { getTimeAgo } from '@/utils/formatters';
import { idOf, plainMentions } from '@/utils/tasks';
import { runAction } from '@/utils/attendance';
import { isProjectLate, shortDate, stageIndex, stageOf } from '@/utils/projects';
import { cn } from '@/utils/cn';

// Five segments, filled up to the current stage; delivered turns green.
export function StageMeter({ stage, className }) {
  const at = stageIndex(stage);
  return (
    <View className={cn('flex-row gap-1', className)} accessible accessibilityLabel={`Stage ${at + 1} of 5: ${stageOf(stage)?.label || 'not set'}`}>
      {PROJECT_STAGES.map((s, i) => (
        <View key={s.value} className={cn('h-1.5 flex-1 rounded-full', i <= at ? (stage === 'delivered' ? 'bg-success' : 'bg-accent') : 'bg-sand')} />
      ))}
    </View>
  );
}

// A project in the list: title, client and venture, stage, deadline and team.
export function ProjectRow({ project: p }) {
  const theme = useTheme();
  const late = isProjectLate(p);
  const team = p.teamMembers || [];
  return (
    <ZoomLink href={`/projects/${p._id}`}>
      <Pressable
        accessibilityLabel={`${p.title}, ${p.client?.companyName || ''}, ${stageOf(p.stage)?.label || 'no stage'}${p.deadline ? `, due ${shortDate(p.deadline)}` : ''}${late ? ', late' : ''}`}
        className="gap-3 rounded-3xl border border-line bg-surface p-4"
      >
        <View className="flex-row items-start gap-3">
          <View className="flex-1 gap-0.5">
            <Text numberOfLines={2} className="font-body-semibold">{p.title}</Text>
            <View className="flex-row items-center gap-1.5">
              {!!p.client?.brand && <BrandMark brand={p.client.brand} size={16} />}
              <Text numberOfLines={1} className="shrink text-sm text-muted">{[p.client?.companyName, brandLabel(p.client?.brand)].filter(Boolean).join(' · ')}</Text>
            </View>
          </View>
          {!!p.projectCode && <Text className="font-body-medium text-xs tabular-nums text-muted">{p.projectCode}</Text>}
        </View>
        <View className="gap-1.5">
          <StageMeter stage={p.stage} />
          <Text className="text-xs text-muted">{stageOf(p.stage)?.label || 'Needs SOP migration (web)'}</Text>
        </View>
        <View className="flex-row items-center gap-2">
          {!!p.deadline && (
            <View className="flex-row items-center gap-1.5">
              <CalendarClock size={14} color={late ? theme.danger : theme.muted} />
              <Text className={cn('text-sm', late ? 'font-body-semibold text-danger' : 'text-muted')}>{late ? 'Late · ' : ''}{shortDate(p.deadline)}</Text>
            </View>
          )}
          <View className="flex-1" />
          <View className="flex-row">
            {team.slice(0, 4).map((m, i) => <View key={m._id || i} style={{ marginLeft: i ? -8 : 0 }}><Avatar name={m.user?.name || '?'} uri={m.user?.avatar} size={24} /></View>)}
          </View>
          {team.length > 4 && <Text className="text-xs text-muted">+{team.length - 4}</Text>}
        </View>
      </Pressable>
    </ZoomLink>
  );
}

// The SOP stage bar. People who can edit tap a stage to move there; moving back asks why (the server requires it).
// Delivered needs admin QC, a closing note and every deliverable delivered: the server says what's missing.
export function StageBar({ project: p, canEdit }) {
  const theme = useTheme();
  const [change, c] = useChangeProjectStageMutation();
  const [back, setBack] = useState(null); // the earlier stage waiting for a reason
  const [reason, setReason] = useState('');
  const at = stageIndex(p.stage);
  const move = async (stage, why) => {
    const ok = await runAction(change({ id: p._id, stage, reason: why }), `Moved to ${stageOf(stage).label}`, "Couldn't change the stage");
    if (ok) { setBack(null); setReason(''); }
  };
  const tap = (s, i) => {
    if (i === at) return;
    if (i < at) { setBack(s.value); setReason(''); return; }
    move(s.value);
  };

  if (!p.stage) return <Text className="text-sm text-muted">This older project needs its SOP stage set on the web first.</Text>;
  return (
    <View className="gap-3">
      <View className="flex-row gap-1.5">
        {PROJECT_STAGES.map((s, i) => {
          const done = i < at || p.stage === 'delivered';
          return (
            <Pressable
              key={s.value}
              disabled={!canEdit || c.isLoading}
              onPress={() => tap(s, i)}
              accessibilityRole="button"
              accessibilityState={{ selected: i === at, disabled: !canEdit }}
              accessibilityLabel={`${s.label}${i === at ? ', current stage' : canEdit ? `. Move here` : ''}`}
              className="flex-1 items-center gap-1.5"
            >
              <View className={cn('h-7 w-7 items-center justify-center rounded-full', done ? (p.stage === 'delivered' ? 'bg-success' : 'bg-accent') : i === at ? 'border-2 border-accent bg-surface' : 'bg-sand')}>
                {done ? <Check size={14} color={theme.bg} /> : <Text className="text-xs font-body-semibold tabular-nums">{i + 1}</Text>}
              </View>
              <Text numberOfLines={1} className={cn('text-[11px]', i === at ? 'font-body-semibold text-ink' : 'text-muted')}>{s.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {!!back && (
        <View className="gap-2 rounded-2xl bg-surface-2 p-3">
          <Text className="font-body-semibold">Move back to {stageOf(back).label}?</Text>
          <Input value={reason} onChangeText={setReason} placeholder="Why? The team sees this." accessibilityLabel="Reason for moving back" maxLength={2000} autoFocus />
          <View className="flex-row gap-2">
            <Button title="Cancel" variant="secondary" size="sm" className="flex-1" onPress={() => setBack(null)} />
            <Button title="Move back" size="sm" className="flex-1" disabled={!reason.trim()} loading={c.isLoading} onPress={() => move(back, reason.trim())} />
          </View>
        </View>
      )}
      {canEdit && !back && p.stage !== 'delivered' && <Text className="text-xs text-muted">Tap a stage to move the project. Delivered needs the sign-off below.</Text>}
    </View>
  );
}

// Project photos carry no type on older messages: they are always images.
const photos = (m) => (m.images || []).map((f) => ({ ...f, mime: f.mime || 'image/jpeg' }));
export const projectFiles = (messages = [], tasks = []) => [
  ...messages.flatMap(photos),
  ...tasks.flatMap((t) => (t.comments || []).flatMap((c) => c.files || [])),
].reverse();

// Every photo from the project chat and its tasks' chats, newest first.
export function ProjectFiles({ projectId, tasks }) {
  const messages = useGetProjectMessagesQuery({ id: projectId }).data?.data || [];
  const files = projectFiles(messages, tasks);
  if (!files.length) return null;
  return <Card className="p-4"><FilesStrip files={files} /></Card>;
}

// The project's team chat: text, up to 5 photos, @mentions. The owner, the team and the client hear it
// (server: project.service.js addMessage). You can delete your own messages.
export function ProjectChat({ project: p }) {
  const theme = useTheme();
  const me = useSelector((s) => s.auth.user);
  const { data, isLoading: loading } = useGetProjectMessagesQuery({ id: p._id });
  const [add, { isLoading }] = useAddProjectMessageMutation();
  const [remove, r] = useDeleteProjectMessageMutation();
  const [text, setText] = useState('');
  const [shown, setShown] = useState(10);
  const [viewing, setViewing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const att = useAttachments();
  const { files, setFiles } = att;
  const client = me.role === 'client';
  const mention = text.match(/@(\w{1,20})$/)?.[1];
  const users = useGetUsersQuery({ search: mention, isActive: true, limit: 5 }, { skip: !mention || client });
  const people = (mention ? users.data?.data?.users || [] : []).filter((u) => u.role !== 'client');
  const messages = data?.data || [];
  const allImages = messages.flatMap(photos);
  const send = async () => {
    const ok = await runAction(add({ id: p._id, text: text.trim(), files }), null, "Couldn't send");
    if (ok) { setText(''); setFiles([]); }
  };

  return (
    <Card className="gap-4 p-4">
      <View className="flex-row items-center gap-2">
        <Text className="flex-1 font-display text-title">Team chat</Text>
        <Text className="text-sm text-muted tabular-nums">{messages.length}</Text>
      </View>
      {!client && !!p.client && <Text className="-mt-2 text-xs text-muted">The client can read this chat.</Text>}
      {messages.length > shown && <Button title={`Show ${Math.min(20, messages.length - shown)} earlier`} variant="ghost" size="sm" onPress={() => setShown((n) => n + 20)} />}
      {messages.slice(-shown).map((m) => {
        const mine = idOf(m.createdBy) === me._id;
        return (
          <View key={m._id} className="flex-row gap-3">
            <Avatar name={m.createdBy?.name} uri={m.createdBy?.avatar} size={32} />
            <View className="flex-1 gap-1">
              <Text className="text-sm"><Text className="font-body-semibold text-sm">{mine ? 'You' : m.createdBy?.name || 'Someone'}</Text><Text className="text-xs text-muted"> · {getTimeAgo(m.createdAt)}</Text></Text>
              {!!m.text && <Text>{plainMentions(m.text)}</Text>}
              {!!m.taskTitle && <Text className="text-sm text-accent-ink">Task created: {m.taskTitle}</Text>}
              {!!m.images?.length && <MessageFiles files={photos(m)} onOpenImage={(f) => setViewing(allImages.findIndex((x) => x.url === f.url))} />}
              {mine && (
                <Pressable onPress={() => setDeleting(m)} accessibilityLabel="Delete message" className="-ml-2 h-9 flex-row items-center gap-1 self-start px-2">
                  <Trash2 size={14} color={theme.muted} />
                  <Text className="text-xs font-body-semibold text-muted">Delete</Text>
                </Pressable>
              )}
            </View>
          </View>
        );
      })}
      {!loading && !messages.length && <Text className="text-sm text-muted">No messages yet. Share an update or a photo with the team.</Text>}

      <View className="gap-2 border-t border-line pt-4">
        <PendingFiles files={files} remove={att.remove} />
        <Input value={text} onChangeText={setText} placeholder={client ? 'Write a message' : 'Write a message. Type @ to mention.'} accessibilityLabel="Message" multiline maxLength={5000} style={{ minHeight: 52, height: undefined, paddingTop: 14, paddingBottom: 14, textAlignVertical: 'top' }} />
        {people.map((u) => (
          <Pressable key={u._id} onPress={() => setText((t) => t.replace(/@\w{1,20}$/, `@[${u.name}](${u._id}) `))} accessibilityLabel={`Mention ${u.name}`} className="flex-row items-center gap-3 rounded-2xl bg-surface-2 px-3 py-2">
            <Avatar name={u.name} uri={u.avatar} size={28} />
            <Text className="flex-1 font-body-medium">{u.name}</Text>
          </Pressable>
        ))}
        <View className="flex-row items-center gap-1">
          <AttachButtons camera={att.camera} gallery={att.gallery} full={att.full} />
          <View className="flex-1" />
          <Button title="Send" size="sm" disabled={!text.trim() && !files.length} loading={isLoading} onPress={send} />
        </View>
      </View>
      <ImageViewer key={viewing} images={allImages} index={viewing} onClose={() => setViewing(null)} />
      <ConfirmDialog
        visible={!!deleting}
        title="Delete this message?"
        message={deleting?.images?.length ? 'Its photos are deleted too. This can’t be undone.' : 'This can’t be undone.'}
        loading={r.isLoading}
        onCancel={() => setDeleting(null)}
        onConfirm={async () => { await runAction(remove({ id: p._id, messageId: deleting?._id }), 'Message deleted', "Couldn't delete"); setDeleting(null); }}
      />
    </Card>
  );
}

// Segmented tabs for a long page: one short label each, with an optional count. Keeps the page to one job at a time.
