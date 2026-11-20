import { useState } from 'react';
import { View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useLocalSearchParams } from 'expo-router';
import { useSelector } from 'react-redux';
import { ExternalLink, MapPin } from 'lucide-react-native';
import {
  Avatar, Badge, Button, Card, DashboardState, PageHeader, Pressable, PriorityBadge, QuickAddTask, Screen, StageBar, TaskRow, Text,
  backTo, brandLabel, showToast, usePullRefresh,
} from '@/components';
import { useTheme } from '@/constants/theme';
import { useEntityRoom } from '@/hooks/useEntityRoom';
import { useGetProjectByIdQuery } from '@/services/projectApi';
import { useGetTasksQuery } from '@/services/taskApi';
import { canEditProject, isProjectLate, shortDate } from '@/utils/projects';
import { idOf, isOverdue } from '@/utils/tasks';
import { cn } from '@/utils/cn';

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

const MILESTONE = { pending: ['Not started', 'bg-surface-2 text-muted'], in_progress: ['In progress', 'bg-accent/15 text-accent-ink'], completed: ['Done', 'bg-success/15 text-success'] };
const DELIVERABLE = { pending: ['Pending', 'bg-surface-2 text-muted'], in_progress: ['In progress', 'bg-accent/15 text-accent-ink'], ready: ['Ready', 'bg-sand text-brown'], delivered: ['Delivered', 'bg-success/15 text-success'] };
const badge = (map, v) => { const [label, color] = map[v] || [v || 'Unknown', 'bg-surface-2 text-muted']; return <Badge label={label} color={color} />; };

