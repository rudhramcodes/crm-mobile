import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { BarChart3, CheckSquare, Download, ListTodo, Plus, Search, SlidersHorizontal } from 'lucide-react-native';
import {
  BoardView, BulkBar, Button, CalendarView, Chip, DashboardState, EmptyState, FilterPanel, Heading, Input, ListView, MiniStats, MyDayView, Pressable, Screen, SwipeIntro, Text, showToast, usePullRefresh,
} from '@/components';
import { useGetTasksQuery, useGetWatchedTasksQuery } from '@/services/taskApi';
import { useTheme } from '@/constants/theme';
import { isOverdue, shareCsv } from '@/utils/tasks';

const VIEWS = [['day', 'My Day'], ['list', 'List'], ['board', 'Board'], ['calendar', 'Calendar']];
const EMPTY = { status: '', priority: '', project: '', assignedTo: '', assigneeName: '', watching: false };

// Tasks hub: four views over one filtered list, plus search, filters, bulk select, insights and CSV export.
export default function TasksTab() {
  const theme = useTheme();
  const [view, setView] = useState('day');
  const [f, setF] = useState(EMPTY);
  const [showFilters, setShowFilters] = useState(false);
  const [typed, setTyped] = useState('');
  const [search, setSearch] = useState('');
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState([]);

  // shortcut: first 100 tasks for the filters (server max); add paging when a filtered list routinely holds more.
  const params = {
    page: 1, limit: 100, search: search || undefined, status: f.status || undefined, priority: f.priority || undefined,
    project: f.project || undefined, assignedTo: f.assignedTo || undefined,
  };
  const all = useGetTasksQuery(params, { skip: f.watching });
  const watched = useGetWatchedTasksQuery(params, { skip: !f.watching });
  const q = f.watching ? watched : all;
  const refreshControl = usePullRefresh(q.refetch);
  const tasks = q.data?.data || [];
  const total = q.data?.pagination?.total ?? tasks.length;
  const active = ['status', 'priority', 'project', 'assignedTo', 'watching'].filter((k) => f[k]).length;

  const set = (patch) => setF((x) => ({ ...x, ...patch }));
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
          <Text className="text-sm text-muted">{total} {total === 1 ? 'task' : 'tasks'}{f.watching ? ' watched' : ''}</Text>
          <Heading>Tasks</Heading>
        </View>
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
          onSubmitEditing={() => setSearch(typed.trim())}
          onBlur={() => setSearch(typed.trim())}
          placeholder="Search title, description, tags"
          accessibilityLabel="Search tasks"
          returnKeyType="search"
          right={<Search size={18} color={theme.muted} />}
        />
        <Pressable
          onPress={() => setShowFilters((s) => !s)}
          accessibilityLabel={`Filters${active ? `, ${active} on` : ''}`}
          accessibilityState={{ expanded: showFilters }}
          className={showFilters || active ? 'h-[52px] w-[52px] items-center justify-center rounded-2xl bg-ink' : 'h-[52px] w-[52px] items-center justify-center rounded-2xl bg-surface-2'}
        >
          <SlidersHorizontal size={20} color={showFilters || active ? theme.bg : theme.ink} />
        </Pressable>
      </View>
      {showFilters && <FilterPanel f={f} set={set} />}

      <View className="flex-row gap-2">
        <Button title="Insights" icon={BarChart3} size="sm" variant="secondary" className="flex-1" onPress={() => router.push({ pathname: '/tasks/insights', params: { q: JSON.stringify({ ...params, watching: f.watching }) } })} />
        <Button title="Export" icon={Download} size="sm" variant="secondary" className="flex-1" onPress={exportAll} />
        {view === 'list' && <Button title={selecting ? 'Cancel' : 'Select'} icon={CheckSquare} size="sm" variant="secondary" className="flex-1" onPress={() => (selecting ? clear() : setSelecting(true))} />}
      </View>

      {q.isLoading || q.isError ? <DashboardState isLoading={q.isLoading} isError={q.isError} refetch={q.refetch} /> : (
        <>
          <MiniStats items={[
            { label: 'Open', value: tasks.filter((t) => t.status !== 'done').length },
            { label: 'Doing', value: tasks.filter((t) => t.status === 'in_progress').length },
            { label: 'Overdue', value: tasks.filter(isOverdue).length },
            { label: 'Done', value: tasks.filter((t) => t.status === 'done').length },
          ]}
          />
          {selecting && <BulkBar tasks={tasks} selected={selected} onClear={clear} />}
          {(view === 'day' || view === 'list') && !selecting && !!tasks.length && <SwipeIntro />}
          {view === 'day' && <MyDayView tasks={tasks} />}
          {view === 'board' && <BoardView tasks={tasks} />}
          {view === 'calendar' && <CalendarView tasks={tasks} />}
          {view === 'list' && (tasks.length ? <ListView tasks={tasks} selecting={selecting} selected={selected} onToggle={toggle} /> : (
            <EmptyState
              icon={ListTodo}
              title={search || active ? 'No tasks match' : 'No tasks yet'}
              message={search || active ? 'Try another search or clear the filters.' : 'Create the first one.'}
              actionTitle={search || active ? 'Clear filters' : 'New task'}
              onAction={() => (search || active ? (setF(EMPTY), setTyped(''), setSearch('')) : router.push('/tasks/new'))}
            />
          ))}
          {view === 'list' && !!tasks.length && <Text className="text-xs text-muted">Swipe right to finish, left to reschedule. Long-press to select.</Text>}
        </>
      )}
    </Screen>
  );
}
