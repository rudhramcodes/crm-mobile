import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useSelector } from 'react-redux';
import { Check, ExternalLink, Minus, Plus, Square, CheckSquare, X } from 'lucide-react-native';
import { Avatar } from './Avatar';
import { Badge } from './Badge';
import { Button } from './Button';
import { Card } from './Card';
import { ConfirmDialog } from './ConfirmDialog';
import { Chip } from './Chip';
import { DateField } from './DateField';
import { Input } from './Input';
import { Pressable } from './Pressable';
import { Text } from './Text';
import { showToast } from './Toast';
import { UserPicker } from './UserPicker';
import { useTheme } from '@/constants/theme';
import {
  useGetProjectActivitiesQuery, useSaveProjectClosingNoteMutation, useSaveProjectQualityCheckMutation, useUpdateProjectMilestonesMutation, useUpdateProjectMutation,
} from '@/services/projectApi';
import { isAdmin, runAction, ymd } from '@/utils/attendance';
import { shortDate, stageOf } from '@/utils/projects';
import { getTimeAgo } from '@/utils/formatters';
import { idOf } from '@/utils/tasks';
import { cn } from '@/utils/cn';
import { usePaged } from '@/hooks/usePaged';

const Title = ({ children, right }) => (
  <View className="flex-row items-center gap-2">
    <Text className="flex-1 font-display text-title">{children}</Text>
    {right}
  </View>
);
const Chips = ({ items, value, onChange, disabled }) => (
  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-4" contentContainerClassName="gap-2 px-4">
    {items.map(([v, l]) => <Chip key={v} label={l} active={value === v} onPress={() => !disabled && v !== value && onChange(v)} />)}
  </ScrollView>
);
const iso = (d) => (d ? new Date(d).toISOString() : undefined);
// Only plain web links are saved or opened: a typed "javascript:" or app-scheme link never reaches the browser.
// A link typed without a scheme ("drive.google.com/…") gets https://; any other scheme stays and is refused.
const webUrl = (v) => { const t = String(v || '').trim(); return t && !/^[a-z][a-z\d+.-]*:/i.test(t) ? `https://${t}` : t; };
const isWebUrl = (v) => /^https?:\/\/\S+$/i.test(webUrl(v));
const openLink = (url) => {
  if (!isWebUrl(url)) return showToast({ title: "That link isn't a web address" });
  return WebBrowser.openBrowserAsync(webUrl(url)).catch(() => showToast({ title: "Couldn't open the link" }));
};
const tone = (map, v) => { const [label, color] = map[v] || [v || 'Unknown', 'bg-surface-2 text-muted']; return <Badge label={label} color={color} />; };

const DELIVERABLE = { pending: ['Pending', 'bg-surface-2 text-muted'], in_progress: ['In progress', 'bg-accent/15 text-accent-ink'], ready: ['Ready', 'bg-sand text-brown'], delivered: ['Delivered', 'bg-success/15 text-success'] };
const MILESTONE = { pending: ['Not started', 'bg-surface-2 text-muted'], in_progress: ['In progress', 'bg-accent/15 text-accent-ink'], completed: ['Done', 'bg-success/15 text-success'] };
const CATEGORY = [['photo', 'Photo'], ['video', 'Video'], ['others', 'Other']];

