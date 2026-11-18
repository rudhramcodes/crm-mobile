import { View } from 'react-native';
import { Pressable } from './Pressable';
import { cn } from '@/utils/cn';

const base = 'rounded-3xl border border-line bg-surface p-5';

// Pass onPress to make the whole card tappable (it presses in like a button).
export function Card({ onPress, className, ...props }) {
  if (!onPress) return <View className={cn(base, className)} {...props} />;
  return <Pressable onPress={onPress} className={cn(base, className)} {...props} />;
}
