import { useState } from 'react';

// Client-side paging for a list that is already loaded: show `size` items, then `size` more on each tap.
// Returns the visible slice plus what's needed for a "Show more" button.
export function usePaged(list = [], size = 10) {
  const [count, setCount] = useState(size);
  const shown = list.slice(0, count);
  const left = Math.max(0, list.length - shown.length);
  return {
    shown,
    left,
    next: Math.min(size, left),
    more: () => setCount((n) => n + size),
    reset: () => setCount(size),
  };
}