// Deliverables: what the client gets. Editors change status, add, and link Drive folders.
export function DeliverablesCard({ project: p, canEdit }) {
  const theme = useTheme();
  const [update, u] = useUpdateProjectMutation();
  const [open, setOpen] = useState(null); // _id of the row being edited
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ title: '', category: 'video', driveUrl: '' });
  const list = p.deliverables || [];
  const clean = (d) => ({ _id: d._id, title: d.title, category: d.category, details: d.details || '', status: d.status, driveUrl: webUrl(d.driveUrl), deliveredAt: d.deliveredAt || null });
  const save = (next, done) => runAction(update({ id: p._id, deliverables: next.map(clean) }), done, "Couldn't save the deliverables");
  const setOne = (d, patch, done) => save(list.map((x) => (x._id === d._id ? { ...x, ...patch, deliveredAt: patch.status === 'delivered' ? new Date().toISOString() : patch.status ? null : x.deliveredAt } : x)), done);
  const badLink = !!draft.driveUrl.trim() && !isWebUrl(draft.driveUrl);
  const add = async () => {
    if (!draft.title.trim() || badLink || u.isLoading) return;
    if (await save([...list, { ...draft, title: draft.title.trim(), driveUrl: webUrl(draft.driveUrl), status: 'pending' }], 'Deliverable added')) { setDraft({ title: '', category: 'video', driveUrl: '' }); setAdding(false); }
  };
  if (!list.length && !canEdit) return null;

  return (
    <Card className="gap-3 p-4">
      <Title right={<Text className="text-sm text-muted tabular-nums">{list.filter((d) => d.status === 'delivered').length}/{list.length} delivered</Text>}>Deliverables</Title>
      {list.map((d) => (
        <View key={d._id} className="gap-2 border-t border-line pt-3">
          <Pressable onPress={() => canEdit && setOpen(open === d._id ? null : d._id)} disabled={!canEdit} accessibilityLabel={`${d.title}, ${DELIVERABLE[d.status]?.[0]}${canEdit ? '. Change' : ''}`} className="flex-row items-center gap-3">
            <View className="flex-1 gap-0.5">
              <Text className="font-body-medium">{d.title}</Text>
              <Text numberOfLines={2} className="text-xs text-muted">{[CATEGORY.find(([v]) => v === d.category)?.[1], d.details, d.deliveredAt && `delivered ${shortDate(d.deliveredAt)}`].filter(Boolean).join(' · ')}</Text>
            </View>
            {tone(DELIVERABLE, d.status)}
            {!!d.driveUrl && (
              <Pressable onPress={() => openLink(d.driveUrl)} accessibilityLabel={`Open ${d.title} in Drive`} className="h-11 w-11 items-center justify-center">
                <ExternalLink size={18} color={theme['accent-ink']} />
              </Pressable>
            )}
          </Pressable>
          {open === d._id && (
            <View className="gap-2">
              <Chips items={Object.entries(DELIVERABLE).map(([v, [l]]) => [v, l])} value={d.status} disabled={u.isLoading} onChange={(v) => setOne(d, { status: v }, `${d.title}: ${DELIVERABLE[v][0]}`)} />
              <DriveLink value={d.driveUrl} onSave={(v) => setOne(d, { driveUrl: v }, 'Link saved')} />
            </View>
          )}
        </View>
      ))}
      {!list.length && <Text className="text-sm text-muted">Nothing listed yet.</Text>}
      {canEdit && (adding ? (
        <View className="gap-2 rounded-2xl bg-surface-2 p-3">
          <Input value={draft.title} onChangeText={(v) => setDraft({ ...draft, title: v })} placeholder="Teaser film, 120 edited photos…" accessibilityLabel="Deliverable" maxLength={200} autoFocus />
          <Chips items={CATEGORY} value={draft.category} onChange={(v) => setDraft({ ...draft, category: v })} />
          <Input value={draft.driveUrl} onChangeText={(v) => setDraft({ ...draft, driveUrl: v })} placeholder="Google Drive link (optional)" accessibilityLabel="Drive link" autoCapitalize="none" autoCorrect={false} keyboardType="url" maxLength={2000} error={badLink ? 'Paste a link starting with https://' : undefined} />
          <View className="flex-row gap-2">
            <Button title="Cancel" variant="secondary" size="sm" className="flex-1" onPress={() => setAdding(false)} />
            <Button title="Add" size="sm" className="flex-1" disabled={!draft.title.trim() || badLink} loading={u.isLoading} onPress={add} />
          </View>
        </View>
      ) : <Button title="Add a deliverable" icon={Plus} variant="secondary" size="sm" onPress={() => setAdding(true)} />)}
    </Card>
  );
}

// Saves once when you leave the field or press done (both fire on submit, so the last saved value is remembered).
function DriveLink({ value = '', onSave }) {
  const [v, setV] = useState(value);
  const [saved, setSaved] = useState(value);
  const bad = !!v.trim() && !isWebUrl(v);
  const commit = () => {
    const next = webUrl(v);
    if (bad || next === saved) return;
    setSaved(next);
    onSave(next);
  };
  return (
    <Input
      value={v}
      onChangeText={setV}
      onBlur={commit}
      onSubmitEditing={commit}
      placeholder="Google Drive link"
      accessibilityLabel="Drive link"
      autoCapitalize="none"
      autoCorrect={false}
      keyboardType="url"
      maxLength={2000}
      error={bad ? 'Paste a link starting with https://' : undefined}
    />
  );
}

