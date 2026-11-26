import { useEffect, useRef, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useSelector } from 'react-redux';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { Easing, FadeIn, FadeOut, LinearTransition, ZoomIn, useAnimatedReaction, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { ArrowLeft, ArrowRight, CalendarClock, Check, CheckCircle2, ChevronsRight, Circle, GitBranch, Hand, Send } from 'lucide-react-native';
import { Avatar } from './Avatar';
import { Badge } from './Badge';
import { Button } from './Button';
import { Pressable } from './Pressable';
import { Text } from './Text';
import { useUpdateTaskMutation } from '@/services/taskApi';
import { useTheme } from '@/constants/theme';
import { runAction, ymd } from '@/utils/attendance';
import { canReview, canWorkTask, dueLabel, finishStatus, isOverdue, reviewClock, reviewerOf, taskPriority, taskStatus } from '@/utils/tasks';
import { showToast } from './Toast';
import { ZoomLink } from './ZoomLink';
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

// Done for the reviewer, review for everyone else; ticking a done task reopens it (back to Working).
// A task already waiting on someone else's review has nothing to do: say who it's waiting on.
export function useFinishTask() {
  const me = useSelector((s) => s.auth.user);
  const [update] = useUpdateTaskMutation();
  return (t) => {
    if (t.status === 'review' && !canReview(t, me)) return showToast({ title: `Waiting for ${reviewerOf(t)?.name || 'the reviewer'} to review it` });
    const next = t.status === 'done' ? 'in_progress' : finishStatus(t, me);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const done = next === 'review' ? 'Sent for review' : next === 'done' ? (t.status === 'review' ? 'Approved' : 'Marked done') : 'Reopened';
    return runAction(update({ id: t._id, status: next }), done, "Couldn't update the task");
  };
}

// Like a UITableView: only changes animate. A row that leaves fades while the rows below glide up into its place;
// a new one fades in. Views mount inside LayoutAnimationConfig skipEntering, so loading and tab switches cost nothing.
export const ROW_LAYOUT = LinearTransition.duration(250).easing(Easing.out(Easing.cubic));
const ROW_IN = FadeIn.duration(200);
const ROW_OUT = FadeOut.duration(180);
const CHECK_IN = ZoomIn.springify().damping(15).stiffness(260); // the tick pops in, like Reminders

const ACTION_W = 88; // the open button's width (incl. its 8px gap to the row)
const buzz = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

// iOS-notification style action behind a row. A short swipe opens it and it waits there to be tapped;
// it stretches as the row is dragged, and past `full` it arms (haptic) so letting go runs it straight away.
// `side` is 1 for the left action (revealed by swiping right), -1 for the right one.
function SwipeAction({ icon: Icon, label, tone, side, translation, full, armed, onPress }) {
  const theme = useTheme();
  useAnimatedReaction(
    () => translation.get() * side > full,
    (on, was) => {
      if (was === null || on === was) return;
      armed.set(on ? side : 0);
      if (on) scheduleOnRN(buzz);
    },
  );
  const grow = useAnimatedStyle(() => ({ width: Math.max(ACTION_W, translation.get() * side) - 8 }));
  return (
    <View style={{ width: ACTION_W }} className={side > 0 ? 'items-start' : 'items-end'}>
      <Animated.View style={[grow, { position: 'absolute', top: 4, bottom: 4, [side > 0 ? 'left' : 'right']: 0 }]}>
        <Pressable onPress={onPress} accessibilityLabel={label} className={cn('flex-1 justify-center overflow-hidden rounded-3xl', tone, side > 0 ? 'items-end' : 'items-start')}>
          {/* The label rides the row's edge, like iOS, so it stays in view as the button stretches. */}
          <View style={{ width: ACTION_W - 8 }} className="items-center gap-1">
            <Icon size={20} color={theme.bg} />
            <Text className="font-body-semibold text-xs text-bg">{label}</Text>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

// One task: tick, title, due, priority, assignee, checklist progress.
// Swipe right shows Done (or Review), swipe left shows Reschedule: tap the button, or swipe all the way to do it at once.
export function TaskRow({ task: t, selecting, selected, onToggleSelect, swipe = true }) {
  const theme = useTheme();
  const me = useSelector((s) => s.auth.user);
  const finish = useFinishTask();
  const ref = useRef(null);
  const armed = useSharedValue(0); // 1 / -1 while a full swipe would run the left / right action
  const { width } = useWindowDimensions();
  const full = width * 0.5;
  const done = t.status === 'done';
  const late = isOverdue(t);
  const total = t.checklists?.length || 0;
  const ticked = t.checklists?.filter((c) => c.checked).length || 0;
  // Checklist % when there is one, else the doer's own "how far along".
  const pct = total ? (ticked / total) * 100 : t.status === 'in_progress' ? t.progress || 0 : 0;
  const finishLabel = finishStatus(t, me) === 'done' ? (t.status === 'review' ? 'Approve' : 'Done') : 'Review';
  const can = canWorkTask(t, me); // not on it: no tick, no swipes (they'd only fail)
  const clock = reviewClock(t);

  const open = () => onToggleSelect(t._id); // while selecting; otherwise the row is a zoom link
  // The tick is a sibling of the row's button, never inside it: nested buttons are invalid on web.
  const body = (
    <View className={cn('flex-row items-start gap-3 rounded-3xl border bg-surface p-4', selected ? 'border-accent' : late ? 'border-danger/40' : 'border-line')}>
      {selecting ? (
        <Pressable onPress={open} haptic={false} hitSlop={10} accessibilityLabel={selected ? 'Deselect' : 'Select'} className={cn('mt-0.5 h-6 w-6 items-center justify-center rounded-full border-[1.5px]', selected ? 'border-ink bg-ink' : 'border-line')}>
          {selected && <Check size={14} color={theme.bg} />}
        </Pressable>
      ) : can ? (
        <Pressable onPress={() => finish(t)} haptic={false} hitSlop={10} accessibilityLabel={done ? 'Reopen task' : finishLabel === 'Done' ? 'Mark done' : finishLabel === 'Approve' ? 'Approve' : 'Send for review'}>
          {done ? <CheckCircle2 size={24} color={theme.success} /> : <Circle size={24} color={theme.muted} />}
        </Pressable>
      ) : (
        <View importantForAccessibility="no" accessibilityElementsHidden>
          {done ? <Animated.View entering={CHECK_IN}><CheckCircle2 size={24} color={theme.success} /></Animated.View> : <Circle size={24} color={theme.line} />}
        </View>
      )}
      <ZoomLink href={selecting ? null : `/tasks/${t._id}`}>
        <Pressable
          onPress={selecting ? open : undefined}
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
          // Screen readers can't swipe: offer the same two actions.
          accessibilityActions={can && !selecting ? [{ name: 'finish', label: done ? 'Reopen' : finishLabel }, { name: 'reschedule', label: 'Reschedule' }] : undefined}
          onAccessibilityAction={(e) => (e.nativeEvent.actionName === 'finish' ? finish(t) : openReschedule(t))}
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
            {/* Only what's worth a glance: High/Urgent, and a status the review clock doesn't already say. */}
            <View className="flex-row items-center gap-2">
              {['high', 'urgent'].includes(t.priority) && <PriorityBadge priority={t.priority} />}
              {t.status !== 'todo' && !done && !clock && <TaskStatusBadge status={t.status} />}
              {(total > 0 || pct > 0) && (
                <View className="flex-1 flex-row items-center gap-2" accessibilityLabel={total ? `Checklist ${ticked} of ${total}` : `${pct}% done`}>
                  <View className="h-1.5 flex-1 overflow-hidden rounded-full bg-sand">
                    <View className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                  </View>
                  <Text className="text-xs text-muted tabular-nums">{total ? `${ticked}/${total}` : `${pct}%`}</Text>
                </View>
              )}
            </View>
          </View>
          {!!t.assignedTo?.name && <Avatar name={t.assignedTo.name} uri={t.assignedTo.avatar} size={28} />}
          {!!t.helpers?.length && <Text className="text-xs font-body-semibold text-muted" accessibilityLabel={`${t.helpers.length} helping`}>+{t.helpers.length}</Text>}
        </Pressable>
      </ZoomLink>
    </View>
  );
  const shell = (children) => <Animated.View layout={ROW_LAYOUT} entering={ROW_IN} exiting={ROW_OUT}>{children}</Animated.View>;
  if (!swipe || selecting || !can) return shell(body);
  // Finishing usually moves the row to another group: it stays open and slides away. If it stays put, it closes.
  const run = (dir) => {
    armed.set(0);
    if (dir === 'right') return Promise.resolve(finish(t)).then(() => ref.current?.close());
    ref.current?.close();
    openReschedule(t);
  };

  return shell(
    <Swipeable
      ref={ref}
      friction={1}
      overshootFriction={1}
      leftThreshold={ACTION_W / 2}
      rightThreshold={ACTION_W / 2}
      renderLeftActions={(_, x) => <SwipeAction side={1} translation={x} full={full} armed={armed} onPress={() => run('right')} icon={done ? Circle : finishLabel === 'Done' ? Check : Send} label={done ? 'Reopen' : finishLabel} tone="bg-success" />}
      renderRightActions={(_, x) => <SwipeAction side={-1} translation={x} full={full} armed={armed} onPress={() => run('left')} icon={CalendarClock} label="Reschedule" tone="bg-accent-ink" />}
      onSwipeableWillOpen={(dir) => {
        // dir is the finger's direction: right reveals the left (finish) action.
        if (armed.get() === (dir === 'right' ? 1 : -1)) run(dir);
      }}
    >
      {body}
    </Swipeable>
  );
}

const INTRO_KEY = 'tasks-swipe-intro';
export const SELECT_HINT_KEY = 'tasks-select-hint';

// One quiet line until the first long-press select; after that people know.
export function SelectHint() {
  const [show, setShow] = useState(false);
  useEffect(() => { getPref(SELECT_HINT_KEY).then((v) => setShow(!v)).catch(() => {}); }, []);
  if (!show) return null;
  return <Text className="-my-1 text-xs text-muted">Tip: long-press a task to select several.</Text>;
}

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
  const row = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  // The buttons fill the gap the row leaves, with a small gutter, like SwipeAction.
  const doneBtn = useAnimatedStyle(() => ({ width: Math.max(0, x.get() - 8) }));
  const laterBtn = useAnimatedStyle(() => ({ width: Math.max(0, -x.get() - 8) }));

  useEffect(() => { getPref(INTRO_KEY).then((v) => setShow(!v)).catch(() => {}); }, []);
  useEffect(() => {
    if (!show || reduced) return;
    const ease = { duration: 550, easing: Easing.out(Easing.cubic) };
    // Same moves as a real row: show Done, show Reschedule, then swipe all the way so the button stretches.
    x.set(withRepeat(withSequence(
      withDelay(500, withTiming(ACTION_W, ease)), withDelay(1100, withTiming(0, ease)),
      withDelay(400, withTiming(-ACTION_W, ease)), withDelay(1100, withTiming(0, ease)),
      withDelay(400, withTiming(210, ease)), withDelay(500, withTiming(0, ease)),
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
      <View className="h-16" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Animated.View style={[{ position: 'absolute', left: 0, top: 4, bottom: 4, overflow: 'hidden', borderRadius: 24 }, doneBtn]}>
          <View className="flex-1 items-end justify-center bg-success">
            <View style={{ width: ACTION_W - 8 }} className="items-center gap-0.5"><Check size={18} color={theme.bg} /><Text className="font-body-semibold text-xs text-bg">Done</Text></View>
          </View>
        </Animated.View>
        <Animated.View style={[{ position: 'absolute', right: 0, top: 4, bottom: 4, overflow: 'hidden', borderRadius: 24 }, laterBtn]}>
          <View className="flex-1 items-start justify-center bg-accent-ink">
            <View style={{ width: ACTION_W - 8 }} className="items-center gap-0.5"><CalendarClock size={18} color={theme.bg} /><Text className="font-body-semibold text-xs text-bg" numberOfLines={1}>Reschedule</Text></View>
          </View>
        </Animated.View>
        <Animated.View style={[{ height: '100%' }, row]}>
          <View className="flex-1 flex-row items-center gap-3 rounded-3xl border border-line bg-surface-2 px-4">
            <Circle size={20} color={theme.muted} />
            <Text className="flex-1 font-body-semibold" numberOfLines={1}>Edit the wedding teaser</Text>
          </View>
        </Animated.View>
      </View>
      <View className="gap-2.5">
        <Tip icon={ArrowRight}>Swipe right a little: a Done button appears and waits. Tap it to finish.</Tip>
        <Tip icon={ArrowLeft}>Swipe left the same way for Reschedule.</Tip>
        <Tip icon={ChevronsRight}>{"In a hurry? Swipe all the way across and it's done at once. You'll feel a tap when it's ready."}</Tip>
        <Tip icon={Hand}>Changed your mind? Tap the row to close it. Long-press in All tasks to select several.</Tip>
      </View>
      <Button title="Got it" size="sm" onPress={dismiss} />
    </View>
  );
}
