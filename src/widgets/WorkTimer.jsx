import { HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle, frame, lineLimit, monospacedDigit, padding } from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity } from 'expo-widgets';

// Dynamic Island + Lock Screen card for running time: clocked in today, or a task stopwatch.
// Props: { kind: 'clock' | 'task', title, sub, start (ms, when the count began), paused (ms, or 0 while running) }.
// iOS counts the timer itself, so the app only updates it when something changes (break, stop).
// This function runs inside iOS's widget engine: only Expo UI views, nothing from outside the function.
const layout = (props) => {
  'widget';
  const accent = '#C98B4A';
  const icon = props.kind === 'task' ? 'stopwatch.fill' : props.paused ? 'cup.and.saucer.fill' : 'clock.fill';
  const timer = (size, width) => (
    <Text
      timerInterval={{ lower: new Date(props.start), upper: new Date(props.start + 24 * 3600 * 1000) }}
      countsDown={false}
      pauseTime={props.paused ? new Date(props.paused) : undefined}
      modifiers={[font({ size, weight: 'semibold' }), monospacedDigit(), foregroundStyle(accent), ...(width ? [frame({ width })] : [])]}
    />
  );
  return {
    banner: (
      <HStack spacing={12} modifiers={[padding({ all: 16 })]}>
        <Image systemName={icon} color={accent} size={26} />
        <VStack alignment="leading" spacing={2}>
          <Text modifiers={[font({ size: 15, weight: 'semibold' }), lineLimit(1)]}>{props.title}</Text>
          <Text modifiers={[font({ size: 13 }), foregroundStyle({ type: 'hierarchical', style: 'secondary' }), lineLimit(1)]}>{props.sub}</Text>
        </VStack>
        <Spacer />
        {timer(28, 120)}
      </HStack>
    ),
    compactLeading: <Image systemName={icon} color={accent} />,
    compactTrailing: timer(14, 64),
    minimal: <Image systemName={icon} color={accent} />,
    expandedLeading: (
      <HStack spacing={6}>
        <Image systemName={icon} color={accent} />
        <Text modifiers={[font({ size: 14, weight: 'semibold' })]}>{props.kind === 'task' ? 'Stopwatch' : 'Clocked in'}</Text>
      </HStack>
    ),
    expandedTrailing: timer(18, 90),
    expandedBottom: (
      <Text modifiers={[font({ size: 13 }), foregroundStyle({ type: 'hierarchical', style: 'secondary' }), lineLimit(1)]}>{props.kind === 'task' ? props.title : props.sub}</Text>
    ),
  };
};

// Two types with one layout, so each kind can be found again after the app restarts (getInstances per type).
export const ClockTimer = createLiveActivity('ClockTimer', layout);
export const TaskTimer = createLiveActivity('TaskTimer', layout);