// Milestones: the project's big steps. Team members and editors change status and add new ones (dates stay as set on the web).
export function MilestonesCard({ project: p, canEdit }) {
  const me = useSelector((s) => s.auth.user);
  const [save, s] = useUpdateProjectMilestonesMutation();
  const [title, setTitle] = useState('');
  const onTeam = (p.teamMembers || []).some((m) => idOf(m.user) === me._id);
  const can = canEdit || (onTeam && me.role === 'employee');
  const list = p.milestones || [];
  // Every milestone goes back with its date unchanged; a changed or dropped date would need a reason.
  const body = (next) => next.map((m) => ({ _id: m._id, title: m.title, description: m.description || '', dueDate: iso(m.dueDate), status: m.status }));
  const setStatus = (m, status) => runAction(save({ id: p._id, milestones: body(list.map((x) => (x._id === m._id ? { ...x, status } : x))) }), `${m.title}: ${MILESTONE[status][0]}`, "Couldn't save");
  const add = async () => {
    const t = title.trim();
    if (t.length < 2 || s.isLoading) return;
    if (await runAction(save({ id: p._id, milestones: [...body(list), { title: t, status: 'pending' }] }), 'Milestone added', "Couldn't add it")) setTitle('');
  };
  if (!list.length && !can) return null;

  return (
    <Card className="gap-3 p-4">
      <Title right={<Text className="text-sm text-muted tabular-nums">{list.filter((m) => m.status === 'completed').length}/{list.length}</Text>}>Milestones</Title>
      {list.map((m) => (
        <View key={m._id} className="gap-2 border-t border-line pt-3">
          <View className="flex-row items-center gap-3">
            <View className="flex-1">
              <Text className="font-body-medium">{m.title}</Text>
              {!!m.dueDate && <Text className="text-xs text-muted">Due {shortDate(m.dueDate)}</Text>}
            </View>
            {!can && tone(MILESTONE, m.status)}
          </View>
          {can && <Chips items={Object.entries(MILESTONE).map(([v, [l]]) => [v, l])} value={m.status} disabled={s.isLoading} onChange={(v) => setStatus(m, v)} />}
        </View>
      ))}
      {can && <Input value={title} onChangeText={setTitle} onSubmitEditing={add} submitBehavior="submit" returnKeyType="done" placeholder="Add a milestone" accessibilityLabel="Add a milestone" maxLength={200} />}
    </Card>
  );
}

// Team: who works on the project. Editors add and remove people.
export function TeamCard({ project: p, canEdit }) {
  const theme = useTheme();
  const me = useSelector((s) => s.auth.user);
  const [update, u] = useUpdateProjectMutation();
  const [picking, setPicking] = useState(false);
  const [removing, setRemoving] = useState(null);
  const team = p.teamMembers || [];
  const save = (next, done) => runAction(update({ id: p._id, teamMembers: next.map((m) => ({ user: idOf(m.user), role: m.role || '' })) }), done, "Couldn't save the team");
  const removingMe = removing && idOf(removing.user) === me._id;
  const add = (user) => { setPicking(false); if (!team.some((m) => idOf(m.user) === user._id)) save([...team, { user }], `${user.name} added`); };
  return (
    <Card className="gap-3 p-4">
      <Title>Team</Title>
      {team.map((m) => (
        <View key={m._id || idOf(m.user)} className="flex-row items-center gap-3">
          <Avatar name={m.user?.name || '?'} uri={m.user?.avatar} size={32} />
          <Text className="flex-1 font-body-medium">{idOf(m.user) === me._id ? 'You' : m.user?.name || 'Someone'}{m.role ? <Text className="text-sm text-muted"> · {m.role}</Text> : ''}</Text>
          {canEdit && (
            <Pressable onPress={() => setRemoving(m)} disabled={u.isLoading} accessibilityLabel={`Remove ${m.user?.name}`} className="h-11 w-11 items-center justify-center">
              <X size={18} color={theme.muted} />
            </Pressable>
          )}
        </View>
      ))}
      {!team.length && <Text className="text-sm text-muted">Nobody added yet.</Text>}
      {canEdit && (picking ? <UserPicker label="Add to the team" onPick={add} onCancel={() => setPicking(false)} /> : <Button title="Add someone" icon={Plus} variant="secondary" size="sm" onPress={() => setPicking(true)} />)}
      <ConfirmDialog
        visible={!!removing}
        title={removingMe ? 'Leave this project?' : `Remove ${removing?.user?.name || 'them'}?`}
        message={removingMe ? 'You may no longer be able to edit it.' : 'They stop getting this project’s updates. You can add them back any time.'}
        confirmLabel={removingMe ? 'Leave' : 'Remove'}
        loading={u.isLoading}
        onCancel={() => setRemoving(null)}
        onConfirm={async () => {
          const m = removing;
          await save(team.filter((x) => x !== m), removingMe ? 'You left the project' : `${m.user?.name || 'They'} removed`);
          setRemoving(null);
        }}
      />
    </Card>
  );
}

