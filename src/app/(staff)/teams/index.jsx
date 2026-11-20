import { useState } from 'react';
import { View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { router } from 'expo-router';
import { ChevronRight, MapPin, Plus, UsersRound } from 'lucide-react-native';
import { Button, Card, ConfirmDelete, DashboardState, EmptyState, Input, PageHeader, PeoplePicker, Pressable, Screen, Text, usePullRefresh } from '@/components';
import { LOCATIONS } from '@/constants';
import { useTheme } from '@/constants/theme';
import { useDeleteTeamMutation, useGetTeamsQuery, useSaveTeamMutation } from '@/services/teamApi';
import { useGetUsersQuery, userApi } from '@/services/userApi';
import { isAdmin, runAction } from '@/utils/attendance';
import { teamName } from '@/utils/users';

const EDITORS = ['super_admin', 'admin', 'manager'];

// One office: how many active staff have their location set to it. "none" = staff with no location yet.
function LocationTeamCard({ location }) {
  const theme = useTheme();
  const { data, isLoading } = useGetUsersQuery({ location, isActive: true, limit: 1 }); // only the total is used
  const total = data?.data?.total ?? 0;
  if (location === 'none' && !total) return null;
  const name = teamName(location);
  return (
    <Pressable onPress={() => router.push(`/teams/${location}`)} accessibilityLabel={`${name}, ${total} people`}>
      <Card className="gap-3 p-4">
        <View className="flex-row items-center gap-3">
          <MapPin size={18} color={location === 'none' ? theme.danger : theme.accent} />
          <Text className="flex-1 font-body-semibold text-base">{name}</Text>
          <Text className="text-sm text-muted tabular-nums">{isLoading ? '…' : `${total} ${total === 1 ? 'person' : 'people'}`}</Text>
          <ChevronRight size={18} color={theme.muted} />
        </View>
        {location === 'none' && <Text className="text-sm text-muted">Staff without a location. Tap to set one.</Text>}
      </Card>
    </Pressable>
  );
}

// Location teams (Surat / Mumbai / Delhi, from each person's location) on top, then custom teams:
// saved groups of people. In the people picker one tap adds the whole team.
// Editing reuses the people picker: the star is the team lead.
export default function Teams() {
  const me = useSelector((s) => s.auth.user);
  const canEdit = EDITORS.includes(me?.role);
  const { data: teams = [], isLoading, isError, refetch } = useGetTeamsQuery();
  const dispatch = useDispatch();
  const refreshControl = usePullRefresh(() => {
    dispatch(userApi.util.invalidateTags(['User'])); // location team counts
    return refetch();
  });
  const [form, setForm] = useState(null); // { _id?, name, owner, helpers }
  const [saveTeam, { isLoading: saving }] = useSaveTeamMutation();
  const [deleteTeam, { isLoading: deleting }] = useDeleteTeamMutation();

  const open = (t) => setForm(t
    ? { _id: t._id, name: t.name, owner: t.lead || null, helpers: t.members.filter((m) => m._id !== t.lead?._id) }
    : { name: '', owner: null, helpers: [] });

  if (form) {
    const save = async () => {
      const members = [form.owner, ...form.helpers].filter(Boolean).map((u) => u._id);
      if (await runAction(saveTeam({ _id: form._id, name: form.name.trim(), lead: form.owner?._id || null, members }), form._id ? 'Team saved' : 'Team created')) setForm(null);
    };
    const count = form.helpers.length + (form.owner ? 1 : 0);
    return (
      <Screen scroll className="gap-5 pt-2">
        <PageHeader caption="TEAMS" title={form._id ? 'Edit team' : 'New team'} />
        <Input label="Name *" value={form.name} onChangeText={(name) => setForm((f) => ({ ...f, name }))} placeholder="Wedding edit team" maxLength={60} />
        <View className="gap-1.5">
          <Text className="font-body-medium text-sm">Members *</Text>
          <Text className="text-sm text-muted">Star the team lead.</Text>
          <PeoplePicker owner={form.owner} helpers={form.helpers} onChange={(p) => setForm((f) => ({ ...f, ...p }))} />
        </View>
        <View className="flex-row gap-2">
          <Button title="Cancel" variant="secondary" className="flex-1" onPress={() => setForm(null)} />
          <Button title="Save team" className="flex-1" loading={saving} disabled={form.name.trim().length < 2 || !count} onPress={save} />
        </View>
        {!!form._id && <ConfirmDelete label="Delete team" loading={deleting} onConfirm={async () => { if (await runAction(deleteTeam(form._id), 'Team deleted')) setForm(null); }} />}
      </Screen>
    );
  }

  return (
    <Screen scroll className="gap-5 pt-2" refreshControl={refreshControl}>
      <PageHeader caption="OPERATIONS" title="Teams" right={canEdit ? <Button title="New" icon={Plus} size="sm" onPress={() => open()} /> : undefined} />
      <View className="gap-3">
        {LOCATIONS.map((l) => <LocationTeamCard key={l} location={l} />)}
        {isAdmin(me) && <LocationTeamCard location="none" />}
      </View>
      <Text className="text-caption text-muted">CUSTOM TEAMS</Text>
      {isLoading || isError ? <DashboardState isLoading={isLoading} isError={isError} refetch={refetch} /> : teams.length ? (
        <View className="gap-3">
          {teams.map((t) => (
            <Pressable key={t._id} disabled={!canEdit} onPress={() => open(t)} accessibilityLabel={`${t.name}, ${t.members.length} people${canEdit ? '. Edit' : ''}`}>
              <Card className="gap-3 p-4">
                <View className="flex-row items-center justify-between gap-3">
                  <Text className="flex-1 font-body-semibold text-base">{t.name}</Text>
                  <Text className="text-sm text-muted tabular-nums">{t.members.length} {t.members.length === 1 ? 'person' : 'people'}</Text>
                </View>
                {!!t.lead && <Text className="text-sm text-muted">Lead: {t.lead.name}</Text>}
              </Card>
            </Pressable>
          ))}
        </View>
      ) : (
        <EmptyState icon={UsersRound} title="No teams yet" message={canEdit ? 'Make a team once, then add everyone to a task with one tap.' : 'Your manager can group people into teams.'} />
      )}
    </Screen>
  );
}
