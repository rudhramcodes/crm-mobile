import { useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useSelector } from 'react-redux';
import { FlashList } from '@shopify/flash-list';
import { FolderKanban, Plus, Search, X } from 'lucide-react-native';
import { Button, Chip, DashboardState, EmptyState, Input, PageHeader, Pager, Pressable, ProjectRow, Screen, Text, VentureChips, usePullRefresh } from '@/components';
import { PROJECT_STAGES } from '@/constants';
import { useTheme } from '@/constants/theme';
import { usePage, usePageNav } from '@/hooks/usePaged';
import { useGetProjectStatsQuery, useGetProjectsQuery } from '@/services/projectApi';
import { cleanParams } from '@/utils/leads';
import { canCreateProject } from '@/utils/projects';

// All projects, newest first, 20 per page from the server with Previous / Next under the list.
// Filters: search, "Mine" (projects I'm on), stage and venture.
export default function Projects() {
  const theme = useTheme();
  const me = useSelector((s) => s.auth.user);
  const [typed, setTyped] = useState('');
  const [search, setSearch] = useState('');
  const [stage, setStage] = useState('');
  const [brand, setBrand] = useState('');
  const [mine, setMine] = useState(me.role === 'employee');

  // Search as you type, once typing pauses.
  useEffect(() => {
    const t = setTimeout(() => setSearch(typed.trim()), 350);
    return () => clearTimeout(t);
  }, [typed]);

  const LIMIT = 20;
  const listRef = useRef(null);
  const filters = cleanParams({ search, stage, brand, employeeFilter: mine ? me._id : '' });
  const [page, setPage] = usePage(JSON.stringify(filters));
  const q = useGetProjectsQuery({ ...filters, page, limit: LIMIT });
  const statsQ = useGetProjectStatsQuery();
  const stats = statsQ.data?.data;
  const refreshControl = usePullRefresh(() => {
    statsQ.refetch();
    return q.refetch();
  });
  const projects = q.data?.data || [];
  const meta = q.data?.pagination;
  const total = meta?.total ?? projects.length;
  const goTo = usePageNav(listRef, page, setPage, meta?.pages);
  const filtered = !!(search || stage || brand || mine);
  // Stage counts are company-wide, so show them only while nothing else narrows the list.
  const counts = stats && !search && !brand && !mine ? stats : null;
  const reset = () => { setTyped(''); setSearch(''); setStage(''); setBrand(''); setMine(false); };

  const header = (
    <View className="gap-4 pb-4 pt-2">
      <PageHeader
        caption={q.isLoading ? 'PROJECTS' : `${total} ${total === 1 ? 'PROJECT' : 'PROJECTS'}`}
        title="Projects"
        fallback="/more"
        right={canCreateProject(me) ? <Button title="New" icon={Plus} size="sm" onPress={() => router.push('/projects/new')} /> : null}
      />
      <Input
        value={typed}
        onChangeText={setTyped}
        onSubmitEditing={() => setSearch(typed.trim())}
        placeholder="Search name or code"
        accessibilityLabel="Search projects"
        returnKeyType="search"
        autoCorrect={false}
        maxLength={100}
        right={typed ? (
          <Pressable onPress={() => { setTyped(''); setSearch(''); }} accessibilityLabel="Clear search" className="h-11 w-11 items-center justify-center">
            <X size={18} color={theme.muted} />
          </Pressable>
        ) : (
          <View className="h-11 w-11 items-center justify-center"><Search size={18} color={theme.muted} /></View>
        )}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-5" contentContainerClassName="gap-2 px-5">
        <Chip label="Mine" active={mine} onPress={() => setMine((m) => !m)} />
        <View className="w-px self-stretch bg-line" />
        <Chip label="All stages" active={!stage} count={counts?.total} onPress={() => setStage('')} />
        {PROJECT_STAGES.map((s) => (
          <Chip key={s.value} label={s.label} active={stage === s.value} count={counts?.[s.value]} onPress={() => setStage(stage === s.value ? '' : s.value)} />
        ))}
      </ScrollView>
      <VentureChips value={brand} onChange={(b) => setBrand(brand === b ? '' : b)} />
      {filtered && !!projects.length && (
        <Pressable onPress={reset} accessibilityLabel="Clear all filters" className="-my-2 h-9 flex-row items-center gap-1 self-start">
          <X size={14} color={theme['accent-ink']} />
          <Text className="text-sm font-body-semibold text-accent-ink">Clear filters</Text>
        </Pressable>
      )}
    </View>
  );

  const empty = q.isLoading || q.isError ? (
    <DashboardState isLoading={q.isLoading} isError={q.isError} refetch={q.refetch} />
  ) : (
    <EmptyState
      icon={FolderKanban}
      title={filtered ? 'No projects match' : 'No projects yet'}
      message={filtered ? 'Try another search or clear the filters.' : canCreateProject(me) ? 'Create the first one.' : 'Projects you join show up here.'}
      actionTitle={filtered ? 'Clear filters' : canCreateProject(me) ? 'New project' : undefined}
      onAction={filtered ? reset : () => router.push('/projects/new')}
    />
  );

  return (
    <Screen className="px-0">
      <FlashList
        ref={listRef}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        data={projects}
        keyExtractor={(p) => p._id}
        renderItem={({ item }) => <View className={q.isFetching ? 'pb-2 opacity-50' : 'pb-2'}><ProjectRow project={item} /></View>}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={
          q.isError && projects.length ? <Button title="Couldn't load this page. Try again" variant="ghost" size="sm" onPress={q.refetch} />
          : <Pager page={page} pages={meta?.pages} total={total} limit={LIMIT} loading={q.isFetching} onChange={goTo} />
        }
        refreshControl={refreshControl}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
      />
    </Screen>
  );
}
