import { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { MapPin } from 'lucide-react-native';
import {
  Avatar, Button, Card, CrewCard, DashboardState, DeliverablesCard, InwardCard, MilestonesCard, PageHeader, PriorityBadge, ProjectActivity, ProjectChat,
  ProjectFiles, QuickAddTask, Screen, ShowMore, SignOffCard, StageBar, Tabs, TaskRow, TeamCard, Text, backTo, brandLabel, usePullRefresh,
} from '@/components';
import { useTheme } from '@/constants/theme';
import { useEntityRoom } from '@/hooks/useEntityRoom';
import { api } from '@/services/api';
import { useGetProjectByIdQuery, useGetProjectMessagesQuery } from '@/services/projectApi';
import { useGetTaskPagesInfiniteQuery } from '@/services/taskApi';
import { canEditProject, isProjectLate, shortDate } from '@/utils/projects';
import { idOf, isOverdue } from '@/utils/tasks';
import { cn } from '@/utils/cn';

const TABS = ['overview', 'tasks', 'chat', 'more'];

const Title = ({ children, right }) => (
  <View className="flex-row items-center gap-2">
    <Text className="flex-1 font-display text-title">{children}</Text>
    {right}
  </View>
);
const Row = ({ label, children }) => (
  <View className="flex-row items-start gap-3">
    <Text className="w-24 text-sm text-muted">{label}</Text>
    <View className="flex-1">{typeof children === 'string' ? <Text className="font-body-medium">{children}</Text> : children}</View>
  </View>
);

const pagesOf = (q) => (q.data?.pages || []).flatMap((p) => p.data || []);
const totalOf = (q) => q.data?.pages?.[0]?.pagination?.total ?? pagesOf(q).length;

// Where it stands and the facts: stage, task progress, owner, dates, brief.
function Overview({ project: p, me, edit, openTotal, doneTotal, late, onTasks }) {
  const theme = useTheme();
  const all = openTotal + doneTotal;
  const pct = all ? Math.round((doneTotal / all) * 100) : 0;
  return (
    <>
      <Card className="gap-4 p-4">
        <StageBar project={p} canEdit={edit} />
      </Card>
      <Card className="gap-3 p-4">
        <View className="gap-1.5">
          <View className="flex-row items-end justify-between">
            <Text className="text-caption text-muted">TASKS</Text>
            <Text onPress={onTasks} className="font-body-semibold tabular-nums">
              {doneTotal} of {all} done{late ? <Text className="font-body-semibold text-danger"> · {late} overdue</Text> : ''}
            </Text>
          </View>
          <View className="h-1.5 overflow-hidden rounded-full bg-sand" accessible accessibilityLabel={`${pct}% of tasks done`}>
            <View className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
          </View>
        </View>
        <Row label="Owner">
          <View className="flex-row items-center gap-2">
            <Avatar name={p.ownerId?.name || '?'} uri={p.ownerId?.avatar} size={24} />
            <Text className="font-body-medium">{idOf(p.ownerId) === me._id ? 'You' : p.ownerId?.name || 'Not set'}</Text>
          </View>
        </Row>
        {!!p.deadline && <Row label="Deadline"><Text className={cn('font-body-medium', isProjectLate(p) && 'text-danger')}>{shortDate(p.deadline)}{isProjectLate(p) ? ', late' : ''}</Text></Row>}
        {!!p.startDate && <Row label="Starts">{shortDate(p.startDate)}</Row>}
        <Row label="Priority"><View className="flex-row"><PriorityBadge priority={p.priority} /></View></Row>
        {!!p.location && (
          <Row label="Where">
            <View className="flex-row items-center gap-1.5"><MapPin size={14} color={theme.muted} /><Text className="font-body-medium">{p.location}</Text></View>
          </Row>
        )}
        {!!p.duration && <Row label="Duration">{p.duration}</Row>}
        {!!p.projectCode && <Row label="Code"><Text selectable className="font-body-medium tabular-nums">{p.projectCode}</Text></Row>}
        {!!p.description && <Text selectable className="border-t border-line pt-3">{p.description}</Text>}
      </Card>
      <DeliverablesCard project={p} canEdit={edit} />
      <MilestonesCard project={p} canEdit={edit} />
      <SignOffCard key={p.closingNote?.writtenAt || 'note'} project={p} canEdit={edit} />
    </>
  );
}

// Open tasks grouped by milestone (server pages of 30), then done tasks on request (also paged by the server).
function ProjectTasks({ project: p, openQ, doneQ }) {
  const [showDone, setShowDone] = useState(false);
  const open = pagesOf(openQ);
  const done = pagesOf(doneQ);
  const openTotal = totalOf(openQ);
  const doneTotal = totalOf(doneQ);
  const milestones = p.milestones || [];
  const groups = [
    ...milestones.map((m) => ({ key: m._id, m, tasks: open.filter((t) => idOf(t.milestone) === m._id) })),
    { key: 'none', tasks: open.filter((t) => !milestones.some((m) => m._id === idOf(t.milestone))) },
  ].filter((g) => g.tasks.length);

  return (
    <View className="gap-3">
      <Title right={<Text className="text-sm text-muted tabular-nums">{openTotal} open</Text>}>Tasks</Title>
      <QuickAddTask extra={{ project: p._id }} placeholder="Add a task · @name fri !high" />
      {openQ.isLoading ? <DashboardState isLoading /> : openQ.isError && !open.length ? <DashboardState isError refetch={openQ.refetch} /> : (
        <>
          {groups.map((g) => (
            <View key={g.key} className="gap-2">
              {(g.m || milestones.length > 0) && (
                <Text className="pt-1 text-caption text-muted">
                  {g.m ? `${g.m.title.toUpperCase()}${g.m.dueDate ? ` · ${shortDate(g.m.dueDate)}` : ''}` : 'NO MILESTONE'}
                </Text>
              )}
              {g.tasks.map((t) => <TaskRow key={t._id} task={t} />)}
            </View>
          ))}
          <ShowMore count={openQ.hasNextPage ? Math.min(30, openTotal - open.length) : 0} label="more open" loading={openQ.isFetchingNextPage} onPress={() => openQ.fetchNextPage()} />
          {!openTotal && <Text className="text-sm text-muted">{doneTotal ? 'All tasks are done.' : 'No tasks yet. Add the first one above.'}</Text>}
        </>
      )}

      {!!doneTotal && (
        <View className="gap-2 pt-2">
          <Button title={showDone ? 'Hide done tasks' : `Show ${doneTotal} done`} variant="ghost" size="sm" onPress={() => setShowDone((x) => !x)} />
          {showDone && done.map((t) => <TaskRow key={t._id} task={t} swipe={false} />)}
          {showDone && <ShowMore count={doneQ.hasNextPage ? Math.min(30, doneTotal - done.length) : 0} label="more done" loading={doneQ.isFetchingNextPage} onPress={() => doneQ.fetchNextPage()} />}
        </View>
      )}
    </View>
  );
}

// One project, split into four tabs so each screen has one job:
// Overview (stage, facts, deliverables, milestones, sign-off) · Tasks · Chat (+ photos) · More (team, crew, inward data, activity).
// Tasks are the normal tasks (same rows, swipes and rules as the Tasks tab), linked to this project.
function ProjectBody({ project: p, initialTab }) {
  const me = useSelector((s) => s.auth.user);
  const [tab, setTab] = useState(TABS.includes(initialTab) ? initialTab : 'overview');
  const openQ = useGetTaskPagesInfiniteQuery({ project: p._id, open: 'true', sort: 'dueDate' });
  const doneQ = useGetTaskPagesInfiniteQuery({ project: p._id, status: 'done', sort: '-updatedAt' });
  const messages = useGetProjectMessagesQuery({ id: p._id }).data?.data || [];
  const open = pagesOf(openQ);
  const tasks = [...open, ...pagesOf(doneQ)];
  const openTotal = totalOf(openQ);
  const edit = canEditProject(p, me);

  return (
    <>
      <PageHeader caption={[p.client?.companyName, brandLabel(p.client?.brand)].filter(Boolean).join(' · ').toUpperCase() || 'PROJECT'} title={p.title} fallback="/projects" />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'overview', label: 'Overview' },
          { value: 'tasks', label: 'Tasks', count: openTotal },
          { value: 'chat', label: 'Chat', count: messages.length },
          { value: 'more', label: 'More' },
        ]}
      />

      {tab === 'overview' && (
        <Overview project={p} me={me} edit={edit} openTotal={openTotal} doneTotal={totalOf(doneQ)} late={open.filter(isOverdue).length} onTasks={() => setTab('tasks')} />
      )}
      {tab === 'tasks' && <ProjectTasks project={p} openQ={openQ} doneQ={doneQ} />}
      {tab === 'chat' && (
        <>
          <ProjectChat project={p} />
          <ProjectFiles projectId={p._id} tasks={tasks} />
        </>
      )}
      {tab === 'more' && (
        <>
          <TeamCard project={p} canEdit={edit} />
          <CrewCard project={p} canEdit={edit} />
          <InwardCard key={`${p.inwardData?.storageLocation}|${p.inwardData?.source}`} project={p} canEdit={edit} />
          <ProjectActivity project={p} />
        </>
      )}
    </>
  );
}

export default function ProjectDetail() {
  const { id, tab } = useLocalSearchParams();
  const { data, isLoading, isError, error, refetch } = useGetProjectByIdQuery(id);
  useEntityRoom('project', id, 'Project');
  const dispatch = useDispatch();
  // Pull to refresh reloads the project and its tasks, chat and activity together.
  const refreshControl = usePullRefresh(() => {
    dispatch(api.util.invalidateTags(['Task', { type: 'ProjectActivities', id }]));
    return refetch();
  });
  const project = data?.data?.project;
  return (
    <Screen scroll className="gap-5 pt-2" refreshControl={refreshControl}>
      {project ? <ProjectBody key={project._id} project={project} initialTab={tab} /> : (
        <>
          <PageHeader caption="PROJECT" title="" fallback="/projects" />
          <DashboardState isLoading={isLoading} isError={isError || !isLoading} refetch={refetch} gone={[403, 404].includes(error?.status) && 'This project is gone'} onBack={() => backTo('/projects')} />
        </>
      )}
    </Screen>
  );
}
