import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useSelector } from 'react-redux';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { ArrowLeft, ArrowRight, CalendarClock, Check, CheckCircle2, Circle, GitBranch, Hand, Send } from 'lucide-react-native';
import { Avatar } from './Avatar';
import { Badge } from './Badge';
import { Button } from './Button';
import { Pressable } from './Pressable';
import { Text } from './Text';
import { useUpdateTaskMutation } from '@/services/taskApi';
import { useTheme } from '@/constants/theme';
import { runAction, ymd } from '@/utils/attendance';
import { dueLabel, finishStatus, isOverdue, reviewClock, taskPriority, taskStatus } from '@/utils/tasks';
import { cn } from '@/utils/cn';
import { getPref, setPref } from '@/utils/prefs';

export function TaskStatusBadge({ status }) {
  const m = taskStatus(status);
  return <Badge label={m.label} color={m.color} />;
}

export function PriorityBadge({ priority }) {
  const m = taskPriority(priority);
  return <Badge label={m.label} color={m.color} />;
}

export const openReschedule = (t) =>
  router.push({
    pathname: '/tasks/reschedule',
    params: { id: t._id, due: t.dueDate ? ymd(t.dueDate) : '', title: t.title },
  });

// Done for the creator, review for everyone else; ticking a done task reopens it.
export function useFinishTask() {
  const me = useSelector((s) => s.auth.user);
  const [update] = useUpdateTaskMutation();
  return (t) => {
    const next = t.status === 'done' ? 'todo' : finishStatus(t, me);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const done = next === 'review' ? 'Sent for review' : next === 'done' ? (t.status === 'review' ? 'Approved' : 'Marked done') : 'Reopened';
    return runAction(update({ id: t._id, status: next }), done, "Couldn't update the task");
  };
}

function SwipeAction({ icon: Icon, label, tone }) {
  const theme = useTheme();
  return (
    <View className={cn('my-1 w-28 items-center justify-center gap-1 rounded-3xl', tone)}>
      <Icon size={20} color={theme.bg} />
      <Text className="font-body-semibold text-xs text-bg">{label}</Text>
    </View>
  );
}

// One task: tick, title, due, priority, assignee, checklist progress. Swipe right finishes, swipe left reschedules.
export function TaskRow({ task: t, selecting, selected, onToggleSelect, swipe = true }) {
  const theme = useTheme();
  const me = useSelector((s) => s.auth.user);
  const finish = useFinishTask();
  const ref = useRef(null);
  const done = t.status === 'done';
  const late = isOverdue(t);
  const total = t.checklists?.length || 0;
  const ticked = t.checklists?.filter((c) => c.checked).length || 0;
  const finishLabel = finishStatus(t, me) === 'done' ? (t.status === 'review' ? 'Approve' : 'Done') : 'Review';
  const clock = reviewClock(t);

  const open = selecting ? () => onToggleSelect(t._id) : () => router.push(`/tasks/${t._id}`);
  // The tick is a sibling of the row's button, never inside it: nested buttons are invalid on web.
  const body = (
    <View className={cn('flex-row items-start gap-3 rounded-3xl border bg-surface p-4', selected ? 'border-accent' : late ? 'border-danger/40' : 'border-line')}>
      {selecting ? (
        <Pressable onPress={open} haptic={false} hitSlop={10} accessibilityLabel={selected ? 'Deselect' : 'Select'} className={cn('mt-0.5 h-6 w-6 items-center justify-center rounded-full border-[1.5px]', selected ? 'border-ink bg-ink' : 'border-line')}>
          {selected && <Check size={14} color={theme.bg} />}
        </Pressable>
      ) : (
        <Pressable onPress={() => finish(t)} haptic={false} hitSlop={10} accessibilityLabel={done ? 'Reopen task' : finishLabel === 'Done' ? 'Mark done' : 'Send for review'}>
          {done ? <CheckCircle2 size={24} color={theme.success} /> : <Circle size={24} color={theme.muted} />}
        </Pressable>
      )}
      <Pressable
        onPress={open}
        onLongPress={
          onToggleSelect && !selecting
            ? () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                onToggleSelect(t._id);
              }
            : undefined
        }
        accessibilityLabel={`${t.title}, ${taskStatus(t.status).label}, ${taskPriority(t.priority).label} priority, due ${dueLabel(t.dueDate)}`}
        accessibilityState={selecting ? { selected: !!selected } : undefined}
        className={cn('flex-1 flex-row items-start gap-3', done && !selecting && 'opacity-60')}
      >
        <View className="flex-1 gap-1.5">
          <Text numberOfLines={2} className={cn('font-body-semibold', done && 'line-through text-muted')}>
            {t.title}
          </Text>
          <View className="flex-row flex-wrap items-center gap-x-3 gap-y-1">
            <Text className={cn('text-sm tabular-nums', late ? 'font-body-semibold text-danger' : 'text-muted')}>{late ? `Overdue · ${dueLabel(t.dueDate)}` : dueLabel(t.dueDate)}</Text>
            {!!t.project?.title && (
              <Text numberOfLines={1} className="max-w-[140px] text-sm text-muted">
                {t.project.title}
              </Text>
            )}
            {!!t.parent && <GitBranch size={14} color={theme.muted} accessibilityLabel="Subtask" />}
            {!!clock && <Text className={cn('text-sm tabular-nums', clock.late ? 'font-body-semibold text-danger' : 'text-accent-ink')}>{clock.label}</Text>}
          </View>
          <View className="flex-row items-center gap-2">
            <PriorityBadge priority={t.priority} />
            {t.status !== 'todo' && !done && <TaskStatusBadge status={t.status} />}
            {total > 0 && (
              <View className="flex-1 flex-row items-center gap-2" accessibilityLabel={`Checklist ${ticked} of ${total}`}>
                <View className="h-1.5 flex-1 overflow-hidden rounded-full bg-sand">
                  <View className="h-full rounded-full bg-accent" style={{ width: `${(ticked / total) * 100}%` }} />
                </View>
                <Text className="text-xs text-muted tabular-nums">
                  {ticked}/{total}
                </Text>
              </View>
            )}
          </View>
        </View>
        {!!t.assignedTo?.name && <Avatar name={t.assignedTo.name} uri={t.assignedTo.avatar} size={28} />}
      </Pressable>
    </View>
  );
  if (!swipe || selecting) return body;

  return (
    <Swipeable
      ref={ref}
      friction={2}
      leftThreshold={72}
      rightThreshold={72}
      overshootFriction={8}
      renderLeftActions={() => <SwipeAction icon={done ? Circle : finishLabel === 'Done' ? Check : Send} label={done ? 'Reopen' : finishLabel} tone="mr-2 bg-success" />}
      renderRightActions={() => <SwipeAction icon={CalendarClock} label="Reschedule" tone="ml-2 bg-accent-ink" />}
      onSwipeableWillOpen={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)}
      onSwipeableOpen={(dir) => {
        ref.current?.close();
        if (dir === 'right') finish(t); // dir is the finger's direction: right reveals the left (finish) action
        else openReschedule(t);
      }}
    >
      {body}
    </Swipeable>
  );
}