const QC = [
  ['scopeComplete', 'Everything in the scope is done'],
  ['filesCorrect', 'Files are correct and complete'],
  ['clientCommitmentsMet', 'Promises to the client are met'],
  ['noOpenBlockers', 'Nothing is blocking delivery'],
];

// Sign-off before Delivered: the admin's 4-point quality check and the closing note (admins and the project's manager).
export function SignOffCard({ project: p, canEdit }) {
  const theme = useTheme();
  const me = useSelector((s) => s.auth.user);
  const [qc, q] = useSaveProjectQualityCheckMutation();
  const [note, n] = useSaveProjectClosingNoteMutation();
  const c = p.closingNote || {};
  const [what, setWhat] = useState(c.deliveredWhat || '');
  const [when, setWhen] = useState(c.deliveredWhen ? ymd(c.deliveredWhen) : ymd());
  const [pending, setPending] = useState(c.pendingItems || '');
  const delivered = p.stage === 'delivered';
  const admin = isAdmin(me);
  const checks = Object.fromEntries(QC.map(([k]) => [k, !!p.qcChecklist?.[k]?.checked]));
  const passed = p.qcChecklist?.status === 'passed';
  if (!p.stage || (!canEdit && !admin)) return null;
  const toggle = (k) => runAction(qc({ id: p._id, ...checks, [k]: !checks[k] }), null, "Couldn't save the check");
  const saveNote = () => runAction(note({ id: p._id, deliveredWhat: what.trim(), deliveredWhen: new Date(`${when}T12:00:00`).toISOString(), pendingItems: pending.trim() }), 'Closing note saved', "Couldn't save the note");

  return (
    <Card className="gap-4 p-4">
      <Title right={passed ? <Badge label="QC passed" color="bg-success/15 text-success" /> : null}>Sign-off</Title>
      <Text className="-mt-2 text-sm text-muted">Needed before the project can move to Delivered, along with every deliverable marked delivered.</Text>
      <View className="gap-1">
        <Text className="text-caption text-muted">QUALITY CHECK {admin ? '' : '(ADMIN)'}</Text>
        {QC.map(([k, label]) => {
          const by = p.qcChecklist?.[k]?.checkedBy?.name;
          return (
            <Pressable key={k} onPress={() => toggle(k)} disabled={!admin || delivered || q.isLoading} accessibilityRole="checkbox" accessibilityState={{ checked: checks[k], disabled: !admin || delivered }} accessibilityLabel={label} className="min-h-[44px] flex-row items-center gap-3">
              {checks[k] ? <CheckSquare size={22} color={theme.success} /> : <Square size={22} color={theme.muted} />}
              <View className="flex-1">
                <Text className={cn(checks[k] && 'text-muted')}>{label}</Text>
                {checks[k] && !!by && <Text className="text-xs text-muted">{by}</Text>}
              </View>
            </Pressable>
          );
        })}
      </View>
      <View className="gap-2">
        <Text className="text-caption text-muted">CLOSING NOTE</Text>
        {delivered || !canEdit ? (
          c.deliveredWhat ? (
            <View className="gap-1">
              <Text>{c.deliveredWhat}</Text>
              {!!c.pendingItems && <Text className="text-sm text-muted">Still pending: {c.pendingItems}</Text>}
              <Text className="text-xs text-muted">Delivered {shortDate(c.deliveredWhen)}{c.writtenBy?.name ? ` · by ${c.writtenBy.name}` : ''}</Text>
            </View>
          ) : <Text className="text-sm text-muted">Not written yet.</Text>
        ) : (
          <>
            <Input value={what} onChangeText={setWhat} placeholder="What was delivered" accessibilityLabel="What was delivered" multiline maxLength={4000} style={{ minHeight: 80, height: undefined, paddingTop: 14, textAlignVertical: 'top' }} />
            <DateField label="Delivered on" value={when} onChange={setWhen} />
            <Input value={pending} onChangeText={setPending} placeholder="Anything still pending (optional)" accessibilityLabel="Pending items" maxLength={4000} />
            <Button title={c.deliveredWhat ? 'Update closing note' : 'Save closing note'} icon={Check} variant="secondary" size="sm" disabled={!what.trim() || !when} loading={n.isLoading} onPress={saveNote} />
          </>
        )}
      </View>
    </Card>
  );
}

