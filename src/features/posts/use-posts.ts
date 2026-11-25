import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';

import { useAuthStore } from '@/features/auth/auth-store';
import {
  createPost,
  deletePost,
  fetchTimelinePage,
  type Post,
  type TimelineCursor,
  type TimelinePage,
} from '@/features/posts/posts-api';
import { useProfile } from '@/features/profile/use-profile';

export const timelineKey = ['posts', 'timeline'] as const;

type TimelineData = InfiniteData<TimelinePage, TimelineCursor | null>;

export function useTimeline() {
  return useInfiniteQuery({
    queryKey: timelineKey,
    queryFn: ({ pageParam }) => fetchTimelinePage(pageParam),
    initialPageParam: null as TimelineCursor | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
}

// 全ページの投稿を 1 本にする。同じ id は 1 回だけ出す。
export function flattenTimeline(data: { pages: TimelinePage[] } | undefined): Post[] {
  const seen = new Set<string>();
  const posts: Post[] = [];
  for (const page of data?.pages ?? []) {
    for (const post of page.posts) {
      if (!seen.has(post.id)) {
        seen.add(post.id);
        posts.push(post);
      }
    }
  }
  return posts;
}

function mapFirstPage(data: TimelineData | undefined, fn: (posts: Post[]) => Post[]) {
  if (!data || data.pages.length === 0) return data;
  const [first, ...rest] = data.pages;
  return { ...data, pages: [{ ...first, posts: fn(first.posts) }, ...rest] };
}

// 投稿する。送信中から、仮の投稿を先頭に出す (楽観的更新)。失敗したら元に戻す。
export function useCreatePost() {
  const userId = useAuthStore((state) => state.session?.user.id);
  const profile = useProfile().data;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: string) => {
      if (!userId) throw new Error('ログインしていません');
      return createPost(userId, body);
    },
    onMutate: async (body) => {
      await queryClient.cancelQueries({ queryKey: timelineKey });
      const previous = queryClient.getQueryData<TimelineData>(timelineKey);
      if (userId) {
        const optimistic: Post = {
          id: `optimistic-${Date.now()}`,
          authorId: userId,
          body,
          createdAt: new Date().toISOString(),
          author: { handle: profile?.handle ?? '', displayName: profile?.displayName ?? '' },
        };
        queryClient.setQueryData<TimelineData>(timelineKey, (old) =>
          mapFirstPage(old, (posts) => [optimistic, ...posts]),
        );
      }
      return { previous };
    },
    onError: (_error, _body, context) => {
      queryClient.setQueryData(timelineKey, context?.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: timelineKey }),
  });
}

// 自分の投稿を消す。押した瞬間にタイムラインから外し、失敗したら戻す。
export function useDeletePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deletePost,
    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: timelineKey });
      const previous = queryClient.getQueryData<TimelineData>(timelineKey);
      queryClient.setQueryData<TimelineData>(
        timelineKey,
        (old) =>
          old && {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              posts: page.posts.filter((post) => post.id !== postId),
            })),
          },
      );
      return { previous };
    },
    onError: (_error, _postId, context) => {
      queryClient.setQueryData(timelineKey, context?.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: timelineKey }),
  });
}
