import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSelector } from 'react-redux';
import { X } from 'lucide-react-native';
import { Alert, Avatar, Button, Chip, DateField, Input, Pressable, Screen, SheetHeader, Text, UserPicker, brandLabel } from '@/components';
import { TASK_PRIORITY } from '@/constants';
import { useTheme } from '@/constants/theme';
import { useGetClientsQuery } from '@/services/clientApi';
import { useCreateProjectMutation } from '@/services/projectApi';
import { apiError } from '@/utils/apiError';
import { runAction } from '@/utils/attendance';
import { getFieldError } from '@/utils/getFieldError';

const Field = ({ label, children }) => (
  <View className="gap-1.5">
    <Text className="font-body-medium text-sm">{label}</Text>
    {children}
  </View>
);

// Type to find a client; the venture comes from the client. `?client=<id>&clientName=` prefills it.
function ClientField({ value, onChange, error }) {
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

// New project, the fields the web asks for up front. Every project starts at the Brief stage.
// Milestones are optional; tasks are added on the project page afterwards.
export default function NewProject() {
  const p = useLocalSearchParams();
  const me = useSelector((s) => s.auth.user);
  const [create, { isLoading, error }] = useCreateProjectMutation();
  const [title, setTitle] = useState('');
  const [client, setClient] = useState(p.client ? { _id: p.client, companyName: p.clientName || 'Client', brand: p.brand } : null);
  const [owner, setOwner] = useState({ _id: me._id, name: me.name, avatar: me.avatar });
  const [team, setTeam] = useState([]);
  const [picking, setPicking] = useState(null); // 'owner' | 'team'
  const [priority, setPriority] = useState('medium');
  const [startDate, setStart] = useState('');
  const [deadline, setDeadline] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [milestone, setMilestone] = useState('');
  const [milestones, setMilestones] = useState([]);
  const { message, fieldErrors } = apiError(error);
  const err = (k) => getFieldError(fieldErrors, k);

  const pick = (u) => {
    if (picking === 'owner') setOwner(u);
    else if (!team.some((x) => x._id === u._id)) setTeam([...team, u]);
    setPicking(null);
  };
  const addMilestone = () => {
    const v = milestone.trim();
    if (v.length >= 2 && !milestones.includes(v)) setMilestones([...milestones, v]);
    setMilestone('');
  };
  const save = async () => {
    const res = await runAction(create({
      title: title.trim(),
      client: client?._id,
      ownerId: owner._id,
      priority,
      startDate: startDate || undefined,
      deadline: deadline || undefined,
      location: location.trim() || undefined,
      description: description.trim() || undefined,
      teamMembers: team.map((u) => ({ user: u._id })),
      milestones: milestones.map((t) => ({ title: t })),
    }), 'Project created', "Couldn't create the project");
    const id = res?.data?.project?._id;
    if (id) router.replace(`/projects/${id}`);
  };

  return (
    <Screen scroll edges={['bottom']} className="gap-4 pt-6">
      <SheetHeader title="New project" closeLabel="Cancel" />
      <Alert message={fieldErrors.length ? '' : message} />
      <Input label="Project name" value={title} onChangeText={setTitle} placeholder="Sharma wedding film" maxLength={200} autoFocus error={err('title')} />
      <Field label="Client"><ClientField value={client} onChange={setClient} error={err('client')} /></Field>

      <Field label="Owner">
        {picking === 'owner' ? <UserPicker label="Project owner" onPick={pick} onCancel={() => setPicking(null)} /> : (
          <Pressable onPress={() => setPicking('owner')} accessibilityLabel={`Owner: ${owner.name}. Change`} className="flex-row items-center gap-3 rounded-2xl bg-surface-2 px-4 py-3">
            <Avatar name={owner.name} uri={owner.avatar} size={32} />
            <Text className="flex-1 font-body-medium">{owner._id === me._id ? `${owner.name} (me)` : owner.name}</Text>
            <Text className="font-body-semibold text-accent-ink">Change</Text>
          </Pressable>
        )}
      </Field>

      <Field label="Team">
        <View className="flex-row flex-wrap gap-2">
          {team.map((u) => <Chip key={u._id} label={`${u.name}  ✕`} active onPress={() => setTeam(team.filter((x) => x._id !== u._id))} />)}
          {picking !== 'team' && <Chip label="+ Add someone" onPress={() => setPicking('team')} />}
        </View>
        {picking === 'team' && <UserPicker label="Add to the team" onPick={pick} onCancel={() => setPicking(null)} />}
      </Field>

      <Field label="Priority">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-5" contentContainerClassName="gap-2 px-5">
          {TASK_PRIORITY.map((x) => <Chip key={x.value} label={x.label} active={priority === x.value} onPress={() => setPriority(x.value)} />)}
        </ScrollView>
      </Field>
      <DateField label="Start date" value={startDate} onChange={(d) => { setStart(d); if (deadline && d > deadline) setDeadline(d); }} onClear={() => setStart('')} placeholder="Not set" />
      <DateField label="Deadline" value={deadline} onChange={setDeadline} onClear={() => setDeadline('')} minDate={startDate || undefined} placeholder="Not set" error={err('deadline')} />
      <Input label="Location" value={location} onChangeText={setLocation} placeholder="Udaipur" maxLength={200} />
      <Input label="Brief" value={description} onChangeText={setDescription} multiline maxLength={2000} placeholder="What the client wants, key dates, links" style={{ height: 96, paddingTop: 14, textAlignVertical: 'top' }} error={err('description')} />

      <Field label="Milestones">
        {milestones.map((m, i) => (
          <View key={m} className="flex-row items-center gap-2">
            <Text className="w-6 text-sm text-muted tabular-nums">{i + 1}.</Text>
            <Text className="flex-1 font-body-medium">{m}</Text>
            <Chip label="Remove" onPress={() => setMilestones(milestones.filter((x) => x !== m))} />
          </View>
        ))}
        <Input value={milestone} onChangeText={setMilestone} onSubmitEditing={addMilestone} submitBehavior="submit" returnKeyType="done" placeholder="Add a milestone, e.g. Pre-wedding shoot" accessibilityLabel="Add a milestone" maxLength={200} />
      </Field>

      <Button title="Create project" loading={isLoading} disabled={title.trim().length < 2 || !client || !owner} onPress={save} />
    </Screen>
  );
}