const INTRO_KEY = 'tasks-swipe-intro';

function Tip({ icon: Icon, children }) {
  const theme = useTheme();
  return (
    <View className="flex-row items-center gap-3">
      <View className="h-8 w-8 items-center justify-center rounded-full bg-surface-2"><Icon size={16} color={theme.ink} /></View>
      <Text className="flex-1 text-sm">{children}</Text>
    </View>
  );
}

// Shown once per device: a demo row slides right (finish) then left (reschedule) so the gestures are discoverable.
export function SwipeIntro() {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const [show, setShow] = useState(false);
  const x = useSharedValue(0);
  const row = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  useEffect(() => { getPref(INTRO_KEY).then((v) => setShow(!v)).catch(() => {}); }, []);
  useEffect(() => {
    if (!show || reduced) return;
    const ease = { duration: 550, easing: Easing.out(Easing.cubic) };
    x.set(withRepeat(withSequence(
      withDelay(500, withTiming(96, ease)), withDelay(900, withTiming(0, ease)),
      withDelay(500, withTiming(-96, ease)), withDelay(900, withTiming(0, ease)),
    ), -1));
  }, [show, reduced, x]);

  if (!show) return null;
  const dismiss = () => { setShow(false); setPref(INTRO_KEY, '1'); };

  return (
    <View className="gap-4 rounded-3xl border border-accent/40 bg-surface p-4" accessibilityRole="summary">
      <View className="gap-0.5">
        <Text className="text-caption text-accent-ink">NEW HERE?</Text>
        <Text className="font-display text-xl">Swipe a task to act fast</Text>
      </View>
      <View className="h-16 overflow-hidden rounded-2xl" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <View className="absolute inset-0 flex-row">
          <View className="flex-1 flex-row items-center gap-1.5 bg-success pl-4"><Check size={16} color={theme.bg} /><Text className="font-body-semibold text-xs text-bg">Done</Text></View>
          <View className="flex-1 flex-row items-center justify-end gap-1.5 bg-accent-ink pr-4"><Text className="font-body-semibold text-xs text-bg">Reschedule</Text><CalendarClock size={16} color={theme.bg} /></View>
        </View>
        <Animated.View style={row} className="h-full flex-row items-center gap-3 rounded-2xl border border-line bg-surface px-4">
          <Circle size={20} color={theme.muted} />
          <Text className="flex-1 font-body-semibold">Edit the wedding teaser</Text>
        </Animated.View>
      </View>
      <View className="gap-2.5">
        <Tip icon={ArrowRight}>Swipe right to mark it Done. If someone else created it, it goes to them for review.</Tip>
        <Tip icon={ArrowLeft}>Swipe left to pick a new due date.</Tip>
        <Tip icon={Hand}>Tap the circle to finish, long-press to select several.</Tip>
      </View>
      <Button title="Got it" size="sm" onPress={dismiss} />
    </View>
  );
}
