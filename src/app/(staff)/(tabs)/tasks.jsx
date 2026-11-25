import { useState } from 'react';
import { ActionSheetIOS, ActivityIndicator, Alert, Platform, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { router } from 'expo-router';
import { useSelector } from 'react-redux';
import { Ellipsis, ListTodo, Plus, Search, SlidersHorizontal } from 'lucide-react-native';
import {
  BulkBar, Button, DashboardState, EmptyState, FilterPanel, Heading, Input, ListView, MyDayView, Pressable, SELECT_HINT_KEY, Screen, SelectHint, SwipeIntro, Tabs, Text, showToast, usePullRefresh,
} from '@/components';
import { useGetTasksQuery } from '@/services/taskApi';
import { useTheme } from '@/constants/theme';
import { shareCsv } from '@/utils/tasks';
import { setPref } from '@/utils/prefs';

const VIEWS = [{ value: 'day', label: 'My Day' }, { value: 'list', label: 'All tasks' }];
const EMPTY = { status: '', priority: '', project: '', assignedTo: '', assigneeName: '' };
// Start on what still needs doing; employees start on their own work, managers and admins on everyone's.
const startFilters = (me) => ({ ...EMPTY, status: 'open', ...(me.role === 'employee' && { assignedTo: me._id, assigneeName: 'Me' }) });

// Tasks hub: My Day (my work) and All tasks (filtered list), plus search, bulk select, and Insights / CSV export in the ⋯ menu.
export default function TasksTab() {
  const theme = useTheme();
  const me = useSelector((s) => s.auth.user);
  const [view, setView] = useState('day');
  const [switched, setSwitched] = useState(false); // the first load just appears; only a tab switch crossfades
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
  const q = useGetTasksQuery(params);
  const [startOfToday] = useState(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString(); });
  const doneToday = useGetTasksQuery({ page: 1, limit: 100, assignedTo: me._id, doneSince: startOfToday }, { skip: !day });
  const refreshControl = usePullRefresh(() => Promise.all([q.refetch(), day && doneToday.refetch()]));
  // By id: a task just finished can sit in both lists until both refetch.
  const tasks = [...new Map([...(q.data?.data || []), ...(day ? doneToday.data?.data || [] : [])].map((t) => [t._id, t])).values()];
  const total = q.data?.pagination?.total ?? tasks.length;
  const active = day ? 0 : ['status', 'priority', 'project', 'assignedTo'].filter((k) => f[k] !== start[k]).length;
  const round = 'h-11 w-11 items-center justify-center rounded-full bg-surface-2';

  // A new filter or search clears any selection, so hidden tasks are never bulk-changed.
  const set = (patch) => { setF((x) => ({ ...x, ...patch })); setSelecting(false); setSelected([]); };
  const toggle = (id) => {
    setSelecting(true);
    setPref(SELECT_HINT_KEY, '1');
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };
  const clear = () => { setSelecting(false); setSelected([]); };
  const exportAll = () => (tasks.length ? shareCsv(tasks).catch((e) => showToast({ title: "Couldn't export", message: e.message })) : showToast({ title: 'No tasks to export' }));
  const insights = () => router.push({ pathname: '/tasks/insights', params: { q: JSON.stringify(params) } });
  // Rarely used, so they live behind ⋯ instead of taking header space every day.
  const menu = () => {
    const actions = [['Insights', insights], ['Export as CSV', exportAll]];
    if (Platform.OS === 'ios') {
      return ActionSheetIOS.showActionSheetWithOptions(
        { options: [...actions.map(([t]) => t), 'Cancel'], cancelButtonIndex: actions.length, tintColor: theme.ink },
        (i) => actions[i]?.[1](),
      );
    }
    Alert.alert('Tasks', undefined, [...actions.map(([text, onPress]) => ({ text, onPress })), { text: 'Cancel', style: 'cancel' }], { cancelable: true });
  };

  return (
    <Screen tab scroll className="gap-4 pt-6" refreshControl={refreshControl}>
      <View className="flex-row items-end gap-3">
        <View className="flex-1">
          <Text className="text-sm text-muted">{day ? `${total} on my plate` : `${total} ${total === 1 ? 'task' : 'tasks'}`}</Text>
          <Heading>Tasks</Heading>
        </View>
        <Pressable onPress={menu} accessibilityLabel="More: Insights, Export" className={round}><Ellipsis size={20} color={theme.ink} /></Pressable>
        <Button title="New" icon={Plus} size="sm" onPress={() => router.push('/tasks/new')} />
      </View>

      <Tabs tabs={VIEWS} value={view} onChange={(v) => { setSwitched(true); setView(v); clear(); setShowFilters(false); }} />

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


      {/* Plain native spinner while the first page loads. */}
      {q.isLoading ? <ActivityIndicator color={theme.accent} style={{ paddingVertical: 40 }} /> : q.isError ? <DashboardState isError refetch={q.refetch} /> : (
        // A quick crossfade between views, like a segmented control switching pages in Settings.
        <Animated.View key={view} entering={switched ? FadeIn.duration(180) : undefined} style={{ gap: 16 }}>
          {view === 'list' && !!tasks.length && !selecting && <SelectHint />}
          {selecting && <BulkBar tasks={tasks} selected={selected} onClear={clear} />}
          {(view === 'day' || view === 'list') && !selecting && !!tasks.length && <SwipeIntro />}
          {view === 'day' && <MyDayView tasks={tasks} />}
          {view === 'list' && (tasks.length ? <ListView tasks={tasks} selecting={selecting} selected={selected} onToggle={toggle} /> : (
            <EmptyState
              icon={ListTodo}
              title={search || active ? 'No tasks match' : 'Nothing open'}
              message={search || active ? 'Try another search or clear the filters.' : 'All caught up. Filters show finished tasks too.'}
              actionTitle={search || active ? 'Clear filters' : 'New task'}
              onAction={() => (search || active ? (setF(start), setTyped(''), setSearch('')) : router.push('/tasks/new'))}
            />
          ))}
        </Animated.View>
      )}
    </Screen>
  );
}
