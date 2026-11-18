import { Text as RNText } from 'react-native';
import { cn } from '@/utils/cn';

// RN text inherits nothing, so every string goes through here to get the app font and colour.
export function Text({ className, ...props }) {
  return <RNText maxFontSizeMultiplier={1.6} className={cn('font-body text-[15px] leading-[22px] text-ink', className)} {...props} />;
}

// Display face (brand serif) for screen titles; DESIGN.md §3.
export function Heading({ className, ...props }) {
  return <Text accessibilityRole="header" className={cn('font-display text-display text-ink', className)} {...props} />;
}
