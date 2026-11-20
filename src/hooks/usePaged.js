import { useEffect, useState } from 'react';

// The page number for a server-paged list. It goes back to page 1 whenever `key` (the filters) changes,
// without an effect, so the first request after a filter change already asks for page 1.
export function usePage(key) {
  const [state, setState] = useState({ key, page: 1 });
  const page = state.key === key ? state.page : 1;
  return [page, (p) => setState({ key, page: p })];
}

// Client-side pages for a list that is already loaded (e.g. a project's activity log). Same shape as the
// server's pagination meta, so it plugs straight into <Pager>.
export function usePaged(list = [], limit = 10, key = '') {
  const [page, setPage] = usePage(key);
  const total = list.length;
  const pages = Math.max(1, Math.ceil(total / limit));
  const at = Math.min(page, pages);
  return { shown: list.slice((at - 1) * limit, at * limit), page: at, pages, total, limit, setPage };
}

// Wraps a page-number change for a list: moves to the page and scrolls the list back to its top.
// If deletes leave the current page past the end, it steps back to the last real page.
export function usePageNav(listRef, page, setPage, pages) {
  const past = !!pages && page > pages;
  useEffect(() => {
    if (past) setPage(pages);
  }, [past, pages, setPage]);
  return (p) => {
    setPage(p);
    listRef.current?.scrollToOffset?.({ offset: 0, animated: true });
    listRef.current?.scrollTo?.({ y: 0, animated: true });
  };
}
