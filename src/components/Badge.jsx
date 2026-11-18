import { View } from 'react-native';
import { Text } from './Text';
import { cn } from '@/utils/cn';

// Brand tones only (DESIGN.md §1); the status constants use the same class pairs.
const variants = {
  default: 'bg-surface-2 text-muted',
  primary: 'bg-ink text-bg',
  info: 'bg-sand text-brown',
  warning: 'bg-accent/15 text-accent-ink',
  success: 'bg-success/15 text-success',
  danger: 'bg-danger/15 text-danger',
};

// `color` takes the constants' class strings (e.g. LEAD_STATUS[i].color); text-* goes to the label.
export function Badge({ label, variant = 'default', color, className }) {
  const classes = (color || variants[variant] || variants.default).split(' ');
  const isText = (c) => /(^|:)text-/.test(c);
  return (
    <View className={cn('self-start rounded-full px-3 py-1', classes.filter((c) => !isText(c)), className)}>
      <Text className={cn('font-body-medium text-xs', classes.filter(isText))}>{label}</Text>
    </View>
  );
}