const INWARD = [['pending', 'Pending'], ['received', 'Received'], ['partially_received', 'Partly received'], ['verified', 'Verified']];
const CREW = [['photographers', 'Photographers'], ['videographers', 'Videographers'], ['cinematographers', 'Cinematographers'], ['dronePilots', 'Drone pilots'], ['sameDayEditors', 'Same-day editors'], ['editors', 'Editors'], ['others', 'Others']];

// Raw footage received from the shoot (staff only): status, where it's stored, where it came from.
export function InwardCard({ project: p, canEdit }) {
  const [update, u] = useUpdateProjectMutation();
  const d = p.inwardData || {};
  const [store, setStore] = useState(d.storageLocation || '');
  const [source, setSource] = useState(d.source || '');
  const save = (patch, done) => runAction(update({ id: p._id, inwardData: { photo: !!d.photo, video: !!d.video, source: d.source || '', storageLocation: d.storageLocation || '', status: d.status || 'pending', receivedDate: d.receivedDate || null, notes: d.notes || '', ...patch } }), done, "Couldn't save");
  const blur = (k, v) => v.trim() !== (d[k] || '') && save({ [k]: v.trim() }, 'Saved');
  return (
    <Card className="gap-3 p-4">
      <Title>Inward data</Title>
      <Chips items={INWARD} value={d.status || 'pending'} disabled={!canEdit || u.isLoading} onChange={(v) => save({ status: v, receivedDate: v === 'pending' ? null : d.receivedDate || new Date().toISOString() }, `Inward: ${INWARD.find(([x]) => x === v)[1]}`)} />
      <View className="flex-row gap-2">
        <Chip label="Photos" active={!!d.photo} onPress={() => canEdit && save({ photo: !d.photo })} />
        <Chip label="Videos" active={!!d.video} onPress={() => canEdit && save({ video: !d.video })} />
      </View>
      {canEdit ? (
        <>
          <Input label="Stored on" value={store} onChangeText={setStore} onBlur={() => blur('storageLocation', store)} placeholder="HDD 02, NAS /2026/Sharma" />
          <Input label="Received from" value={source} onChangeText={setSource} onBlur={() => blur('source', source)} placeholder="Lead photographer, client's phone" />
        </>
      ) : (
        <Text className="text-sm text-muted">{[d.storageLocation && `Stored on ${d.storageLocation}`, d.source && `from ${d.source}`].filter(Boolean).join(' · ') || 'Nothing recorded yet.'}</Text>
      )}
      {!!d.receivedDate && <Text className="text-xs text-muted">Received {shortDate(d.receivedDate)}</Text>}
    </Card>
  );
}

