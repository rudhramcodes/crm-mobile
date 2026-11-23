import { useEffect, useState } from 'react';

// Search box state for list screens: `typed` follows the input, `search` settles 350 ms after typing stops.
// setSearch stays exposed so "submit" and "clear" can apply at once.
export function useDebouncedSearch(delay = 350) {
  const [typed, setTyped] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setSearch(typed.trim()), delay);
    return () => clearTimeout(t);
  }, [typed, delay]);
  return { typed, setTyped, search, setSearch };
}
