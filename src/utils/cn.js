import { clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// Our named sizes (tailwind.config.js fontSize) would otherwise be read as colours, e.g. text-display vs text-ink.
const twMerge = extendTailwindMerge({ extend: { classGroups: { 'font-size': [{ text: ['display', 'title', 'numeral', 'caption'] }] } } });

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