// Crew for the shoot: how many of each role (editors change with − / +), and the named crew from the web.
export function CrewCard({ project: p, canEdit }) {
  const theme = useTheme();
  const [update, u] = useUpdateProjectMutation();
  const t = p.teamDeployment || {};
  const counts = t.counts || {};
  const total = CREW.reduce((n, [k]) => n + (counts[k] || 0), 0);
  const bump = (k, by) => {
    const v = Math.max(0, (counts[k] || 0) + by);
    runAction(update({ id: p._id, teamDeployment: { counts: { ...counts, [k]: v }, crewMembers: t.crewMembers || [], customDetails: t.customDetails || [] } }), null, "Couldn't save");
  };
  const crew = t.crewMembers || [];
  if (!canEdit && !total && !crew.length) return null;
  return (
    <Card className="gap-3 p-4">
      <Title right={<Text className="text-sm text-muted tabular-nums">{total} people</Text>}>Crew</Title>
      {CREW.filter(([k]) => canEdit || counts[k]).map(([k, label]) => (
        <View key={k} className="flex-row items-center gap-3">
          <Text className="flex-1">{label}</Text>
          {canEdit && <Pressable onPress={() => bump(k, -1)} disabled={!counts[k] || u.isLoading} accessibilityLabel={`One fewer ${label}`} className="h-11 w-11 items-center justify-center rounded-full bg-surface-2"><Minus size={16} color={counts[k] ? theme.ink : theme.line} /></Pressable>}
          <Text className="w-6 text-center font-body-semibold tabular-nums">{counts[k] || 0}</Text>
          {canEdit && <Pressable onPress={() => bump(k, 1)} disabled={u.isLoading} accessibilityLabel={`One more ${label}`} className="h-11 w-11 items-center justify-center rounded-full bg-surface-2"><Plus size={16} color={theme.ink} /></Pressable>}
        </View>
      ))}
      {crew.map((m) => (
        <View key={m._id} className="flex-row items-center gap-3 border-t border-line pt-2">
          <Avatar name={m.name || '?'} size={28} />
          <Text className="flex-1 font-body-medium">{m.name}{m.role ? <Text className="text-sm text-muted"> · {m.role}</Text> : ''}</Text>
          {m.isFreelancer && <Badge label="Freelancer" color="bg-sand text-brown" />}
        </View>
      ))}
    </Card>
  );
}

// Plain words for the activity log; anything unknown reads as its action name.
const SAID = {
  project_created: 'created the project', stage_changed: 'moved the stage', quality_check: 'updated the quality check',
  closing_note_saved: 'saved the closing note', message_posted: 'posted in the chat', task_added: 'added a task',
  deadline_changed: 'moved the deadline', updated: 'updated the project', milestone_updated: 'updated the milestones',
};
// Who did what on the project, newest first (stage moves show from → to and the reason).
export function ProjectActivity({ project: p }) {
  const stages = [...(p.stageHistory || [])].reverse();
  // Stage moves are shown above with from → to and the reason, so they're not repeated in the log.
  const list = (useGetProjectActivitiesQuery(p._id).data?.data || []).filter((a) => !(stages.length && a.action === 'stage_changed'));
  const page = usePaged(list, 10);
  if (!list.length && !stages.length) return null;
  return (
    <Card className="gap-3 p-4">
      <Title>Activity</Title>
      {stages.slice(0, 3).map((h) => (
        <View key={h._id} className="gap-0.5 border-l-2 border-accent pl-3">
          <Text className="text-sm"><Text className="font-body-semibold text-sm">{h.changedBy?.name || 'Someone'}</Text> moved it from {stageOf(h.fromStage)?.label || '—'} to {stageOf(h.toStage)?.label}</Text>
          {!!h.reason && <Text className="text-sm text-muted">Reason: {h.reason}</Text>}
          <Text className="text-xs text-muted">{getTimeAgo(h.changedAt)}</Text>
        </View>
      ))}
      {page.shown.map((a, i) => (
        <View key={a._id || i} className="gap-0.5 border-l-2 border-line pl-3">
          <Text className="text-sm"><Text className="font-body-semibold text-sm">{a.performedBy?.name || 'Someone'}</Text> {SAID[a.action] || String(a.action || 'changed something').replace(/_/g, ' ')}</Text>
          {!!a.reason && <Text className="text-sm text-muted">Reason: {a.reason}</Text>}
          <Text className="text-xs text-muted">{getTimeAgo(a.createdAt)}</Text>
        </View>
      ))}
      {!!page.left && <Button title={`Show ${page.next} more`} variant="ghost" size="sm" onPress={page.more} />}
    </Card>
  );
}
