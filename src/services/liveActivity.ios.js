import { ClockTimer, TaskTimer } from '@/widgets/WorkTimer';

const TYPES = { clock: ClockTimer, task: TaskTimer };

// Starts, updates or (props null) ends the clock-in or stopwatch Live Activity.
// Fails quietly: Live Activities can be off in Settings, and older iPhones have no Dynamic Island.
export async function showWorkTimer(kind, props) {
  try {
    const type = TYPES[kind];
    const [live, ...extra] = type.getInstances();
    await Promise.all(extra.map((a) => a.end('immediate')));
    if (!props) return live && (await live.end('immediate'));
    const next = { kind, paused: 0, ...props };
    if (live) return await live.update(next);
    type.start(next, kind === 'task' ? `rudhramcrm://tasks/${props.taskId}` : 'rudhramcrm://attendance');
  } catch (e) {
    console.warn('[live activity]', e.message);
  }
}
