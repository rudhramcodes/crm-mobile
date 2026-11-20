import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useSelector } from 'react-redux';
import { BarChart3, Download, ListTodo, Plus, Search, SlidersHorizontal } from 'lucide-react-native';
import {
  BoardView, BulkBar, Button, CalendarView, Chip, DashboardState, EmptyState, FilterPanel, Heading, Input, ListView, MyDayView, Pressable, Screen, SwipeIntro, Text, showToast, usePullRefresh,
} from '@/components';
import { useGetTasksQuery, useGetWatchedTasksQuery } from '@/services/taskApi';
import { useTheme } from '@/constants/theme';
import { shareCsv } from '@/utils/tasks';

const VIEWS = [['day', 'My Day'], ['list', 'List'], ['board', 'Board'], ['calendar', 'Calendar']];
const EMPTY = { status: '', priority: '', project: '', assignedTo: '', assigneeName: '', watching: false };
// Start on what still needs doing; employees start on their own work, managers and admins on everyone's.
const startFilters = (me) => ({ ...EMPTY, status: 'open', ...(me.role === 'employee' && { assignedTo: me._id, assigneeName: 'Me' }) });

// Tasks hub: four views over one filtered list, plus search, filters, bulk select, insights and CSV export.
export default function TasksTab() {
  const theme = useTheme();
  const me = useSelector((s) => s.auth.user);
  const [view, setView] = useState('day');
  const [f, setF] = useState(() => startFilters(me));
  const start = startFilters(me);
  const [showFilters, setShowFilters] = useState(false);
  const [typed, setTyped] = useState('');
  const [search, setSearch] = useState('');
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState([]);

  // shortcut: up to 100 tasks per view, newest first (server max); add paging when a view routinely holds more.
  // My Day is personal and ignores the List filters: my open tasks (owner or helper), soonest due first,
  // plus what I finished today, so years of done tasks never crowd out today's work.
  const day = view === 'day';
  const params = day
    ? { page: 1, limit: 100, assignedTo: me._id, open: 'true', sort: 'dueDate', search: search || undefined }
    : {
      page: 1, limit: 100, search: search || undefined, priority: f.priority || undefined,
      status: f.status === 'open' ? undefined : f.status || undefined, open: f.status === 'open' ? 'true' : undefined,
      project: f.project || undefined, assignedTo: f.assignedTo || undefined,
    };
  const watchingNow = !day && f.watching;
  const all = useGetTasksQuery(params, { skip: watchingNow });
  const watched = useGetWatchedTasksQuery(params, { skip: !watchingNow });
  const [startOfToday] = useState(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString(); });
  const doneToday = useGetTasksQuery({ page: 1, limit: 100, assignedTo: me._id, doneSince: startOfToday }, { skip: !day });
  const q = watchingNow ? watched : all;
  const refreshControl = usePullRefresh(() => Promise.all([q.refetch(), day && doneToday.refetch()]));
  const tasks = [...(q.data?.data || []), ...(day ? doneToday.data?.data || [] : [])];
  const total = q.data?.pagination?.total ?? tasks.length;
  const active = day ? 0 : ['status', 'priority', 'project', 'assignedTo', 'watching'].filter((k) => f[k] !== start[k]).length;
  const round = 'h-11 w-11 items-center justify-center rounded-full bg-surface-2';

  // A new filter or search clears any selection, so hidden tasks are never bulk-changed.
  const set = (patch) => { setF((x) => ({ ...x, ...patch })); setSelecting(false); setSelected([]); };
  const toggle = (id) => {
    setSelecting(true);
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };
  const clear = () => { setSelecting(false); setSelected([]); };
  const exportAll = () => (tasks.length ? shareCsv(tasks).catch((e) => showToast({ title: "Couldn't export", message: e.message })) : showToast({ title: 'No tasks to export' }));

  return (
    <Screen scroll className="gap-4 pt-6" refreshControl={refreshControl}>
      <View className="flex-row items-end gap-3">
        <View className="flex-1">
          <Text className="text-sm text-muted">{day ? `${total} on my plate` : `${total} ${total === 1 ? 'task' : 'tasks'}${f.watching ? ' watched' : ''}`}</Text>
          <Heading>Tasks</Heading>
        </View>
        <Pressable onPress={() => router.push({ pathname: '/tasks/insights', params: { q: JSON.stringify({ ...params, watching: f.watching }) } })} accessibilityLabel="Insights" className={round}><BarChart3 size={20} color={theme.ink} /></Pressable>
        <Pressable onPress={exportAll} accessibilityLabel="Export as CSV" className={round}><Download size={20} color={theme.ink} /></Pressable>
        <Button title="New" icon={Plus} size="sm" onPress={() => router.push('/tasks/new')} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-5" contentContainerClassName="gap-2 px-5">
        {VIEWS.map(([v, l]) => <Chip key={v} label={l} active={view === v} onPress={() => { setView(v); clear(); }} />)}
      </ScrollView>

      <View className="flex-row items-start gap-2">
        <Input
          className="flex-1"
          value={typed}
          onChangeText={setTyped}
          onSubmitEditing={() => { setSearch(typed.trim()); setSelected([]); }}
          onBlur={() => { setSearch(typed.trim()); setSelected([]); }}
          placeholder={day ? 'Search my tasks' : 'Search title, description, tags'}
          accessibilityLabel="Search tasks"
          returnKeyType="search"
          right={<Search size={18} color={theme.muted} />}
        />
        {!day && <Pressable
          onPress={() => setShowFilters((s) => !s)}
          accessibilityLabel={`Filters${active ? `, ${active} on` : ''}`}
          accessibilityState={{ expanded: showFilters }}
          className={showFilters || active ? 'h-[52px] w-[52px] items-center justify-center rounded-2xl bg-ink' : 'h-[52px] w-[52px] items-center justify-center rounded-2xl bg-surface-2'}
        >
          <SlidersHorizontal size={20} color={showFilters || active ? theme.bg : theme.ink} />
        </Pressable>}
      </View>
      {showFilters && !day && <FilterPanel f={f} set={set} />}


      {q.isLoading || q.isError ? <DashboardState isLoading={q.isLoading} isError={q.isError} refetch={q.refetch} /> : (
        <>
          {view === 'list' && !!tasks.length && !selecting && (
            <Pressable onPress={() => setSelecting(true)} accessibilityRole="button" className="-my-1 self-end py-1">
              <Text className="font-body-semibold text-sm text-accent-ink">Select several</Text>
            </Pressable>
          )}
          {selecting && <BulkBar tasks={tasks} selected={selected} onClear={clear} />}
          {(view === 'day' || view === 'list') && !selecting && !!tasks.length && <SwipeIntro />}
          {view === 'day' && <MyDayView tasks={tasks} />}
          {view === 'board' && <BoardView tasks={tasks} />}
          {view === 'calendar' && <CalendarView tasks={tasks} />}
          {view === 'list' && (tasks.length ? <ListView tasks={tasks} selecting={selecting} selected={selected} onToggle={toggle} /> : (
            <EmptyState
              icon={ListTodo}
              title={search || active ? 'No tasks match' : 'Nothing open'}
              message={search || active ? 'Try another search or clear the filters.' : 'All caught up. Filters show finished tasks too.'}
              actionTitle={search || active ? 'Clear filters' : 'New task'}
              onAction={() => (search || active ? (setF(start), setTyped(''), setSearch('')) : router.push('/tasks/new'))}
            />
          ))}
        </>
      )}
    </Screen>
  );
}