// One project on one scroll: where it stands (stage), the facts, its tasks by milestone, deliverables, team.
// Tasks are the normal tasks (same rows, swipes and rules as the Tasks tab), linked to this project.
function ProjectBody({ project: p }) {
  const theme = useTheme();
  const me = useSelector((s) => s.auth.user);
  const [showDone, setShowDone] = useState(false);
  // shortcut: first 100 tasks of the project.
  const tq = useGetTasksQuery({ project: p._id, page: 1, limit: 100, sort: 'dueDate' });
  const tasks = tq.data?.data || [];
  const done = tasks.filter((t) => t.status === 'done');
  const open = tasks.filter((t) => t.status !== 'done');
  const late = open.filter(isOverdue).length;
  const pct = tasks.length ? Math.round((done.length / tasks.length) * 100) : 0;
  const milestones = p.milestones || [];
  const groups = [
    ...milestones.map((m) => ({ key: m._id, m, tasks: open.filter((t) => idOf(t.milestone) === m._id) })),
    { key: 'none', tasks: open.filter((t) => !milestones.some((m) => m._id === idOf(t.milestone))) },
  ].filter((g) => g.m || g.tasks.length);
  const team = p.teamMembers || [];
  const openLink = (url) => WebBrowser.openBrowserAsync(url).catch(() => showToast({ title: "Couldn't open the link" }));

  return (
    <>
      <PageHeader caption={[p.client?.companyName, brandLabel(p.client?.brand)].filter(Boolean).join(' · ').toUpperCase() || 'PROJECT'} title={p.title} fallback="/projects" />

      <Card className="gap-4 p-4">
        <StageBar project={p} canEdit={canEditProject(p, me)} />
      </Card>

      <Card className="gap-3 p-4">
        <View className="gap-1.5">
          <View className="flex-row items-end justify-between">
            <Text className="text-caption text-muted">TASKS</Text>
            <Text className="font-body-semibold tabular-nums">{done.length} of {tasks.length} done{late ? <Text className="font-body-semibold text-danger"> · {late} overdue</Text> : ''}</Text>
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
        {!!p.projectCode && <Row label="Code"><Text className="font-body-medium tabular-nums">{p.projectCode}</Text></Row>}
        {!!p.description && <Text selectable className="border-t border-line pt-3">{p.description}</Text>}
      </Card>

      <View className="gap-3">
        <Title right={<Text className="text-sm text-muted tabular-nums">{open.length} open</Text>}>Tasks</Title>
        <QuickAddTask extra={{ project: p._id }} placeholder="Add a task to this project · @name fri !high" />
        {tq.isLoading ? <DashboardState isLoading /> : (
          <>
            {groups.map((g) => (
              <View key={g.key} className="gap-2">
                {g.m ? (
                  <View className="flex-row items-center gap-2 pt-1">
                    <Text className="flex-1 text-caption text-muted">{g.m.title.toUpperCase()}{g.m.dueDate ? ` · ${shortDate(g.m.dueDate)}` : ''}</Text>
                    {badge(MILESTONE, g.m.status)}
                  </View>
                ) : milestones.length ? <Text className="pt-1 text-caption text-muted">NO MILESTONE</Text> : null}
                {g.tasks.map((t) => <TaskRow key={t._id} task={t} />)}
                {g.m && !g.tasks.length && <Text className="text-sm text-muted">No open tasks.</Text>}
              </View>
            ))}
            {!tasks.length && <Text className="text-sm text-muted">No tasks yet. Add the first one above.</Text>}
            {!!done.length && <Button title={showDone ? 'Hide done tasks' : `Show ${done.length} done`} variant="ghost" size="sm" onPress={() => setShowDone((x) => !x)} />}
            {showDone && done.map((t) => <TaskRow key={t._id} task={t} swipe={false} />)}
          </>
        )}
      </View>

      {!!p.deliverables?.length && (
        <Card className="gap-3 p-4">
          <Title right={<Text className="text-sm text-muted tabular-nums">{p.deliverables.filter((d) => d.status === 'delivered').length}/{p.deliverables.length}</Text>}>Deliverables</Title>
          {p.deliverables.map((d) => (
            <View key={d._id} className="flex-row items-center gap-3 border-t border-line pt-3">
              <View className="flex-1 gap-0.5">
                <Text className="font-body-medium">{d.title}</Text>
                <Text numberOfLines={2} className="text-xs text-muted">{[d.category === 'others' ? 'Other' : d.category, d.details].filter(Boolean).join(' · ')}</Text>
              </View>
              {badge(DELIVERABLE, d.status)}
              {!!d.driveUrl && (
                <Pressable onPress={() => openLink(d.driveUrl)} accessibilityLabel={`Open ${d.title} in Drive`} className="h-11 w-11 items-center justify-center">
                  <ExternalLink size={18} color={theme['accent-ink']} />
                </Pressable>
              )}
            </View>
          ))}
        </Card>
      )}

      <Card className="gap-3 p-4">
        <Title>Team</Title>
        {team.map((m) => (
          <View key={m._id || idOf(m.user)} className="flex-row items-center gap-3">
            <Avatar name={m.user?.name || '?'} uri={m.user?.avatar} size={32} />
            <Text className="flex-1 font-body-medium">{idOf(m.user) === me._id ? 'You' : m.user?.name || 'Someone'}</Text>
            {!!m.role && <Text className="text-sm text-muted">{m.role}</Text>}
          </View>
        ))}
        {!team.length && <Text className="text-sm text-muted">Nobody added yet.</Text>}
      </Card>

      <Text className="text-center text-xs text-muted">Project chat, files, QC and the closing note are on the web for now.</Text>
    </>
  );
}

export default function ProjectDetail() {
  const { id } = useLocalSearchParams();
  const { data, isLoading, isError, error, refetch } = useGetProjectByIdQuery(id);
  useEntityRoom('project', id, 'Project');
  const refreshControl = usePullRefresh(refetch);
  const project = data?.data?.project;
  return (
    <Screen scroll className="gap-5 pt-2" refreshControl={refreshControl}>
      {project ? <ProjectBody key={project._id} project={project} /> : (
        <>
          <PageHeader caption="PROJECT" title="" fallback="/projects" />
          <DashboardState isLoading={isLoading} isError={isError || !isLoading} refetch={refetch} gone={[403, 404].includes(error?.status) && 'This project is gone'} onBack={() => backTo('/projects')} />
        </>
      )}
    </Screen>
  );
}
