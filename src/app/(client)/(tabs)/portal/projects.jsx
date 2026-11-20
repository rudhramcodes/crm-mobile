import { View } from 'react-native';
import { router } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { CalendarClock, ChevronRight, FolderOpen } from 'lucide-react-native';
import { Button, DashboardState, EmptyState, Heading, Pressable, Screen, Skeleton, StageMeter, Text, usePullRefresh } from '@/components';
import { useTheme } from '@/constants/theme';
import { useGetProjectPagesInfiniteQuery } from '@/services/projectApi';
import { shortDate, stageOf } from '@/utils/projects';

// One project card for the client: name, where it stands, the target date. Tap to open.
function PortalProjectRow({ project: p }) {
  const theme = useTheme();
  const stage = stageOf(p.stage)?.label || 'In progress';
  return (
    <Pressable
      onPress={() => router.push(`/portal/projects/${p._id}`)}
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
  );
}

// A client's projects (the server only returns their own), 20 per page, newest first.
export default function PortalProjects() {
  const q = useGetProjectPagesInfiniteQuery({});
  const refreshControl = usePullRefresh(q.refetch);
  const pages = q.data?.pages || [];
  const projects = pages.flatMap((p) => p.data || []);
  const total = pages[0]?.pagination?.total ?? projects.length;

  return (
    <Screen className="px-0">
      <FlashList
        contentInsetAdjustmentBehavior="automatic"
        data={projects}
        keyExtractor={(p) => p._id}
        renderItem={({ item }) => <View className="pb-3"><PortalProjectRow project={item} /></View>}
        ListHeaderComponent={<View className="pb-5 pt-6"><Heading>Projects</Heading></View>}
        ListEmptyComponent={q.isLoading || q.isError ? <DashboardState isLoading={q.isLoading} isError={q.isError} refetch={q.refetch} /> : (
          <EmptyState icon={FolderOpen} title="No projects yet" message="When the team sets up your project, it shows up here." />
        )}
        ListFooterComponent={
          q.isFetchingNextPage ? <Skeleton className="h-28 rounded-3xl" />
          : q.isError && projects.length ? <Button title="Couldn't load more. Try again" variant="ghost" size="sm" onPress={() => q.fetchNextPage()} />
          : q.hasNextPage ? <Text className="py-2 text-center text-xs text-muted">Showing {projects.length} of {total}</Text> : null
        }
        onEndReached={() => q.hasNextPage && !q.isFetching && q.fetchNextPage()}
        onEndReachedThreshold={0.5}
        refreshControl={refreshControl}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
      />
    </Screen>
  );
}
