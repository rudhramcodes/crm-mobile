import { useRef } from 'react';
import { View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { CalendarClock, ChevronRight, FolderOpen } from 'lucide-react-native';
import { Button, DashboardState, EmptyState, Heading, Pager, Pressable, Screen, StageMeter, Text, usePullRefresh, ZoomLink } from '@/components';
import { useTheme } from '@/constants/theme';
import { usePage, usePageNav } from '@/hooks/usePaged';
import { useGetProjectsQuery } from '@/services/projectApi';
import { shortDate, stageOf } from '@/utils/projects';

// One project card for the client: name, where it stands, the target date. Tap to open.
function PortalProjectRow({ project: p }) {
  const theme = useTheme();
  const stage = stageOf(p.stage)?.label || 'In progress';
  return (
    <ZoomLink href={`/portal/projects/${p._id}`}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`${p.title}, ${stage}${p.deadline ? `, target ${shortDate(p.deadline)}` : ''}. Open project`}
        className="gap-3 rounded-3xl border border-line bg-surface p-4"
      >
        <View className="flex-row items-center gap-2">
          <Text numberOfLines={2} className="flex-1 font-body-semibold">{p.title}</Text>
          <ChevronRight size={18} color={theme.muted} />
        </View>
        <View className="gap-1.5">
          <StageMeter stage={p.stage} />
          <View className="flex-row items-center gap-2">
            <Text className="flex-1 text-sm text-muted">{stage}</Text>
            {!!p.deadline && (
              <View className="flex-row items-center gap-1">
                <CalendarClock size={14} color={theme.muted} />
                <Text className="text-sm text-muted">{shortDate(p.deadline)}</Text>
              </View>
            )}
          </View>
        </View>
      </Pressable>
    </ZoomLink>
  );
}

const LIMIT = 10;

// A client's projects (the server only returns their own), 10 per page, newest first, Previous / Next below.
export default function PortalProjects() {
  const listRef = useRef(null);
  const [page, setPage] = usePage('');
  const q = useGetProjectsQuery({ page, limit: LIMIT });
  const refreshControl = usePullRefresh(q.refetch);
  const projects = q.data?.data || [];
  const meta = q.data?.pagination;
  const goTo = usePageNav(listRef, page, setPage, meta?.pages);

  return (
    <Screen className="px-0">
      <FlashList
        ref={listRef}
        contentInsetAdjustmentBehavior="automatic"
        data={projects}
        keyExtractor={(p) => p._id}
        renderItem={({ item }) => <View className="pb-3"><PortalProjectRow project={item} /></View>}
        ListHeaderComponent={<View className="pb-5 pt-6"><Heading>Projects</Heading></View>}
        ListEmptyComponent={q.isLoading || q.isError ? <DashboardState isLoading={q.isLoading} isError={q.isError} refetch={q.refetch} /> : (
          <EmptyState icon={FolderOpen} title="No projects yet" message="When the team sets up your project, it shows up here." />
        )}
        ListFooterComponent={
          q.isError && projects.length ? <Button title="Couldn't load this page. Try again" variant="ghost" size="sm" onPress={q.refetch} />
          : <Pager page={page} pages={meta?.pages} total={meta?.total} limit={LIMIT} loading={q.isFetching} onChange={goTo} />
        }
        refreshControl={refreshControl}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
      />
    </Screen>
  );
}
