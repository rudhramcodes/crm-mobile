import { requireOptionalNativeModule } from 'expo';

// Only load the Live Activity code when this build has the native module: an older dev build or Expo Go
// would otherwise crash on import. Without it the app simply has no Dynamic Island timer.
const types = requireOptionalNativeModule('ExpoWidgets')
  ? (() => { const w = require('@/widgets/WorkTimer'); return { clock: w.ClockTimer, task: w.TaskTimer }; })()
  : null;

// Starts, updates or (props null) ends the clock-in or stopwatch Live Activity.
// Fails quietly: Live Activities can be off in Settings, and older iPhones have no Dynamic Island.
export async function showWorkTimer(kind, props) {
  if (!types) return;
  try {
    const type = types[kind];
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
