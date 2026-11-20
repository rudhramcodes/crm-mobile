import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useSelector } from 'react-redux';
import { FolderKanban, Plus, Search } from 'lucide-react-native';
import { Button, Chip, DashboardState, EmptyState, Input, PageHeader, ProjectRow, Screen, VentureChips, usePullRefresh } from '@/components';
import { PROJECT_STAGES } from '@/constants';
import { useTheme } from '@/constants/theme';
import { useGetProjectsQuery } from '@/services/projectApi';
import { cleanParams } from '@/utils/leads';
import { canCreateProject } from '@/utils/projects';

// All projects, newest first: search, "I'm on it", stage and venture.
// shortcut: first 100 projects (server max); add paging when there are routinely more.
export default function Projects() {
  const theme = useTheme();
  const me = useSelector((s) => s.auth.user);
  const [typed, setTyped] = useState('');
  const [search, setSearch] = useState('');
  const [stage, setStage] = useState('');
  const [brand, setBrand] = useState('');
  const [mine, setMine] = useState(me.role === 'employee');

  useEffect(() => {
    const t = setTimeout(() => setSearch(typed.trim()), 350);
    return () => clearTimeout(t);
  }, [typed]);

  const q = useGetProjectsQuery(cleanParams({ page: 1, limit: 100, search, stage, brand, employeeFilter: mine ? me._id : '' }));
  const refreshControl = usePullRefresh(q.refetch);
  const projects = q.data?.data || [];
  const total = q.data?.pagination?.total ?? projects.length;
  const filtered = !!(search || stage || brand || mine);
  const reset = () => { setTyped(''); setSearch(''); setStage(''); setBrand(''); setMine(false); };

  return (
    <Screen scroll className="gap-4 pt-2" refreshControl={refreshControl}>
      <PageHeader
        caption={`${total} ${total === 1 ? 'PROJECT' : 'PROJECTS'}`}
        title="Projects"
        fallback="/more"
        right={canCreateProject(me) ? <Button title="New" icon={Plus} size="sm" onPress={() => router.push('/projects/new')} /> : null}
      />
      <Input
        value={typed}
        onChangeText={setTyped}
        onSubmitEditing={() => setSearch(typed.trim())}
        placeholder="Search title, description, code"
        accessibilityLabel="Search projects"
        returnKeyType="search"
        autoCorrect={false}
        right={<View className="h-11 w-11 items-center justify-center"><Search size={18} color={theme.muted} /></View>}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-5" contentContainerClassName="gap-2 px-5">
        <Chip label="I'm on it" active={mine} onPress={() => setMine((m) => !m)} />
        <Chip label="Any stage" active={!stage} onPress={() => setStage('')} />
        {PROJECT_STAGES.map((s) => <Chip key={s.value} label={s.label} active={stage === s.value} onPress={() => setStage(s.value)} />)}
      </ScrollView>
      <VentureChips value={brand} onChange={setBrand} />

      {q.isLoading || q.isError ? <DashboardState isLoading={q.isLoading} isError={q.isError} refetch={q.refetch} /> : projects.length ? (
        <View className="gap-2">{projects.map((p) => <ProjectRow key={p._id} project={p} />)}</View>
      ) : (
        <EmptyState
          icon={FolderKanban}
          title={filtered ? 'No projects match' : 'No projects yet'}
          message={filtered ? 'Try another search or clear the filters.' : canCreateProject(me) ? 'Create the first one.' : 'Projects you join show up here.'}
          actionTitle={filtered ? 'Clear filters' : canCreateProject(me) ? 'New project' : undefined}
          onAction={filtered ? reset : () => router.push('/projects/new')}
        />
      )}
    </Screen>
  );
}
