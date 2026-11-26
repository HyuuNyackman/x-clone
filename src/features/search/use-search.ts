import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import type { TimelineCursor } from '@/features/posts/posts-api';
import { searchPostsPage, searchUsers } from '@/features/search/search-api';

// 入力が止まってから、この時間がたつまで値を変えない。
export const SEARCH_DEBOUNCE_MS = 400;

export function useDebouncedValue<T>(value: T, delayMs = SEARCH_DEBOUNCE_MS): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

// 検索語の前後の空白は無視する。空なら検索しない。
export function normalizeQuery(text: string): string {
  return text.trim();
}

export function useSearchPosts(query: string) {
  return useInfiniteQuery({
    queryKey: ['search', 'posts', query],
    queryFn: ({ pageParam }) => searchPostsPage(query, pageParam),
    initialPageParam: null as TimelineCursor | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: query.length > 0,
  });
}

export function useSearchUsers(query: string) {
  return useQuery({
    queryKey: ['search', 'users', query],
    queryFn: () => searchUsers(query),
    enabled: query.length > 0,
  });
}
