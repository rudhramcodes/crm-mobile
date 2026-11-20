import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useSelector } from 'react-redux';
import { FlashList } from '@shopify/flash-list';
import { FolderKanban, Plus, Search, X } from 'lucide-react-native';
import { Button, Chip, DashboardState, EmptyState, Input, PageHeader, Pressable, ProjectRow, Screen, Skeleton, Text, VentureChips, usePullRefresh } from '@/components';
import { PROJECT_STAGES } from '@/constants';
import { useTheme } from '@/constants/theme';
import { useGetProjectPagesInfiniteQuery, useGetProjectStatsQuery } from '@/services/projectApi';
import { cleanParams } from '@/utils/leads';
import { canCreateProject } from '@/utils/projects';

// All projects, newest first, 20 per page from the server; the next page loads as you near the end.
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

  const q = useGetProjectPagesInfiniteQuery(cleanParams({ search, stage, brand, employeeFilter: mine ? me._id : '' }));
  const statsQ = useGetProjectStatsQuery();
  const stats = statsQ.data?.data;
  const refreshControl = usePullRefresh(() => {
    statsQ.refetch();
    return q.refetch();
  });
  const pages = q.data?.pages || [];
  const projects = pages.flatMap((p) => p.data || []);
  const total = pages[0]?.pagination?.total ?? projects.length;
  const loadMore = () => q.hasNextPage && !q.isFetching && q.fetchNextPage();
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
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        data={projects}
        keyExtractor={(p) => p._id}
        renderItem={({ item }) => <View className="pb-2"><ProjectRow project={item} /></View>}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={
          q.isFetchingNextPage ? <Skeleton className="h-32 rounded-3xl" />
          : q.isError && projects.length ? <Button title="Couldn't load more. Try again" variant="ghost" size="sm" onPress={() => q.fetchNextPage()} />
          : projects.length ? (
            <Text className="py-2 text-center text-xs text-muted">{q.hasNextPage ? `Showing ${projects.length} of ${total}` : `All ${total} shown`}</Text>
          ) : null
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        refreshControl={refreshControl}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
      />
    </Screen>
  );
}
